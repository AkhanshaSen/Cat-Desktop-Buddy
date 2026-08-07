/**
 * Offline command test — loops every allowlisted app and phrase.
 *
 * Usage:
 *   npm run test:commands          # intent + launcher checks (safe for CI)
 *   npm run test:commands -- --live # actually open/close each app on this machine
 */
const actions = require('../main/actions');
const intents = require('../main/intents');
const agent = require('../main/agent');

const PLATFORM = process.platform;
const LIVE = process.argv.includes('--live');
const QUIET = process.argv.includes('--quiet');

const INTENT_PHRASES = [
  { phrase: 'open the camera', expect: { type: 'app', actionId: 'camera' } },
  { phrase: 'launch calculator', expect: { type: 'app', actionId: 'calculator' } },
  { phrase: 'open notepad', expect: { type: 'app', actionId: 'notepad' } },
  { phrase: 'pull up something to write in', expect: { type: 'app', actionId: 'notepad' } },
  { phrase: 'open the terminal', expect: { type: 'app', actionId: 'terminal' } },
  { phrase: 'open file explorer', expect: { type: 'app', actionId: 'finder' } },
  { phrase: 'open my downloads', expect: { type: 'app', actionId: 'downloads' } },
  { phrase: 'open photos', expect: { type: 'app', actionId: 'photos' } },
  { phrase: 'open the calendar', expect: { type: 'app', actionId: 'calendar' } },
  { phrase: 'open mail', expect: { type: 'app', actionId: 'mail' } },
  { phrase: 'open contacts', expect: { type: 'app', actionId: 'contacts' } },
  { phrase: 'open reminders', expect: { type: 'app', actionId: 'reminders' } },
  { phrase: 'open the clock', expect: { type: 'app', actionId: 'clock' } },
  { phrase: 'open weather', expect: { type: 'app', actionId: 'weather' } },
  { phrase: 'open maps', expect: { type: 'app', actionId: 'maps' } },
  { phrase: 'open system settings', expect: { type: 'app', actionId: 'settings' } },
  { phrase: 'open music', expect: { type: 'app', actionId: 'music' } },
  { phrase: 'open voice memos', expect: { type: 'app', actionId: 'voice_memos' } },
  { phrase: 'open screenshot tool', expect: { type: 'app', actionId: 'screenshot' } },
  { phrase: 'open sticky notes', expect: { type: 'app', actionId: 'sticky_notes' } },
  { phrase: 'open paint', expect: { type: 'app', actionId: 'paint' } },
  { phrase: 'open task manager', expect: { type: 'app', actionId: 'task_manager' } },
  { phrase: 'open the app store', expect: { type: 'app', actionId: 'store' } },
  { phrase: 'open the browser', expect: { type: 'app', actionId: 'browser' } },
  { phrase: 'open youtube', expect: { type: 'app', actionId: 'youtube' } },
  { phrase: 'open wikipedia', expect: { type: 'app', actionId: 'wikipedia' } },
  { phrase: 'open google.com', expect: { type: 'url', url: 'https://google.com' } },
  { phrase: 'visit youtube.com', expect: { type: 'app', actionId: 'youtube' } },
  { phrase: 'what time is it?', expect: { type: 'time' } },
  { phrase: 'what can you do?', expect: { type: 'help' } },
  { phrase: 'close calculator', expect: { type: 'close', actionId: 'calculator' } },
  { phrase: 'quit the notepad', expect: { type: 'close', actionId: 'notepad' } },
];

const NON_CHAT_PHRASES = [
  'just vibing with my cat',
  'notes from my meeting were long',
];

let passed = 0;
let failed = 0;

function log(msg) {
  if (!QUIET) console.log(msg);
}

function pass(label) {
  passed += 1;
  log(`  PASS  ${label}`);
}

function fail(label, detail) {
  failed += 1;
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass(label);
    return true;
  }
  fail(label, `expected ${e}, got ${a}`);
  return false;
}

function testIntentPhrases() {
  log('\nIntent phrase matching');
  for (const { phrase, expect: expected } of INTENT_PHRASES) {
    const intent = intents.matchIntent(phrase);
    assertEqual(intent, expected, `"${phrase}"`);
  }
}

function testNoFalsePositives() {
  log('\nCasual chat should not trigger tasks');
  for (const phrase of NON_CHAT_PHRASES) {
    const intent = intents.matchIntent(phrase);
    if (intent === null) pass(`no task for "${phrase}"`);
    else fail(`no task for "${phrase}"`, JSON.stringify(intent));
  }
}

function testAliasCoverage() {
  log('\nAlias registry coverage');
  const ids = new Set(actions.listAppIds());
  for (const { id, words } of intents.APP_ALIASES) {
    if (ids.has(id)) pass(`alias id "${id}" is registered`);
    else fail(`alias id "${id}" is registered`, 'missing from APP_REGISTRY');
    if (words.length > 0) pass(`alias "${id}" has ${words.length} phrase(s)`);
    else fail(`alias "${id}" has phrases`, 'empty words list');
  }
}

function testLaunchSpecs() {
  log(`\nLaunch specs on ${PLATFORM}`);
  for (const id of actions.listAppIds()) {
    const spec = actions.getLaunchSpec(id);
    if (!spec) {
      fail(`launch spec for "${id}"`, 'missing on this platform');
      continue;
    }
    if (spec.kind === 'url' && /^https?:\/\//i.test(spec.url)) {
      pass(`launch spec for "${id}" (${spec.kind})`);
    } else if (spec.kind === 'exec' && typeof spec.command === 'string' && spec.command.length > 0) {
      pass(`launch spec for "${id}" (${spec.kind})`);
    } else {
      fail(`launch spec for "${id}"`, JSON.stringify(spec));
    }
  }
}

async function testAgentFastPath() {
  log('\nAgent fast path (offline)');
  for (const { phrase } of INTENT_PHRASES.filter((p) => p.expect.type === 'app' || p.expect.type === 'time')) {
    const result = await agent.handleChat({ message: phrase, history: [] });
    if (result && typeof result.text === 'string' && result.text.length > 0) {
      pass(`handleChat("${phrase}")`);
    } else {
      fail(`handleChat("${phrase}")`, 'no response');
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testLiveOpenClose() {
  log(`\nLive open/close loop on ${PLATFORM}`);
  const ids = actions.listAppIds();

  for (const id of ids) {
    const entry = actions.APP_REGISTRY[id];
    const openResult = await actions.openApp(id);
    if (openResult.ok) {
      pass(`open "${id}" (${entry.label})`);
    } else {
      fail(`open "${id}" (${entry.label})`, openResult.message);
    }

    await sleep(700);

    const closeSpec = actions.getCloseSpec(id);
    if (!closeSpec) {
      log(`  skip  close "${id}" (not supported)`);
      continue;
    }

    const closeResult = await actions.closeApp(id);
    if (closeResult.ok) {
      pass(`close "${id}"`);
    } else {
      // Close often fails if the app wasn't fully open yet — warn, don't fail the suite.
      log(`  warn  close "${id}" — ${closeResult.message}`);
    }

    await sleep(300);
  }
}

async function main() {
  console.log('Meow offline command test');
  console.log(`Platform: ${PLATFORM}`);
  console.log(`Mode: ${LIVE ? 'live (opens real apps)' : 'static (intent + launcher checks)'}`);
  console.log(`Apps in registry: ${actions.listAppIds().length}`);

  testIntentPhrases();
  testNoFalsePositives();
  testAliasCoverage();
  testLaunchSpecs();
  await testAgentFastPath();

  if (LIVE) {
    if (PLATFORM !== 'darwin' && PLATFORM !== 'win32') {
      console.error('\nLive mode only supports macOS and Windows.');
      process.exit(1);
    }
    await testLiveOpenClose();
  } else {
    log('\nTip: run `npm run test:commands -- --live` on your machine to open each app.');
  }

  console.log('\n---');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) process.exit(1);
  console.log('All command checks passed.');
}

main().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});
