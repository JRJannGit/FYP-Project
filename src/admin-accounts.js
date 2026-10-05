
function initAdminAccounts() {
  console.log('[Admin Accounts] init');

  const studentsList  = document.getElementById('students-list');
  const lecturersList = document.getElementById('lecturers-list');
  const studentsCount  = document.getElementById('students-count');
  const lecturersCount = document.getElementById('lecturers-count');
  const studentsSearch  = document.getElementById('students-search');
  const lecturersSearch = document.getElementById('lecturers-search');

  const addStudentBtn  = document.getElementById('btn-add-student');
  const addLecturerBtn = document.getElementById('btn-add-lecturer');

  /* ---- Student modal ---- */
  const studentModal  = document.getElementById('student-modal');
  const studentForm   = document.getElementById('student-form');
  const studentTitle  = document.getElementById('student-modal-title');
  const studentClose  = document.getElementById('student-modal-close');
  const studentCancel = document.getElementById('student-modal-cancel');
  const studentSave   = document.getElementById('student-modal-save');
  const studentId     = document.getElementById('student-id');
  const studentSid    = document.getElementById('student-sid');
  const studentName   = document.getElementById('student-name');
  const studentEmail  = document.getElementById('student-email');
  const studentPass   = document.getElementById('student-password');
  const studentHint   = document.getElementById('student-password-hint');

  /* ---- Lecturer modal ---- */
  const lecturerModal  = document.getElementById('lecturer-modal');
  const lecturerForm   = document.getElementById('lecturer-form');
  const lecturerTitle  = document.getElementById('lecturer-modal-title');
  const lecturerClose  = document.getElementById('lecturer-modal-close');
  const lecturerCancel = document.getElementById('lecturer-modal-cancel');
  const lecturerSave   = document.getElementById('lecturer-modal-save');
  const lecturerId     = document.getElementById('lecturer-id');
  const lecturerLid    = document.getElementById('lecturer-lid');
  const lecturerName   = document.getElementById('lecturer-name');
  const lecturerEmail  = document.getElementById('lecturer-email');
  const lecturerDept   = document.getElementById('lecturer-department');
  const lecturerPass   = document.getElementById('lecturer-password');
  const lecturerHint   = document.getElementById('lecturer-password-hint');

  /* ---- Delete modal (shared) ---- */
  const deleteModal  = document.getElementById('delete-account-modal');
  const deleteTitle  = document.getElementById('delete-account-title');
  const deleteText   = document.getElementById('delete-account-text');
  const deleteWarn   = document.getElementById('delete-account-warn');
  const deleteClose  = document.getElementById('delete-account-close');
  const deleteYes    = document.getElementById('delete-account-yes');
  const deleteNo     = document.getElementById('delete-account-no');

  if (!studentsList || !lecturersList) return;

  let students  = [];
  let lecturers = [];
  let pendingDelete = null; // { type: 'student'|'lecturer', record }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  /* ---------- Load ---------- */

  async function loadStudents() {
    const res = await API.get('/api/accounts/students');
    if (!res.success) { alert('Failed to load students: ' + res.error); return; }
    students = Array.isArray(res.data) ? res.data : [];
    renderStudents();
  }

  async function loadLecturers() {
    const res = await API.get('/api/accounts/lecturers');
    if (!res.success) { alert('Failed to load lecturers: ' + res.error); return; }
    lecturers = Array.isArray(res.data) ? res.data : [];
    renderLecturers();
  }

  /* ---------- Render ---------- */

  function accountRow(rec, kind) {
    const isStudent = kind === 'student';
    const idLabel  = isStudent ? rec.student_id  : rec.lecturer_id;
    const subLine  = isStudent ? rec.email : `${rec.email}${rec.department ? ' · ' + rec.department : ''}`;
    const initial  = (rec.full_name || '?').trim().charAt(0).toUpperCase();

    return `
      <div class="account-row" data-id="${rec.id}">
        <div class="account-avatar">${escapeHtml(initial)}</div>
        <div class="account-info">
          <h5>${escapeHtml(rec.full_name)}</h5>
          <p class="account-id-line">${escapeHtml(idLabel || '')}</p>
          <p class="account-sub">${escapeHtml(subLine || '')}</p>
        </div>
        <div class="account-actions">
          <button class="icon-btn-sm" data-action="edit" data-id="${rec.id}" title="Edit">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="icon-btn-sm danger" data-action="delete" data-id="${rec.id}" title="Delete">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }

  function renderStudents() {
    if (studentsCount) studentsCount.innerText = `${students.length} account${students.length === 1 ? '' : 's'}`;
    const q = (studentsSearch?.value || '').toLowerCase().trim();
    const filtered = students.filter(s =>
      !q || `${s.student_id || ''} ${s.full_name || ''} ${s.email || ''}`.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      studentsList.innerHTML = `
        <div class="accounts-empty">
          <i class="fa-solid fa-user-graduate"></i>
          ${students.length === 0 ? 'No student accounts yet.' : 'No students match your search.'}
        </div>
      `;
      return;
    }
    studentsList.innerHTML = filtered.map(s => accountRow(s, 'student')).join('');
  }

  function renderLecturers() {
    if (lecturersCount) lecturersCount.innerText = `${lecturers.length} account${lecturers.length === 1 ? '' : 's'}`;
    const q = (lecturersSearch?.value || '').toLowerCase().trim();
    const filtered = lecturers.filter(l =>
      !q || `${l.lecturer_id || ''} ${l.full_name || ''} ${l.email || ''}`.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      lecturersList.innerHTML = `
        <div class="accounts-empty">
          <i class="fa-solid fa-chalkboard-user"></i>
          ${lecturers.length === 0 ? 'No lecturer accounts yet.' : 'No lecturers match your search.'}
        </div>
      `;
      return;
    }
    lecturersList.innerHTML = filtered.map(l => accountRow(l, 'lecturer')).join('');
  }

  /* ---------- Student add / edit ---------- */

  function openStudentModal(mode, rec) {
    studentForm.reset();
    studentId.value = '';
    studentHint.innerText = '';

    if (mode === 'edit' && rec) {
      studentTitle.innerText = 'Edit Student';
      studentSave.innerText = 'Save';
      studentId.value    = rec.id;
      studentSid.value   = rec.student_id || '';
      studentName.value  = rec.full_name || '';
      studentEmail.value = rec.email || '';
      studentPass.removeAttribute('required');
      studentHint.innerText = '(leave blank to keep current)';
    } else {
      studentTitle.innerText = 'Add Student';
      studentSave.innerText = 'Add';
      studentPass.setAttribute('required', 'required');
    }
    studentModal.style.display = 'flex';
    setTimeout(() => studentSid.focus(), 60);
  }

  function closeStudentModal() {
    studentModal.style.display = 'none';
    studentForm.reset();
    studentId.value = '';
  }

  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editing = Boolean(studentId.value);
    const payload = {
      student_id: studentSid.value.trim(),
      full_name:  studentName.value.trim(),
      email:      studentEmail.value.trim()
    };
    if (studentPass.value) payload.password = studentPass.value;
    if (!editing && !payload.password) {
      alert('Password is required for a new student account.');
      return;
    }

    studentSave.disabled = true;
    studentSave.innerText = 'Saving...';
    const res = editing
      ? await API.put(`/api/accounts/students/${studentId.value}`, payload)
      : await API.post('/api/accounts/students', payload);
    studentSave.disabled = false;
    studentSave.innerText = editing ? 'Save' : 'Add';

    if (!res.success) { alert('Save failed: ' + res.error); return; }
    closeStudentModal();
    loadStudents();
  });

  /* ---------- Lecturer add / edit ---------- */

  function openLecturerModal(mode, rec) {
    lecturerForm.reset();
    lecturerId.value = '';
    lecturerHint.innerText = '';

    if (mode === 'edit' && rec) {
      lecturerTitle.innerText = 'Edit Lecturer';
      lecturerSave.innerText = 'Save';
      lecturerId.value    = rec.id;
      lecturerLid.value   = rec.lecturer_id || '';
      lecturerName.value  = rec.full_name || '';
      lecturerEmail.value = rec.email || '';
      lecturerDept.value  = rec.department || '';
      lecturerPass.removeAttribute('required');
      lecturerHint.innerText = '(leave blank to keep current)';
    } else {
      lecturerTitle.innerText = 'Add Lecturer';
      lecturerSave.innerText = 'Add';
      lecturerPass.setAttribute('required', 'required');
    }
    lecturerModal.style.display = 'flex';
    setTimeout(() => lecturerLid.focus(), 60);
  }

  function closeLecturerModal() {
    lecturerModal.style.display = 'none';
    lecturerForm.reset();
    lecturerId.value = '';
  }

  lecturerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editing = Boolean(lecturerId.value);
    const payload = {
      lecturer_id: lecturerLid.value.trim(),
      full_name:   lecturerName.value.trim(),
      email:       lecturerEmail.value.trim(),
      department:  lecturerDept.value.trim()
    };
    if (lecturerPass.value) payload.password = lecturerPass.value;
    if (!editing && !payload.password) {
      alert('Password is required for a new lecturer account.');
      return;
    }

    lecturerSave.disabled = true;
    lecturerSave.innerText = 'Saving...';
    const res = editing
      ? await API.put(`/api/accounts/lecturers/${lecturerId.value}`, payload)
      : await API.post('/api/accounts/lecturers', payload);
    lecturerSave.disabled = false;
    lecturerSave.innerText = editing ? 'Save' : 'Add';

    if (!res.success) { alert('Save failed: ' + res.error); return; }
    closeLecturerModal();
    loadLecturers();
  });

  /* ---------- Delete ---------- */

  function openDeleteModal(type, rec) {
    pendingDelete = { type, record: rec };
    const idLabel = type === 'student' ? rec.student_id : rec.lecturer_id;

    deleteTitle.innerText = type === 'student' ? 'Delete Student?' : 'Delete Lecturer?';
    deleteText.innerHTML  = `<strong>${escapeHtml(rec.full_name)}</strong> (${escapeHtml(idLabel || '')}) will be permanently deleted.`;
    deleteWarn.innerText  = type === 'student'
      ? 'This also removes their notes, reminders, events, timetable and submissions.'
      : 'This also removes their assignments and classes.';
    deleteModal.style.display = 'flex';
  }

  function closeDeleteModal() {
    deleteModal.style.display = 'none';
    pendingDelete = null;
  }

  deleteYes.addEventListener('click', async () => {
    if (!pendingDelete) return;
    const { type, record } = pendingDelete;
    deleteYes.disabled = true;
    const res = type === 'student'
      ? await API.delete(`/api/accounts/students/${record.id}`)
      : await API.delete(`/api/accounts/lecturers/${record.id}`);
    deleteYes.disabled = false;

    if (!res.success) {
      alert('Delete failed: ' + res.error);
      closeDeleteModal();
      return;
    }
    closeDeleteModal();
    if (type === 'student') loadStudents();
    else loadLecturers();
  });

  /* ---------- List actions + search ---------- */

  studentsList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const rec = students.find(x => String(x.id) === String(btn.dataset.id));
    if (!rec) return;
    if (btn.dataset.action === 'edit') openStudentModal('edit', rec);
    else if (btn.dataset.action === 'delete') openDeleteModal('student', rec);
  });

  lecturersList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const rec = lecturers.find(x => String(x.id) === String(btn.dataset.id));
    if (!rec) return;
    if (btn.dataset.action === 'edit') openLecturerModal('edit', rec);
    else if (btn.dataset.action === 'delete') openDeleteModal('lecturer', rec);
  });

  studentsSearch?.addEventListener('input', renderStudents);
  lecturersSearch?.addEventListener('input', renderLecturers);

  /* ---------- Modal close wiring ---------- */

  addStudentBtn?.addEventListener('click', () => openStudentModal('add'));
  addLecturerBtn?.addEventListener('click', () => openLecturerModal('add'));

  studentClose.addEventListener('click', closeStudentModal);
  studentCancel.addEventListener('click', closeStudentModal);
  studentModal.addEventListener('click', (e) => { if (e.target === studentModal) closeStudentModal(); });

  lecturerClose.addEventListener('click', closeLecturerModal);
  lecturerCancel.addEventListener('click', closeLecturerModal);
  lecturerModal.addEventListener('click', (e) => { if (e.target === lecturerModal) closeLecturerModal(); });

  deleteClose.addEventListener('click', closeDeleteModal);
  deleteNo.addEventListener('click', closeDeleteModal);
  deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) closeDeleteModal(); });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (deleteModal.style.display === 'flex')   { closeDeleteModal();   return; }
    if (studentModal.style.display === 'flex')  closeStudentModal();
    if (lecturerModal.style.display === 'flex') closeLecturerModal();
  });

  loadStudents();
  loadLecturers();
}

window.initAdminAccounts = initAdminAccounts;
