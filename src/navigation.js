const fs = require('fs');
const path = require('path');

document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  const mainContent = document.getElementById('main-content');

  // Memuatkan templat HTML menggunakan Node.js File System (fs)
  function loadView(viewName) {
    try {
      const viewPath = path.join(__dirname, 'views', `${viewName}.html`);
      
      if (!fs.existsSync(viewPath)) {
        throw new Error(`Fail tidak wujud di: ${viewPath}`);
      }

      const html = fs.readFileSync(viewPath, 'utf8');
      mainContent.innerHTML = html;

      // Jalankan fungsi inisialisasi modul mengikut paparan aktif
      if (viewName === 'dashboard' && typeof initDashboard === 'function') {
        initDashboard();
      } else if (viewName === 'timetable' && typeof initTimetable === 'function') {
        initTimetable();
      } else if (viewName === 'assignments' && typeof initAssignments === 'function') {
        initAssignments();
      } else if (viewName === 'calendar' && typeof initCalendar === 'function') {
        initCalendar();
      } else if (viewName === 'notes' && typeof initNotes === 'function') {
        initNotes();
      } else if (viewName === 'reminders' && typeof initReminders === 'function') {
        initReminders();
      } else if (viewName === 'resources' && typeof initResources === 'function') {
        initResources();
      } else if (viewName === 'settings' && typeof initSettings === 'function') {
        initSettings();
      }
    } catch (error) {
      console.error(error);
      mainContent.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #ef4444;">
          <h2>Error loading view: ${viewName}</h2>
          <p style="color: #94a3b8; margin-top: 10px;">${error.message}</p>
        </div>
      `;
    }
  }

  // Kendalikan klik menu navigasi
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();

      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      const selectedView = item.getAttribute('data-view');
      loadView(selectedView);
    });
  });

  // Paparan laluan automatik semasa aplikasi dibuka
  loadView('dashboard');
});