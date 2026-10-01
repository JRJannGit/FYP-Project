// =========================================
// src/dashboard.js
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

async function initDashboard() {
  const buddySpeech = document.getElementById('buddy-speech-text');
  const quoteText   = document.querySelector('.quote-text');
  const timeBadge   = document.querySelector('.time-badge');
  const greetingName = document.getElementById('user-greeting-name');

  const user = AppStorage.getUser();
  const userName = user ? user.full_name : 'Guest';

  if (greetingName) greetingName.innerText = userName;

  if (quoteText) {
    quoteText.innerText = '"Loading quote..."';
    const quote = await fetchOnlineQuote();
    quoteText.innerText = `"${quote}"`;
  }

  if (timeBadge) {
    const now = new Date();
    const opts = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    timeBadge.innerHTML = `<i class="fa-regular fa-clock"></i> ${now.toLocaleDateString('en-GB', opts)}`;
  }

  try {
    const [tasksRes, ttRes, resRes] = await Promise.all([
      API.get('/api/assignments'),
      API.get('/api/events/' + (user ? user.student_id : 'none')),
      API.get('/api/resources')
    ]);

    const tasks     = tasksRes.success ? tasksRes.data : [];
    const events    = ttRes.success    ? ttRes.data    : [];
    const resources = resRes.success   ? resRes.data   : [];

    if (buddySpeech) {
      if (tasks.length > 0) {
        const next = tasks[0];
        const fmt  = next.due_date ? new Date(next.due_date).toLocaleDateString('en-GB') : 'soon';
        buddySpeech.innerText = `Hai ${userName}! Anda ada ${tasks.length} tugasan. Terdekat: "${next.subject}" (${fmt}).`;
      } else {
        buddySpeech.innerText = `Syabas ${userName}! Semua tugasan selesai.`;
      }
    }

    renderTodaySchedule(events);
    renderUpcomingTasks(tasks);
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

function renderTodaySchedule(events) {
  const list = document.querySelector('.schedule-list');
  if (!list) return;
  if (!events || events.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:10px 0;">Tiada kelas hari ini.</p>';
    return;
  }
  list.innerHTML = events.slice(0, 4).map(e => `
    <li class="schedule-item">
      <span class="status-indicator blue"></span>
      <div class="schedule-details">
        <strong>${e.title}</strong>
        <small>${e.event_date}</small>
      </div>
    </li>
  `).join('');
}

function renderUpcomingTasks(tasks) {
  const list = document.querySelector('.task-list');
  if (!list) return;
  if (!tasks || tasks.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:10px 0;">Tiada tugasan.</p>';
    return;
  }
  list.innerHTML = tasks.slice(0, 3).map(t => {
    const fmt = t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB') : 'Soon';
    return `
      <li class="task-item">
        <span class="task-title">${t.subject}</span>
        <span class="badge due-soon">${fmt}</span>
      </li>
    `;
  }).join('');
}

window.initDashboard = initDashboard;