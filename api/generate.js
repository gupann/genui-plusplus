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
