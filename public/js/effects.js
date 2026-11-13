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
    { id: 'jump',     name: '점프스케어',      tier: 'paid', sound: true,  desc: '이미지와 비명이 갑자기 덮침' }
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
      case 'jump':
        playSound('scream');
        overlay('jump', 950);
        break;
      default:
        break;   // fade, shake, vanish 는 CSS 애니메이션만으로 재생
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
    const blocks = Array.from(root.querySelectorAll('[data-fx]')).filter((b) => byId(b.dataset.fx));
    if (!blocks.length) return;

    root.classList.add('fx-story');
    document.body.classList.toggle('fx-on', fxOn);

    // 소리 나는 연출이 있으면 "소리 켜고 읽기" 안내 표시
    const gate = document.getElementById('fx-gate');
    if (gate && blocks.some((b) => byId(b.dataset.fx).sound)) {
      gate.hidden = false;
      const close = () => { gate.hidden = true; };
      const on = document.getElementById('fx-sound-on');
      const off = document.getElementById('fx-sound-off');
      if (on) on.addEventListener('click', () => { enableSound(); close(); });
      if (off) off.addEventListener('click', () => { disableSound(); close(); });
    }

    // 연출 켜기/끄기 버튼
    const toggle = document.getElementById('fx-toggle');
    if (toggle) {
      const paint = () => {
        toggle.setAttribute('aria-pressed', String(fxOn));
        toggle.textContent = fxOn ? '연출 켜짐' : '연출 꺼짐';
      };
      paint();
      toggle.addEventListener('click', () => { setFxOn(!fxOn); paint(); });
    }

    // 화면에 60% 이상 들어오면 한 번 재생
    if (!('IntersectionObserver' in window)) {
      blocks.forEach((b) => b.classList.add('fx-play'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        play(entry.target.dataset.fx, entry.target);
      });
    }, { threshold: 0.6 });
    blocks.forEach((b) => io.observe(b));
  }

  window.HorrorFX = {
    CATALOG,
    SETTINGS,
    byId,
    enableSound,
    disableSound,
    isSoundOn: () => soundOn,
    isFxOn: () => fxOn,
    play,
    preview,
    initStory,
    startDrone,
    stopDrone
  };

  // story.html: 본문(#article)에 연출이 있으면 자동으로 시작
  document.addEventListener('DOMContentLoaded', () => initStory(document.getElementById('article')));
})();
