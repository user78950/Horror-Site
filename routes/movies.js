// 공포영화 순위 API
//
//   GET    /api/movies?tag=occult&limit=5    순위 목록 (누구나)
//   POST   /api/movies                       영화 등록 (관리자)
//   PUT    /api/movies/:id                   영화 수정 (관리자)
//   DELETE /api/movies/:id                   영화 삭제 (관리자)
//   POST   /api/movies/:id/rating            무서움 점수 { score: 1~5 | null } (이메일 인증 회원)
//
// 순위 계산: 투표가 1~2개뿐인 영화가 5.0점으로 1등이 되지 않도록 "보정 평균"을 씁니다.
//   보정 평균 = (점수 합 + 기준표 수 × 전체 평균) ÷ (투표 수 + 기준표 수)
//   투표가 적으면 전체 평균 쪽으로 당겨지고, 투표가 많아질수록 그 영화의 실제 평균에 가까워집니다.

const express = require('express');
const db = require('../db/database');
const { requireAdmin, requireVerified } = require('../lib/auth');

const router = express.Router();

const TAGS = { occult: '오컬트·퇴마', found: '페이크 다큐·파운드 푸티지', psych: '심리 스릴러', korean: '한국 공포', folk: '민속·의식', classic: '역대 명작' };
const PRIOR_VOTES = 3;   // 기준표 수

const parse = (t, f) => { try { return JSON.parse(t); } catch (e) { return f; } };
const idOf = (raw) => (/^\d+$/.test(String(raw)) ? Number(raw) : null);

function globalAverage() {
  const g = db.prepare('SELECT SUM(rating_sum) AS s, SUM(rating_count) AS c FROM movies').get();
  return g.c ? g.s / g.c : 3;
}

function toMovie(row, C, myScore) {
  const avg = row.rating_count ? row.rating_sum / row.rating_count : null;
  return {
    id: row.id,
    title: row.title,
    originalTitle: row.original_title,
    year: row.year,
    country: row.country,
    tags: parse(row.tags, []),
    description: row.description,
    warning: row.warning,
    votes: row.rating_count,
    average: avg === null ? null : Math.round(avg * 10) / 10,
    rankScore: (row.rating_sum + PRIOR_VOTES * C) / (row.rating_count + PRIOR_VOTES),
    myScore: myScore || null
  };
}

function validate(body) {
  const title = String(body.title || '').trim();
  if (!title || title.length > 60) return { error: '제목을 1~60자로 입력해 주세요.' };
  const year = body.year === '' || body.year == null ? null : Number(body.year);
  if (year !== null && (!Number.isInteger(year) || year < 1890 || year > 2100)) return { error: '개봉 연도를 확인해 주세요.' };
  const tags = (Array.isArray(body.tags) ? body.tags : []).filter((t) => TAGS[t]);
  return {
    value: {
      title,
      originalTitle: String(body.originalTitle || '').trim().slice(0, 80),
      year,
      country: String(body.country || '').trim().slice(0, 40),
      tags: JSON.stringify([...new Set(tags)]),
      description: String(body.description || '').trim().slice(0, 300),
      warning: String(body.warning || '').trim().slice(0, 40)
    }
  };
}

// 순위 목록
router.get('/', (req, res) => {
  const C = globalAverage();
  let rows = db.prepare('SELECT * FROM movies').all();
  if (TAGS[req.query.tag]) rows = rows.filter((r) => parse(r.tags, []).includes(req.query.tag));

  const mine = {};
  if (req.user) {
    db.prepare('SELECT movie_id, score FROM movie_ratings WHERE user_id = ?').all(req.user.id)
      .forEach((r) => { mine[r.movie_id] = r.score; });
  }

  const movies = rows.map((r) => toMovie(r, C, mine[r.id]))
    // 평가가 있는 영화를 먼저, 그 안에서는 보정 평균 → 투표 수 순
    .sort((a, b) => (b.votes > 0) - (a.votes > 0) || b.rankScore - a.rankScore || b.votes - a.votes || a.title.localeCompare(b.title, 'ko'));
  movies.forEach((m, i) => { m.rank = m.votes > 0 ? i + 1 : null; });

  const limit = Math.min(100, parseInt(req.query.limit, 10) || 100);
  const totalVotes = db.prepare('SELECT COUNT(*) AS n FROM movie_ratings').get().n;
  res.json({ movies: movies.slice(0, limit), totalVotes, tags: TAGS, priorVotes: PRIOR_VOTES });
});

// 등록·수정·삭제 (관리자)
router.post('/', requireAdmin, (req, res) => {
  const { error, value: v } = validate(req.body || {});
  if (error) return res.status(400).json({ error });
  const now = new Date().toISOString();
  const r = db.prepare(
    `INSERT INTO movies (title, original_title, year, country, tags, description, warning, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(v.title, v.originalTitle, v.year, v.country, v.tags, v.description, v.warning, now, now);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

router.put('/:id', requireAdmin, (req, res) => {
  const id = idOf(req.params.id);
  const { error, value: v } = validate(req.body || {});
  if (error) return res.status(400).json({ error });
  const r = db.prepare(
    `UPDATE movies SET title = ?, original_title = ?, year = ?, country = ?, tags = ?, description = ?, warning = ?, updated_at = ?
      WHERE id = ?`
  ).run(v.title, v.originalTitle, v.year, v.country, v.tags, v.description, v.warning, new Date().toISOString(), id);
  if (!r.changes) return res.status(404).json({ error: '영화를 찾을 수 없어요.' });
  res.json({ id });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const id = idOf(req.params.id);
  db.prepare('DELETE FROM movie_ratings WHERE movie_id = ?').run(id);
  const r = db.prepare('DELETE FROM movies WHERE id = ?').run(id);
  if (!r.changes) return res.status(404).json({ error: '이미 삭제된 영화예요.' });
  res.json({ ok: true });
});

// 무서움 점수 매기기 / 바꾸기 / 취소
router.post('/:id/rating', requireVerified, (req, res) => {
  const id = idOf(req.params.id);
  const score = req.body && req.body.score === null ? null : Number(req.body && req.body.score);
  if (score !== null && !(Number.isInteger(score) && score >= 1 && score <= 5)) {
    return res.status(400).json({ error: '무서움 점수는 1~5 사이로 골라 주세요.' });
  }
  if (!id || !db.prepare('SELECT 1 FROM movies WHERE id = ?').get(id)) return res.status(404).json({ error: '영화를 찾을 수 없어요.' });

  db.exec('BEGIN');
  try {
    if (score === null) {
      db.prepare('DELETE FROM movie_ratings WHERE user_id = ? AND movie_id = ?').run(req.user.id, id);
    } else {
      db.prepare(
        `INSERT INTO movie_ratings (user_id, movie_id, score, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, movie_id) DO UPDATE SET score = excluded.score`
      ).run(req.user.id, id, score, new Date().toISOString());
    }
    const agg = db.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(score), 0) AS s FROM movie_ratings WHERE movie_id = ?').get(id);
    db.prepare('UPDATE movies SET rating_count = ?, rating_sum = ? WHERE id = ?').run(agg.c, agg.s, id);
    db.exec('COMMIT');
    res.json({ votes: agg.c, average: agg.c ? Math.round((agg.s / agg.c) * 10) / 10 : null, myScore: score });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: '점수를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
});

module.exports = router;
