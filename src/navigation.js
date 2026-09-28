const fs = require('fs');
const path = require('path');

document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  const mainContent = document.getElementById('main-content');

  function loadView(viewName) {
    try {
      // Memastikan laluan menunjukkan ke folder 'views'
      const viewPath = path.join(__dirname, '..', 'views', `${viewName}.html`);
      
      if (!fs.existsSync(viewPath)) {
        // Fallback jika fail dipanggil dari root
        const altPath = path.join(__dirname, 'views', `${viewName}.html`);
        if (fs.existsSync(altPath)) {
          var html = fs.readFileSync(altPath, 'utf8');
        } else {
          throw new Error(`Fail tidak ditemui di: ${viewPath}`);
        }
      } else {
        var html = fs.readFileSync(viewPath, 'utf8');
      }

      mainContent.innerHTML = html;

      // Jalankan fungsi penginisialisasi mengikut paparan
      if (viewName === 'dashboard' && typeof initDashboard === 'function') initDashboard();
      if (viewName === 'timetable' && typeof initTimetable === 'function') initTimetable();
      if (viewName === 'assignments' && typeof initAssignments === 'function') initAssignments();
      if (viewName === 'calendar' && typeof initCalendar === 'function') initCalendar();
      if (viewName === 'notes' && typeof initNotes === 'function') initNotes();
      if (viewName === 'reminders' && typeof initReminders === 'function') initReminders();
      if (viewName === 'resources' && typeof initResources === 'function') initResources();
      if (viewName === 'settings' && typeof initSettings === 'function') initSettings();
      if (viewName === 'profile' && typeof initProfile === 'function') initProfile(); 

    } catch (error) {
      console.error(error);
      mainContent.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #ef4444;">
          <h2>Error: ${viewName}</h2>
          <p style="color: #94a3b8; margin-top: 10px;">${error.message}</p>
        </div>
      `;
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      const selectedView = item.getAttribute('data-view');
      if (selectedView) {
        loadView(selectedView);
      }
    });
  });

  // Add profile click trigger inside src/navigation.js
const userProfileCard = document.querySelector('.user-profile');
if (userProfileCard) {
  userProfileCard.style.cursor = 'pointer';
  userProfileCard.onclick = () => {
    loadView('profile');
  };
}

// Ensure initProfile is registered inside loadView(viewName)
if (viewName === 'profile' && typeof initProfile === 'function') {
  initProfile();
}

async function loadView(viewName) {
  const mainContent = document.getElementById('main-content');
  try {
    const response = await fetch(`views/${viewName}.html`);
    const html = await response.text();
    mainContent.innerHTML = html;

    // Panggil semula skrip modul mengikut paparan
    if (viewName === 'dashboard' && typeof initDashboard === 'function') {
      initDashboard();
    } else if (viewName === 'profile' && typeof initProfile === 'function') {
      initProfile();
    }
  } catch (err) {
    console.error('Error loading view:', err);
  }
}
})