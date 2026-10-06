
/* [A6] Escape-close bound once at module scope; initReminders() re-runs on
   every visit to the view and previously stacked one document listener
   per visit. */
if (!window.__remindersEscapeBound) {
  window.__remindersEscapeBound = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const deleteModal = document.getElementById('delete-reminder-modal');
    if (deleteModal?.style.display === 'flex') { deleteModal.style.display = 'none'; return; }
    const modal = document.getElementById('reminder-modal');
    if (modal?.style.display === 'flex') {
      modal.style.display = 'none';
      document.getElementById('reminder-form')?.reset();
      const inputId = document.getElementById('reminder-id');
      if (inputId) inputId.value = '';
    }
  });
}

function initReminders() {
  const list = document.getElementById('reminders-list');
  const addBtn = document.getElementById('btn-add-reminder');

  const modal       = document.getElementById('reminder-modal');
  const modalTitle  = document.getElementById('reminder-modal-title');
  const form        = document.getElementById('reminder-form');
  const closeBtn    = document.getElementById('reminder-modal-close');
  const cancelBtn   = document.getElementById('reminder-modal-cancel');
  const saveBtn     = document.getElementById('reminder-modal-save');

  const inputId    = document.getElementById('reminder-id');
  const inputTitle = document.getElementById('reminder-title');
  const inputDesc  = document.getElementById('reminder-desc');
  const inputDate  = document.getElementById('reminder-date');
  const inputTime  = document.getElementById('reminder-time');
  const inputPri   = document.getElementById('reminder-priority');

  const deleteModal = document.getElementById('delete-reminder-modal');
  const deleteName  = document.getElementById('delete-reminder-name');
  const deleteYes   = document.getElementById('delete-reminder-yes');
  const deleteNo    = document.getElementById('delete-reminder-no');
  const deleteClose = document.getElementById('delete-reminder-close');

  const _u = AppStorage.getUser();
  const studentId = _u
    ? (_u.student_id || _u.lecturer_id || _u.admin_id || _u.identifier)
    : null;

  let reminders = [];
  let pendingDeleteId = null;

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function fmtTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}.${String(m).padStart(2, '0')} ${ampm}`;
  }

  function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function daysUntil(dateStr, timeStr) {
    if (!dateStr) return null;
    const dt = new Date(`${dateStr}T${timeStr || '00:00:00'}`);
    const diff = dt - new Date();
    return Math.ceil(diff / 86400000);
  }

  function countdownLabel(dateStr, timeStr) {
    if (!dateStr) return { label: 'No date', cls: 'gray' };
    const dt = new Date(`${dateStr}T${timeStr || '00:00:00'}`);
    const now = new Date();
    const diffMs = dt - now;

    if (diffMs < 0) return { label: 'Expired', cls: 'gray' };

    const days = Math.floor(diffMs / 86400000);
    const hrs  = Math.floor((diffMs % 86400000) / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);

    if (days >= 1) return { label: `${days} day${days === 1 ? '' : 's'} left`, cls: days <= 2 ? 'red' : days <= 7 ? 'yellow' : 'blue' };
    if (hrs >= 1)  return { label: `${hrs} hour${hrs === 1 ? '' : 's'} left`, cls: 'yellow' };
    if (mins >= 1) return { label: `${mins} min left`, cls: 'yellow' };
    return { label: 'Due now', cls: 'red' };
  }

  function render() {
    if (!list) return;
    if (reminders.length === 0) {
      list.innerHTML = `
        <div class="reminders-empty">
          <i class="fa-regular fa-bell" style="font-size:1.8rem;opacity:0.4;display:block;margin-bottom:12px;"></i>
          No active reminders. Click <strong>Add Reminder</strong> to create one.
        </div>`;
      return;
    }

    list.innerHTML = reminders.map(r => {
      const cd = countdownLabel(r.remind_date, r.remind_time);
      return `
        <div class="reminder-card ${r.priority || 'normal'}">
          <div class="reminder-icon">
            <i class="fa-solid ${r.priority === 'urgent' ? 'fa-triangle-exclamation' : r.priority === 'warning' ? 'fa-graduation-cap' : 'fa-bell'}"></i>
          </div>
          <div class="reminder-details">
            <h4>${escapeHtml(r.title)}</h4>
            ${r.description ? `<p>${escapeHtml(r.description)}</p>` : ''}
            <span class="reminder-time">
              <i class="fa-regular fa-clock"></i>
              ${fmtDate(r.remind_date)} at ${fmtTime(r.remind_time)}
            </span>
          </div>
          <div class="reminder-actions">
            <span class="status-tag ${cd.cls}">${cd.label}</span>
            <button class="icon-btn-danger" data-action="delete" data-id="${r.id}" title="Delete">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  async function load() {
    if (!studentId) {
      if (list) list.innerHTML = '<div class="reminders-empty">Please log in.</div>';
      return;
    }
    const res = await API.get(`/api/reminders/${studentId}`);
    if (!res.success) {
      if (list) list.innerHTML = `<div class="reminders-empty" style="color:#f87171;">Failed: ${res.error}</div>`;
      return;
    }
    reminders = res.data;
    render();
  }

  function openModal(mode = 'add', r = null) {
    if (mode === 'edit' && r) {
      modalTitle.innerText = 'Edit Reminder';
      saveBtn.innerText = 'Save';
      inputId.value    = r.id;
      inputTitle.value = r.title || '';
      inputDesc.value  = r.description || '';
      inputDate.value  = r.remind_date ? r.remind_date.slice(0, 10) : '';
      inputTime.value  = (r.remind_time || '00:00:00').slice(0, 5);
      inputPri.value   = r.priority || 'normal';
    } else {
      modalTitle.innerText = 'Add Reminder';
      saveBtn.innerText = 'Add';
      form.reset();
      inputId.value = '';
      const now = new Date();
      inputDate.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      inputTime.value = '00:00';
      inputPri.value = 'normal';
    }
    modal.style.display = 'flex';
    setTimeout(() => inputTitle.focus(), 50);
  }

  function closeModal() {
    modal.style.display = 'none';
    form.reset();
    inputId.value = '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      student_id: studentId,
      title: inputTitle.value.trim(),
      description: inputDesc.value.trim(),
      remind_date: inputDate.value,
      remind_time: inputTime.value + ':00',
      priority: inputPri.value
    };
    if (!payload.title || !payload.remind_date) return;

    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';

    const res = inputId.value
      ? await API.put(`/api/reminders/${inputId.value}`, payload)
      : await API.post('/api/reminders', payload);

    saveBtn.disabled = false;
    saveBtn.innerText = inputId.value ? 'Save' : 'Add';

    if (!res.success) { alert('Save failed: ' + res.error); return; }
    closeModal();
    load();
  });

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    const id = btn.dataset.id;
    const r = reminders.find(x => String(x.id) === String(id));
    if (!r) return;
    pendingDeleteId = id;
    deleteName.innerText = `"${r.title}" will be permanently deleted.`;
    deleteModal.style.display = 'flex';
  });

  deleteYes.addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    const res = await API.delete(`/api/reminders/${pendingDeleteId}`);
    if (res.success) {
      deleteModal.style.display = 'none';
      pendingDeleteId = null;
      load();
    } else {
      alert('Delete failed: ' + res.error);
    }
  });

  deleteNo.addEventListener('click', () => { deleteModal.style.display = 'none'; pendingDeleteId = null; });
  deleteClose.addEventListener('click', () => { deleteModal.style.display = 'none'; pendingDeleteId = null; });
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) { deleteModal.style.display = 'none'; pendingDeleteId = null; }
  });

  addBtn.addEventListener('click', () => openModal('add'));
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  load();
}

window.initReminders = initReminders;