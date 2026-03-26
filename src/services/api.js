const API_URL = (
  import.meta.env.VITE_UI_GENERATION_API_URL || '/api/generate'
).trim();
const REQUEST_TIMEOUT_MS = 60000;

const PHONE_RENDER_SPEC = {
  cssWidth: 375,
  cssHeight: 812,
  exportWidth: 750,
  exportHeight: 1624,
  scale: 2,
};

function getStatusUrl() {
  if (!API_URL) return '';

  if (API_URL.startsWith('/api/')) return '/api/status';
  if (API_URL.startsWith('/')) return '/status';

  try {
    const url = new URL(API_URL);
    url.pathname = url.pathname.startsWith('/api/') ? '/api/status' : '/status';
    url.search = '';
    return url.toString();
  } catch {
    return '';
  }
}

function getGenerateUrl() {
  return API_URL || '/api/generate';
}

export async function generateAfterScreen({
  taskId,
  prompt,
  beforeImageUrl,
  beforeCode,
  provider,
}) {
  const targetUrl = getGenerateUrl();
  if (!targetUrl) {
    throw new Error('Generation API URL is not configured.');
  }

  console.log('[generateAfterScreen] start', { provider, apiUrl: targetUrl });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        prompt,
        beforeImageUrl,
        beforeCode,
        provider,
        renderSpec: PHONE_RENDER_SPEC,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Generation timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`);
    }
    throw new Error(
      `Network error calling ${targetUrl}: ${err?.message || 'Unknown error'}`,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Generation request failed (${response.status})`);
  }

  const payload = await response.json();

  console.log('[generateAfterScreen] done', { provider, ok: response.ok });

  return {
    afterImageUrl: payload.afterImageUrl,
    afterHtml: payload.afterHtml,
    afterCode: payload.afterCode,
  };
}

export async function getProviderStatus() {
  const statusUrl = getStatusUrl();
  if (!statusUrl) throw new Error('Invalid API URL');

  const response = await fetch(statusUrl, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Status request failed (${response.status})`);
  }

  return response.json();
}

export async function submitFeedback({ taskId, prompt, feedback }) {
  console.log('Feedback', { taskId, prompt, feedback });
  return { ok: true };
}
