// =========================================
// src/navigation.js — SPA router + zoom fix
// =========================================

(function () {
  const navItems = document.querySelectorAll('.nav-item');
  const mainContent = document.getElementById('main-content');

  const INIT_MAP = {
    dashboard:     'initDashboard',
    timetable:     'initTimetable',
    assignments:   'initAssignments',
    calendar:      'initCalendar',
    notes:         'initNotes',
    reminders:     'initReminders',
    resources:     'initResources',
    settings:      'initSettings',
    profile:       'initProfile',
    notifications: 'initNotifications'
  };

  async function loadView(viewName) {
    if (!mainContent) return;

    try {
      const res = await fetch(`views/${viewName}.html`);
      if (!res.ok) throw new Error(`View "${viewName}" not found (${res.status})`);
      const html = await res.text();
      mainContent.innerHTML = html;

      const fnName = INIT_MAP[viewName];
      if (fnName && typeof window[fnName] === 'function') {
        try {
          window[fnName]();
        } catch (e) {
          console.error(`init ${viewName} threw:`, e);
        }
      } else {
        console.warn(`No init function for "${viewName}" (looked for ${fnName})`);
      }
    } catch (err) {
      console.error(`loadView(${viewName}) failed:`, err);
      mainContent.innerHTML = `
        <div style="padding:40px;text-align:center;color:#ef4444;">
          <h2>Error loading "${viewName}"</h2>
          <p style="color:#94a3b8;margin-top:10px;">${err.message}</p>
        </div>
      `;
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.getAttribute('data-view');
      if (!view) return;
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      loadView(view);
    });
  });

  const userProfile = document.querySelector('.user-profile');
  if (userProfile) {
    userProfile.style.cursor = 'pointer';
    userProfile.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      loadView('profile');
    });
  }

  window.loadView = loadView;

  document.addEventListener('DOMContentLoaded', () => {
    loadView('dashboard');
  });

  // =========================================
  // ZOOM FIX
  // =========================================
  if (window.require) {
    try {
      const { ipcRenderer, webFrame } = window.require('electron');

      // Force zoom = 1 on initial load
      webFrame.setZoomLevel(0);
      webFrame.setZoomFactor(1);

      // Reset zoom when window resizes / restores
      ipcRenderer.on('window-resized', () => {
        webFrame.setZoomLevel(0);
        webFrame.setZoomFactor(1);
      });

      // Global Ctrl+/-/0 block (defensive)
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && ['+', '-', '=', '0'].includes(e.key)) {
          e.preventDefault();
        }
      });

      // Block Ctrl+Scroll (mouse wheel zoom)
      document.addEventListener('wheel', (e) => {
        if (e.ctrlKey) e.preventDefault();
      }, { passive: false });

      // Block pinch zoom (trackpad)
      document.addEventListener('gesturestart', (e) => e.preventDefault());

    } catch (err) {
      console.warn('Zoom fix unavailable:', err);
    }
  }
})();