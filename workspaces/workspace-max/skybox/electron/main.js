const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

// --- Backend Controller ---
const { Controller } = require('./../backend/controller');

let controller = null;
const BACKEND_PORT = 7878;

async function startBackend() {
  controller = new Controller(BACKEND_PORT);
  try {
    await controller.start();
    console.log(`[Skybox] Backend ready on port ${BACKEND_PORT}`);
  } catch (err) {
    console.error('[Skybox] Backend failed to start:', err.message);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1700,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#050505',
      symbolColor: '#ffffff',
      height: 32,
    },
    backgroundColor: '#050505',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  win.once('ready-to-show', () => {
    win.show();
    win.webContents.openDevTools();
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open external links in browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// IPC handlers for control commands from renderer
ipcMain.handle('control:runtime', async (event, { mode }) => {
  if (!controller) return { error: 'Controller not running' };
  const result = controller.db.prepare('SELECT * FROM control_state WHERE id = 1').get();
  controller.events.emit({
    event_type: mode === 'paused' ? 'runtime_paused' : 'runtime_resumed',
    message: `Runtime ${mode} from Skybox`,
    actor: 'user',
    actor_type: 'user',
    source: 'skybox_ui',
  });
  return controller.db.prepare('SELECT * FROM control_state WHERE id = 1').get();
});

ipcMain.handle('control:stage', async (event, { stage }) => {
  if (!controller) return { error: 'Controller not running' };
  controller.events.emit({
    event_type: 'stage_changed',
    message: `Stage changed to ${stage}`,
    actor: 'user',
    actor_type: 'user',
    source: 'skybox_ui',
    payload: { stage },
  });
  return controller.db.prepare('SELECT * FROM control_state WHERE id = 1').get();
});

ipcMain.handle('control:zone', async (event, { zone }) => {
  if (!controller) return { error: 'Controller not running' };
  controller.events.emit({
    event_type: 'zone_changed',
    message: `Zone changed to ${zone}`,
    actor: 'user',
    actor_type: 'user',
    source: 'skybox_ui',
    payload: { zone },
  });
  return controller.db.prepare('SELECT * FROM control_state WHERE id = 1').get();
});

ipcMain.handle('control:set-model', async (_, { agentId, agentName, model }) => {
  if (!controller) return { error: 'Controller not running' };

  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);

  try {
    // Strip openrouter/ prefix since openclaw uses short model IDs internally
    const modelForOpenClaw = model.replace(/^openrouter\//i, '');
    await execAsync(`openclaw models set "${modelForOpenClaw}"`, { timeout: 15000 });

    // Update Skybox DB
    controller.db.prepare("UPDATE agents SET model = ?, updated_at = datetime('now') WHERE id = ?").run(model, agentId);

    return { success: true, model };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('control:ping-max', async () => {
  if (!controller) return { error: 'Controller not running' };

  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);

  const pending = controller.db.prepare(
    'SELECT * FROM pending_restarts ORDER BY created_at ASC LIMIT 10'
  ).all();

  if (pending.length === 0) {
    return { success: true, message: 'No pending restarts', restarted: [] };
  }

  const results = [];
  for (const item of pending) {
    try {
      // 1. Set the new model in openclaw.json (strip openrouter/ prefix)
      const modelForOpenClaw = item.new_model.replace(/^openrouter\//i, '');
      await execAsync(`openclaw models set "${modelForOpenClaw}"`, { timeout: 15000 });

      // 2. Find Max's active Discord session
      const { stdout } = await execAsync('openclaw sessions', { timeout: 10000 });
      const lines = stdout.split('\n');
      let sessionKey = null;
      for (const line of lines) {
        if (line.includes('direct') && line.includes('discord') && line.includes('main')) {
          const match = line.match(/(direct|group)\s+(agent:[^\s]+)\s+/);
          if (match) { sessionKey = match[2]; break; }
        }
      }

      if (!sessionKey) {
        results.push({ agent: item.agent_name, model: item.new_model, error: 'No active Discord session found' });
        continue;
      }

      // 3. Restart the session with the new model
      await execAsync(`openclaw sessions restart "${sessionKey}"`, { timeout: 30000 });
      results.push({ agent: item.agent_name, model: item.new_model, restarted: true });

      // 4. Update Skybox DB to match
      controller.db.prepare("UPDATE agents SET model = ?, updated_at = datetime('now') WHERE id = ?").run(item.new_model, item.agent_id);

      // 5. Clear pending restart
      controller.db.prepare('DELETE FROM pending_restarts WHERE id = ?').run(item.id);
    } catch (err) {
      results.push({ agent: item.agent_name, model: item.new_model, error: err.message });
    }
  }

  return { success: true, restarted: results };
});

// App lifecycle
app.whenReady().then(async () => {
  await startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (controller) controller.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  if (controller) controller.stop();
});
