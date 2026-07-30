const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, powerMonitor } = require('electron');
const path = require('path');
const agent = require('./main/agent');
const agentConfig = require('./main/agent-config');

const IS_CAT2 = process.env.MEOW_VARIANT === 'cat2' || process.argv.includes('--cat2');

if (IS_CAT2) {
  app.setName('AI Meow 2');
  app.setPath('userData', path.join(app.getPath('appData'), 'ai-meow-cat2'));
}

let catWindow = null;
let tray = null;

function toSafeInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function moveCatWindow(deltaX, deltaY) {
  if (!catWindow) return;
  const dx = toSafeInt(deltaX, 0);
  const dy = toSafeInt(deltaY, 0);
  if (dx === 0 && dy === 0) return;

  const [x, y] = catWindow.getPosition();
  const [width, height] = catWindow.getSize();
  const display = screen.getDisplayMatching(catWindow.getBounds());
  const area = display.workArea;
  const nextX = Math.min(Math.max(area.x, toSafeInt(x, 0) + dx), area.x + area.width - width);
  const nextY = Math.min(Math.max(area.y, toSafeInt(y, 0) + dy), area.y + area.height - height);
  catWindow.setPosition(nextX, nextY);
}

function getCatWindowPlacement() {
  if (!catWindow) return null;
  const [x, y] = catWindow.getPosition();
  const [width, height] = catWindow.getSize();
  const display = screen.getDisplayMatching(catWindow.getBounds());
  const area = display.workArea;
  const edgeMargin = 28;
  return {
    x,
    y,
    width,
    height,
    workArea: { x: area.x, y: area.y, width: area.width, height: area.height },
    nearLeft: x <= area.x + edgeMargin,
    nearRight: x + width >= area.x + area.width - edgeMargin,
  };
}

// ── Continuous work tracker (global mouse/keyboard via system idle time) ──
const WORK_TRACK_POLL_MS = 15000;
const WORK_LIMIT_MS = 2 * 60 * 60 * 1000; // 2 hours
const ACTIVE_IDLE_MAX_SEC = 90;  // idle < 90s = still working
const RESET_IDLE_SEC = 300;      // 5 min idle = reset streak
const DEFAULT_BREAK_COOLDOWN_MS = 30 * 60 * 1000;

let activeWorkMs = 0;
let lastBreakAlertAt = 0;
let breakCooldownMs = DEFAULT_BREAK_COOLDOWN_MS;
let snoozeUntil = 0;
let fullscreenHint = false;
let workTrackerInterval = null;
let batteryPollInterval = null;

function resetWorkStreak() {
  activeWorkMs = 0;
  lastBreakAlertAt = 0;
}

function nudgeCatWindow() {
  if (!catWindow) return;
  const [x, y] = catWindow.getPosition();
  const offsets = [0, -10, 0, -7, 0, -4, 0];
  offsets.forEach((dy, i) => {
    setTimeout(() => catWindow.setPosition(x, y + dy), i * 120);
  });
}

function sendBreakReminder() {
  if (!catWindow) return;
  if (Date.now() < snoozeUntil) return;

  catWindow.show();
  catWindow.moveTop();
  if (process.platform !== 'darwin') catWindow.flashFrame(true);

  const hours = Math.floor(activeWorkMs / 3600000);
  const minutes = Math.floor((activeWorkMs % 3600000) / 60000);

  catWindow.webContents.send('break-reminder', {
    hours,
    minutes,
    activeMs: activeWorkMs,
    gentle: fullscreenHint,
  });
  nudgeCatWindow();
  lastBreakAlertAt = Date.now();
}

function pushBatteryStatus() {
  if (!catWindow) return;
  let onBattery = false;
  try {
    if (typeof powerMonitor.isOnBatteryPower === 'function') {
      onBattery = powerMonitor.isOnBatteryPower();
    } else if (typeof powerMonitor.getSystemIdleState === 'function') {
      // older fallback: treat unknown as not on battery
      onBattery = false;
    }
  } catch (_) {
    onBattery = false;
  }
  catWindow.webContents.send('battery-saver-changed', onBattery);
}

function startWorkTracker() {
  if (workTrackerInterval) return;

  workTrackerInterval = setInterval(() => {
    if (!catWindow) return;

    const idleSec = powerMonitor.getSystemIdleTime();

    if (idleSec >= RESET_IDLE_SEC) {
      resetWorkStreak();
      return;
    }

    if (idleSec < ACTIVE_IDLE_MAX_SEC) {
      activeWorkMs += WORK_TRACK_POLL_MS;
    }

    if (activeWorkMs >= WORK_LIMIT_MS) {
      if (Date.now() < snoozeUntil) return;
      const sinceLastAlert = Date.now() - lastBreakAlertAt;
      if (lastBreakAlertAt === 0 || sinceLastAlert >= breakCooldownMs) {
        sendBreakReminder();
      }
    }
  }, WORK_TRACK_POLL_MS);

  powerMonitor.on('suspend', resetWorkStreak);
  powerMonitor.on('lock-screen', resetWorkStreak);
  powerMonitor.on('resume', resetWorkStreak);
  powerMonitor.on('unlock-screen', resetWorkStreak);

  if (!batteryPollInterval) {
    pushBatteryStatus();
    batteryPollInterval = setInterval(pushBatteryStatus, 60000);
    try {
      powerMonitor.on('on-ac', () => {
        if (catWindow) catWindow.webContents.send('battery-saver-changed', false);
      });
      powerMonitor.on('on-battery', () => {
        if (catWindow) catWindow.webContents.send('battery-saver-changed', true);
      });
    } catch (_) { /* older Electron */ }
  }
}

// Only one instance per variant — Cat 1 and Cat 2 can run together
let gotSingleInstanceLock = true;
if (!IS_CAT2) {
  gotSingleInstanceLock = app.requestSingleInstanceLock();
  if (!gotSingleInstanceLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (catWindow) {
        catWindow.show();
        catWindow.focus();
      }
    });
  }
} else {
  app.on('second-instance', () => {
    if (catWindow) {
      catWindow.show();
      catWindow.focus();
    }
  });
}

function createTrayIcon() {
  const size = 18;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - 8.5;
      const dy = y - 9;
      if (dx * dx + dy * dy <= 49) {
        buf[i] = 255;
        buf[i + 1] = 120;
        buf[i + 2] = 160;
        buf[i + 3] = 255;
      }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function createCatWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const winHeight = IS_CAT2 ? 460 : 240;
  const bottomMargin = 20;

  catWindow = new BrowserWindow({
    width: 220,
    height: winHeight,
    x: width - 240,
    y: height - winHeight - bottomMargin,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    ...(process.platform === 'win32' && { thickFrame: false }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  catWindow.loadFile(path.join(__dirname, 'src', IS_CAT2 ? 'index-cat2.html' : 'index.html'));

  catWindow.webContents.on('did-finish-load', () => {
    pushBatteryStatus();
  });

  if (process.platform === 'darwin') {
    catWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  catWindow.on('closed', () => {
    catWindow = null;
  });
}

function toggleCatWindow() {
  if (!catWindow) return;
  if (catWindow.isVisible()) {
    catWindow.hide();
  } else {
    catWindow.show();
    catWindow.focus();
  }
}

function createTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  const appLabel = IS_CAT2 ? 'AI Meow 2' : 'AI Meow';
  tray.setToolTip(`${appLabel} — click to show/hide`);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: IS_CAT2 ? 'Show Meow 2' : 'Show Meow',
      click: () => {
        if (catWindow) {
          catWindow.show();
          catWindow.focus();
        }
      },
    },
    {
      label: IS_CAT2 ? 'Hide Meow 2' : 'Hide Meow',
      click: () => {
        if (catWindow) catWindow.hide();
      },
    },
    { type: 'separator' },
    {
      label: IS_CAT2 ? 'Quit AI Meow 2' : 'Quit AI Meow',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
  // Windows: left-click opens menu; macOS: left-click toggles visibility
  if (process.platform === 'win32') {
    tray.on('double-click', toggleCatWindow);
  } else {
    tray.on('click', toggleCatWindow);
  }
}

ipcMain.on('window-drag', (_event, payload = {}) => {
  moveCatWindow(payload.deltaX, payload.deltaY);
});

ipcMain.handle('window:get-placement', () => getCatWindowPlacement());

ipcMain.on('window-minimize', () => {
  if (catWindow) catWindow.hide();
});

ipcMain.on('app-quit', () => {
  app.quit();
});

ipcMain.on('window-resize', (_event, payload = {}) => {
  if (!catWindow) return;
  const width = toSafeInt(payload.width, 220);
  const height = toSafeInt(payload.height, 240);
  const anchorBottom = !!payload.anchorBottom;
  const [x, y] = catWindow.getPosition();
  const [, currentHeight] = catWindow.getSize();

  if (anchorBottom) {
    const bounds = catWindow.getBounds();
    const bottom = bounds.y + bounds.height;
    catWindow.setBounds({
      x: bounds.x,
      y: bottom - height,
      width,
      height,
    });
  } else {
    catWindow.setSize(width, height);
  }
});

ipcMain.on('break-dismissed', () => {
  if (catWindow) catWindow.flashFrame(false);
});

ipcMain.on('break-snoozed', (_event, { minutes }) => {
  const mins = [10, 30, 60].includes(minutes) ? minutes : 30;
  snoozeUntil = Date.now() + mins * 60 * 1000;
  lastBreakAlertAt = Date.now();
  if (catWindow) catWindow.flashFrame(false);
});

ipcMain.on('settings-updated', (_event, settings) => {
  if (settings && [10, 30, 60].includes(settings.snoozeDuration)) {
    breakCooldownMs = settings.snoozeDuration * 60 * 1000;
  }
});

ipcMain.on('fullscreen-hint', (_event, { isFullscreen }) => {
  fullscreenHint = !!isFullscreen;
});

// ── Agent IPC (async request/response) ──
ipcMain.handle('agent:chat', async (_event, { message, history }) => {
  try {
    return await agent.handleChat({ message, history });
  } catch (_) {
    return null;
  }
});

ipcMain.handle('agent:get-config', () => agentConfig.publicView());

ipcMain.handle('agent:set-config', (_event, partial) => agentConfig.save(partial || {}));

ipcMain.handle('agent:test-gemini', async () => agent.runHealthCheck());

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    if (process.platform === 'darwin' && app.dock) {
      app.dock.hide();
    }

    createCatWindow();
    createTray();
    startWorkTracker();

    agent.runHealthCheck().then((health) => {
      if (health) console.log('[Meow] Gemini health:', health.ok ? health.message : `${health.reason}: ${health.message}`);
    }).catch(() => {});

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createCatWindow();
      } else if (catWindow) {
        catWindow.show();
      }
    });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
