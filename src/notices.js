(function () {
  if (window.__appNoticesLoaded) return;
  window.__appNoticesLoaded = true;

  function classify(message, explicitType) {
    if (explicitType) return explicitType;
    const m = String(message || '').toLowerCase();

    if (/\b(success|successful|successfully|saved|created|added|updated|deleted|removed|submitted|released|joined|left|enrolled|done|complete|completed)\b/.test(m)) {
      return 'success';
    }

    if (/\b(please|choose|pick|select|missing|required|empty|no file|too large|too big)\b/.test(m)) {
      return 'warning';
    }

    return 'error';
  }

  function shorten(message) {
    // Take first sentence, max 120 chars
    let s = String(message || '').trim();
    const dot = s.indexOf('.');
    if (dot > 20 && dot < 160) s = s.slice(0, dot + 1);
    if (s.length > 160) s = s.slice(0, 157) + '…';
    return s;
  }

  window.showAppNotice = function (type, title, message, durationMs) {
    const old = document.getElementById('app-global-notice');
    if (old) old.remove();

    const notice = document.createElement('div');
    notice.id = 'app-global-notice';
    notice.className = 'app-notice notice-' + (type || 'info');

    const icons = {
      error:   'fa-circle-exclamation',
      warning: 'fa-triangle-exclamation',
      success: 'fa-circle-check',
      info:    'fa-circle-info'
    };
    const icon = document.createElement('i');
    icon.className = 'fa-solid ' + (icons[type] || icons.info);

    const body = document.createElement('div');
    body.className = 'notice-body';
    const strong = document.createElement('strong');
    strong.textContent = title || '';
    body.appendChild(strong);
    if (message) {
      const span = document.createElement('span');
      span.textContent = String(message);
      body.appendChild(span);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'notice-close';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = '&times;';
    close.addEventListener('click', function () { notice.remove(); });

    notice.appendChild(icon);
    notice.appendChild(body);
    notice.appendChild(close);

    const host = document.querySelector('.content-area')
              || document.querySelector('#main-content')
              || document.body;
    host.insertBefore(notice, host.firstChild);

    const dur = (typeof durationMs === 'number') ? durationMs : 5000;
    if (dur > 0) {
      setTimeout(function () {
        if (notice.parentNode) notice.remove();
      }, dur);
    }
    try { notice.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
  };

  // Drop-in replacement for window.alert — auto-classifies and 
  // auto-titles based on message content.
  window.alert = function (message) {
    const type = classify(message);
    const titleMap = {
      error:   'Something went wrong',
      warning: 'Notice',
      success: 'Success',
      info:    'Info'
    };
    window.showAppNotice(
      type,
      titleMap[type],
      shorten(message),
      type === 'error' ? 0 : 5000
    );
  };

  // Drop-in replacement for window.confirm — styled, non-blocking, 
  // returns a Promise<boolean>.
  window.appConfirm = function (opts) {
    return new Promise(function (resolve) {
      const overlay = document.createElement('div');
      overlay.className = 'app-confirm-overlay';
      const box = document.createElement('div');
      box.className = 'app-confirm-box';
      const h = document.createElement('h3');
      h.textContent = opts.title || 'Confirm';
      const p = document.createElement('p');
      p.textContent = opts.message || '';
      const actions = document.createElement('div');
      actions.className = 'app-confirm-actions';
      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'app-confirm-btn app-confirm-btn--cancel';
      no.textContent = opts.cancelLabel || 'Cancel';
      const yes = document.createElement('button');
      yes.type = 'button';
      yes.className = 'app-confirm-btn ' +
        (opts.danger === false ? 'app-confirm-btn--primary' : 'app-confirm-btn--danger');
      yes.textContent = opts.confirmLabel || 'Confirm';
      actions.appendChild(no);
      actions.appendChild(yes);
      box.appendChild(h);
      box.appendChild(p);
      box.appendChild(actions);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      function close(result) {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(false); }
      }
      no.addEventListener('click', function () { close(false); });
      yes.addEventListener('click', function () { close(true); });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) close(false);
      });
      document.addEventListener('keydown', onKey);
      setTimeout(function () { yes.focus(); }, 30);
    });
  };
})();