// Backup motivational quotes untuk mod offline
const LOCAL_QUOTES = [
  "Small progress every day leads to big results.",
  "Kejayaan tidak datang daripada apa yang anda buat secara bertukar-tukar, tetapi apa yang anda buat secara konsisten.",
  "Fokus pada proses, hasil akan menyusul kemudian.",
  "Jangan tangguhkan kerja hari ini untuk esok.",
  "Pendidikan adalah senjata paling berkuasa untuk mengubah masa depan anda.",
  "Setiap usaha kecil hari ini adalah pelaburan untuk kejayaan FYP anda!"
];

// Ambil quote dinamik secara automatik
async function fetchOnlineQuote() {
  try {
    const response = await fetch('https://dummyjson.com/quotes/random');
    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    return `${data.quote} — ${data.author}`;
  } catch (error) {
    console.log('Menggunakan quote tempatan (Mod Offline)');
    const randomIndex = Math.floor(Math.random() * LOCAL_QUOTES.length);
    return LOCAL_QUOTES[randomIndex];
  }
}

async function initDashboard() {
  const buddySpeech = document.getElementById('buddy-speech-text');
  const quoteText = document.querySelector('.quote-text');
  const timeBadge = document.querySelector('.time-badge');
  const greetingNameSpan = document.getElementById('user-greeting-name');

  // 1. Ambil maklumat pengguna dari LocalStorage
  const activeUser = JSON.parse(localStorage.getItem('uptm_user'));
  const userName = activeUser ? activeUser.full_name : 'Guest';

  // 2. Paparkan Nama Pengguna
  if (greetingNameSpan) {
    greetingNameSpan.innerText = userName;
  }

  // 3. Ambil & Paparkan Quote Secara Otomatik
  if (quoteText) {
    quoteText.innerText = '"Memuatkan petikan..."';
    const quote = await fetchOnlineQuote();
    quoteText.innerText = `"${quote}"`;
  }

  // 4. Kemaskini Masa & Tarikh
  if (timeBadge) {
    const now = new Date();
    const options = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    timeBadge.innerHTML = `<i class="fa-regular fa-clock"></i> ${now.toLocaleDateString('en-GB', options)}`;
  }

  try {
    // 5. Ambil data dari backend API (Bukan dari db.js terus)
    const [tasksRes, timetableRes] = await Promise.all([
      fetch('http://localhost:3000/api/tasks'),
      fetch('http://localhost:3000/api/timetable')
    ]);

    const tasks = await tasksRes.json();
    const timetable = await timetableRes.json();

    // 6. Kemaskini Maskot Buddy
    if (buddySpeech) {
      if (tasks && tasks.length > 0) {
        const nextTask = tasks[0];
        const formattedDate = nextTask.due_date ? new Date(nextTask.due_date).toLocaleDateString('en-GB') : 'Tidak lama lagi';
        buddySpeech.innerText = `Hai ${userName}! Anda ada ${tasks.length} tugasan belum selesai. Terdekat: "${nextTask.title}" (${formattedDate})!`;
      } else {
        buddySpeech.innerText = `Syabas ${userName}! Semua tugasan anda telah selesai!`;
      }
    }

    // 7. Klik Maskot Interaktif
    const mascotImg = document.querySelector('.mascot-img');
    if (mascotImg) {
      mascotImg.style.cursor = 'pointer';
      mascotImg.onclick = () => {
        const tips = [
          `Mari fokus selesaikan tugasan hari ini, ${userName}!`,
          "Jangan lupa semak jadual kelas di UCAM!",
          "Berehat sekejap jika penat, kemudian sambung semula!",
          "Kekal konsisten dengan kemajuan FYP anda!"
        ];
        alert(`Buddy kata: "${tips[Math.floor(Math.random() * tips.length)]}"`);
      };
    }

    // 8. Render Widgets
    renderTodaySchedule(timetable);
    renderUpcomingTasks(tasks);

  } catch (error) {
    console.error('Ralat Papan Pemuka:', error);
  }
}

function renderTodaySchedule(timetable) {
  const scheduleList = document.querySelector('.schedule-list');
  if (!scheduleList) return;

  const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = daysMap[new Date().getDay()];
  const todayClasses = timetable ? timetable.filter(c => c.day === today) : [];

  if (todayClasses.length === 0) {
    scheduleList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 10px 0;">Tiada kelas hari ini.</p>';
    return;
  }

  scheduleList.innerHTML = '';
  todayClasses.forEach(c => {
    scheduleList.innerHTML += `
      <li class="schedule-item">
        <span class="status-indicator ${c.color || 'blue'}"></span>
        <div class="schedule-details">
          <strong>${c.subject}</strong>
          <small>${c.time_slot}</small>
        </div>
        <span class="room-tag">${c.room}</span>
      </li>
    `;
  });
}

function renderUpcomingTasks(tasks) {
  const taskList = document.querySelector('.task-list');
  if (!taskList) return;

  if (!tasks || tasks.length === 0) {
    taskList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 10px 0;">Tiada tugasan mendesak.</p>';
    return;
  }

  const topTasks = tasks.slice(0, 3);
  taskList.innerHTML = '';
  topTasks.forEach(t => {
    const dueDateStr = t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB') : 'Tidak lama lagi';
    taskList.innerHTML += `
      <li class="task-item">
        <label class="checkbox-container">
          <span class="task-title">${t.title}</span>
        </label>
        <span class="badge due-soon">${dueDateStr}</span>
      </li>
    `;
  });
}

document.addEventListener('DOMContentLoaded', initDashboard);