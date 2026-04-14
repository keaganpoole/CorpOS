/**
 * CallEngine Test Runner
 *
 * Simulates calls with Kelly Lasota to validate the engine works
 * without any telephony infrastructure.
 *
 * Usage: node backend/call/test.js
 */

const { createClient } = require('@supabase/supabase-js');
const { CallEngine } = require('./CallEngine');
const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(__dirname, '..', '..', '.env');
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    env[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
  }
}

// Also load OpenRouter key from OpenClaw env
const ocEnvPath = path.join(require('os').homedir(), '.openclaw', '.env');
if (fs.existsSync(ocEnvPath)) {
  for (const line of fs.readFileSync(ocEnvPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!env[key]) env[key] = val;
  }
}

const TEST_PHONE = '+12076801233';
const SCENARIOS = [
  {
    name: 'Identify caller + greeting',
    messages: [
      'Hi, this is Kelly Lasota calling.',
    ],
  },
  {
    name: 'Ask about services',
    messages: [
      'Hi, I need help with my website. What do you guys do?',
    ],
  },
  {
    name: 'Book an appointment',
    messages: [
      'I\'d like to schedule a consultation for next Tuesday at 2 PM.',
    ],
  },
  {
    name: 'Check existing appointment',
    messages: [
      'Hi, this is Kelly. Can you tell me when my next appointment is?',
    ],
  },
];

async function runTest() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  CallEngine Test Runner');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Init Supabase
  const supabase = createClient(
    env.VITE_SUPABASE_URL || env.SONAR_SUPABASE_URL,
    env.VITE_SUPABASE_ANON_KEY || env.SONAR_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
  );

  // Init engine
  const engine = new CallEngine({
    supabase,
    openRouterKey: env.OPENROUTER_API_KEY,
  });

  // Test 1: Basic greeting with known caller
  console.log('━━━ Test: Greeting Kelly ━━━\n');
  await engine.startCall(TEST_PHONE);
  console.log(`  Caller found: ${engine.sessions.get(TEST_PHONE)?.state?.caller_name || 'NOT FOUND'}`);
  console.log(`  Caller ID: ${engine.sessions.get(TEST_PHONE)?.state?.caller_id || 'NONE'}\n`);

  // Test 2: Single conversation
  console.log('━━━ Test: Conversation ━━━\n');
  const result = await engine.processMessage(TEST_PHONE, 'Hi, this is Kelly. I\'d like to book a consultation for next Tuesday at 2 PM.');
  console.log(`  Response: ${result.response}`);
  console.log(`  Actions: ${result.actions.length > 0 ? result.actions.map(a => a.type + (a.success ? ' ✓' : ' ✗')).join(', ') : 'none'}`);
  if (result.state.detected_intent) console.log(`  Intent: ${result.state.detected_intent}`);

  // Show action details
  for (const action of result.actions) {
    if (action.success && action.data) {
      console.log(`  Action result:`, JSON.stringify(action.data, null, 2).substring(0, 200));
    }
    if (!action.success) {
      console.log(`  Action failed:`, action.data);
    }
  }

  console.log('\n');

  // Test 3: Check availability
  console.log('━━━ Test: Check Availability ━━━\n');
  const availResult = await engine.processMessage(TEST_PHONE, 'Actually, is Thursday afternoon available instead?');
  console.log(`  Response: ${availResult.response}`);
  console.log(`  Actions: ${availResult.actions.length > 0 ? availResult.actions.map(a => a.type + (a.success ? ' ✓' : ' ✗')).join(', ') : 'none'}`);

  console.log('\n');

  // Test 4: End call
  console.log('━━━ Test: End Call ━━━\n');
  const endResult = await engine.processMessage(TEST_PHONE, 'Thanks, that\'s all I needed. Bye!');
  console.log(`  Response: ${endResult.response}`);

  await engine.endCall(TEST_PHONE);
  console.log(`  Call ended. Session cleaned up.`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Tests complete');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

runTest().catch(err => {
  console.error('Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
