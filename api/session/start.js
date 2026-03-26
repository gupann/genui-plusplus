import {
  createSession,
  findSession,
  upsertParticipant,
} from '../../server/sessionStore.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { participantId, stageId, taskId, snapshot } = req.body || {};
    if (!participantId || !stageId || !taskId) {
      return res
        .status(400)
        .json({ error: 'participantId, stageId, and taskId are required' });
    }

    await upsertParticipant({ participantId });
    const existing = await findSession({ participantId, stageId, taskId });
    if (existing && existing.status !== 'completed') {
      return res.status(200).json({ session: existing, resumed: true });
    }

    const session = await createSession({
      participantId,
      stageId,
      taskId,
      snapshot,
      status: 'in_progress',
    });
    return res.status(200).json({ session, resumed: false });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
