function initDashboard() {
  // Checkbox interactivity for task completion
  const checkboxes = document.querySelectorAll('.task-item input[type="checkbox"]');
  
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const taskTitle = e.target.parentElement.querySelector('.task-title');
      if (e.target.checked) {
        taskTitle.style.textDecoration = 'line-through';
        taskTitle.style.opacity = '0.5';
      } else {
        taskTitle.style.textDecoration = 'none';
        taskTitle.style.opacity = '1';
      }
    });
  });
}

// Auto initialize if dynamic view loader mounts this html
document.addEventListener('DOMContentLoaded', initDashboard);