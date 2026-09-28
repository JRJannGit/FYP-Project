function initTimetable() {
  if (!localStorage.getItem('uptm_buddy_timetable')) {
    AppStorage.set('timetable', [
      { day: 'Mon', time: '9:00 AM', subject: 'Web Programming', room: 'DK2-03', color: 'blue' },
      { day: 'Tue', time: '11:00 AM', subject: 'Database System', room: 'DK2-05', color: 'red' },
      { day: 'Thu', time: '1:00 PM', subject: 'Digital Entrepreneurship', room: 'DK2-01', color: 'green' }
    ]);
  }

  renderTimetable();

  // Buka dialog Tambah Kelas Baru
  const header = document.querySelector('.timetable-header');
  if (header && !document.getElementById('add-class-btn')) {
    const addBtn = document.createElement('button');
    addBtn.id = 'add-class-btn';
    addBtn.className = 'icon-btn';
    addBtn.style.cssText = 'background:var(--primary-blue); color:#fff; font-weight:600; padding:8px 14px;';
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Tambah Kelas';
    addBtn.onclick = addNewClass;
    header.appendChild(addBtn);
  }
}

function renderTimetable() {
  const classes = AppStorage.get('timetable');
  const grid = document.querySelector('.timetable-grid');
  if (!grid) return;

  // Render semula kad kelas pada grid
  document.querySelectorAll('.class-card').forEach(c => c.parentElement.innerHTML = '');

  classes.forEach(c => {
    // Cari slot berdasarkan waktu dan hari
    const slots = document.querySelectorAll('.day-slot');
    slots.forEach(slot => {
      if (slot.dataset.day === c.day && slot.dataset.time === c.time) {
        slot.innerHTML = `
          <div class="class-card ${c.color}">
            <strong>${c.subject}</strong>
            <small>${c.room}</small>
            <i class="fa-solid fa-xmark delete-class" onclick="deleteClass('${c.subject}')" style="position:absolute; top:4px; right:6px; cursor:pointer;"></i>
          </div>
        `;
      }
    });
  });
}

function addNewClass() {
  const subject = prompt("Nama Subjek:");
  const room = prompt("Bilik / Makmal (cth: DK2-03):");
  const day = prompt("Hari (Mon / Tue / Wed / Thu / Fri):");
  const time = prompt("Masa (cth: 9:00 AM / 11:00 AM / 1:00 PM):");

  if (subject && day && time) {
    const classes = AppStorage.get('timetable');
    classes.push({ day, time, subject, room: room || 'DK2-01', color: 'blue' });
    AppStorage.set('timetable', classes);
    renderTimetable();
  }
}

function deleteClass(subject) {
  let classes = AppStorage.get('timetable');
  classes = classes.filter(c => c.subject !== subject);
  AppStorage.set('timetable', classes);
  renderTimetable();
}

document.addEventListener('DOMContentLoaded', initTimetable);