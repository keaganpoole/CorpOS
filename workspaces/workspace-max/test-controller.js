// Test loading the controller and calling the endpoint directly
const http = require('http');

const req = http.request(
  {
    hostname: '127.0.0.1',
    port: 7878,
    path: '/api/openrouter/models',
    method: 'GET',
  },
  (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Body:', data.substring(0, 300));
    });
  }
);
req.on('error', (e) => console.error('Request error:', e.message));
req.end();
