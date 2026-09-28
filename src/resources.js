function initResources() {
  const resourceCards = document.querySelectorAll('.resource-card');

  resourceCards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const targetUrl = card.getAttribute('href');

      if (targetUrl && targetUrl !== '#') {
        if (window.require) {
          const { shell } = window.require('electron');
          shell.openExternal(targetUrl);
        } else {
          window.open(targetUrl, '_blank');
        }
      } else {
        alert("Pautan portal sedia ada akan dibuka di pelayar laman web anda.");
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', initResources);