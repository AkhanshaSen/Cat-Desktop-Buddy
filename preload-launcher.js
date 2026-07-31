const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcherAPI', {
  pickBuddy: (variant) => {
    ipcRenderer.send('launcher:pick', { variant });
  },
  quit: () => ipcRenderer.send('launcher:quit'),
});
