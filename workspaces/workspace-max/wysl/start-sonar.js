const { Controller } = require('./sonar/backend/controller.js');
const c = new Controller(7878);
c.start().catch(err => { console.error('Failed:', err.message); process.exit(1); });
