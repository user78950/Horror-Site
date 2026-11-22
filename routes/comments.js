// 댓글 API
//
//   GET    /api/posts/:postId/comments?order=new|old   목록 (기본: 최신순)
//   POST   /api/posts/:postId/comments                 쓰기 { content, anonymous, spoiler }
//   PUT    /api/comments/:id                           수정 { content, spoiler }
//   DELETE /api/comments/:id                           삭제
//
// 권한: 목록은 누구나 / 쓰기는 이메일 인증을 마친 회원 / 수정·삭제는 쓴 사람과 관리자만
// 댓글은 HTML 없이 글자로만 저장하고, 화면에서도 글자로만 넣어서 스크립트를 심을 수 없습니다.

const express = require('express');
const db = require('../db/database');
const { requireAuth, requireVerified } = require('../lib/auth');

const postComments = express.Router({ mergeParams: true });
const comments = express.Router();

const MAX_LENGTH = 1000;

// 짧은 시간에 댓글을 너무 많이 쓰면 잠시 막음 (도배 방지): 1분에 10개
const recent = new Map();
function tooFast(userId) {
  const now = Date.now();
  const list = (recent.get(userId) || []).filter((t) => now - t < 60 * 1000);
  recent.set(userId, list);
  if (list.length >= 10) return true;
  list.push(now);
  return false;
}

function cleanText(raw) {
  return String(raw || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')   // 보이지 않는 제어 문자 제거
    .replace(/\n{3,}/g, '\n\n')                                // 빈 줄은 최대 한 줄
    .trim();
}

const idOf = (raw) => (/^\d+$/.test(String(raw)) ? Number(raw) : null);

const canEdit = (row, user) => !!user && (user.isAdmin || row.user_id === user.id);

function toComment(row, user, postAuthorId) {
  const anon = !!row.anonymous;
  return {
    id: row.id,
    content: row.content,
    author: anon ? '익명의 심야 독자' : row.nickname,
    anonymous: anon,
    isPostAuthor: !anon && row.user_id === postAuthorId,    // 글쓴이가 단 댓글 (익명이면 숨김)
    spoiler: !!row.spoiler,
    createdAt: row.created_at,
    edited: row.updated_at !== row.created_at,
    canEdit: canEdit(row, user),
    isMine: !!user && row.user_id === user.id
  };
}

function refreshCount(postId) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM comments WHERE post_id = ?').get(postId).n;
  db.prepare('UPDATE posts SET comment_count = ? WHERE id = ?').run(n, postId);
  return n;
}

// 목록
postComments.get('/', (req, res) => {
  const postId = idOf(req.params.postId);
  const post = postId && db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: '글을 찾을 수 없어요.' });
  const order = req.query.order === 'old' ? 'c.created_at ASC, c.id ASC' : 'c.created_at DESC, c.id DESC';
  const rows = db.prepare(
    `SELECT c.*, u.nickname FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ? ORDER BY ${order} LIMIT 500`
  ).all(postId);
  res.json({ comments: rows.map((r) => toComment(r, req.user, post.user_id)), total: rows.length });
});

// 쓰기
postComments.post('/', requireVerified, (req, res) => {
  const postId = idOf(req.params.postId);
  const post = postId && db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: '글을 찾을 수 없어요. 삭제되었을 수 있어요.' });

  const content = cleanText(req.body && req.body.content);
  if (!content) return res.status(400).json({ error: '댓글 내용을 입력해 주세요.' });
  if (content.length > MAX_LENGTH) return res.status(400).json({ error: `댓글은 ${MAX_LENGTH}자까지 쓸 수 있어요.` });
  if (tooFast(req.user.id)) return res.status(429).json({ error: '댓글을 너무 빨리 쓰고 있어요. 잠시 후 다시 써 주세요.' });

  const now = new Date().toISOString();
  const result = db.prepare(
    'INSERT INTO comments (post_id, user_id, content, anonymous, spoiler, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(postId, req.user.id, content, req.body.anonymous ? 1 : 0, req.body.spoiler ? 1 : 0, now, now);
  const total = refreshCount(postId);

  const row = db.prepare('SELECT c.*, u.nickname FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json({ comment: toComment(row, req.user, post.user_id), total });
});

// 수정·삭제 전에: 댓글이 있는지, 지금 사람이 고칠 수 있는지
function findEditable(req, res) {
  const id = idOf(req.params.id);
  const row = id && db.prepare('SELECT c.*, u.nickname FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?').get(id);
  if (!row) { res.status(404).json({ error: '댓글을 찾을 수 없어요. 삭제되었을 수 있어요.' }); return null; }
  if (!canEdit(row, req.user)) { res.status(403).json({ error: '내가 쓴 댓글만 수정·삭제할 수 있어요.' }); return null; }
  return row;
}

comments.put('/:id', requireAuth, (req, res) => {
  const row = findEditable(req, res); if (!row) return;
  const content = cleanText(req.body && req.body.content);
  if (!content) return res.status(400).json({ error: '댓글 내용을 입력해 주세요.' });
  if (content.length > MAX_LENGTH) return res.status(400).json({ error: `댓글은 ${MAX_LENGTH}자까지 쓸 수 있어요.` });
  const spoiler = req.body.spoiler === undefined ? row.spoiler : (req.body.spoiler ? 1 : 0);
  db.prepare('UPDATE comments SET content = ?, spoiler = ?, updated_at = ? WHERE id = ?').run(content, spoiler, new Date().toISOString(), row.id);
  const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(row.post_id) || {};
  const updated = db.prepare('SELECT c.*, u.nickname FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?').get(row.id);
  res.json({ comment: toComment(updated, req.user, post.user_id) });
});

comments.delete('/:id', requireAuth, (req, res) => {
  const row = findEditable(req, res); if (!row) return;
  db.prepare('DELETE FROM comments WHERE id = ?').run(row.id);
  res.json({ ok: true, total: refreshCount(row.post_id) });
});

module.exports = { postComments, comments };
