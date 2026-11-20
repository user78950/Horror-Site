// Firebase 로그인 확인 (서버 쪽)
//
// 브라우저에서 Firebase로 로그인하면 "이 사람은 누구다"라는 증명서(ID 토큰)가 생깁니다.
// 여기서는 그 증명서가 진짜 Firebase가 우리 프로젝트용으로 발급한 것인지 확인합니다.
// 확인에는 프로젝트 ID만 필요하고, 비밀 서비스 계정 파일은 필요 없습니다.

const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// 브라우저에 알려 줘도 되는 공개 설정값 (.env 에서 읽음)
function publicConfig() {
  const cfg = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    appId: process.env.FIREBASE_APP_ID || ''
  };
  return { enabled: !!(cfg.apiKey && cfg.authDomain && cfg.projectId), ...cfg };
}

let auth = null;
function firebaseAuth() {
  if (auth) return auth;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID 가 .env 에 없어요.');
  if (!getApps().length) initializeApp({ projectId });
  auth = getAuth();
  return auth;
}

// 증명서 확인 → { uid, email, email_verified, name, ... }
// 가짜이거나 만료되었거나 다른 프로젝트용이면 오류를 던집니다.
async function verifyIdToken(idToken) {
  return firebaseAuth().verifyIdToken(idToken);
}

module.exports = { publicConfig, verifyIdToken };
