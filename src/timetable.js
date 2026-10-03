// =========================================
// src/timetable.js
// =========================================

function initTimetable() {
  const uploadView  = document.getElementById('timetable-upload-view');
  const displayView = document.getElementById('timetable-display-view');
  const imgPreview  = document.getElementById('timetable-img-preview');
  const pdfPreview  = document.getElementById('timetable-pdf-preview');
  const fileInput   = document.getElementById('timetable-file-input');
  const _u = AppStorage.getUser();
  const studentId = _u
    ? (_u.student_id || _u.lecturer_id || _u.admin_id || _u.identifier)
    : null;

  async function load() {
    if (!studentId) { showUpload(); return; }
    const res = await API.get(`/api/timetable/${studentId}`);
    if (res.success && res.data) showDisplay(res.data);
    else showUpload();
  }

  function showUpload() {
    if (uploadView) uploadView.style.display = 'flex';
    if (displayView) displayView.style.display = 'none';
    if (fileInput) fileInput.value = '';
  }

  function showDisplay(row) {
    if (uploadView) uploadView.style.display = 'none';
    if (displayView) displayView.style.display = 'flex';
    if (row.file_type === 'pdf') {
      if (pdfPreview) { pdfPreview.src = row.file_data; pdfPreview.style.display = 'block'; }
      if (imgPreview) imgPreview.style.display = 'none';
    } else {
      if (imgPreview) { imgPreview.src = row.file_data; imgPreview.style.display = 'block'; }
      if (pdfPreview) pdfPreview.style.display = 'none';
    }
  }

  document.addEventListener('click', async (e) => {
    if (e.target.closest('#btn-upload-timetable')) {
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
      const res = await API.delete(`/api/timetable/${studentId}`);
      document.getElementById('delete-modal').style.display = 'none';
      if (res.success) showUpload();
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id !== 'timetable-file-input') return;
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const file_data = ev.target.result;
      const file_type = file.type === 'application/pdf' ? 'pdf' : 'image';
      const res = await API.post('/api/timetable', { student_id: studentId, file_data, file_type });
      if (res.success) showDisplay({ file_data, file_type });
      else alert('Upload failed: ' + res.error);
    };
    reader.readAsDataURL(file);
  });

  load();
}

window.initTimetable = initTimetable;