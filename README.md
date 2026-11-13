# 무서운 게 딱좋아! — MVP 프론트엔드

공포 매니아를 위한 괴담·공포영화 커뮤니티의 화면 4개를 실제 개발용 파일로 정리한 프로젝트입니다.
기술 스택은 프로젝트 컨텍스트와 같습니다: Static HTML · Pure CSS · Vanilla JS · Node/Express (다음 단계에서 SQLite).

## 실행 방법

```bash
npm install
npm start
```

브라우저에서 http://localhost:3000 을 열면 메인 홈 피드가 나옵니다.
서버 없이 `public/index.html`을 바로 열어도 화면은 모두 보입니다.

## 폴더 구조

```
horror-site/
├── server.js          Express 서버 (public 폴더 제공 + API 자리)
├── package.json
└── public/
    ├── index.html     메인 홈 피드
    ├── story.html     괴담 상세 뷰어
    ├── write.html     괴담 작성 에디터
    ├── movies.html    공포영화 랭킹 & 투표
    ├── css/style.css  공통 디자인 (색·글꼴 토큰, 헤더, 버튼, 카드, 페이지별 스타일)
    ├── js/app.js      공통 동작 (탭, 소름 버튼, 독서 모드, 에디터, 투표 등)
    ├── js/effects.js  연출 엔진 (점프스케어, 효과음, 글자 흔들림 등)
    └── images/        화면에 쓰인 사진
```

## 화면에서 동작하는 것

| 페이지 | 동작 |
|---|---|
| 공통 | 헤더 메뉴로 페이지 이동, 탭/정렬 선택, 소름 버튼 +1, 스크랩 |
| index.html | `?tab=hof` 같은 주소로 탭 선택, 실시간 심야 톡 입력 |
| story.html | 불 끄기 집중 모드, 글자 크기 14~22px, 증거 사진 블러 해제, 앰비언스 버튼, 번역가 구독, 링크 복사, 한국 시간 시계, 댓글 남기기 |
| write.html | 카테고리 선택, 트리거 경고 체크, 제목·본문 글자 수와 예상 완독 시간, 굵게/기울임/구분선, 선택 글자 블러 가림, 태그 추가·삭제(최대 5개), 썸네일 선택, 발행 시 입력값 모으기 |
| movies.html | 장르 탭, 영화별 소름 투표, 긴급 투표 결과 공개, 공포 타입·감당 정도로 오늘 밤 영화 추천 |

## 연출 기능 (수익 모델)

본문 문단에 `data-fx` 속성을 붙이면, 독자가 그 문단까지 스크롤했을 때 연출이 한 번 재생됩니다.

```html
<p data-fx="knock">똑. 똑. 똑.</p>
```

| 연출 | data-fx | 등급 |
|---|---|---|
| 서서히 나타나기 | `fade` | 무료 |
| 정적 (검은 화면 + 낮은 울림) | `blackout` | 무료 |
| 효과음 · 노크 | `knock` | 무료 |
| 글자 흔들림 | `shake` | 유료 |
| 사라지는 문장 | `vanish` | 유료 |
| 효과음 · 비명 | `scream` | 유료 |
| 화면 깜빡임 | `flash` | 유료 |
| 점프스케어 | `jump` | 유료 |

- **작가:** write.html에서 문단을 클릭하고 "연출 넣기"를 누르면 연출을 붙이고 바로 미리볼 수 있습니다.
- **독자:** story.html에서 "소리 켜고 읽기"를 누르면 효과음까지 재생됩니다. "연출 켜짐" 버튼으로 언제든 끌 수 있고, 기기의 '동작 줄이기' 설정을 켜 둔 독자에게는 움직임과 깜빡임을 건너뜁니다.
- **효과음:** 모두 Web Audio로 코드에서 합성하므로 음원 파일과 저작권 문제가 없습니다.
- **유료 잠금:** `effects.js`의 `SETTINGS.paidUnlocked`가 지금은 `true`(베타 기간 전부 무료)입니다. 결제를 붙이면 서버에서 받은 구매 여부로 바꾸세요.
- **점프스케어 이미지:** `SETTINGS.jumpImage`는 임시로 시안 사진을 씁니다. 직접 만들었거나 상업적 이용이 허락된 이미지로 꼭 바꾸세요.
- **백엔드 저장 시 주의:** 본문 HTML의 위험한 태그를 지우는(sanitize) 처리를 할 때 `data-fx`, `data-fx-tier`, `data-fx-label` 속성은 허용하고, `data-fx` 값은 위 표의 이름만 통과시키세요.

지금은 모든 데이터가 HTML에 직접 적혀 있고, 버튼을 눌러도 새로고침하면 초기화됩니다.
서버에 저장해야 하는 곳에는 `app.js` 안에 `TODO(백엔드 연결)` 주석을 달아 두었습니다.

## 다음 단계 (백엔드 연결)

`server.js`에 주석으로 적어 둔 라우트를 SQLite와 연결하면 됩니다.

| 기능 | API | 프로젝트 컨텍스트의 테이블 |
|---|---|---|
| 괴담 목록 (탭, 정렬) | `GET /api/posts` | posts |
| 괴담 상세 | `GET /api/posts/:id` | posts |
| 괴담 작성 | `POST /api/posts` | posts |
| 소름 / 덤덤 | `POST /api/posts/:id/reactions` | reactions |
| 댓글 | `POST /api/posts/:id/comments` | comments |
| 스크랩 | `POST /api/posts/:id/scraps` | scraps |
| 영화 순위 | `GET /api/movies` | movies, movie_ratings |
| 무서움 점수 투표 | `POST /api/movies/:id/ratings` | movie_ratings |
| 회원가입 / 로그인 | `POST /api/auth/signup`, `/login` | users |

## 알아 둘 점

- **글꼴:** Google Fonts(Space Grotesk, Be Vietnam Pro, JetBrains Mono, Noto Sans KR)를 불러옵니다. 영문 글꼴에는 한글이 없어서 한글은 Noto Sans KR로 표시됩니다.
- **영화 포스터:** 실제 포스터 대신 제목만 적힌 빈 자리입니다. 포스터를 쓰려면 배급사나 공식 이미지 API(예: TMDB)의 이용 조건을 확인한 뒤 넣으세요.
- **사진:** `images/`의 사진은 Stitch 시안 스크린샷에서 잘라낸 것이라 해상도가 낮습니다. 원본 이미지로 교체하는 것을 권합니다.
- **수치:** 접속자 수, 소름 수, 조회 수 등은 모두 시안의 예시값입니다.
