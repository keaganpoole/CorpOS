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
    width: 1440,
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

ipcMain.handle('control:ping-max', async () => {
  if (!controller) return { error: 'Controller not running' };
  controller.events.emit({
    event_type: 'ping_max_requested',
    message: 'Ping Max requested from Skybox UI',
    actor: 'user',
    actor_type: 'user',
    source: 'skybox_ui',
    severity: 'info',
  });
  return { success: true };
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
