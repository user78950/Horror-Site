/* =========================================================
   심야 archive — 신고하기 창 (report.js)
   HorrorReport.open('post' | 'comment', 번호, '설명') 으로 엽니다.
   ========================================================= */

(function () {
  'use strict';

  const REASONS = [
    ['gore', '과도한 신체 훼손·유혈 묘사'],
    ['defamation', '실존 인물·피해자 비하, 명예훼손'],
    ['privacy', '개인정보 노출 (주소, 연락처 등)'],
    ['copyright', '허락 없이 옮긴 글·사진 (저작권)'],
    ['spam', '광고·도배'],
    ['other', '기타']
  ];

  let dialog = null;
  let target = null;

  function build() {
    dialog = document.createElement('dialog');
    dialog.className = 'report-dialog';
    dialog.setAttribute('aria-labelledby', 'report-title');
    const form = document.createElement('form');
    form.method = 'dialog';
    form.className = 'report-form';

    const h = document.createElement('h2');
    h.id = 'report-title';
    h.className = 'panel__title';
    h.textContent = '신고하기';
    const what = document.createElement('p');
    what.className = 'muted report-what';

    const fs = document.createElement('fieldset');
    fs.className = 'report-reasons';
    const lg = document.createElement('legend');
    lg.className = 'field-label';
    lg.textContent = '신고 이유';
    fs.append(lg);
    REASONS.forEach(([value, label]) => {
      const row = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'reason';
      input.value = value;
      row.append(input, ' ' + label);
      fs.append(row);
    });

    const detailLabel = document.createElement('label');
    detailLabel.className = 'field-label';
    detailLabel.textContent = '자세한 내용 (선택, 기타는 필수)';
    const detail = document.createElement('textarea');
    detail.className = 'text-input';
    detail.rows = 3;
    detail.maxLength = 500;
    detail.placeholder = '예: 원작자 허락 없이 옮긴 글이에요. 원문 주소는 …';
    detailLabel.append(detail);

    const msg = document.createElement('p');
    msg.className = 'auth-msg';
    msg.setAttribute('role', 'alert');

    const row = document.createElement('div');
    row.className = 'report-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn--ghost';
    cancel.textContent = '취소';
    cancel.addEventListener('click', () => dialog.close());
    const send = document.createElement('button');
    send.type = 'submit';
    send.className = 'btn btn--primary';
    send.textContent = '신고 보내기';
    row.append(cancel, send);

    const note = document.createElement('p');
    note.className = 'auth-hint';
    note.textContent = '신고한 사람은 공개되지 않아요. 관리자가 확인한 뒤 가이드라인에 따라 처리해요.';

    form.append(h, what, fs, detailLabel, msg, row, note);
    dialog.append(form);
    document.body.append(dialog);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const checked = form.querySelector('input[name="reason"]:checked');
      msg.textContent = '';
      msg.classList.remove('auth-msg--ok');
      if (!checked) { msg.textContent = '신고 이유를 골라 주세요.'; return; }
      send.disabled = true;
      try {
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetType: target.type, targetId: target.id, reason: checked.value, detail: detail.value })
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) { location.href = HorrorAuth.loginUrl(); return; }
        if (!res.ok) throw new Error(data.error || '신고를 보내지 못했어요.');
        msg.textContent = '신고를 보냈어요. 확인 후 처리할게요. 고마워요.';
        msg.classList.add('auth-msg--ok');
        setTimeout(() => dialog.close(), 1400);
      } catch (err) {
        msg.textContent = err.message;
      } finally {
        send.disabled = false;
      }
    });

    dialog._reset = () => {
      form.reset();
      msg.textContent = '';
      msg.classList.remove('auth-msg--ok');
    };
    dialog._what = what;
  }

  async function open(type, id, label) {
    const user = window.HorrorAuth ? await HorrorAuth.ready : null;
    if (!user) { location.href = HorrorAuth.loginUrl(); return; }
    if (!dialog) build();
    target = { type, id };
    dialog._reset();
    dialog._what.textContent = label || (type === 'post' ? '이 글을 신고해요.' : '이 댓글을 신고해요.');
    if (!user.emailVerified) {
      dialog._what.textContent = '이메일 인증을 마치면 신고할 수 있어요. 급한 경우 가이드라인 페이지의 메일 주소로 알려 주세요.';
    }
    dialog.showModal();
  }

  window.HorrorReport = { open };
})();
