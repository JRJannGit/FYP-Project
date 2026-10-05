
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

function initTimetable() {
  bindTimetableListenersOnce();
  loadTimetable();
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