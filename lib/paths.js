// 지워지면 안 되는 파일들의 위치
// 내 컴퓨터에서는 프로젝트 폴더 안, 배포(Render)에서는 영구 디스크(/var/data) 안을 쓰도록 .env / 환경 변수로 바꿉니다.
//   DB_PATH     기본: data/horror.db         배포: /var/data/horror.db
//   UPLOAD_DIR  기본: public/uploads         배포: /var/data/uploads

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(ROOT, 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

module.exports = { ROOT, UPLOAD_DIR };
