const { Controller } = require('./backend/controller');

const controller = new Controller();

controller.start()
  .then((port) => {
    console.log(`[Sonar] Server ready on http://127.0.0.1:${port}`);
  })
  .catch((err) => {
    console.error('[Sonar] Failed to start:', err.message);
    process.exit(1);
  });
