// =========================================
// src/timetable.js
// =========================================
// NOTE: document-level listeners are bound ONCE (delegation).
// Previously they were re-registered inside initTimetable() on
// every view load — after visiting the Timetable view 3 times,
// clicking "Upload Timetable" opened the file picker 3 times
// (one stale handler per visit, each calling its own detached
// input's click()). Handlers now resolve DOM/user state at
// event time, so they stay correct across view reloads.
// =========================================

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
}

async function loadTimetable() {
  const studentId = getTimetableStudentId();
  if (!studentId) { showUploadView(); return; }
  const res = await API.get(`/api/timetable/${studentId}`);
  if (res.success && res.data) showDisplayView(res.data);
  else showUploadView();
}

window.initTimetable = initTimetable;