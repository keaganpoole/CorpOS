const fs = require('fs');
const code = fs.readFileSync('backend/routes/tools.js', 'utf8');
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('phone=eq') || lines[i].includes('normalized')) {
    console.log((i+1) + ': ' + lines[i]);
  }
}
