// =========================================
// src/admin-dashboard.js
// =========================================

const ADMIN_QUOTES = [
  "Small progress every day leads to big results.",
  "Leadership is about making others better.",
  "Focus on the process, results will follow.",
  "Good systems empower good people.",
  "Data-driven decisions build better campuses.",
  "Every small improvement compounds over time."
];

async function fetchAdminQuote() {
  try {
    const r = await fetch('https://dummyjson.com/quotes/random');
    if (!r.ok) throw new Error('API error');
    const d = await r.json();
    return `${d.quote} — ${d.author}`;
  } catch {
    return ADMIN_QUOTES[Math.floor(Math.random() * ADMIN_QUOTES.length)];
  }
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}.${String(m).padStart(2, '0')} ${ampm}`;
}

let adminScheduleData = [];
let adminUpcomingData = [];
let adminResources = [];

async function initAdminDashboard() {
  const buddySpeech = document.getElementById('buddy-speech-text');
  const quoteText   = document.querySelector('.quote-text');
  const timeBadge   = document.querySelector('.time-badge');
  const greetingName= document.getElementById('user-greeting-name');

  const user = AppStorage.getUser();
  const userName = user ? user.full_name : 'Admin';

  if (greetingName) greetingName.innerText = userName;

  // Quote
  if (quoteText) {
    quoteText.innerText = '"Loading quote..."';
    const q = await fetchAdminQuote();
    quoteText.innerText = `"${q}"`;
  }

  // Time badge
  if (timeBadge) {
    const now = new Date();
    const opts = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    timeBadge.innerHTML = `<i class="fa-regular fa-clock"></i> ${now.toLocaleDateString('en-GB', opts)}`;
  }

  try {
    const [todayRes, upcomingRes, resRes] = await Promise.all([
      API.get('/api/timetable-entries/today'),
      API.get('/api/dashboard/upcoming/none'),
      API.get('/api/resources')
    ]);

    adminScheduleData = todayRes.success ? todayRes.data : [];
    adminUpcomingData = upcomingRes.success ? upcomingRes.data : [];
    adminResources = resRes.success ? resRes.data : [];

    if (buddySpeech) {
      buddySpeech.innerText = `Welcome ${userName}! Manage resources, calendar and monitor system from here.`;
    }

    renderAdminQuickAccess();
    renderAdminSchedulePreview();
    renderAdminTasksPreview();
  } catch (err) {
    console.error('Admin dashboard error:', err);
  }

  setupAdminModals();
  setupQAModal();
}

// ============ Quick Access with edit ============
function renderAdminQuickAccess() {
  const grid = document.getElementById('admin-portal-grid');
  if (!grid) return;

  // Show first 4 system resources or all if fewer
  const items = adminResources.slice(0, 4);
  if (items.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;grid-column:1/-1;text-align:center;">No resources yet.</p>';
    return;
  }

  grid.innerHTML = items.map(r => `
    <a href="#" class="portal-btn" data-resource-id="${r.id}" data-url="${r.url_link || r.url || ''}">
      <i class="fa-solid ${r.icon || 'fa-link'}"></i>
      <span>${r.title}</span>
    </a>
  `).join('');

  // Handle click → open external
  grid.querySelectorAll('.portal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const url = btn.dataset.url;
      if (url) window.open(url, '_blank');
    });
  });
}

// ============ Schedule Preview ============
function renderAdminSchedulePreview() {
  const list = document.getElementById('today-schedule-list');
  if (!list) return;
  if (adminScheduleData.length === 0) {
    list.innerHTML = '<li class="empty-msg">No classes today.</li>';
    return;
  }
  list.innerHTML = adminScheduleData.slice(0, 3).map(c => `
    <li class="schedule-item ${c.color || 'blue'}">
      <div class="schedule-details">
        <strong>${c.subject}</strong>
        <small>${fmtTime(c.time_start)} - ${fmtTime(c.time_end)}</small>
      </div>
      <span class="room-tag">${c.room || '—'}</span>
    </li>
  `).join('');
}

function renderAdminTasksPreview() {
  const list = document.getElementById('upcoming-tasks-list');
  if (!list) return;
  if (adminUpcomingData.length === 0) {
    list.innerHTML = '<li class="empty-msg">There\'s no Task</li>';
    return;
  }
  list.innerHTML = adminUpcomingData.slice(0, 3).map(item => {
    const days = Math.ceil((new Date(item.date) - new Date()) / 86400000);
    const badgeCls = days <= 3 ? 'due-soon' : days <= 7 ? 'due-medium' : 'due-normal';
    return `
      <li class="task-item">
        <span class="task-title">${item.title}</span>
        <span class="badge ${badgeCls}">${days} days</span>
      </li>
    `;
  }).join('');
}

// ============ Edit Quick Access Modal ============
function setupQAModal() {
  const editBtn   = document.getElementById('btn-edit-quick-access');
  const modal     = document.getElementById('qa-modal');
  const closeBtn  = document.getElementById('qa-modal-close');
  const cancelBtn = document.getElementById('qa-cancel');
  const form      = document.getElementById('qa-form');
  const idField   = document.getElementById('qa-id');
  const topicF    = document.getElementById('qa-topic');
  const urlF      = document.getElementById('qa-url');
  const titleH    = document.getElementById('qa-modal-title');

  if (!editBtn || !modal) return;

  editBtn.addEventListener('click', () => {
    if (adminResources.length === 0) {
      alert('No resource to edit.');
      return;
    }
    // For simplicity, edit the first resource in the list.
    // Advanced: show picker modal.
    const r = adminResources[0];
    titleH.innerText = 'Edit Quick Access';
    idField.value = r.id;
    topicF.value = r.title || '';
    urlF.value = r.url_link || r.url || '';
    modal.style.display = 'flex';
    setTimeout(() => topicF.focus(), 60);
  });

  const close = () => {
    modal.style.display = 'none';
    form.reset();
    idField.value = '';
  };

  if (closeBtn) closeBtn.addEventListener('click', close);
  if (cancelBtn) cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: topicF.value.trim(),
      url_link: urlF.value.trim(),
      caption: '',
      icon: 'fa-link'
    };
    if (!payload.title || !payload.url_link) return;

    const res = await API.put(`/api/resources/${idField.value}`, payload);
    if (!res.success) {
      alert('Save failed: ' + res.error);
      return;
    }
    close();
    // Reload resources + repaint
    const fresh = await API.get('/api/resources');
    if (fresh.success) {
      adminResources = fresh.data;
      renderAdminQuickAccess();
    }
  });
}

// ============ Schedule + Tasks modals ============
function setupAdminModals() {
  const scheduleModal = document.getElementById('schedule-modal');
  const tasksModal    = document.getElementById('tasks-modal');

  document.querySelectorAll('.btn-view-all').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.modal;
      if (target === 'schedule') {
        renderScheduleModalContent();
        scheduleModal.style.display = 'flex';
      } else {
        renderTasksModalContent();
        tasksModal.style.display = 'flex';
      }
    });
  });

  document.getElementById('schedule-modal-close-btn')?.addEventListener('click', () => {
    scheduleModal.style.display = 'none';
  });
  document.getElementById('tasks-modal-close-btn')?.addEventListener('click', () => {
    tasksModal.style.display = 'none';
  });

  scheduleModal?.addEventListener('click', (e) => {
    if (e.target === scheduleModal) scheduleModal.style.display = 'none';
  });
  tasksModal?.addEventListener('click', (e) => {
    if (e.target === tasksModal) tasksModal.style.display = 'none';
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (scheduleModal?.style.display === 'flex') scheduleModal.style.display = 'none';
      if (tasksModal?.style.display === 'flex')    tasksModal.style.display = 'none';
    }
  });
}

function renderScheduleModalContent() {
  const content = document.getElementById('schedule-modal-content');
  if (!content) return;
  if (adminScheduleData.length === 0) {
    content.innerHTML = '<div class="empty-msg" style="padding:40px;">No classes scheduled today.</div>';
    return;
  }
  content.innerHTML = adminScheduleData.map(c => `
    <div class="modal-item ${c.color || 'blue'}">
      <div class="modal-item__title">${c.subject}</div>
      <div class="modal-item__meta">
        <span><i class="fa-regular fa-clock"></i> ${fmtTime(c.time_start)} - ${fmtTime(c.time_end)}</span>
        <span><i class="fa-solid fa-location-dot"></i> ${c.room || '—'}</span>
      </div>
    </div>
  `).join('');
}

function renderTasksModalContent() {
  const content = document.getElementById('tasks-modal-content');
  if (!content) return;
  if (adminUpcomingData.length === 0) {
    content.innerHTML = '<div class="empty-msg" style="padding:40px;">There\'s no Task</div>';
    return;
  }
  content.innerHTML = adminUpcomingData.map(item => {
    const days = Math.ceil((new Date(item.date) - new Date()) / 86400000);
    const typeCls = item.type === 'assignment' && item.is_exam ? 'exam' : (item.type || 'assignment');
    const typeLabel = item.type === 'assignment' && item.is_exam ? 'EXAM' : (item.type || 'task').toUpperCase();
    return `
      <div class="modal-item ${item.color || 'blue'}">
        <div class="modal-item__title">
          ${item.title}
          <span class="modal-item__type ${typeCls}">${typeLabel}</span>
        </div>
        ${item.description ? `<div class="modal-item__desc">${item.description}</div>` : ''}
        <div class="modal-item__meta">
          <span><i class="fa-regular fa-calendar"></i> ${fmtDate(item.date)}</span>
          ${item.time ? `<span><i class="fa-regular fa-clock"></i> ${fmtTime(item.time)}</span>` : ''}
          <span><i class="fa-solid fa-hourglass"></i> ${days} days</span>
        </div>
      </div>
    `;
  }).join('');
}

window.initAdminDashboard = initAdminDashboard;