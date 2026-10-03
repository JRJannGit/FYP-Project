
function initAssignments() {
  console.log('[Lecturer Assignments] init');

  const user = AppStorage.getUser();
  const role = Auth.getRole();
  const userId = user?.lecturer_id || user?.admin_id || user?.identifier || '';

  const topicInput  = document.getElementById('topic-input');
  const descInput   = document.getElementById('desc-input');
  const metaDate    = document.getElementById('meta-date');
  const metaDueDate = document.getElementById('meta-due-date');
  const metaStart   = document.getElementById('meta-start-time');
  const metaEnd     = document.getElementById('meta-end-time');
  const metaClass   = document.getElementById('meta-class');

  const btnUploadFile = document.getElementById('btn-upload-file');
  const btnInsertUrl  = document.getElementById('btn-insert-url');
  const fileInput     = document.getElementById('assignment-file-input');

  const uploadPreview = document.getElementById('upload-preview');
  const previewName   = document.getElementById('preview-name');
  const previewRemove = document.getElementById('preview-remove');

  const btnEditToggle = document.getElementById('btn-edit-toggle');
  const btnRelease    = document.getElementById('btn-release');
  const btnReset      = document.getElementById('btn-reset');

  const btnViewSubs  = document.getElementById('btn-view-submissions');
  const receivedHint = document.getElementById('received-hint');

  const submissionsModal    = document.getElementById('submissions-modal');
  const submissionsList     = document.getElementById('submissions-list');
  const submissionsClose    = document.getElementById('submissions-close');
  const submissionsCloseBtn = document.getElementById('submissions-close-btn');
  const btnDownloadAll      = document.getElementById('btn-download-all');

  const pickModal = document.getElementById('pick-assignment-modal');
  const pickList  = document.getElementById('pick-assignment-list');
  const pickClose = document.getElementById('pick-assignment-close');

  const urlModal  = document.getElementById('url-input-modal');
  const urlField  = document.getElementById('url-input-field');
  const urlError  = document.getElementById('url-error');
  const urlSave   = document.getElementById('url-input-save');
  const urlCancel = document.getElementById('url-input-cancel');
  const urlClose  = document.getElementById('url-input-close');

  let uploadedFile = null;
  let uploadedUrl  = '';
  let editingId    = null;
  let currentAssignmentForSubs = null;
  let allAssignments = [];

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function fmtTimeOnly(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}.${String(m).padStart(2, '0')} ${ampm}`;
  }

  async function loadClasses() {
    if (!metaClass) return;
    try {
      const res = await fetch(`http://localhost:3000/api/lecturer/classes/${userId}`);
      const data = await res.json();
      if (!data.success) return;
      metaClass.innerHTML = '<option value="">Select class...</option>' +
        data.data.map(c => `<option value="${c.id}">${c.class_code} — ${c.class_name}</option>`).join('');
    } catch (err) {
      console.warn('[Classes] Load failed:', err);
    }
  }

  if (btnEditToggle && descInput) {
    descInput.setAttribute('contenteditable', 'false');
    btnEditToggle.addEventListener('click', () => {
      const isEditing = descInput.getAttribute('contenteditable') === 'true';
      const next = !isEditing;
      descInput.setAttribute('contenteditable', next ? 'true' : 'false');
      btnEditToggle.innerHTML = next
        ? '<i class="fa-solid fa-check"></i> Done'
        : '<i class="fa-solid fa-pen"></i> Edit';
      if (next) descInput.focus();
    });
  }

  document.querySelectorAll('.lecturer-toolbar .tool-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!descInput) return;
      descInput.setAttribute('contenteditable', 'true');
      descInput.focus();
      try { document.execCommand(btn.dataset.cmd, false, null); }
      catch (err) { console.warn('execCommand failed:', err); }
    });
  });

  if (btnUploadFile && fileInput) {
    btnUploadFile.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        alert('File too large. Max 10MB.');
        e.target.value = '';
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

  function openUrlModal() {
    if (!urlModal) {
      console.error('[URL Modal] element not found');
      return;
    }
    if (urlField) urlField.value = uploadedUrl || '';
    hideUrlError();
    urlModal.style.display = 'flex';
    setTimeout(() => urlField?.focus(), 60);
  }

  function closeUrlModal() {
    if (!urlModal) return;
    urlModal.style.display = 'none';
    hideUrlError();
  }

  function showUrlError(msg) {
    if (!urlError) return;
    urlError.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i><span>${msg}</span>`;
    urlError.style.display = 'flex';
  }

  function hideUrlError() {
    if (!urlError) return;
    urlError.style.display = 'none';
  }

  function saveUrl() {
    const url = (urlField?.value || '').trim();
    if (!url) {
      showUrlError('URL is required');
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      showUrlError('URL must start with http:// or https://');
      return;
    }
    uploadedUrl = url;
    uploadedFile = null;
    showPreview(url, 'link');
    closeUrlModal();
  }

  if (btnInsertUrl) {
    btnInsertUrl.addEventListener('click', openUrlModal);
    console.log('[URL Modal] button wired');
  } else {
    console.warn('[URL Modal] btn-insert-url not found');
  }

  if (urlSave)   urlSave.addEventListener('click', saveUrl);
  if (urlCancel) urlCancel.addEventListener('click', closeUrlModal);
  if (urlClose)  urlClose.addEventListener('click', closeUrlModal);

  if (urlField) {
    urlField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveUrl(); }
      if (e.key === 'Escape') { e.preventDefault(); closeUrlModal(); }
    });
  }

  if (urlModal) {
    urlModal.addEventListener('click', (e) => {
      if (e.target === urlModal) closeUrlModal();
    });
  }

  function showPreview(name, type) {
    if (!uploadPreview) return;
    uploadPreview.style.display = 'flex';
    if (previewName) previewName.innerText = name;
    const icon = uploadPreview.querySelector('i');
    if (icon) {
      icon.className = type === 'link' ? 'fa-solid fa-link' : 'fa-solid fa-paperclip';
    }
  }

  function hidePreview() {
    if (!uploadPreview) return;
    uploadPreview.style.display = 'none';
    if (previewName) previewName.innerText = '';
  }

  if (previewRemove) {
    previewRemove.addEventListener('click', () => {
      uploadedFile = null;
      uploadedUrl = '';
      hidePreview();
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (!confirm('Reset all fields?')) return;
      if (topicInput) topicInput.value = '';
      if (descInput) descInput.innerHTML = '';
      if (metaDate) metaDate.value = todayISO();
      if (metaDueDate) metaDueDate.value = todayISO();
      if (metaStart) metaStart.value = '09:00';
      if (metaEnd) metaEnd.value = '17:00';
      if (metaClass) metaClass.value = '';
      uploadedFile = null;
      uploadedUrl = '';
      editingId = null;
      hidePreview();
      if (receivedHint) receivedHint.innerText = 'Select or create an assignment to view submissions.';
    });
  }

  if (btnRelease) {
    btnRelease.addEventListener('click', async () => {
      const topic = topicInput?.value.trim();
      const desc  = descInput?.innerHTML.trim();
      const dueDate = metaDueDate?.value;
      const startTime = metaStart?.value;
      const endTime = metaEnd?.value;
      const classId = metaClass?.value;

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
      if (receivedHint) receivedHint.innerText = `Assignment "${topic}" published. Click View to see submissions.`;
      loadAssignmentsList();
    });
  }

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
      if (!pickList || !pickModal) return;
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
    pickClose.addEventListener('click', () => { pickModal.style.display = 'none'; });
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
    if (!submissionsList || !submissionsModal) return;

    submissionsList.innerHTML = `
      <div class="submissions-empty">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <span>Loading...</span>
      </div>
    `;
    submissionsModal.style.display = 'flex';

    const res = await API.get(`/api/submissions/${assignment.id}`);
    if (!res.success) {
      submissionsList.innerHTML = `
        <div class="submissions-empty" style="color:#f87171;">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span>Failed to load</span>
          <small>${res.error}</small>
        </div>
      `;
      return;
    }

    const subs = res.data;

    if (!subs || subs.length === 0) {
      submissionsList.innerHTML = `
        <div class="submissions-empty">
          <i class="fa-regular fa-folder-open"></i>
          <span>Empty</span>
          <small>No submissions received yet.</small>
        </div>
      `;
      return;
    }

    submissionsList.innerHTML = subs.map((s, index) => `
      <div class="submission-row">
        <div class="submission-email">
          <span class="row-num">${index + 1}.</span>
          <span>${s.student_email || s.student_id}</span>
        </div>
        <div class="submission-time">${fmtTimeOnly(s.submitted_at)}</div>
        <button class="submission-download" data-id="${s.id}" title="Download">
          <i class="fa-solid fa-download"></i>
        </button>
      </div>
    `).join('');
  }

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

  if (submissionsClose) {
    submissionsClose.addEventListener('click', () => {
      submissionsModal.style.display = 'none';
    });
  }
  if (submissionsCloseBtn) {
    submissionsCloseBtn.addEventListener('click', () => {
      submissionsModal.style.display = 'none';
    });
  }
  if (submissionsModal) {
    submissionsModal.addEventListener('click', (e) => {
      if (e.target === submissionsModal) submissionsModal.style.display = 'none';
    });
  }

  if (btnDownloadAll) {
    btnDownloadAll.addEventListener('click', async () => {
      if (!currentAssignmentForSubs) return;

      const res = await API.get(`/api/submissions/${currentAssignmentForSubs.id}`);
      if (!res.success || res.data.length === 0) {
        alert('No submissions to download');
        return;
      }

      if (typeof JSZip === 'undefined') {
        alert('ZIP library not loaded. Download individually.');
        return;
      }

      const zip = new JSZip();
      const folder = zip.folder(`assignment_${currentAssignmentForSubs.id}`);

      btnDownloadAll.disabled = true;
      btnDownloadAll.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Zipping...';

      for (const s of res.data) {
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

  loadClasses();
  loadAssignmentsList();

  if (metaDate) metaDate.value = todayISO();
  if (metaDueDate) metaDueDate.value = todayISO();

  console.log('[Lecturer Assignments] initialized');
}

window.initAssignments = initAssignments;