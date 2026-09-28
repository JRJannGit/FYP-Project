function initNotifications() {
  const toast = document.getElementById('reminder-toast');
  const closeBtn = document.getElementById('close-toast');
  const dismissBtn = document.getElementById('toast-dismiss-btn');
  const viewBtn = document.getElementById('toast-view-btn');

  function hideToast() {
    if (toast) {
      toast.style.display = 'none';
    }
  }

  if (closeBtn) closeBtn.addEventListener('click', hideToast);
  if (dismissBtn) dismissBtn.addEventListener('click', hideToast);
  
  if (viewBtn) {
    viewBtn.addEventListener('click', () => {
      hideToast();
      // Trigger navigation to assignments module
      const assignmentNav = document.querySelector('[data-view="assignments"]');
      if (assignmentNav) assignmentNav.click();
    });
  }
}

document.addEventListener('DOMContentLoaded', initNotifications);