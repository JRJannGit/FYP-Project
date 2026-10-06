/* [A6] Escape-close bound once at module scope; initAssignments() re-runs on
   every visit to the view and previously stacked one document listener
   per visit. */
if (!window.__assignmentsEscapeBound) {
  window.__assignmentsEscapeBound = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal = document.getElementById('assignment-modal');
    const submitModal = document.getElementById('submit-modal');
    if (modal?.style.display === 'flex') {
      modal.style.display = 'none';
      document.getElementById('assignment-form')?.reset();
      const inputId = document.getElementById('assignment-id');
      if (inputId) inputId.value = '';
    }
    if (submitModal?.style.display === 'flex') submitModal.style.display = 'none';
  });
}

/* [FIX 2] Overlay watchdog: a modal overlay that is hidden (display:none /
   visibility:hidden) must never keep intercepting pointer events. Some
   Chromium renderer states leave exactly that condition behind, making
   subsequent clicks on inputs dead until a force reload. This sweep runs
   every 400ms and neutralises any such overlay. */
function ensureNoStuckOverlays() {
  document.querySelectorAll('.modal-overlay').forEach(function (el) {
    const hidden = el.style.display === 'none' ||
                   getComputedStyle(el).display === 'none' ||
                   el.style.visibility === 'hidden';
    if (hidden) {
      el.style.pointerEvents = 'none';
      el.style.visibility = 'hidden';
    } else {
      el.style.pointerEvents = '';
      el.style.visibility = '';
    }
  });
}

async function initAssignments() {
  const list       = document.getElementById('assignments-list');
  const emptyState = document.getElementById('assignments-empty');
  const addBtn     = document.getElementById('open-add-modal');

  const modal       = document.getElementById('assignment-modal');
  const modalTitle  = document.getElementById('assignment-modal-title');
  const form        = document.getElementById('assignment-form');
  const closeBtn    = document.getElementById('assignment-modal-close');
  const cancelBtn   = document.getElementById('assignment-modal-cancel');
  const saveBtn     = document.getElementById('assignment-modal-save');

  const inputId     = document.getElementById('assignment-id');
  const inputSubject= document.getElementById('assignment-subject');
  const inputDesc   = document.getElementById('assignment-desc');
  const inputDue    = document.getElementById('assignment-due');
  const inputExam   = document.getElementById('assignment-exam');

  // Submission modal (new)
  const submitModal    = document.getElementById('submit-modal');
  const submitClose    = document.getElementById('submit-modal-close');
  const submitCancel   = document.getElementById('submit-modal-cancel');
  const submitForm     = document.getElementById('submit-form');
  const submitFile     = document.getElementById('submit-file-input');
  const submitFileName = document.getElementById('submit-file-name');
  const submitBtn      = document.getElementById('submit-modal-save');
  const submitTarget   = document.getElementById('submit-target-title');

  let currentFilter = 'all';
  let allAssignments = [];
  let submitTargetId = null;

  /* [FIX 1] Inline submit-failure notice (replaces the blocking alert). */
  function showSubmitError(msg) {
    const el = document.getElementById('submit-modal-error');
    if (!el) { alert(msg); return; }
    el.textContent = msg;
    el.style.display = 'flex';
    setTimeout(function () { el.style.display = 'none'; }, 8000);
  }

  /* [ENROL] In-page notice popup for the enrolment flow. Local copy of the
     timetable view's showNotice (no showNotice exists in this file).
     Anchored inside the enrolment section so it scrolls with the content. */
  function showNotice(type, title, message, durationMs) {
    const old = document.getElementById('assignments-notice');
    if (old) old.remove();
    const notice = document.createElement('div');
    notice.id = 'assignments-notice';
    notice.className = 'timetable-notice notice-' + (type || 'info');
    const iconName = {
      error: 'fa-circle-exclamation',
      warning: 'fa-triangle-exclamation',
      success: 'fa-circle-check',
      info: 'fa-circle-info'
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
    const section = document.querySelector('.assignments-enrolment-section');
    if (section) section.insertBefore(notice, section.firstChild);
    else document.body.appendChild(notice);
    const dur = (typeof durationMs === 'number') ? durationMs : 8000;
    if (dur > 0) {
      setTimeout(function () {
        if (notice.parentNode) notice.remove();
      }, dur);
    }
  }

  /* [FIX 1] In-page confirm dialog — replaces the native browser confirm
     dialog, which both looks wrong in the dark theme and leaves the
     Chromium renderer in a state where later input clicks are swallowed
     until a force reload. */
  function showConfirmModal(opts) {
    const existing = document.getElementById('assignments-confirm-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'assignments-confirm-modal';
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';

    const box = document.createElement('div');
    box.className = 'modal-box modal-box--small';

    const title = document.createElement('h3');
    title.textContent = opts.title || 'Confirm';

    const msg = document.createElement('p');
    msg.className = 'modal-text';
    msg.textContent = opts.message || '';

    const actions = document.createElement('div');
    actions.className = 'modal-actions modal-actions--center';

    const btnNo = document.createElement('button');
    btnNo.type = 'button';
    btnNo.className = 'btn-cancel';
    btnNo.textContent = opts.cancelLabel || 'Cancel';

    const btnYes = document.createElement('button');
    btnYes.type = 'button';
    btnYes.className = 'btn-danger';
    btnYes.textContent = opts.confirmLabel || 'Yes';

    actions.appendChild(btnNo);
    actions.appendChild(btnYes);

    box.appendChild(title);
    box.appendChild(msg);
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
    btnYes.addEventListener('click', function () {
      close();
      if (opts.onConfirm) opts.onConfirm();
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', onKey);

    setTimeout(function () { btnYes.focus(); }, 30);
  }

  /* [FIX 3] The submit-modal markup lives in views/assignments.html (not
     editable from this task), so the styled file-label wrapper and the
     inline error element are injected at init time. Idempotent: safe on
     every initAssignments() run. */
  function ensureSubmitModalChrome() {
    if (!submitModal || !submitFile) return;

    if (!document.getElementById('submit-modal-error')) {
      const err = document.createElement('div');
      err.id = 'submit-modal-error';
      err.className = 'submit-modal-error';
      err.style.display = 'none';
      const actions = submitModal.querySelector('.modal-actions');
      if (actions && actions.parentNode) {
        actions.parentNode.insertBefore(err, actions);
      } else {
        const box = submitModal.querySelector('.modal-box');
        if (box) box.appendChild(err);
      }
    }

    if (submitFileName) {
      submitFileName.classList.add('submit-modal-file-name');
      submitFileName.removeAttribute('style');
      submitFileName.style.display = 'block';
    }

    if (!submitFile.classList.contains('submit-modal-file-input')) {
      submitFile.classList.add('submit-modal-file-input');
    }
    if (!submitFile.parentElement.classList.contains('submit-modal-file-label')) {
      const wrap = document.createElement('label');
      wrap.className = 'submit-modal-file-label';
      wrap.innerHTML = '<i class="fa-solid fa-upload"></i><span>Choose a file</span>';
      submitFile.parentNode.insertBefore(wrap, submitFile);
      wrap.appendChild(submitFile);
    }
  }

  ensureSubmitModalChrome();

  function getUserId() {
    const user = AppStorage.getUser();
    if (!user) return null;
    return user.student_id || user.lecturer_id || user.admin_id || user.identifier || null;
  }

  let currentUserId = getUserId();

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = parseDateOnly(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    return Math.ceil((parseDateOnly(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  }

  function badgeClass(days) {
    if (days === null || days < 0) return 'due-soon';
    if (days <= 3) return 'due-soon';
    if (days <= 7) return 'due-medium';
    return 'due-normal';
  }

  function renderAssignments() {
    if (!list) return;

    let filtered = allAssignments;
    if (currentFilter === 'upcoming')  filtered = allAssignments.filter(a => !a.completed);
    if (currentFilter === 'completed') filtered = allAssignments.filter(a => a.completed);

    if (filtered.length === 0) {
      list.innerHTML = '';
      list.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    list.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    list.innerHTML = `
      <div class="assignments-table">
        <div class="assignments-table-header">
          <div>Subject</div>
          <div>Due Date</div>
          <div style="text-align:right;">Action</div>
        </div>
        ${filtered.map(a => {
          const days = daysUntil(a.due_date);
          const completed = !!a.completed;
          const badge = completed ? '' : (
            days !== null && days >= 0
              ? `<span class="badge ${badgeClass(days)}">${days} day${days === 1 ? '' : 's'} left</span>`
              : (days !== null && days < 0
                  ? `<span class="badge due-soon">overdue</span>`
                  : '')
          );

          return `
            <div class="assignment-row ${completed ? 'completed' : ''}" data-id="${a.id}">
              <div class="assignment-subject">
                <input type="checkbox" ${completed ? 'checked' : ''} data-action="toggle" data-id="${a.id}">
                <div>
                  <h4>
                    ${escapeHtml(a.subject)}
                    ${a.is_exam ? '<span class="exam-tag">EXAM</span>' : ''}
                  </h4>
                  <p>${escapeHtml(a.description || '')}</p>
                </div>
              </div>
              <div class="assignment-due">
                ${formatDate(a.due_date)}
                ${badge ? `<small>${badge}</small>` : ''}
              </div>
              <div class="assignment-actions">
                <button class="icon-btn" data-action="submit" data-id="${a.id}" title="Submit">
                  <i class="fa-solid fa-upload"></i>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async function loadAssignments() {
    if (!currentUserId) {
      list.innerHTML = '<p style="padding:20px;color:var(--text-muted);">Please log in to view assignments.</p>';
      return;
    }
    const res = await API.get(`/api/assignments/student/${currentUserId}`);
    if (!res.success) {
      list.innerHTML = `<p style="padding:20px;color:#f87171;">Failed to load: ${res.error}</p>`;
      return;
    }
    allAssignments = res.data;
    renderAssignments();
  }

  function openModal(mode = 'add', assignment = null) {
    if (mode === 'edit' && assignment) {
      modalTitle.innerText = 'Edit Assignment';
      inputId.value      = assignment.id;
      inputSubject.value = assignment.subject;
      inputDesc.value    = assignment.description || '';
      inputDue.value     = assignment.due_date ? assignment.due_date.slice(0, 10) : '';
      inputExam.checked  = !!assignment.is_exam;
    } else {
      modalTitle.innerText = 'Add Assignment';
      form.reset();
      inputId.value = '';
    }
    modal.style.display = 'flex';
    setTimeout(() => inputSubject.focus(), 50);
  }

  function closeModal() {
    modal.style.display = 'none';
    form.reset();
    inputId.value = '';
  }

  function openSubmitModal(assignment) {
    if (!submitModal) return;
    submitTargetId = assignment.id;
    if (submitTarget) submitTarget.innerText = assignment.subject;
    if (submitForm) submitForm.reset();
    if (submitFileName) submitFileName.innerText = 'No file chosen';
    const fileLabel = submitModal.querySelector('.submit-modal-file-label');
    if (fileLabel) fileLabel.classList.remove('has-file');
    if (submitFileName) submitFileName.classList.remove('has-file');
    submitModal.style.display = 'flex';
  }

  function closeSubmitModal() {
    if (!submitModal) return;
    submitModal.style.display = 'none';
    submitTargetId = null;
  }

  /* [FIX 2] Force-recover wrappers: run the overlay sweep right after
     every known modal close. */
  function closeModalSafely() {
    closeModal();
  }
  function closeSubmitModalSafely() {
    closeSubmitModal();
  }

  if (submitFile) {
    submitFile.addEventListener('change', function () {
      const f = submitFile.files[0];
      const labelEl = document.querySelector('.submit-modal-file-label');
      const nameEl  = document.getElementById('submit-file-name');
      if (labelEl) labelEl.classList.toggle('has-file', !!f);
      if (nameEl) {
        nameEl.textContent = f ? f.name : 'No file chosen';
        nameEl.classList.toggle('has-file', !!f);
      }
    });
  }

  if (submitForm) {
    submitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!submitTargetId) return;
      const file = submitFile.files[0];
      if (!file) { alert('Please choose a file to submit.'); return; }

      if (file.size > 10 * 1024 * 1024) {
        alert('File too large. Max 10MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (ev) => {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Submitting...';
        const res = await API.post('/api/submissions', {
          assignment_id: submitTargetId,
          student_id: currentUserId,
          file_name: file.name,
          file_type: file.type,
          file_data: ev.target.result
        });
        submitBtn.disabled = false;
        submitBtn.innerText = 'Submit';
        if (!res.success) { showSubmitError('Submit failed: ' + res.error); return; }
        closeSubmitModal();
        alert('Submitted successfully!');
      };
      reader.readAsDataURL(file);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      subject: inputSubject.value.trim(),
      description: inputDesc.value.trim(),
      due_date: inputDue.value,
      is_exam: inputExam.checked
    };
    if (!payload.subject || !payload.due_date) return;

    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';

    let res;
    if (inputId.value) {
      res = await API.put(`/api/assignments/${inputId.value}`, payload);
    } else {
      res = await API.post('/api/assignments', payload);
    }

    saveBtn.disabled = false;
    saveBtn.innerText = 'Save';

    if (!res.success) {
      alert('Save failed: ' + res.error);
      return;
    }
    closeModal();
    loadAssignments();
  });

  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id     = btn.dataset.id;

    if (action === 'submit') {
      const assignment = allAssignments.find(a => String(a.id) === String(id));
      if (assignment) openSubmitModal(assignment);
    }
  });

  list.addEventListener('change', async (e) => {
    const chk = e.target.closest('input[data-action="toggle"]');
    if (!chk) return;
    const id = chk.dataset.id;
    const completed = chk.checked;
    const res = await API.post(`/api/assignments/${id}/toggle`, {
      student_id: currentUserId,
      completed
    });
    if (res.success) loadAssignments();
    else alert('Toggle failed: ' + res.error);
  });

  if (addBtn) addBtn.addEventListener('click', () => openModal('add'));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (submitClose) submitClose.addEventListener('click', closeSubmitModal);
  if (submitCancel) submitCancel.addEventListener('click', closeSubmitModal);
  if (submitModal) {
    submitModal.addEventListener('click', (e) => {
      if (e.target === submitModal) closeSubmitModal();
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderAssignments();
    });
  });

  currentUserId = getUserId();
  loadAssignments();

  /* ---------- Student enrolment ---------- */
  const enrolInput     = document.getElementById('enrol-class-code');
  const btnFindClass   = document.getElementById('btn-find-class');
  const sectionsBox    = document.getElementById('enrol-sections');
  const sectionsList   = document.getElementById('enrol-sections-list');
  const classTitle     = document.getElementById('enrol-class-title');
  const enrolledList   = document.getElementById('timetable-enrolled-list');

  async function loadEnrolledClasses() {
    if (!enrolledList) return;
    const uid = currentUserId;
    if (!uid) {
      enrolledList.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;">Please log in.</p>';
      return;
    }
    const res = await API.get('/api/enrollments/student/' + uid);
    if (!res.success || !res.data || res.data.length === 0) {
      enrolledList.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;">No classes enrolled yet.</p>';
      return;
    }
    enrolledList.innerHTML = res.data.map(function (c) {
      return '<div class="saved-row enrolled-row" data-enrol-id="' + c.enrollment_id + '">' +
        '<span class="saved-day">' + escapeHtml(c.class_code || '—') + '</span>' +
        '<span class="saved-time">' + escapeHtml(c.section_name || 'No section') + '</span>' +
        '<span class="saved-subject">' + escapeHtml(c.class_name || '') + '</span>' +
        '<span class="saved-room">' + escapeHtml(c.lecturer_name || '') + '</span>' +
        '<button class="saved-delete" data-enrol-id="' + c.enrollment_id + '" title="Leave">' +
        '<i class="fa-solid fa-right-from-bracket"></i></button></div>';
    }).join('');
  }

  if (enrolInput && btnFindClass) {
    btnFindClass.addEventListener('click', async function () {
      const code = (enrolInput.value || '').trim().toUpperCase();
      if (!code) return;
      btnFindClass.disabled = true;
      btnFindClass.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      const res = await API.get('/api/classes/by-code/' + encodeURIComponent(code));
      btnFindClass.disabled = false;
      btnFindClass.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Find';

      if (!res.success) {
        showNotice('error', 'Class not found',
          'No class with code "' + escapeHtml(code) + '". Check the code and try again.', 0);
        sectionsBox.style.display = 'none';
        return;
      }

      const data = res.data;
      classTitle.textContent = data.class_code + ' — ' + data.class_name +
        (data.lecturer_name ? ' · ' + data.lecturer_name : '');

      if (!data.sections || data.sections.length === 0) {
        sectionsList.innerHTML =
          '<p style="color:var(--text-muted);font-size:0.82rem;">' +
          'This class has no sections yet. Ask your lecturer to create one.</p>';
      } else {
        sectionsList.innerHTML = data.sections.map(function (s) {
          return '<div class="enrol-section-row">' +
            '<div class="enrol-section-info">' +
              '<strong>' + escapeHtml(s.section_name) + '</strong>' +
              '<small>' + s.enrolled_count + ' / ' + s.capacity + ' enrolled</small>' +
            '</div>' +
            '<button class="btn-import enrol-section-btn" data-section-id="' + s.id + '">' +
              'Join</button>' +
          '</div>';
        }).join('');
      }
      sectionsBox.style.display = 'block';
    });
  }

  if (sectionsList) {
    sectionsList.addEventListener('click', async function (e) {
      const btn = e.target.closest('.enrol-section-btn');
      if (!btn) return;
      const sectionId = btn.dataset.sectionId;
      const code = (enrolInput.value || '').trim().toUpperCase();
      if (!code) return;
      btn.disabled = true;
      const res = await API.post('/api/enrollments/by-code', {
        class_code: code,
        section_id: parseInt(sectionId, 10)
      });
      btn.disabled = false;
      if (!res.success) {
        showNotice('error', 'Enrolment failed', escapeHtml(res.error || 'Unknown error'), 0);
        return;
      }
      showNotice('success', 'Joined ' + escapeHtml(code),
        'You are now enrolled in this class.', 5000);
      sectionsBox.style.display = 'none';
      enrolInput.value = '';
      await loadEnrolledClasses();
    });
  }

  if (enrolledList) {
    enrolledList.addEventListener('click', async function (e) {
      const btn = e.target.closest('.saved-delete');
      if (!btn) return;
      if (!confirm('Leave this class?')) return;
      const res = await API.delete('/api/enrollments/self/' + btn.dataset.enrolId);
      if (res.success) loadEnrolledClasses();
      else showNotice('error', 'Leave failed', escapeHtml(res.error || 'Unknown error'), 0);
    });
  }

  await loadEnrolledClasses();
}

window.initAssignments = initAssignments;