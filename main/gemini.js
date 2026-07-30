/**
 * Gemini API client — health checks, model fallback loop, generateContent.
 */
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const MODEL_FALLBACKS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

let lastHealth = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseErrorBody(text) {
  try {
    const json = JSON.parse(text);
    return json?.error?.message || text.slice(0, 200);
  } catch (_) {
    return text.slice(0, 200);
  }
}

function modelOrder(preferred) {
  const first = preferred || MODEL_FALLBACKS[0];
  return [first, ...MODEL_FALLBACKS.filter((m) => m !== first)];
}

function getLastHealth() {
  return lastHealth;
}

async function ping(apiKey, model) {
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: meow' }] }],
      generationConfig: { maxOutputTokens: 10, temperature: 0 },
    }),
  });

  const bodyText = await res.text().catch(() => '');

  if (!res.ok) {
    return {
      ok: false,
      model,
      status: res.status,
      message: parseErrorBody(bodyText),
    };
  }

  try {
    const json = JSON.parse(bodyText);
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    return { ok: true, model, status: res.status, message: text.trim() || 'Connected' };
  } catch (_) {
    return { ok: false, model, status: res.status, message: 'Invalid JSON response' };
  }
}

/**
 * Loop models (and optional retries) until one responds or all fail.
 */
async function testHealth(apiKey, preferredModel, { retries = 2, retryDelayMs = 1500 } = {}) {
  if (!apiKey) {
    lastHealth = { ok: false, reason: 'no_key', message: 'No API key saved.' };
    return lastHealth;
  }

  const models = modelOrder(preferredModel);
  let sawQuota = false;
  let quotaMessage = '';

  for (let attempt = 1; attempt <= retries; attempt++) {
    for (const model of models) {
      try {
        const result = await ping(apiKey, model);
        if (result.ok) {
          lastHealth = {
            ok: true,
            reason: 'ok',
            model: result.model,
            message: `Connected (${result.model})`,
            attempt,
          };
          return lastHealth;
        }

        if (result.status === 429) {
          sawQuota = true;
          quotaMessage = result.message;
        }

        lastHealth = {
          ok: false,
          reason: result.status === 401 || result.status === 403 ? 'auth'
            : result.status === 429 ? 'quota'
            : result.status === 404 ? 'model'
            : 'error',
          model: result.model,
          status: result.status,
          message: result.message,
          attempt,
        };

        if (result.status === 401 || result.status === 403) return lastHealth;
      } catch (err) {
        lastHealth = {
          ok: false,
          reason: 'network',
          model,
          message: err.message || 'Network error',
          attempt,
        };
      }
    }

    if (attempt < retries) await sleep(retryDelayMs);
  }

  if (sawQuota) {
    lastHealth = {
      ok: false,
      reason: 'quota',
      status: 429,
      message: quotaMessage || 'Free-tier quota exceeded.',
      attempt: retries,
    };
  }

  return lastHealth;
}

async function generateContent(apiKey, preferredModel, body, { includeTools = true } = {}) {
  const requestBody = { ...body };
  if (!includeTools) delete requestBody.tools;

  const models = modelOrder(preferredModel);
  let lastErr = null;

  for (const model of models) {
    const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (res.ok) {
      return { json: await res.json(), model };
    }

    const detail = await res.text().catch(() => '');
    lastErr = {
      status: res.status,
      detail,
      message: parseErrorBody(detail),
      model,
    };

    // Only try the next model for recoverable errors.
    if (res.status !== 429 && res.status !== 404) break;
  }

  const err = new Error(lastErr?.message || 'Gemini request failed');
  err.status = lastErr?.status;
  err.detail = lastErr?.detail;
  err.model = lastErr?.model;
  err.reason = lastErr?.status === 401 || lastErr?.status === 403 ? 'auth'
    : lastErr?.status === 429 ? 'quota'
    : lastErr?.status === 404 ? 'model'
    : 'error';
  throw err;
}

function userMessageForError(err) {
  if (err.reason === 'auth' || err.status === 401 || err.status === 403) {
    return 'My key seems wrong~ check it in Settings? 🔑';
  }
  if (err.reason === 'quota' || err.status === 429) {
    return 'My free Gemini quota ran out~ wait a bit or check ai.google.dev, then try again. ⏳';
  }
  if (err.reason === 'model' || err.status === 404) {
    return 'That Gemini model isn\'t available~ try saving your key again in Settings. 🐾';
  }
  return "*confused meow* I couldn't reach my brain just now. Try again?";
}

module.exports = {
  MODEL_FALLBACKS,
  GEMINI_BASE,
  generateContent,
  getLastHealth,
  testHealth,
  userMessageForError,
};
