/**
 * Gemini connection test — loops models and retries until one works or all fail.
 *
 * Usage: npm run test:gemini
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const gemini = require('../main/gemini');

function configPath() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'ai-meow', 'agent-config.json');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'ai-meow', 'agent-config.json');
  }
  return path.join(os.homedir(), '.config', 'ai-meow', 'agent-config.json');
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch (_) {
    return { apiKey: '', model: 'gemini-2.0-flash' };
  }
}

async function main() {
  const cfg = loadConfig();
  console.log('Meow Gemini test');
  console.log('Config:', configPath());
  console.log('Has key:', !!cfg.apiKey);
  console.log('Preferred model:', cfg.model || 'gemini-2.0-flash');
  console.log('Fallback models:', gemini.MODEL_FALLBACKS.join(', '));
  console.log('---');

  if (!cfg.apiKey) {
    console.log('FAIL — no API key. Add one in Meow Settings or agent-config.json');
    process.exit(1);
  }

  const health = await gemini.testHealth(cfg.apiKey, cfg.model, { retries: 3, retryDelayMs: 2000 });

  if (health.ok) {
    console.log(`OK — ${health.message} (attempt ${health.attempt})`);
    if (health.model !== cfg.model) {
      console.log(`Tip: update model in config to "${health.model}"`);
    }
    process.exit(0);
  }

  console.log(`FAIL — ${health.reason || 'error'} (HTTP ${health.status || 'n/a'})`);
  console.log('Model tried:', health.model);
  console.log('Detail:', health.message);
  if (health.reason === 'quota') {
    console.log('\nYour key works but the free-tier quota is used up. Wait and retry, or use a new key from https://aistudio.google.com/');
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('Test crashed:', err.message);
  process.exit(1);
});
