// 프로필 API
//   GET /api/users/:id     닉네임, 가입일, 쓴 글 수, 받은 소름 수 (이메일 등은 공개하지 않음)
//   글 목록은 GET /api/posts?author=:id 로 가져옵니다.

const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/:id', (req, res) => {
  const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : null;
  const user = id && db.prepare('SELECT id, nickname, created_at FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: '없는 회원이에요. 탈퇴했을 수 있어요.' });
  const s = db.prepare(
    'SELECT COUNT(*) AS posts, COALESCE(SUM(like_count), 0) AS likes, COALESCE(SUM(is_best), 0) AS best FROM posts WHERE user_id = ?'
  ).get(id);
  res.json({
    user: { id: user.id, nickname: user.nickname, joinedAt: user.created_at },
    stats: { posts: s.posts, likesReceived: s.likes, bestPosts: s.best },
    isMe: !!req.user && req.user.id === user.id
  });
});

module.exports = router;
