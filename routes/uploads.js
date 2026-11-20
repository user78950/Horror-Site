// 사진 올리기 API
//   POST /api/uploads   { data: "data:image/jpeg;base64,..." }  →  { url: "/uploads/xxxx.jpg" }
//
// 브라우저(app.js)가 사진을 가로 1600px JPG로 다시 그려서 보내므로 보통 1MB 안쪽입니다.
// 그래도 서버에서 한 번 더 검사하고, 사진 속 숨은 정보(촬영 위치 등)를 지운 뒤 저장합니다.
//
// ⚠ 저장 위치 public/uploads 는 서버 디스크입니다. 배포할 때는 파일이 유지되는 디스크나
//   별도 이미지 저장소가 필요합니다. 이메일 인증을 마친 회원만 올릴 수 있습니다.

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { requireVerified } = require('../lib/auth');

const router = express.Router();
const DIR = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(DIR, { recursive: true });

const MAX_BYTES = 5 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// JPG: EXIF·XMP(APP1), IPTC(APP13) 구간을 빼고 다시 이어 붙임
function stripJpeg(buf) {
  const parts = [buf.subarray(0, 2)];
  let pos = 2;
  while (pos + 4 <= buf.length) {
    if (buf[pos] !== 0xff) break;
    const marker = buf[pos + 1];
    if (marker === 0xff) { pos += 1; continue; }                          // 채움 바이트
    if (marker === 0xda) break;                                           // 여기부터 이미지 데이터
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(buf.subarray(pos, pos + 2)); pos += 2; continue;
    }
    const len = buf.readUInt16BE(pos + 2);
    const segment = buf.subarray(pos, pos + 2 + len);
    if (marker !== 0xe1 && marker !== 0xed) parts.push(segment);
    pos += 2 + len;
  }
  parts.push(buf.subarray(pos));
  return Buffer.concat(parts);
}

// PNG: 글자·EXIF 덩어리(tEXt, iTXt, zTXt, eXIf) 빼기
function stripPng(buf) {
  const parts = [buf.subarray(0, 8)];
  let pos = 8;
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const chunk = buf.subarray(pos, pos + 12 + len);
    if (!['tEXt', 'iTXt', 'zTXt', 'eXIf'].includes(type)) parts.push(chunk);
    pos += 12 + len;
    if (type === 'IEND') break;
  }
  return Buffer.concat(parts);
}

// 이 경로만 큰 요청(최대 8MB)을 받음
router.post('/', requireVerified, express.json({ limit: '8mb' }), (req, res) => {
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String((req.body && req.body.data) || ''));
  if (!match) return res.status(400).json({ error: 'JPG 또는 PNG 사진만 올릴 수 있어요.' });

  let buf = Buffer.from(match[2], 'base64');
  if (buf.length > MAX_BYTES) return res.status(400).json({ error: '사진이 너무 커요. 5MB 이하로 올려 주세요.' });

  const isJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng = buf.length > 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE);
  if ((match[1] === 'jpeg' && !isJpeg) || (match[1] === 'png' && !isPng)) {
    return res.status(400).json({ error: '사진 파일이 아니에요.' });
  }

  try {
    buf = isJpeg ? stripJpeg(buf) : stripPng(buf);
  } catch (err) {
    return res.status(400).json({ error: '사진을 읽지 못했어요. 다른 사진으로 시도해 주세요.' });
  }

  const name = crypto.randomUUID() + (isJpeg ? '.jpg' : '.png');
  fs.writeFileSync(path.join(DIR, name), buf);
  res.status(201).json({ url: '/uploads/' + name });
});

module.exports = router;
