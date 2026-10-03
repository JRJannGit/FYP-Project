
function initNotifications() {
  const toast = document.getElementById('reminder-toast');
  const closeBtn = document.getElementById('close-toast');
  const dismissBtn = document.getElementById('toast-dismiss-btn');
  const viewBtn = document.getElementById('toast-view-btn');

  function hide() { if (toast) toast.style.display = 'none'; }

  if (closeBtn) closeBtn.onclick = hide;
  if (dismissBtn) dismissBtn.onclick = hide;
  if (viewBtn) viewBtn.onclick = () => {
    hide();
    document.querySelector('[data-view="assignments"]')?.click();
  };
}

window.initNotifications = initNotifications;