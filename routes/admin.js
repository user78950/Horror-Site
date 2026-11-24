// 관리자 도구
//   GET /api/admin/backup   지금 DB를 안전하게 복사해서 내려받기 (서버를 끄지 않아도 됨)
//
// 내려받은 파일에는 회원 이메일과 글이 들어 있으니 안전한 곳에 보관하고, 깃허브에는 절대 올리지 마세요.
// 올린 사진은 Render 디스크 스냅숏(매일 자동)으로 보관됩니다.

const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const db = require('../db/database');
const { requireAdmin } = require('../lib/auth');

const router = express.Router();

router.get('/backup', requireAdmin, (req, res) => {
  const stamp = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const tmp = path.join(os.tmpdir(), 'backup-' + crypto.randomUUID() + '.db');
  try {
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);   // 쓰는 중이어도 일관된 복사본을 만듦
  } catch (err) {
    return res.status(500).json({ error: '백업을 만들지 못했어요: ' + err.message });
  }
  res.download(tmp, `simya-archive-backup-${stamp}.db`, () => {
    fs.unlink(tmp, () => {});
  });
});

module.exports = router;
