// 임시 저장 글 API: 발행하기 전 글을 서버에 여러 개 보관하고 이어 쓰기
//
//   GET    /api/drafts        내 임시 글 목록 (최근에 고친 순)
//   GET    /api/drafts/:id    임시 글 하나 (글쓰기 화면에 채우기용)
//   POST   /api/drafts        새로 저장 (1인당 MAX_DRAFTS 개까지)
//   PUT    /api/drafts/:id    덮어쓰기 (글쓰기 화면의 자동 저장)
//   DELETE /api/drafts/:id    지우기
//
// 권한: 로그인한 본인 것만. 남의 임시 글은 관리자도 볼 수 없어요 (모든 쿼리에 user_id 조건).
// 이메일 인증 전에도 저장은 할 수 있어요 (발행만 인증 후).
// 발행하면 routes/posts.js 의 새 글 API가 해당 임시 글을 지웁니다.
// 마지막 수정 후 90일이 지나면 lib/cleanup.js 의 주기 정리가 지웁니다.

const express = require('express');
const db = require('../db/database');
const { cleanContent, plainText } = require('../lib/sanitize');
const { requireAuth } = require('../lib/auth');
const cleanup = require('../lib/cleanup');
const { CATEGORIES, cleanWarnings, cleanTags } = require('./posts');

const router = express.Router();
const MAX_DRAFTS = 20;
const NOT_FOUND = '임시 저장 글을 찾을 수 없어요. 이미 발행했거나 지웠을 수 있어요.';

const parse = (text, fallback) => { try { return JSON.parse(text); } catch (e) { return fallback; } };

router.use(requireAuth);

// 발행보다 느슨한 정리: 제목·본문이 비어 있어도 저장은 됨. 본문 HTML은 꼭 정리해서 보관.
function clean(body) {
  const title = String(body.title || '').trim();
  if (title.length > 60) return { error: '제목은 60자까지 쓸 수 있어요.' };
  const content = cleanContent(body.content || '');
  if (content.length > 200000) return { error: '본문이 너무 길어요. 나눠서 저장해 주세요.' };
  const category = CATEGORIES.includes(body.category) ? body.category : 'real';
  return {
    value: {
      category, title, content,
      excerpt: plainText(content).slice(0, 140),
      sourceUrl: String(body.source_url || '').trim().slice(0, 500),
      display: body.display === 'void' ? 'void' : 'normal',
      warnings: JSON.stringify(cleanWarnings(body.warnings)),
      tags: JSON.stringify(cleanTags(body.tags))
    }
  };
}

const validId = (req, res) => {
  if (!/^\d+$/.test(req.params.id)) { res.status(404).json({ error: NOT_FOUND }); return null; }
  return Number(req.params.id);
};

const findMine = (id, userId) => db.prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?').get(id, userId);

// 목록
router.get('/', (req, res) => {
  const rows = db.prepare(
    'SELECT id, category, title, excerpt, created_at, updated_at FROM drafts WHERE user_id = ? ORDER BY updated_at DESC, id DESC'
  ).all(req.user.id);
  res.json({
    drafts: rows.map((r) => ({ id: r.id, category: r.category, title: r.title, excerpt: r.excerpt, createdAt: r.created_at, updatedAt: r.updated_at })),
    max: MAX_DRAFTS
  });
});

// 하나
router.get('/:id', (req, res) => {
  const id = validId(req, res); if (id === null) return;
  const r = findMine(id, req.user.id);
  if (!r) return res.status(404).json({ error: NOT_FOUND });
  res.json({
    draft: {
      id: r.id, category: r.category, title: r.title, content: r.content, sourceUrl: r.source_url,
      display: r.display, warnings: parse(r.warnings, []), tags: parse(r.tags, []), updatedAt: r.updated_at
    }
  });
});

// 새로 저장
router.post('/', (req, res) => {
  const { error, value: v } = clean(req.body || {});
  if (error) return res.status(400).json({ error });
  const count = db.prepare('SELECT COUNT(*) AS n FROM drafts WHERE user_id = ?').get(req.user.id).n;
  if (count >= MAX_DRAFTS) {
    return res.status(409).json({ error: `임시 저장은 ${MAX_DRAFTS}개까지 할 수 있어요. 프로필의 "임시 저장" 탭에서 안 쓰는 글을 지워 주세요.` });
  }
  const now = new Date().toISOString();
  const result = db.prepare(
    `INSERT INTO drafts (user_id, category, title, content, excerpt, source_url, display, warnings, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.user.id, v.category, v.title, v.content, v.excerpt, v.sourceUrl, v.display, v.warnings, v.tags, now, now);
  res.status(201).json({ id: Number(result.lastInsertRowid), updatedAt: now });
});

// 덮어쓰기
router.put('/:id', (req, res) => {
  const id = validId(req, res); if (id === null) return;
  const before = findMine(id, req.user.id);
  if (!before) return res.status(404).json({ error: NOT_FOUND });
  const { error, value: v } = clean(req.body || {});
  if (error) return res.status(400).json({ error });
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE drafts SET category = ?, title = ?, content = ?, excerpt = ?, source_url = ?, display = ?,
                       warnings = ?, tags = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`
  ).run(v.category, v.title, v.content, v.excerpt, v.sourceUrl, v.display, v.warnings, v.tags, now, id, req.user.id);
  // 본문에서 뺀 사진은 (다른 글·임시 글에 안 쓰이면) 지움
  const kept = new Set(cleanup.imagesIn(v.content));
  cleanup.removeImagesIfUnused(cleanup.imagesIn(before.content).filter((n) => !kept.has(n)));
  res.json({ id, updatedAt: now });
});

// 지우기
router.delete('/:id', (req, res) => {
  const id = validId(req, res); if (id === null) return;
  const before = findMine(id, req.user.id);
  if (!before) return res.status(404).json({ error: NOT_FOUND });
  db.prepare('DELETE FROM drafts WHERE id = ? AND user_id = ?').run(id, req.user.id);
  cleanup.removeImagesIfUnused(cleanup.imagesIn(before.content));
  res.json({ ok: true });
});

module.exports = router;
