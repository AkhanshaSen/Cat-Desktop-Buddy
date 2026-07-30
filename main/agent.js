/**
 * Meow agent orchestrator.
 *
 * Routing:
 *   1. Fast path  — offline intent match runs an allowlisted action instantly.
 *   2. Smart path — if a Gemini key is set, use function calling for natural
 *                   language ("something to write in", "open whatever I browse
 *                   the web with"), executing the same allowlisted actions.
 *   3. Fallback   — no task detected: return null so the renderer's personality
 *                   engine handles emotional / social chat.
 *
 * Returns { text, expression, actionTaken, actionId } or null.
 */
const actions = require('./actions');
const intents = require('./intents');
const config = require('./agent-config');
const gemini = require('./gemini');

const CUTE_CONFIRMATIONS = [
  '*paws at the keyboard* Done!',
  'There you go, friend~ 🐾',
  'Tada! Opened it for you~',
  '*proud tail swish* All set!',
  'Mrow! On it — done!',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Fast offline path ────────────────────────────────────────────────
async function tryFastPath(message) {
  const intent = intents.matchIntent(message);
  if (!intent) return null;

  if (intent.type === 'help') {
    return { text: actions.listCommands().message, expression: 'happy', actionTaken: false, actionId: null };
  }

  if (intent.type === 'time') {
    const result = actions.getTime();
    return {
      text: `${pick(['Let me check~', 'Mrow, one sec~', 'Peeking at the clock~'])} ${result.message}`,
      expression: 'happy',
      actionTaken: false,
      actionId: null,
    };
  }

  let result;
  if (intent.type === 'close') {
    result = await actions.closeApp(intent.actionId);
  } else if (intent.type === 'url') {
    result = await actions.openUrl(intent.url);
  } else {
    result = await actions.openApp(intent.actionId);
  }

  const text = result.ok
    ? `${pick(CUTE_CONFIRMATIONS)} ${result.message}`
    : `${result.message} *sad meow*`;

  return {
    text,
    expression: result.ok ? 'excited' : 'sad',
    actionTaken: !!result.ok,
    actionId: intent.actionId || null,
  };
}

// ── Gemini function-calling path ───────────────────────────────────
const SYSTEM_PROMPT = `You are Meow, a cute, warm desktop cat companion. You speak briefly and adorably, with occasional cat noises (mrow, purr) and the odd emoji.

You can help with small computer tasks using your tools:
- open_app: open an allowlisted app on the user's computer
- close_app: close/quit an allowlisted app
- open_url: open a web link in the browser
- get_time: tell the current time and date
- list_commands: list everything you can do (use when the user asks what you can do / what commands you know)

Rules:
- If the user asks to open/launch something, call open_app. If they ask to close/quit/exit something, call close_app. Map fuzzy requests to the closest app (e.g. "something to write in" -> notepad, "take a selfie" -> camera).
- If the user asks what you can do or what commands you know, call list_commands.
- Only chat (no tool) for greetings, feelings, and small talk.
- After a tool runs, reply in ONE short cute sentence confirming what you did. Never mention JSON, tools, or functions.`;

function buildFunctionDeclarations() {
  return [
    {
      name: 'open_app',
      description: 'Open an allowlisted application on the user\'s computer.',
      parameters: {
        type: 'object',
        properties: {
          app: { type: 'string', enum: actions.listAppIds(), description: 'Which app to open.' },
        },
        required: ['app'],
      },
    },
    {
      name: 'close_app',
      description: 'Close/quit an allowlisted application on the user\'s computer.',
      parameters: {
        type: 'object',
        properties: {
          app: { type: 'string', enum: actions.listAppIds(), description: 'Which app to close.' },
        },
        required: ['app'],
      },
    },
    {
      name: 'open_url',
      description: 'Open a web link (http/https) in the default browser.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'A full http(s) URL.' } },
        required: ['url'],
      },
    },
    {
      name: 'get_time',
      description: 'Get the current local time and date.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'list_commands',
      description: 'List everything Meow can do. Use when the user asks what you can do or what commands you know.',
      parameters: { type: 'object', properties: {} },
    },
  ];
}

function buildGeminiContents(history, message) {
  const contents = [];

  (history || []).slice(-6).forEach((m) => {
    if (!m?.text) return;
    contents.push({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    });
  });
  contents.push({ role: 'user', parts: [{ text: message }] });

  return contents;
}

function extractParts(response) {
  return response?.candidates?.[0]?.content?.parts || [];
}

function extractText(parts) {
  return parts
    .map((part) => part.text)
    .filter(Boolean)
    .join('')
    .trim();
}

function extractFunctionCalls(parts) {
  return parts
    .filter((part) => part.functionCall)
    .map((part) => part.functionCall);
}

async function callGemini(contents, apiKey, model, { includeTools = true } = {}) {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 200,
    },
  };

  if (includeTools) {
    body.tools = [{ functionDeclarations: buildFunctionDeclarations() }];
  }

  const { json, model: usedModel } = await gemini.generateContent(apiKey, model, body, { includeTools });
  if (usedModel && usedModel !== model) {
    config.save({ model: usedModel });
  }
  return json;
}

async function executeToolCall(call) {
  const args = call.args || {};

  const name = call.name;
  if (name === 'open_app') return actions.openApp(args.app);
  if (name === 'close_app') return actions.closeApp(args.app);
  if (name === 'open_url') return actions.openUrl(args.url);
  if (name === 'get_time') return actions.getTime();
  if (name === 'list_commands') return actions.listCommands();
  return { ok: false, message: 'Unknown action.' };
}

async function trySmartPath(message, history, cfg) {
  const contents = buildGeminiContents(history, message);

  const first = await callGemini(contents, cfg.apiKey, cfg.model);
  const firstParts = extractParts(first);
  if (firstParts.length === 0) {
    return { text: '*confused meow* My brain hiccuped! Try again? 🐾', expression: 'sad', actionTaken: false };
  }

  const functionCalls = extractFunctionCalls(firstParts);
  if (functionCalls.length === 0) {
    return {
      text: extractText(firstParts) || 'Mrow~',
      expression: 'happy',
      actionTaken: false,
      actionId: null,
    };
  }

  const followUpContents = [...contents];
  followUpContents.push({ role: 'model', parts: firstParts });

  let anyAction = false;
  let lastActionId = null;
  const NON_ACTION_TOOLS = ['get_time', 'list_commands'];
  const responseParts = [];

  for (const call of functionCalls) {
    const result = await executeToolCall(call);
    if (result.ok && !NON_ACTION_TOOLS.includes(call.name)) anyAction = true;
    if (call.name === 'open_app' || call.name === 'close_app') {
      lastActionId = call.args?.app || null;
    }
    responseParts.push({
      functionResponse: {
        name: call.name,
        response: result,
        id: call.id,
      },
    });
  }

  followUpContents.push({ role: 'user', parts: responseParts });

  const second = await callGemini(followUpContents, cfg.apiKey, cfg.model);
  const finalText = extractText(extractParts(second));

  return {
    text: finalText || pick(CUTE_CONFIRMATIONS),
    expression: anyAction ? 'excited' : 'happy',
    actionTaken: anyAction,
    actionId: lastActionId,
  };
}

async function handleChat({ message, history }) {
  const cfg = config.load();
  if (!cfg.agentEnabled) return null;

  const fast = await tryFastPath(message);
  if (fast) return fast;

  if (!cfg.apiKey) return null;

  try {
    return await trySmartPath(message, history, cfg);
  } catch (err) {
    console.error('[Meow agent] Gemini error:', err.status, err.message);
    return {
      text: gemini.userMessageForError(err),
      expression: 'sad',
      actionTaken: false,
    };
  }
}

async function runHealthCheck() {
  const cfg = config.load();
  if (!cfg.apiKey) return gemini.getLastHealth();

  const health = await gemini.testHealth(cfg.apiKey, cfg.model);
  if (health.ok && health.model && health.model !== cfg.model) {
    config.save({ model: health.model });
  }
  return health;
}

module.exports = { handleChat, runHealthCheck };
