// =========================================
// src/settings.js
// =========================================

function initSettings() {
  const notifToggle = document.getElementById('toggle-notifications');
  const animToggle = document.getElementById('toggle-animations');
  const darkToggle = document.getElementById('toggle-darkmode');

  // Load saved states
  const isLight = localStorage.getItem('theme') === 'light';
  if (isLight) document.body.classList.add('light-theme');
  if (darkToggle) darkToggle.checked = !isLight;

  if (notifToggle) notifToggle.checked = localStorage.getItem('showNotifications') !== 'false';
  if (animToggle)  animToggle.checked  = localStorage.getItem('playAnimations')   !== 'false';

  if (darkToggle) {
    darkToggle.onclick = () => {
      if (darkToggle.checked) {
        document.body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
      } else {
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
      }
    };
  }

  if (notifToggle) {
    notifToggle.onchange = () => localStorage.setItem('showNotifications', notifToggle.checked);
  }
  if (animToggle) {
    animToggle.onchange = () => {
      localStorage.setItem('playAnimations', animToggle.checked);
      document.body.classList.toggle('no-buddy-anim', !animToggle.checked);
    };
  }
}

window.initSettings = initSettings;