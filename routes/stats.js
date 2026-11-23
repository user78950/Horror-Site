// 홈 화면 숫자 (모두 실제 DB에서 계산)
//
//   GET /api/stats/home
//     todayShudders  오늘(한국 시간) 눌린 소름 수
//     storytellers   최근 7일 동안 받은 소름이 많은 작가 TOP 3
//     hourly         최근 7일 소름이 눌린 시간대 (한국 시간 0~23시, 24칸)
//     bestThreshold  베스트 기준 점수

const express = require('express');
const db = require('../db/database');

const router = express.Router();
const KST = 9 * 60 * 60 * 1000;

router.get('/home', (req, res) => {
  const now = Date.now();
  // 한국 시간 오늘 0시를 UTC 시각으로
  const kstNow = new Date(now + KST);
  const todayStartUtc = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - KST).toISOString();
  const weekAgo = new Date(now - 7 * 86400 * 1000).toISOString();

  const todayShudders = db.prepare("SELECT COUNT(*) AS n FROM reactions WHERE type = 'like' AND created_at >= ?").get(todayStartUtc).n;

  const storytellers = db.prepare(
    `SELECT u.nickname AS nickname, COUNT(*) AS likes, COUNT(DISTINCT p.id) AS posts
       FROM reactions r JOIN posts p ON p.id = r.post_id JOIN users u ON u.id = p.user_id
      WHERE r.type = 'like' AND r.created_at >= ?
      GROUP BY u.id ORDER BY likes DESC, posts DESC LIMIT 3`
  ).all(weekAgo);

  const hourly = new Array(24).fill(0);
  db.prepare("SELECT created_at FROM reactions WHERE type = 'like' AND created_at >= ?").all(weekAgo)
    .forEach((r) => { hourly[new Date(new Date(r.created_at).getTime() + KST).getUTCHours()] += 1; });

  res.json({
    todayShudders,
    storytellers,
    hourly,
    bestThreshold: Math.max(1, Number(process.env.BEST_THRESHOLD) || 10)
  });
});

module.exports = router;
