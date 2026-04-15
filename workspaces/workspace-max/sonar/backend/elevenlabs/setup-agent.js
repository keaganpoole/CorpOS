/**
 * ElevenLabs Agent Setup
 * 
 * Creates server tools + agent on ElevenLabs ConvAI platform.
 * Format discovered via API testing — uses snake_case for raw API.
 * 
 * Usage: node backend/elevenlabs/setup-agent.js
 * 
 * NOTE: For server tools to work, Sonar API must be publicly accessible.
 * For local dev: ngrok http 7878 → set SONAR_WEBHOOK_URL in .env
 */

// Load .env: try global first, then project root
const path = require('path');
const fs = require('fs');
for (const envPath of [
  path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw/.env'),
  path.join(__dirname, '../../.env'),
]) {
  try {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...val] = trimmed.split('=');
        if (!process.env[key.trim()]) process.env[key.trim()] = val.join('=').trim();
      }
    });
  } catch (_) { /* file not found */ }
}

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const WEBHOOK_BASE_URL = process.env.SONAR_WEBHOOK_URL || 'http://localhost:7878';

if (!ELEVENLABS_API_KEY) {
  console.error('ERROR: ELEVENLABS_API_KEY not set');
  process.exit(1);
}

const EL = 'https://api.elevenlabs.io/v1';

// ─── Server Tool Definitions ────────────────────────────────
const TOOLS = [
  {
    name: 'identify_caller',
    description: 'Look up a caller by their phone number. Returns their customer record, contact info, and recent appointment history. ALWAYS call this first when a call comes in.',
    method: 'POST',
    parameters: {
      phone: { type: 'string', description: 'The caller\'s phone number in any format' },
    },
    required: ['phone'],
  },
  {
    name: 'check_availability',
    description: 'Check what appointment time slots are available on a specific date. Use when a caller wants to book.',
    method: 'POST',
    parameters: {
      date: { type: 'string', description: 'Date to check in YYYY-MM-DD format' },
      duration: { type: 'number', description: 'Appointment duration in minutes (default 30)' },
    },
    required: ['date'],
  },
  {
    name: 'create_appointment',
    description: 'Book a new appointment. Confirm ALL details with the caller first (name, date, time). Then call this to create it.',
    method: 'POST',
    parameters: {
      client_name: { type: 'string', description: 'Full name of the client' },
      phone: { type: 'string', description: 'Client phone number' },
      date: { type: 'string', description: 'Appointment date in YYYY-MM-DD' },
      time: { type: 'string', description: 'Appointment time in HH:MM (24-hour)' },
      duration: { type: 'number', description: 'Duration in minutes (default 30)' },
      notes: { type: 'string', description: 'Special notes or reason' },
    },
    required: ['client_name', 'date', 'time'],
  },
  {
    name: 'update_appointment',
    description: 'Reschedule an existing appointment to a new date/time. Requires the appointment ID.',
    method: 'POST',
    parameters: {
      appointment_id: { type: 'string', description: 'UUID of the appointment to reschedule' },
      new_date: { type: 'string', description: 'New date in YYYY-MM-DD' },
      new_time: { type: 'string', description: 'New time in HH:MM' },
      reason: { type: 'string', description: 'Reason for the change' },
    },
    required: ['appointment_id'],
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel an existing appointment. Requires the appointment ID.',
    method: 'POST',
    parameters: {
      appointment_id: { type: 'string', description: 'UUID of the appointment to cancel' },
      reason: { type: 'string', description: 'Reason for cancellation' },
    },
    required: ['appointment_id'],
  },
  {
    name: 'lookup_customer',
    description: 'Search for a customer by name, email, or phone. Use when you need to find a customer record.',
    method: 'POST',
    parameters: {
      name: { type: 'string', description: 'Customer name (first, last, or partial)' },
      email: { type: 'string', description: 'Customer email' },
      phone: { type: 'string', description: 'Customer phone number' },
    },
    required: [],
  },
  {
    name: 'get_services',
    description: 'Get all services the business offers including pricing. Use when a caller asks about services or pricing.',
    method: 'GET',
    parameters: {},
    required: [],
  },
  {
    name: 'get_business_info',
    description: 'Get business information: hours, policies, FAQ, about-us. Use for general business questions.',
    method: 'POST',
    parameters: {
      section: { type: 'string', description: 'Which section: about, services, policies, faq (or empty for all)' },
    },
    required: [],
  },
  {
    name: 'log_call_outcome',
    description: 'Log the result of this call. ALWAYS call this at the end of every conversation to record what happened.',
    method: 'POST',
    parameters: {
      outcome: { type: 'string', description: 'Result: booked, modified, cancelled, info_only, transferred, no_answer, missed' },
      notes: { type: 'string', description: 'Brief call notes' },
      duration_seconds: { type: 'number', description: 'Call duration in seconds' },
      appointment_id: { type: 'string', description: 'UUID of appointment created/modified' },
    },
    required: ['outcome'],
  },
  {
    name: 'transfer_call',
    description: 'Transfer the caller to a human. Use when they ask for a person or you cannot handle their request.',
    method: 'POST',
    parameters: {
      reason: { type: 'string', description: 'Why the transfer is needed' },
    },
    required: [],
  },
];

// ─── Build tool config in the correct API format ────────────
function buildToolConfig(toolDef) {
  const url = `${WEBHOOK_BASE_URL}/api/tools/${toolDef.name.replace(/_/g, '-')}`;
  
  const config = {
    type: 'webhook',
    name: toolDef.name,
    description: toolDef.description,
    api_schema: {
      url,
      method: toolDef.method,
    },
  };

  // Only POST methods can have request_body_schema
  if (toolDef.method === 'POST' && Object.keys(toolDef.parameters).length > 0) {
    config.api_schema.request_body_schema = {
      type: 'object',
      properties: toolDef.parameters,
      required: toolDef.required || [],
    };
  }

  return config;
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
  console.log('=== ElevenLabs ConvAI Agent Setup ===\n');
  console.log('Webhook URL:', WEBHOOK_BASE_URL);

  // Step 1: Clean up test tools
  console.log('\nCleaning up test tools...');
  const existingTools = await fetch(`${EL}/convai/tools`, {
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
  }).then(r => r.json()).then(d => Array.isArray(d.tools) ? d.tools : []);
  
  for (const tool of existingTools) {
    if (tool && tool.name && tool.name.startsWith('test_')) {
      const tid = tool.id || tool.tool_id;
      await fetch(`${EL}/convai/tools/${tid}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': ELEVENLABS_API_KEY },
      });
      console.log(`  Deleted test tool: ${tool.name}`);
    }
  }

  // Step 2: Create all tools
  console.log('\nCreating server tools...');
  const toolIds = [];

  for (const toolDef of TOOLS) {
    try {
      const body = { tool_config: buildToolConfig(toolDef) };
      const res = await fetch(`${EL}/convai/tools`, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        console.log(`  ❌ ${toolDef.name} [${res.status}]: ${err.substring(0, 150)}`);
        continue;
      }

      const result = await res.json();
      const toolId = result.id || result.tool_id;
      toolIds.push({ id: toolId, name: toolDef.name });
      console.log(`  ✅ ${toolDef.name} → ${toolId}`);
    } catch (e) {
      console.log(`  ❌ ${toolDef.name}: ${e.message}`);
    }
  }

  // Step 3: Check for existing agent
  console.log('\nChecking existing agents...');
  const agentsList = await fetch(`${EL}/convai/agents`, {
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
  }).then(r => r.json());

  const agentsArr = Array.isArray(agentsList.agents) ? agentsList.agents : Array.isArray(agentsList) ? agentsList : [];
  const existing = agentsArr.find(a => a && a.name === 'Sonar Receptionist');
  
  // Step 4: Create agent
  const systemPrompt = `You are a professional, warm, and efficient AI receptionist.

Your job is to help callers with:
- Scheduling, rescheduling, and canceling appointments
- Looking up customer information
- Answering questions about services and pricing
- Providing business information (hours, policies, FAQ)
- Transferring to a human when needed

WORKFLOW:
1. When a call starts, IMMEDIATELY use "identify_caller" with the caller's phone number
2. Greet the caller by name based on what identify_caller returns
3. Help them with their request
4. For appointments: check availability first, confirm ALL details, then book
5. At the end of EVERY call, use "log_call_outcome" to log what happened

RULES:
- Never make up information — always use your tools for real data
- Confirm appointment details before booking (name, date, time, duration)
- If you can't help, offer to transfer to a human
- Be warm, professional, and efficient
- Don't over-talk — be concise and natural`;

  const agentBody = {
    name: 'Sonar Receptionist',
    conversation_config: {
      agent: {
        prompt: {
          prompt: systemPrompt,
          llm: 'gpt-4o-mini',
          tool_ids: toolIds.map(t => t.id),
        },
        max_duration_seconds: 300,
      },
      language: 'en',
    },
  };

  let agentId;

  if (existing) {
    console.log(`\nUpdating existing agent ${existing.agent_id}...`);
    const res = await fetch(`${EL}/convai/agents/${existing.agent_id}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentBody),
    });
    
    if (res.ok) {
      const result = await res.json();
      agentId = result.agent_id;
      console.log('✅ Agent updated!');
    } else {
      const err = await res.text();
      console.log(`Update failed [${res.status}]:`, err.substring(0, 200));
    }
  } else {
    console.log('\nCreating new agent...');
    const res = await fetch(`${EL}/convai/agents/create`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentBody),
    });
    
    if (res.ok) {
      const result = await res.json();
      agentId = result.agent_id;
      console.log('✅ Agent created!');
    } else {
      const err = await res.text();
      console.log(`Create failed [${res.status}]:`, err.substring(0, 200));
    }
  }

  // Summary
  console.log('\n══════════════════════════════════════');
  console.log('Agent ID:', agentId || 'FAILED');
  console.log('Tools created:', toolIds.length, '/', TOOLS.length);
  console.log('Webhook URL:', WEBHOOK_BASE_URL);
  console.log('══════════════════════════════════════');
  
  if (toolIds.length > 0) {
    console.log('\nServer Tools:');
    for (const t of toolIds) {
      console.log(`  ${t.name}`);
    }
  }

  console.log('\nNext steps:');
  console.log('1. For local dev: run ngrok http 7878');
  console.log('2. Set SONAR_WEBHOOK_URL to the public URL');
  console.log('3. Re-run this script to update webhook URLs');
  console.log('4. Test in ElevenLabs dashboard → Agents → Talk to Agent');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
