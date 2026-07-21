const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('meowAPI', {
  dragWindow: (deltaX, deltaY) => ipcRenderer.send('window-drag', { deltaX, deltaY }),
  hideWindow: () => ipcRenderer.send('window-minimize'),
  quitApp: () => ipcRenderer.send('app-quit'),
  resizeWindow: (width, height, anchorBottom = false) =>
    ipcRenderer.send('window-resize', { width, height, anchorBottom }),
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
});
