import http from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function loadDotEnv() {
  try {
    const envPath = path.join(projectRoot, '.env');
    const content = await readFile(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...rest] = trimmed.split('=');
      const value = rest.join('=').trim();
      if (!key || process.env[key] !== undefined) return;
      process.env[key] = value.replace(/^"(.*)"$/, '$1');
    });
  } catch {
    // No .env file; ignore.
  }
}

await loadDotEnv();

const PORT = parseInt(process.env.UI_GENERATION_PORT || '8787', 10);
const PROVIDER_DEFAULT = (process.env.UI_PROVIDER || 'openai').toLowerCase();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620';
const ANTHROPIC_VERSION = process.env.ANTHROPIC_VERSION || '2023-06-01';

const MAX_TOKENS = parseInt(process.env.UI_MAX_TOKENS || '8000', 10);
console.log('[boot] MAX_TOKENS=', MAX_TOKENS, 'OPENAI_MODEL=', OPENAI_MODEL);
const PROVIDER_TIMEOUT_MS = parseInt(
  process.env.UI_PROVIDER_TIMEOUT_MS || '45000',
  10,
);
console.log(
  '[boot] PROVIDER_TIMEOUT_MS=',
  PROVIDER_TIMEOUT_MS,
  'OPENAI_MODEL=',
  OPENAI_MODEL,
);

const DEBUG_WRITE_PATH = '/tmp/latest-after';

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  if (status === 204) {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

function extractTextFromOpenAI(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const output = Array.isArray(payload?.output) ? payload.output : [];
  const chunks = [];
  for (const item of output) {
    if (item?.type !== 'message') continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === 'string') chunks.push(part.text);
      if (typeof part?.output_text === 'string') chunks.push(part.output_text);
    }
  }
  return chunks.join('\n').trim();
}

function extractTextFromGemini(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join('\n');
  return text || '';
}

function extractTextFromClaude(payload) {
  const content = Array.isArray(payload?.content) ? payload.content : [];
  return content
    .map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    .trim();
}

// function extractHtml(text) {
//   if (!text) return '';
//   const fenced = text.match(/```html\s*([\s\S]*?)```/i);
//   if (fenced?.[1]) return fenced[1].trim();
//   const htmlStart = text.indexOf('<html');
//   if (htmlStart !== -1) return text.slice(htmlStart).trim();
//   return text.trim();
// }

function extractHtml(text) {
  if (!text) return '';
  const fenced = text.match(/```html\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const doctypeStart = text.toLowerCase().indexOf('<!doctype html');
  if (doctypeStart !== -1) return text.slice(doctypeStart).trim();

  const htmlStart = text.indexOf('<html');
  if (htmlStart !== -1) return text.slice(htmlStart).trim();

  return text.trim();
}

function isCompleteHtml(html) {
  const h = (html || '').toLowerCase();
  return h.includes('</body>') && h.includes('</html>');
}

async function loadImageAsDataUrl(beforeImageUrl) {
  if (!beforeImageUrl) return null;

  if (beforeImageUrl.startsWith('data:')) {
    return beforeImageUrl;
  }

  if (
    beforeImageUrl.startsWith('http://') ||
    beforeImageUrl.startsWith('https://')
  ) {
    const response = await fetch(beforeImageUrl);
    if (!response.ok) return null;
    const mime = response.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }

  if (beforeImageUrl.startsWith('/')) {
    const localPath = path.join(
      projectRoot,
      'public',
      beforeImageUrl.replace(/^\//, ''),
    );
    const buffer = await readFile(localPath);
    const ext = path.extname(localPath).toLowerCase();
    const mime =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/png';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }

  return null;
}

function buildPrompt({ prompt, beforeCode }) {
  const sections = [
    'You are a senior UI engineer.',
    'Task: Apply the requested change to the given UI and return the updated full HTML only.',
    'Rules:',
    '- Return only HTML starting with <!DOCTYPE html>. No Markdown, no explanations.',
    '- Preserve ALL existing content and structure; do not remove sections. Only modify what the change requires.',
    '- Keep the layout mobile-first and consistent with the original.',
  ];
  const body = [
    `User change request:\n${prompt || '(no prompt provided)'}`,
    beforeCode
      ? `\nBefore HTML:\n${beforeCode}`
      : '\nBefore HTML: (not provided)',
  ];
  return `${sections.join('\n')}\n\n${body.join('\n')}`;
}

async function callOpenAI({ prompt, beforeCode, beforeImageUrl }) {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
  const imageDataUrl = await loadImageAsDataUrl(beforeImageUrl);
  const input = [
    {
      role: 'system',
      content: [{ type: 'input_text', text: 'You generate UI HTML edits.' }],
    },
    {
      role: 'user',
      content: [
        { type: 'input_text', text: buildPrompt({ prompt, beforeCode }) },
        ...(imageDataUrl
          ? [{ type: 'input_image', image_url: imageDataUrl }]
          : []),
      ],
    },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    signal: controller.signal,
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input,
      max_output_tokens: MAX_TOKENS,
    }),
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `OpenAI request failed (${response.status})`);
  }

  const payload = await response.json();
  const text = extractTextFromOpenAI(payload);
  // return extractHtml(text);

  let html = extractHtml(text);

  if (!isCompleteHtml(html)) {
    console.log('[generate] html incomplete, retrying…');
    // do a 2nd call:
    // "Return the FULL HTML again. Ensure it ends with </body></html>. No markdown."
    const text2 = await callOpenAI({ prompt, beforeCode, beforeImageUrl });
    html = extractHtml(text2);
  }
  return html;
}

async function callGemini({ prompt, beforeCode, beforeImageUrl }) {
  if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');
  const imageDataUrl = await loadImageAsDataUrl(beforeImageUrl);
  const parts = [{ text: buildPrompt({ prompt, beforeCode }) }];
  if (imageDataUrl) {
    const [header, data] = imageDataUrl.split(',', 2);
    const mime = header?.match(/data:(.*);base64/i)?.[1] || 'image/png';
    parts.push({ inline_data: { mime_type: mime, data } });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { maxOutputTokens: MAX_TOKENS },
      }),
    },
  );
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Gemini request failed (${response.status})`);
  }

  const payload = await response.json();
  const text = extractTextFromGemini(payload);
  // return extractHtml(text);

  let html = extractHtml(text);

  if (!isCompleteHtml(html)) {
    console.log('[generate] html incomplete, retrying…');
    // do a 2nd call:
    // "Return the FULL HTML again. Ensure it ends with </body></html>. No markdown."
    const text2 = await callOpenAI({ prompt, beforeCode, beforeImageUrl });
    html = extractHtml(text2);
  }
  return html;
}

async function callClaude({ prompt, beforeCode, beforeImageUrl }) {
  if (!ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');
  const imageDataUrl = await loadImageAsDataUrl(beforeImageUrl);
  const content = [{ type: 'text', text: buildPrompt({ prompt, beforeCode }) }];
  if (imageDataUrl) {
    const [header, data] = imageDataUrl.split(',', 2);
    const mime = header?.match(/data:(.*);base64/i)?.[1] || 'image/png';
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mime, data },
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    signal: controller.signal,
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content }],
    }),
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Claude request failed (${response.status})`);
  }

  const payload = await response.json();
  const text = extractTextFromClaude(payload);
  // return extractHtml(text);

  let html = extractHtml(text);

  if (!isCompleteHtml(html)) {
    console.log('[generate] html incomplete, retrying…');
    // do a 2nd call:
    // "Return the FULL HTML again. Ensure it ends with </body></html>. No markdown."
    const text2 = await callOpenAI({ prompt, beforeCode, beforeImageUrl });
    html = extractHtml(text2);
  }
  return html;
}

function getProviderAvailability() {
  return {
    openai: {
      available: Boolean(OPENAI_API_KEY),
      model: OPENAI_MODEL,
    },
    gemini: {
      available: Boolean(GEMINI_API_KEY),
      model: GEMINI_MODEL,
    },
    claude: {
      available: Boolean(ANTHROPIC_API_KEY),
      model: ANTHROPIC_MODEL,
    },
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
    });
    res.end('UI generation server running.');
    return;
  }

  if (req.url === '/status' && req.method === 'GET') {
    return sendJson(res, 200, {
      mode: 'live',
      providers: getProviderAvailability(),
    });
  }

  if (req.url !== '/generate' || req.method !== 'POST') {
    return sendJson(res, 404, { error: 'Not found' });
  }

  try {
    const startedAt = Date.now();
    const body = await readBody(req);
    const { prompt, beforeImageUrl, beforeCode, provider } = body || {};
    const chosen = (provider || PROVIDER_DEFAULT).toLowerCase();
    console.log(
      `[generate] provider=${chosen} promptLen=${(prompt || '').length}`,
    );

    let afterHtml = '';
    if (chosen === 'openai') {
      afterHtml = await callOpenAI({ prompt, beforeCode, beforeImageUrl });
    } else if (chosen === 'gemini') {
      afterHtml = await callGemini({ prompt, beforeCode, beforeImageUrl });
    } else if (chosen === 'claude' || chosen === 'anthropic') {
      afterHtml = await callClaude({ prompt, beforeCode, beforeImageUrl });
    } else {
      return sendJson(res, 400, { error: `Unknown provider: ${chosen}` });
    }

    const preview = (afterHtml || '').slice(0, 200).replace(/\s+/g, ' ');
    console.log(
      `[generate] provider=${chosen} done in ${Date.now() - startedAt}ms, htmlLen=${afterHtml?.length || 0}, preview=${preview}`,
    );
    try {
      await import('fs').then((fs) =>
        fs.writeFileSync(
          `${DEBUG_WRITE_PATH}-${chosen}.html`,
          afterHtml || '',
          'utf8',
        ),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Failed to write debug html', err);
    }
    return sendJson(res, 200, { afterHtml });
  } catch (err) {
    if (err?.name === 'AbortError') {
      return sendJson(res, 504, {
        error: `Provider timed out after ${PROVIDER_TIMEOUT_MS / 1000}s.`,
      });
    }
    return sendJson(res, 500, { error: err?.message || 'Server error' });
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`UI generation server running on http://localhost:${PORT}`);
});
