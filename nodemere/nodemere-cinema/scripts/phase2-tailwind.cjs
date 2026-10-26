const fs = require('fs');
const path = require('path');
const postcss = require('../../node_modules/postcss');
const tailwind = require('../../node_modules/tailwindcss');
const root = path.resolve(__dirname,'..');
postcss([tailwind({
  content:[path.join(root,'src/CalendarScene.tsx'),path.join(root,'src/product/AppointmentRecord.jsx'),path.join(root,'src/product/DropInStrip.jsx')],
  important:'.phase2-calendar', corePlugins:{preflight:false}, theme:{extend:{}}, plugins:[],
})]).process('@tailwind base;\n@tailwind utilities;',{from:undefined}).then(result=>{
  // Tailwind's variable defaults are required for gradients and ring/shadow math.
  // Keep those defaults scoped so the approved opening is unaffected.
  result.root.walkRules(rule=>{
    if (rule.selector==='*, ::before, ::after') rule.selector='.phase2-calendar *, .phase2-calendar ::before, .phase2-calendar ::after';
    if (rule.selector==='::backdrop') rule.selector='.phase2-calendar ::backdrop';
  });
  fs.writeFileSync(path.join(root,'src/product/calendar-utilities.css'),result.root.toString());
  console.log('Compiled original Calendar utility styles in an isolated namespace.');
});
