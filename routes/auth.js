// 로그인 API (Firebase 연결)
//
//   GET  /api/auth/config     브라우저가 Firebase를 켤 때 쓰는 공개 설정값
//   POST /api/auth/firebase   { idToken, nickname? }  Firebase가 확인한 사람을 우리 사이트에 로그인
//   POST /api/auth/logout     로그아웃
//   GET  /api/auth/me         지금 로그인한 사람 (없으면 null)
//   DELETE /api/auth/me       회원 탈퇴 { idToken } — 방금(5분 안에) 다시 로그인해서 받은 증명서가 필요
//
// 비밀번호 확인, 구글 로그인, 비밀번호 찾기 메일, 이메일 인증 메일은 Firebase가 처리합니다.

const express = require('express');
const db = require('../db/database');
const auth = require('../lib/auth');
const firebase = require('../lib/firebase');
const cleanup = require('../lib/cleanup');

const router = express.Router();

router.get('/config', (req, res) => {
  res.json(firebase.publicConfig());
});

router.get('/me', (req, res) => {
  res.json({ user: req.user });
});

router.post('/firebase', async (req, res) => {
  const ipKey = 'login-ip:' + (req.ip || 'unknown');
  if (auth.loginLimiter.blocked(ipKey)) return res.status(429).json({ error: auth.loginLimiter.message });
  auth.loginLimiter.hit(ipKey);

  const idToken = String((req.body && req.body.idToken) || '');
  if (!idToken) return res.status(400).json({ error: '로그인 정보가 없어요. 다시 로그인해 주세요.' });

  // 1) Firebase가 발급한 진짜 증명서인지 확인
  let decoded;
  try {
    decoded = await firebase.verifyIdToken(idToken);
  } catch (err) {
    return res.status(401).json({ error: '로그인 정보를 확인하지 못했어요. 다시 로그인해 주세요.' });
  }

  const uid = decoded.uid;
  const email = String(decoded.email || '').trim().toLowerCase();
  const verified = decoded.email_verified === true;
  if (!email) return res.status(400).json({ error: '이메일이 있는 계정만 가입할 수 있어요.' });

  // 2) 우리 회원 찾기: Firebase 회원 번호 → 없으면 이메일
  let row = db.prepare('SELECT id, email, nickname, email_verified, firebase_uid FROM users WHERE firebase_uid = ?').get(uid);
  if (!row) {
    const byEmail = db.prepare('SELECT id, email, nickname, email_verified, firebase_uid FROM users WHERE email = ?').get(email);
    if (byEmail) {
      // 같은 이메일의 예전 계정은 "인증된 이메일"일 때만 이어 붙임 (남의 이메일로 계정을 가로채지 못하게)
      if (!byEmail.firebase_uid && verified) {
        db.prepare('UPDATE users SET firebase_uid = ? WHERE id = ?').run(uid, byEmail.id);
        row = byEmail;
      } else if (!byEmail.firebase_uid) {
        return res.status(409).json({
          error: '이 이메일로 예전에 만든 계정이 있어요. 받은 인증 메일의 링크를 누른 뒤 다시 로그인하면 예전 계정과 연결돼요.',
          code: 'verify-to-link'
        });
      } else {
        return res.status(409).json({ error: '이미 다른 방법으로 가입된 이메일이에요.' });
      }
    }
  }

  // 3) 처음 온 사람: 닉네임을 받아 회원 만들기
  if (!row) {
    if (!req.body.nickname) {
      return res.json({ needNickname: true, suggestion: auth.suggestNickname(decoded.name, email) });
    }
    const { error, value: nickname } = auth.checkNickname(req.body.nickname);
    if (error) return res.status(400).json({ error, code: 'nickname' });
    if (db.prepare('SELECT 1 FROM users WHERE nickname = ?').get(nickname)) {
      return res.status(409).json({ error: '이미 쓰고 있는 닉네임이에요. 다른 닉네임을 정해 주세요.', code: 'nickname' });
    }
    const result = db.prepare(
      'INSERT INTO users (email, nickname, password_hash, firebase_uid, email_verified, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(email, nickname, '!firebase', uid, verified ? 1 : 0, new Date().toISOString());
    row = { id: Number(result.lastInsertRowid), email, nickname };
  }

  // 4) 이메일 인증 상태 최신으로 맞추고 로그인 열쇠 발급 (예전 열쇠는 버림)
  db.prepare('UPDATE users SET email_verified = ? WHERE id = ?').run(verified ? 1 : 0, row.id);
  auth.endSession(req, res);
  auth.startSession(res, row.id);
  res.json({ user: auth.toPublicUser({ ...row, email, email_verified: verified ? 1 : 0 }) });
});

// 회원 탈퇴: 회원 정보와 쓴 글·댓글·반응·영화 점수·신고 기록을 모두 지움
// (Firebase 쪽 계정은 브라우저가 이어서 지움. firebase-auth.js 참고)
router.delete('/me', auth.requireAuth, async (req, res) => {
  const idToken = String((req.body && req.body.idToken) || '');
  let decoded;
  try {
    decoded = await firebase.verifyIdToken(idToken);
  } catch (err) {
    return res.status(401).json({ error: '본인 확인에 실패했어요. 다시 로그인한 뒤 시도해 주세요.' });
  }
  const me = db.prepare('SELECT id, firebase_uid FROM users WHERE id = ?').get(req.user.id);
  if (!me || me.firebase_uid !== decoded.uid) return res.status(403).json({ error: '지금 로그인한 계정과 확인한 계정이 달라요.' });
  // 방금 다시 로그인했는지 (켜 둔 컴퓨터에서 남이 누르는 것을 막기 위해)
  if (!decoded.auth_time || Date.now() / 1000 - decoded.auth_time > 5 * 60) {
    return res.status(401).json({ error: '보안을 위해 다시 로그인한 직후에만 탈퇴할 수 있어요.', code: 'recent-login' });
  }

  const uid = me.id;
  const myPosts = db.prepare('SELECT id, content FROM posts WHERE user_id = ?').all(uid);
  const images = myPosts.flatMap((p) => cleanup.imagesIn(p.content));
  const postIds = myPosts.map((p) => p.id);
  // 내 반응·댓글이 있던 다른 사람 글, 내 점수가 있던 영화 (지운 뒤 숫자를 다시 세려고)
  const touchedPosts = new Set([
    ...db.prepare('SELECT DISTINCT post_id AS id FROM reactions WHERE user_id = ?').all(uid).map((r) => r.id),
    ...db.prepare('SELECT DISTINCT post_id AS id FROM comments WHERE user_id = ?').all(uid).map((r) => r.id)
  ]);
  const touchedMovies = db.prepare('SELECT movie_id AS id FROM movie_ratings WHERE user_id = ?').all(uid).map((r) => r.id);

  db.exec('BEGIN');
  try {
    postIds.forEach((pid) => {
      db.prepare('DELETE FROM reactions WHERE post_id = ?').run(pid);
      db.prepare('DELETE FROM comments WHERE post_id = ?').run(pid);
      db.prepare('DELETE FROM posts WHERE id = ?').run(pid);
      touchedPosts.delete(pid);
    });
    db.prepare('DELETE FROM reactions WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM comments WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM movie_ratings WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM reports WHERE reporter_id = ?').run(uid);
    db.prepare('UPDATE reports SET handled_by = NULL WHERE handled_by = ?').run(uid);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM users WHERE id = ?').run(uid);
    touchedPosts.forEach((pid) => cleanup.recountPost(pid));
    touchedMovies.forEach((mid) => cleanup.recountMovie(mid));
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: '탈퇴 처리 중 문제가 생겼어요. 잠시 후 다시 시도하거나 운영자에게 알려 주세요.' });
  }
  cleanup.removeImagesIfUnused(images);
  auth.endSession(req, res);
  res.json({ ok: true, deletedPosts: postIds.length });
});

router.post('/logout', (req, res) => {
  auth.endSession(req, res);
  res.json({ ok: true });
});

module.exports = router;
