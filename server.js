// 무서운 게 딱좋아! — Express 서버
// 지금은 public 폴더의 화면을 그대로 보여 줍니다.
// 다음 단계에서 아래 "API" 자리에 SQLite와 연결된 라우트를 붙이면 됩니다.

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 로그인: 모든 요청에서 지금 로그인한 사람을 확인하고, API는 다른 사이트에서 온 쓰기 요청을 거절
const auth = require('./lib/auth');
app.set('trust proxy', 1);   // 배포 서버 앞단(프록시)을 거쳐도 접속자 IP를 바르게 읽도록
app.use(auth.loadUser);
app.use('/api', auth.sameOriginOnly);

// 사진 올리기는 큰 요청을 받으므로 일반 JSON 처리보다 먼저 연결 (routes/uploads.js)
app.use('/api/uploads', require('./routes/uploads'));

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- API (다음 단계) ----------
// 서버가 살아 있는지 확인용
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// 회원가입·로그인 (routes/auth.js)
app.use('/api/auth', require('./routes/auth'));

// 괴담 글 쓰기·보기·수정·삭제 (routes/posts.js)
app.use('/api/posts', require('./routes/posts'));

// 직접 넣은 효과음 목록: public/sounds 폴더의 소리 파일을 찾아 알려 줌
// 이름·등급·설명은 public/sounds/sounds.json 에 적으면 반영되고, 없으면 파일 이름을 씀
app.get('/api/sounds', (req, res) => {
  const dir = path.join(__dirname, 'public', 'sounds');
  let meta = [];
  try {
    meta = JSON.parse(fs.readFileSync(path.join(dir, 'sounds.json'), 'utf8')).sounds || [];
  } catch (err) { /* sounds.json 이 없거나 형식이 틀리면 파일 이름만으로 표시 */ }
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /\.(mp3|ogg|wav|m4a)$/i.test(f));
  } catch (err) { /* sounds 폴더가 없으면 빈 목록 */ }
  const sounds = files.map((file, i) => {
    const m = meta.find((x) => x.file === file) || {};
    const base = file.replace(/\.[^.]+$/, '');
    // 연출 이름은 영문·숫자만 씀. 한글 파일 이름처럼 남는 글자가 없으면 순번으로 대신함
    let slug = String(m.id || base).replace(/[^a-z0-9_-]/gi, '-').toLowerCase().replace(/^-+|-+$/g, '');
    if (!slug) slug = 'sound-' + (i + 1);
    return {
      id: 'snd-' + slug,
      name: m.name || '효과음 · ' + base,
      tier: m.tier === 'free' ? 'free' : 'paid',
      desc: m.desc || '직접 추가한 효과음',
      file: 'sounds/' + encodeURIComponent(file),
      volume: typeof m.volume === 'number' ? m.volume : 0.8
    };
  });
  res.json({ sounds });
});

// 예시: 앞으로 만들 라우트
// (완료) /api/posts                      괴담 목록·보기·쓰기·수정·삭제 → routes/posts.js
// app.post('/api/posts/:id/reactions', ...) 소름 / 덤덤
// app.post('/api/posts/:id/comments', ...)  댓글
// app.get('/api/movies', ...)             영화 순위
// app.post('/api/movies/:id/ratings', ...)  무서움 점수 투표

app.listen(PORT, () => {
  console.log(`무서운 게 딱좋아! 서버 실행 중: http://localhost:${PORT}`);
});
