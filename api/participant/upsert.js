import {
  getParticipantProfile,
  upsertParticipant,
  upsertParticipantProfile,
} from '../../server/sessionStore.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { participantId, email, profile } = req.body || {};
    if (!participantId) {
      return res.status(400).json({ error: 'participantId is required' });
    }

    const participant = await upsertParticipant({ participantId, email });
    let participantProfile = null;
    if (profile && typeof profile === 'object' && Object.keys(profile).length) {
      participantProfile = await upsertParticipantProfile({
        participantId,
        profile,
      });
    } else {
      participantProfile = await getParticipantProfile({ participantId });
    }

    return res.status(200).json({
      participant,
      profile: participantProfile,
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
