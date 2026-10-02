async function checkReminders() {
  if (typeof API === 'undefined') return;

  // Check notification toggle
  if (window.__showNotifications === false) {
    console.log('[scheduler] Notifications disabled — skipping');
    return;
  }

  const user = AppStorage.getUser();
  if (!user) return;

  const studentId = user.student_id || user.identifier;
  if (!studentId) return;

  const res = await API.get(`/api/reminders/${studentId}/due?minutes=${DUE_WINDOW_MIN}`);
  if (!res.success || !res.data || res.data.length === 0) return;

  for (const r of res.data) {
    const key = `${r.id}@${r.remind_date}T${r.remind_time}`;
    if (triggeredIds.has(key)) continue;
    triggeredIds.add(key);

    console.log('[scheduler] Triggering popup for:', r.title);
    ipcRenderer.send('trigger-notification', {
      id: r.id,
      title: r.title,
      description: r.description,
      priority: r.priority,
      time: `${new Date(r.remind_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at ${formatTime(r.remind_time)}`
    });
  }
}