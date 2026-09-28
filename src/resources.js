function initResources() {
  const resourceCards = document.querySelectorAll('.resource-card');

  resourceCards.forEach(card => {
    card.addEventListener('click', (e) => {
      const portalName = card.querySelector('h4').innerText;
      const targetUrl = card.getAttribute('href');

      // If using Electron, open external URLs in the user's default browser
      if (window.require) {
        e.preventDefault();
        const { shell } = window.require('electron');
        if (targetUrl && targetUrl !== '#') {
          shell.openExternal(targetUrl);
        } else {
          alert(`Opening portal: ${portalName}`);
        }
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', initResources);