
/* [A6] Escape-close bound once at module scope; initCalendar() re-runs on
   every visit to the view and previously stacked one document listener
   per visit. */
if (!window.__calendarEscapeBound) {
  window.__calendarEscapeBound = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal    = document.getElementById('event-modal');
    const delModal = document.getElementById('delete-event-modal');
    if (modal && modal.style.display === 'flex') {
      document.getElementById('event-modal-cancel')?.click();
      return;
    }
    if (delModal && delModal.style.display === 'flex') {
      document.getElementById('delete-event-no')?.click();
      return;
    }
  });
}

function initCalendar() {
  /* Subject→color hash — mirrors server.js subjectColor() exactly so the
     same subject always gets the same color on dashboard and calendar. */
  function subjectColor(subject) {
    if (!subject) return 'blue';
    let hash = 0;
    const s = String(subject);
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0;
    }
    const palette = ['blue', 'red', 'yellow'];
    return palette[Math.abs(hash) % palette.length];
  }

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

  const _u = AppStorage.getUser();
  const studentId = _u ? (_u.student_id || _u.lecturer_id || _u.admin_id || _u.identifier) : null;

  let allEvents = [];
  let allTimetableEntries = [];
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
    const wrapper = document.getElementById('academic-image-wrapper');
    const img = wrapper?.querySelector('img');
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

  const academicWrap = document.getElementById('academic-image-wrapper');
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
    if (!studentId) {
      allEvents = [];
      allTimetableEntries = [];
      eventsList.innerHTML = '<p class="events-empty">Please log in.</p>';
      renderGrid();
      return;
    }
    /* Events (dated) + weekly classes (timetable entries) load together so
       the grid and the side panel can render both sources. */
    const [eventsRes, ttRes] = await Promise.all([
      API.get(`/api/events/${studentId}`),
      API.get(`/api/timetable-entries/user/${studentId}`)
    ]);
    allEvents = eventsRes.success ? eventsRes.data : [];
    allTimetableEntries = ttRes.success ? ttRes.data : [];
    renderEventsPanel();
    renderGrid();
  }

  async function loadAcademic() {
    const wrapper = document.getElementById('academic-image-wrapper');
    if (!wrapper) return;
    const res = await API.get('/api/academic-calendar');
    if (res.success && res.data && res.data.file_data) {
      if (res.data.file_type === 'pdf') {
        wrapper.innerHTML = `<iframe src="${res.data.file_data}" style="width:100%;height:100%;border:none;"></iframe>`;
        document.querySelector('.academic-zoom-controls')?.style.setProperty('display', 'none');
      } else {
        wrapper.innerHTML = `<img src="${res.data.file_data}" alt="Academic Calendar">`;
        document.querySelector('.academic-zoom-controls')?.style.setProperty('display', 'flex');
        currentZoom = 100;
        applyZoom();
      }
    } else {
      wrapper.innerHTML = `
        <div class="academic-placeholder">
          <i class="fa-regular fa-image"></i>
          <p>No academic calendar uploaded yet.</p>
          <small>Admin will upload it soon.</small>
        </div>`;
      document.querySelector('.academic-zoom-controls')?.style.setProperty('display', 'none');
    }
  }

  function renderEventsPanel() {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    monthTitle.innerText = `Events & Classes for ${MONTHS[m]} ${y}`;

    const monthly = allEvents.filter(e => {
      const d = parseDateOnly(e.event_date);
      return d.getFullYear() === y && d.getMonth() === m;
    }).sort((a, b) => a.event_date.localeCompare(b.event_date));

    /* Weekly classes repeat every week — show each entry once per month,
       grouped Mon→Sun at the bottom of the panel. */
    const DAY_SHORT = { Mon: 'Mo', Tue: 'Tu', Wed: 'We', Thu: 'Th', Fri: 'Fr', Sat: 'Sa', Sun: 'Su' };
    const DAY_ORDER = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    const classes = allTimetableEntries.slice().sort((a, b) =>
      DAY_ORDER[a.day_of_week] - DAY_ORDER[b.day_of_week] ||
      String(a.time_start).localeCompare(String(b.time_start))
    );

    if (monthly.length === 0 && classes.length === 0) {
      eventsList.innerHTML = '<p class="events-empty">No events or classes this month.</p>';
      return;
    }

    let html = '';
    if (monthly.length > 0) {
      html += '<div class="events-section-label">Events</div>';
      html += monthly.map(e => `
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
    if (classes.length > 0) {
      html += '<div class="events-section-label">Weekly Classes</div>';
      html += classes.map(t => `
        <div class="event-item class-item">
          <div class="event-date-chip class-chip dot-${subjectColor(t.subject)}">${DAY_SHORT[t.day_of_week] || t.day_of_week}</div>
          <div class="event-info">
            <h5>${escapeHtml(t.subject)}</h5>
            <p><i class="fa-regular fa-clock"></i> ${fmtTime(t.time_start)} - ${fmtTime(t.time_end)} · ${escapeHtml(t.room || '—')}</p>
          </div>
        </div>
      `).join('');
    }
    eventsList.innerHTML = html;
  }

  function renderGrid() {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    monthLabel.innerText = `${MONTHS[m]} ${y}`;

    const firstDay = new Date(y, m, 1);
    const startDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevMonthDays = new Date(y, m, 0).getDate();

    const cells = [];
    for (let i = startDay - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, muted: true });

    const DAY_MAP = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(y, m, d);
      const cellDow = DAY_MAP[dateObj.getDay()];
      const dayEvents = allEvents.filter(e => {
        const ed = parseDateOnly(e.event_date);
        return ed.getFullYear() === y && ed.getMonth() === m && ed.getDate() === d;
      });
      const dayClasses = allTimetableEntries.filter(t => t.day_of_week === cellDow);
      cells.push({
        day: d,
        date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        isToday: sameDay(dateObj, new Date()),
        events: dayEvents,
        classes: dayClasses,
        muted: false
      });
    }
    while (cells.length % 7 !== 0) cells.push({ day: cells.length - daysInMonth - startDay + 1, muted: true });

    calDays.innerHTML = cells.map(c => {
      if (c.muted) return `<div class="day-cell muted"><span class="day-num">${c.day}</span></div>`;
      /* 1 dot per event on this date + 1 dot per weekly class on this weekday */
      const dots = [
        ...(c.events || []).map(e => `<span class="day-dot ${e.color || 'blue'}"></span>`),
        ...(c.classes || []).map(t => `<span class="day-dot ${subjectColor(t.subject)}"></span>`)
      ].join('');
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
      student_id: studentId,
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
    delName.innerText = `Are you sure you want to delete "${title}"?`;
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
  delNo.addEventListener('click', closeDeleteModal);
  delClose.addEventListener('click', closeDeleteModal);

  addBtn.addEventListener('click', () => openModal('add'));
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  delModal.addEventListener('click', (e) => { if (e.target === delModal) closeDeleteModal(); });

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

  prevBtn.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderEventsPanel(); renderGrid();
  });
  nextBtn.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderEventsPanel(); renderGrid();
  });

  toggleMode.addEventListener('change', () => {
    if (toggleMode.checked) {
      monthlyView.style.display = 'none';
      academicView.style.display = 'flex';
      loadAcademic();
    } else {
      monthlyView.style.display = 'flex';
      academicView.style.display = 'none';
    }
  });

  loadEvents();
}

window.initCalendar = initCalendar;