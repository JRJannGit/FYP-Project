const db = require('./db.js');

// Backup motivational quotes for offline fallback
const LOCAL_QUOTES = [
  "Small progress every day leads to big results.",
  "Kejayaan tidak datang daripada apa yang anda buat secara bertukar-tukar, tetapi apa yang anda buat secara konsisten.",
  "Fokus pada proses, hasil akan menyusul kemudian.",
  "Jangan tangguhkan kerja hari ini untuk esok.",
  "Pendidikan adalah senjata paling berkuasa untuk mengubah masa depan anda.",
  "Setiap usaha kecil hari ini adalah pelaburan untuk kejayaan FYP anda!"
];

// Fetch dynamic online quote
async function fetchOnlineQuote() {
  try {
    const response = await fetch('https://dummyjson.com/quotes/random');
    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    return `${data.quote} — ${data.author}`;
  } catch (error) {
    console.log('Using local quote fallback (Offline mode)');
    const randomIndex = Math.floor(Math.random() * LOCAL_QUOTES.length);
    return LOCAL_QUOTES[randomIndex];
  }
}

async function initDashboard() {
  const buddySpeech = document.getElementById('buddy-speech-text');
  const quoteText = document.querySelector('.quote-text');
  const timeBadge = document.querySelector('.time-badge');
  const greetingNameSpan = document.getElementById('user-greeting-name');

  // 1. Get Logged-in User Info from LocalStorage
  const activeUser = JSON.parse(localStorage.getItem('uptm_user'));
  const userName = activeUser ? activeUser.full_name : 'Guest';

  // 2. Inject User Name into Header
  if (greetingNameSpan) {
    greetingNameSpan.innerText = userName;
  }

  // 3. Fetch Quote from Online API or Fallback
  if (quoteText) {
    quoteText.innerText = '"Loading quote..."';
    const quote = await fetchOnlineQuote();
    quoteText.innerText = `"${quote}"`;
  }

  // 4. Update Current Date & Time
  if (timeBadge) {
    const now = new Date();
    const options = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    timeBadge.innerHTML = `<i class="fa-regular fa-clock"></i> ${now.toLocaleDateString('en-GB', options)}`;
  }

  try {
    // 5. Query Unfinished Tasks & Schedule from MySQL
    const [tasks] = await db.query('SELECT * FROM assignments WHERE completed = FALSE ORDER BY due_date ASC');
    const [timetable] = await db.query('SELECT * FROM timetable');

    // 6. Update Buddy's Speech with Logged-In User's Name
    if (buddySpeech) {
      if (tasks.length > 0) {
        const nextTask = tasks[0];
        const formattedDate = nextTask.due_date ? new Date(nextTask.due_date).toLocaleDateString('en-GB') : 'Soon';
        buddySpeech.innerText = `Hey ${userName}! You have ${tasks.length} pending tasks in MySQL. Nearest: "${nextTask.title}" (${formattedDate})!`;
      } else {
        buddySpeech.innerText = `Great job ${userName}! All your academic tasks in MySQL are completed!`;
      }
    }

    // 7. Interactive Mascot Click Handler
    const mascotImg = document.querySelector('.mascot-img');
    if (mascotImg) {
      mascotImg.style.cursor = 'pointer';
      mascotImg.onclick = () => {
        const tips = [
          `Let's focus on finishing today's tasks, ${userName}!`,
          "Don't forget to check your class schedule on UCAM!",
          "Take a short break if you're tired, then keep going!",
          "Stay consistent with your FYP progress!"
        ];
        alert(`Buddy says: "${tips[Math.floor(Math.random() * tips.length)]}"`);
      };
    }

    // 8. Render Widgets
    renderTodaySchedule(timetable);
    renderUpcomingTasks(tasks);

  } catch (error) {
    console.error('MySQL Dashboard Error:', error);
  }
}

function renderTodaySchedule(timetable) {
  const scheduleList = document.querySelector('.schedule-list');
  if (!scheduleList) return;

  const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = daysMap[new Date().getDay()];

  const todayClasses = timetable.filter(c => c.day === today);

  if (todayClasses.length === 0) {
    scheduleList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 10px 0;">No classes scheduled for today.</p>';
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

  const topTasks = tasks.slice(0, 3);

  if (topTasks.length === 0) {
    taskList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 10px 0;">No urgent tasks pending.</p>';
    return;
  }

  taskList.innerHTML = '';
  topTasks.forEach(t => {
    const dueDateStr = t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB') : 'Soon';
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