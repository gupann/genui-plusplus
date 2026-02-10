/**
 * Service to generate the "after" screen from the user's prompt and the before screen.
 * Replace the implementation with your Figma Make / Stitch / backend API.
 *
 * Expected backend contract:
 * - Input: { taskId, prompt, beforeImageUrl? or beforeCode?, ... }
 * - Output: { afterImageUrl?, afterHtml?, afterCode? } so we can render the result
 */

const MOCK_DELAY_MS = 1500

/**
 * Generate the after screen. Replace this with a real API call.
 * @param {object} params
 * @param {number} params.taskId - Case study id (1, 2, 3)
 * @param {string} params.prompt - User's fix prompt
 * @param {string} [params.beforeImageUrl] - URL of the before screenshot (if you send image)
 * @param {string} [params.beforeCode] - HTML/code of the before screen (if you send code)
 * @returns {Promise<{ afterImageUrl?: string, afterHtml?: string, afterCode?: string }>}
 */
export async function generateAfterScreen({ taskId, prompt, beforeImageUrl, beforeCode }) {
  // --- Replace this block with your actual API call ---
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS))

  // Mock: return a simple "after" HTML so the app works without a backend.
  // In production, your API would return afterImageUrl (screenshot URL) or afterHtml/afterCode.
  const mockAfterHtml = `
    <div style="font-family: system-ui; padding: 24px; max-width: 400px; margin: 0 auto; background: #fff; color: #111;">
      <h2 style="margin-top: 0;">After screen (mock)</h2>
      <p>Task ${taskId}. Your prompt was used to generate this screen.</p>
      <p><strong>Your prompt:</strong> "${(prompt || '').slice(0, 80)}${(prompt || '').length > 80 ? '…' : ''}"</p>
      <p>Replace <code>src/services/api.js</code> with a call to Figma Make / Stitch / your backend to show the real result here.</p>
    </div>
  `

  return {
    afterHtml: mockAfterHtml,
    // afterImageUrl: 'https://...',  // if your API returns a screenshot URL
  }
  // --- End replace block ---
}

/**
 * Optional: submit final feedback to your backend for analysis.
 */
export async function submitFeedback({ taskId, prompt, feedback }) {
  // POST to your backend, or log. Example:
  console.log('Feedback', { taskId, prompt, feedback })
  return { ok: true }
}
