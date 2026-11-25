# 심야 archive — 프로젝트 안내 (Claude Code가 매번 먼저 읽는 파일)

공포 이야기 커뮤니티 사이트. 회원이 괴담을 쓰고 연출(점프스케어, 효과음 등)을 넣고, 소름·댓글로 베스트를 뽑고, 공포영화 무서움 점수 순위를 본다.
운영자는 개발 초보라서, 설명은 한국어로 쉽게, 바꾼 내용은 "무엇을 왜" 짧게 정리해서 알려 줄 것.

## 기술 구성
- 서버: Node.js 22 + Express (`server.js`, `routes/`, `lib/`)
- DB: SQLite 파일 하나 (`node:sqlite`, 설계는 `db/database.js`)
- 로그인: Firebase Authentication (로그인만. 글·회원 정보는 우리 DB)
- 화면: 순수 HTML/CSS/JS (`public/`), 프레임워크 없음
- 배포: Render (`render.yaml`), GitHub에 push하면 자동 배포

## 폴더 지도
- `routes/` API: posts(글·소름·검색), comments, movies, reports, users(프로필), auth(로그인·탈퇴), uploads(사진), stats, admin(백업)
- `lib/` 보안·공통: auth.js(세션·권한), sanitize.js(본문 HTML 정리), firebase.js, cleanup.js(정리 작업), paths.js
- `public/js/` 화면 동작: app.js(공통·에디터), posts.js, comments.js, movies.js, effects.js(연출 엔진), auth.js, firebase-auth.js, profile.js, report.js, admin.js
- `scripts/` 시드 데이터 (seed-movies.js, seed-posts.js)

## 명령어
- 실행: `npm start` → http://localhost:3000
- 파일 점검: `node check-files.js`

## 꼭 지킬 규칙
1. `.env`, `data/` 폴더, `public/uploads/`, DB 백업 파일은 읽거나 출력하지 말 것 (비밀 값과 이용자 개인정보).
2. `git push`, 배포, Render 관련 작업은 하지 말 것. push는 운영자가 직접 한다 (push = 즉시 배포).
3. 새 npm 라이브러리를 설치하기 전에 이유와 함께 먼저 물어볼 것.
4. 보안 코드를 약하게 만들지 말 것. 아래를 바꿨다면 왜 바꿨는지 반드시 설명할 것:
   - `lib/auth.js`, `lib/sanitize.js`
   - `requireAuth`, `requireVerified`, `requireAdmin`, `canEdit`, `sameOriginOnly` 가 들어간 코드
5. DB 표를 바꿀 때는 `db/database.js`에 "칸이 없으면 추가" 방식(PRAGMA table_info 확인 후 ALTER TABLE)으로 넣어서, 이미 있는 DB의 데이터가 지워지지 않게 할 것.
6. 새 연출을 추가하면 `lib/sanitize.js`의 `BUILTIN_FX`에도 이름을 넣을 것 (안 넣으면 저장할 때 지워짐).
7. 이용자에게 보이는 글은 지금 사이트처럼 친근한 존댓말("~해요")로 쓸 것. 사용자 입력은 항상 textContent로 화면에 넣을 것 (innerHTML 금지, 단 서버에서 정리한 글 본문은 예외).
8. 수집하는 개인정보나 보관 기간이 바뀌면 `public/privacy.html`도 고쳐야 한다고 알려 줄 것.
9. 작업이 끝나면 `node check-files.js`를 실행하고, 확인 방법(어느 화면에서 무엇을 눌러 보면 되는지)을 알려 줄 것.
