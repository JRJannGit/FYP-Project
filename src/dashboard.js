function initDashboard() {
  var tasks = AppStorage.get('assignments') || [];
  var buddySpeech = document.getElementById('buddy-speech-text');

  var pendingTasks = tasks.filter(function(t) { return !t.completed; });

  if (buddySpeech) {
    if (pendingTasks.length > 0) {
      buddySpeech.innerText = "Hey JANN! Anda ada " + pendingTasks.length + " tugasan belum selesai. Tugasan terdekat: " + pendingTasks[0].title + "!";
    } else {
      buddySpeech.innerText = "Sangat bagus JANN! Semua tugasan akademik anda telah selesai!";
    }
  }

  var mascotImg = document.querySelector('.mascot-img');
  if (mascotImg) {
    mascotImg.style.cursor = 'pointer';
    mascotImg.onclick = function() {
      var quotes = [
        "Jom fokus siapkan tugasan hari ini!",
        "Jangan lupa semak jadual kelas anda!",
        "Kekal produktif, kejayaan milik anda!",
        "Rehat sekejap jika penat, kemudian sambung lagi!"
      ];
      var randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
      alert("Buddy kata: \"" + randomQuote + "\"");
    };
  }

  renderDashboardWidgets();
}

function renderDashboardWidgets() {
  var tasks = (AppStorage.get('assignments') || []).filter(function(t) { return !t.completed; }).slice(0, 3);
  var taskList = document.querySelector('.task-list');

  if (taskList) {
    if (tasks.length === 0) {
      taskList.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem; padding: 10px;">Tiada tugasan mendesak.</p>';
    } else {
      var htmlContent = '';
      tasks.forEach(function(t) {
        htmlContent += '<li class="task-item">';
        htmlContent += '  <label class="checkbox-container">';
        htmlContent += '    <span class="task-title">' + t.title + '</span>';
        htmlContent += '  </label>';
        htmlContent += '  <span class="badge due-soon">' + (t.due || 'Soon') + '</span>';
        htmlContent += '</li>';
      });
      taskList.innerHTML = htmlContent;
    }
  }
}

document.addEventListener('DOMContentLoaded', initDashboard);