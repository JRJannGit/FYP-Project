function initSettings() {
  const notificationToggle = document.getElementById('toggle-notifications');
  const animationToggle = document.getElementById('toggle-animations');
  const darkModeToggle = document.getElementById('toggle-darkmode');

  // Sync initial switch position based on stored setting
  const isLightMode = localStorage.getItem('theme') === 'light';
  if (isLightMode) {
    document.body.classList.add('light-theme');
    if (darkModeToggle) darkModeToggle.checked = false;
  } else {
    document.body.classList.remove('light-theme');
    if (darkModeToggle) darkModeToggle.checked = true;
  }

  // Dark/Light Mode Event Handler
  if (darkModeToggle) {
    darkModeToggle.onclick = function() {
      if (!darkModeToggle.checked) {
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
      } else {
        document.body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
      }
    };
  }

  // Notifications Toggle Handler
  if (notificationToggle) {
    notificationToggle.onchange = function() {
      localStorage.setItem('showNotifications', notificationToggle.checked);
    };
  }

  // Animations Toggle Handler
  if (animationToggle) {
    animationToggle.onchange = function() {
      localStorage.setItem('playAnimations', animationToggle.checked);
    };
  }
}

document.addEventListener('DOMContentLoaded', initSettings);