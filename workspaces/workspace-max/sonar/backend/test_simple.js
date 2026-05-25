const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server running on 7878');
});

app.get('/api/tools/check-availability', (req, res) => {
  res.json({ slots: ['10:00', '11:00', '14:00'] });
});

app.post('/api/tools/check-availability', (req, res) => {
  res.json({ slots: ['10:00', '11:00', '14:00'] });
});

const http = require('http');
const server = http.createServer(app);

server.listen(7878, '127.0.0.1', () => {
  console.log('[TEST] Server running on http://127.0.0.1:7878');
});
