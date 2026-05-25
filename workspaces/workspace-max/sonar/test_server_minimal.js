const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  console.log('GET /');
  res.send('Sonar backend running');
});

app.post('/api/tools/create-customer', (req, res) => {
  console.log('POST /api/tools/create-customer', req.body);
  res.json({ success: true, customer: { id: 'test', name: req.body.name, phone: req.body.phone } });
});

const http = require('http');
const server = http.createServer(app);

server.listen(7878, '127.0.0.1', () => {
  console.log('[TEST] Server running on http://127.0.0.1:7878');
});
