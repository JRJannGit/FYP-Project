function initCalendar() {
  const dayCells = document.querySelectorAll('.day-cell:not(.muted)');

  dayCells.forEach(cell => {
    cell.addEventListener('click', () => {
      dayCells.forEach(c => c.classList.remove('active-today'));
      cell.classList.add('active-today');
    });
  });
}

document.addEventListener('DOMContentLoaded', initCalendar);