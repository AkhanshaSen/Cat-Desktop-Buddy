/**
 * Meow agent orchestrator.
 *
 * Routing:
 *   1. Fast path  — offline intent match runs an allowlisted action instantly.
 *   2. Smart path — if an OpenAI key is set, use tool-calling for natural
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

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

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

  // Help / "what can you do" — no OS action, just a friendly rundown.
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

// ── OpenAI tool-calling path ─────────────────────────────────────────
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

function buildTools() {
  return [
    {
      type: 'function',
      function: {
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
    },
    {
      type: 'function',
      function: {
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
    },
    {
      type: 'function',
      function: {
        name: 'open_url',
        description: 'Open a web link (http/https) in the default browser.',
        parameters: {
          type: 'object',
          properties: { url: { type: 'string', description: 'A full http(s) URL.' } },
          required: ['url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_time',
        description: 'Get the current local time and date.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_commands',
        description: 'List everything Meow can do. Use when the user asks what you can do or what commands you know.',
        parameters: { type: 'object', properties: {} },
      },
    },
  ];
}

async function callOpenAI(messages, apiKey, model) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools: buildTools(),
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 200,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`OpenAI ${res.status}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  return res.json();
}

async function executeToolCall(call) {
  let args = {};
  try {
    args = JSON.parse(call.function.arguments || '{}');
  } catch (_) { /* leave empty */ }

  const name = call.function.name;
  if (name === 'open_app') return actions.openApp(args.app);
  if (name === 'close_app') return actions.closeApp(args.app);
  if (name === 'open_url') return actions.openUrl(args.url);
  if (name === 'get_time') return actions.getTime();
  if (name === 'list_commands') return actions.listCommands();
  return { ok: false, message: 'Unknown action.' };
}

async function trySmartPath(message, history, cfg) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  (history || []).slice(-6).forEach((m) => {
    if (m && m.text) {
      messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text });
    }
  });
  messages.push({ role: 'user', content: message });

  const first = await callOpenAI(messages, cfg.apiKey, cfg.model);
  const choice = first.choices?.[0]?.message;
  if (!choice) return { text: '*confused meow* My brain hiccuped! Try again? 🐾', expression: 'sad', actionTaken: false };

  const toolCalls = choice.tool_calls || [];
  if (toolCalls.length === 0) {
    return {
      text: choice.content?.trim() || 'Mrow~',
      expression: 'happy',
      actionTaken: false,
      actionId: null,
    };
  }

  // Execute tools, then ask the model for a final Meow-voiced reply.
  messages.push(choice);
  let anyAction = false;
  let lastActionId = null;
  const NON_ACTION_TOOLS = ['get_time', 'list_commands'];
  for (const call of toolCalls) {
    const result = await executeToolCall(call);
    if (result.ok && !NON_ACTION_TOOLS.includes(call.function.name)) anyAction = true;
    if (call.function.name === 'open_app' || call.function.name === 'close_app') {
      try { lastActionId = JSON.parse(call.function.arguments || '{}').app || null; } catch (_) { /* ignore */ }
    }
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: JSON.stringify(result),
    });
  }

  const second = await callOpenAI(messages, cfg.apiKey, cfg.model);
  const finalText = second.choices?.[0]?.message?.content?.trim();

  return {
    text: finalText || pick(CUTE_CONFIRMATIONS),
    expression: anyAction ? 'excited' : 'happy',
    actionTaken: anyAction,
    actionId: lastActionId,
  };
}

/**
 * Handle a chat message. Returns an agent response, or null if the message is
 * not a task (so the renderer falls back to the personality engine).
 */
async function handleChat({ message, history }) {
  const cfg = config.load();
  if (!cfg.agentEnabled) return null;

  const fast = await tryFastPath(message);
  if (fast) return fast;

  if (!cfg.apiKey) return null;

  try {
    return await trySmartPath(message, history, cfg);
  } catch (err) {
    if (err.status === 401) {
      return { text: 'My key seems wrong~ check it in Settings? 🔑', expression: 'sad', actionTaken: false };
    }
    return { text: "*confused meow* I couldn't reach my brain just now. Try again?", expression: 'sad', actionTaken: false };
  }
}

module.exports = { handleChat };
