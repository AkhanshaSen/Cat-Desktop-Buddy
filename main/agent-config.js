/**
 * Persisted agent configuration (main process only).
 *
 * The OpenAI API key never leaves the main process — the renderer can update
 * it and query whether one exists, but can never read it back.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = {
  agentEnabled: true,
  apiKey: '',
  model: 'gpt-4o-mini',
};

let cache = null;

function configPath() {
  return path.join(app.getPath('userData'), 'agent-config.json');
}

function load() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    const saved = JSON.parse(raw);
    cache = {
      agentEnabled: typeof saved.agentEnabled === 'boolean' ? saved.agentEnabled : DEFAULTS.agentEnabled,
      apiKey: typeof saved.apiKey === 'string' ? saved.apiKey : DEFAULTS.apiKey,
      model: typeof saved.model === 'string' && saved.model ? saved.model : DEFAULTS.model,
    };
  } catch (_) {
    cache = { ...DEFAULTS };
  }
  return cache;
}

function save(partial) {
  const current = load();
  const next = { ...current };

  if (typeof partial.agentEnabled === 'boolean') next.agentEnabled = partial.agentEnabled;
  if (typeof partial.model === 'string' && partial.model) next.model = partial.model;
  // Only overwrite the key when a non-empty string is provided, so toggling
  // other settings doesn't wipe a saved key. An explicit null clears it.
  if (typeof partial.apiKey === 'string' && partial.apiKey.trim()) {
    next.apiKey = partial.apiKey.trim();
  } else if (partial.apiKey === null) {
    next.apiKey = '';
  }

  cache = next;
  try {
    fs.writeFileSync(configPath(), JSON.stringify(next, null, 2), { mode: 0o600 });
  } catch (_) { /* best effort */ }
  return publicView();
}

// Never expose the raw key to the renderer.
function publicView() {
  const c = load();
  return {
    agentEnabled: c.agentEnabled,
    hasApiKey: !!c.apiKey,
    model: c.model,
  };
}

module.exports = { load, save, publicView };
