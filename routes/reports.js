// 신고 API
//
//   POST /api/reports                 신고하기 { targetType: 'post'|'comment', targetId, reason, detail } (이메일 인증 회원)
//   GET  /api/reports?status=open     신고 목록 (관리자)
//   POST /api/reports/handle          처리하기 { targetType, targetId, status: 'resolved'|'dismissed' } (관리자, 같은 대상의 신고를 한꺼번에)
//
// 신고된 글·댓글을 실제로 지우는 건 관리자가 기존 삭제 기능(글 보기 화면의 삭제, 댓글 삭제)으로 합니다.
// 관리자 화면에서 "삭제하고 처리" 버튼을 누르면 삭제와 처리를 한 번에 합니다.

const express = require('express');
const db = require('../db/database');
const { requireVerified, requireAdmin } = require('../lib/auth');

const router = express.Router();

const REASONS = {
  gore: '과도한 신체 훼손·유혈 묘사',
  defamation: '실존 인물·피해자 비하, 명예훼손',
  privacy: '개인정보 노출',
  copyright: '허락 없이 옮긴 글·사진 (저작권)',
  spam: '광고·도배',
  other: '기타'
};

// 신고하기
router.post('/', requireVerified, (req, res) => {
  const targetType = req.body && req.body.targetType;
  const targetId = Number(req.body && req.body.targetId);
  const reason = req.body && req.body.reason;
  const detail = String((req.body && req.body.detail) || '').trim().slice(0, 500);
  if (!['post', 'comment'].includes(targetType) || !Number.isInteger(targetId)) return res.status(400).json({ error: '신고할 대상이 올바르지 않아요.' });
  if (!REASONS[reason]) return res.status(400).json({ error: '신고 이유를 골라 주세요.' });
  if (reason === 'other' && !detail) return res.status(400).json({ error: '기타를 고르셨다면 이유를 적어 주세요.' });

  const target = targetType === 'post'
    ? db.prepare('SELECT user_id FROM posts WHERE id = ?').get(targetId)
    : db.prepare('SELECT user_id FROM comments WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: '신고할 글이나 댓글을 찾을 수 없어요. 이미 삭제되었을 수 있어요.' });
  if (target.user_id === req.user.id) return res.status(400).json({ error: '내가 쓴 글은 신고할 수 없어요. 수정하거나 삭제해 주세요.' });

  try {
    db.prepare('INSERT INTO reports (target_type, target_id, reporter_id, reason, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(targetType, targetId, req.user.id, reason, detail, new Date().toISOString());
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return res.status(409).json({ error: '이미 신고한 글이에요. 관리자가 확인하고 있어요.' });
    throw err;
  }
  res.status(201).json({ ok: true });
});

// 신고 목록 (관리자): 같은 대상의 신고를 묶어서 보여 줌
router.get('/', requireAdmin, (req, res) => {
  const status = ['open', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : 'open';
  const rows = db.prepare(
    `SELECT r.*, u.nickname AS reporter FROM reports r JOIN users u ON u.id = r.reporter_id
      WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 300`
  ).all(status);

  const groups = new Map();
  rows.forEach((r) => {
    const key = r.target_type + ':' + r.target_id;
    if (!groups.has(key)) groups.set(key, { targetType: r.target_type, targetId: r.target_id, reports: [] });
    groups.get(key).reports.push({ id: r.id, reason: r.reason, reasonLabel: REASONS[r.reason] || r.reason, detail: r.detail, reporter: r.reporter, createdAt: r.created_at, handledAt: r.handled_at });
  });

  const items = [...groups.values()].map((g) => {
    let target = null;
    if (g.targetType === 'post') {
      const p = db.prepare('SELECT p.id, p.title, p.excerpt, COALESCE(u.nickname, p.author) AS author FROM posts p LEFT JOIN users u ON u.id = p.user_id WHERE p.id = ?').get(g.targetId);
      if (p) target = { title: p.title, preview: p.excerpt, author: p.author, link: 'post.html?id=' + p.id };
    } else {
      const c = db.prepare('SELECT c.id, c.post_id, c.content, u.nickname AS author FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?').get(g.targetId);
      if (c) target = { title: '댓글', preview: c.content.slice(0, 200), author: c.author, link: 'post.html?id=' + c.post_id + '#cm' };
    }
    return { ...g, count: g.reports.length, target, deleted: !target };
  }).sort((a, b) => b.count - a.count);

  const openCount = db.prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'").get().n;
  res.json({ items, openCount, reasons: REASONS });
});

// 처리하기 (관리자): 같은 대상의 열린 신고를 한꺼번에 처리
router.post('/handle', requireAdmin, (req, res) => {
  const targetType = req.body && req.body.targetType;
  const targetId = Number(req.body && req.body.targetId);
  const status = req.body && req.body.status;
  if (!['post', 'comment'].includes(targetType) || !Number.isInteger(targetId)) return res.status(400).json({ error: '대상이 올바르지 않아요.' });
  if (!['resolved', 'dismissed'].includes(status)) return res.status(400).json({ error: '처리 상태가 올바르지 않아요.' });
  const r = db.prepare(
    "UPDATE reports SET status = ?, handled_at = ?, handled_by = ? WHERE target_type = ? AND target_id = ? AND status = 'open'"
  ).run(status, new Date().toISOString(), req.user.id, targetType, targetId);
  res.json({ ok: true, handled: r.changes });
});

module.exports = router;
