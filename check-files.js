// 무서운 게 딱좋아! — 프로젝트 파일 점검
// 사용법: 이 파일을 package.json 이 있는 폴더에 넣고, 터미널에서  node check-files.js
// 있어야 할 파일이 빠졌는지, 중요한 파일이 예전 버전으로 남아 있지 않은지 알려 줍니다.

const fs = require('fs');
const path = require('path');

const REQUIRED = [
  '.env.example', 'README.md', 'package.json', 'package-lock.json', 'server.js',
  'data/.gitignore',
  'db/database.js',
  'lib/auth.js', 'lib/firebase.js', 'lib/sanitize.js',
  'routes/auth.js', 'routes/posts.js', 'routes/uploads.js', 'routes/comments.js', 'routes/movies.js', 'scripts/seed-movies.js',
  'public/index.html', 'public/post.html', 'public/write.html', 'public/login.html', 'public/signup.html',
  'public/story.html', 'public/story-glasses.html', 'public/movies.html', 'public/guidelines.html',
  'public/css/style.css',
  'public/js/app.js', 'public/js/auth.js', 'public/js/effects.js', 'public/js/firebase-auth.js', 'public/js/posts.js', 'public/js/comments.js', 'public/js/movies.js',
  'public/images/evidence-fingers.jpg', 'public/images/evidence-hall.jpg', 'public/images/hero-elevator.jpg',
  'public/images/post-doll.jpg', 'public/images/post-letter.jpg', 'public/images/post-phone.jpg', 'public/images/post-talisman.jpg',
  'public/sounds/sounds.json', 'public/sounds/sample-bell.wav',
  'public/uploads/.gitignore'
];

// 파일이 있어도 예전 버전이면 안 되는 것들: [파일, 들어 있어야 할 글자, 설명]
const CONTENT_CHECKS = [
  ['package.json', '--env-file-if-exists=.env', 'npm start 가 .env 를 읽도록 되어 있어야 해요'],
  ['package.json', 'firebase-admin', 'firebase-admin 이 들어 있어야 해요'],
  ['server.js', "app.use('/api/auth'", '로그인 API 가 연결되어 있어야 해요'],
  ['server.js', "app.use('/api/posts'", '글 API 가 연결되어 있어야 해요'],
  ['server.js', "app.use('/api/uploads'", '사진 올리기 API 가 연결되어 있어야 해요'],
  ['routes/auth.js', "router.get('/config'", 'Firebase 설정값 주소(/api/auth/config)가 있어야 해요'],
  ['routes/auth.js', "router.post('/firebase'", 'Firebase 로그인 연결 주소가 있어야 해요'],
  ['public/login.html', 'firebase-auth.js', '로그인 화면이 Firebase 모듈을 불러와야 해요'],
  ['public/write.html', 'tool-photo', '글쓰기 툴바(증거 사진 등)가 최신이어야 해요'],
  ['public/write.html', 'js/effects.js', '글쓰기 화면이 연출 엔진을 불러와야 해요'],
  ['public/js/app.js', 'tool-line', 'app.js 가 최신 툴바 코드여야 해요'],
  ['routes/posts.js', "router.post('/:id/reaction'", '소름·덤덤 API 가 있어야 해요'],
  ['public/post.html', 'react-like', '글 보기 화면에 소름 버튼이 있어야 해요'],
  ['public/post.html', 'cm-form', '글 보기 화면에 댓글 영역이 있어야 해요'],
  ['server.js', "app.use('/api/comments'", '댓글 API 가 연결되어 있어야 해요'],
  ['server.js', "app.use('/api/movies'", '영화 API 가 연결되어 있어야 해요'],
  ['public/movies.html', 'js/movies.js', '영화 페이지가 새 버전이어야 해요']
];

const root = process.cwd();
let problems = 0;

console.log('\n점검하는 폴더: ' + root + '\n');

const missing = REQUIRED.filter((f) => !fs.existsSync(path.join(root, f)));
if (missing.length) {
  problems += missing.length;
  console.log('✗ 빠진 파일 ' + missing.length + '개:');
  missing.forEach((f) => console.log('    ' + f));
} else {
  console.log('✓ 있어야 할 파일 ' + REQUIRED.length + '개가 모두 있어요.');
}

const stale = CONTENT_CHECKS.filter(([f, text]) => {
  const p = path.join(root, f);
  return fs.existsSync(p) && !fs.readFileSync(p, 'utf8').includes(text);
});
if (stale.length) {
  problems += stale.length;
  console.log('\n✗ 예전 버전으로 보이는 파일:');
  stale.forEach(([f, , why]) => console.log('    ' + f + ' — ' + why));
} else {
  console.log('✓ 중요한 파일들이 최신 버전이에요.');
}

// 내 컴퓨터에만 있어야 하는 것들
const env = path.join(root, '.env');
if (!fs.existsSync(env)) {
  console.log('\n! .env 파일이 없어요. .env.example 을 복사해 .env 를 만들고 Firebase 값을 넣어 주세요.');
} else {
  const txt = fs.readFileSync(env, 'utf8');
  const need = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_APP_ID'];
  const empty = need.filter((k) => !new RegExp('^' + k + '=\\S+', 'm').test(txt));
  if (empty.length) console.log('\n! .env 에 값이 비었거나 형식이 틀린 항목: ' + empty.join(', ') + '  (형식: 이름=값, 띄어쓰기·따옴표·쉼표 없이)');
  else console.log('✓ .env 에 Firebase 값 4개가 들어 있어요.');
}
const gi = path.join(root, '.gitignore');
if (!fs.existsSync(gi) || !/^\.env\s*$/m.test(fs.readFileSync(gi, 'utf8'))) {
  console.log('! 맨 위 .gitignore 에 .env 줄이 없어요. 추가해 주세요.');
}
if (!fs.existsSync(path.join(root, 'node_modules', 'firebase-admin'))) {
  console.log('! 라이브러리가 설치되지 않았어요. npm install 을 실행해 주세요.');
}

console.log(problems ? '\n위의 ✗ 항목을 zip 의 같은 파일로 덮어쓰면 돼요.\n' : '\n모두 정상이에요.\n');
