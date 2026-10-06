
/* ---------- Zoom for the uploaded timetable (image / PDF) ---------- */
const TIMETABLE_ZOOM_MIN = 50;
const TIMETABLE_ZOOM_MAX = 200;
const TIMETABLE_ZOOM_STEP = 10;
let timetableCurrentZoom = 100;

function ttZoomEls() {
  return {
    displayView: document.getElementById('timetable-display-view'),
    wrapper: document.getElementById('timetable-preview-wrapper'),
    img: document.getElementById('timetable-img-preview'),
    pdf: document.getElementById('timetable-pdf-preview'),
    outBtn: document.getElementById('timetable-zoom-out'),
    inBtn: document.getElementById('timetable-zoom-in'),
    valBtn: document.getElementById('timetable-zoom-value')
  };
}

/* Measure the contain-fitted size of the image (inline overrides cleared first) */
function ttGetFitSize(img) {
  const saved = {
    zoom: img.style.zoom,
    width: img.style.width,
    height: img.style.height,
    maxWidth: img.style.maxWidth,
    maxHeight: img.style.maxHeight
  };
  img.style.zoom = '';
  img.style.width = '';
  img.style.height = '';
  img.style.maxWidth = '';
  img.style.maxHeight = '';
  const w = img.offsetWidth;
  const h = img.offsetHeight;
  img.style.zoom = saved.zoom;
  img.style.width = saved.width;
  img.style.height = saved.height;
  img.style.maxWidth = saved.maxWidth;
  img.style.maxHeight = saved.maxHeight;
  return { w, h };
}

function applyTimetableZoom() {
  const el = ttZoomEls();
  const z = timetableCurrentZoom / 100;

  if (el.valBtn) el.valBtn.innerText = timetableCurrentZoom + '%';
  if (el.outBtn) el.outBtn.disabled = timetableCurrentZoom <= TIMETABLE_ZOOM_MIN;
  if (el.inBtn)  el.inBtn.disabled  = timetableCurrentZoom >= TIMETABLE_ZOOM_MAX;
  if (el.wrapper) el.wrapper.style.overflow = timetableCurrentZoom === 100 ? '' : 'auto';

  if (el.img && el.img.style.display !== 'none') {
    if (timetableCurrentZoom === 100) {
      el.img.style.zoom = '';
      el.img.style.width = '';
      el.img.style.height = '';
      el.img.style.maxWidth = '';
      el.img.style.maxHeight = '';
    } else {
      const fit = ttGetFitSize(el.img);
      if (fit.w > 0 && fit.h > 0) {
        el.img.style.maxWidth = 'none';
        el.img.style.maxHeight = 'none';
        el.img.style.zoom = '';
        el.img.style.width = Math.round(fit.w * z) + 'px';
        el.img.style.height = Math.round(fit.h * z) + 'px';
      }
    }
  }

  if (el.pdf && el.pdf.style.display !== 'none') {
    el.pdf.style.zoom = timetableCurrentZoom === 100 ? '' : z;
  }
}

function timetableZoomIn() {
  timetableCurrentZoom = Math.min(TIMETABLE_ZOOM_MAX, timetableCurrentZoom + TIMETABLE_ZOOM_STEP);
  applyTimetableZoom();
}

function timetableZoomOut() {
  timetableCurrentZoom = Math.max(TIMETABLE_ZOOM_MIN, timetableCurrentZoom - TIMETABLE_ZOOM_STEP);
  applyTimetableZoom();
}

function timetableZoomReset() {
  timetableCurrentZoom = 100;
  applyTimetableZoom();
}

async function initTimetable() {
  bindTimetableListenersOnce();
  loadTimetable();

  const btnDeleteAll = document.getElementById('btn-delete-all-timetable');
  if (btnDeleteAll) {
    btnDeleteAll.addEventListener('click', async () => {
      const userId = getTimetableStudentId();
      if (!userId) return;
      showConfirm({
        title: 'Delete ALL saved classes?',
        message: 'This also removes them from Today\'s Schedule and the Calendar. This cannot be undone.',
        confirmLabel: 'Delete All',
        cancelLabel: 'Cancel',
        danger: true,
        onConfirm: async function () {
          btnDeleteAll.disabled = true;
          const res = await API.delete(`/api/timetable-entries/all/${userId}`);
          btnDeleteAll.disabled = false;
          if (!res.success) {
            showNotice('error', 'Delete failed', escapeHtml(res.error || 'Unknown error'), 0);
            return;
          }
          /* The DB row delete cascades immediately; dashboard and calendar
             re-fetch their data on every view visit, so they show the emptied
             schedule the next time the user opens them. */
          showNotice('success', 'Deleted ' + ((res.data && res.data.deleted) || 0) + ' classes',
            'Your Dashboard and Calendar will update on next view.', 5000);
        }
      });
    });
  }

  // ---- Paste import ----
  const pasteInput    = document.getElementById('timetable-paste-input');
  const btnParse      = document.getElementById('btn-parse-timetable');
  const btnClearPaste = document.getElementById('btn-clear-timetable-paste');
  const previewBox    = document.getElementById('timetable-preview');
  const previewList   = document.getElementById('timetable-preview-list');
  const btnSave       = document.getElementById('btn-save-timetable');
  const btnCancel     = document.getElementById('btn-cancel-timetable');
  const savedList     = document.getElementById('timetable-saved-list');

  if (!pasteInput) {
    console.warn('[timetable] paste-import UI not found');
    return;
  }

  pasteInput.addEventListener('mousedown', function () {
    // Recovery: clear any stuck pointer-events state left by overlays
    pasteInput.style.pointerEvents = '';
  });

  const DAY_ALIASES = {
    mo:'Mon', mon:'Mon', monday:'Mon',
    tu:'Tue', tue:'Tue', tuesday:'Tue',
    we:'Wed', wed:'Wed', wednesday:'Wed',
    th:'Thu', thu:'Thu', thursday:'Thu',
    fr:'Fri', fri:'Fri', friday:'Fri',
    sa:'Sat', sat:'Sat', saturday:'Sat',
    su:'Sun', sun:'Sun', sunday:'Sun'
  };

  /* Local helper — every other module keeps a private escapeHtml copy
     (notes.js, resources.js, ...) and none is exposed globally, while this
     file is not wrapped in an IIFE. */
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function normalizeTime(t) {
    const m = String(t).trim().match(/^(\d{1,2})[:.](\d{2})$/);
    if (!m) return null;
    return String(m[1]).padStart(2, '0') + ':' + m[2] + ':00';
  }

  function parseTimetableLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) return null;
    const day = DAY_ALIASES[parts[0].toLowerCase()];
    if (!day) return null;
    const range = parts[1].match(/^(.+?)[-\u2013](.+)$/);
    if (!range) return null;
    const start = normalizeTime(range[1]);
    const end   = normalizeTime(range[2]);
    if (!start || !end) return null;
    const subject = parts[2];
    const room = parts.slice(3).join(' ').trim() || null;
    return { day_of_week: day, start_time: start, end_time: end, subject, room };
  }

  function renderPreviewRow(entry) {
    const row = document.createElement('div');
    row.className = 'preview-row';
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    row.innerHTML =
      '<select class="preview-day">' +
      days.map(function (d) {
        return '<option value="' + d + '"' + (d === entry.day_of_week ? ' selected' : '') + '>' + d + '</option>';
      }).join('') +
      '</select>' +
      '<input class="preview-subject" type="text" value="' + escapeHtml(entry.subject || '') + '">' +
      '<input class="preview-start" type="time" value="' + (entry.start_time || '').slice(0, 5) + '">' +
      '<input class="preview-end" type="time" value="' + (entry.end_time || '').slice(0, 5) + '">' +
      '<input class="preview-room" type="text" value="' + escapeHtml(entry.room || '') + '" placeholder="Room">' +
      '<button type="button" class="preview-remove">\u00d7</button>';
    row.querySelector('.preview-remove').addEventListener('click', function () { row.remove(); });
    previewList.appendChild(row);
  }

  function collectPreviewRows() {
    return Array.from(previewList.querySelectorAll('.preview-row')).map(function (row) {
      const start = row.querySelector('.preview-start').value;
      const end   = row.querySelector('.preview-end').value;
      return {
        day_of_week: row.querySelector('.preview-day').value,
        start_time: start ? start + ':00' : null,
        end_time:   end   ? end   + ':00' : null,
        subject: row.querySelector('.preview-subject').value.trim(),
        room: row.querySelector('.preview-room').value.trim() || null
      };
    });
  }

  async function loadSavedTimetable() {
    if (!savedList) return;
    const uid = getTimetableStudentId();
    if (!uid) {
      savedList.innerHTML = '<p style="color:var(--text-muted);">Please log in.</p>';
      return;
    }
    const res = await API.get('/api/timetable-entries/user/' + uid);
    if (!res.success) {
      savedList.innerHTML = '<p style="color:#f87171;">Failed: ' + res.error + '</p>';
      return;
    }
    if (!res.data || res.data.length === 0) {
      savedList.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;">No classes saved yet.</p>';
      return;
    }
    savedList.innerHTML = res.data.map(function (t) {
      return '<div class="saved-row" data-id="' + t.id + '">' +
        '<span class="saved-day">' + t.day_of_week + '</span>' +
        '<span class="saved-time">' + (t.time_start || '').slice(0, 5) + ' \u2013 ' + (t.time_end || '').slice(0, 5) + '</span>' +
        '<span class="saved-subject">' + escapeHtml(t.subject) + '</span>' +
        '<span class="saved-room">' + escapeHtml(t.room || '') + '</span>' +
        '<button class="saved-delete" data-id="' + t.id + '" title="Delete">' +
        '<i class="fa-solid fa-trash"></i></button></div>';
    }).join('');
  }

  const btnAddRow = document.getElementById('btn-add-preview-row');

  function addPreviewRow(entry) {
    const row = entry || {
      day_of_week: 'Mon',
      start_time: '08:00:00',
      end_time: '09:00:00',
      subject: '',
      room: null
    };
    renderPreviewRow(row);
    const rows = previewList.querySelectorAll('.preview-row');
    if (rows.length > 0) {
      rows[rows.length - 1].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  if (btnAddRow) {
    btnAddRow.addEventListener('click', function () {
      if (previewBox.style.display === 'none') {
        previewBox.style.display = 'flex';
        previewList.innerHTML = '';
      }
      addPreviewRow();
    });
  }

  function showNotice(type, title, message, durationMs) {
    const old = document.getElementById('timetable-notice');
    if (old) old.remove();

    const notice = document.createElement('div');
    notice.id = 'timetable-notice';
    notice.className = 'timetable-notice notice-' + (type || 'info');

    const iconName = {
      error:   'fa-circle-exclamation',
      warning: 'fa-triangle-exclamation',
      success: 'fa-circle-check',
      info:    'fa-circle-info'
    }[type] || 'fa-circle-info';

    const icon = document.createElement('i');
    icon.className = 'fa-solid ' + iconName;

    const body = document.createElement('div');
    body.className = 'notice-body';

    const strong = document.createElement('strong');
    strong.textContent = title || '';
    body.appendChild(strong);

    if (message) {
      const span = document.createElement('span');
      span.innerHTML = message;
      body.appendChild(span);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'notice-close';
    close.innerHTML = '&times;';
    close.addEventListener('click', function () { notice.remove(); });

    notice.appendChild(icon);
    notice.appendChild(body);
    notice.appendChild(close);

    const section = document.querySelector('.timetable-import-section');
    const anchor  = document.getElementById('timetable-preview');
    if (section && anchor && anchor.parentNode === section) {
      section.insertBefore(notice, anchor);
    } else if (section) {
      section.appendChild(notice);
    } else {
      document.body.appendChild(notice);
    }

    const dur = (typeof durationMs === 'number') ? durationMs : 8000;
    if (dur > 0) {
      setTimeout(function () {
        if (notice.parentNode) notice.remove();
      }, dur);
    }

    notice.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function showParseNotice(errors) {
    const msg = errors.slice(0, 3).map(function (e) {
      return 'Line ' + e.lineNumber + ': ' + escapeHtml(e.line);
    }).join('<br>') + (errors.length > 3 ? '<br>…' : '');
    showNotice('warning', errors.length + ' line' + (errors.length === 1 ? '' : 's') + ' skipped', msg, 10000);
  }

  function showConfirm(opts) {
    const {
      title = 'Confirm',
      message = '',
      confirmLabel = 'Yes',
      cancelLabel = 'Cancel',
      danger = true
    } = opts || {};

    const existing = document.getElementById('timetable-confirm-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'timetable-confirm-modal';
    overlay.className = 'tt-confirm-overlay';

    const box = document.createElement('div');
    box.className = 'tt-confirm-box';

    const h = document.createElement('h3');
    h.textContent = title;

    const p = document.createElement('p');
    p.innerHTML = message;

    const actions = document.createElement('div');
    actions.className = 'tt-confirm-actions';

    const btnNo = document.createElement('button');
    btnNo.type = 'button';
    btnNo.className = 'tt-confirm-btn tt-confirm-btn--cancel';
    btnNo.textContent = cancelLabel;

    const btnYes = document.createElement('button');
    btnYes.type = 'button';
    btnYes.className = 'tt-confirm-btn ' + (danger
      ? 'tt-confirm-btn--danger'
      : 'tt-confirm-btn--primary');
    btnYes.textContent = confirmLabel;

    actions.appendChild(btnNo);
    actions.appendChild(btnYes);
    box.appendChild(h);
    box.appendChild(p);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    }

    btnNo.addEventListener('click', close);
    btnYes.addEventListener('click', function () { close(); opts.onConfirm && opts.onConfirm(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);

    setTimeout(function () { btnYes.focus(); }, 30);
  }

  btnParse.addEventListener('click', function () {
    const lines = pasteInput.value.split(/\r?\n/);
    const entries = [];
    const errors = [];
    lines.forEach(function (line, i) {
      if (!line.trim()) return;
      const parsed = parseTimetableLine(line);
      if (parsed) entries.push(parsed);
      else errors.push({ lineNumber: i + 1, line: line.trim() });
    });
    if (entries.length === 0) {
      showNotice('error', 'No valid lines found',
        'Format: <code>Day HH:MM-HH:MM Subject [Room]</code>', 0);
      return;
    }
    if (errors.length > 0) {
      showParseNotice(errors);
    }
    previewList.innerHTML = '';
    entries.forEach(renderPreviewRow);
    previewBox.style.display = 'flex';
    try { pasteInput.focus(); } catch (e) {}
  });

  btnClearPaste.addEventListener('click', function () { pasteInput.value = ''; });

  btnCancel.addEventListener('click', function () {
    previewBox.style.display = 'none';
    previewList.innerHTML = '';
  });

  btnSave.addEventListener('click', async function () {
    const uid = getTimetableStudentId();
    if (!uid) { showNotice('error', 'Not logged in', 'Please log in and try again.', 0); return; }
    const entries = collectPreviewRows();
    if (entries.length === 0) return;
    const invalid = entries.find(function (e) {
      return !e.day_of_week || !e.subject || !e.start_time || !e.end_time;
    });
    if (invalid) {
      showNotice('error', 'Incomplete rows',
        'Every row needs a day, subject, start time, and end time.', 0);
      return;
    }

    btnSave.disabled = true;
    const res = await API.post('/api/timetable-entries/bulk', { user_id: uid, entries: entries });
    btnSave.disabled = false;

    if (!res.success) { showNotice('error', 'Save failed', escapeHtml(res.error || 'Unknown error'), 0); return; }

    pasteInput.value = '';
    previewBox.style.display = 'none';
    previewList.innerHTML = '';
    await loadSavedTimetable();
    showNotice('success', 'Saved ' + entries.length + ' classes',
      'They will appear on your Dashboard and Calendar.', 5000);
    try { pasteInput.focus(); } catch (e) {}
  });

  savedList.addEventListener('click', async function (e) {
    const btn = e.target.closest('.saved-delete');
    if (!btn) return;
    showConfirm({
      title: 'Delete this class?',
      message: 'This will remove the class from your timetable.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true,
      onConfirm: async function () {
        const res = await API.delete('/api/timetable-entries/' + btn.dataset.id);
        if (!res.success) {
          showNotice('error', 'Delete failed', escapeHtml(res.error || 'Unknown error'), 0);
          return;
        }
        await loadSavedTimetable();
      }
    });
  });

  await loadSavedTimetable();
}

function bindTimetableListenersOnce() {
  if (window.__timetableListenersBound) return;
  window.__timetableListenersBound = true;

  document.addEventListener('click', async (e) => {
    if (e.target.closest('#btn-upload-timetable')) {
      const fileInput = document.getElementById('timetable-file-input');
      fileInput?.click();
      return;
    }
    if (e.target.closest('#timetable-zoom-in'))    { timetableZoomIn();    return; }
    if (e.target.closest('#timetable-zoom-out'))   { timetableZoomOut();   return; }
    if (e.target.closest('#timetable-zoom-value')) { timetableZoomReset(); return; }
    if (e.target.closest('#btn-delete-timetable')) {
      document.getElementById('delete-modal').style.display = 'flex';
      return;
    }
    if (e.target.closest('#btn-cancel-delete')) {
      document.getElementById('delete-modal').style.display = 'none';
      return;
    }
    if (e.target.closest('#btn-confirm-delete')) {
      const studentId = getTimetableStudentId();
      if (!studentId) return;
      const res = await API.delete(`/api/timetable/${studentId}`);
      document.getElementById('delete-modal').style.display = 'none';
      if (res.success) showUploadView();
    }
  });

  /* Ctrl + mouse wheel zoom over the timetable preview */
  document.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    const { displayView, wrapper } = ttZoomEls();
    if (!displayView || !wrapper) return;
    if (displayView.style.display === 'none') return;
    if (!wrapper.contains(e.target)) return;
    e.preventDefault();
    if (e.deltaY < 0) timetableZoomIn();
    else timetableZoomOut();
  }, { passive: false });

  /* Ctrl + / - / 0 keyboard zoom shortcuts */
  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey) return;
    const { displayView } = ttZoomEls();
    if (!displayView || displayView.style.display === 'none') return;
    if (e.key === '=' || e.key === '+') { e.preventDefault(); timetableZoomIn(); }
    else if (e.key === '-')             { e.preventDefault(); timetableZoomOut(); }
    else if (e.key === '0')             { e.preventDefault(); timetableZoomReset(); }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id !== 'timetable-file-input') return;
    const file = e.target.files[0];
    if (!file) return;

    const studentId = getTimetableStudentId();
    if (!studentId) { alert('Please log in first.'); return; }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const file_data = ev.target.result;
      const file_type = file.type === 'application/pdf' ? 'pdf' : 'image';
      const res = await API.post('/api/timetable', { student_id: studentId, file_data, file_type });
      if (res.success) showDisplayView({ file_data, file_type });
      else alert('Upload failed: ' + res.error);
    };
    reader.readAsDataURL(file);
  });
}

function getTimetableStudentId() {
  const _u = AppStorage.getUser();
  return _u ? (_u.student_id || _u.lecturer_id || _u.admin_id || _u.identifier) : null;
}

function showUploadView() {
  const uploadView  = document.getElementById('timetable-upload-view');
  const displayView = document.getElementById('timetable-display-view');
  const fileInput   = document.getElementById('timetable-file-input');
  if (uploadView)  uploadView.style.display = 'flex';
  if (displayView) displayView.style.display = 'none';
  if (fileInput)   fileInput.value = '';
  timetableZoomReset();
}

function showDisplayView(row) {
  const uploadView  = document.getElementById('timetable-upload-view');
  const displayView = document.getElementById('timetable-display-view');
  const imgPreview  = document.getElementById('timetable-img-preview');
  const pdfPreview  = document.getElementById('timetable-pdf-preview');
  if (uploadView)  uploadView.style.display = 'none';
  if (displayView) displayView.style.display = 'flex';
  if (row.file_type === 'pdf') {
    if (pdfPreview) { pdfPreview.src = row.file_data; pdfPreview.style.display = 'block'; }
    if (imgPreview) imgPreview.style.display = 'none';
  } else {
    if (imgPreview) { imgPreview.src = row.file_data; imgPreview.style.display = 'block'; }
    if (pdfPreview) pdfPreview.style.display = 'none';
  }
  timetableZoomReset();
}

async function loadTimetable() {
  const studentId = getTimetableStudentId();
  if (!studentId) { showUploadView(); return; }
  const res = await API.get(`/api/timetable/${studentId}`);
  if (res.success && res.data) showDisplayView(res.data);
  else showUploadView();
}

window.initTimetable = initTimetable;