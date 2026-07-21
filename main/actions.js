/**
 * Safe OS action executor for the Meow agent.
 *
 * Only allowlisted apps can be opened — the agent (and LLM) can never run
 * arbitrary shell commands. Each action resolves a platform-specific launcher
 * and returns { ok, message } so the cat can paraphrase the result.
 */
const { exec } = require('child_process');
const { shell } = require('electron');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

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
  photos: { label: 'Photos', mac: { app: 'Photos' }, win: { uri: 'ms-photos:', proc: 'Microsoft.Photos.exe' } },
  calendar: { label: 'the calendar', mac: { app: 'Calendar' }, win: { uri: 'outlookcal:' } },
  mail: { label: 'Mail', mac: { app: 'Mail' }, win: { uri: 'outlookmail:' } },
  settings: { label: 'system settings', mac: { app: 'System Settings' }, win: { uri: 'ms-settings:', proc: 'SystemSettings.exe' } },
  music: { label: 'Music', mac: { app: 'Music' }, win: { uri: 'spotify:', proc: 'Spotify.exe' } },
  browser: { label: 'the browser', url: 'https://www.google.com' },
};

function runCommand(command) {
  return new Promise((resolve) => {
    exec(command, { timeout: 8000 }, (err) => {
      resolve(!err);
    });
  });
}

async function openApp(appId) {
  const entry = APP_REGISTRY[appId];
  if (!entry) {
    return { ok: false, message: `I don't know how to open "${appId}" yet.` };
  }

  // Apps defined purely by a URL (e.g. browser) go through the URL path.
  if (entry.url) {
    return openUrl(entry.url, entry.label);
  }

  const spec = isMac ? entry.mac : isWin ? entry.win : null;
  if (!spec) {
    return { ok: false, message: `Opening ${entry.label} isn't supported on this system.` };
  }

  let ok = false;
  if (isMac && spec.app) {
    ok = await runCommand(`open -a ${JSON.stringify(spec.app)}`);
  } else if (isWin && spec.cmd) {
    ok = await runCommand(`start "" ${spec.cmd}`);
  } else if (isWin && spec.uri) {
    ok = await runCommand(`start "" ${JSON.stringify(spec.uri)}`);
  }

  return ok
    ? { ok: true, message: `Opened ${entry.label} for you.`, label: entry.label }
    : { ok: false, message: `I tried, but couldn't open ${entry.label}.`, label: entry.label };
}

async function closeApp(appId) {
  const entry = APP_REGISTRY[appId];
  if (!entry) {
    return { ok: false, message: `I don't know how to close "${appId}" yet.` };
  }

  const spec = isMac ? entry.mac : isWin ? entry.win : null;
  if (!spec) {
    return { ok: false, message: `Closing ${entry.label} isn't supported on this system.` };
  }

  let ok = false;
  if (isMac && spec.app) {
    // AppleScript quit lets the app close gracefully (prompts to save if needed).
    ok = await runCommand(`osascript -e ${JSON.stringify(`quit app "${spec.app}"`)}`);
  } else if (isWin && spec.proc) {
    ok = await runCommand(`taskkill /IM ${spec.proc}`);
  } else {
    return { ok: false, message: `I can open ${entry.label}, but I can't close that one.`, label: entry.label };
  }

  return ok
    ? { ok: true, message: `Closed ${entry.label} for you.`, label: entry.label }
    : { ok: false, message: `I couldn't close ${entry.label} — maybe it wasn't open?`, label: entry.label };
}

async function openUrl(url, label) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return { ok: false, message: 'I can only open normal web links (http or https).' };
  }
  try {
    await shell.openExternal(url);
    return { ok: true, message: `Opened ${label || url} for you.`, label: label || url };
  } catch (_) {
    return { ok: false, message: `I couldn't open that link.` };
  }
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

// A cute, human-readable summary of what Meow can do, built from the registry.
function listCommands() {
  const names = Object.values(APP_REGISTRY).map((e) => e.label.replace(/^(a|the) /, ''));
  const appList = names.join(', ');
  const message = [
    "Here's what I can do for you! 🐾",
    `• Open apps — try "open notepad", "open the camera", or "open the calculator"`,
    `• Close apps — try "close notepad" or "quit the calculator"`,
    `• Tell the time — "what time is it?"`,
    `• Open a website — "open google.com"`,
    ``,
    `I know these apps: ${appList}.`,
    `And of course, I'm always here to chat too~ 💕`,
  ].join('\n');
  return { ok: true, message };
}

module.exports = { openApp, closeApp, openUrl, getTime, listAppIds, listCommands, APP_REGISTRY };
