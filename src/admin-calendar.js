
/* [A6] Escape-close bound once at module scope; initAdminCalendar() re-runs
   on every visit to the view and previously stacked one document listener
   per visit. */
if (!window.__adminCalendarEscapeBound) {
  window.__adminCalendarEscapeBound = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal      = document.getElementById('event-modal');
    const delModal   = document.getElementById('delete-event-modal');
    const delAcModal = document.getElementById('delete-academic-modal');
    if (modal && modal.style.display === 'flex') {
      document.getElementById('event-modal-cancel')?.click();
      return;
    }
    if (delModal && delModal.style.display === 'flex') {
      document.getElementById('delete-event-no')?.click();
      return;
    }
    if (delAcModal && delAcModal.style.display === 'flex') {
      document.getElementById('delete-academic-no')?.click();
      return;
    }
  });
}

function initAdminCalendar() {
  const eventsList   = document.getElementById('events-list');
  const monthTitle   = document.getElementById('events-month-title');
  const calDays      = document.getElementById('calendar-days');
  const monthLabel   = document.getElementById('current-month-year');
  const prevBtn      = document.getElementById('prev-month');
  const nextBtn      = document.getElementById('next-month');
  const addBtn       = document.getElementById('btn-add-event');
  const toggleMode   = document.getElementById('toggle-calendar-mode');
  const monthlyView  = document.getElementById('monthly-view');
  const academicView = document.getElementById('academic-view');
  const academicWrap = document.getElementById('academic-image-wrapper');

  const btnUpload    = document.getElementById('btn-upload-academic');
  const btnDelete    = document.getElementById('btn-delete-academic');
  const fileInput    = document.getElementById('academic-file-input');

  const modal       = document.getElementById('event-modal');
  const modalTitle  = document.getElementById('event-modal-title');
  const form        = document.getElementById('event-form');
  const closeBtn    = document.getElementById('event-modal-close');
  const cancelBtn   = document.getElementById('event-modal-cancel');
  const saveBtn     = document.getElementById('event-modal-save');
  const inputId     = document.getElementById('event-id');
  const inputTopic  = document.getElementById('event-topic');
  const inputDate   = document.getElementById('event-date');
  const inputStart  = document.getElementById('event-start-time');
  const inputEnd    = document.getElementById('event-end-time');
  const inputColor  = document.getElementById('event-color');

  const delModal    = document.getElementById('delete-event-modal');
  const delClose    = document.getElementById('delete-event-close');
  const delName     = document.getElementById('delete-event-name');
  const delYes      = document.getElementById('delete-event-yes');
  const delNo       = document.getElementById('delete-event-no');

  const delAcModal  = document.getElementById('delete-academic-modal');
  const delAcClose  = document.getElementById('delete-academic-close');
  const delAcYes    = document.getElementById('delete-academic-yes');
  const delAcNo     = document.getElementById('delete-academic-no');

  let allEvents = [];
  let currentMonth = new Date();
  currentMonth.setDate(1);
  let pendingDeleteId = null;

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  const ZOOM_MIN = 50;
  const ZOOM_MAX = 300;
  const ZOOM_STEP = 20;
  let currentZoom = 100;

  const zoomOutBtn = document.getElementById('ac-zoom-out');
  const zoomInBtn  = document.getElementById('ac-zoom-in');
  const zoomValBtn = document.getElementById('ac-zoom-value');

  function applyZoom() {
    const img = academicWrap?.querySelector('img');
    if (!img) return;
    img.style.setProperty('width', currentZoom + '%', 'important');
    img.style.setProperty('max-width', 'none', 'important');
    img.style.setProperty('max-height', 'none', 'important');
    if (zoomValBtn) zoomValBtn.innerText = currentZoom + '%';
    if (zoomOutBtn) zoomOutBtn.disabled = currentZoom <= ZOOM_MIN;
    if (zoomInBtn)  zoomInBtn.disabled  = currentZoom >= ZOOM_MAX;
  }

  function zoomIn()    { currentZoom = Math.min(ZOOM_MAX, currentZoom + ZOOM_STEP); applyZoom(); }
  function zoomOut()   { currentZoom = Math.max(ZOOM_MIN, currentZoom - ZOOM_STEP); applyZoom(); }
  function zoomReset() { currentZoom = 100; applyZoom(); }

  if (zoomInBtn)  zoomInBtn.addEventListener('click', zoomIn);
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
  if (zoomValBtn) zoomValBtn.addEventListener('click', zoomReset);

  if (academicWrap) {
    academicWrap.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    }, { passive: false });
  }

  function fmtTime(t) { if (!t) return ''; const [h,m] = t.split(':'); return `${h}:${m}`; }
  function fmtDateBadge(d) { return String(new Date(d).getDate()).padStart(2, '0'); }
  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  async function loadEvents() {
    const res = await API.get('/api/events/ADMIN');
    if (!res.success) {
      if (eventsList) eventsList.innerHTML = `<p class="events-empty" style="color:#f87171;">Failed: ${res.error}</p>`;
      return;
    }
    allEvents = res.data;
    renderEventsPanel();
    renderGrid();
  }

  async function loadAcademic() {
    if (!academicWrap) return;
    const res = await API.get('/api/academic-calendar');
    if (res.success && res.data && res.data.file_data) {
      if (res.data.file_type === 'pdf') {
        academicWrap.innerHTML = `<iframe src="${res.data.file_data}" style="width:100%;height:100%;border:none;"></iframe>`;
        document.querySelector('.academic-zoom-controls')?.style.setProperty('display', 'none');
      } else {
        academicWrap.innerHTML = `<img src="${res.data.file_data}" alt="Academic Calendar">`;
        document.querySelector('.academic-zoom-controls')?.style.setProperty('display', 'flex');
        currentZoom = 100;
        applyZoom();
      }
    } else {
      academicWrap.innerHTML = `
        <div class="academic-placeholder">
          <i class="fa-regular fa-image"></i>
          <p>No academic calendar uploaded yet.</p>
          <small>Click the upload icon above.</small>
        </div>`;
      document.querySelector('.academic-zoom-controls')?.style.setProperty('display', 'none');
    }
  }

  function renderEventsPanel() {
    if (!eventsList) return;
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    monthTitle.innerText = `Events for ${MONTHS[m]} ${y}`;

    const monthly = allEvents.filter(e => {
      const d = parseDateOnly(e.event_date);
      return d.getFullYear() === y && d.getMonth() === m;
    }).sort((a, b) => a.event_date.localeCompare(b.event_date));

    if (monthly.length === 0) {
      eventsList.innerHTML = '<p class="events-empty">No events this month.</p>';
      return;
    }

    eventsList.innerHTML = monthly.map(e => `
      <div class="event-item" data-id="${e.id}">
        <div class="event-date-chip">${fmtDateBadge(e.event_date)}</div>
        <div class="event-info">
          <h5>${escapeHtml(e.title)}</h5>
          <p><i class="fa-regular fa-clock"></i> ${fmtTime(e.start_time)} - ${fmtTime(e.end_time)}</p>
        </div>
        <button class="event-delete-btn" data-action="delete" data-id="${e.id}" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `).join('');
  }

  function renderGrid() {
    if (!calDays) return;
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    monthLabel.innerText = `${MONTHS[m]} ${y}`;

    const firstDay = new Date(y, m, 1);
    const startDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevMonthDays = new Date(y, m, 0).getDate();

    const cells = [];
    for (let i = startDay - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, muted: true });

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(y, m, d);
      const dayEvents = allEvents.filter(e => {
        const ed = parseDateOnly(e.event_date);
        return ed.getFullYear() === y && ed.getMonth() === m && ed.getDate() === d;
      });
      cells.push({
        day: d,
        date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        isToday: sameDay(dateObj, new Date()),
        events: dayEvents,
        muted: false
      });
    }
    while (cells.length % 7 !== 0) cells.push({ day: cells.length - daysInMonth - startDay + 1, muted: true });

    calDays.innerHTML = cells.map(c => {
      if (c.muted) return `<div class="day-cell muted"><span class="day-num">${c.day}</span></div>`;
      const dots = (c.events || []).map(e => `<span class="day-dot ${e.color || 'blue'}"></span>`).join('');
      return `
        <div class="day-cell ${c.isToday ? 'today' : ''}" data-date="${c.date}">
          <span class="day-num">${c.day}</span>
          ${dots ? `<div class="day-dots">${dots}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  function openModal(mode = 'add', eventData = null, presetDate = null) {
    if (mode === 'edit' && eventData) {
      modalTitle.innerText = 'Edit Event';
      saveBtn.innerText = 'Save';
      inputId.value = eventData.id;
      inputTopic.value = eventData.title;
      inputDate.value = eventData.event_date?.slice(0, 10) || '';
      inputStart.value = fmtTime(eventData.start_time);
      inputEnd.value = fmtTime(eventData.end_time);
      inputColor.value = eventData.color || 'blue';
    } else {
      modalTitle.innerText = 'Add Event';
      saveBtn.innerText = 'Add';
      form.reset();
      inputId.value = '';
      inputStart.value = '09:00';
      inputEnd.value = '10:00';
      inputColor.value = 'blue';
      if (presetDate) inputDate.value = presetDate;
      else {
        const today = new Date();
        inputDate.value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      }
    }
    modal.style.display = 'flex';
    setTimeout(() => inputTopic.focus(), 50);
  }

  function closeModal() {
    modal.style.display = 'none';
    form.reset();
    inputId.value = '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      student_id: null,
      title: inputTopic.value.trim(),
      event_date: inputDate.value,
      start_time: inputStart.value + ':00',
      end_time: inputEnd.value + ':00',
      color: inputColor.value
    };
    if (!payload.title || !payload.event_date) return;

    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';

    const res = inputId.value
      ? await API.put(`/api/events/${inputId.value}`, payload)
      : await API.post('/api/events', payload);

    saveBtn.disabled = false;
    saveBtn.innerText = inputId.value ? 'Save' : 'Add';

    if (!res.success) { alert('Save failed: ' + res.error); return; }
    closeModal();
    loadEvents();
  });

  function openDeleteModal(id, title) {
    pendingDeleteId = id;
    delName.innerText = `Delete "${title}"?`;
    delModal.style.display = 'flex';
  }
  function closeDeleteModal() {
    delModal.style.display = 'none';
    pendingDeleteId = null;
  }

  delYes.addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    const res = await API.delete(`/api/events/${pendingDeleteId}`);
    if (res.success) { closeDeleteModal(); loadEvents(); }
    else alert('Delete failed: ' + res.error);
  });
  delNo?.addEventListener('click', closeDeleteModal);
  delClose?.addEventListener('click', closeDeleteModal);
  delModal?.addEventListener('click', (e) => { if (e.target === delModal) closeDeleteModal(); });

  addBtn?.addEventListener('click', () => openModal('add'));
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  eventsList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    const id = btn.dataset.id;
    const ev = allEvents.find(x => String(x.id) === String(id));
    if (ev) openDeleteModal(id, ev.title);
  });

  calDays.addEventListener('click', (e) => {
    const cell = e.target.closest('.day-cell');
    if (!cell || cell.classList.contains('muted')) return;
    openModal('add', null, cell.dataset.date);
  });

  prevBtn?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderEventsPanel(); renderGrid();
  });
  nextBtn?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderEventsPanel(); renderGrid();
  });

  toggleMode?.addEventListener('change', () => {
    if (toggleMode.checked) {
      monthlyView.style.display = 'none';
      academicView.style.display = 'flex';
      loadAcademic();
    } else {
      monthlyView.style.display = 'flex';
      academicView.style.display = 'none';
    }
  });

  btnUpload?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Max 10MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const file_data = ev.target.result;
      const file_type = file.type === 'application/pdf' ? 'pdf' : 'image';
      const res = await API.post('/api/academic-calendar', { file_data, file_type });
      if (res.success) {
        toggleMode.checked = true;
        toggleMode.dispatchEvent(new Event('change'));
      } else {
        alert('Upload failed: ' + res.error);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  btnDelete?.addEventListener('click', () => { delAcModal.style.display = 'flex'; });
  function closeDeleteAcademic() { delAcModal.style.display = 'none'; }

  delAcYes.addEventListener('click', async () => {
    const res = await API.delete('/api/academic-calendar');
    if (res.success) { closeDeleteAcademic(); loadAcademic(); }
    else alert('Delete failed: ' + res.error);
  });
  delAcNo?.addEventListener('click', closeDeleteAcademic);
  delAcClose?.addEventListener('click', closeDeleteAcademic);
  delAcModal?.addEventListener('click', (e) => { if (e.target === delAcModal) closeDeleteAcademic(); });

  loadEvents();
}

window.initAdminCalendar = initAdminCalendar;