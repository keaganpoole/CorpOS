// Test env loading and the API call directly from the controller context
process.env.OPENROUTER_API_KEY = 'test'; // mock

const Controller = require('./skybox/backend/controller');
const c = new Controller(7879);

c.app.listen(7879, () => {
  console.log('Server up on 7879');

  // Manually test the endpoint
  const http = require('http');
  const req = http.get('http://127.0.0.1:7879/api/openrouter/models', (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      console.log('Response status:', res.statusCode);
      console.log('Response body:', data.substring(0, 500));
      c.server.close();
      process.exit(0);
    });
  });
  req.on('error', (e) => {
    console.error('Request error:', e.message);
    c.server.close();
    process.exit(1);
  });
});
