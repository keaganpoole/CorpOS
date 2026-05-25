/**
 * Route Tracker — Middleware that tracks API endpoint hits
 * and broadcasts them via WebSocket for the Routes page.
 */

function createRouteTracker(app, broadcast) {
  const recentHits = [];
  const MAX_HITS = 100;

  // Middleware — intercept all /api/* requests (global, not mounted on a subpath)
  app.use((req, res, next) => {
    // Only track /api/ endpoints
    if (!req.originalUrl.startsWith('/api/')) return next();
    const start = Date.now();
    const method = req.method;

    // Capture response
    const originalSend = res.send.bind(res);
    res.send = function(body) {
      const duration = Date.now() - start;
      const status = res.statusCode;

      // Use originalUrl for the full path (includes /api/ prefix)
      const fullPath = req.originalUrl.split('?')[0];

      const hit = {
        type: 'route_hit',
        method,
        endpoint: fullPath,
        status,
        duration,
        timestamp: new Date().toISOString(),
        // Classify which system called it
        source: classifySource(req),
      };

      // Add request body context for server tools (without PII)
      if (req.body && method === 'POST') {
        hit.context = buildContext(fullPath, req.body);
      }

      // Store in recent hits
      recentHits.unshift(hit);
      if (recentHits.length > MAX_HITS) recentHits.pop();

      // Broadcast to all WebSocket clients
      broadcast(hit);

      return originalSend(body);
    };

    next();
  });

  return {
    getRecent: (limit = 50) => recentHits.slice(0, limit),
    getStats: () => {
      const stats = {};
      for (const hit of recentHits) {
        const key = hit.endpoint;
        if (!stats[key]) stats[key] = { endpoint: key, method: hit.method, total: 0, avgDuration: 0, lastHit: null, errors: 0 };
        stats[key].total++;
        stats[key].avgDuration = (stats[key].avgDuration * (stats[key].total - 1) + hit.duration) / stats[key].total;
        stats[key].lastHit = hit.timestamp;
        if (hit.status >= 400) stats[key].errors++;
      }
      return Object.values(stats);
    },
  };
}

function classifySource(req) {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const referer = req.headers['referer'] || '';
  const url = req.originalUrl || '';

  if (url.includes('/tools/')) return 'elevenlabs';
  if (url.includes('/sonar/')) return 'dashboard';
  if (url.includes('/webhook/')) return 'supabase';
  if (ua.includes('electron') || referer.includes('localhost:5173')) return 'dashboard';
  return 'external';
}

function buildContext(endpoint, body) {
  // Don't store PII — just the action context
  if (endpoint.includes('identify-caller')) return { action: 'identify' };
  if (endpoint.includes('check-availability')) return { action: 'check_slots', date: body.date };
  if (endpoint.includes('create-appointment')) return { action: 'book', client: body.client_name ? '***' : null, date: body.date };
  if (endpoint.includes('update-appointment')) return { action: 'reschedule' };
  if (endpoint.includes('cancel-appointment')) return { action: 'cancel' };
  if (endpoint.includes('lookup-customer')) return { action: 'search' };
  if (endpoint.includes('get-services')) return { action: 'fetch_services' };
  if (endpoint.includes('get-business-info')) return { action: 'fetch_info', section: body.section || 'all' };
  if (endpoint.includes('log-call-outcome')) return { action: 'log', outcome: body.outcome };
  if (endpoint.includes('transfer-call')) return { action: 'transfer' };
  return {};
}

module.exports = { createRouteTracker };
