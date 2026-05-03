import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

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
const PROVIDER_TIMEOUT_MS = parseInt(
  process.env.UI_PROVIDER_TIMEOUT_MS || '45000',
  10,
);

export function getDefaultProvider() {
  return PROVIDER_DEFAULT;
}

export function extractTextFromOpenAI(payload) {
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

export function extractTextFromGemini(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join('\n');
  return text || '';
}

export function extractTextFromClaude(payload) {
  const content = Array.isArray(payload?.content) ? payload.content : [];
  return content
    .map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function extractHtml(text) {
  if (!text) return '';
  const fenced = text.match(/```html\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const doctypeStart = text.toLowerCase().indexOf('<!doctype html');
  if (doctypeStart !== -1) return text.slice(doctypeStart).trim();

  const htmlStart = text.indexOf('<html');
  if (htmlStart !== -1) return text.slice(htmlStart).trim();

  return text.trim();
}

export function isCompleteHtml(html) {
  const h = (html || '').toLowerCase();
  return h.includes('</body>') && h.includes('</html>');
}

const BLOCK_RE = /<<<FIND>>>\r?\n([\s\S]*?)\r?\n<<<REPLACE>>>\r?\n([\s\S]*?)\r?\n<<<END>>>/g;

export function parseEditBlocks(raw) {
  const blocks = [];
  BLOCK_RE.lastIndex = 0;
  let match;
  while ((match = BLOCK_RE.exec(raw)) !== null) {
    blocks.push({ find: match[1], replace: match[2] });
  }
  return blocks;
}

// If the model stripped leading indentation from every line of the find string,
// re-indent it to match what's actually in the source before giving up.
function reindentFind(find, html) {
  const lines = find.split('\n');
  if (lines.length < 2) return null;

  // Find the first non-empty line of the find string and locate it in the HTML.
  const firstNonEmpty = lines.find((l) => l.trim());
  if (!firstNonEmpty) return null;

  const idx = html.indexOf(firstNonEmpty.trim());
  if (idx === -1) return null;

  // Count how many spaces/tabs precede that match in the HTML.
  let lineStart = idx;
  while (lineStart > 0 && html[lineStart - 1] !== '\n') lineStart--;
  const indent = html.slice(lineStart, idx).match(/^[\t ]*/)?.[0] ?? '';
  if (!indent) return null;

  // Prepend that indent to every non-empty line.
  const reindented = lines
    .map((l) => (l.trim() ? indent + l.trimStart() : l))
    .join('\n');
  return reindented === find ? null : reindented;
}

export function applyEdits(html, blocks) {
  let result = html;
  for (const { find, replace } of blocks) {
    if (result.includes(find)) {
      result = result.replace(find, () => replace);
    } else {
      // Fallback: try re-indenting the find string to match the source indentation.
      const reindented = reindentFind(find, result);
      if (reindented && result.includes(reindented)) {
        console.warn(`[applyEdits] matched after re-indent: "${find.slice(0, 60).replace(/\n/g, '↵')}"`);
        result = result.replace(reindented, () => replace);
      } else {
        console.warn(`[applyEdits] no match for: "${find.slice(0, 80).replace(/\n/g, '↵')}"`);
      }
    }
  }
  return result;
}

export async function loadImageAsDataUrl(beforeImageUrl) {
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

export function buildPrompt({ prompt, beforeCode, renderSpec }) {
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

export async function callOpenAI({
  prompt,
  beforeCode,
  beforeImageUrl,
  renderSpec,
}) {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

  const input = [
    {
      role: 'system',
      content: [
        {
          type: 'input_text',
          text: 'You convert a designer issue into a concrete UI revision and apply it. Return only full HTML.',
        },
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: buildPrompt({ prompt, beforeCode, renderSpec }),
        },
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

export async function callGemini({
  prompt,
  beforeCode,
  beforeImageUrl,
  renderSpec,
}) {
  if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');

  const parts = [{ text: buildPrompt({ prompt, beforeCode, renderSpec }) }];

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

export async function callClaude({
  prompt,
  beforeCode,
  beforeImageUrl,
  renderSpec,
}) {
  if (!ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');

  const content = [
    { type: 'text', text: buildPrompt({ prompt, beforeCode, renderSpec }) },
  ];

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

export function getProviderAvailability() {
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
