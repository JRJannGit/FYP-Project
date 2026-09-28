function initSettings() {
  const notificationToggle = document.getElementById('toggle-notifications');
  const animationToggle = document.getElementById('toggle-animations');
  const darkModeToggle = document.getElementById('toggle-darkmode');
  const reminderToast = document.getElementById('reminder-toast');

  // Load saved preferences from localStorage
  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-theme');
    if (darkModeToggle) darkModeToggle.checked = false;
  } else {
    if (darkModeToggle) darkModeToggle.checked = true;
  }

  if (localStorage.getItem('showNotifications') === 'false') {
    if (notificationToggle) notificationToggle.checked = false;
  }

  if (localStorage.getItem('playAnimations') === 'false') {
    if (animationToggle) animationToggle.checked = false;
  }

  // 1. Dark / Light Mode Toggle
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', (e) => {
      if (!e.target.checked) {
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
      } else {
        document.body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
      }
    });
  }

  // 2. Notifications Toggle
  if (notificationToggle) {
    notificationToggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      localStorage.setItem('showNotifications', isEnabled);
      if (reminderToast) {
        reminderToast.style.display = isEnabled ? 'block' : 'none';
      }
    });
  }

  // 3. Animations Toggle
  if (animationToggle) {
    animationToggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      localStorage.setItem('playAnimations', isEnabled);
      const mascot = document.querySelector('.mascot-img');
      if (mascot) {
        mascot.style.transition = isEnabled ? 'transform 0.3s ease' : 'none';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', initSettings);