// 처음 시작할 때 쓰는 공포영화 목록 넣기 (한 번만 실행)
//   npm run seed:movies
// 영화가 이미 하나라도 있으면 아무것도 하지 않습니다. 점수는 모두 0에서 시작합니다.
// 포스터는 저작권 때문에 넣지 않습니다. 소개 문구는 직접 쓴 짧은 설명입니다.

const db = require('../db/database');

const MOVIES = [
  { title: '유전', originalTitle: 'Hereditary', year: 2018, country: '미국', tags: ['occult', 'psych'], description: '할머니의 장례식 이후, 한 가족에게 대물림된 비밀이 서서히 모습을 드러낸다.', warning: '' },
  { title: '곡성', originalTitle: 'The Wailing', year: 2016, country: '한국', tags: ['korean', 'occult', 'folk'], description: '외지인이 나타난 뒤 시골 마을에 의문의 사건이 이어지고, 누구를 믿어야 할지 알 수 없게 된다.', warning: '' },
  { title: '랑종', originalTitle: 'The Medium', year: 2021, country: '태국·한국', tags: ['found', 'folk', 'occult'], description: '무당 가문을 따라간 다큐멘터리 촬영이 점점 통제할 수 없는 방향으로 흘러간다.', warning: '' },
  { title: '주', originalTitle: 'Incantation', year: 2022, country: '대만', tags: ['found', 'occult', 'folk'], description: '금기를 어긴 과거의 영상 기록과 함께, 한 엄마가 딸을 지키려 애쓰는 이야기.', warning: '' },
  { title: '컨저링', originalTitle: 'The Conjuring', year: 2013, country: '미국', tags: ['occult'], description: '외딴 농가로 이사 온 가족과, 이들을 돕는 초자연 현상 조사가 부부의 이야기.', warning: '' },
  { title: '미드소마', originalTitle: 'Midsommar', year: 2019, country: '미국·스웨덴', tags: ['folk', 'psych'], description: '해가 지지 않는 스웨덴 마을의 한여름 축제에 초대된 친구들이 겪는 일.', warning: '충격적 장면 주의' },
  { title: '셔터', originalTitle: 'Shutter', year: 2004, country: '태국', tags: ['classic'], description: '사고 이후 찍는 사진마다 정체 모를 흐릿한 형체가 함께 찍히기 시작한다.', warning: '' },
  { title: '링', originalTitle: 'Ring', year: 1998, country: '일본', tags: ['classic'], description: '보고 나면 일주일 뒤에 죽는다는 소문의 비디오테이프를 쫓는 이야기.', warning: '' }
];

const count = db.prepare('SELECT COUNT(*) AS n FROM movies').get().n;
if (count > 0) {
  console.log(`영화가 이미 ${count}편 있어서 아무것도 넣지 않았어요.`);
  process.exit(0);
}

const now = new Date().toISOString();
const insert = db.prepare(
  `INSERT INTO movies (title, original_title, year, country, tags, description, warning, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
MOVIES.forEach((m) => insert.run(m.title, m.originalTitle, m.year, m.country, JSON.stringify(m.tags), m.description, m.warning, now, now));
console.log(`공포영화 ${MOVIES.length}편을 넣었어요. 영화 페이지에서 무서움 점수를 매겨 보세요.`);
