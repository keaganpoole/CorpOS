/**
 * OpenClaw → SONAR Runtime Bridge
 * Posts real OpenClaw events to SONAR's event ingestion API.
 * Called from OpenClaw cron jobs or exec commands.
 *
 * Usage:
 *   node SONAR-bridge.js <event_type> <message> [options_json]
 *
 * Examples:
 *   node SONAR-bridge.js agent_heartbeat "Max active"
 *   node SONAR-bridge.js task_started "Research sweep" '{"task_id":"T-001","agent_id":"yanna"}'
 *   node SONAR-bridge.js system_status "OpenClaw gateway online"
 */

const http = require('http');

const SONAR_URL = 'http://127.0.0.1:7878';

function postToSONAR(event) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(event);
    const url = new URL('/api/events', SONAR_URL);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });

    req.on('error', (err) => {
      console.error('[Bridge] SONAR unreachable:', err.message);
      reject(err);
    });

    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('SONAR request timeout'));
    });

    req.write(body);
    req.end();
  });
}

async function main() {
  const [,, eventType, message, optionsJson] = process.argv;

  if (!eventType) {
    console.log('Usage: node SONAR-bridge.js <event_type> <message> [options_json]');
    process.exit(1);
  }

  const event = {
    event_type: eventType,
    message: message || '',
    actor: 'openclaw',
    actor_type: 'system',
    source: 'openclaw_runtime',
  };

  // Parse optional extra fields (task_id, agent_id, severity, payload)
  if (optionsJson) {
    try {
      const opts = JSON.parse(optionsJson);
      if (opts.task_id) event.task_id = opts.task_id;
      if (opts.agent_id) event.agent_id = opts.agent_id;
      if (opts.severity) event.severity = opts.severity;
      if (opts.payload) event.payload = opts.payload;
      if (opts.actor) event.actor = opts.actor;
      if (opts.actor_type) event.actor_type = opts.actor_type;
    } catch (err) {
      console.error('[Bridge] Invalid options JSON:', err.message);
    }
  }

  try {
    const result = await postToSONAR(event);
    console.log('[Bridge] Event sent:', eventType, result.success ? '✓' : '✗');
  } catch (err) {
    console.error('[Bridge] Failed:', err.message);
    process.exit(1);
  }
}

main();
