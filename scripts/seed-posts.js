// 처음 시작할 때 쓰는 시드 괴담 넣기 (한 번만 실행)
//   npm run seed:posts
//
// .env 의 ADMIN_EMAILS 첫 번째 이메일로 가입하고 이메일 인증까지 마친 계정(운영자)의 창작 글로 올립니다.
// 같은 제목의 글이 이미 있으면 건너뜁니다. 사진 2장은 public/uploads 로 복사해 씁니다.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db/database');
const { validate } = require('../routes/posts');

const adminEmail = String(process.env.ADMIN_EMAILS || '').split(',')[0].trim().toLowerCase();
if (!adminEmail) {
  console.log('.env 에 ADMIN_EMAILS 가 없어요. 운영자 이메일을 적고 다시 실행해 주세요.');
  process.exit(1);
}
const admin = db.prepare('SELECT id, nickname, email_verified FROM users WHERE email = ?').get(adminEmail);
if (!admin) {
  console.log(adminEmail + ' 로 가입한 계정이 없어요. 사이트에서 먼저 가입하고 다시 실행해 주세요.');
  process.exit(1);
}
if (!admin.email_verified) {
  console.log(adminEmail + ' 계정의 이메일 인증을 먼저 마쳐 주세요.');
  process.exit(1);
}

// 사진을 올린 사진처럼 uploads 폴더에 복사
const uploads = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(uploads, { recursive: true });
function copyImage(file) {
  const name = crypto.randomUUID() + '.jpg';
  fs.copyFileSync(path.join(__dirname, '..', 'public', 'images', file), path.join(uploads, name));
  return '/uploads/' + name;
}

const POSTS = [
  {
    title: '절대 새벽 3시 33분 엘리베이터를 타지 마세요',
    category: 'novel',
    warnings: ['faint', 'claustrophobia'],
    tags: ['#엘리베이터', '#새벽3시'],
    display: 'normal',
    images: ['evidence-hall.jpg', 'evidence-fingers.jpg'],
    content: "<p><strong>이 이야기는 지어낸 창작 괴담입니다.</strong> 한 야간 근무자가 남긴 기록이라는 설정으로 썼어요. 폐소공포와 놀라는 장면이 있어요.</p><p data-fx=\"fade\">교대근무를 마치고 돌아온 19층 오피스텔 로비는 늘 그렇듯 눅눅한 소독약 냄새와 기름 쩐내로 가득 차 있었습니다. 시계는 막 새벽 3시 32분을 가리키고 있었죠. 온몸이 젖은 솜처럼 무거웠고, 그저 현관문 비밀번호를 누르고 침대에 쓰러질 생각뿐이었습니다.</p><p data-fx=\"fade\">센서등이 꺼진 복도 끝에서 낡은 은색 엘리베이터가 낮게 웅웅거렸습니다. 1호기 문 앞에는 늘 붙어 있던 종이 한 장이 비틀린 채 걸려 있었는데, 누군가 붉은 매직으로 황급히 덧칠해 둔 글귀가 눈에 띄었습니다.</p><blockquote data-fx=\"fade\"><p>[안내문에 적힌 손글씨]</p><p class=\"blood strong\">“3시 33분이 되는 순간 문이 열리면, 안에 아무도 없더라도 절대 발을 들이지 마십시오. 만약 이미 탔다면, 거울 속 당신의 목덜미를 절대 확인하지 마십시오.”</p></blockquote><p>평소라면 정신 나간 입주민의 시시한 장난이라며 콧방귀를 뀌었을 겁니다. 하지만 손목시계의 초침이 3시 33분 00초에 멎은 순간, ‘띵’ 하는 둔탁한 금속음과 함께 문이 천천히 미끄러져 열렸습니다.</p><figure class=\"evidence-photo\" data-blur=\"1\"><img src=\"{{IMG1}}\" alt=\"녹색 비상등만 켜진 19층 엘리베이터 홀\"><figcaption>▲ 문제의 19층 엘리베이터 홀. 센서등은 작동하지 않았으며 내부의 녹색 비상등만이 점멸했다.</figcaption></figure><p data-fx=\"fade\">내부는 텅 비어 있었습니다. 다만 얼음장 같은 냉기가 쏟아져 나와 땀에 젖은 이마를 훑었습니다. 뒤통수가 싸늘하게 당기는 감각을 무시한 채, 저는 서둘러 탑승 버튼을 누르고 안으로 들어갔습니다. 닫힘 버튼을 연타하는 순간, 손가락 끝이 미세하게 떨렸습니다.</p><p class=\"blood strong\" data-fx=\"blackout\">그리고 문이 닫히자마자, 내부 후면 거울에 비친 제 모습이 무언가 잘못되어 있었습니다.</p><p data-fx=\"fade\">엘리베이터 거울 속 저는 분명 등을 돌리고 서 있었습니다. 하지만 거울 안의 ‘나’는 고개를 180도 뒤로 꺾은 채, 핏기 없는 텅 빈 눈으로 이쪽을 똑바로 쳐다보고 있었습니다. 아니, 그것은 제가 아니었습니다. 거울 속 내 등 뒤에 완벽히 맞대고 서 있던 검은 형체였습니다.</p><blockquote data-fx=\"flash\"><p>[시스템 결함 경보음 기록]</p><p class=\"strong\">“엘리베이터가 멈춘 층수는 지하 4층 (B4). 하지만 이 오피스텔 건물엔 지하 2층까지만 존재했습니다.”</p><p>디지털 패널의 붉은 세그먼트 숫자는 B1, B2를 지나더니 깨진 글리치 기호들을 토해냈고, 마침내 정지한 곳은 차가운 콘크리트 흙더미 냄새가 진동하는 ‘B4’였습니다. 문이 2인치쯤 벌어진 틈새 너머로, 수십 개의 손가락들이 틈을 비집고 들어오기 시작했습니다...</p></blockquote><figure class=\"evidence-photo\" data-blur=\"1\"><img src=\"{{IMG2}}\" alt=\"엘리베이터 문 틈새로 비집고 들어오는 손가락들\"><figcaption>증언 증거: 지하 4층 틈새 강제 개방 흔적</figcaption></figure><p>손톱이 닳아 없어진 창백한 손가락들이 고무 패킹을 쥐어뜯으며 내는 소리는 칠판을 긁는 쇳소리와 같았습니다. 거울 속 형체의 입이 천천히 귀 밑까지 찢어지며 제 귓가에 낮은 숨결을 내뱉었습니다.</p><p class=\"hud-line hud-line--alert\" data-fx=\"shake\">“이제 네가 문을 열어줄 차례야.”</p><p data-fx=\"fade\">그 순간 제가 어떻게 비상정지 레버를 부러뜨리고 맨손으로 천장 환기구를 뜯어 탈출했는지는 아직도 기억나지 않습니다. 정신을 차렸을 땐 동이 튼 로비 바닥에 온몸에 긁힌 자국이 난 채 웅크리고 있었고, 출근하던 경비 아저씨가 경악하며 119를 누르고 있었습니다.</p><p>경찰 조사 결과, 그 엘리베이터의 권상기 와이어는 이미 이틀 전 새벽에 완전히 끊어져 지하 2층 완충기에 처박힌 상태였다고 합니다.</p><p data-fx=\"vanish\">그렇다면 제가 그날 밤 타고 내려간 것은... 대체 무엇이었을까요?</p><p class=\"story-end\" data-fx=\"jump\">끝.</p>"
  },
  {
    title: '감지된 사람: 2명',
    category: 'novel',
    warnings: ['faint', 'jumpscare'],
    tags: ['#AI안경', '#독서실'],
    display: 'void',
    images: ['evidence-hall.jpg'],
    content: "<p data-fx=\"fade\">독서실 마감 시간이 한참 지났는데도 나는 남아 있었다. 사장님이 열쇠를 맡기고 간 새벽 두 시, 3층 열람실에는 나 혼자였다.</p><p data-fx=\"fade\">책상 위에는 선배에게 산 기출 시험지 한 묶음, 그리고 중고 거래로 싸게 구한 AI 안경이 있었다. 렌즈 너머로 보이는 걸 읽어 주고, 물어보면 답까지 알려 주는 안경이었다.</p><p data-fx=\"fade\">반칙인 건 알았다. 그래도 내일 시험만 넘기면 됐다.</p><p class=\"hud-line\" data-fx=\"type\">렌즈 · 문서를 인식했습니다. 1번 문제의 정답은 ③입니다.</p><p data-fx=\"fade\">안경은 정말 빨랐다. 나는 들리는 대로 받아 적기만 하면 됐다. 2번, 3번, 4번……</p><p data-fx=\"fade\">마지막 장을 넘겼을 때, 문제 아래 여백에 아주 연한 회색 글씨가 있었다. 눈을 바짝 대야 겨우 보일 만큼 작은 글씨였다.</p><p class=\"hud-line\" data-fx=\"type\">렌즈 · 여백의 문장을 읽었습니다. “이 안경의 전 주인을 찾고 있습니다. 그는 아직 안경을 돌려받지 못했습니다.”</p><p data-fx=\"fade\">선배가 장난으로 써 둔 낙서겠지. 그렇게 생각하고 시험지를 덮으려는데, 안경이 묻지도 않은 말을 했다.</p><p class=\"hud-line\" data-fx=\"type\">렌즈 · 주변에 사람 1명이 감지되었습니다. 방향: 뒤쪽. 거리: 2미터.</p><p data-fx=\"fade\">열람실에는 나밖에 없었다. 나는 뒤를 돌아보는 대신, 안경에게 지금 보이는 화면을 저장하라고 했다.</p><figure class=\"evidence-photo\"><img src=\"{{IMG1}}\" alt=\"비상등만 켜진 텅 빈 복도\"><figcaption>렌즈가 저장한 화면 · LENS REC 03:12:44 — 아무도 없는 복도 끝에 빨간 네모와 “사람 · 97%”라는 글자가 떠 있었다.</figcaption></figure><p data-fx=\"fade\">사진 속 복도는 비어 있었다. 그런데 안경은 그 빈자리에 빨간 네모를 그려 놓고, 사람이라고 했다.</p><p class=\"sfx-line\" data-fx=\"knock\">똑. 똑. 똑.</p><p data-fx=\"fade\">열람실 문을 두드리는 소리였다. 문 앞 센서등은 꺼져 있었다.</p><p data-fx=\"blackout\">그리고 열람실의 불이 한꺼번에 꺼졌다.</p><p class=\"hud-line hud-line--alert\" data-fx=\"type\">렌즈 · 거리: 1미터. 안경을 벗지 마세요.</p><p class=\"hud-line hud-line--alert\" data-fx=\"shake\">렌즈 · 안경을 벗으면 그가 보이지 않게 됩니다. 그러면 그는 더 가까이 올 수 있습니다.</p><p data-fx=\"fade\">나는 떨리는 손으로 안경을 벗었다. 칠흑 같은 어둠뿐이었다. 아무것도, 아무도 보이지 않았다.</p><p data-fx=\"vanish\">정말로, 아무도 없었다.</p><p data-fx=\"fade\">책상 위에 내려놓은 안경 렌즈에서 희미한 빛이 새어 나왔다. 렌즈 안쪽에 마지막 문장이 떠 있었다.</p><p class=\"hud-line hud-line--alert\" data-fx=\"type\">렌즈 · 감지된 사람: 2명. 거리: 0미터.</p><p class=\"hud-line hud-line--alert\" data-fx=\"jump\">렌즈 · 새 주인을 등록했습니다.</p>"
  }
];

let added = 0;
POSTS.forEach((p, i) => {
  if (db.prepare('SELECT 1 FROM posts WHERE title = ?').get(p.title)) {
    console.log('이미 있어서 건너뜀: ' + p.title);
    return;
  }
  let content = p.content;
  p.images.forEach((file, k) => { content = content.split('{{IMG' + (k + 1) + '}}').join(copyImage(file)); });
  const { error, value: v } = validate({ ...p, content });
  if (error) { console.log('넣지 못함 (' + p.title + '): ' + error); return; }
  const at = new Date(Date.now() - (POSTS.length - i) * 60000).toISOString();
  db.prepare(
    `INSERT INTO posts (category, title, content, excerpt, author, user_id, source_url, warnings, tags, effects, display, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`
  ).run(v.category, v.title, v.content, v.excerpt, admin.nickname, admin.id, v.warnings, v.tags, v.effects, v.display, at, at);
  added += 1;
  console.log('넣음: ' + p.title);
});
console.log(added ? `시드 괴담 ${added}편을 ${admin.nickname} 이름으로 올렸어요.` : '새로 넣은 글이 없어요.');
