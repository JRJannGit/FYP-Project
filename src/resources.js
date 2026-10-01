// =========================================
// src/resources.js
// =========================================

function initResources() {
  const grid = document.querySelector('.resources-grid');

  async function load() {
    if (!grid) return;
    const res = await API.get('/api/resources');
    if (!res.success) {
      grid.innerHTML = `<p style="color:#f87171;">Failed: ${res.error}</p>`;
      return;
    }
    grid.innerHTML = res.data.map(r => `
      <a href="${r.url}" class="resource-card" data-url="${r.url}">
        <div class="card-brand"><i class="fa-solid ${r.icon || 'fa-link'}"></i></div>
        <div class="card-info">
          <h4>${r.title}</h4>
          <p>${r.description || ''}</p>
        </div>
        <i class="fa-solid fa-arrow-up-right-from-square external-icon"></i>
      </a>
    `).join('');
  }

  grid?.addEventListener('click', (e) => {
    const card = e.target.closest('.resource-card');
    if (!card) return;
    e.preventDefault();
    const url = card.dataset.url;
    if (!url) return;
    if (window.require) {
      const { shell } = window.require('electron');
      shell.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  });

  load();
}

window.initResources = initResources;