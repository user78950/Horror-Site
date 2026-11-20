/* =========================================================
   무서운 게 딱좋아! — Firebase 로그인 (브라우저 쪽)
   login.html, signup.html, write.html 에서 불러옵니다.

   흐름: Firebase로 로그인 → 증명서(ID 토큰)를 우리 서버에 보냄
        → 서버가 확인하고 우리 사이트의 로그인 쿠키를 발급
   ========================================================= */

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

const $ = (sel, root = document) => root.querySelector(sel);
const params = new URLSearchParams(location.search);
const safeNext = (raw) => (/^[a-z0-9_-]+\.html(\?[a-z0-9_=&%-]*)?$/i.test(String(raw || '')) ? raw : 'index.html');
const next = safeNext(params.get('next'));
const msgBox = $('#auth-msg');
const say = (text, ok) => {
  if (!msgBox) return;
  msgBox.textContent = text || '';
  msgBox.classList.toggle('auth-msg--ok', !!ok);
};

// Firebase 오류를 알기 쉬운 말로
function friendly(err) {
  const code = (err && err.code) || '';
  const map = {
    'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않아요.',
    'auth/wrong-password': '이메일 또는 비밀번호가 맞지 않아요.',
    'auth/user-not-found': '이메일 또는 비밀번호가 맞지 않아요.',
    'auth/invalid-email': '이메일 주소를 확인해 주세요.',
    'auth/email-already-in-use': '이미 가입된 이메일이에요. 로그인해 주세요.',
    'auth/weak-password': '비밀번호가 너무 약해요. 8자 이상으로 정해 주세요.',
    'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.',
    'auth/popup-closed-by-user': '구글 로그인 창이 닫혔어요. 다시 눌러 주세요.',
    'auth/cancelled-popup-request': '구글 로그인 창이 닫혔어요. 다시 눌러 주세요.',
    'auth/popup-blocked': '브라우저가 로그인 창을 막았어요. 주소창 오른쪽에서 팝업을 허용한 뒤 다시 눌러 주세요.',
    'auth/network-request-failed': '인터넷 연결을 확인해 주세요.',
    'auth/unauthorized-domain': '이 주소는 Firebase에 등록되지 않았어요. Firebase 콘솔 → Authentication → 설정 → 승인된 도메인에 지금 주소를 추가해 주세요.',
    'auth/operation-not-allowed': '이 로그인 방법이 꺼져 있어요. Firebase 콘솔 → Authentication → 로그인 방법에서 켜 주세요.',
    'auth/invalid-api-key': 'Firebase 설정값(FIREBASE_API_KEY)이 맞지 않아요. .env를 확인해 주세요.',
    'auth/missing-email': '이메일을 먼저 입력해 주세요.'
  };
  return map[code] || (err && err.message) || '문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
}

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const setBusy = (busy) => {
  document.querySelectorAll('[data-auth-action]').forEach((el) => { el.disabled = busy; });
};

/* ---------- Firebase 켜기 ---------- */
let fb = null;   // { auth, api }
async function start() {
  let config;
  try { config = await (await fetch('/api/auth/config')).json(); } catch (e) { config = null; }
  if (!config) throw new Error('서버에 연결하지 못했어요. npm start로 서버가 켜져 있는지 확인해 주세요.');
  if (!config.enabled) throw new Error('Firebase 설정이 아직 없어요. 저장소의 .env 파일에 FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_APP_ID를 넣고 서버를 다시 켜 주세요.');
  let appMod, authMod;
  try {
    appMod = await import(SDK + 'firebase-app.js');
    authMod = await import(SDK + 'firebase-auth.js');
  } catch (e) {
    throw new Error('Firebase를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');
  }
  const app = appMod.initializeApp({ apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId, appId: config.appId });
  const auth = authMod.getAuth(app);
  auth.languageCode = 'ko';                 // 인증·비밀번호 찾기 메일을 한국어로
  await auth.authStateReady();
  fb = { auth, api: authMod };
  return fb;
}

/* ---------- 우리 서버에 로그인 연결 ---------- */
async function connect(user, nickname) {
  const idToken = await user.getIdToken(true);
  return postJson('/api/auth/firebase', nickname ? { idToken, nickname } : { idToken });
}

// 처음 온 사람(주로 구글 로그인): 닉네임 정하는 단계 보여 주기
function askNickname(user, suggestion) {
  const step = $('#nickname-step');
  if (!step) return;
  document.querySelectorAll('[data-auth-main]').forEach((el) => { el.hidden = true; });
  step.hidden = false;
  const input = $('#first-nickname');
  if (suggestion && !input.value) input.value = suggestion;
  input.focus();
  say('');
  $('#nickname-form').onsubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const r = await connect(user, input.value);
    setBusy(false);
    if (r.ok && r.data.user) { location.href = next; return; }
    say(r.data.error || '닉네임을 저장하지 못했어요.');
  };
}

async function finish(user, nickname) {
  const r = await connect(user, nickname);
  if (r.ok && r.data.needNickname) { askNickname(user, r.data.suggestion); return false; }
  if (!r.ok) { say(r.data.error || '로그인하지 못했어요.'); return false; }
  return true;
}

async function googleLogin() {
  setBusy(true);
  say('');
  try {
    const cred = await fb.api.signInWithPopup(fb.auth, new fb.api.GoogleAuthProvider());
    if (await finish(cred.user)) location.href = next;
  } catch (err) {
    say(friendly(err));
  } finally {
    setBusy(false);
  }
}

/* ---------- 로그인 화면 ---------- */
async function initLogin() {
  const form = $('#login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setBusy(true);
    say('');
    try {
      const cred = await fb.api.signInWithEmailAndPassword(fb.auth, $('#login-email').value.trim(), $('#login-password').value);
      if (await finish(cred.user)) location.href = next;
    } catch (err) {
      say(friendly(err));
    } finally {
      setBusy(false);
    }
  });

  $('#forgot-btn').addEventListener('click', async () => {
    const email = $('#login-email').value.trim();
    if (!email) { say('비밀번호를 재설정할 이메일을 위 칸에 먼저 입력해 주세요.'); $('#login-email').focus(); return; }
    setBusy(true);
    try {
      await fb.api.sendPasswordResetEmail(fb.auth, email);
      // 가입 여부를 알려 주지 않도록 항상 같은 안내
      say('가입된 이메일이라면 비밀번호 재설정 메일을 보냈어요. 받은 편지함(또는 스팸함)을 확인해 주세요.', true);
    } catch (err) {
      say(friendly(err));
    } finally {
      setBusy(false);
    }
  });
}

/* ---------- 회원가입 화면 ---------- */
async function initSignup() {
  const form = $('#signup-form');
  const pw = $('#signup-password');
  const pwHint = $('#pw-hint');
  const checkPw = () => {
    if (!pw.value) { pwHint.textContent = '8자 이상. 다른 사이트와 같은 비밀번호는 피해 주세요.'; pwHint.className = 'auth-hint'; return; }
    if (pw.value.length < 8) { pwHint.textContent = '8자 이상이어야 해요. (지금 ' + pw.value.length + '자)'; pwHint.className = 'auth-hint auth-hint--bad'; return; }
    pwHint.textContent = '좋아요.'; pwHint.className = 'auth-hint auth-hint--ok';
  };
  pw.addEventListener('input', checkPw);
  checkPw();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    say('');
    const email = $('#signup-email').value.trim();
    const nickname = $('#signup-nickname').value.trim();
    if (!/^[0-9A-Za-z가-힣_]{2,12}$/.test(nickname)) { say('닉네임은 2~12자의 한글, 영문, 숫자, 밑줄(_)로 정해 주세요.'); return; }
    if (pw.value.length < 8) { say('비밀번호는 8자 이상으로 정해 주세요.'); pw.focus(); return; }
    if (pw.value !== $('#signup-password2').value) { say('비밀번호 확인이 일치하지 않아요.'); return; }
    if (!$('#signup-agree').checked) { say('커뮤니티 가이드라인에 동의해 주세요.'); return; }
    setBusy(true);
    try {
      // 닉네임이 겹쳐서 다시 누른 경우: 이미 만든 Firebase 계정을 그대로 씀
      let user = fb.auth.currentUser;
      if (!user || (user.email || '').toLowerCase() !== email.toLowerCase()) {
        const cred = await fb.api.createUserWithEmailAndPassword(fb.auth, email, pw.value);
        user = cred.user;
        await fb.api.sendEmailVerification(user);
      }
      const r = await connect(user, nickname);
      if (!r.ok) { say(r.data.error || '가입하지 못했어요.'); return; }
      document.querySelectorAll('[data-auth-main]').forEach((el) => { el.hidden = true; });
      $('#verify-sent-email').textContent = email;
      $('#verify-sent').hidden = false;
      $('#verify-continue').href = next;
    } catch (err) {
      say(friendly(err));
    } finally {
      setBusy(false);
    }
  });
}

/* ---------- 글쓰기 화면: 이메일 인증 안내 ---------- */
async function initVerifyBanner() {
  const banner = $('#verify-banner');
  const note = $('#verify-note');
  const user = fb.auth.currentUser;
  $('#verify-resend').addEventListener('click', async () => {
    if (!fb.auth.currentUser) { note.textContent = '로그아웃 후 다시 로그인하면 인증 메일을 다시 보낼 수 있어요.'; return; }
    try {
      await fb.api.sendEmailVerification(fb.auth.currentUser);
      note.textContent = '인증 메일을 다시 보냈어요. 받은 편지함(또는 스팸함)을 확인해 주세요.';
    } catch (err) { note.textContent = friendly(err); }
  });
  $('#verify-done').addEventListener('click', async () => {
    const u = fb.auth.currentUser;
    if (!u) { note.textContent = '로그아웃 후 다시 로그인해 주세요.'; return; }
    await u.reload();
    if (!u.emailVerified) { note.textContent = '아직 인증이 확인되지 않았어요. 메일의 링크를 누른 뒤 다시 눌러 주세요.'; return; }
    const r = await connect(u);
    if (r.ok) location.reload(); else note.textContent = r.data.error || '확인하지 못했어요.';
  });
  if (!user) note.textContent = '이 브라우저에서 다시 로그인하면 인증 확인을 할 수 있어요.';
  banner.dataset.ready = '1';
}

/* ---------- 시작 ---------- */
(async () => {
  const isLogin = !!$('#login-form');
  const isSignup = !!$('#signup-form');
  const hasBanner = !!$('#verify-banner');
  try {
    await start();
  } catch (err) {
    say(err.message);
    setBusy(true);
    const note = $('#verify-note');
    if (note) note.textContent = err.message;
    return;
  }

  // 로그아웃 버튼(auth.js)에서 Firebase 로그인도 함께 끝낼 수 있게
  window.HorrorFirebase = { signOut: () => fb.api.signOut(fb.auth) };

  if (isLogin || isSignup) {
    // 우리 사이트에서 로그아웃된 상태면 남아 있는 Firebase 로그인도 정리
    const me = await fetch('/api/auth/me').then((r) => r.json()).catch(() => ({ user: null }));
    if (me.user) { location.replace(next); return; }
    if (fb.auth.currentUser && !isSignup) await fb.api.signOut(fb.auth);
    document.querySelectorAll('[data-google]').forEach((btn) => btn.addEventListener('click', googleLogin));
    if (isLogin) initLogin();
    if (isSignup) initSignup();
    setBusy(false);
  }
  if (hasBanner) initVerifyBanner();
})();
