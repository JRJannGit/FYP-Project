// Storage Controller untuk mengelola data CRUD
const AppStorage = {
  get(key, defaultValue = []) {
    const data = localStorage.getItem(`uptm_buddy_${key}`);
    return data ? JSON.parse(data) : defaultValue;
  },
  set(key, value) {
    localStorage.setItem(`uptm_buddy_${key}`, JSON.stringify(value));
  }
};

// Inisialisasi Data Bawaan jika masih kosong
if (!localStorage.getItem('uptm_buddy_assignments')) {
  AppStorage.set('assignments', [
    { id: 1, title: 'Database Assignment', desc: 'Submission of ERD and Report', due: '2026-08-22', isExam: false, completed: false },
    { id: 2, title: 'Web Programming Lab', desc: 'Practical Task 3', due: '2026-08-25', isExam: false, completed: false },
    { id: 3, title: 'OOP Quiz', desc: 'Chapter 4 - 6', due: '2026-09-01', isExam: true, completed: false }
  ]);
}

if (!localStorage.getItem('uptm_buddy_notes')) {
  AppStorage.set('notes', [
    { id: 1, title: 'Lecture Notes (Web Programming)', content: '<b>Important Points:</b><br>• HTML - Structure<br>• CSS - Styling', date: '20 Aug 2026' },
    { id: 2, title: 'Database Notes (SQL Basics)', content: 'CREATE TABLE, SELECT, JOIN queries.', date: '18 Aug 2026' }
  ]);
}