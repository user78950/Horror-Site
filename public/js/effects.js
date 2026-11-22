/* =========================================================
   무서운 게 딱좋아! — 연출 엔진 (effects.js)

   본문 블록에 data-fx="연출 이름"을 붙이면, 독자가 그 블록까지
   스크롤했을 때 연출이 한 번 재생됩니다.
     예) <p data-fx="knock">똑. 똑. 똑.</p>

   - 효과음은 Web Audio로 직접 합성합니다 (외부 음원 없음 → 저작권 걱정 없음).
   - 독자가 "연출 끄기"를 누르거나, 기기에서 '동작 줄이기'를 켜 두면
     움직임·깜빡임 연출을 건너뜁니다.
   - window.HorrorFX 로 에디터(app.js)에서도 같은 연출을 미리보기합니다.
   ========================================================= */

(function () {
  'use strict';

  /* ---------- 연출 목록 ----------
     tier: 'free' = 누구나, 'paid' = 유료 연출 (수익 모델)
     sound: 소리가 나는 연출인지 (소리 켜기 안내를 띄울지 판단) */
  const CATALOG = [
    { id: 'fade',     name: '서서히 나타나기', tier: 'free', sound: false, desc: '문단이 천천히 떠오름' },
    { id: 'blackout', name: '정적',           tier: 'free', sound: true,  desc: '1.4초 동안 화면이 꺼짐' },
    { id: 'knock',    name: '효과음 · 노크',   tier: 'free', sound: true,  desc: '문 두드리는 소리 세 번' },
    { id: 'shake',    name: '글자 흔들림',     tier: 'paid', sound: false, desc: '문장이 떨리듯 흔들림' },
    { id: 'vanish',   name: '사라지는 문장',   tier: 'paid', sound: false, desc: '읽고 나면 흐려져 사라짐' },
    { id: 'scream',   name: '효과음 · 비명',   tier: 'paid', sound: true,  desc: '짧고 날카로운 비명' },
    { id: 'flash',    name: '화면 깜빡임',     tier: 'paid', sound: false, desc: '1초에 2번, 밝기 제한' },
    { id: 'jump',     name: '점프스케어',      tier: 'paid', sound: true,  desc: '이미지와 비명이 갑자기 덮침' },
    { id: 'type',     name: '타이핑',          tier: 'paid', sound: false, desc: 'AI가 말하듯 한 글자씩 써짐' }
  ];

  /* ---------- 설정 ----------
     paidUnlocked: 결제 기능이 생기기 전까지는 true로 두고 모두에게 열어
                   "연출을 정말 쓰는지" 데이터를 모읍니다. 결제를 붙이면
                   서버에서 받은 값(구매 여부)으로 바꾸세요.
     jumpImage:    점프스케어 이미지. 직접 만들었거나 상업적 이용이 허락된
                   이미지로 꼭 바꿔 주세요. */
  const SETTINGS = {
    paidUnlocked: true,
    jumpImage: 'images/evidence-fingers.jpg'
  };

  const byId = (id) => CATALOG.find((e) => e.id === id);

  /* ---------- 직접 넣은 효과음 파일 (public/sounds/) ----------
     서버의 /api/sounds 가 sounds 폴더의 파일 목록을 알려 주면, 각 파일을
     연출 목록 끝에 "snd-파일이름" 연출로 추가합니다.
     서버 없이 열었을 때는 sounds/sounds.json 의 목록을 대신 씁니다. */
  let soundsLoaded = null;
  function loadCustomSounds() {
    if (soundsLoaded) return soundsLoaded;
    const add = (list) => {
      (list || []).forEach((snd) => {
        if (!snd || !snd.id || !snd.file || byId(snd.id)) return;
        CATALOG.push({
          id: snd.id,
          name: snd.name || snd.id,
          tier: snd.tier === 'free' ? 'free' : 'paid',
          sound: true,
          desc: snd.desc || '직접 추가한 효과음',
          file: snd.file,
          volume: typeof snd.volume === 'number' ? snd.volume : 0.8
        });
      });
    };
    const getJson = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); });
    soundsLoaded = getJson('/api/sounds')
      .catch(() => getJson('sounds/sounds.json').then((data) => ({
        sounds: (data.sounds || []).map((x) => Object.assign({}, x, {
          id: 'snd-' + String(x.id || x.file).replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '-').toLowerCase(),
          file: 'sounds/' + x.file
        }))
      })))
      .then((data) => { add(data.sounds); })
      .catch(() => { /* 효과음 파일이 없어도 기본 연출은 그대로 동작 */ })
      .then(() => { document.dispatchEvent(new CustomEvent('horrorfx:sounds-loaded')); });
    return soundsLoaded;
  }

  // 파일을 한 번 받아 디코딩해 두고 재사용
  const buffers = {};
  function loadBuffer(fx) {
    if (!ctx || !fx.file) return Promise.reject(new Error('no audio'));
    if (!buffers[fx.id]) {
      buffers[fx.id] = fetch(fx.file)
        .then((r) => r.arrayBuffer())
        .then((data) => new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject)));
      buffers[fx.id].catch(() => { delete buffers[fx.id]; });
    }
    return buffers[fx.id];
  }
  function playFile(fx) {
    if (!canPlay()) return;
    loadBuffer(fx).then((buf) => {
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      src.buffer = buf;
      g.gain.value = fx.volume;
      src.connect(g);
      g.connect(ctx.destination);
      src.start();
    }).catch(() => {
      // 디코딩에 실패하면 브라우저 기본 오디오로 재생
      try { const a = new Audio(fx.file); a.volume = fx.volume; a.play(); } catch (e) { /* 재생 불가 */ }
    });
  }
  // 소리를 켠 직후, 본문에 쓰인 효과음 파일을 미리 받아 둠 (재생이 늦지 않게)
  function preloadFiles(ids) {
    ids.map(byId).filter((fx) => fx && fx.file).forEach((fx) => loadBuffer(fx).catch(() => {}));
  }
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* 저장 못 해도 동작에는 문제없음 */ } }
  };

  let ctx = null;            // AudioContext (사용자가 버튼을 누른 뒤에만 만들 수 있음)
  let soundOn = false;
  let fxOn = store.get('fx-on', '1') === '1';
  let drone = null;          // 배경 앰비언스

  const reducedMotion = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  };

  /* =========================================================
     소리 (Web Audio 합성)
     ========================================================= */
  function enableSound() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
      }
      ctx.resume();
      soundOn = true;
    } catch (e) {
      soundOn = false;
    }
    return soundOn;
  }

  function disableSound() {
    soundOn = false;
    stopDrone();
  }

  const canPlay = () => soundOn && fxOn && !!ctx;

  function tone(f1, f2, dur, type, gain, delay) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(dur, gain, delay, filterType, freq) {
    const t = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = buf;
    filter.type = filterType;
    filter.frequency.value = freq;
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(t);
  }

  const sounds = {
    knock() {
      [0, 0.45, 0.9].forEach((d) => { noise(0.08, 0.6, d, 'lowpass', 650); tone(140, 60, 0.14, 'sine', 0.5, d); });
    },
    scream() {
      tone(1150, 330, 0.9, 'sawtooth', 0.1, 0);
      tone(1700, 520, 0.9, 'square', 0.04, 0.02);
      noise(0.7, 0.16, 0, 'highpass', 1400);
    },
    thud() {
      tone(55, 46, 1.4, 'sine', 0.3, 0);
    }
  };

  function playSound(name) {
    if (canPlay() && sounds[name]) sounds[name]();
  }

  // 배경 앰비언스: 낮게 울리는 두 음 + 천천히 흔들리는 음량
  function startDrone() {
    if (!soundOn || !ctx || drone) return false;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 1.5);
    master.connect(ctx.destination);
    const oscs = [55, 82.4].map((f) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(master);
      o.start();
      return o;
    });
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);
    lfo.start();
    drone = { master, nodes: oscs.concat(lfo) };
    return true;
  }

  function stopDrone() {
    if (!drone || !ctx) { drone = null; return; }
    const { master, nodes } = drone;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    nodes.forEach((n) => n.stop(ctx.currentTime + 0.7));
    drone = null;
  }

  /* =========================================================
     화면 전체를 덮는 연출 (정적, 깜빡임, 점프스케어)
     ========================================================= */
  function overlay(kind, ms) {
    const el = document.createElement('div');
    el.className = 'fx-overlay fx-overlay--' + kind;
    el.setAttribute('aria-hidden', 'true');
    if (kind === 'jump') {
      const img = document.createElement('img');
      img.src = SETTINGS.jumpImage;
      img.alt = '';
      el.append(img);
    }
    document.body.append(el);
    setTimeout(() => el.remove(), ms);
  }

  /* =========================================================
     연출 재생
     ========================================================= */
  // 타이핑: 문단 글자를 지웠다가 한 글자씩 다시 써 줌 (서식 없는 짧은 문단용)
  function typeText(el) {
    const full = el.dataset.fxText || (el.dataset.fxText = el.textContent);
    clearTimeout(el._typeTimer);
    if (reducedMotion()) { el.textContent = full; return; }
    el.textContent = '';
    el.classList.add('fx-typing');
    let i = 0;
    const tick = () => {
      i += 1;
      el.textContent = full.slice(0, i);
      if (i >= full.length) { el.classList.remove('fx-typing'); return; }
      const ch = full.charAt(i - 1);
      el._typeTimer = setTimeout(tick, ch === ' ' ? 25 : '.,·:'.includes(ch) ? 260 : 55);
    };
    tick();
  }

  function play(id, el) {
    if (el) el.classList.add('fx-play');
    if (!fxOn) return;
    const calm = reducedMotion();
    switch (id) {
      case 'blackout':
        playSound('thud');
        overlay('black', 1450);
        break;
      case 'knock':
        playSound('knock');
        break;
      case 'scream':
        playSound('scream');
        break;
      case 'flash':
        if (!calm) overlay('flash', 1050);
        break;
      case 'type':
        // 상세 뷰어에서만 실제로 타이핑. 에디터 미리보기에서 글자를 지우면 서식이 날아가므로 나타나기만 함
        if (el && el.closest('.fx-story')) typeText(el);
        break;
      case 'jump':
        playSound('scream');
        overlay('jump', 950);
        break;
      default: {
        const fx = byId(id);
        if (fx && fx.file) playFile(fx);   // 직접 넣은 효과음 파일
        break;   // fade, shake, vanish 는 CSS 애니메이션만으로 재생
      }
    }
  }

  // 에디터 미리보기: 같은 블록에서 여러 번 다시 재생할 수 있게 클래스를 지웠다 붙임
  function preview(id, el) {
    if (el) {
      el.classList.remove('fx-play');
      void el.offsetWidth;          // 애니메이션을 처음부터 다시 시작시키는 트릭
      clearTimeout(el._fxTimer);
      el._fxTimer = setTimeout(() => el.classList.remove('fx-play'), 5500);
    }
    play(id, el);
  }

  function setFxOn(on) {
    fxOn = on;
    store.set('fx-on', on ? '1' : '0');
    document.body.classList.toggle('fx-on', on);
    if (!on) stopDrone();
  }

  /* =========================================================
     상세 뷰어: 스크롤해서 블록이 보이면 재생
     ========================================================= */
  function initStory(root) {
    if (!root) return;
    if (root.dataset.fxReady) return;              // 같은 본문을 두 번 준비하지 않게
    const blocks = Array.from(root.querySelectorAll('[data-fx]')).filter((b) => byId(b.dataset.fx));
    if (!blocks.length) return;
    root.dataset.fxReady = '1';

    root.classList.add('fx-story');
    document.body.classList.toggle('fx-on', fxOn);

    // 1) 새로고침하면 항상 글 처음부터 시작
    //    (브라우저가 이전 스크롤 위치로 돌아가면 소리 안내를 못 보고 연출을 놓치기 때문)
    //    단, 목차 링크(#ch2 등)로 들어온 경우는 그 위치를 존중합니다.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (!location.hash) window.scrollTo(0, 0);

    // 소리 나는 연출이 있으면 "소리 켜고 읽기" 안내 표시
    const hasSound = blocks.some((b) => byId(b.dataset.fx).sound);
    const gate = document.getElementById('fx-gate');
    const showGate = () => { if (gate && hasSound && !soundOn) gate.hidden = false; };
    if (gate && hasSound) {
      showGate();
      const close = () => { gate.hidden = true; };
      const on = document.getElementById('fx-sound-on');
      const off = document.getElementById('fx-sound-off');
      if (on) on.addEventListener('click', () => { enableSound(); preloadFiles(blocks.map((b) => b.dataset.fx)); close(); });
      if (off) off.addEventListener('click', () => { disableSound(); close(); });
    }

    // 연출 켜기/끄기 버튼
    // "연출 없이 읽기" 버튼이 있는 페이지
    const offBtn = document.getElementById('fx-off');
    if (offBtn) offBtn.addEventListener('click', () => { setFxOn(false); if (gate) gate.hidden = true; });

    const toggle = document.getElementById('fx-toggle');
    if (toggle) {
      const paint = () => {
        toggle.setAttribute('aria-pressed', String(fxOn));
        toggle.textContent = fxOn ? '연출 켜짐' : '연출 꺼짐';
      };
      paint();
      toggle.addEventListener('click', () => { setFxOn(!fxOn); paint(); });
    }

    // 2) 문단마다 "다시 보기(↻)" 버튼
    //    연출 블록을 .fx-unit으로 감싸고 버튼을 옆에 둡니다.
    //    (버튼을 블록 안에 넣으면 '사라지는 문장'처럼 블록이 흐려질 때 버튼도 같이 사라짐)
    const units = blocks.map((block) => {
      const unit = document.createElement('div');
      unit.className = 'fx-unit';
      block.parentNode.insertBefore(unit, block);
      unit.append(block);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fx-replay';
      btn.textContent = '↻';
      btn.title = byId(block.dataset.fx).name + ' 다시 보기';
      btn.setAttribute('aria-label', btn.title);
      btn.addEventListener('click', () => {
        const fx = byId(block.dataset.fx);
        if (fx.sound && !soundOn) enableSound();   // 이 클릭이 소리 허용 역할
        block.classList.remove('fx-play');
        void block.offsetWidth;                     // 애니메이션을 처음부터 다시 시작
        play(block.dataset.fx, block);
      });
      unit.append(btn);
      return { block, unit };
    });

    const markPlayed = (block) => {
      const u = units.find((x) => x.block === block);
      if (u) u.unit.classList.add('is-played');
    };

    // 화면에 60% 이상 들어오면 한 번 재생
    if (!('IntersectionObserver' in window)) {
      blocks.forEach((b) => { b.classList.add('fx-play'); markPlayed(b); });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        play(entry.target.dataset.fx, entry.target);
        markPlayed(entry.target);
      });
    }, { threshold: 0.6 });
    blocks.forEach((b) => io.observe(b));

    // 3) "처음부터 다시 읽기": 모든 연출을 초기화하고 맨 위로
    const again = document.getElementById('fx-again');
    const restart = document.getElementById('fx-restart');
    if (again && restart) {
      again.hidden = false;
      restart.addEventListener('click', () => {
        blocks.forEach((b) => io.unobserve(b));
        units.forEach(({ block, unit }) => { block.classList.remove('fx-play'); unit.classList.remove('is-played'); });
        stopDrone();
        window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
        showGate();
        // 맨 위에 도착한 뒤에 다시 지켜봐야, 지금 보이는 마지막 연출이 곧바로 재생되지 않음
        const started = Date.now();
        const wait = () => {
          if (window.scrollY <= 10 || Date.now() - started > 2500) blocks.forEach((b) => io.observe(b));
          else requestAnimationFrame(wait);
        };
        requestAnimationFrame(wait);
      });
    }
  }

  window.HorrorFX = {
    CATALOG,
    SETTINGS,
    byId,
    enableSound,
    disableSound,
    isSoundOn: () => soundOn,
    loadCustomSounds,
    isFxOn: () => fxOn,
    play,
    preview,
    initStory,
    startDrone,
    stopDrone
  };

  // 본문(#article)에 연출이 있으면 자동으로 시작 (post.html 은 posts.js 가 글을 불러온 뒤 시작)
  // 직접 넣은 효과음 목록을 먼저 불러온 뒤 시작 (본문에 "snd-..." 연출이 있을 수 있으므로)
  document.addEventListener('DOMContentLoaded', () => {
    loadCustomSounds().then(() => initStory(document.getElementById('article')));
  });
})();
