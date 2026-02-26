/**
 * Service to generate the "after" screen from the user's prompt and the before screen.
 *
 * Configure:
 * - VITE_UI_GENERATION_API_URL: endpoint that accepts POST JSON
 *
 * Expected backend contract:
 * - Input: { taskId, prompt, beforeImageUrl?, beforeCode? }
 * - Output: { afterImageUrl?, afterHtml?, afterCode? }
 */

const MOCK_DELAY_MS = 1200;
const API_URL = (import.meta.env.VITE_UI_GENERATION_API_URL || '').trim();
// const REQUEST_TIMEOUT_MS = 45000;
const REQUEST_TIMEOUT_MS = 120000;

function getStatusUrl() {
  if (!API_URL) return '';
  try {
    const url = new URL(API_URL);
    url.pathname = '/status';
    url.search = '';
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Generate the after screen.
 * If VITE_UI_GENERATION_API_URL is set, the app will POST to that endpoint.
 * Otherwise it falls back to a local mock response.
 *
 * @param {object} params
 * @param {number} params.taskId
 * @param {string} params.prompt
 * @param {string} [params.beforeImageUrl]
 * @param {string} [params.beforeCode]
 * @returns {Promise<{ afterImageUrl?: string, afterHtml?: string, afterCode?: string }>}
 */
export async function generateAfterScreen({
  taskId,
  prompt,
  beforeImageUrl,
  beforeCode,
  provider,
}) {
  if (API_URL) {
    // eslint-disable-next-line no-console
    console.log('[generateAfterScreen] start', { provider, apiUrl: API_URL });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          prompt,
          beforeImageUrl,
          beforeCode,
          provider,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new Error(
          `Generation timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `Generation request failed (${response.status})`);
    }

    const payload = await response.json();
    // eslint-disable-next-line no-console
    console.log('[generateAfterScreen] done', { provider, ok: response.ok });
    return {
      afterImageUrl: payload.afterImageUrl,
      afterHtml: payload.afterHtml,
      afterCode: payload.afterCode,
    };
  }

  // Local mock fallback for offline/dev use
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));

  const promptPreview = (prompt || '').slice(0, 140);
  const codeStatus = beforeCode
    ? 'Before code attached.'
    : 'Before code not attached.';
  const mockAfterHtml = `
    <div style="font-family: Inter, system-ui, sans-serif; padding: 24px; max-width: 680px; margin: 0 auto; color: #111827;">
      <h2 style="margin: 0 0 8px;">Generated UI (mock)</h2>
      <p style="margin: 0 0 8px;">Task ${taskId}</p>
      <p style="margin: 0 0 12px;"><strong>Prompt:</strong> ${promptPreview}${(prompt || '').length > 140 ? '…' : ''}</p>
      <p style="margin: 0; color: #4b5563;">${codeStatus}</p>
      <p style="margin: 12px 0 0; color: #4b5563;">Set <code>VITE_UI_GENERATION_API_URL</code> to use your real generator.</p>
    </div>
  `;

  return { afterHtml: mockAfterHtml };
}

export async function getProviderStatus() {
  if (!API_URL) {
    return {
      mode: 'mock',
      providers: {
        openai: { available: true },
        gemini: { available: true },
        claude: { available: true },
      },
    };
  }
  const statusUrl = getStatusUrl();
  if (!statusUrl) throw new Error('Invalid VITE_UI_GENERATION_API_URL');
  const response = await fetch(statusUrl);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Status request failed (${response.status})`);
  }
  return response.json();
}

/**
 * Optional: submit final feedback to your backend for analysis.
 */
export async function submitFeedback({ taskId, prompt, feedback }) {
  // POST to your backend, or log. Example:
  console.log('Feedback', { taskId, prompt, feedback });
  return { ok: true };
}
