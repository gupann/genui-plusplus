import {
  getParticipantProfile,
  upsertParticipant,
} from '../../server/sessionStore.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { participantId, email } = req.query || {};
    if (!participantId) {
      return res.status(400).json({ error: 'participantId is required' });
    }
    await upsertParticipant({ participantId, email });
    const profile = await getParticipantProfile({ participantId });
    return res.status(200).json({ profile });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
