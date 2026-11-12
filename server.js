// 무서운 게 딱좋아! — Express 서버
// 지금은 public 폴더의 화면을 그대로 보여 줍니다.
// 다음 단계에서 아래 "API" 자리에 SQLite와 연결된 라우트를 붙이면 됩니다.

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- API (다음 단계) ----------
// 서버가 살아 있는지 확인용
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// 예시: 앞으로 만들 라우트
// app.get('/api/posts', ...)              괴담 목록 (탭, 정렬)
// app.get('/api/posts/:id', ...)          괴담 상세
// app.post('/api/posts', ...)             괴담 작성 (로그인 필요)
// app.post('/api/posts/:id/reactions', ...) 소름 / 덤덤
// app.post('/api/posts/:id/comments', ...)  댓글
// app.get('/api/movies', ...)             영화 순위
// app.post('/api/movies/:id/ratings', ...)  무서움 점수 투표

app.listen(PORT, () => {
  console.log(`무서운 게 딱좋아! 서버 실행 중: http://localhost:${PORT}`);
});
