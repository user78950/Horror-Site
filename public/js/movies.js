/* =========================================================
   무서운 게 딱좋아! — 공포영화 순위 (movies.js)
   movies.html 에서 씁니다. 순위 보기, 무서움 점수 매기기, 관리자 영화 등록·수정·삭제.
   ========================================================= */

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  if (!$('#mv-list')) return;

  const LABELS = { 1: '덤덤', 2: '살짝 오싹', 3: '무섭다', 4: '많이 무섭다', 5: '잠 못 잠' };
  let TAGS = {};
  let movies = [];
  let currentTag = '';
  let user = null;
  const note = $('#mv-note');

  const el = (tag, className, text) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  async function api(method, url, body) {
    let res;
    try {
      res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw new Error('서버에 연결하지 못했어요. npm start로 서버가 켜져 있는지 확인해 주세요.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    return data;
  }

  const metaText = (m) => [m.country, m.year].filter(Boolean).join(' · ');
  const tagText = (m) => m.tags.map((t) => TAGS[t] || t).join(' / ');

  /* ---------- 점수 버튼 ---------- */
  function ratingWidget(m) {
    const box = el('div', 'rating');
    box.append(el('span', 'rating__label', '내 무서움 점수'));
    for (let s = 1; s <= 5; s++) {
      const b = el('button', 'rating__btn', String(s));
      b.type = 'button';
      b.title = s + '점 · ' + LABELS[s];
      b.setAttribute('aria-label', `${m.title} 무서움 ${s}점 (${LABELS[s]})`);
      b.setAttribute('aria-pressed', String(m.myScore === s));
      b.addEventListener('click', () => rate(m, m.myScore === s ? null : s));   // 같은 점수를 다시 누르면 취소
      box.append(b);
    }
    const hint = el('span', 'rating__hint', m.myScore ? `${LABELS[m.myScore]} · 다시 누르면 취소` : '본 영화라면 점수를 남겨 주세요');
    box.append(hint);
    return box;
  }

  async function rate(m, score) {
    if (!user) { location.href = HorrorAuth.loginUrl(); return; }
    if (!user.emailVerified) { note.textContent = '이메일 인증을 마치면 점수를 남길 수 있어요. 글쓰기 화면에서 인증 메일을 다시 받을 수 있어요.'; return; }
    note.textContent = '';
    $$('.rating__btn').forEach((b) => { b.disabled = true; });
    try {
      await api('POST', `/api/movies/${m.id}/rating`, { score });
      await load();                                  // 순위가 바뀔 수 있어서 다시 불러옴
    } catch (err) {
      note.textContent = err.message;
      $$('.rating__btn').forEach((b) => { b.disabled = false; });
    }
  }

  /* ---------- 점수 표시 ---------- */
  function scoreBox(m, big) {
    if (!m.votes) return el('span', 'mv-empty-score', '아직 점수 없음');
    const s = el('span', 'score ' + (big ? 'score--xl' : 'score--lg'), m.average.toFixed(1));
    const small = el('small', '', ' / 5');
    s.append(small);
    const wrap = el('span', '');
    wrap.append(s, el('span', 'mono muted', `  ${m.votes.toLocaleString('ko-KR')}명`));
    return wrap;
  }

  function adminButtons(m) {
    const box = el('span', 'mv-admin-actions');
    const edit = el('button', 'btn btn--text btn--sm', '수정');
    edit.type = 'button';
    edit.addEventListener('click', () => startEdit(m));
    const del = el('button', 'btn btn--text btn--sm', '삭제');
    del.type = 'button';
    del.addEventListener('click', async () => {
      if (!confirm(`"${m.title}"을(를) 삭제할까요? 모인 점수도 함께 지워져요.`)) return;
      try { await api('DELETE', `/api/movies/${m.id}`); await load(); } catch (err) { note.textContent = err.message; }
    });
    box.append(edit, del);
    return box;
  }

  /* ---------- 1위 카드 ---------- */
  function featureCard(m) {
    const art = el('article', 'panel panel--lg panel--amber film-feature');
    art.setAttribute('aria-label', '1위 ' + m.title);
    const aside = el('div', 'film-feature__aside');
    const poster = el('div', 'poster');
    poster.setAttribute('role', 'img');
    poster.setAttribute('aria-label', m.title + ' 포스터 자리');
    poster.append(el('span', 'poster__rank', 'RANK 1'), el('span', 'poster__label', 'POSTER'), el('span', 'poster__title', m.title));
    const sb = el('div', 'score-box');
    sb.append(el('span', 'muted', '매니아 무서움 점수'), scoreBox(m, true));
    aside.append(poster, sb);

    const body = el('div', 'film-feature__body');
    const chips = el('div', '');
    chips.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px';
    chips.append(el('span', 'chip chip--amber', currentTag ? (TAGS[currentTag] || '') + ' 1위' : '이달의 무서움 1위'));
    if (m.tags.length) chips.append(el('span', 'chip', tagText(m)));
    if (metaText(m)) chips.append(el('span', 'chip', metaText(m)));
    if (m.warning) chips.append(el('span', 'chip chip--red', m.warning));
    if (user && user.isAdmin) chips.append(adminButtons(m));
    const h = el('h2', 'film-feature__title', m.title + ' ');
    if (m.originalTitle) h.append(el('small', '', m.originalTitle + (m.year ? ', ' + m.year : '')));
    body.append(chips, h);
    if (m.description) body.append(el('p', 'review-quote', m.description));
    body.append(ratingWidget(m));
    art.append(aside, body);
    return art;
  }

  /* ---------- 2위부터 ---------- */
  function filmCard(m) {
    const art = el('article', 'panel film-card');
    const poster = el('div', 'poster poster--sm');
    poster.setAttribute('role', 'img');
    poster.setAttribute('aria-label', m.title + ' 포스터 자리');
    poster.append(el('span', 'poster__rank', m.rank ? '#' + m.rank : '-'), el('span', 'poster__title', m.title));
    const body = el('div', 'film-card__body');
    const meta = el('p', 'film-card__meta');
    if (m.tags.length) meta.append(el('span', 'chip', tagText(m)));
    if (metaText(m)) meta.append(el('span', '', metaText(m)));
    const sc = scoreBox(m, false);
    sc.style.marginLeft = 'auto';
    meta.append(sc);
    const h = el('h3', 'film-card__title', m.title + ' ');
    if (m.originalTitle) h.append(el('small', '', m.originalTitle + (m.year ? ', ' + m.year : '')));
    body.append(meta, h);
    if (m.description) body.append(el('p', 'film-card__desc', m.description));
    const foot = el('div', 'film-card__foot');
    if (m.warning) foot.append(el('span', 'chip chip--amber', m.warning));
    if (user && user.isAdmin) foot.append(adminButtons(m));
    body.append(foot, ratingWidget(m));
    art.append(poster, body);
    return art;
  }

  /* ---------- 불러오기 ---------- */
  async function load() {
    const list = $('#mv-list');
    const feature = $('#mv-feature');
    try {
      const data = await api('GET', '/api/movies' + (currentTag ? '?tag=' + currentTag : ''));
      TAGS = data.tags;
      movies = data.movies;
      $('#mv-total').textContent = data.totalVotes.toLocaleString('ko-KR');
      feature.textContent = '';
      list.textContent = '';
      if (!movies.length) {
        list.append(el('p', 'muted', user && user.isAdmin
          ? '아직 등록된 영화가 없어요. 위의 "영화 등록"에서 추가하거나, 터미널에서 npm run seed:movies 로 시작용 영화를 넣어 보세요.'
          : '아직 등록된 영화가 없어요.'));
        return;
      }
      const [first, ...rest] = movies;
      if (first.votes) feature.append(featureCard(first)); else rest.unshift(first);
      rest.forEach((m) => list.append(filmCard(m)));
      if (!rest.length) list.append(el('p', 'muted', '다른 영화는 아직 없어요.'));
      $('#mv-list-title').textContent = currentTag ? `${TAGS[currentTag]} 무서움 순위` : '매니아 공식 무서움 순위';
    } catch (err) {
      list.textContent = '';
      list.append(el('p', 'muted', err.message));
    }
  }

  $$('[data-mv-tag]').forEach((btn) => btn.addEventListener('click', () => { currentTag = btn.dataset.mvTag; load(); }));

  /* ---------- 관리자: 영화 등록·수정 ---------- */
  let editingId = null;
  function setupAdmin() {
    $('#mv-admin').hidden = false;
    const tagBox = $('#mv-tags');
    Object.entries(TAGS).forEach(([key, label]) => {
      const b = el('button', 'check', '');
      b.type = 'button';
      b.setAttribute('role', 'checkbox');
      b.setAttribute('aria-checked', 'false');
      b.dataset.tag = key;
      const box = el('span', 'check__box', '✓');
      box.setAttribute('aria-hidden', 'true');
      b.append(box, label);
      b.addEventListener('click', () => b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true')));
      tagBox.append(b);
    });
    $('#mv-form-reset').addEventListener('click', resetForm);
    $('#mv-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('#mv-form-msg');
      msg.textContent = '';
      const body = {
        title: $('#mv-title').value,
        originalTitle: $('#mv-original').value,
        year: $('#mv-year').value,
        country: $('#mv-country').value,
        tags: $$('#mv-tags .check[aria-checked="true"]').map((b) => b.dataset.tag),
        description: $('#mv-desc').value,
        warning: $('#mv-warning').value
      };
      try {
        await api(editingId ? 'PUT' : 'POST', editingId ? `/api/movies/${editingId}` : '/api/movies', body);
        resetForm();
        msg.textContent = '';
        note.textContent = '저장했어요.';
        await load();
      } catch (err) {
        msg.textContent = err.message;
      }
    });
  }
  function resetForm() {
    editingId = null;
    $('#mv-form').reset();
    $$('#mv-tags .check').forEach((b) => b.setAttribute('aria-checked', 'false'));
    $('#mv-form-title').textContent = '영화 등록 (관리자)';
    $('#mv-submit').textContent = '등록하기';
  }
  function startEdit(m) {
    editingId = m.id;
    $('#mv-title').value = m.title;
    $('#mv-original').value = m.originalTitle;
    $('#mv-year').value = m.year || '';
    $('#mv-country').value = m.country;
    $('#mv-desc').value = m.description;
    $('#mv-warning').value = m.warning;
    $$('#mv-tags .check').forEach((b) => b.setAttribute('aria-checked', String(m.tags.includes(b.dataset.tag))));
    $('#mv-form-title').textContent = `"${m.title}" 수정 (관리자)`;
    $('#mv-submit').textContent = '수정 완료';
    $('#mv-admin').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- 오늘 밤 맞춤 영화 ---------- */
  const result = $('#mm-result');
  $('#mm-group').addEventListener('toggle-change', () => { result.hidden = true; });
  $('#mm-level').addEventListener('input', () => { result.hidden = true; });
  $('#mm-btn').addEventListener('click', async () => {
    const tag = $('#mm-group [aria-pressed="true"]').dataset.mm;
    const heavy = Number($('#mm-level').value) >= 50;
    let pool;
    try { pool = (await api('GET', '/api/movies?tag=' + tag)).movies; } catch (err) { pool = []; }
    const rated = pool.filter((m) => m.votes);
    let pick = null;
    if (rated.length) {
      const sorted = rated.slice().sort((a, b) => b.average - a.average);
      pick = heavy ? sorted[0] : sorted[sorted.length - 1];   // 강하게: 가장 무서운 것 / 가볍게: 가장 덜 무서운 것
    } else if (pool.length) {
      pick = pool[Math.floor(Math.random() * pool.length)];
    }
    $('#mm-title').textContent = pick ? pick.title + (pick.average ? `  (무서움 ${pick.average.toFixed(1)})` : '') : '아직 이 장르의 영화가 없어요';
    $('#mm-desc').textContent = pick ? (pick.description || '') + (pick.votes ? '' : ' 아직 점수가 없어서 무작위로 골랐어요.') : '';
    result.hidden = false;
  });

  /* ---------- 시작 ---------- */
  const ready = window.HorrorAuth ? HorrorAuth.ready : Promise.resolve(null);
  ready.then(async (u) => {
    user = u;
    await load();
    if (user && user.isAdmin) setupAdmin();
  });
})();
