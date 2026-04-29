import http from 'http';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  completeSession,
  createSession,
  findSession,
  getParticipantProfile,
  listSessions,
  saveSession,
  upsertParticipant,
  upsertParticipantProfile,
} from './sessionStore.js';

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
  process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
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

function getCaseStudyDir(taskId) {
  return path.join(projectRoot, 'public', `case-study-${taskId}`);
}

async function persistGenerationArtifacts({
  taskId,
  changeId,
  provider,
  prompt,
  afterHtml,
}) {
  if (!taskId) return;

  const taskIdSafe = String(taskId).replace(/[^\w-]/g, '');
  const changeIdSafe = String(changeId || 1).replace(/[^\w-]/g, '');
  const providerSafe = String(provider || 'unknown').toLowerCase().replace(/[^\w-]/g, '');
  const caseStudyDir = getCaseStudyDir(taskIdSafe);

  await mkdir(caseStudyDir, { recursive: true });

  await Promise.all([
    writeFile(
      path.join(caseStudyDir, `task${taskIdSafe}-after-${providerSafe}.html`),
      afterHtml || '',
      'utf8',
    ),
    writeFile(
      path.join(caseStudyDir, `task${taskIdSafe}-revision-task-${changeIdSafe}.txt`),
      prompt || '',
      'utf8',
    ),
  ]);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

function getPathAndQuery(reqUrl) {
  try {
    const parsed = new URL(reqUrl || '/', 'http://localhost');
    return { path: parsed.pathname, query: parsed.searchParams };
  } catch {
    return { path: reqUrl || '/', query: new URLSearchParams() };
  }
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

const BLOCK_RE = /<<<FIND>>>\r?\n([\s\S]*?)\r?\n<<<REPLACE>>>\r?\n([\s\S]*?)\r?\n<<<END>>>/g;

function parseEditBlocks(raw) {
  const blocks = [];
  BLOCK_RE.lastIndex = 0;
  let match;
  while ((match = BLOCK_RE.exec(raw)) !== null) {
    blocks.push({ find: match[1], replace: match[2] });
  }
  return blocks;
}

function applyEdits(html, blocks) {
  let result = html;
  for (const { find, replace } of blocks) {
    if (result.includes(find)) {
      result = result.replace(find, () => replace);
    } else {
      console.warn(`[applyEdits] no match for: "${find.slice(0, 80).replace(/\n/g, '↵')}"`);
    }
  }
  return result;
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

function buildPrompt({ prompt, beforeCode, renderSpec }) {
  const cssWidth = renderSpec?.cssWidth || 375;
  const cssHeight = renderSpec?.cssHeight || 812;

  return `You are a senior UI engineer applying a targeted fix to a mobile HTML UI.

Your task: implement the designer-reported issue below as a minimal, surgical set of edits.

Designer issue:
${prompt || '(no issue provided)'}

Rules:
- Output ONLY edit blocks in the exact format shown below. No prose, no full HTML, nothing else.
- Each block contains the verbatim substring to find and what to replace it with.
- Copy ALL attribute values (src, href, class, style, etc.) character-for-character from the original — never retype or paraphrase them.
- Make as few blocks as needed. Do not reformat or restructure code outside the changed region.
- The FIND text must appear verbatim in the Before HTML or the edit will silently fail.
- If you need to change multiple disjoint regions, emit one block per region.
- Target phone viewport: ${cssWidth}x${cssHeight} CSS px.

Block format:
<<<FIND>>>
exact original text (may be multiline)
<<<REPLACE>>>
replacement text
<<<END>>>

Before HTML:
${beforeCode || '(not provided)'}`;
}

// function buildPrompt({ prompt, beforeCode, renderSpec }) {
//   const cssWidth = renderSpec?.cssWidth || 375;
//   const cssHeight = renderSpec?.cssHeight || 812;
//   const exportWidth = renderSpec?.exportWidth || 750;
//   const exportHeight = renderSpec?.exportHeight || 1624;

//   const sections = [
//     'You are a senior UI engineer.',

//     'Task:',
//     'You will be given a designer-provided issue.',
//     'First, rewrite it into a precise and concrete UI revision instruction.',
//     'Then apply that revision to the given UI and return the updated full HTML only.',

//     'Core Principles (in priority order):',
//     '1. Fully satisfy the requested change.',
//     '2. Preserve the existing UI’s visual style, user flow, and component hierarchy.',
//     '3. Modify only what is necessary to implement the change.',
//     '4. Avoid any unrelated changes.',

//     'Rewrite the issue into a concrete instruction that clearly specifies:',
//     '- Target element or screen region',
//     '- Exact placement of the change',
//     '- Component type (button, dropdown, modal, etc.)',
//     '- Interaction behavior (tap, scroll, expand, etc.)',
//     '- Default state (selected, collapsed, placeholder, etc.)',
//     '- Any relevant edge states (empty, loading, error) if applicable',
//     '- Visual/design consistency with surrounding UI',
//     '- Mobile responsiveness expectations',

//     'If details are missing:',
//     '- Infer the most reasonable solution based on the existing UI.',
//     '- Follow patterns already present in the screen.',
//     '- Prefer extending existing components instead of creating new structures.',

//     'Editing Rules:',
//     '- Preserve ALL existing content, layout, and structure unless the change explicitly requires modification.',
//     '- Do NOT redesign the entire screen.',
//     '- Do NOT reorganize unrelated sections.',
//     '- Do NOT change text, spacing, or styles outside the scope of the request.',
//     '- Keep unchanged areas identical.',

//     'Implementation Expectations:',
//     '- Ensure the new feature/change is fully functional and clearly visible.',
//     '- Maintain alignment, spacing, and consistency with existing components.',
//     '- Match existing styling (colors, typography, spacing, component patterns).',
//     '- Ensure the result remains mobile-first.',

//     `- Target phone viewport: ${cssWidth}x${cssHeight} CSS px.`,
//     `- If rendering image outputs, use ${exportWidth}x${exportHeight} px export resolution.`,

//     'Output Rules:',
//     '- Return ONLY HTML starting with <!DOCTYPE html>.',
//     '- No Markdown, no explanations, no comments.',
//   ];

//   const body = `
// Designer Issue:
// ${prompt}

// Current UI Code:
// ${beforeCode}
// `;

//   return sections.join('\n') + '\n\n' + body;
// }

async function callOpenAI({
  prompt,
  beforeCode,
  beforeImageUrl,
  renderSpec,
  finalPrompt,
}) {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
  // const imageDataUrl = await loadImageAsDataUrl(beforeImageUrl);
  const input = [
    {
      role: 'system',
      content: [
        {
          type: 'input_text',
          text: 'You apply targeted UI fixes as minimal edit blocks. Follow the format in the user prompt exactly.',
        },
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: finalPrompt || buildPrompt({ prompt, beforeCode, renderSpec }),
        },
        // TEMP: Disable before-image conditioning for OpenAI to compare results.
        // ...(imageDataUrl
        //   ? [{ type: 'input_image', image_url: imageDataUrl }]
        //   : []),
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
  const blocks = parseEditBlocks(text);
  if (blocks.length > 0) {
    console.log(`[generate/openai] applying ${blocks.length} edit block(s)`);
    return applyEdits(beforeCode || '', blocks);
  }
  console.warn('[generate/openai] no edit blocks found, falling back to full-HTML extraction');
  return extractHtml(text);
}

async function callGemini({
  prompt,
  beforeCode,
  beforeImageUrl,
  renderSpec,
  finalPrompt,
}) {
  if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');
  // const imageDataUrl = await loadImageAsDataUrl(beforeImageUrl);
  const parts = [
    { text: finalPrompt || buildPrompt({ prompt, beforeCode, renderSpec }) },
  ];

  // TEMP: Disable before-image conditioning for Gemini to compare results.
  // if (imageDataUrl) {
  //   const [header, data] = imageDataUrl.split(',', 2);
  //   const mime = header?.match(/data:(.*);base64/i)?.[1] || 'image/png';
  //   parts.push({ inline_data: { mime_type: mime, data } });
  // }

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
  const blocks = parseEditBlocks(text);
  if (blocks.length > 0) {
    console.log(`[generate/gemini] applying ${blocks.length} edit block(s)`);
    return applyEdits(beforeCode || '', blocks);
  }
  console.warn('[generate/gemini] no edit blocks found, falling back to full-HTML extraction');
  return extractHtml(text);
}

async function callClaude({
  prompt,
  beforeCode,
  beforeImageUrl,
  renderSpec,
  finalPrompt,
}) {
  if (!ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');
  // const imageDataUrl = await loadImageAsDataUrl(beforeImageUrl);
  const content = [
    {
      type: 'text',
      text: finalPrompt || buildPrompt({ prompt, beforeCode, renderSpec }),
    },
  ];
  // TEMP: Disable before-image conditioning for Claude to compare results.
  // if (imageDataUrl) {
  //   const [header, data] = imageDataUrl.split(',', 2);
  //   const mime = header?.match(/data:(.*);base64/i)?.[1] || 'image/png';
  //   content.push({
  //     type: 'image',
  //     source: { type: 'base64', media_type: mime, data },
  //   });
  // }

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
  const blocks = parseEditBlocks(text);
  if (blocks.length > 0) {
    console.log(`[generate/claude] applying ${blocks.length} edit block(s)`);
    return applyEdits(beforeCode || '', blocks);
  }
  console.warn('[generate/claude] no edit blocks found, falling back to full-HTML extraction');
  return extractHtml(text);
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

async function handleGenerateRequest(req, res) {
  try {
    const startedAt = Date.now();
    const body = await readBody(req);
    const { taskId, changeId, prompt, beforeImageUrl, beforeCode, provider, renderSpec } =
      body || {};
    const chosen = (provider || PROVIDER_DEFAULT).toLowerCase();
    const finalPrompt = buildPrompt({ prompt, beforeCode, renderSpec });
    console.log(
      `[generate] provider=${chosen} promptLen=${(prompt || '').length}`,
    );

    let afterHtml = '';
    if (chosen === 'openai') {
      afterHtml = await callOpenAI({
        prompt,
        beforeCode,
        beforeImageUrl,
        renderSpec,
        finalPrompt,
      });
    } else if (chosen === 'gemini') {
      afterHtml = await callGemini({
        prompt,
        beforeCode,
        beforeImageUrl,
        renderSpec,
        finalPrompt,
      });
    } else if (chosen === 'claude' || chosen === 'anthropic') {
      afterHtml = await callClaude({
        prompt,
        beforeCode,
        beforeImageUrl,
        renderSpec,
        finalPrompt,
      });
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
    try {
      await persistGenerationArtifacts({
        taskId,
        changeId,
        provider: chosen,
        prompt,
        afterHtml,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Failed to persist generation artifacts', err);
    }
    return sendJson(res, 200, { afterHtml, finalPrompt });
  } catch (err) {
    if (err?.name === 'AbortError') {
      return sendJson(res, 504, {
        error: `Provider timed out after ${PROVIDER_TIMEOUT_MS / 1000}s.`,
      });
    }
    return sendJson(res, 500, { error: err?.message || 'Server error' });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  const { path: routePath, query } = getPathAndQuery(req.url);
  const method = req.method || 'GET';

  if (routePath === '/' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
    });
    res.end('UI generation server running.');
    return;
  }

  if (
    (routePath === '/status' || routePath === '/api/status') &&
    method === 'GET'
  ) {
    return sendJson(res, 200, {
      mode: 'live',
      providers: getProviderAvailability(),
    });
  }

  if (
    (routePath === '/generate' || routePath === '/api/generate') &&
    method === 'POST'
  ) {
    return handleGenerateRequest(req, res);
  }

  if (routePath === '/api/session/load' && method === 'GET') {
    try {
      const participantId = query.get('participantId');
      const email = query.get('email') || '';
      const iterationId = query.get('iterationId') || query.get('stageId');
      const taskId = query.get('taskId');
      if (!participantId || !iterationId || !taskId) {
        return sendJson(res, 400, {
          error: 'participantId, iterationId, and taskId are required',
        });
      }
      await upsertParticipant({ participantId, email });
      const session = await findSession({ participantId, iterationId, taskId });
      return sendJson(res, 200, { session: session || null });
    } catch (err) {
      return sendJson(res, 500, { error: err?.message || 'Server error' });
    }
  }

  if (routePath === '/api/session/list' && method === 'GET') {
    try {
      const participantId = query.get('participantId');
      const iterationId = query.get('iterationId') || query.get('stageId');
      if (!participantId) {
        return sendJson(res, 400, {
          error: 'participantId is required',
        });
      }
      const sessions = await listSessions({ participantId, iterationId });
      return sendJson(res, 200, { sessions });
    } catch (err) {
      return sendJson(res, 500, { error: err?.message || 'Server error' });
    }
  }

  if (routePath === '/api/session/start' && method === 'POST') {
    try {
      const body = await readBody(req);
      const participantId = body.participantId;
      const email = body.email || '';
      const iterationId = body.iterationId || body.stageId;
      const taskId = body.taskId;
      const snapshot = body.snapshot;
      if (!participantId || !iterationId || !taskId) {
        return sendJson(res, 400, {
          error: 'participantId, iterationId, and taskId are required',
        });
      }

      await upsertParticipant({ participantId, email });
      const existing = await findSession({
        participantId,
        iterationId,
        taskId,
      });
      if (existing && existing.status !== 'completed') {
        return sendJson(res, 200, { session: existing, resumed: true });
      }
      const session = await createSession({
        participantId,
        iterationId,
        taskId,
        snapshot,
        status: 'in_progress',
      });
      return sendJson(res, 200, { session, resumed: false });
    } catch (err) {
      return sendJson(res, 500, { error: err?.message || 'Server error' });
    }
  }

  if (routePath === '/api/session/save' && method === 'POST') {
    try {
      const { sessionId, snapshot, status } = await readBody(req);
      if (!sessionId) {
        return sendJson(res, 400, { error: 'sessionId is required' });
      }
      const session = await saveSession({ sessionId, snapshot, status });
      return sendJson(res, 200, { session });
    } catch (err) {
      return sendJson(res, 500, { error: err?.message || 'Server error' });
    }
  }

  if (routePath === '/api/session/complete' && method === 'POST') {
    try {
      const { sessionId, snapshot } = await readBody(req);
      if (!sessionId) {
        return sendJson(res, 400, { error: 'sessionId is required' });
      }
      const session = await completeSession({ sessionId, snapshot });
      return sendJson(res, 200, { session });
    } catch (err) {
      return sendJson(res, 500, { error: err?.message || 'Server error' });
    }
  }

  if (routePath === '/api/participant/profile' && method === 'GET') {
    try {
      const participantId = query.get('participantId');
      const email = query.get('email') || '';
      if (!participantId) {
        return sendJson(res, 400, { error: 'participantId is required' });
      }
      await upsertParticipant({ participantId, email });
      const profile = await getParticipantProfile({ participantId });
      return sendJson(res, 200, { profile });
    } catch (err) {
      return sendJson(res, 500, { error: err?.message || 'Server error' });
    }
  }

  if (routePath === '/api/participant/upsert' && method === 'POST') {
    try {
      const { participantId, email, profile } = await readBody(req);
      if (!participantId) {
        return sendJson(res, 400, { error: 'participantId is required' });
      }
      const participant = await upsertParticipant({ participantId, email });
      const nextProfile =
        profile && typeof profile === 'object' && Object.keys(profile).length
          ? await upsertParticipantProfile({ participantId, profile })
          : await getParticipantProfile({ participantId });
      return sendJson(res, 200, {
        participant,
        profile: nextProfile,
      });
    } catch (err) {
      return sendJson(res, 500, { error: err?.message || 'Server error' });
    }
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`UI generation server running on http://localhost:${PORT}`);
});
