/* =========================================================
   무서운 게 딱좋아! — 화면 동작 스크립트 (Vanilla JS)
   한 파일을 네 페이지가 함께 씁니다. 각 기능은 해당 요소가
   있는 페이지에서만 실행됩니다.
   ========================================================= */

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const formatNumber = (n) => n.toLocaleString('ko-KR');

  /* ---------- 공통: 하나만 고르는 버튼 묶음 (탭, 정렬, 카테고리) ----------
     <div data-toggle-group="pressed|selected"> 안의 .toggle 버튼 중
     누른 것만 켜집니다. data-input="이름"이 있으면 같은 이름의 hidden
     input 값도 바꿉니다. */
  $$('[data-toggle-group]').forEach((group) => {
    const attr = group.dataset.toggleGroup === 'selected' ? 'aria-selected' : 'aria-pressed';
    const buttons = $$('.toggle', group);
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.setAttribute(attr, String(b === btn)));
        if (group.dataset.input) {
          const input = document.querySelector(`input[name="${group.dataset.input}"]`);
          if (input) input.value = btn.dataset.value || '';
        }
        group.dispatchEvent(new CustomEvent('toggle-change', { detail: btn }));
      });
    });
  });

  /* ---------- 공통: 소름 버튼 (누르면 +1, 다시 누르면 취소) ---------- */
  function bindShudder(btn) {
    const base = Number(btn.dataset.count || 0);
    const label = $('[data-count-label]', btn);
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      if (label) label.textContent = formatNumber(base + (on ? 1 : 0));
      // TODO(백엔드 연결): fetch(`/api/posts/${id}/reactions`, { method: 'POST', body: JSON.stringify({ type: 'like' }) })
    });
  }
  $$('[data-shudder]').forEach(bindShudder);

  // 검색 기능
  
  const SearchMovies = movies.include(keyword);


  /* ---------- 공통: 스크랩 아이콘 ---------- */
  $$('[data-scrap]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      const path = $('path', btn);
      if (path) path.setAttribute('fill', on ? '#ff2a4b' : 'none');
      const svg = $('svg', btn);
      if (svg) svg.setAttribute('stroke', on ? '#ff2a4b' : '#94a3b8');
    });
  });
  $$('[data-scrap-text]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? '보관됨' : '보관';
    });
  });

  /* =========================================================
     메인 홈 피드 (index.html)
     ========================================================= */

  // 주소의 ?tab= 값으로 탭 선택 (헤더 메뉴에서 넘어올 때)
  const tabParam = new URLSearchParams(location.search).get('tab');
  if (tabParam) {
    const tab = $(`[data-tab="${tabParam}"]`);
    if (tab) tab.click();
  }

  // 실시간 심야 톡: 입력하면 목록 맨 위에 추가
  const talkForm = $('#talk-form');
  if (talkForm) {
    talkForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#talk-input');
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      const item = document.createElement('div');
      item.className = 'talk-item';
      item.innerHTML = '<p class="talk-item__head"><span class="talk-item__name"></span><span class="muted">방금 전</span></p><p class="talk-item__text"></p>';
      $('.talk-item__name', item).textContent = '심야괴담러 (나)';
      $('.talk-item__text', item).textContent = text;   // textContent로 넣어 HTML 주입을 막습니다
      $('#talk-list').prepend(item);
      input.value = '';
    });
  }

  /* =========================================================
     괴담 상세 뷰어 (story.html)
     ========================================================= */

  // 불 끄기 집중 모드
  const dimToggle = $('#dim-toggle');
  if (dimToggle) {
    dimToggle.addEventListener('click', () => {
      const on = !document.body.classList.contains('is-dim');
      document.body.classList.toggle('is-dim', on);
      dimToggle.setAttribute('aria-pressed', String(on));
      $('[data-label]', dimToggle).textContent = on ? '불 켜기' : '불 끄기 (집중 모드)';
    });
  }

  // 글자 크기 조절 (14px ~ 22px)
  const article = $('#article');
  const sizeValue = $('#size-value');
  if (article && sizeValue) {
    let size = 17;
    const apply = () => {
      article.style.setProperty('--reader-size', size + 'px');
      sizeValue.textContent = size + 'px';
    };
    $('#size-down').addEventListener('click', () => { size = Math.max(14, size - 1); apply(); });
    $('#size-up').addEventListener('click', () => { size = Math.min(22, size + 1); apply(); });
  }

  // 증거 사진 블러 해제
  $$('[data-reveal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.closest('.evidence').classList.add('is-revealed');
    });
  });

  // 배경 앰비언스: effects.js가 합성한 낮은 울림을 재생 (외부 음원 없음)
  const ambienceBtn = $('#ambience-btn');
  if (ambienceBtn && window.HorrorFX) {
    ambienceBtn.addEventListener('click', () => {
      const on = ambienceBtn.getAttribute('aria-pressed') !== 'true';
      if (on) {
        if (!HorrorFX.isSoundOn()) HorrorFX.enableSound();   // 이 클릭이 소리 허용 역할
        HorrorFX.startDrone();
      } else {
        HorrorFX.stopDrone();
      }
      ambienceBtn.setAttribute('aria-pressed', String(on));
      ambienceBtn.setAttribute('aria-label', on ? '배경 앰비언스 일시정지' : '배경 앰비언스 재생');
    });
  }

  // 큰 소름 버튼
  const shudderBig = $('#shudder-big');
  if (shudderBig) bindShudder(shudderBig);

  // 번역가 구독
  const subBtn = $('#sub-btn');
  if (subBtn) {
    subBtn.addEventListener('click', () => {
      const on = subBtn.getAttribute('aria-pressed') !== 'true';
      subBtn.setAttribute('aria-pressed', String(on));
      subBtn.textContent = on ? '구독 중' : '+ 번역가 구독';
    });
  }

  // 공유: 주소 복사
  const shareBtn = $('#share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        shareBtn.textContent = '링크 복사됨';
      } catch (err) {
        shareBtn.textContent = '복사 실패';
      }
      setTimeout(() => { shareBtn.textContent = '공유'; }, 1800);
    });
  }

  // 사이드바 시계 (한국 시간)
  const clock = $('#clock');
  if (clock) {
    const tick = () => {
      clock.textContent = new Date().toLocaleTimeString('ko-KR', { hour12: false, timeZone: 'Asia/Seoul' });
    };
    tick();
    setInterval(tick, 1000);
  }

  // 댓글 남기기
  const commentForm = $('#comment-form');
  if (commentForm) {
    commentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#comment-input');
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      const anon = $('#comment-anon').checked;
      const el = document.createElement('div');
      el.className = 'comment';
      el.innerHTML = '<p class="comment__head"><span class="comment__name"></span><span class="muted">방금 전</span><span class="comment__score">0 소름</span></p><p class="comment__text"></p><p class="comment__foot">답글 0개 · 공감 소름 +1</p>';
      $('.comment__name', el).textContent = anon ? '익명의 심야 독자' : '심야괴담러';
      $('.comment__text', el).textContent = text;
      $('#comment-list').prepend(el);
      const count = $('#comment-count');
      count.textContent = formatNumber(Number(count.textContent.replace(/,/g, '')) + 1);
      input.value = '';
      // TODO(백엔드 연결): fetch(`/api/posts/${id}/comments`, { method: 'POST', ... })
    });
  }

  /* =========================================================
     괴담 작성 에디터 (write.html)
     ========================================================= */

  // 트리거 경고 체크
  $$('.check[role="checkbox"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.setAttribute('aria-checked', String(btn.getAttribute('aria-checked') !== 'true'));
    });
  });

  // 제목 글자 수
  const titleInput = $('#title');
  if (titleInput) {
    const titleCount = $('#title-count');
    const update = () => { titleCount.textContent = titleInput.value.length; };
    titleInput.addEventListener('input', update);
    update();
  }

  // 본문 글자 수와 예상 완독 시간 (1분에 약 400자 기준)
  const editor = $('#editor');
  if (editor) {
    const charCount = $('#char-count');
    const readTime = $('#read-time');
    const update = () => {
      const text = editor.innerText.replace(/\s+/g, '');
      const n = text.length;
      charCount.textContent = formatNumber(n);
      const sec = Math.max(10, Math.round((n / 400) * 60));
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      readTime.textContent = '약 ' + (m ? m + '분 ' : '') + (s ? s + '초' : '');
    };
    editor.addEventListener('input', update);
    update();

    // 서식 버튼 (브라우저 기본 편집 명령 사용)
    $$('[data-cmd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editor.focus();
        document.execCommand(btn.dataset.cmd, false, btn.dataset.arg || null);
        update();
      });
    });

    // 블러 가림: 선택한 글자를 스포일러로 감싸기
    const spoilerBtn = $('[data-spoiler]');
    if (spoilerBtn) {
      spoilerBtn.addEventListener('click', () => {
        const sel = window.getSelection();
        if (!sel.rangeCount || sel.isCollapsed || !editor.contains(sel.anchorNode)) return;
        const span = document.createElement('span');
        span.className = 'spoiler';
        span.tabIndex = 0;
        span.title = '스포일러 블러 (마우스를 올리면 보임)';
        try { sel.getRangeAt(0).surroundContents(span); } catch (err) { /* 여러 문단에 걸친 선택은 건너뜀 */ }
      });
    }

    // 첨부 삭제
    $$('[data-remove-attach]').forEach((btn) => {
      btn.addEventListener('click', () => { btn.closest('.attach').remove(); update(); });
    });
  }

  // 연출 넣기 (effects.js의 연출 목록 사용)
  const fxMenu = $('#fx-menu');
  if (editor && fxMenu && window.HorrorFX) {
    document.body.classList.add('fx-on');          // 에디터 미리보기용
    const FX = window.HorrorFX;
    const grid = $('#fx-menu-grid');
    const msg = $('#fx-menu-msg');
    const menuBtn = $('#fx-menu-btn');
    const fxCount = $('#fx-count');
    let lastBlock = null;

    if (FX.SETTINGS.paidUnlocked) {
      $('.fx-menu__hint', fxMenu).append(' 지금은 베타 기간이라 유료 연출도 무료로 쓸 수 있어요.');
    }

    // 커서가 있는 본문 문단(편집 영역의 바로 아래 자식) 찾기
    const currentBlock = () => {
      const sel = window.getSelection();
      let node = sel && sel.rangeCount ? sel.anchorNode : null;
      if (!node || !editor.contains(node)) return lastBlock && editor.contains(lastBlock) ? lastBlock : null;
      while (node && node.parentNode !== editor) node = node.parentNode;
      return node && node.nodeType === 1 && !node.matches('.attach, hr') ? node : null;
    };
    const remember = () => { const b = currentBlock(); if (b) lastBlock = b; };
    editor.addEventListener('keyup', remember);
    editor.addEventListener('mouseup', remember);

    const updateCount = () => {
      const blocks = $$('[data-fx]', editor);
      const paid = blocks.filter((b) => b.dataset.fxTier === 'paid').length;
      fxCount.textContent = blocks.length + '개' + (blocks.length ? ` (무료 ${blocks.length - paid} · 유료 ${paid})` : '');
    };

    const say = (text) => { msg.textContent = text; };

    // 메뉴 항목 만들기 (직접 넣은 효과음 파일을 불러오면 다시 그림)
    const renderMenu = () => {
    grid.textContent = '';
    FX.CATALOG.forEach((fx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fx-menu__item';
      const paidNote = fx.tier === 'paid' ? '유료' : '무료';
      btn.innerHTML = '<span class="fx-menu__name"></span><span class="fx-menu__desc"></span>';
      const name = $('.fx-menu__name', btn);
      name.textContent = fx.name;
      const chip = document.createElement('span');
      chip.className = 'chip ' + (fx.tier === 'paid' ? 'chip--red' : '');
      chip.textContent = paidNote;
      name.append(chip);
      $('.fx-menu__desc', btn).textContent = fx.desc;
      btn.addEventListener('mousedown', (e) => e.preventDefault());   // 본문 커서를 잃지 않게
      btn.addEventListener('click', () => {
        const block = currentBlock();
        if (!block) { say('먼저 본문에서 연출을 넣을 문단을 클릭해 주세요.'); return; }
        if (fx.tier === 'paid' && !FX.SETTINGS.paidUnlocked) {
          say('유료 연출이에요. 결제 기능이 준비되면 사용할 수 있어요.');
          // TODO(수익화): 결제 화면으로 이동
          return;
        }
        block.dataset.fx = fx.id;
        block.dataset.fxTier = fx.tier;
        block.dataset.fxLabel = fx.name + ' · ' + (fx.tier === 'paid' ? '유료' : '무료');
        lastBlock = block;
        if (fx.sound && !FX.isSoundOn()) FX.enableSound();             // 이 클릭이 소리 허용 역할
        FX.preview(fx.id, block);
        updateCount();
        say(`“${fx.name}”을 넣었어요.`);
      });
      grid.append(btn);
    });
    };
    renderMenu();
    document.addEventListener('horrorfx:sounds-loaded', renderMenu);

    menuBtn.addEventListener('mousedown', (e) => e.preventDefault());
    menuBtn.addEventListener('click', () => {
      const open = fxMenu.hidden;
      fxMenu.hidden = !open;
      menuBtn.setAttribute('aria-expanded', String(open));
    });

    $('#fx-remove').addEventListener('mousedown', (e) => e.preventDefault());
    $('#fx-remove').addEventListener('click', () => {
      const block = currentBlock();
      if (!block || !block.dataset.fx) { say('연출이 붙은 문단을 먼저 클릭해 주세요.'); return; }
      delete block.dataset.fx; delete block.dataset.fxTier; delete block.dataset.fxLabel;
      updateCount();
      say('연출을 뺐어요.');
    });

    $('#fx-preview').addEventListener('mousedown', (e) => e.preventDefault());
    $('#fx-preview').addEventListener('click', () => {
      const block = currentBlock();
      if (!block || !block.dataset.fx) { say('연출이 붙은 문단을 먼저 클릭해 주세요.'); return; }
      const fx = FX.byId(block.dataset.fx);
      if (fx && fx.sound && !FX.isSoundOn()) FX.enableSound();
      FX.preview(block.dataset.fx, block);
    });

    // Enter로 새 문단을 만들면 브라우저가 연출 속성까지 복사하므로 새 문단에서는 지움
    let splitting = false;
    editor.addEventListener('keydown', (e) => { splitting = e.key === 'Enter' && !e.shiftKey; });
    editor.addEventListener('input', () => {
      if (!splitting) return;
      splitting = false;
      const block = currentBlock();
      const prev = block && block.previousElementSibling;
      if (block && prev && block.dataset.fx && prev.dataset.fx === block.dataset.fx) {
        delete block.dataset.fx; delete block.dataset.fxTier; delete block.dataset.fxLabel;
        updateCount();
      }
    });

    updateCount();
  }

  // 공포 태그 (최대 5개)
  const tagBox = $('#tag-box');
  if (tagBox) {
    const tagInput = $('#tag-input');
    const tags = () => $$('.tag', tagBox);
    const addTag = (raw) => {
      let value = raw.trim().replace(/\s+/g, '');
      if (!value) return;
      if (!value.startsWith('#')) value = '#' + value;
      if (tags().length >= 5 || tags().some((t) => t.firstChild.textContent === value)) return;
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.append(value);
      const x = document.createElement('button');
      x.type = 'button';
      x.textContent = '×';
      x.setAttribute('aria-label', value + ' 태그 삭제');
      tag.append(x);
      tagBox.insertBefore(tag, tagInput);
    };
    tagBox.addEventListener('click', (e) => {
      if (e.target.matches('.tag button')) e.target.closest('.tag').remove();
    });
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        tagInput.value.split(',').forEach(addTag);
        tagInput.value = '';
      } else if (e.key === 'Backspace' && !tagInput.value && tags().length) {
        tags().pop().remove();
      }
    });
  }

  // 썸네일 선택 시 파일 이름 표시
  const thumbInput = $('#thumb-input');
  if (thumbInput) {
    thumbInput.addEventListener('change', () => {
      const file = thumbInput.files[0];
      $('#thumb-label').textContent = file ? file.name : '클릭하여 이미지 교체';
    });
  }

  // 발행하기: 지금은 입력값을 모아 콘솔에 보여 줍니다
  const writeForm = $('#write-form');
  if (writeForm) {
    writeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = $('#title').value.trim();
      const status = $('#save-status');
      if (!title) {
        status.textContent = '제목을 입력해야 발행할 수 있습니다';
        $('#title').focus();
        return;
      }
      const post = {
        category: writeForm.querySelector('input[name="category"]').value,
        title,
        content: $('#editor').innerHTML,
        warnings: $$('.check[aria-checked="true"]').map((b) => b.dataset.warning),
        effects: $$('#editor [data-fx]').map((b) => ({ type: b.dataset.fx, tier: b.dataset.fxTier })),   // 연출 사용 통계용
        tags: $$('#tag-box .tag').map((t) => t.firstChild.textContent)
      };
      console.log('발행할 글', post);
      status.textContent = '발행 준비 완료 (서버 연결 후 실제로 저장됩니다)';
      // TODO(백엔드 연결):
      // fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(post) })
      //   .then((r) => r.json()).then((saved) => { location.href = `story.html?id=${saved.id}`; });
    });
  }

  /* =========================================================
     공포영화 랭킹 & 투표 (movies.html)
     ========================================================= */

  // 영화별 소름 투표
  $$('[data-vote]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? '소름 투표 완료' : '소름 투표';
    });
  });

  // 실시간 긴급 투표
  const poll = $('#poll');
  if (poll) {
    const options = $$('.poll-option', poll);
    const submit = $('#poll-submit');
    let done = false;
    options.forEach((opt) => {
      opt.addEventListener('click', () => {
        if (done) return;
        options.forEach((o) => o.setAttribute('aria-checked', String(o === opt)));
        submit.disabled = false;
        submit.classList.replace('btn--ghost', 'btn--primary');
      });
    });
    submit.addEventListener('click', () => {
      if (done) return;
      done = true;
      options.forEach((o) => {
        $('.poll-option__fill', o).style.width = o.dataset.pct + '%';
        $('.poll-option__pct', o).textContent = o.dataset.pct + '%';
      });
      submit.textContent = '투표 완료 · 결과 공개됨';
      submit.disabled = true;
    });
  }

  // 오늘 밤 맞춤 영화 찾기
  const matchBtn = $('#match-btn');
  if (matchBtn) {
    const recs = {
      occult: [['컨저링', '정통 하우스 호러. 무섭지만 잠은 잘 수 있는 수준.'], ['유전', '엔딩 이후 며칠간 천장 구석을 못 볼 수 있습니다.']],
      psych: [['곡성', '누구를 믿어야 할지 끝까지 흔들리는 미스터리.'], ['랑종', '페이크 다큐 특유의 현실감이 후반부에 무너집니다.']],
      folk: [['미드소마', '대낮의 햇살 아래 펼쳐지는 기묘한 축제 의식.'], ['주', '저주가 관객에게 옮아오는 민속 공포. 혼자 보지 마십시오.']]
    };
    const result = $('#match-result');
    const hide = () => { result.hidden = true; };
    $('#mood-group').addEventListener('toggle-change', hide);
    $('#tolerance').addEventListener('input', hide);
    matchBtn.addEventListener('click', () => {
      const mood = $('#mood-group [aria-pressed="true"]').dataset.mood;
      const heavy = Number($('#tolerance').value) >= 50;
      const [title, note] = recs[mood][heavy ? 1 : 0];
      $('#match-title').textContent = title;
      $('#match-note').textContent = note;
      result.hidden = false;
    });
  }
})();
