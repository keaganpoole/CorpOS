const { Controller } = require('./backend/controller');
const c = new Controller(7879);
c.start().then(async () => {
  await fetch('http://127.0.0.1:7879/api/tools/identify-caller', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+12076801233' })
  }).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)));
  process.exit(0);
}).catch(e => console.error('ERR:', e.message));
