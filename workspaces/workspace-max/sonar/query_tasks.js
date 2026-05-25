const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'SONAR.db');
const db = new Database(dbPath);

// Query queued tasks
const queuedTasks = db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY updated_at DESC').all('queued');

console.log('Queued tasks:');
queuedTasks.forEach(task => {
  console.log(`- ${task.id}: ${task.title} (owner: ${task.owner}, status: ${task.status})`);
});

// Update queued tasks to 'in progress'
if (queuedTasks.length > 0) {
  const updateStmt = db.prepare('UPDATE tasks SET status = ?, updated_at = datetime(\'now\') WHERE id = ?');
  const updateMany = db.transaction((tasks) => {
    for (const task of tasks) {
      updateStmt.run('in progress', task.id);
    }
  });

  updateMany(queuedTasks);
  console.log(`\nUpdated ${queuedTasks.length} tasks to 'in progress'.`);
} else {
  console.log('\nNo queued tasks found.');
}

db.close();