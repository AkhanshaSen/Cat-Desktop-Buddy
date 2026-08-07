/**
 * Safe OS action executor for the Meow agent.
 *
 * Only allowlisted apps can be opened — the agent (and LLM) can never run
 * arbitrary shell commands. Each action resolves a platform-specific launcher
 * and returns { ok, message } so the cat can paraphrase the result.
 */
const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const { shell } = require('electron');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

const DOWNLOADS_FOLDER = path.join(os.homedir(), 'Downloads');

// Allowlist of apps Meow can open/close. macOS uses `open -a` to launch and
// `osascript ... quit` to close; Windows uses `start` (via cmd) or a
// protocol/URI to launch and `taskkill /IM <proc>` to close. `label` is the
// friendly name Meow speaks.
const APP_REGISTRY = {
  notepad: { label: 'a notepad', mac: { app: 'TextEdit' }, win: { cmd: 'notepad', proc: 'notepad.exe' } },
  notes: { label: 'Notes', mac: { app: 'Notes' }, win: { cmd: 'notepad', proc: 'notepad.exe' } },
  camera: { label: 'the camera', mac: { app: 'Photo Booth' }, win: { uri: 'microsoft.windows.camera:', proc: 'WindowsCamera.exe' } },
  calculator: { label: 'the calculator', mac: { app: 'Calculator' }, win: { cmd: 'calc', proc: 'CalculatorApp.exe' } },
  terminal: { label: 'the terminal', mac: { app: 'Terminal' }, win: { cmd: 'cmd', proc: 'cmd.exe' } },
  finder: { label: 'the file browser', mac: { app: 'Finder' }, win: { cmd: 'explorer', proc: 'explorer.exe' } },
  downloads: { label: 'your Downloads folder', mac: { folder: DOWNLOADS_FOLDER }, win: { folder: DOWNLOADS_FOLDER } },
  photos: { label: 'Photos', mac: { app: 'Photos' }, win: { uri: 'ms-photos:', proc: 'Microsoft.Photos.exe' } },
  calendar: { label: 'the calendar', mac: { app: 'Calendar' }, win: { uri: 'outlookcal:' } },
  mail: { label: 'Mail', mac: { app: 'Mail' }, win: { uri: 'outlookmail:' } },
  contacts: { label: 'Contacts', mac: { app: 'Contacts' }, win: { uri: 'ms-people:' } },
  reminders: { label: 'Reminders', mac: { app: 'Reminders' }, win: { uri: 'ms-todo:' } },
  clock: { label: 'the clock', mac: { app: 'Clock' }, win: { uri: 'ms-clock:', proc: 'Time.exe' } },
  weather: { label: 'Weather', mac: { app: 'Weather' }, win: { uri: 'ms-weather:', proc: 'WeatherApp.exe' } },
  maps: { label: 'Maps', mac: { app: 'Maps' }, win: { uri: 'bingmaps:', proc: 'Maps.exe' } },
  settings: { label: 'system settings', mac: { app: 'System Settings' }, win: { uri: 'ms-settings:', proc: 'SystemSettings.exe' } },
  music: { label: 'Music', mac: { app: 'Music' }, win: { uri: 'mswindowsmusic:', proc: 'Microsoft.Media.Player.exe' } },
  voice_memos: { label: 'Voice Memos', mac: { app: 'VoiceMemos' }, win: { uri: 'ms-callrecording:', proc: 'SoundRecorder.exe' } },
  screenshot: { label: 'the screenshot tool', mac: { app: 'Screenshot' }, win: { uri: 'ms-screenclip:', proc: 'SnippingTool.exe' } },
  sticky_notes: { label: 'Sticky Notes', mac: { app: 'Stickies' }, win: { uri: 'ms-sticky-notes:', proc: 'Microsoft.Notes.exe' } },
  paint: { label: 'a paint app', mac: { app: 'Preview' }, win: { cmd: 'mspaint', proc: 'mspaint.exe' } },
  task_manager: { label: 'Task Manager', mac: { app: 'Activity Monitor' }, win: { cmd: 'taskmgr', proc: 'Taskmgr.exe' } },
  store: { label: 'the app store', mac: { app: 'App Store' }, win: { uri: 'ms-windows-store:' } },
  browser: { label: 'the browser', url: 'https://www.google.com' },
  youtube: { label: 'YouTube', url: 'https://www.youtube.com' },
  wikipedia: { label: 'Wikipedia', url: 'https://www.wikipedia.org' },
};

function runCommand(command) {
  return new Promise((resolve) => {
    exec(command, { timeout: 8000 }, (err) => {
      resolve(!err);
    });
  });
}

function getPlatformSpec(entry) {
  if (!entry) return null;
  if (isMac) return entry.mac || null;
  if (isWin) return entry.win || null;
  return null;
}

function getLaunchSpec(appId) {
  const entry = APP_REGISTRY[appId];
  if (!entry) return null;

  if (entry.url) {
    return { kind: 'url', url: entry.url, label: entry.label };
  }

  const spec = getPlatformSpec(entry);
  if (!spec) return null;

  if (spec.folder) {
    if (isMac) {
      return { kind: 'exec', command: `open ${JSON.stringify(spec.folder)}`, label: entry.label };
    }
    if (isWin) {
      return { kind: 'exec', command: `explorer ${JSON.stringify(spec.folder)}`, label: entry.label };
    }
    return null;
  }

  if (isMac && spec.app) {
    return { kind: 'exec', command: `open -a ${JSON.stringify(spec.app)}`, label: entry.label };
  }

  if (isWin && spec.cmd) {
    return { kind: 'exec', command: `start "" ${spec.cmd}`, label: entry.label };
  }

  if (isWin && spec.uri) {
    return { kind: 'exec', command: `start "" ${JSON.stringify(spec.uri)}`, label: entry.label };
  }

  return null;
}

function getCloseSpec(appId) {
  const entry = APP_REGISTRY[appId];
  if (!entry || entry.url || entry.mac?.folder || entry.win?.folder) return null;

  const spec = getPlatformSpec(entry);
  if (!spec) return null;

  if (isMac && spec.app) {
    return {
      kind: 'exec',
      command: `osascript -e ${JSON.stringify(`quit app "${spec.app}"`)}`,
      label: entry.label,
    };
  }

  if (isWin && spec.proc) {
    return { kind: 'exec', command: `taskkill /IM ${spec.proc}`, label: entry.label };
  }

  return null;
}

async function openApp(appId) {
  const entry = APP_REGISTRY[appId];
  if (!entry) {
    return { ok: false, message: `I don't know how to open "${appId}" yet.` };
  }

  if (entry.url) {
    return openUrl(entry.url, entry.label);
  }

  const launch = getLaunchSpec(appId);
  if (!launch) {
    return { ok: false, message: `Opening ${entry.label} isn't supported on this system.` };
  }

  const ok = await runCommand(launch.command);
  return ok
    ? { ok: true, message: `Opened ${entry.label} for you.`, label: entry.label }
    : { ok: false, message: `I tried, but couldn't open ${entry.label}.`, label: entry.label };
}

async function closeApp(appId) {
  const entry = APP_REGISTRY[appId];
  if (!entry) {
    return { ok: false, message: `I don't know how to close "${appId}" yet.` };
  }

  const close = getCloseSpec(appId);
  if (!close) {
    return { ok: false, message: `I can open ${entry.label}, but I can't close that one.`, label: entry.label };
  }

  const ok = await runCommand(close.command);
  return ok
    ? { ok: true, message: `Closed ${entry.label} for you.`, label: entry.label }
    : { ok: false, message: `I couldn't close ${entry.label} — maybe it wasn't open?`, label: entry.label };
}

async function openUrl(url, label) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return { ok: false, message: 'I can only open normal web links (http or https).' };
  }

  try {
    if (shell?.openExternal) {
      await shell.openExternal(url);
      return { ok: true, message: `Opened ${label || url} for you.`, label: label || url };
    }
  } catch (_) {
    /* fall through to OS launcher */
  }

  const ok = isMac
    ? await runCommand(`open ${JSON.stringify(url)}`)
    : isWin
      ? await runCommand(`start "" ${JSON.stringify(url)}`)
      : false;

  return ok
    ? { ok: true, message: `Opened ${label || url} for you.`, label: label || url }
    : { ok: false, message: `I couldn't open that link.` };
}

function getTime() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  return { ok: true, message: `It's ${time} on ${date}.`, time, date };
}

function listAppIds() {
  return Object.keys(APP_REGISTRY);
}

function listCommands() {
  const names = Object.values(APP_REGISTRY).map((e) => e.label.replace(/^(a|the) /, ''));
  const appList = names.join(', ');
  const message = [
    "Here's what I can do for you! 🐾",
    `• Open apps — try "open notepad", "open the camera", or "open the calculator"`,
    `• Close apps — try "close notepad" or "quit the calculator"`,
    `• Tell the time — "what time is it?"`,
    `• Open a website — "open google.com" or "open youtube"`,
    ``,
    `I know these apps: ${appList}.`,
    `And of course, I'm always here to chat too~ 💕`,
  ].join('\n');
  return { ok: true, message };
}

module.exports = {
  openApp,
  closeApp,
  openUrl,
  getTime,
  listAppIds,
  listCommands,
  getLaunchSpec,
  getCloseSpec,
  APP_REGISTRY,
};
