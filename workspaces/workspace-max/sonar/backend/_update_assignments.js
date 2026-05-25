const fs = require('fs');
const os = require('os');
const path = require('path');
const envPath = path.join(os.homedir(), '.openclaw', '.env');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
for (const line of lines) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i > 0) {
    const k = t.substring(0, i).trim();
    const v = t.substring(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}

const EL_API_KEY = process.env.ELEVENLABS_API_KEY;
const AGENT_ID = 'agent_6101kp755r1aeg3vj6n3emg1ggft';

async function run() {
  // Fetch current agent config
  const res = await fetch('https://api.elevenlabs.io/v1/convai/agents/' + AGENT_ID, {
    headers: { 'xi-api-key': EL_API_KEY }
  });
  const data = await res.json();
  console.log('Fetched agent config');

  // Find and update create_customer tool with assignments
  const tools = [];
  const str = JSON.stringify(data);

  // The full agent object needs to be updated
  // We need to find the create_customer tool and add assignments
  // Also need to add customer_id assignment to identify_caller

  // Get the full agent config structure
  const agentData = data;

  // Navigate to find tools
  // The tools are nested in the agent config somewhere
  // Let's search for the create_customer webhook tool

  // Actually, let's just patch the whole config via PUT
  // First, let me understand the structure

  // Find all tools in the config
  const configStr = JSON.stringify(data, null, 2);

  // Find create_customer tool block
  const ccIdx = configStr.indexOf('"create_customer"');
  if (ccIdx === -1) {
    console.log('create_customer not found by name search');

    // Try searching for the tool by being in the webhook url list
    const ngrokIdx = configStr.indexOf('create-customer');
    if (ngrokIdx > -1) {
      // Find the start of this tool object (go back to find "type": "webhook")
      const before = configStr.substring(Math.max(0, ngrokIdx - 2000), ngrokIdx);
      const toolStart = before.lastIndexOf('{"type": "webhook"');
      if (toolStart === -1) {
        // Try without spaces
        const altStart = before.lastIndexOf('{"type":"webhook"');
        console.log('Alt tool start:', altStart);
      }
      console.log('Found create-customer URL at index', ngrokIdx);
    }
  }

  // Let me try a different approach: find all webhook tools and their names
  const toolsFound = [];
  let searchFrom = 0;
  while (true) {
    const webhookIdx = configStr.indexOf('"type": "webhook"', searchFrom);
    const webhookIdx2 = configStr.indexOf('"type":"webhook"', searchFrom);
    const idx = webhookIdx >= 0 ? webhookIdx : webhookIdx2;
    if (idx === -1) break;

    // Find the nearest "name" field before or after
    const chunk = configStr.substring(idx, idx + 3000);
    const nameMatch = chunk.match(/"name"\s*:\s*"([^"]+)"/);
    if (nameMatch) {
      // Find assignments in this chunk
      const assignIdx = chunk.indexOf('"assignments"');
      let assignments = 'empty';
      if (assignIdx > -1) {
        const assignEnd = chunk.indexOf(']', assignIdx);
        assignments = chunk.substring(assignIdx, assignEnd + 1);
      }
      toolsFound.push({ name: nameMatch[1], assignments: assignments.substring(0, 80) });
    }
    searchFrom = idx + 1;
  }

  console.log('\nTools found:');
  for (const t of toolsFound) {
    console.log(`  ${t.name}: ${t.assignments}`);
  }

  // Now let's update the agent config
  // We need to use the PATCH endpoint
  // First, let's see what the update endpoint expects

  // Build the patch with updated assignments for create_customer
  const patchBody = {
    agent: {
      conversation_config: {
        agent: {
          tools: data.agent?.conversation_config?.agent?.tools || []
        }
      }
    }
  };

  // But we don't know the exact structure. Let me try to find it differently.
  // The tools are stored in the webhook tool definitions
  // Let me find the create_customer tool and check its current assignments

  console.log('\n--- Looking for create_customer tool structure ---');
  const createCustomerIdx = configStr.indexOf('create-customer');
  if (createCustomerIdx > -1) {
    // Go back to find the start of this tool object
    let braceCount = 0;
    let toolStart = createCustomerIdx;
    for (let i = createCustomerIdx; i >= 0; i--) {
      if (configStr[i] === '}') braceCount++;
      if (configStr[i] === '{') {
        braceCount--;
        if (braceCount < 0) {
          toolStart = i;
          break;
        }
      }
    }
    // Find the end of this tool object
    braceCount = 0;
    let toolEnd = toolStart;
    for (let i = toolStart; i < configStr.length; i++) {
      if (configStr[i] === '{') braceCount++;
      if (configStr[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          toolEnd = i + 1;
          break;
        }
      }
    }
    const toolObj = configStr.substring(toolStart, toolEnd);
    console.log('create_customer tool length:', toolObj.length);
    try {
      const parsed = JSON.parse(toolObj);
      console.log('Current assignments:', JSON.stringify(parsed.assignments));
      console.log('Has assignments:', parsed.assignments ? 'YES' : 'NO');

      // Update with correct assignments
      parsed.assignments = [
        { dynamic_variable: 'customer_name', value_path: 'response.customer.name' },
        { dynamic_variable: 'customer_id', value_path: 'response.customer.id' },
        { dynamic_variable: 'customer_phone', value_path: 'response.customer.phone' }
      ];

      // Rebuild the config with the updated tool
      const newToolStr = JSON.stringify(parsed);
      const newConfigStr = configStr.substring(0, toolStart) + newToolStr + configStr.substring(toolEnd);

      // Now PATCH the agent
      const patchRes = await fetch('https://api.elevenlabs.io/v1/convai/agents/' + AGENT_ID, {
        method: 'PATCH',
        headers: {
          'xi-api-key': EL_API_KEY,
          'Content-Type': 'application/json'
        },
        body: newConfigStr
      });

      console.log('PATCH status:', patchRes.status);
      const patchResult = await patchRes.text();
      console.log('PATCH result:', patchResult.substring(0, 200));
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  }
}

run().catch(console.error);
