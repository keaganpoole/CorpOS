const fs = require('fs');
const os = require('os');
const path = require('path');

const envPath = path.join(os.homedir(), '.openclaw', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
let found = null;
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  const k = t.substring(0, eq).trim();
  if (k === 'OPENROUTER_API_KEY') {
    found = t.substring(eq + 1).trim().replace(/^["']|["']$/g, '');
    break;
  }
}
console.log('OPENROUTER_API_KEY:', found ? found.substring(0, 10) + '...' : 'NOT FOUND');
