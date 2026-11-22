// 무서운 게 딱좋아! — 로그인 보안 장치
//
// 로그인 자체(비밀번호 확인, 구글 로그인, 비밀번호 찾기, 이메일 인증)는 Firebase가 맡고,
// 여기서는 Firebase가 확인해 준 사람에게 우리 사이트의 로그인 상태를 만들어 줍니다.
//
// 1. 세션           : 로그인하면 무작위 열쇠를 쿠키로 주고, DB에는 그 열쇠의 해시만 저장
// 2. 시도 제한       : 같은 곳에서 로그인 요청을 지나치게 많이 보내면 잠시 막음
// 3. 출처 확인       : 다른 사이트에서 몰래 보내는 글쓰기·삭제 요청을 거절
// 4. 이메일 인증     : 인증을 마친 사람만 글쓰기·사진 올리기, 관리자 권한도 인증된 이메일만

const crypto = require('crypto');
const db = require('../db/database');

const SESSION_COOKIE = 'sid';
const SESSION_DAYS = Number(process.env.SESSION_DAYS) || 14;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// 관리자: .env 의 ADMIN_EMAILS=a@b.com,c@d.com  → 모든 글을 수정·삭제할 수 있음 (신고 처리용)
const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

/* =========================================================
   닉네임 검사 (처음 가입할 때)
   ========================================================= */
function checkNickname(raw) {
  const n = String(raw || '').trim();
  if (n.length < 2 || n.length > 12) return { error: '닉네임은 2~12자로 정해 주세요.' };
  if (!/^[0-9A-Za-z가-힣_]+$/.test(n)) return { error: '닉네임은 한글, 영문, 숫자, 밑줄(_)만 쓸 수 있어요.' };
  return { value: n };
}

// 구글 이름 등으로 닉네임 후보 만들기 (허용 글자만 남김)
function suggestNickname(name, email) {
  const base = String(name || String(email || '').split('@')[0] || '').replace(/[^0-9A-Za-z가-힣_]/g, '').slice(0, 12);
  return base.length >= 2 ? base : '';
}

/* =========================================================
   2. 세션 (로그인 유지)
   ========================================================= */
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) {
      const key = part.slice(0, i).trim();
      try { out[key] = decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { /* 깨진 쿠키 무시 */ }
    }
  });
  return out;
}

function cookieOptions(maxAgeSeconds) {
  return [
    'Path=/',
    'HttpOnly',                         // 자바스크립트가 쿠키를 읽지 못하게 (스크립트로 훔쳐 가기 방지)
    'SameSite=Lax',                     // 다른 사이트에서 보낸 글쓰기·삭제 요청에는 쿠키를 붙이지 않음
    IS_PRODUCTION ? 'Secure' : '',      // 배포(https)에서는 암호화된 연결로만 오가게
    'Max-Age=' + maxAgeSeconds
  ].filter(Boolean).join('; ');
}

function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');   // 추측할 수 없는 무작위 열쇠
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400 * 1000);
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(sha256(token), userId, now.toISOString(), expires.toISOString());
  res.setHeader('Set-Cookie', SESSION_COOKIE + '=' + token + '; ' + cookieOptions(SESSION_DAYS * 86400));
}

function endSession(req, res) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.setHeader('Set-Cookie', SESSION_COOKIE + '=; ' + cookieOptions(0));
}

function toPublicUser(row) {
  const verified = !!row.email_verified;
  return {
    id: row.id,
    nickname: row.nickname,
    emailVerified: verified,
    // 관리자는 .env 에 적힌 이메일 + 그 이메일의 인증을 마친 계정만
    isAdmin: verified && ADMIN_EMAILS.includes(String(row.email || '').toLowerCase())
  };
}

// 모든 요청에서: 쿠키의 열쇠로 지금 로그인한 사람을 찾아 req.user 에 담음
function loadUser(req, res, next) {
  req.user = null;
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    const row = db.prepare(
      `SELECT u.id, u.email, u.nickname, u.email_verified, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`
    ).get(sha256(token));
    if (row && row.expires_at > new Date().toISOString()) req.user = toPublicUser(row);
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요해요.' });
  next();
}

// 글쓰기·사진 올리기·소름 누르기는 이메일 인증을 마친 사람만 (가짜 계정으로 도배하거나 베스트를 조작하지 못하게)
function requireVerified(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요해요.' });
  if (!req.user.emailVerified) return res.status(403).json({ error: '이메일 인증을 마쳐야 글쓰기와 소름 누르기를 할 수 있어요. 받은 편지함의 인증 메일을 확인해 주세요.', code: 'verify-email' });
  next();
}

/* =========================================================
   3. 로그인 시도 제한 (서버 메모리에 기록, 서버를 껐다 켜면 초기화)
   ========================================================= */
function createLimiter({ max, windowMs, message }) {
  const hits = new Map();   // 키 → [시각들]
  const recent = (key) => {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    hits.set(key, list);
    return list;
  };
  return {
    blocked: (key) => recent(key).length >= max,
    hit: (key) => { recent(key).push(Date.now()); },
    reset: (key) => { hits.delete(key); },
    message
  };
}

// 비밀번호를 틀린 횟수 제한은 Firebase가 맡고, 우리 서버는 로그인 연결 요청 횟수만 제한
const loginLimiter = createLimiter({ max: 30, windowMs: 15 * 60 * 1000, message: '로그인 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' });

/* =========================================================
   4. 출처 확인: 글쓰기·수정·삭제 요청이 우리 사이트에서 온 것인지
   ========================================================= */
function sameOriginOnly(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.get('origin') || req.get('referer');
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch (e) { host = ''; }
    if (host !== req.get('host')) return res.status(403).json({ error: '다른 사이트에서 보낸 요청은 받을 수 없어요.' });
  }
  next();
}

// 관리자만 (영화 등록·수정·삭제 등)
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요해요.' });
  if (!req.user.isAdmin) return res.status(403).json({ error: '관리자만 할 수 있어요.' });
  next();
}

module.exports = {
  checkNickname, suggestNickname,
  startSession, endSession, loadUser, requireAuth, requireVerified, requireAdmin, toPublicUser,
  loginLimiter, sameOriginOnly
};
