const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Test server OK');
});
server.listen(7878, '127.0.0.1', () => {
  console.log('Test server running on http://127.0.0.1:7878');
});
