const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('meowAPI', {
  getWindowPlacement: () => ipcRenderer.invoke('window:get-placement'),
  dragWindow: (deltaX, deltaY) => {
    const dx = Math.round(Number(deltaX) || 0);
    const dy = Math.round(Number(deltaY) || 0);
    if (dx === 0 && dy === 0) return;
    ipcRenderer.send('window-drag', { deltaX: dx, deltaY: dy });
  },
  dragBegin: () => ipcRenderer.send('window-drag-begin'),
  dragEnd: () => ipcRenderer.send('window-drag-end'),
  hideWindow: () => ipcRenderer.send('window-minimize'),
  quitApp: () => ipcRenderer.send('app-quit'),
  resizeWindow: (width, height, anchorBottom = false) =>
    ipcRenderer.send('window-resize', {
      width: Math.round(Number(width) || 220),
      height: Math.round(Number(height) || 240),
      anchorBottom: !!anchorBottom,
    }),
  dismissBreakReminder: () => ipcRenderer.send('break-dismissed'),
  snoozeBreakReminder: (minutes) => ipcRenderer.send('break-snoozed', { minutes }),
  updateSettings: (settings) => ipcRenderer.send('settings-updated', settings),
  setFullscreenHint: (isFullscreen) => ipcRenderer.send('fullscreen-hint', { isFullscreen }),
  onBreakReminder: (callback) => {
    ipcRenderer.on('break-reminder', (_event, data) => callback(data));
  },
  onBatterySaver: (callback) => {
    ipcRenderer.on('battery-saver-changed', (_event, onBattery) => callback(onBattery));
  },
  agentChat: (message, history) => ipcRenderer.invoke('agent:chat', { message, history }),
  getAgentConfig: () => ipcRenderer.invoke('agent:get-config'),
  setAgentConfig: (config) => ipcRenderer.invoke('agent:set-config', config),
  testGemini: () => ipcRenderer.invoke('agent:test-gemini'),
});
