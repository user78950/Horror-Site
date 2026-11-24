// 괴담 글 API: 목록 · 보기 · 쓰기 · 수정 · 삭제
//
//   GET    /api/posts            목록 (?category=real&page=1)
//   GET    /api/posts/:id        글 하나 (조회 수 +1)
//   POST   /api/posts            새 글
//   PUT    /api/posts/:id        수정
//   DELETE /api/posts/:id        삭제
//   POST   /api/posts/:id/reaction  소름·덤덤 누르기 / 바꾸기 / 취소 { type: 'like' | 'dislike' | null }
//
// 베스트: 소름 − 덤덤 점수가 BEST_THRESHOLD(.env, 기본 10) 이상이면 자동으로 베스트가 됩니다.
//
// 권한: 목록·보기는 누구나 / 쓰기는 이메일 인증을 마친 회원 / 수정·삭제는 작성자 본인과 관리자만

const express = require('express');
const db = require('../db/database');
const { cleanContent, plainText, extractEffects } = require('../lib/sanitize');
const { requireAuth, requireVerified } = require('../lib/auth');
const cleanup = require('../lib/cleanup');

const router = express.Router();

const CATEGORIES = ['intl', 'real', 'novel', 'legend', 'film'];
const WARNINGS = ['faint', 'jumpscare', 'claustrophobia'];
const PAGE_SIZE = 20;
const BEST_THRESHOLD = Math.max(1, Number(process.env.BEST_THRESHOLD) || 10);

const parse = (text, fallback) => { try { return JSON.parse(text); } catch (e) { return fallback; } };

// 이 글을 지금 사람이 고칠 수 있는지 (작성자 본인 또는 관리자)
const canEdit = (row, user) => !!user && (user.isAdmin || (row.user_id != null && row.user_id === user.id));

// 작성자 이름은 회원 닉네임을 우선 (닉네임이 바뀌어도 따라감)
const SELECT_POST = `SELECT p.*, COALESCE(u.nickname, p.author) AS author_name
                       FROM posts p LEFT JOIN users u ON u.id = p.user_id`;

function toPost(row, full, user) {
  const post = {
    id: row.id,
    category: row.category,
    title: row.title,
    excerpt: row.excerpt,
    author: row.author_name || row.author,
    authorId: row.user_id || null,
    warnings: parse(row.warnings, []),
    tags: parse(row.tags, []),
    effectsCount: parse(row.effects, []).length,
    likes: row.like_count || 0,
    dislikes: row.dislike_count || 0,
    score: (row.like_count || 0) - (row.dislike_count || 0),
    isBest: !!row.is_best,
    comments: row.comment_count || 0,
    views: row.views,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  if (full) {
    post.display = row.display === 'void' ? 'void' : 'normal';
    post.canEdit = canEdit(row, user);
    post.content = row.content;
    post.sourceUrl = row.source_url || '';
    post.effects = parse(row.effects, []);
  }
  return post;
}

// 들어온 값 검사 → 문제가 있으면 { error } 를, 없으면 저장할 값을 돌려줌
function validate(body) {
  const category = String(body.category || '');
  if (!CATEGORIES.includes(category)) return { error: '괴담 범주를 골라 주세요.' };

  const title = String(body.title || '').trim();
  if (!title) return { error: '제목을 입력해 주세요.' };
  if (title.length > 60) return { error: '제목은 60자까지 쓸 수 있어요.' };

  const content = cleanContent(body.content);
  const text = plainText(content);
  if (text.length < 10) return { error: '본문을 10자 이상 써 주세요.' };
  if (content.length > 200000) return { error: '본문이 너무 길어요. 나눠서 올려 주세요.' };

  let sourceUrl = String(body.source_url || '').trim();
  if (category === 'intl') {
    if (!/^https?:\/\/\S+$/i.test(sourceUrl)) return { error: '해외 번역 글은 원문 주소(http로 시작)를 꼭 적어 주세요.' };
  } else if (sourceUrl && !/^https?:\/\/\S+$/i.test(sourceUrl)) {
    sourceUrl = '';
  }

  const warnings = (Array.isArray(body.warnings) ? body.warnings : []).filter((w) => WARNINGS.includes(w));
  const tags = (Array.isArray(body.tags) ? body.tags : [])
    .map((t) => String(t).trim().replace(/\s+/g, ''))
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : '#' + t).slice(0, 20))
    .slice(0, 5);

  const display = body.display === 'void' ? 'void' : 'normal';

  return {
    value: {
      category, title, content, sourceUrl, display,
      excerpt: text.slice(0, 140),
      warnings: JSON.stringify(warnings),
      tags: JSON.stringify(tags),
      effects: JSON.stringify(extractEffects(content))
    }
  };
}

const validId = (req, res) => {
  if (!/^\d+$/.test(req.params.id)) { res.status(404).json({ error: '글을 찾을 수 없어요.' }); return null; }
  return Number(req.params.id);
};

// 목록
router.get('/', (req, res) => {
  const category = CATEGORIES.includes(req.query.category) ? req.query.category : null;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const conditions = [];
  const args = [];
  if (category) { conditions.push('p.category = ?'); args.push(category); }
  if (req.query.best === '1') conditions.push('p.is_best = 1');           // 명예의 전당
  if (/^\d+$/.test(String(req.query.author || ''))) { conditions.push('p.user_id = ?'); args.push(Number(req.query.author)); }   // 프로필
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const order = req.query.best === '1'
    ? 'p.best_at DESC, p.id DESC'                                          // 최근에 베스트가 된 순
    : req.query.sort === 'hot'
      ? '(p.like_count - p.dislike_count) DESC, p.like_count DESC, p.created_at DESC'   // 소름 많은순
      : req.query.sort === 'comments'
        ? 'p.comment_count DESC, p.created_at DESC'                        // 댓글순
        : 'p.created_at DESC, p.id DESC';                                  // 최신순
  const rows = db.prepare(`${SELECT_POST} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...args, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM posts p ${where}`).get(...args).n;
  res.json({ posts: rows.map((r) => toPost(r, false)), page, total, pageSize: PAGE_SIZE });
});

// 글 하나
router.get('/:id', (req, res) => {
  const id = validId(req, res); if (id === null) return;
  if (req.query.edit !== '1') db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(id);
  const row = db.prepare(`${SELECT_POST} WHERE p.id = ?`).get(id);
  if (!row) return res.status(404).json({ error: '글을 찾을 수 없어요. 삭제되었을 수 있어요.' });
  const post = toPost(row, true, req.user);
  post.isMine = !!req.user && row.user_id === req.user.id;
  post.myReaction = req.user
    ? (db.prepare('SELECT type FROM reactions WHERE user_id = ? AND post_id = ?').get(req.user.id, id) || {}).type || null
    : null;
  post.bestThreshold = BEST_THRESHOLD;
  res.json({ post });
});

// 새 글
router.post('/', requireVerified, (req, res) => {
  const { error, value: v } = validate(req.body || {});
  if (error) return res.status(400).json({ error });
  const now = new Date().toISOString();
  const result = db.prepare(
    `INSERT INTO posts (category, title, content, excerpt, author, user_id, source_url, warnings, tags, effects, display, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(v.category, v.title, v.content, v.excerpt, req.user.nickname, req.user.id, v.sourceUrl || null, v.warnings, v.tags, v.effects, v.display, now, now);
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

// 수정
// 수정·삭제 전에: 글이 있는지, 지금 사람이 고칠 수 있는지 확인
function findEditable(req, res, id) {
  const row = db.prepare('SELECT id, user_id, content FROM posts WHERE id = ?').get(id);
  if (!row) { res.status(404).json({ error: '글을 찾을 수 없어요. 삭제되었을 수 있어요.' }); return null; }
  if (!canEdit(row, req.user)) { res.status(403).json({ error: '내가 쓴 글만 수정·삭제할 수 있어요.' }); return null; }
  return row;
}

router.put('/:id', requireAuth, (req, res) => {
  const id = validId(req, res); if (id === null) return;
  const before = findEditable(req, res, id); if (!before) return;
  const { error, value: v } = validate(req.body || {});
  if (error) return res.status(400).json({ error });
  const result = db.prepare(
    `UPDATE posts SET category = ?, title = ?, content = ?, excerpt = ?, source_url = ?,
                      warnings = ?, tags = ?, effects = ?, display = ?, updated_at = ?
      WHERE id = ?`
  ).run(v.category, v.title, v.content, v.excerpt, v.sourceUrl || null, v.warnings, v.tags, v.effects, v.display, new Date().toISOString(), id);
  if (result.changes === 0) return res.status(404).json({ error: '글을 찾을 수 없어요. 삭제되었을 수 있어요.' });
  // 수정하면서 본문에서 뺀 사진 파일은 지움
  const kept = new Set(cleanup.imagesIn(v.content));
  cleanup.removeImagesIfUnused(cleanup.imagesIn(before.content).filter((n) => !kept.has(n)));
  res.json({ id });
});

// 삭제
router.delete('/:id', requireAuth, (req, res) => {
  const id = validId(req, res); if (id === null) return;
  const before = findEditable(req, res, id); if (!before) return;
  db.prepare('DELETE FROM reactions WHERE post_id = ?').run(id);
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(id);
  const result = db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: '이미 삭제된 글이에요.' });
  cleanup.removeImagesIfUnused(cleanup.imagesIn(before.content));   // 글에 쓰인 사진 파일도 지움
  res.json({ ok: true });
});

// 소름·덤덤
router.post('/:id/reaction', requireVerified, (req, res) => {
  const id = validId(req, res); if (id === null) return;
  const type = req.body && req.body.type;
  if (![null, 'like', 'dislike'].includes(type === undefined ? null : type)) {
    return res.status(400).json({ error: '반응 종류가 올바르지 않아요.' });
  }
  const post = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(id);
  if (!post) return res.status(404).json({ error: '글을 찾을 수 없어요. 삭제되었을 수 있어요.' });
  if (post.user_id === req.user.id) return res.status(403).json({ error: '내 글에는 반응할 수 없어요.' });

  // 반응 저장과 숫자 갱신을 한 번에 (중간에 실패하면 모두 취소)
  db.exec('BEGIN');
  try {
    if (type) {
      db.prepare(
        `INSERT INTO reactions (user_id, post_id, type, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, post_id) DO UPDATE SET type = excluded.type`
      ).run(req.user.id, id, type, new Date().toISOString());
    } else {
      db.prepare('DELETE FROM reactions WHERE user_id = ? AND post_id = ?').run(req.user.id, id);
    }
    const c = db.prepare(
      `SELECT SUM(type = 'like') AS likes, SUM(type = 'dislike') AS dislikes FROM reactions WHERE post_id = ?`
    ).get(id);
    const likes = c.likes || 0;
    const dislikes = c.dislikes || 0;
    const best = likes - dislikes >= BEST_THRESHOLD ? 1 : 0;
    // 처음 베스트가 된 시각은 남겨 둠 (점수가 내려가면 베스트에서 빠지지만, 다시 오르면 원래 시각 유지)
    db.prepare(
      `UPDATE posts SET like_count = ?, dislike_count = ?, is_best = ?,
              best_at = CASE WHEN ? = 1 AND best_at IS NULL THEN ? ELSE best_at END
        WHERE id = ?`
    ).run(likes, dislikes, best, best, new Date().toISOString(), id);
    db.exec('COMMIT');
    res.json({ likes, dislikes, score: likes - dislikes, isBest: !!best, myReaction: type || null, bestThreshold: BEST_THRESHOLD });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: '반응을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
});

module.exports = router;
module.exports.validate = validate;
