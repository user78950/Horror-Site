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
     괴담 상세 뷰어 (예전 데모 화면용, 해당 요소가 없으면 실행되지 않음)
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
    document.addEventListener('editor:refresh', update);   // 수정할 글을 불러온 뒤
    update();
  }

  /* =========================================================
     작성 에디터 (write.html)
     ========================================================= */
  const editor = $('#editor');
  if (editor) {
    const charCount = $('#char-count');
    const readTime = $('#read-time');
    const formatMsg = $('#format-msg');
    let msgTimer = null;

    // 툴바 버튼을 눌렀을 때 결과나 해야 할 일을 알려 주는 한 줄
    const tell = (text) => {
      if (!formatMsg) return;
      formatMsg.textContent = text;
      formatMsg.hidden = !text;
      clearTimeout(msgTimer);
      if (text) msgTimer = setTimeout(() => { formatMsg.hidden = true; }, 5000);
    };

    // Enter를 누르면 div 대신 p 문단이 생기게
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* 지원 안 하는 브라우저 */ }

    // 본문 바로 아래에 문단 없이 떠 있는 글자(전체 삭제 후 등)를 p 문단으로 감쌈
    const ensureBlocks = () => {
      const loose = [];
      Array.from(editor.childNodes).forEach((n) => {
        const inline = n.nodeType === 3 ? n.textContent.trim() !== '' : (n.nodeType === 1 && /^(B|STRONG|I|EM|S|STRIKE|SPAN|BR|A|U)$/.test(n.tagName));
        if (inline) loose.push(n);
        else if (loose.length) { wrap(loose.splice(0)); }
      });
      if (loose.length) wrap(loose);
      if (!editor.firstElementChild) editor.innerHTML = '<p><br></p>';
      function wrap(nodes) {
        const p = document.createElement('p');
        nodes[0].parentNode.insertBefore(p, nodes[0]);
        nodes.forEach((n) => p.append(n));
      }
    };

    const update = () => {
      const text = editor.innerText.replace(/\s+/g, '');
      const n = text.length;
      charCount.textContent = formatNumber(n);
      const sec = Math.max(10, Math.round((n / 400) * 60));
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      readTime.textContent = '약 ' + (m ? m + '분 ' : '') + (s ? s + '초' : '');
      editor.classList.toggle('is-empty', n === 0 && !editor.querySelector('img, hr'));   // 빈 본문 안내 문구
    };
    editor.addEventListener('input', () => { ensureBlocks(); update(); });
    document.addEventListener('editor:refresh', update);
    update();

    // 커서가 있는 문단(본문 바로 아래 블록) 찾기. 툴바를 누르는 순간 커서가 사라져도 마지막 위치를 기억
    let lastBlock = null;
    const currentBlock = () => {
      ensureBlocks();
      const sel = window.getSelection();
      let node = sel && sel.rangeCount ? sel.anchorNode : null;
      if (!node || !editor.contains(node) || node === editor) {
        return lastBlock && editor.contains(lastBlock) ? lastBlock : null;
      }
      while (node && node.parentNode !== editor) node = node.parentNode;
      return node && node.nodeType === 1 && node.tagName !== 'HR' ? node : null;
    };
    const remember = () => { const b = currentBlock(); if (b) lastBlock = b; };
    editor.addEventListener('keyup', remember);
    editor.addEventListener('mouseup', remember);
    editor.addEventListener('focus', remember);

    // 커서를 블록 끝으로
    const caretTo = (el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      lastBlock = el;
    };
    // 지금 문단 바로 뒤에 새 블록 넣기 (커서가 없으면 맨 끝)
    const insertAfterCurrent = (node) => {
      const block = currentBlock();
      if (block) block.after(node); else editor.append(node);
      return node;
    };
    const newParagraphAfter = (node) => {
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      node.after(p);
      return p;
    };

    // 모든 툴바 버튼: 누를 때 본문 커서·선택을 잃지 않게
    $$('.format-bar button').forEach((btn) => btn.addEventListener('mousedown', (e) => e.preventDefault()));

    // B, I, S, H1, H2 (브라우저 기본 편집 명령)
    $$('[data-cmd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editor.focus();
        document.execCommand(btn.dataset.cmd, false, btn.dataset.arg || null);
        update();
      });
    });

    // 오컬트 실선: 지금 문단 아래에 구분선, 그 아래에서 이어 쓰기
    const lineBtn = $('#tool-line');
    if (lineBtn) {
      lineBtn.addEventListener('click', () => {
        const hr = insertAfterCurrent(document.createElement('hr'));
        editor.focus();
        caretTo(newParagraphAfter(hr));
        update();
        tell('구분선을 넣었어요. 아래에서 이어 쓰면 돼요.');
      });
    }

    // 블러 가림: 드래그로 고른 글자를 가림. 이미 가린 글자 안에서 누르면 가림 해제
    const spoilerBtn = $('#tool-spoiler');
    if (spoilerBtn) {
      spoilerBtn.addEventListener('click', () => {
        const sel = window.getSelection();
        const inEditor = sel.rangeCount && editor.contains(sel.anchorNode);
        const anchorEl = inEditor ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement) : null;
        const existing = anchorEl && anchorEl.closest('.spoiler');
        if (existing && editor.contains(existing)) {
          existing.replaceWith(...existing.childNodes);
          tell('블러 가림을 풀었어요.');
          return;
        }
        if (!inEditor || sel.isCollapsed) {
          tell('가릴 글자를 먼저 마우스로 드래그해서 선택한 뒤 눌러 주세요.');
          return;
        }
        const span = document.createElement('span');
        span.className = 'spoiler';
        span.tabIndex = 0;
        span.title = '스포일러 블러 (마우스를 올리면 보임)';
        try {
          sel.getRangeAt(0).surroundContents(span);
          tell('선택한 글자를 가렸어요. 독자는 마우스를 올리거나 눌러야 볼 수 있어요.');
        } catch (err) {
          tell('한 문단 안의 글자만 가릴 수 있어요. 여러 문단에 걸쳐 선택했다면 문단마다 따로 가려 주세요.');
        }
      });
    }

    // 증거 사진: 사진을 골라 서버에 올리고 지금 문단 아래에 넣기
    const photoBtn = $('#tool-photo');
    const photoInput = $('#photo-input');
    if (photoBtn && photoInput) {
      photoBtn.addEventListener('click', () => { remember(); photoInput.click(); });
      photoInput.addEventListener('change', async () => {
        const file = photoInput.files[0];
        photoInput.value = '';
        if (!file) return;
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { tell('JPG, PNG, WEBP 사진만 올릴 수 있어요.'); return; }
        if (file.size > 15 * 1024 * 1024) { tell('사진이 너무 커요. 15MB 이하로 골라 주세요.'); return; }
        photoBtn.disabled = true;
        tell('사진을 올리는 중…');
        try {
          const data = await shrinkImage(file);            // 크기 줄이기 + 촬영 위치 등 숨은 정보 제거
          const res = await fetch('/api/uploads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data })
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json.error || '사진을 올리지 못했어요.');
          const blur = confirm('이 사진을 처음엔 흐리게 가려 둘까요?\n(독자가 "사진 보기"를 눌러야 선명하게 보여요)');
          const fig = document.createElement('figure');
          fig.className = 'evidence-photo';
          if (blur) fig.dataset.blur = '1';
          const img = document.createElement('img');
          img.src = json.url;
          img.alt = '증거 사진';
          const cap = document.createElement('figcaption');
          cap.textContent = '사진 설명을 적어 주세요';
          fig.append(img, cap);
          insertAfterCurrent(fig);
          editor.focus();
          caretTo(newParagraphAfter(fig));
          update();
          tell('사진을 넣었어요. 사진 아래 설명 글자를 눌러 고칠 수 있고, 지우려면 사진을 누른 뒤 Delete 키를 누르세요.');
        } catch (err) {
          tell(err.message && !/Failed to fetch/.test(err.message) ? err.message : '서버에 연결하지 못했어요. npm start로 서버가 켜져 있는지 확인해 주세요.');
        } finally {
          photoBtn.disabled = false;
        }
      });
    }

    // 사진을 가로 최대 1600px JPG로 다시 그림 → 용량이 줄고, 휴대폰 사진의 촬영 위치(GPS) 같은 숨은 정보가 사라짐
    function shrinkImage(file) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.round(img.naturalWidth * scale);
          const h = Math.round(img.naturalHeight * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const c2d = canvas.getContext('2d');
          c2d.fillStyle = '#000';
          c2d.fillRect(0, 0, w, h);
          c2d.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했어요. 다른 사진으로 시도해 주세요.')); };
        img.src = url;
      });
    }

    /* ---------- 연출 넣기 / 공포 사운드 ---------- */
    const fxMenu = $('#fx-menu');
    const menuBtn = $('#fx-menu-btn');
    const soundBtn = $('#tool-sound');
    const FX = window.HorrorFX;
    const grid = $('#fx-menu-grid');
    const msg = $('#fx-menu-msg');
    const menuTitle = $('#fx-menu-title');
    const showAll = $('#fx-show-all');
    const fxCount = $('#fx-count');
    let filter = 'all';

    const say = (text) => { if (msg) msg.textContent = text; };

    const isSound = (fx) => fx.id === 'knock' || fx.id === 'scream' || fx.id.startsWith('snd-');

    const updateCount = () => {
      if (!fxCount) return;
      const blocks = $$('[data-fx]', editor);
      const paid = blocks.filter((b) => b.dataset.fxTier === 'paid').length;
      fxCount.textContent = blocks.length + '개' + (blocks.length ? ` (무료 ${blocks.length - paid} · 유료 ${paid})` : '');
    };

    const applyFx = (fx) => {
      const block = currentBlock();
      if (!block) { say('먼저 본문에서 연출을 넣을 문단을 클릭해 주세요.'); return; }
      if (fx.tier === 'paid' && !FX.SETTINGS.paidUnlocked) {
        say('유료 연출이에요. 결제 기능이 준비되면 사용할 수 있어요.');   // TODO(수익화): 결제 화면으로
        return;
      }
      block.dataset.fx = fx.id;
      block.dataset.fxTier = fx.tier;
      block.dataset.fxLabel = fx.name + ' · ' + (fx.tier === 'paid' ? '유료' : '무료');
      lastBlock = block;
      if (fx.sound && !FX.isSoundOn()) FX.enableSound();             // 이 클릭이 소리 허용 역할
      FX.preview(fx.id, block);
      updateCount();
      say(`“${fx.name}”을 넣었어요. 독자가 이 문단까지 스크롤하면 재생돼요.`);
    };

    // 메뉴 항목 만들기 (직접 넣은 효과음 파일을 불러오면 다시 그림)
    const renderMenu = () => {
      if (!FX || !grid) return;
      grid.textContent = '';
      FX.CATALOG.filter((fx) => filter === 'all' || isSound(fx)).forEach((fx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fx-menu__item';
        btn.innerHTML = '<span class="fx-menu__name"></span><span class="fx-menu__desc"></span>';
        const name = $('.fx-menu__name', btn);
        name.textContent = fx.name;
        const chip = document.createElement('span');
        chip.className = 'chip ' + (fx.tier === 'paid' ? 'chip--red' : '');
        chip.textContent = fx.tier === 'paid' ? '유료' : '무료';
        name.append(chip);
        $('.fx-menu__desc', btn).textContent = fx.desc;
        btn.addEventListener('mousedown', (e) => e.preventDefault());   // 본문 커서를 잃지 않게
        btn.addEventListener('click', () => applyFx(fx));
        grid.append(btn);
      });
      if (menuTitle) menuTitle.textContent = filter === 'all' ? '연출 고르기' : '효과음 고르기';
      if (showAll) showAll.hidden = filter === 'all';
    };

    const openMenu = (mode) => {
      if (!fxMenu) return;
      const sameAndOpen = !fxMenu.hidden && filter === mode;
      filter = mode;
      fxMenu.hidden = sameAndOpen;
      if (menuBtn) menuBtn.setAttribute('aria-expanded', String(!fxMenu.hidden && mode === 'all'));
      if (soundBtn) soundBtn.setAttribute('aria-expanded', String(!fxMenu.hidden && mode === 'sound'));
      if (fxMenu.hidden) return;
      if (!FX) {
        if (grid) grid.textContent = '';
        say('연출 엔진(js/effects.js)을 불러오지 못했어요. write.html 아래쪽에 <script src="js/effects.js"> 줄이 app.js보다 먼저 있는지, 그 파일이 public/js 폴더에 있는지 확인해 주세요.');
        return;
      }
      renderMenu();
      say(currentBlock() ? '' : '본문에서 연출을 넣을 문단을 먼저 클릭한 뒤 골라 주세요.');
    };

    if (menuBtn) menuBtn.addEventListener('click', () => openMenu('all'));
    if (soundBtn) soundBtn.addEventListener('click', () => openMenu('sound'));
    if (showAll) {
      showAll.addEventListener('mousedown', (e) => e.preventDefault());
      showAll.addEventListener('click', () => { filter = 'all'; renderMenu(); });
    }

    if (FX) {
      document.body.classList.add('fx-on');          // 에디터 미리보기용
      if (FX.SETTINGS.paidUnlocked && $('.fx-menu__hint', fxMenu)) {
        $('.fx-menu__hint', fxMenu).append(' 지금은 베타 기간이라 유료 연출도 무료로 쓸 수 있어요.');
      }
      document.addEventListener('horrorfx:sounds-loaded', renderMenu);

      const removeBtn = $('#fx-remove');
      if (removeBtn) {
        removeBtn.addEventListener('mousedown', (e) => e.preventDefault());
        removeBtn.addEventListener('click', () => {
          const block = currentBlock();
          if (!block || !block.dataset.fx) { say('연출이 붙은 문단을 먼저 클릭해 주세요.'); return; }
          delete block.dataset.fx; delete block.dataset.fxTier; delete block.dataset.fxLabel;
          updateCount();
          say('연출을 뺐어요.');
        });
      }
      const previewBtn = $('#fx-preview');
      if (previewBtn) {
        previewBtn.addEventListener('mousedown', (e) => e.preventDefault());
        previewBtn.addEventListener('click', () => {
          const block = currentBlock();
          if (!block || !block.dataset.fx) { say('연출이 붙은 문단을 먼저 클릭해 주세요.'); return; }
          const fx = FX.byId(block.dataset.fx);
          if (fx && fx.sound && !FX.isSoundOn()) FX.enableSound();
          FX.preview(block.dataset.fx, block);
        });
      }
    }

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

    document.addEventListener('editor:refresh', () => { ensureBlocks(); updateCount(); });
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

    // posts.js(수정 모드, 임시 저장)에서 태그를 읽고 채울 때 사용
    window.HorrorEditor = {
      getTags: () => tags().map((t) => t.firstChild.textContent),
      setTags: (list) => { tags().forEach((t) => t.remove()); (list || []).forEach(addTag); }
    };
  }

  // 썸네일 선택 시 파일 이름 표시
  const thumbInput = $('#thumb-input');
  if (thumbInput) {
    thumbInput.addEventListener('change', () => {
      const file = thumbInput.files[0];
      $('#thumb-label').textContent = file ? file.name : '클릭하여 이미지 교체';
    });
  }

  // 발행하기·수정 완료는 posts.js 에서 서버로 보냅니다

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
