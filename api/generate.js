// function escapeHtml(str = '') {
//   return String(str)
//     .replace(/&/g, '&amp;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;')
//     .replace(/"/g, '&quot;')
//     .replace(/'/g, '&#39;');
// }

// export default async function handler(req, res) {
//   if (req.method !== 'POST') {
//     return res.status(405).send('Method not allowed');
//   }

//   try {
//     const { taskId, prompt, beforeImageUrl, beforeCode, provider, renderSpec } =
//       req.body || {};

//     if (!prompt) {
//       return res.status(400).send('Missing prompt');
//     }

//     if (!provider) {
//       return res.status(400).send('Missing provider');
//     }

//     if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
//       return res.status(500).send('OPENAI_API_KEY is not set');
//     }

//     if (provider === 'claude' && !process.env.ANTHROPIC_API_KEY) {
//       return res.status(500).send('ANTHROPIC_API_KEY is not set');
//     }

//     if (provider === 'gemini' && !process.env.GEMINI_API_KEY) {
//       return res.status(500).send('GEMINI_API_KEY is not set');
//     }

//     const safePrompt = escapeHtml(prompt);

//     const afterHtml = `
//         <div style="font-family: Inter, system-ui, sans-serif; min-height: 100vh; background: #f8fafc; color: #0f172a; padding: 24px; box-sizing: border-box;">
//           <div style="max-width: 420px; margin: 0 auto; background: white; border-radius: 24px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
//             <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">Provider: ${escapeHtml(provider)}</div>
//             <h1 style="font-size: 24px; line-height: 1.2; margin: 0 0 12px;">Generated UI placeholder</h1>
//             <p style="margin: 0 0 12px; color: #334155;">Task ${taskId ?? 'N/A'}</p>
//             <div style="padding: 14px; border-radius: 16px; background: #eff6ff; color: #1e3a8a; margin-bottom: 16px;">
//               ${safePrompt}
//             </div>
//             <button style="width: 100%; border: 0; border-radius: 14px; padding: 14px 16px; background: #2563eb; color: white; font-weight: 600; cursor: pointer;">
//               Example CTA
//             </button>
//             <div style="margin-top: 16px; font-size: 12px; color: #64748b;">
//               beforeImageUrl: ${beforeImageUrl ? 'yes' : 'no'}<br/>
//               beforeCode: ${beforeCode ? 'yes' : 'no'}<br/>
//               renderSpec: ${escapeHtml(JSON.stringify(renderSpec || {}))}
//             </div>
//           </div>
//         </div>
//       `;

//     return res.status(200).json({
//       afterHtml,
//       afterCode: afterHtml,
//       afterImageUrl: null,
//     });
//   } catch (err) {
//     console.error('generate error', err);
//     return res.status(500).send(err?.message || 'Internal server error');
//   }
// }

import {
  callOpenAI,
  callGemini,
  callClaude,
  getDefaultProvider,
} from '../server/core.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, beforeImageUrl, beforeCode, provider, renderSpec } =
      req.body || {};

    const chosen = (provider || getDefaultProvider()).toLowerCase();

    let afterHtml = '';

    if (chosen === 'openai') {
      afterHtml = await callOpenAI({
        prompt,
        beforeCode,
        beforeImageUrl,
        renderSpec,
      });
    } else if (chosen === 'gemini') {
      afterHtml = await callGemini({
        prompt,
        beforeCode,
        beforeImageUrl,
        renderSpec,
      });
    } else if (chosen === 'claude' || chosen === 'anthropic') {
      afterHtml = await callClaude({
        prompt,
        beforeCode,
        beforeImageUrl,
        renderSpec,
      });
    } else {
      return res.status(400).json({ error: `Unknown provider: ${chosen}` });
    }

    return res.status(200).json({ afterHtml });
  } catch (err) {
    if (err?.name === 'AbortError') {
      return res.status(504).json({ error: 'Provider timed out.' });
    }
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
