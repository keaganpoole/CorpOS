const fs = require('fs');
const envFile = fs.readFileSync('C:/Users/vboxuser/.openclaw/.env', 'utf8');
for (const line of envFile.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i > 0) process.env[t.substring(0, i).trim()] = t.substring(i + 1).trim().replace(/^["']/, '').replace(/["']$/, '');
}

async function run() {
  // List all tools for this agent
  const res = await fetch('https://api.elevenlabs.io/v1/convai/tools?page_size=100', {
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
  });
  const data = await res.json();
  console.log('Tools response type:', typeof data);
  console.log('Keys:', Object.keys(data));
  if (data.tools) {
    console.log('Total tools:', data.tools.length);
    for (const tool of data.tools) {
      console.log(`  ${tool.name || 'unnamed'} (id: ${tool.tool_id || tool.id}) - assignments: ${JSON.stringify(tool.assignments || [])}`);
    }
  }
  console.log(JSON.stringify(data).substring(0, 1000));
}

run().catch(console.error);
