/* =========================================================
   무서운 게 딱좋아! — 로그인 상태 (auth.js)
   - 모든 페이지: 헤더에 "로그인 / 회원가입" 또는 "내 닉네임 / 로그아웃" 표시
   - 다른 스크립트(posts.js)는 HorrorAuth.ready 로 로그인한 사람을 받아 씀
   ========================================================= */

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const params = new URLSearchParams(location.search);

  async function call(method, url, body) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin'
      });
    } catch (e) {
      throw new Error('서버에 연결하지 못했어요. 터미널에서 npm start로 서버가 켜져 있는지 확인해 주세요.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    return data;
  }

  // 로그인 후 돌아갈 곳: 우리 사이트의 페이지 이름만 허용 (다른 사이트로 빼돌리기 방지)
  function safeNext(raw) {
    const v = String(raw || '');
    return /^[a-z0-9_-]+\.html(\?[a-z0-9_=&%-]*)?$/i.test(v) ? v : 'index.html';
  }
  const here = () => (location.pathname.split('/').pop() || 'index.html') + location.search;
  const loginUrl = () => 'login.html?next=' + encodeURIComponent(here());

  // 지금 로그인한 사람 (없으면 null). 페이지가 열릴 때 한 번 물어봄
  const ready = call('GET', '/api/auth/me').then((d) => d.user).catch(() => null);

  async function logout() {
    await call('POST', '/api/auth/logout').catch(() => {});
    // Firebase 쪽 로그인도 끝냄 (Firebase 모듈이 있는 페이지라면 바로, 아니면 다음에 로그인 화면에서 정리됨)
    if (window.HorrorFirebase) await window.HorrorFirebase.signOut().catch(() => {});
    location.href = 'index.html';
  }

  window.HorrorAuth = { ready, logout, loginUrl };

  /* ---------- 헤더 표시 ---------- */
  ready.then((user) => {
    document.querySelectorAll('[data-auth-slot]').forEach((slot) => {
      slot.textContent = '';
      if (user) {
        const avatar = document.createElement('span');
        avatar.className = 'avatar';
        avatar.setAttribute('aria-hidden', 'true');
        avatar.textContent = user.nickname.charAt(0);
        const name = document.createElement('span');
        name.textContent = user.nickname;
        slot.append(avatar, name);
        if (user.isAdmin) {
          const chip = document.createElement('span');
          chip.className = 'chip chip--amber';
          chip.textContent = '관리자';
          slot.append(chip);
        }
        const out = document.createElement('button');
        out.type = 'button';
        out.className = 'btn btn--text btn--sm';
        out.textContent = '로그아웃';
        out.addEventListener('click', logout);
        slot.append(out);
      } else {
        const login = document.createElement('a');
        login.className = 'btn btn--ghost btn--sm';
        login.href = loginUrl();
        login.textContent = '로그인';
        const join = document.createElement('a');
        join.className = 'btn btn--text btn--sm';
        join.href = 'signup.html?next=' + encodeURIComponent(here());
        join.textContent = '회원가입';
        slot.append(login, join);
      }
    });
  });

  // 로그인·회원가입 화면의 폼은 firebase-auth.js 가 처리합니다
})();
