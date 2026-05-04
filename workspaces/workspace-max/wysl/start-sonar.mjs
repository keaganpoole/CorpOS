import('file:///C:/Users/vboxuser/.openclaw/workspaces/workspace-max/sonar/backend/controller.js').then(({ Controller }) => {
  const c = new Controller(7878);
  c.start().catch(err => { console.error('Failed:', err.message); process.exit(1); });
}).catch(err => { console.error('Import failed:', err.message); process.exit(1); });
