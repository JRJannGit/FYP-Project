function showTimetable(dataUrl) {
  const uploadView = document.getElementById('timetable-upload-view');
  const displayView = document.getElementById('timetable-display-view');
  const imgPreview = document.getElementById('timetable-img-preview');
  const pdfPreview = document.getElementById('timetable-pdf-preview');

  if (uploadView) uploadView.style.display = 'none';
  if (displayView) displayView.style.display = 'flex';

  if (dataUrl.startsWith('data:application/pdf')) {
    if (pdfPreview) {
      pdfPreview.src = dataUrl;
      pdfPreview.style.display = 'block';
    }
    if (imgPreview) imgPreview.style.display = 'none';
  } else {
    if (imgPreview) {
      imgPreview.src = dataUrl;
      imgPreview.style.display = 'block';
    }
    if (pdfPreview) pdfPreview.style.display = 'none';
  }
}

function showUploadScreen() {
  const uploadView = document.getElementById('timetable-upload-view');
  const displayView = document.getElementById('timetable-display-view');
  const imgPreview = document.getElementById('timetable-img-preview');
  const pdfPreview = document.getElementById('timetable-pdf-preview');
  const fileInput = document.getElementById('timetable-file-input');

  if (uploadView) uploadView.style.display = 'flex';
  if (displayView) displayView.style.display = 'none';
  if (imgPreview) imgPreview.src = '';
  if (pdfPreview) pdfPreview.src = '';
  if (fileInput) fileInput.value = '';
}

function initTimetable() {
  // Semak jika jadual sedia ada disimpan dalam localStorage
  const savedTimetable = localStorage.getItem('uptm_timetable_file');
  if (savedTimetable) {
    showTimetable(savedTimetable);
  } else {
    showUploadScreen();
  }
}

// Global Event Listener (Penyelesaian Utama untuk SPA Electron)
document.addEventListener('click', (e) => {
  // 1. Klik pada Kad Upload Timetable
  const uploadBtn = e.target.closest('#btn-upload-timetable');
  if (uploadBtn) {
    const fileInput = document.getElementById('timetable-file-input');
    if (fileInput) fileInput.click();
    return;
  }

  // 2. Klik pada Ikon Tong Sampah (Open Modal)
  const deleteBtn = e.target.closest('#btn-delete-timetable');
  if (deleteBtn) {
    const deleteModal = document.getElementById('delete-modal');
    if (deleteModal) deleteModal.style.display = 'flex';
    return;
  }

  // 3. Klik Batal pada Modal (NO)
  const cancelBtn = e.target.closest('#btn-cancel-delete');
  if (cancelBtn) {
    const deleteModal = document.getElementById('delete-modal');
    if (deleteModal) deleteModal.style.display = 'none';
    return;
  }

  // 4. Klik Sahkan Padam pada Modal (YES)
  const confirmBtn = e.target.closest('#btn-confirm-delete');
  if (confirmBtn) {
    localStorage.removeItem('uptm_timetable_file');
    const deleteModal = document.getElementById('delete-modal');
    if (deleteModal) deleteModal.style.display = 'none';
    showUploadScreen();
    return;
  }
});

// Event Listener untuk Pilihan Fail (File Input Change)
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'timetable-file-input') {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (event) {
        const fileData = event.target.result;
        localStorage.setItem('uptm_timetable_file', fileData);
        showTimetable(fileData);
      };
      reader.readAsDataURL(file);
    }
  }
});

// Dedahkan fungsi kepada tetingkap global
window.initTimetable = initTimetable;
document.addEventListener('DOMContentLoaded', initTimetable);