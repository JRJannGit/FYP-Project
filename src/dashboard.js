// =========================================
// src/dashboard.js — with modals
// =========================================

const LOCAL_QUOTES = [
  "Small progress every day leads to big results.",
  "Kejayaan tidak datang daripada apa yang anda buat sekali, tetapi apa yang anda buat secara konsisten.",
  "Fokus pada proses, hasil akan menyusul kemudian.",
  "Jangan tangguhkan kerja hari ini untuk esok.",
  "Pendidikan adalah senjata paling berkuasa untuk mengubah masa depan anda.",
  "Setiap usaha kecil hari ini adalah pelaburan untuk kejayaan FYP anda!"
];

async function fetchOnlineQuote() {
  try {
    const r = await fetch('https://dummyjson.com/quotes/random');
    if (!r.ok) throw new Error('API error');
    const d = await r.json();
    return `${d.quote} — ${d.author}`;
  } catch {
    return LOCAL_QUOTES[Math.floor(Math.random() * LOCAL_QUOTES.length)];
  }
}

// ============ Format helpers ============
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

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function badgeClass(days) {
  if (days === null || days < 0) return 'due-soon';
  if (days <= 2) return 'due-soon';
  if (days <= 7) return 'due-medium';
  return 'due-normal';
}

function badgeLabel(days) {
  if (days === null) return '';
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}

// ============ State ============
let todayScheduleData = [];
let upcomingItemsData = [];

// ============ Main init ============
async function initDashboard() {
  const buddySpeech = document.getElementById('buddy-speech-text');
  const quoteText   = document.querySelector('.quote-text');
  const timeBadge   = document.querySelector('.time-badge');
  const greetingName= document.getElementById('user-greeting-name');

  const user = AppStorage.getUser();
  const userName = user ? user.full_name : 'Guest';
  const studentId = user
  ? (user.student_id || user.lecturer_id || user.admin_id || user.identifier || null)
  : null;

  if (greetingName) greetingName.innerText = userName;

  // Quote
  if (quoteText) {
    quoteText.innerText = '"Loading quote..."';
    const q = await fetchOnlineQuote();
    quoteText.innerText = `"${q}"`;
  }

  // Time badge
  if (timeBadge) {
    const now = new Date();
    const opts = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    timeBadge.innerHTML = `<i class="fa-regular fa-clock"></i> ${now.toLocaleDateString('en-GB', opts)}`;
  }

  try {
    // Fetch all data in parallel
    const [todayRes, upcomingRes] = await Promise.all([
      API.get('/api/timetable-entries/today'),
      API.get(`/api/dashboard/upcoming/${studentId || 'none'}`)
    ]);

    todayScheduleData  = todayRes.success ? todayRes.data : [];
    upcomingItemsData  = upcomingRes.success ? upcomingRes.data : [];

    // Update speech
    if (buddySpeech) {
      if (upcomingItemsData.length > 0) {
        const next = upcomingItemsData[0];
        buddySpeech.innerText = `Hai ${userName}! Anda ada ${upcomingItemsData.length} item akan datang. Terdekat: "${next.title}" (${fmtDate(next.date)}).`;
      } else {
        buddySpeech.innerText = `Syabas ${userName}! Tiada tugasan mendesak.`;
      }
    }

    renderTodaySchedulePreview();
    renderUpcomingTasksPreview();

  } catch (err) {
    console.error('Dashboard error:', err);
  }

  setupModals();
}

// ============ Preview renders ============
function renderTodaySchedulePreview() {
  const list = document.getElementById('today-schedule-list');
  if (!list) return;

  if (todayScheduleData.length === 0) {
    list.innerHTML = '<li class="empty-msg">No classes today. Enjoy! 🎉</li>';
    return;
  }

  // Show max 3
  const preview = todayScheduleData.slice(0, 3);
  list.innerHTML = preview.map(c => `
    <li class="schedule-item ${c.color || 'blue'}">
      <div class="schedule-details">
        <strong>${c.subject}</strong>
        <small>${fmtTime(c.time_start)} - ${fmtTime(c.time_end)}</small>
      </div>
      <span class="room-tag">${c.room || '—'}</span>
    </li>
  `).join('');

  if (todayScheduleData.length > 3) {
    list.innerHTML += `<li style="text-align:center;padding:8px;color:var(--text-muted);font-size:0.75rem;">+ ${todayScheduleData.length - 3} more classes</li>`;
  }
}

function renderUpcomingTasksPreview() {
  const list = document.getElementById('upcoming-tasks-list');
  if (!list) return;

  if (upcomingItemsData.length === 0) {
    list.innerHTML = '<li class="empty-msg">There\'s no Task</li>';
    return;
  }

  const preview = upcomingItemsData.slice(0, 3);
  list.innerHTML = preview.map(item => {
    const d = daysUntil(item.date);
    return `
      <li class="task-item">
        <span class="task-title">${item.title}</span>
        <span class="badge ${badgeClass(d)}">${badgeLabel(d)}</span>
      </li>
    `;
  }).join('');
}

// ============ Modals ============
function setupModals() {
  const scheduleModal = document.getElementById('schedule-modal');
  const tasksModal    = document.getElementById('tasks-modal');

  // View All buttons
  document.querySelectorAll('.btn-view-all').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.modal;
      if (target === 'schedule') {
        renderScheduleModal();
        scheduleModal.style.display = 'flex';
      } else {
        renderTasksModal();
        tasksModal.style.display = 'flex';
      }
    });
  });

  // Close buttons (bottom)
  document.getElementById('schedule-modal-close-btn')?.addEventListener('click', () => {
    scheduleModal.style.display = 'none';
  });
  document.getElementById('tasks-modal-close-btn')?.addEventListener('click', () => {
    tasksModal.style.display = 'none';
  });

  // Click outside closes
  scheduleModal?.addEventListener('click', (e) => {
    if (e.target === scheduleModal) scheduleModal.style.display = 'none';
  });
  tasksModal?.addEventListener('click', (e) => {
    if (e.target === tasksModal) tasksModal.style.display = 'none';
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (scheduleModal?.style.display === 'flex') scheduleModal.style.display = 'none';
      if (tasksModal?.style.display === 'flex')    tasksModal.style.display = 'none';
    }
  });
}

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (scheduleModal?.style.display === 'flex') scheduleModal.style.display = 'none';
      if (tasksModal?.style.display === 'flex')    tasksModal.style.display = 'none';
    }
  });


function renderScheduleModal() {
  const content = document.getElementById('schedule-modal-content');
  if (!content) return;

  if (todayScheduleData.length === 0) {
    content.innerHTML = '<div class="empty-msg" style="padding:40px;">No classes scheduled today.</div>';
    return;
  }

  content.innerHTML = todayScheduleData.map(c => `
    <div class="modal-item ${c.color || 'blue'}">
      <div class="modal-item__title">${c.subject}</div>
      <div class="modal-item__meta">
        <span><i class="fa-regular fa-clock"></i> ${fmtTime(c.time_start)} - ${fmtTime(c.time_end)}</span>
        <span><i class="fa-solid fa-location-dot"></i> ${c.room || '—'}</span>
      </div>
    </div>
  `).join('');
}

function renderTasksModal() {
  const content = document.getElementById('tasks-modal-content');
  if (!content) return;

  if (upcomingItemsData.length === 0) {
    content.innerHTML = '<div class="empty-msg" style="padding:40px;">There\'s no Task</div>';
    return;
  }

  content.innerHTML = upcomingItemsData.map(item => {
    const d = daysUntil(item.date);
    const typeClass = item.type === 'assignment' && item.is_exam ? 'exam' : (item.type || 'assignment');
    const typeLabel = item.type === 'assignment' && item.is_exam ? 'EXAM' : (item.type || 'task').toUpperCase();

    return `
      <div class="modal-item ${item.color || 'blue'}">
        <div class="modal-item__title">
          ${item.title}
          <span class="modal-item__type ${typeClass}">${typeLabel}</span>
        </div>
        ${item.description ? `<div class="modal-item__desc">${item.description}</div>` : ''}
        <div class="modal-item__meta">
          <span><i class="fa-regular fa-calendar"></i> ${fmtDate(item.date)}</span>
          ${item.time ? `<span><i class="fa-regular fa-clock"></i> ${fmtTime(item.time)}</span>` : ''}
          <span><i class="fa-solid fa-hourglass"></i> ${badgeLabel(d)}</span>
        </div>
      </div>
    `;
  }).join('');
}

window.initDashboard = initDashboard;