import { useEffect, useMemo, useState } from 'react';
import IterationShell from './IterationShell';
import {
  loadParticipantProfile,
  upsertParticipantProfile,
} from '../../services/sessionApi';
import { getCurrentParticipant } from '../../services/participantSession';

const APP_TYPES = [
  'Social Media',
  'E-commerce',
  'Streaming Media',
  'News / Publishing',
  'Finance / Banking',
  'Productivity',
  'Health / Fitness',
  'Travel / Booking',
  'Food Delivery',
  'Maps / Navigation',
];

const INTENTS = [
  'Onboarding',
  'Browse',
  'Search',
  'Discover',
  'Detail / View',
  'Create',
  'Edit',
  'Interact',
  'Transact',
  'Monitor',
  'Configure',
  'System Feedback',
];

function getCaseTitle(intent, appType) {
  return `${intent} x ${appType}`;
}

function normalizeCaseKey(title) {
  return (title || '').trim().toLowerCase();
}

export default function Iteration2HybridEval() {
  const [participant, setParticipant] = useState(null);
  const [profile, setProfile] = useState(null);
  const [intent, setIntent] = useState(INTENTS[0]);
  const [appType, setAppType] = useState(APP_TYPES[0]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const access = await getCurrentParticipant();
      if (!access?.participantId) {
        throw new Error('Please sign in to use Iteration #2.');
      }
      if (cancelled) return;
      setParticipant(access);
      const loaded = await loadParticipantProfile({
        participantId: access.participantId,
        email: access.email || '',
      });
      if (cancelled) return;
      const loadedProfile = loaded?.profile || {};
      const loadedCases = Array.isArray(loadedProfile?.extra?.iteration2Cases)
        ? loadedProfile.extra.iteration2Cases
        : Array.isArray(loadedProfile?.extra?.stage2Cases)
          ? loadedProfile.extra.stage2Cases
          : [];
      setProfile(loadedProfile);
      setCases(loadedCases);
      setLoading(false);
    }

    load()
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load Iteration #2 data.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const pendingCaseTitle = useMemo(
    () => getCaseTitle(intent, appType),
    [intent, appType],
  );

  const pendingCaseExists = cases.some(
    (entry) => normalizeCaseKey(entry?.title) === normalizeCaseKey(pendingCaseTitle),
  );

  async function persistCases(nextCases) {
    if (!participant?.participantId) return;
    setSaving(true);
    setError('');
    try {
      const existingProfile = profile || {};
      const existingExtra = existingProfile.extra || {};
      const payload = {
        name: existingProfile.name || '',
        currentProfession: existingProfile.currentProfession || '',
        pastWork: existingProfile.pastWork || '',
        extra: {
          ...existingExtra,
          iteration2Cases: nextCases,
          // Backward compatibility for data saved before the iterations rename.
          stage2Cases: nextCases,
        },
      };
      await upsertParticipantProfile({
        participantId: participant.participantId,
        email: participant.email || '',
        profile: payload,
      });
      setProfile(payload);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err?.message || 'Failed to save Iteration #2 case studies.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCase() {
    if (!intent || !appType) return;
    const title = getCaseTitle(intent, appType);
    if (cases.some((entry) => normalizeCaseKey(entry?.title) === normalizeCaseKey(title))) {
      setError('That case study already exists.');
      return;
    }
    const nextCases = [
      ...cases,
      {
        id: `s2_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        title,
        intent,
        appType,
        createdAt: new Date().toISOString(),
      },
    ];
    setCases(nextCases);
    await persistCases(nextCases);
  }

  return (
    <IterationShell
      title='Iteration #2: Human-corrected Hybrid Eval'
      description='Create dynamic case studies by selecting intent and app type. Saved cases persist for your user profile.'
    >
      <div className='iteration-card stage2-builder'>
        {loading ? (
          <p>Loading iteration setup...</p>
        ) : (
          <>
            <div className='stage2-controls'>
              <label className='stage2-field'>
                <span className='stage2-label'>Intent</span>
                <select
                  className='stage2-select'
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                >
                  {INTENTS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className='stage2-field'>
                <span className='stage2-label'>App Type</span>
                <select
                  className='stage2-select'
                  value={appType}
                  onChange={(e) => setAppType(e.target.value)}
                >
                  {APP_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className='stage2-actions'>
              <button
                type='button'
                className='stage2-create-btn'
                onClick={() => {
                  void handleCreateCase();
                }}
                disabled={saving || pendingCaseExists}
              >
                {pendingCaseExists
                  ? 'Case already exists'
                  : saving
                    ? 'Saving...'
                    : `Create "${pendingCaseTitle}"`}
              </button>
            </div>

            {savedAt && (
              <p className='stage2-meta'>Saved at {savedAt}. Cases persist for your user.</p>
            )}
            {error && <p className='stage2-meta stage2-meta--error'>{error}</p>}

            <div className='stage2-case-list'>
              <h2>Your Iteration #2 Case Studies</h2>
              {cases.length === 0 ? (
                <p className='stage2-empty'>
                  No cases yet. Choose an intent and app type to create your first
                  case study button.
                </p>
              ) : (
                <div className='stage2-cards'>
                  {cases.map((entry) => (
                    <button key={entry.id} type='button' className='stage2-case-btn'>
                      {entry.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <style>{`
        .stage2-builder {
          display: grid;
          gap: 1rem;
        }
        .stage2-controls {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }
        .stage2-field {
          display: grid;
          gap: 0.45rem;
        }
        .stage2-label {
          color: var(--muted);
          font-size: 0.88rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .stage2-select {
          width: 100%;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          padding: 0.7rem 0.85rem;
        }
        .stage2-select:focus {
          outline: none;
          border-color: var(--accent);
        }
        .stage2-create-btn {
          border: none;
          border-radius: var(--radius);
          background: var(--accent);
          color: #fff;
          padding: 0.72rem 1rem;
          font-weight: 600;
        }
        .stage2-create-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .stage2-meta {
          margin: 0;
          color: var(--muted);
          font-size: 0.9rem;
        }
        .stage2-meta--error {
          color: #fca5a5;
        }
        .stage2-case-list {
          display: grid;
          gap: 0.65rem;
        }
        .stage2-case-list h2 {
          margin: 0;
          font-size: 1.05rem;
        }
        .stage2-empty {
          margin: 0;
          color: var(--muted);
        }
        .stage2-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0.75rem;
        }
        .stage2-case-btn {
          text-align: left;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: rgba(148, 163, 184, 0.06);
          color: var(--text);
          padding: 0.8rem 0.9rem;
          font-weight: 500;
        }
        .stage2-case-btn:hover {
          border-color: var(--accent);
          background: rgba(99, 102, 241, 0.08);
        }
        @media (max-width: 820px) {
          .stage2-controls {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </IterationShell>
  );
}
