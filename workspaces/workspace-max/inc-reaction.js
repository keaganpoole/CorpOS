const path = require('path');
const cwd = 'C:\\Users\\vboxuser\\.openclaw\\workspaces\\workspace-max';
const Database = require(path.join(cwd, 'skybox', 'node_modules', 'better-sqlite3'));
const db = new Database(path.join(cwd, 'skybox', 'data', 'skybox.db'));

const row = db.prepare("SELECT * FROM reactions WHERE agent_name = 'Max' AND reaction_type = 'compliment'").get();
console.log('Current:', JSON.stringify(row));

if (row) {
  db.prepare("UPDATE reactions SET count = count + 1 WHERE id = ?").run(row.id);
  console.log('Incremented ID:', row.id);
} else {
  db.prepare("INSERT INTO reactions (agent_name, reaction_type, count) VALUES ('Max', 'compliment', 1)").run();
  console.log('Inserted new row');
}

const updated = db.prepare("SELECT * FROM reactions WHERE agent_name = 'Max' AND reaction_type = 'compliment'").get();
console.log('Updated:', JSON.stringify(updated));

db.close();
