const { contextBridge, ipcRenderer } = require('electron');

const BACKEND_PORT = 7878;
const API_BASE = `http://127.0.0.1:${BACKEND_PORT}`;
const WS_URL = `ws://127.0.0.1:${BACKEND_PORT}`;

contextBridge.exposeInMainWorld('skybox', {
  platform: process.platform,

  // Backend URLs
  apiUrl: API_BASE,
  wsUrl: WS_URL,

  // Control commands via IPC (goes through Electron main → controller)
  control: {
    setRuntime: (mode) => ipcRenderer.invoke('control:runtime', { mode }),
    setStage: (stage) => ipcRenderer.invoke('control:stage', { stage }),
    setZone: (zone) => ipcRenderer.invoke('control:zone', { zone }),
    pingMax: () => ipcRenderer.invoke('control:ping-max'),
  },
});
