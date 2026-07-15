const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('meowAPI', {
  dragWindow: (deltaX, deltaY) => ipcRenderer.send('window-drag', { deltaX, deltaY }),
  hideWindow: () => ipcRenderer.send('window-minimize'),
  quitApp: () => ipcRenderer.send('app-quit'),
  resizeWindow: (width, height, anchorBottom = false) =>
    ipcRenderer.send('window-resize', { width, height, anchorBottom }),
  dismissBreakReminder: () => ipcRenderer.send('break-dismissed'),
  onBreakReminder: (callback) => {
    ipcRenderer.on('break-reminder', (_event, data) => callback(data));
  },
});
