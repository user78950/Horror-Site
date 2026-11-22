/* =========================================================
   무서운 게 딱좋아! — 댓글 (comments.js)
   post.html 에서 씁니다. 목록·쓰기·수정·삭제를 서버의 댓글 API와 주고받습니다.
   댓글 글자는 항상 textContent 로 넣어서 HTML·스크립트가 실행되지 않습니다.
   ========================================================= */

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const section = $('#cm');
  if (!section) return;

  const postId = new URLSearchParams(location.search).get('id');
  if (!/^\d+$/.test(postId || '')) return;

  const list = $('#cm-list');
  const total = $('#cm-total');
  const note = $('#cm-note');
  const form = $('#cm-form');
  const input = $('#cm-input');
  const chars = $('#cm-chars');
  const gate = $('#cm-gate');
  let order = 'new';

  const el = (tag, className, text) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  function timeAgo(iso) {
    const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return '방금 전';
    if (sec < 3600) return Math.floor(sec / 60) + '분 전';
    if (sec < 86400) return Math.floor(sec / 3600) + '시간 전';
    if (sec < 86400 * 7) return Math.floor(sec / 86400) + '일 전';
    return new Date(iso).toLocaleDateString('ko-KR');
  }

  async function api(method, url, body) {
    let res;
    try {
      res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw new Error('서버에 연결하지 못했어요.');
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && window.HorrorAuth) location.href = HorrorAuth.loginUrl();
    if (!res.ok) throw new Error(data.error || '문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    return data;
  }

  const setTotal = (n) => { total.textContent = Number(n).toLocaleString('ko-KR'); };

  /* ---------- 댓글 하나 그리기 ---------- */
  function render(c) {
    const box = el('div', 'comment');
    box.dataset.id = c.id;

    const head = el('p', 'comment__head');
    head.append(el('span', 'comment__name', c.author));
    if (c.isPostAuthor) head.append(el('span', 'chip chip--red', '글쓴이'));
    if (c.anonymous && c.isMine) head.append(el('span', 'chip', '내 익명 댓글'));
    head.append(el('span', 'muted', timeAgo(c.createdAt) + (c.edited ? ' · 수정됨' : '')));

    if (c.canEdit) {
      const actions = el('span', 'comment__actions');
      const edit = el('button', 'btn btn--text btn--sm', '수정');
      edit.type = 'button';
      edit.addEventListener('click', () => startEdit(box, c));
      const del = el('button', 'btn btn--text btn--sm', '삭제');
      del.type = 'button';
      del.addEventListener('click', () => remove(box, c));
      actions.append(edit, del);
      head.append(actions);
    }

    const body = el('div', 'comment__body');
    fillBody(body, c);
    box.append(head, body);
    return box;
  }

  function fillBody(body, c) {
    body.textContent = '';
    const text = el('p', 'comment__text', c.content);
    if (c.spoiler) {
      const wrap = el('div', 'comment__spoiler is-hidden');
      const reveal = el('button', 'btn btn--ghost btn--sm comment__spoiler-btn', '스포일러 보기');
      reveal.type = 'button';
      reveal.addEventListener('click', () => wrap.classList.remove('is-hidden'));
      wrap.append(text, reveal);
      body.append(wrap);
    } else {
      body.append(text);
    }
  }

  /* ---------- 목록 ---------- */
  async function load() {
    list.setAttribute('aria-busy', 'true');
    try {
      const data = await api('GET', `/api/posts/${postId}/comments?order=${order}`);
      list.textContent = '';
      setTotal(data.total);
      if (!data.comments.length) list.append(el('p', 'comments-empty', '아직 댓글이 없어요. 첫 흔적을 남겨 보세요.'));
      else data.comments.forEach((c) => list.append(render(c)));
    } catch (err) {
      list.textContent = '';
      list.append(el('p', 'comments-empty', err.message));
    } finally {
      list.removeAttribute('aria-busy');
    }
  }

  $$('[data-cm-order]').forEach((btn) => btn.addEventListener('click', () => { order = btn.dataset.cmOrder; load(); }));

  /* ---------- 쓰기 ---------- */
  input.addEventListener('input', () => { chars.textContent = input.value.length + ' / 1000'; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = input.value.trim();
    if (!content) { note.textContent = '댓글 내용을 입력해 주세요.'; input.focus(); return; }
    const btn = $('#cm-submit');
    btn.disabled = true;
    note.textContent = '';
    try {
      const data = await api('POST', `/api/posts/${postId}/comments`, {
        content,
        anonymous: $('#cm-anon').checked,
        spoiler: $('#cm-spoiler').checked
      });
      input.value = '';
      chars.textContent = '0 / 1000';
      $('#cm-spoiler').checked = false;
      setTotal(data.total);
      const empty = $('.comments-empty', list);
      if (empty) empty.remove();
      const node = render(data.comment);
      if (order === 'new') list.prepend(node); else list.append(node);
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (err) {
      note.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- 수정 ---------- */
  function startEdit(box, c) {
    const body = $('.comment__body', box);
    body.textContent = '';
    const wrap = el('div', 'comment__edit');
    const area = el('textarea');
    area.rows = 3;
    area.maxLength = 1000;
    area.value = c.content;
    area.setAttribute('aria-label', '댓글 수정');
    const row = el('div', 'comment__edit-row');
    const spoilerLabel = el('label');
    const spoiler = el('input');
    spoiler.type = 'checkbox';
    spoiler.checked = c.spoiler;
    spoilerLabel.append(spoiler, ' 스포일러로 가리기');
    const save = el('button', 'btn btn--primary btn--sm', '저장');
    save.type = 'button';
    const cancel = el('button', 'btn btn--text btn--sm', '취소');
    cancel.type = 'button';
    const msg = el('span', 'blood');
    row.append(spoilerLabel, save, cancel, msg);
    wrap.append(area, row);
    body.append(wrap);
    area.focus();

    cancel.addEventListener('click', () => fillBody(body, c));
    save.addEventListener('click', async () => {
      if (!area.value.trim()) { msg.textContent = '내용을 입력해 주세요.'; return; }
      save.disabled = true;
      try {
        const data = await api('PUT', `/api/comments/${c.id}`, { content: area.value, spoiler: spoiler.checked });
        box.replaceWith(render(data.comment));
      } catch (err) {
        msg.textContent = err.message;
        save.disabled = false;
      }
    });
  }

  /* ---------- 삭제 ---------- */
  async function remove(box, c) {
    if (!confirm('이 댓글을 삭제할까요?')) return;
    try {
      const data = await api('DELETE', `/api/comments/${c.id}`);
      box.remove();
      setTotal(data.total);
      if (!$('.comment', list)) list.append(el('p', 'comments-empty', '아직 댓글이 없어요. 첫 흔적을 남겨 보세요.'));
    } catch (err) {
      note.textContent = err.message;
    }
  }

  /* ---------- 로그인 상태에 따라 입력창 보여 주기 ---------- */
  const showGate = (nodes) => {
    gate.textContent = '';
    gate.append(...nodes);
    gate.hidden = false;
    form.hidden = true;
  };
  const ready = window.HorrorAuth ? HorrorAuth.ready : Promise.resolve(null);
  ready.then((user) => {
    if (!user) {
      const a = el('a', '', '로그인');
      a.href = HorrorAuth.loginUrl();
      showGate([a, '하고 댓글을 남겨 보세요.']);
    } else if (!user.emailVerified) {
      const a = el('a', '', '글쓰기 화면');
      a.href = 'write.html';
      showGate(['이메일 인증을 마치면 댓글을 쓸 수 있어요. ', a, '에서 인증 메일을 다시 받을 수 있어요.']);
    } else {
      form.hidden = false;
      gate.hidden = true;
    }
  });

  load();
})();
