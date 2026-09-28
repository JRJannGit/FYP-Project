function initAssignments() {
  const container = document.querySelector('.task-cards-list');
  const addBtn = document.getElementById('open-add-modal');

  function renderAssignments(filter = 'all') {
    const tasks = AppStorage.get('assignments');
    if (!container) return;
    
    container.innerHTML = '';
    
    const filteredTasks = tasks.filter(task => {
      if (filter === 'upcoming') return !task.completed;
      if (filter === 'completed') return task.completed;
      return true;
    });

    filteredTasks.forEach(task => {
      const card = document.createElement('div');
      card.className = `assignment-card ${task.completed ? 'completed' : 'upcoming'}`;
      card.innerHTML = `
        <div class="card-left">
          <input type="checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
          <div class="assignment-info">
            <h4 style="${task.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
              ${task.title} ${task.isExam ? '<span class="exam-tag">EXAM</span>' : ''}
            </h4>
            <p>${task.desc}</p>
          </div>
        </div>
        <div class="card-right">
          <span class="due-date">${task.due}</span>
          <button class="delete-btn" data-id="${task.id}" style="background:none; border:none; color:#ef4444; cursor:pointer; margin-left:10px;"><i class="fa-solid fa-trash"></i></button>
        </div>
      `;
      container.appendChild(card);
    });

    // Event Listener Checkbox
    container.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = parseInt(e.target.dataset.id);
        const tasks = AppStorage.get('assignments');
        const target = tasks.find(t => t.id === id);
        if (target) {
          target.completed = e.target.checked;
          AppStorage.set('assignments', tasks);
          renderAssignments(filter);
        }
      });
    });

    // Event Listener Hapus
    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id);
        let tasks = AppStorage.get('assignments');
        tasks = tasks.filter(t => t.id !== id);
        AppStorage.set('assignments', tasks);
        renderAssignments(filter);
      });
    });
  }

  // Handle Filter Tabs
  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      renderAssignments(e.target.dataset.filter);
    });
  });

  // Handle Tambah Tugas Baru
  if (addBtn) {
    addBtn.onclick = () => {
      const title = prompt("Nama Tugas / Subjek:");
      const desc = prompt("Deskripsi Tugas:");
      const due = prompt("Tanggal Tenggat (YYYY-MM-DD):");
      if (title) {
        const tasks = AppStorage.get('assignments');
        tasks.push({ id: Date.now(), title, desc, due: due || 'Soon', isExam: false, completed: false });
        AppStorage.set('assignments', tasks);
        renderAssignments();
      }
    };
  }

  renderAssignments();
}