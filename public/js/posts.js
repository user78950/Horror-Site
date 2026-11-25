/* =========================================================
   심야 archive — 괴담 글 쓰기·보기·수정·삭제 (posts.js)
   서버의 /api/posts 와 주고받습니다.
     - index.html : "새로 올라온 괴담" 목록
     - post.html  : 글 보기 + 수정·삭제 버튼
     - write.html : 새 글 쓰기 / ?id=번호 로 열면 수정 / ?draft=번호 로 열면 임시 저장 글 이어 쓰기
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

  // 작성자 이름 → 프로필 링크 (회원이 아닌 예전 글은 글자만)
  function authorNode(name, id) {
    if (!id) return document.createTextNode(name);
    const a = document.createElement('a');
    a.className = 'author-link';
    a.href = 'profile.html?id=' + id;
    a.textContent = name;
    return a;
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
      if (p.isBest) meta.append(el('span', 'chip best-chip', 'BEST'));
      meta.append(el('span', 'chip ' + (CATEGORY_CHIP[p.category] || ''), '[' + (CATEGORY[p.category] || '괴담') + ']'));
      if (p.effectsCount) meta.append(el('span', 'chip chip--amber', '연출 ' + p.effectsCount + '개'));
      if (p.warnings.includes('faint')) meta.append(el('span', 'chip', '심약자 주의'));
      const by = el('span', '');
      by.append(authorNode(p.author, p.authorId), ' · ' + timeAgo(p.createdAt));
      meta.append(by);
      const text = el('div', 'post-card__text');
      const h = el('h2', 'post-card__title');
      const a = el('a', '', p.title);
      a.href = 'post.html?id=' + p.id;
      h.append(a);
      text.append(h, el('p', 'post-card__excerpt', p.excerpt));
      const foot = el('div', 'post-card__foot');
      foot.append(el('span', 'shudder-btn', '소름 ' + p.likes.toLocaleString('ko-KR')));
      foot.append(el('span', 'stat', '댓글 ' + p.comments.toLocaleString('ko-KR')));
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

    // 지금 보고 있는 조건: 분류, 정렬(최신순/소름 많은순), 베스트만
    const view = { category: 'all', sort: 'new', best: false };
    const EMPTY = { best: '아직 명예의 전당에 오른 괴담이 없어요. 소름을 눌러 첫 베스트를 뽑아 주세요.', category: '이 분류에는 아직 올라온 괴담이 없어요.', all: '아직 올라온 괴담이 없어요. 첫 번째 이야기를 남겨 주세요.' };

    const load = () => {
      list.setAttribute('aria-busy', 'true');
      const q = new URLSearchParams();
      if (view.category !== 'all') q.set('category', view.category);
      if (view.best) q.set('best', '1');
      else if (view.sort !== 'new') q.set('sort', view.sort);
      api('GET', '/api/posts' + (q.toString() ? '?' + q : ''))
        .then(({ posts }) => {
          list.textContent = '';
          if (!posts.length) list.append(empty(view.best ? EMPTY.best : view.category !== 'all' ? EMPTY.category : EMPTY.all, !view.best));
          else posts.forEach((p) => list.append(card(p)));
        })
        .catch((err) => { list.textContent = ''; list.append(empty(err.message, false)); })
        .then(() => list.removeAttribute('aria-busy'));
    };

    // 분류 탭: 실시간 인기 = 소름 많은순, 명예의 전당 = 베스트만
    const applyTab = (tab) => {
      view.best = tab === 'hof';
      view.category = ['intl', 'real', 'novel', 'film'].includes(tab) ? tab : 'all';
      if (tab === 'hot') setSort('hot');
    };
    const setSort = (sort) => {
      view.sort = sort;
      $$('[data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === sort)));
    };
    $$('[data-tab]').forEach((btn) => btn.addEventListener('click', () => { applyTab(btn.dataset.tab); load(); }));
    $$('[data-sort]').forEach((btn) => btn.addEventListener('click', () => { setSort(btn.dataset.sort); load(); }));
    applyTab(params.get('tab') || 'all');
    load();

    // 맨 위 배너: 베스트 1위 → 없으면 가장 인기 있는 글 → 없으면 최신 글 → 글이 없으면 첫 글 안내
    const hero = $('#home-hero');
    if (hero) {
      (async () => {
        let label = '오늘 밤 명예의 전당 1위';
        let p = null;
        try {
          p = (await api('GET', '/api/posts?best=1')).posts[0] || null;
          if (!p) { label = '지금 가장 소름 돋는 괴담'; p = (await api('GET', '/api/posts?sort=hot')).posts.find((x) => x.likes > 0) || null; }
          if (!p) { label = '방금 올라온 괴담'; p = (await api('GET', '/api/posts')).posts[0] || null; }
        } catch (e) { p = null; }
        hero.textContent = '';
        if (!p) {
          hero.append(el('p', 'home-hero__label', '아직 조용한 밤이에요'));
          hero.append(el('h1', 'home-hero__title', '첫 번째 괴담의 주인공이 되어 주세요'));
          hero.append(el('p', 'home-hero__excerpt', '직접 겪은 이야기도, 지어낸 이야기도 좋아요. 연출을 넣으면 더 오싹해져요.'));
          const go = el('a', 'btn btn--primary btn--lg', '첫 괴담 쓰기');
          go.href = 'write.html';
          hero.append(go);
          return;
        }
        const chips = el('div', 'home-hero__chips');
        chips.append(el('span', 'chip chip--deep', label));
        chips.append(el('span', 'chip ' + (CATEGORY_CHIP[p.category] || ''), CATEGORY[p.category] || '괴담'));
        if (p.effectsCount) chips.append(el('span', 'chip chip--amber', '연출 ' + p.effectsCount + '개'));
        if (p.warnings.includes('faint')) chips.append(el('span', 'chip chip--outline-amber', '심약자 주의'));
        const h = el('h1', 'home-hero__title');
        const a = el('a', '', p.title);
        a.href = 'post.html?id=' + p.id;
        h.append(a);
        const actions = el('div', 'home-hero__actions');
        const read = el('a', 'btn btn--primary btn--lg', '지금 읽기');
        read.href = 'post.html?id=' + p.id;
        actions.append(read, el('span', 'shudder-btn', '소름 ' + p.likes.toLocaleString('ko-KR')),
          el('span', 'stat', '댓글 ' + p.comments.toLocaleString('ko-KR')), el('span', 'stat', '조회 ' + p.views.toLocaleString('ko-KR')));
        const by = el('p', 'muted');
        by.append(authorNode(p.author, p.authorId), ' · ' + timeAgo(p.createdAt));
        hero.append(chips, h, el('p', 'home-hero__excerpt', p.excerpt), by, actions);
      })();
    }

    // 사이드바·푸터의 실제 숫자 (주간 스토리텔러, 시간대별 소름, 오늘 눌린 소름)
    api('GET', '/api/stats/home').then((st) => {
      const today = $('#home-today');
      if (today) today.textContent = st.todayShudders.toLocaleString('ko-KR');

      const tellers = $('#home-tellers');
      if (tellers) {
        tellers.textContent = '';
        if (!st.storytellers.length) tellers.append(el('li', 'muted', '이번 주에는 아직 소름을 받은 작가가 없어요.'));
        st.storytellers.forEach((t, i) => {
          const li = el('li', 'teller-row');
          li.append(el('span', 'rank-num rank-num--lg ' + (i === 0 ? 'rank-num--gold' : 'rank-num--silver'), String(i + 1)));
          const body = el('div', 'rank-row__body');
          body.append(el('p', 'rank-row__title', t.nickname), el('p', 'rank-row__sub', '소름 받은 글 ' + t.posts + '편'));
          li.append(body, el('span', 'rank-row__score', t.likes.toLocaleString('ko-KR') + ' 소름'));
          tellers.append(li);
        });
      }

      const hourly = $('#home-hourly');
      if (hourly) {
        hourly.textContent = '';
        const max = Math.max(...st.hourly);
        if (!max) { hourly.append(el('p', 'muted', '아직 데이터가 쌓이는 중이에요.')); return; }
        const peak = st.hourly.indexOf(max);
        $('#home-peak').textContent = 'PEAK ' + String(peak).padStart(2, '0') + ':00';
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 240 90');
        svg.setAttribute('width', '100%');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', '시간대별 소름 수, 가장 많은 시간은 ' + peak + '시');
        st.hourly.forEach((n, h) => {
          const bh = Math.max(2, Math.round((n / max) * 70));
          const r = document.createElementNS(NS, 'rect');
          r.setAttribute('x', String(h * 10 + 1));
          r.setAttribute('y', String(76 - bh));
          r.setAttribute('width', '8');
          r.setAttribute('height', String(bh));
          r.setAttribute('rx', '2');
          r.setAttribute('fill', h === peak ? '#ff2a4b' : 'rgba(255,42,75,0.35)');
          const title = document.createElementNS(NS, 'title');
          title.textContent = h + '시: 소름 ' + n;
          r.append(title);
          svg.append(r);
        });
        [0, 6, 12, 18].forEach((h) => {
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', String(h * 10 + 1));
          t.setAttribute('y', '88');
          t.setAttribute('font-size', '8');
          t.setAttribute('fill', '#94a3b8');
          t.textContent = String(h).padStart(2, '0') + '시';
          svg.append(t);
        });
        hourly.append(svg);
      }
    }).catch(() => { /* 숫자를 못 불러와도 나머지 화면은 그대로 */ });

    // 사이드바: 진짜 무서운 영화 TOP 5 (영화 순위 API)
    const topBox = $('#home-top-movies');
    if (topBox) {
      api('GET', '/api/movies?limit=5').then(({ movies }) => {
        topBox.textContent = '';
        const rated = movies.filter((m) => m.votes);
        if (!rated.length) { topBox.append(el('li', 'muted', '아직 점수가 매겨진 영화가 없어요.')); return; }
        rated.forEach((m, i) => {
          const li = el('li', 'rank-row' + (i === 0 ? ' rank-row--top' : ''));
          li.append(el('span', 'rank-num' + (i === 0 ? ' rank-num--gold' : i < 3 ? ' rank-num--silver' : ''), String(i + 1)));
          const body = el('div', 'rank-row__body');
          body.append(el('p', 'rank-row__title', m.title + (m.year ? ` (${m.year})` : '')));
          body.append(el('p', 'rank-row__sub', m.votes.toLocaleString('ko-KR') + '명 평가'));
          li.append(body, el('span', 'rank-row__score', m.average.toFixed(1)));
          topBox.append(li);
        });
      }).catch(() => { topBox.textContent = ''; topBox.append(el('li', 'muted', '영화 순위를 불러오지 못했어요.')); });
    }
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
          document.title = post.title + ' · 심야 archive';
          $('#post-title').textContent = post.title;

          const chips = $('#post-chips');
          if (post.isBest) chips.append(el('span', 'chip best-chip', 'BEST · 명예의 전당'));
          chips.append(el('span', 'chip ' + (CATEGORY_CHIP[post.category] || ''), CATEGORY[post.category] || '괴담'));
          post.warnings.forEach((w) => chips.append(el('span', 'chip chip--red', WARNING[w] || w)));
          if (post.effectsCount) chips.append(el('span', 'chip chip--amber', '연출 포함'));
          post.tags.forEach((t) => chips.append(el('span', 'chip', t)));

          const meta = $('#post-meta');
          const by = el('span', '', '작성 ');
          by.append(authorNode(post.author, post.authorId));
          meta.append(by);
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
          // 신고: 내 글이 아닐 때만
          const reportBtn = $('#post-report');
          reportBtn.hidden = post.isMine;
          reportBtn.addEventListener('click', () => window.HorrorReport && HorrorReport.open('post', post.id, '「' + post.title + '」 글을 신고해요.'));

          // 본문은 서버에서 허용한 태그만 남긴 HTML이라 그대로 넣음
          article.innerHTML = post.content;

          // 칠흑 모드 글: 검은 바탕에 제목·글·사진만. 독자는 버튼으로 끌 수 있음
          if (post.display === 'void') {
            document.body.classList.add('void-reading');
            const vt = $('#void-toggle');
            vt.hidden = false;
            vt.addEventListener('click', () => {
              const on = document.body.classList.toggle('void-reading');
              vt.setAttribute('aria-pressed', String(on));
              vt.textContent = on ? '칠흑 모드 켜짐' : '칠흑 모드 꺼짐';
            });
          }

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
          setupReaction(post);
        })
        .catch((err) => fail(err.message));

      // 소름·덤덤
      function setupReaction(post) {
        const likeBtn = $('#react-like');
        const dislikeBtn = $('#react-dislike');
        const note = $('#reaction-note');
        const sub = $('#reaction-sub');
        let state = { likes: post.likes, dislikes: post.dislikes, isBest: post.isBest, myReaction: post.myReaction, bestThreshold: post.bestThreshold };

        const paint = () => {
          $('#like-count').textContent = state.likes.toLocaleString('ko-KR');
          $('#dislike-count').textContent = state.dislikes.toLocaleString('ko-KR');
          likeBtn.setAttribute('aria-pressed', String(state.myReaction === 'like'));
          dislikeBtn.setAttribute('aria-pressed', String(state.myReaction === 'dislike'));
          const left = state.bestThreshold - (state.likes - state.dislikes);
          sub.textContent = state.isBest
            ? '명예의 전당에 오른 괴담이에요'
            : '베스트까지 소름 ' + Math.max(1, left) + '점 남았어요 (소름 − 덤덤 ' + state.bestThreshold + '점 이상)';
        };
        paint();

        if (post.isMine) {
          likeBtn.disabled = true;
          dislikeBtn.disabled = true;
          note.textContent = '내 글에는 반응할 수 없어요. 다른 사람들의 소름을 기다려 보세요.';
          return;
        }

        const send = async (type) => {
          const user = window.HorrorAuth ? await HorrorAuth.ready : null;
          if (!user) { location.href = HorrorAuth.loginUrl(); return; }
          const nextType = state.myReaction === type ? null : type;   // 같은 버튼을 다시 누르면 취소
          likeBtn.disabled = true;
          dislikeBtn.disabled = true;
          note.textContent = '';
          try {
            const res = await api('POST', '/api/posts/' + post.id + '/reaction', { type: nextType });
            const becameBest = res.isBest && !state.isBest;
            state = res;
            paint();
            if (becameBest) note.textContent = '이 괴담이 명예의 전당에 올랐어요!';
          } catch (err) {
            note.textContent = err.message;
          } finally {
            likeBtn.disabled = false;
            dislikeBtn.disabled = false;
          }
        };
        likeBtn.addEventListener('click', () => send('like'));
        dislikeBtn.addEventListener('click', () => send('dislike'));
      }

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

    // 명예의 전당 기준 점수 (실제 설정값)
    api('GET', '/api/stats/home').then((st) => { const t = $('#best-threshold'); if (t) t.textContent = st.bestThreshold; }).catch(() => {});
    categoryGroup.addEventListener('toggle-change', () => { syncSource(); saveDraftSoon(); });
    $('[data-input="display"]').addEventListener('toggle-change', () => saveDraftSoon());

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
      display: form.querySelector('input[name="display"]').value,
      warnings: $$('.check[data-warning][aria-checked="true"]').map((b) => b.dataset.warning),
      tags: window.HorrorEditor ? HorrorEditor.getTags() : []
    });

    const fill = (p) => {
      title.value = p.title || '';
      editor.innerHTML = p.content || '<p><br></p>';
      sourceUrl.value = p.source_url || p.sourceUrl || '';
      setCategory(p.category || 'real');
      const disp = p.display === 'void' ? 'void' : 'normal';
      $$('[data-input="display"] .toggle').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === disp)));
      form.querySelector('input[name="display"]').value = disp;
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

    /* ---- 임시 저장 ----
       1) 서버 임시 글이 없는 새 글: 지금처럼 이 브라우저(localStorage)에만 자동 저장
       2) "임시 저장" 버튼을 누르면 서버에 임시 글이 생기고 주소가 write.html?draft=번호 로 바뀜
          → 그 뒤로는 쓰는 동안 3초마다 서버에 자동 저장 (프로필 "임시 저장" 탭에서 이어 쓰기) */
    const draftSave = $('#draft-save');
    const BLANK = { category: 'real', warnings: ['faint'], tags: [], title: '', content: '<p><br></p>' };
    const clock = () => new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    let draftId = !id && /^\d+$/.test(params.get('draft') || '') ? Number(params.get('draft')) : null;
    let draftTimer = null;
    let serverTimer = null;
    let dirty = false;        // 서버에 아직 안 보낸 고친 내용이 있는지
    let saving = null;        // 지금 보내는 중인 저장 요청 (겹치지 않게 하나씩)
    let creating = false;     // "임시 저장" 버튼으로 새로 만드는 중
    let loading = !!draftId;  // 서버 임시 글을 불러오는 중에는 저장하지 않음
    let leaving = false;      // 발행 후 페이지를 떠나는 중

    function saveServerSoon() {
      clearTimeout(serverTimer);
      serverTimer = setTimeout(flushServer, 3000);
    }

    function flushServer() {
      clearTimeout(serverTimer);
      if (!draftId || !dirty) return Promise.resolve();
      if (saving) return saving.then(flushServer);
      dirty = false;
      say('저장하는 중…');
      saving = api('PUT', '/api/drafts/' + draftId, collect())
        .then(() => say('서버에 임시 저장됨 (' + clock() + ')'))
        .catch((err) => { dirty = true; say('임시 저장 실패: ' + err.message); })
        .finally(() => { saving = null; });
      return saving;
    }

    function saveDraftSoon() {
      if (id || loading) return;
      if (draftId || creating) {
        dirty = true;
        if (draftId) saveServerSoon();
        return;
      }
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => {
        store.set(DRAFT_KEY, JSON.stringify(collect()));
        say('이 브라우저에 임시 저장됨 (' + clock() + ')');
        draftClear.hidden = false;
      }, 800);
    }
    [title, sourceUrl].forEach((input) => input.addEventListener('input', saveDraftSoon));
    editor.addEventListener('input', saveDraftSoon);
    form.addEventListener('click', (e) => { if (e.target.closest('.check, .tag button')) saveDraftSoon(); });
    $('#tag-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') saveDraftSoon(); });

    const showServerDraft = () => {
      draftClear.textContent = '임시 글 삭제';
      draftClear.hidden = false;
    };

    // "임시 저장" 버튼: 처음이면 서버에 새로 만들고, 이미 있으면 바로 저장
    draftSave.addEventListener('click', () => {
      if (draftId) { dirty = true; flushServer(); return; }
      if (creating) return;
      creating = true;
      dirty = false;
      draftSave.disabled = true;
      clearTimeout(draftTimer);
      say('임시 저장하는 중…');
      api('POST', '/api/drafts', collect())
        .then((res) => {
          draftId = res.id;
          history.replaceState(null, '', 'write.html?draft=' + draftId);
          store.del(DRAFT_KEY);
          showServerDraft();
          say('서버에 임시 저장됨 (' + clock() + ') · 이제 쓰는 동안 자동으로 저장돼요');
          if (dirty) saveServerSoon();   // 저장하는 사이에 더 쓴 내용
        })
        .catch((err) => say(err.message))
        .finally(() => { creating = false; draftSave.disabled = false; });
    });

    // 다른 탭으로 가거나 창을 내리면 바로 한 번 저장
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushServer(); });
    // 서버에 아직 못 보낸 내용이 있으면 나가기 전에 한 번 물어봄
    window.addEventListener('beforeunload', (e) => {
      if (!leaving && draftId && (dirty || saving)) { flushServer(); e.preventDefault(); e.returnValue = ''; }
    });

    draftClear.addEventListener('click', () => {
      if (draftId) {
        if (!confirm('이 임시 글을 지울까요? 지우면 되돌릴 수 없어요.')) return;
        clearTimeout(serverTimer);
        dirty = false;
        api('DELETE', '/api/drafts/' + draftId)
          .then(() => {
            draftId = null;
            history.replaceState(null, '', 'write.html');
            fill(BLANK);
            draftClear.textContent = '임시 글 지우기';
            draftClear.hidden = true;
            say('임시 글을 지웠어요');
          })
          .catch((err) => say(err.message));
        return;
      }
      if (!confirm('임시 저장된 글을 지우고 빈 화면에서 새로 쓸까요?')) return;
      store.del(DRAFT_KEY);
      fill(BLANK);
      draftClear.hidden = true;
      say('새 글');
    });

    if (id) draftSave.hidden = true;   // 이미 발행한 글을 고칠 때는 임시 저장 없음

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
    } else if (draftId) {
      /* ---- 서버 임시 글 이어 쓰기 (프로필 "임시 저장" 탭에서 들어옴) ---- */
      say('불러오는 중…');
      api('GET', '/api/drafts/' + draftId)
        .then(({ draft }) => {
          fill(draft);
          loading = false;
          showServerDraft();
          say('임시 저장된 글을 불러왔어요 · 쓰는 동안 자동으로 저장돼요');
        })
        .catch((err) => {
          // 불러오지 못했으면 빈 내용으로 서버 글을 덮어쓰지 않도록 서버 저장을 끔
          draftId = null;
          draftSave.disabled = true;
          publish.disabled = true;
          say(err.message);
        });
    } else {
      /* ---- 새 글: 이 브라우저에 임시 저장본이 있으면 이어 쓰기 ---- */
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
      if (draftId) data.draft_id = draftId;   // 발행하면 서버가 이 임시 글을 지움
      publish.disabled = true;
      clearTimeout(serverTimer);
      say(id ? '수정하는 중…' : '발행하는 중…');
      api(id ? 'PUT' : 'POST', id ? '/api/posts/' + id : '/api/posts', data)
        .then((res) => {
          if (!id) store.del(DRAFT_KEY);
          leaving = true;
          location.href = 'post.html?id=' + (id || res.id);
        })
        .catch((err) => {
          publish.disabled = false;
          say(err.message);
          if (draftId && dirty) saveServerSoon();   // 발행에 실패하면 멈췄던 자동 저장을 다시
        });
    });
  }
})();
