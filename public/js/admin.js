/* =========================================================
   심야 archive — 신고 관리 (admin.js, 관리자 전용)
   서버도 관리자인지 확인하므로, 이 화면을 우회해도 다른 사람은 신고 목록을 볼 수 없어요.
   ========================================================= */

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const list = $('#admin-list');
  if (!list) return;
  const note = $('#admin-note');
  let status = 'open';

  const el = (tag, className, text) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const when = (iso) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });

  async function api(method, url, body) {
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '문제가 생겼어요.');
    return data;
  }

  async function handle(item, newStatus, deleteFirst) {
    note.textContent = '';
    try {
      if (deleteFirst && !item.deleted) {
        const label = item.targetType === 'post' ? '이 글을' : '이 댓글을';
        if (!confirm(`${label} 삭제하고 신고를 처리할까요? 삭제는 되돌릴 수 없어요.`)) return;
        await api('DELETE', item.targetType === 'post' ? `/api/posts/${item.targetId}` : `/api/comments/${item.targetId}`);
      }
      await api('POST', '/api/reports/handle', { targetType: item.targetType, targetId: item.targetId, status: newStatus });
      note.textContent = newStatus === 'dismissed' ? '문제 없음으로 처리했어요.' : (deleteFirst ? '삭제하고 처리했어요.' : '처리했어요.');
      load();
    } catch (err) {
      note.textContent = err.message;
    }
  }

  function card(item) {
    const box = el('article', 'panel' + (item.count >= 3 ? ' panel--red' : ''));
    const head = el('div', 'panel__head');
    const chips = el('div', '');
    chips.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; align-items: center';
    chips.append(el('span', 'chip', item.targetType === 'post' ? '글' : '댓글'), el('span', 'chip chip--red', '신고 ' + item.count + '건'));
    if (item.deleted) chips.append(el('span', 'chip chip--amber', '이미 삭제됨'));
    head.append(chips);
    if (item.target) {
      const a = el('a', 'btn btn--ghost btn--sm', '원문 보기');
      a.href = item.target.link;
      a.target = '_blank';
      a.rel = 'noopener';
      head.append(a);
    }
    box.append(head);

    if (item.target) {
      box.append(el('p', 'panel__title', item.target.title));
      box.append(el('p', 'comment__text', item.target.preview));
      box.append(el('p', 'muted', '작성자: ' + item.target.author));
    }

    const ul = el('ul', 'rules');
    item.reports.forEach((r) => {
      const li = el('li', '');
      li.append(el('strong', '', r.reasonLabel));
      if (r.detail) li.append(' — ' + r.detail);
      li.append(el('span', 'muted', ` (${r.reporter}, ${when(r.createdAt)})`));
      ul.append(li);
    });
    box.append(ul);

    if (status === 'open') {
      const actions = el('div', '');
      actions.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px';
      const del = el('button', 'btn btn--primary btn--sm', item.deleted ? '처리 완료' : '삭제하고 처리');
      del.type = 'button';
      del.addEventListener('click', () => handle(item, 'resolved', true));
      const keep = el('button', 'btn btn--ghost btn--sm', '삭제 없이 처리 완료');
      keep.type = 'button';
      keep.addEventListener('click', () => handle(item, 'resolved', false));
      const ok = el('button', 'btn btn--text btn--sm', '문제 없음');
      ok.type = 'button';
      ok.addEventListener('click', () => handle(item, 'dismissed', false));
      actions.append(del);
      if (!item.deleted) actions.append(keep);
      actions.append(ok);
      box.append(actions);
    }
    return box;
  }

  async function load() {
    try {
      const data = await api('GET', '/api/reports?status=' + status);
      $('#admin-open-count').textContent = data.openCount ? '(' + data.openCount + ')' : '';
      list.textContent = '';
      if (!data.items.length) list.append(el('p', 'muted', status === 'open' ? '처리할 신고가 없어요.' : '아직 없어요.'));
      data.items.forEach((item) => list.append(card(item)));
    } catch (err) {
      list.textContent = '';
      list.append(el('p', 'muted', err.message));
    }
  }

  $$('[data-status]').forEach((b) => b.addEventListener('click', () => { status = b.dataset.status; load(); }));

  HorrorAuth.ready.then((user) => {
    const state = $('#admin-state');
    if (!user) { location.replace(HorrorAuth.loginUrl()); return; }
    if (!user.isAdmin) { state.textContent = '관리자만 볼 수 있는 화면이에요.'; return; }
    state.hidden = true;
    $('#admin-view').hidden = false;
    load();
  });
})();
