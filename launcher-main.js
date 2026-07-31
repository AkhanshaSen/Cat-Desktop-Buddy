/**
 * Packaged-app entry: pick Cat 1 (SVG) or Cat 2 (video) before starting the buddy.
 * Dev still uses main.js via package.json "main" — unchanged.
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const VARIANT_ARGS = ['--cat1', '--cat2'];
const isMac = process.platform === 'darwin';

function startBuddy() {
  require('./main.js');
}

const pickedVariant = process.argv.find((arg) => VARIANT_ARGS.includes(arg));

if (pickedVariant) {
  startBuddy();
} else if (app.isPackaged || process.argv.includes('--show-launcher')) {
  let launcherWindow = null;

  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (launcherWindow) {
        launcherWindow.show();
        launcherWindow.focus();
      }
    });
  }

  function createLauncherWindow() {
    launcherWindow = new BrowserWindow({
      width: 420,
      height: 460,
      resizable: false,
      minimizable: true,
      maximizable: false,
      fullscreenable: false,
      frame: !isMac,
      transparent: false,
      hasShadow: true,
      title: 'AI Meow',
      backgroundColor: '#fdf6f9',
      ...(isMac && {
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 16, y: 18 },
        vibrancy: 'window',
        visualEffectState: 'active',
      }),
      webPreferences: {
        preload: path.join(__dirname, 'preload-launcher.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    launcherWindow.loadFile(path.join(__dirname, 'src', 'launcher.html'));
    launcherWindow.setMenuBarVisibility(false);
    launcherWindow.center();

    launcherWindow.on('closed', () => {
      launcherWindow = null;
    });
  }

  ipcMain.on('launcher:pick', (_event, payload = {}) => {
    const variant = payload.variant === 'cat2' ? 'cat2' : 'cat1';
    const arg = variant === 'cat2' ? '--cat2' : '--cat1';
    app.relaunch({ args: process.argv.slice(1).concat([arg]) });
    app.exit(0);
  });

  ipcMain.on('launcher:quit', () => {
    app.quit();
  });

  if (gotLock) {
    app.whenReady().then(createLauncherWindow);

    app.on('window-all-closed', () => {
      app.quit();
    });
  }
} else {
  startBuddy();
}
