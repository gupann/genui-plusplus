import { completeSession } from '../../server/sessionStore.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, snapshot } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    const session = await completeSession({ sessionId, snapshot });
    return res.status(200).json({ session });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
