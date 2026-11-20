/* =========================================================
   무서운 게 딱좋아! — 괴담 글 쓰기·보기·수정·삭제 (posts.js)
   서버의 /api/posts 와 주고받습니다.
     - index.html : "새로 올라온 괴담" 목록
     - post.html  : 글 보기 + 수정·삭제 버튼
     - write.html : 새 글 쓰기 / ?id=번호 로 열면 수정
   ========================================================= */

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const params = new URLSearchParams(location.search);

  const CATEGORY = { intl: '해외 번역', real: '국내 실화', novel: '단편 창작', legend: '도시전설·오컬트', film: '공포영화 리뷰' };
  const CATEGORY_CHIP = { intl: 'chip--amber', real: 'chip--red', novel: 'chip--red', legend: '', film: '' };
  const WARNING = { faint: '심약자 주의', jumpscare: '점프스케어 주의', claustrophobia: '폐소공포 유발' };

  /* ---------- 서버와 주고받기 ---------- */
  async function api(method, url, body) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      throw new Error('서버에 연결하지 못했어요. 터미널에서 npm start로 서버가 켜져 있는지 확인해 주세요.');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* 응답이 JSON이 아님 */ }
    if (res.status === 401 && window.HorrorAuth) {
      location.href = HorrorAuth.loginUrl();          // 로그인이 풀렸으면 로그인 화면으로
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || '문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function timeAgo(iso) {
    const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return '방금 전';
    if (sec < 3600) return Math.floor(sec / 60) + '분 전';
    if (sec < 86400) return Math.floor(sec / 3600) + '시간 전';
    if (sec < 86400 * 7) return Math.floor(sec / 86400) + '일 전';
    return new Date(iso).toLocaleDateString('ko-KR');
  }

  // 사용자 글은 항상 textContent로 넣어 HTML 주입을 막음
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /* =========================================================
     index.html — 새로 올라온 괴담
     ========================================================= */
  const live = $('#feed-live');
  if (live) {
    const list = $('#feed-live-list', live);
    const note = $('#feed-live-note', live);

    if (params.get('deleted') === '1') {
      note.textContent = '괴담을 삭제했어요.';
      note.hidden = false;
      history.replaceState(null, '', location.pathname);
    }

    const card = (p) => {
      const art = el('article', 'post-card');
      const meta = el('div', 'post-card__meta');
      meta.append(el('span', 'chip ' + (CATEGORY_CHIP[p.category] || ''), '[' + (CATEGORY[p.category] || '괴담') + ']'));
      if (p.effectsCount) meta.append(el('span', 'chip chip--amber', '연출 ' + p.effectsCount + '개'));
      if (p.warnings.includes('faint')) meta.append(el('span', 'chip', '심약자 주의'));
      meta.append(el('span', '', p.author + ' · ' + timeAgo(p.createdAt)));
      const text = el('div', 'post-card__text');
      const h = el('h2', 'post-card__title');
      const a = el('a', '', p.title);
      a.href = 'post.html?id=' + p.id;
      h.append(a);
      text.append(h, el('p', 'post-card__excerpt', p.excerpt));
      const foot = el('div', 'post-card__foot');
      if (p.tags.length) foot.append(el('span', 'muted', p.tags.join(' ')));
      foot.append(el('span', 'stat', '조회 ' + p.views.toLocaleString('ko-KR')));
      art.append(meta, text, foot);
      return art;
    };

    const empty = (message, withButton) => {
      const box = el('div', 'panel');
      box.append(el('p', 'panel__title', message));
      if (withButton) {
        const go = el('a', 'btn btn--primary', '첫 괴담 쓰기');
        go.href = 'write.html';
        go.style.alignSelf = 'flex-start';
        box.append(go);
      }
      return box;
    };

    const load = (category) => {
      list.setAttribute('aria-busy', 'true');
      const q = category && category !== 'all' ? '?category=' + encodeURIComponent(category) : '';
      api('GET', '/api/posts' + q)
        .then(({ posts }) => {
          list.textContent = '';
          if (!posts.length) list.append(empty(category && category !== 'all' ? '이 분류에는 아직 올라온 괴담이 없어요.' : '아직 올라온 괴담이 없어요. 첫 번째 이야기를 남겨 주세요.', true));
          else posts.forEach((p) => list.append(card(p)));
        })
        .catch((err) => { list.textContent = ''; list.append(empty(err.message, false)); })
        .then(() => list.removeAttribute('aria-busy'));
    };

    // 위쪽 분류 탭과 연결 (실시간 인기·명예의 전당은 반응 기능이 생기기 전까지 전체로 보여 줌)
    const TAB_TO_CATEGORY = { all: 'all', hot: 'all', hof: 'all', intl: 'intl', real: 'real', novel: 'novel', film: 'film' };
    $$('[data-tab]').forEach((btn) => btn.addEventListener('click', () => load(TAB_TO_CATEGORY[btn.dataset.tab] || 'all')));
    load(TAB_TO_CATEGORY[params.get('tab')] || 'all');
  }

  /* =========================================================
     post.html — 글 보기, 수정, 삭제
     ========================================================= */
  const postView = $('#post-view');
  if (postView) {
    const id = params.get('id');
    const state = $('#post-state');
    const article = $('#article');

    const fail = (message) => {
      state.textContent = message;
      state.hidden = false;
      postView.hidden = true;
    };

    if (!/^\d+$/.test(id || '')) {
      fail('글 주소가 올바르지 않아요.');
    } else {
      api('GET', '/api/posts/' + id)
        .then(({ post }) => {
          document.title = post.title + ' · 무서운 게 딱좋아!';
          $('#post-title').textContent = post.title;

          const chips = $('#post-chips');
          chips.append(el('span', 'chip ' + (CATEGORY_CHIP[post.category] || ''), CATEGORY[post.category] || '괴담'));
          post.warnings.forEach((w) => chips.append(el('span', 'chip chip--red', WARNING[w] || w)));
          if (post.effectsCount) chips.append(el('span', 'chip chip--amber', '연출 포함'));
          post.tags.forEach((t) => chips.append(el('span', 'chip', t)));

          const meta = $('#post-meta');
          meta.append(el('span', '', '작성 ' + post.author));
          meta.append(el('span', '', timeAgo(post.createdAt)));
          if (post.updatedAt !== post.createdAt) meta.append(el('span', '', '수정됨 ' + timeAgo(post.updatedAt)));
          meta.append(el('span', '', '조회 ' + post.views.toLocaleString('ko-KR')));

          if (post.sourceUrl && /^https?:\/\//i.test(post.sourceUrl)) {
            const src = $('#post-source');
            const a = el('a', '', post.sourceUrl);
            a.href = post.sourceUrl;
            a.target = '_blank';
            a.rel = 'noopener noreferrer nofollow';
            src.append('원문: ', a);
            src.hidden = false;
          }

          // 수정·삭제 버튼은 작성자 본인(또는 관리자)에게만
          $('#post-edit').href = 'write.html?id=' + post.id;
          $('#post-edit').hidden = !post.canEdit;
          $('#post-delete').hidden = !post.canEdit;

          // 본문은 서버에서 허용한 태그만 남긴 HTML이라 그대로 넣음
          article.innerHTML = post.content;

          // 흐리게 가린 증거 사진: "사진 보기"를 눌러야 선명해짐
          $$('figure.evidence-photo[data-blur]', article).forEach((fig) => {
            const img = $('img', fig);
            if (!img) return;
            const frame = el('div', 'evidence-photo__frame');
            img.replaceWith(frame);
            frame.append(img);
            fig.classList.add('is-blurred');
            const reveal = el('button', 'btn btn--warning evidence-photo__reveal', '증거 사진 보기 (눌러서 블러 해제)');
            reveal.type = 'button';
            reveal.addEventListener('click', () => { fig.classList.remove('is-blurred'); reveal.remove(); });
            frame.append(reveal);
          });

          postView.hidden = false;
          state.hidden = true;

          if (window.HorrorFX) HorrorFX.loadCustomSounds().then(() => HorrorFX.initStory(article));
        })
        .catch((err) => fail(err.message));

      $('#post-delete').addEventListener('click', () => {
        if (!confirm('이 괴담을 삭제할까요? 삭제하면 되돌릴 수 없어요.')) return;
        const btn = $('#post-delete');
        btn.disabled = true;
        api('DELETE', '/api/posts/' + id)
          .then(() => { location.href = 'index.html?deleted=1'; })
          .catch((err) => { btn.disabled = false; alert(err.message); });
      });
    }
  }

  /* =========================================================
     write.html — 새 글 쓰기 / 수정
     ========================================================= */
  const form = $('#write-form');
  if (form) {
    const id = params.get('id');
    const editor = $('#editor');
    const title = $('#title');
    const authorName = $('#author-name');
    const sourceUrl = $('#source-url');
    const sourceRow = $('#source-row');
    const status = $('#save-status');
    const publish = $('#publish-btn');
    const draftClear = $('#draft-clear');
    const categoryInput = form.querySelector('input[name="category"]');
    const categoryGroup = $('[data-input="category"]');
    const DRAFT_KEY = 'horror-draft-new';

    const store = {
      get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
      set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 공간 없음 */ } },
      del(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } }
    };

    const say = (text) => { status.textContent = text; };
    const refresh = () => document.dispatchEvent(new CustomEvent('editor:refresh'));

    const syncSource = () => { sourceRow.hidden = categoryInput.value !== 'intl'; };
    categoryGroup.addEventListener('toggle-change', () => { syncSource(); saveDraftSoon(); });

    const setCategory = (cat) => {
      $$('.toggle', categoryGroup).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === cat)));
      categoryInput.value = cat;
      syncSource();
    };
    const setWarnings = (list) => {
      $$('.check[data-warning]').forEach((b) => b.setAttribute('aria-checked', String(list.includes(b.dataset.warning))));
    };
    const setTags = (list) => { if (window.HorrorEditor) HorrorEditor.setTags(list || []); };

    const collect = () => ({
      category: categoryInput.value,
      title: title.value.trim(),
      content: editor.innerHTML,
      source_url: sourceUrl.value.trim(),
      warnings: $$('.check[data-warning][aria-checked="true"]').map((b) => b.dataset.warning),
      tags: window.HorrorEditor ? HorrorEditor.getTags() : []
    });

    const fill = (p) => {
      title.value = p.title || '';
      editor.innerHTML = p.content || '<p><br></p>';
      sourceUrl.value = p.source_url || p.sourceUrl || '';
      setCategory(p.category || 'real');
      setWarnings(p.warnings || []);
      setTags(p.tags || []);
      refresh();
    };

    syncSource();

    // 글쓰기는 로그인한 사람만: 아니면 로그인 화면으로 보냈다가 돌아오게
    if (window.HorrorAuth) {
      HorrorAuth.ready.then((user) => {
        if (!user) { location.replace(HorrorAuth.loginUrl()); return; }
        authorName.textContent = user.nickname;
        // 이메일 인증 전에는 쓰기는 되지만(임시 저장) 발행은 못 함
        if (!user.emailVerified) {
          $('#verify-banner').hidden = false;
          publish.disabled = true;
          publish.title = '이메일 인증을 마치면 발행할 수 있어요';
        }
      });
    }

    /* ---- 임시 저장 (새 글만): 쓰는 도중 브라우저를 닫아도 남아 있게 ---- */
    let draftTimer = null;
    function saveDraftSoon() {
      if (id) return;
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => {
        store.set(DRAFT_KEY, JSON.stringify(collect()));
        say('임시 저장됨 (' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) + ')');
        draftClear.hidden = false;
      }, 800);
    }
    [title, sourceUrl].forEach((input) => input.addEventListener('input', saveDraftSoon));
    editor.addEventListener('input', saveDraftSoon);
    form.addEventListener('click', (e) => { if (e.target.closest('.check, .tag button')) saveDraftSoon(); });
    $('#tag-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') saveDraftSoon(); });

    draftClear.addEventListener('click', () => {
      if (!confirm('임시 저장된 글을 지우고 빈 화면에서 새로 쓸까요?')) return;
      store.del(DRAFT_KEY);
      fill({ category: 'real', warnings: ['faint'], tags: [], title: '', content: '<p><br></p>' });
      draftClear.hidden = true;
      say('새 글');
    });

    if (id) {
      /* ---- 수정 모드 ---- */
      $('#editor-heading').textContent = '괴담 수정';
      publish.textContent = '수정 완료';
      $('#cancel-link').href = 'post.html?id=' + id;
      say('불러오는 중…');
      publish.disabled = true;
      api('GET', '/api/posts/' + id + '?edit=1')
        .then(({ post }) => {
          fill(post);
          if (!post.canEdit) { say('내가 쓴 글만 수정할 수 있어요.'); return; }
          say('저장된 글을 불러왔어요');
          publish.disabled = false;
        })
        .catch((err) => say(err.message));
    } else {
      /* ---- 새 글: 임시 저장본이 있으면 이어 쓰기 ---- */
      const raw = store.get(DRAFT_KEY);
      let draft = null;
      try { draft = raw ? JSON.parse(raw) : null; } catch (e) { draft = null; }
      if (draft && (draft.title || (draft.content && draft.content.replace(/<[^>]*>/g, '').trim()))) {
        fill(draft);
        say('임시 저장된 글을 이어서 써요');
        draftClear.hidden = false;
      } else {
        refresh();
        say('새 글');
      }
    }

    /* ---- 발행 / 수정 완료 ---- */
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = collect();
      const text = editor.innerText.replace(/\s+/g, '');
      if (!data.title) { say('제목을 입력해 주세요.'); title.focus(); return; }
      if (text.length < 10) { say('본문을 10자 이상 써 주세요.'); editor.focus(); return; }
      if (data.category === 'intl' && !/^https?:\/\/\S+$/i.test(data.source_url)) {
        say('해외 번역 글은 원문 주소를 꼭 적어 주세요.');
        sourceUrl.focus();
        return;
      }
      publish.disabled = true;
      say(id ? '수정하는 중…' : '발행하는 중…');
      api(id ? 'PUT' : 'POST', id ? '/api/posts/' + id : '/api/posts', data)
        .then((res) => {
          if (!id) store.del(DRAFT_KEY);
          location.href = 'post.html?id=' + (id || res.id);
        })
        .catch((err) => { publish.disabled = false; say(err.message); });
    });
  }
})();
