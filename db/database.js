// 심야 archive — SQLite 연결
// Node.js에 들어 있는 node:sqlite를 씁니다 (별도 설치·빌드 필요 없음).
// 실행하면 "SQLite is an experimental feature" 경고가 한 줄 나오는데, 동작에는 문제없습니다.

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

// DB 파일 위치. data 폴더는 깃허브에 올라가지 않도록 data/.gitignore 로 막아 두었습니다.
const db = new DatabaseSync(process.env.DB_PATH || path.join(dataDir, 'horror.db'));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS posts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category    TEXT    NOT NULL,                 -- intl, real, novel, legend, film
    title       TEXT    NOT NULL,
    content     TEXT    NOT NULL,                 -- 정리(sanitize)된 본문 HTML, 연출 data-fx 포함
    excerpt     TEXT    NOT NULL DEFAULT '',      -- 목록에 보여 줄 요약 (본문에서 자동 생성)
    author      TEXT    NOT NULL DEFAULT '익명',  -- 로그인 기능 전까지 임시 닉네임
    source_url  TEXT,                             -- 해외 번역 글의 원문 주소
    warnings    TEXT    NOT NULL DEFAULT '[]',    -- JSON 배열: ["faint", "jumpscare"]
    tags        TEXT    NOT NULL DEFAULT '[]',    -- JSON 배열: ["#새벽3시"]
    effects     TEXT    NOT NULL DEFAULT '[]',    -- JSON 배열: [{ "type": "knock", "tier": "free" }] (통계용)
    views       INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_posts_category ON posts (category, created_at);

  -- 회원
  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    email          TEXT    NOT NULL UNIQUE,      -- 소문자로 저장
    nickname       TEXT    NOT NULL UNIQUE,
    password_hash  TEXT    NOT NULL,             -- (예전 방식) Firebase 로그인 회원은 '!firebase' 로 채움
    created_at     TEXT    NOT NULL
  );

  -- 로그인 유지 (세션). 쿠키에는 무작위 열쇠를, DB에는 그 열쇠를 한 번 더 바꾼 값만 저장
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT    PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT    NOT NULL,
    expires_at  TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
`);

// 예전에 만든 posts 표에 작성자 번호(user_id) 칸이 없으면 추가
// (로그인 기능 전에 쓴 글은 user_id가 비어 있어서, 관리자만 수정·삭제할 수 있습니다)
const postColumns = db.prepare('PRAGMA table_info(posts)').all().map((c) => c.name);
if (!postColumns.includes('user_id')) {
  db.exec('ALTER TABLE posts ADD COLUMN user_id INTEGER REFERENCES users(id)');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_posts_user ON posts (user_id)');

// Firebase 로그인용 칸 추가: Firebase 회원 번호, 이메일 인증 여부
const userColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userColumns.includes('firebase_uid')) db.exec('ALTER TABLE users ADD COLUMN firebase_uid TEXT');
if (!userColumns.includes('email_verified')) db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase ON users (firebase_uid)');

// Firebase로 바꾸기 전에 만든 계정의 비밀번호 해시는 더 이상 쓰지 않으므로 지움
// (처리방침: 사이트는 비밀번호를 보관하지 않음)
db.prepare("UPDATE users SET password_hash = '!firebase' WHERE password_hash NOT LIKE '!%'").run();

// 소름·덤덤 반응: 한 사람이 한 글에 하나만 (UNIQUE)
db.exec(`
  CREATE TABLE IF NOT EXISTS reactions (
    user_id     INTEGER NOT NULL REFERENCES users(id),
    post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    type        TEXT    NOT NULL CHECK (type IN ('like', 'dislike')),   -- like = 소름, dislike = 덤덤
    created_at  TEXT    NOT NULL,
    PRIMARY KEY (user_id, post_id)
  );
  CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions (post_id);
`);

// 글마다 소름·덤덤 수와 베스트 여부를 함께 저장 (목록을 빠르게 정렬하려고)
const postCols = db.prepare('PRAGMA table_info(posts)').all().map((c) => c.name);
if (!postCols.includes('like_count')) db.exec('ALTER TABLE posts ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0');
if (!postCols.includes('dislike_count')) db.exec('ALTER TABLE posts ADD COLUMN dislike_count INTEGER NOT NULL DEFAULT 0');
if (!postCols.includes('is_best')) db.exec('ALTER TABLE posts ADD COLUMN is_best INTEGER NOT NULL DEFAULT 0');
if (!postCols.includes('best_at')) db.exec('ALTER TABLE posts ADD COLUMN best_at TEXT');
db.exec('CREATE INDEX IF NOT EXISTS idx_posts_best ON posts (is_best, best_at)');

// 댓글
db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    content     TEXT    NOT NULL,                 -- 글자 그대로 저장 (화면에는 글자로만 표시해서 HTML이 실행되지 않음)
    anonymous   INTEGER NOT NULL DEFAULT 0,       -- 1이면 "익명의 심야 독자"로 표시
    spoiler     INTEGER NOT NULL DEFAULT 0,       -- 1이면 눌러야 보이게 가림
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id, created_at);
`);
if (!db.prepare('PRAGMA table_info(posts)').all().some((c) => c.name === 'comment_count')) {
  db.exec('ALTER TABLE posts ADD COLUMN comment_count INTEGER NOT NULL DEFAULT 0');
}

// 공포영화 (관리자가 등록) + 회원의 무서움 점수 (1~5, 한 사람이 영화마다 하나)
db.exec(`
  CREATE TABLE IF NOT EXISTS movies (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,              -- 한국어 제목
    original_title  TEXT    NOT NULL DEFAULT '',   -- 원제
    year            INTEGER,
    country         TEXT    NOT NULL DEFAULT '',
    tags            TEXT    NOT NULL DEFAULT '[]', -- JSON 배열: ["occult", "folk"]
    description     TEXT    NOT NULL DEFAULT '',
    warning         TEXT    NOT NULL DEFAULT '',   -- 예: 충격적 장면 주의
    rating_count    INTEGER NOT NULL DEFAULT 0,
    rating_sum      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
  );
  CREATE TABLE IF NOT EXISTS movie_ratings (
    user_id     INTEGER NOT NULL REFERENCES users(id),
    movie_id    INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    score       INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
    created_at  TEXT    NOT NULL,
    PRIMARY KEY (user_id, movie_id)
  );
  CREATE INDEX IF NOT EXISTS idx_movie_ratings_movie ON movie_ratings (movie_id);
`);

// 글 보여 주는 방식: normal(기본) / void(칠흑 모드: 검은 바탕에 제목·글·사진만)
if (!db.prepare('PRAGMA table_info(posts)').all().some((c) => c.name === 'display')) {
  db.exec("ALTER TABLE posts ADD COLUMN display TEXT NOT NULL DEFAULT 'normal'");
}
db.exec('CREATE INDEX IF NOT EXISTS idx_reactions_created ON reactions (created_at)');

// 신고: 한 사람이 같은 글·댓글을 한 번만 신고
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type  TEXT    NOT NULL CHECK (target_type IN ('post', 'comment')),
    target_id    INTEGER NOT NULL,
    reporter_id  INTEGER NOT NULL REFERENCES users(id),
    reason       TEXT    NOT NULL,     -- gore, defamation, privacy, copyright, spam, other
    detail       TEXT    NOT NULL DEFAULT '',
    status       TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
    created_at   TEXT    NOT NULL,
    handled_at   TEXT,
    handled_by   INTEGER REFERENCES users(id),
    UNIQUE (target_type, target_id, reporter_id)
  );
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at);
`);

// 만료된 로그인 정리
db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());

module.exports = db;
