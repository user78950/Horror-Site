/* =========================================================
   심야 archive — 프로필 (profile.js)
   profile.html?id=회원번호  → 그 회원의 프로필과 쓴 글
   profile.html              → 내 프로필 (로그인 필요) + "임시 저장" 탭
   profile.html#drafts       → 내 프로필의 임시 저장 탭을 바로 열기
   ========================================================= */

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const view = $('#profile-view');
  if (!view) return;

  const CATEGORY = { intl: '해외 번역', real: '국내 실화', novel: '단편 창작', legend: '도시전설·오컬트', film: '공포영화 리뷰' };
  const el = (tag, className, text) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const fmt = (n) => Number(n).toLocaleString('ko-KR');
  function timeAgo(iso) {
    const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return '방금 전';
    if (sec < 3600) return Math.floor(sec / 60) + '분 전';
    if (sec < 86400) return Math.floor(sec / 3600) + '시간 전';
    if (sec < 86400 * 7) return Math.floor(sec / 86400) + '일 전';
    return new Date(iso).toLocaleDateString('ko-KR');
  }
  async function api(url, method) {
    let res;
    try {
      res = await fetch(url, { method: method || 'GET' });
    } catch (e) {
      throw new Error('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '불러오지 못했어요.');
    return data;
  }

  let userId = null;
  let isMe = false;
  let sort = 'new';
  let page = 1;

  function card(p) {
    const art = el('article', 'post-card');
    const meta = el('div', 'post-card__meta');
    if (p.isBest) meta.append(el('span', 'chip best-chip', 'BEST'));
    meta.append(el('span', 'chip', CATEGORY[p.category] || '괴담'));
    if (p.effectsCount) meta.append(el('span', 'chip chip--amber', '연출 ' + p.effectsCount + '개'));
    meta.append(el('span', '', timeAgo(p.createdAt)));
    const text = el('div', 'post-card__text');
    const h = el('h3', 'post-card__title');
    const a = el('a', '', p.title);
    a.href = 'post.html?id=' + p.id;
    h.append(a);
    text.append(h, el('p', 'post-card__excerpt', p.excerpt));
    const foot = el('div', 'post-card__foot');
    foot.append(el('span', 'shudder-btn', '소름 ' + fmt(p.likes)), el('span', 'stat', '댓글 ' + fmt(p.comments) + ' · 조회 ' + fmt(p.views)));
    if (isMe) {
      const edit = el('a', 'btn btn--ghost btn--sm', '수정');
      edit.href = 'write.html?id=' + p.id;
      foot.append(edit);
    }
    art.append(meta, text, foot);
    return art;
  }

  async function loadPosts(reset) {
    const list = $('#profile-posts');
    const more = $('#profile-more');
    if (reset) { page = 1; list.textContent = ''; }
    try {
      const data = await api(`/api/posts?author=${userId}&page=${page}` + (sort === 'hot' ? '&sort=hot' : ''));
      if (reset && !data.posts.length) {
        const box = el('div', 'panel');
        box.append(el('p', 'panel__title', isMe ? '아직 쓴 괴담이 없어요.' : '아직 쓴 괴담이 없어요.'));
        if (isMe) {
          const go = el('a', 'btn btn--primary', '첫 괴담 쓰기');
          go.href = 'write.html';
          go.style.alignSelf = 'flex-start';
          box.append(go);
        }
        list.append(box);
      }
      data.posts.forEach((p) => list.append(card(p)));
      more.hidden = page * data.pageSize >= data.total;
    } catch (err) {
      list.append(el('p', 'muted', err.message));
    }
  }

  /* ---------- 임시 저장 탭 (내 프로필에서만) ---------- */
  function draftCard(d) {
    const art = el('article', 'post-card');
    const meta = el('div', 'post-card__meta');
    meta.append(el('span', 'chip chip--outline-amber', '임시 저장'));
    meta.append(el('span', 'chip', CATEGORY[d.category] || '괴담'));
    meta.append(el('span', '', '마지막 저장 ' + timeAgo(d.updatedAt)));
    const text = el('div', 'post-card__text');
    const h = el('h3', 'post-card__title');
    const a = el('a', '', d.title || '제목 없는 글');
    a.href = 'write.html?draft=' + d.id;
    h.append(a);
    text.append(h, el('p', 'post-card__excerpt', d.excerpt || '아직 본문이 없어요.'));
    const foot = el('div', 'post-card__foot');
    const resume = el('a', 'btn btn--primary btn--sm', '이어 쓰기');
    resume.href = 'write.html?draft=' + d.id;
    const del = el('button', 'btn btn--ghost btn--sm', '삭제');
    del.type = 'button';
    del.addEventListener('click', async () => {
      if (!confirm('이 임시 글을 지울까요? 지우면 되돌릴 수 없어요.')) return;
      del.disabled = true;
      try {
        await api('/api/drafts/' + d.id, 'DELETE');
        loadDrafts();
      } catch (err) {
        del.disabled = false;
        alert(err.message);
      }
    });
    foot.append(resume, del);
    art.append(meta, text, foot);
    return art;
  }

  async function loadDrafts() {
    const list = $('#profile-drafts');
    try {
      const data = await api('/api/drafts');
      list.textContent = '';
      $('#tab-drafts').textContent = '임시 저장 (' + data.drafts.length + ')';
      $('#profile-drafts-meta').textContent = data.drafts.length + ' / ' + data.max + '개';
      if (!data.drafts.length) {
        const box = el('div', 'panel');
        box.append(el('p', 'panel__title', '임시 저장한 글이 없어요.'));
        box.append(el('p', 'muted', '글쓰기 화면에서 "임시 저장"을 누르면 여기에 모여요.'));
        const go = el('a', 'btn btn--primary', '새 괴담 쓰기');
        go.href = 'write.html';
        go.style.alignSelf = 'flex-start';
        box.append(go);
        list.append(box);
      }
      data.drafts.forEach((d) => list.append(draftCard(d)));
    } catch (err) {
      list.textContent = '';
      list.append(el('p', 'muted', err.message));
    }
  }

  // 탭 전환 (버튼 켜고 끄기는 app.js 가 하고, 여기서는 보여 줄 영역만 바꿈)
  $('#profile-tabs').addEventListener('toggle-change', (e) => {
    const drafts = e.detail.dataset.ptab === 'drafts';
    $('#profile-drafts-section').hidden = !drafts;
    $('#profile-posts-section').hidden = drafts;
    if (drafts) loadDrafts();
  });

  $('#profile-more').addEventListener('click', () => { page += 1; loadPosts(false); });
  $$('[data-psort]').forEach((b) => b.addEventListener('click', () => { sort = b.dataset.psort; loadPosts(true); }));

  (async () => {
    const state = $('#profile-state');
    const param = new URLSearchParams(location.search).get('id');
    const me = window.HorrorAuth ? await HorrorAuth.ready : null;
    if (/^\d+$/.test(param || '')) userId = Number(param);
    else if (me) userId = me.id;
    else { location.replace(HorrorAuth.loginUrl()); return; }

    try {
      const data = await api('/api/users/' + userId);
      isMe = data.isMe;
      document.title = data.user.nickname + ' · 심야 archive';
      $('#profile-avatar').textContent = data.user.nickname.charAt(0);
      $('#profile-name').textContent = data.user.nickname;
      $('#profile-joined').textContent = new Date(data.user.joinedAt).toLocaleDateString('ko-KR') + ' 가입' + (isMe ? ' · 내 프로필' : '');
      $('#profile-stats').textContent = `괴담 ${fmt(data.stats.posts)}편 · 받은 소름 ${fmt(data.stats.likesReceived)} · 명예의 전당 ${fmt(data.stats.bestPosts)}편`;
      $('#profile-actions').hidden = !isMe;
      $('#profile-posts-title').textContent = isMe ? '내가 쓴 괴담' : data.user.nickname + '님의 괴담';
      state.hidden = true;
      view.hidden = false;
      loadPosts(true);
      if (isMe) {
        $('#profile-tabs').hidden = false;
        loadDrafts();   // 탭에 개수 표시
        if (location.hash === '#drafts') $('#tab-drafts').click();
      }
    } catch (err) {
      state.textContent = err.message;
    }
  })();
})();
