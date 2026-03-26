import { findSession } from '../../server/sessionStore.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { participantId, stageId, taskId } = req.query || {};
    if (!participantId || !stageId || !taskId) {
      return res
        .status(400)
        .json({ error: 'participantId, stageId, and taskId are required' });
    }
    const session = await findSession({ participantId, stageId, taskId });
    return res.status(200).json({ session: session || null });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
