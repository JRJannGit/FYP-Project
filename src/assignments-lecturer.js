// =========================================
// src/assignments-lecturer.js — Lecturer create + view submissions
// =========================================

function initAssignments() {
  const user = AppStorage.getUser();
  const role = Auth.getRole();
  const userId = user?.lecturer_id || user?.admin_id || user?.identifier || '';

  // ============ Element refs ============
  const topicInput  = document.getElementById('topic-input');
  const descInput   = document.getElementById('desc-input');
  const metaDate    = document.getElementById('meta-date');
  const metaDueDate = document.getElementById('meta-due-date');
  const metaStart   = document.getElementById('meta-start-time');
  const metaEnd     = document.getElementById('meta-end-time');
  const metaClass   = document.getElementById('meta-class');

  const btnUploadFile   = document.getElementById('btn-upload-file');
  const btnInsertUrl    = document.getElementById('btn-insert-url');
  const fileInput       = document.getElementById('assignment-file-input');
  const urlInput        = document.getElementById('assignment-url-input');

  const uploadPreview   = document.getElementById('upload-preview');
  const previewName     = document.getElementById('preview-name');
  const previewRemove   = document.getElementById('preview-remove');

  const btnRelease      = document.getElementById('btn-release');
  const btnReset        = document.getElementById('btn-reset');

  const btnViewSubs     = document.getElementById('btn-view-submissions');
  const receivedHint    = document.getElementById('received-hint');

  const submissionsModal = document.getElementById('submissions-modal');
  const submissionsList  = document.getElementById('submissions-list');
  const submissionsClose = document.getElementById('submissions-close');
  const submissionsCloseBtn = document.getElementById('submissions-close-btn');
  const btnDownloadAll   = document.getElementById('btn-download-all');

  const pickModal = document.getElementById('pick-assignment-modal');
  const pickList  = document.getElementById('pick-assignment-list');
  const pickClose = document.getElementById('pick-assignment-close');

  // ============ State ============
  let uploadedFile = null;      // { name, type, data }
  let uploadedUrl  = '';        // url string
  let editingId    = null;      // assignment id being edited
  let currentAssignmentForSubs = null;

  // ============ Helpers ============
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function fmtTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    return `${h}.${m}`;
  }

  function fmtDateTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.toLocaleDateString('en-GB')} · ${d.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'})}`;
  }

  // ============ Load classes ============
  async function loadClasses() {
    if (!metaClass) return;
    const res = await fetch(`http://localhost:3000/api/lecturer/classes/${userId}`);
    const data = await res.json();
    if (!data.success) return;

    metaClass.innerHTML = '<option value="">Select class...</option>' +
      data.data.map(c => `<option value="${c.id}">${c.class_code} — ${c.class_name}</option>`).join('');
  }

  // ============ File upload ============
  if (btnUploadFile) {
    btnUploadFile.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        alert('File too large. Max 10MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        uploadedFile = {
          name: file.name,
          type: file.type,
          data: ev.target.result
        };
        uploadedUrl = '';
        showPreview(file.name, 'file');
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });
  }

  // ============ URL insert ============
  if (btnInsertUrl) {
    btnInsertUrl.addEventListener('click', () => {
      const url = prompt('Enter URL (https://...)');
      if (!url) return;
      if (!url.startsWith('http')) {
        alert('URL must start with http:// or https://');
        return;
      }
      uploadedUrl = url;
      uploadedFile = null;
      showPreview(url, 'link');
    });
  }

  function showPreview(name, type) {
    uploadPreview.style.display = 'flex';
    previewName.innerText = name;
    const icon = uploadPreview.querySelector('i');
    if (icon) {
      icon.className = type === 'link' ? 'fa-solid fa-link' : 'fa-solid fa-paperclip';
    }
  }

  function hidePreview() {
    uploadPreview.style.display = 'none';
    previewName.innerText = '';
  }

  if (previewRemove) {
    previewRemove.addEventListener('click', () => {
      uploadedFile = null;
      uploadedUrl = '';
      hidePreview();
    });
  }

  // ============ Reset ============
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (!confirm('Reset all fields?')) return;
      topicInput.value = '';
      descInput.innerHTML = '';
      metaDate.value = '';
      metaDueDate.value = '';
      metaStart.value = '09:00';
      metaEnd.value = '17:00';
      metaClass.value = '';
      uploadedFile = null;
      uploadedUrl = '';
      editingId = null;
      hidePreview();
      receivedHint.innerText = 'Select or create an assignment to view submissions.';
    });
  }

  // ============ Release (Create/Update) ============
  if (btnRelease) {
    btnRelease.addEventListener('click', async () => {
      const topic = topicInput.value.trim();
      const desc  = descInput.innerHTML.trim();
      const dueDate = metaDueDate.value;
      const startTime = metaStart.value;
      const endTime = metaEnd.value;
      const classId = metaClass.value;

      if (!topic)   { alert('Topic is required'); topicInput.focus(); return; }
      if (!dueDate) { alert('Due Date is required'); metaDueDate.focus(); return; }
      if (!classId) { alert('Please select a class'); metaClass.focus(); return; }

      const payload = {
        subject: topic,
        description: desc,
        due_date: dueDate,
        class_id: parseInt(classId),
        lecturer_id: userId,
        start_time: startTime + ':00',
        end_time: endTime + ':00',
        status: 'released',
        file_name: uploadedFile?.name || null,
        file_type: uploadedFile?.type || null,
        file_data: uploadedFile?.data || null,
        url_link: uploadedUrl || null
      };

      btnRelease.disabled = true;
      btnRelease.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Releasing...';

      let res;
      if (editingId) {
        res = await API.put(`/api/assignments/${editingId}`, payload);
      } else {
        res = await API.post('/api/assignments', payload);
      }

      btnRelease.disabled = false;
      btnRelease.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Release';

      if (!res.success) {
        alert('Failed: ' + res.error);
        return;
      }

      alert(editingId ? 'Assignment updated!' : 'Assignment released!');
      editingId = null;
      receivedHint.innerText = `Assignment "${topic}" published. Click View to see submissions.`;
      loadAssignmentsList();
    });
  }

  // ============ Submissions view ============
  let allAssignments = [];

  async function loadAssignmentsList() {
    const res = await API.get(`/api/assignments/lecturer/${userId}`);
    if (!res.success) return;
    allAssignments = res.data;
  }

  if (btnViewSubs) {
    btnViewSubs.addEventListener('click', async () => {
      await loadAssignmentsList();
      if (allAssignments.length === 0) {
        alert('No assignments created yet. Create one first.');
        return;
      }
      // Show pick modal
      pickList.innerHTML = allAssignments.map(a => `
        <div class="pick-item" data-id="${a.id}">
          ${a.subject}
          <small>Due ${new Date(a.due_date).toLocaleDateString('en-GB')}</small>
        </div>
      `).join('');
      pickModal.style.display = 'flex';
    });
  }

  if (pickClose) {
    pickClose.addEventListener('click', () => pickModal.style.display = 'none');
  }

  if (pickList) {
    pickList.addEventListener('click', (e) => {
      const item = e.target.closest('.pick-item');
      if (!item) return;
      const id = item.dataset.id;
      const assignment = allAssignments.find(a => String(a.id) === String(id));
      if (assignment) {
        currentAssignmentForSubs = assignment;
        pickModal.style.display = 'none';
        openSubmissionsModal(assignment);
      }
    });
  }

  async function openSubmissionsModal(assignment) {
    submissionsList.innerHTML = '<p class="submissions-empty">Loading...</p>';
    submissionsModal.style.display = 'flex';

    const res = await API.get(`/api/submissions/${assignment.id}`);
    if (!res.success) {
      submissionsList.innerHTML = `<p class="submissions-empty" style="color:#f87171;">Failed: ${res.error}</p>`;
      return;
    }

    const subs = res.data;
    if (subs.length === 0) {
      submissionsList.innerHTML = '<p class="submissions-empty">No submissions yet.</p>';
      return;
    }

    submissionsList.innerHTML = subs.map(s => `
      <div class="submission-row">
        <div class="submission-email">
          <i class="fa-solid fa-envelope"></i>
          ${s.student_email || s.student_id}
        </div>
        <div class="submission-time">${fmtDateTime(s.submitted_at)}</div>
        <button class="submission-download" data-id="${s.id}" title="Download">
          <i class="fa-solid fa-download"></i>
        </button>
      </div>
    `).join('');
  }

  // Download individual submission
  if (submissionsList) {
    submissionsList.addEventListener('click', async (e) => {
      const btn = e.target.closest('.submission-download');
      if (!btn) return;
      const id = btn.dataset.id;
      const res = await API.get(`/api/submissions/item/${id}`);
      if (!res.success || !res.data) {
        alert('Failed to load submission');
        return;
      }
      downloadFile(res.data.file_name, res.data.file_data);
    });
  }

  function downloadFile(filename, dataUrl) {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename || 'submission';
    a.click();
  }

  // ============ Close submissions ============
  if (submissionsClose) submissionsClose.addEventListener('click', () => submissionsModal.style.display = 'none');
  if (submissionsCloseBtn) submissionsCloseBtn.addEventListener('click', () => submissionsModal.style.display = 'none');
  if (submissionsModal) {
    submissionsModal.addEventListener('click', (e) => {
      if (e.target === submissionsModal) submissionsModal.style.display = 'none';
    });
  }

  // ============ Download All (as ZIP) ============
  if (btnDownloadAll) {
    btnDownloadAll.addEventListener('click', async () => {
      if (!currentAssignmentForSubs) return;

      const res = await API.get(`/api/submissions/${currentAssignmentForSubs.id}`);
      if (!res.success || res.data.length === 0) {
        alert('No submissions to download');
        return;
      }

      // Check JSZip availability
      if (typeof JSZip === 'undefined') {
        alert('ZIP library not loaded. Download individually.');
        return;
      }

      const zip = new JSZip();
      const folder = zip.folder(`assignment_${currentAssignmentForSubs.id}`);

      btnDownloadAll.disabled = true;
      btnDownloadAll.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Zipping...';

      for (const s of res.data) {
        // Fetch file data for each
        const itemRes = await API.get(`/api/submissions/item/${s.id}`);
        if (itemRes.success && itemRes.data && itemRes.data.file_data) {
          const parts = itemRes.data.file_data.split(',');
          const base64 = parts[1] || parts[0];
          const filename = `${s.student_email || s.student_id}_${itemRes.data.file_name || 'file'}`;
          folder.file(filename, base64, { base64: true });
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assignment_${currentAssignmentForSubs.id}_submissions.zip`;
      a.click();
      URL.revokeObjectURL(url);

      btnDownloadAll.disabled = false;
      btnDownloadAll.innerHTML = '<i class="fa-solid fa-download"></i> Download All';
    });
  }

  // ============ Init ============
  loadClasses();
  loadAssignmentsList();

  // Prefill date
  if (metaDate) metaDate.value = todayISO();
  if (metaDueDate) metaDueDate.value = todayISO();
}

window.initAssignments = initAssignments;