// 정리 작업: 처리방침에 적은 보관 기간을 코드로 지키기 위한 도구 모음
//
// - 글에서 빠진 사진 파일 지우기 (글 수정·삭제, 회원 탈퇴 때)
// - 반응·댓글·영화 점수가 지워진 뒤 숫자 다시 세기
// - 주기 정리(1시간마다): 만료된 로그인 기록, 처리 후 1년 지난 신고, 90일 동안 고치지 않은 임시 저장 글,
//   7일 넘게 어떤 글에도 쓰이지 않은 사진

const fs = require('fs');
const path = require('path');
const db = require('../db/database');

const { UPLOAD_DIR } = require('./paths');
const UPLOAD_RE = /\/uploads\/([0-9a-f-]{36}\.(?:jpg|png))/g;
const DRAFT_DAYS = 90;   // 임시 저장 글 보관 기간 (public/privacy.html 과 맞출 것)
const BEST_THRESHOLD =() => Math.max(1, Number(process.env.BEST_THRESHOLD) || 10);

// 본문 HTML에 쓰인 사진 파일 이름들
function imagesIn(html) {
  const out = new Set();
  let m;
  const re = new RegExp(UPLOAD_RE.source, 'g');
  while ((m = re.exec(String(html || '')))) out.add(m[1]);
  return [...out];
}

// 어떤 글에도 더 이상 쓰이지 않는 사진만 실제로 지움 (다른 글이나 임시 저장 글이 같은 사진을 쓰고 있으면 남김)
function removeImagesIfUnused(names) {
  let removed = 0;
  names.forEach((name) => {
    const like = '%/uploads/' + name + '%';
    const used = db.prepare('SELECT 1 FROM posts WHERE content LIKE ? LIMIT 1').get(like)
      || db.prepare('SELECT 1 FROM drafts WHERE content LIKE ? LIMIT 1').get(like);
    if (used) return;
    try { fs.unlinkSync(path.join(UPLOAD_DIR, name)); removed += 1; } catch (e) { /* 이미 없는 파일 */ }
  });
  return removed;
}

// 글 하나의 소름·덤덤·댓글 수와 베스트 여부 다시 세기
function recountPost(postId) {
  const r = db.prepare(
    `SELECT COALESCE(SUM(type = 'like'), 0) AS likes, COALESCE(SUM(type = 'dislike'), 0) AS dislikes FROM reactions WHERE post_id = ?`
  ).get(postId);
  const comments = db.prepare('SELECT COUNT(*) AS n FROM comments WHERE post_id = ?').get(postId).n;
  const best = r.likes - r.dislikes >= BEST_THRESHOLD() ? 1 : 0;
  db.prepare('UPDATE posts SET like_count = ?, dislike_count = ?, comment_count = ?, is_best = ? WHERE id = ?')
    .run(r.likes, r.dislikes, comments, best, postId);
}

// 영화 하나의 점수 합계 다시 세기
function recountMovie(movieId) {
  const a = db.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(score), 0) AS s FROM movie_ratings WHERE movie_id = ?').get(movieId);
  db.prepare('UPDATE movies SET rating_count = ?, rating_sum = ? WHERE id = ?').run(a.c, a.s, movieId);
}

// 주기 정리
function sweep() {
  const now = Date.now();
  const result = {};
  result.sessions = db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date(now).toISOString()).changes;
  // 처리(또는 기각)된 지 1년 지난 신고 기록
  result.reports = db.prepare("DELETE FROM reports WHERE status != 'open' AND handled_at < ?")
    .run(new Date(now - 365 * 86400 * 1000).toISOString()).changes;
  // 마지막 수정 후 90일 지난 임시 저장 글 (처리방침에 적은 보관 기간) + 그 글에만 쓰인 사진
  const draftCutoff = new Date(now - DRAFT_DAYS * 86400 * 1000).toISOString();
  const oldDrafts = db.prepare('SELECT content FROM drafts WHERE updated_at < ?').all(draftCutoff);
  result.drafts = db.prepare('DELETE FROM drafts WHERE updated_at < ?').run(draftCutoff).changes;
  removeImagesIfUnused(oldDrafts.flatMap((d) => imagesIn(d.content)));
  // 올렸지만 7일 넘게 어떤 글에도 쓰이지 않은 사진 (글쓰기 도중 올리고 발행하지 않은 경우 등)
  result.images = 0;
  try {
    fs.readdirSync(UPLOAD_DIR).filter((f) => /^[0-9a-f-]{36}\.(jpg|png)$/.test(f)).forEach((f) => {
      const age = now - fs.statSync(path.join(UPLOAD_DIR, f)).mtimeMs;
      if (age > 7 * 86400 * 1000) result.images += removeImagesIfUnused([f]);
    });
  } catch (e) { /* uploads 폴더가 없으면 건너뜀 */ }
  return result;
}

function startScheduledCleanup() {
  const run = () => { try { sweep(); } catch (e) { console.error('정리 작업 실패:', e.message); } };
  run();
  const timer = setInterval(run, 60 * 60 * 1000);
  timer.unref();
}

module.exports = { imagesIn, removeImagesIfUnused, recountPost, recountMovie, sweep, startScheduledCleanup };
