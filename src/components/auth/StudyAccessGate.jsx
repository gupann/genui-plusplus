import { useEffect, useState } from 'react';
import {
  loadParticipantProfile,
  upsertParticipantProfile,
} from '../../services/sessionApi';
import {
  getSupabaseClient,
  hasSupabaseClientConfig,
} from '../../services/supabaseClient';

const PARTICIPANT_STORAGE_KEY = 'genreui_study_participant_id';
const IS_DEV = import.meta.env.DEV;

function getOrCreateLocalParticipantId() {
  if (typeof window === 'undefined') return '';
  const existing = window.localStorage.getItem(PARTICIPANT_STORAGE_KEY);
  if (existing) return existing;
  const generated = `p_${crypto.randomUUID()}`;
  window.localStorage.setItem(PARTICIPANT_STORAGE_KEY, generated);
  return generated;
}

function requiredProfileComplete(profile) {
  const extra = profile?.extra || {};
  const hasAtLeastOneTool =
    Array.isArray(extra.primaryTools) && extra.primaryTools.length > 0;
  const hasCriteria =
    Array.isArray(extra.topCriteria) && extra.topCriteria.length > 0;
  return Boolean(
    profile?.name?.trim() &&
      profile?.currentProfession?.trim() &&
      extra?.yearsExperience &&
      extra?.productType &&
      extra?.industry &&
      extra?.changeFrequency &&
      hasAtLeastOneTool &&
      extra?.aiUsageFrequency &&
      extra?.biggestPain?.trim() &&
      extra?.biggestAiBlocker &&
      hasCriteria &&
      extra?.willingToResume &&
      extra?.consent === true,
  );
}

const TOOL_OPTIONS = [
  'Figma',
  'Sketch',
  'Adobe XD',
  'Framer',
  'Jira',
  'Linear',
  'Storybook',
  'Design system docs',
];

const INDUSTRY_OPTIONS = [
  'Consumer apps',
  'Enterprise/SaaS',
  'Fintech',
  'Healthcare',
  'E-commerce',
  'Education',
  'Other',
];

const CRITERIA_OPTIONS = [
  'Usability',
  'Visual clarity',
  'Consistency with design system',
  'Accessibility',
  'Implementation effort',
  'Business impact',
];

export default function StudyAccessGate({ children, onReady }) {
  const [status, setStatus] = useState('loading'); // loading | email | waiting | profile | ready | error
  const [email, setEmail] = useState('');
  const [participant, setParticipant] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    roleTitle: '',
    yearsExperience: '',
    productType: '',
    industry: '',
    changeFrequency: '',
    primaryTools: [],
    otherTools: '',
    aiToolsUsed: '',
    aiUsageFrequency: '',
    biggestPain: '',
    biggestAiBlocker: '',
    topCriteria: [],
    willingToResume: '',
    consent: false,
    portfolioUrl: '',
  });
  const [error, setError] = useState('');

  async function handleDevReset() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(PARTICIPANT_STORAGE_KEY);
      window.localStorage.removeItem('sb-localhost-auth-token');
      window.sessionStorage.clear();
    }
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    window.location.reload();
  }

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseClient();

    async function hydrateFromUser(user) {
      if (!user?.id) return;
      const nextEmail = user.email || '';
      const loaded = await loadParticipantProfile({
        participantId: user.id,
        email: nextEmail,
      });
      if (cancelled) return;
      const profile = loaded?.profile || {};
      setParticipant({
        id: user.id,
        email: nextEmail,
        profile,
      });
      const extra = profile?.extra || {};
      setProfileForm({
        name: profile?.name || '',
        roleTitle: profile?.currentProfession || '',
        yearsExperience: extra?.yearsExperience || '',
        productType: extra?.productType || '',
        industry: extra?.industry || '',
        changeFrequency: extra?.changeFrequency || '',
        primaryTools: Array.isArray(extra?.primaryTools)
          ? extra.primaryTools
          : [],
        otherTools: extra?.otherTools || '',
        aiToolsUsed: extra?.aiToolsUsed || '',
        aiUsageFrequency: extra?.aiUsageFrequency || '',
        biggestPain: extra?.biggestPain || '',
        biggestAiBlocker: extra?.biggestAiBlocker || '',
        topCriteria: Array.isArray(extra?.topCriteria) ? extra.topCriteria : [],
        willingToResume: extra?.willingToResume || '',
        consent: extra?.consent === true,
        portfolioUrl: extra?.portfolioUrl || '',
      });
      setStatus(requiredProfileComplete(profile) ? 'ready' : 'profile');
    }

    async function init() {
      if (!hasSupabaseClientConfig() || !supabase) {
        const localId = getOrCreateLocalParticipantId();
        if (cancelled) return;
        setParticipant({ id: localId, email: '', profile: {} });
        setStatus('ready');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session?.user) {
        await hydrateFromUser(session.user);
      } else {
        setStatus('email');
      }
    }

    init().catch((err) => {
      if (cancelled) return;
      setError(err?.message || 'Failed to load authentication state.');
      setStatus('error');
    });

    const { data: subscription } = supabase
      ? supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            hydrateFromUser(session.user).catch((err) => {
              setError(err?.message || 'Failed to load profile.');
              setStatus('error');
            });
          } else if (hasSupabaseClientConfig()) {
            setParticipant(null);
            setStatus('email');
          }
        })
      : { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      cancelled = true;
      subscription?.subscription?.unsubscribe?.();
      subscription?.unsubscribe?.();
    };
  }, []);

  async function handleEmailSubmit(event) {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setError('');
    const targetEmail = email.trim();
    if (!targetEmail) {
      setError('Please enter an email address.');
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        emailRedirectTo: window.location.href,
      },
    });

    if (signInError) {
      const rawMessage = signInError.message || 'Failed to send magic link.';
      if (rawMessage.toLowerCase().includes('rate limit')) {
        setError(
          'Email rate limit reached. Please wait about 60 seconds and try again, or use a different email.',
        );
        return;
      }
      setError(rawMessage);
      return;
    }

    setStatus('waiting');
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    if (!participant?.id) return;
    setError('');
    const payload = {
      name: profileForm.name.trim(),
      currentProfession: profileForm.roleTitle.trim(),
      pastWork: profileForm.biggestPain.trim(),
      extra: {
        yearsExperience: profileForm.yearsExperience,
        productType: profileForm.productType,
        industry: profileForm.industry,
        changeFrequency: profileForm.changeFrequency,
        primaryTools: profileForm.primaryTools,
        otherTools: profileForm.otherTools.trim(),
        aiToolsUsed: profileForm.aiToolsUsed.trim(),
        aiUsageFrequency: profileForm.aiUsageFrequency,
        biggestPain: profileForm.biggestPain.trim(),
        biggestAiBlocker: profileForm.biggestAiBlocker,
        topCriteria: profileForm.topCriteria,
        willingToResume: profileForm.willingToResume,
        consent: profileForm.consent === true,
        portfolioUrl: profileForm.portfolioUrl.trim(),
      },
    };
    if (!requiredProfileComplete(payload)) {
      setError('Please complete all required pre-study fields.');
      return;
    }
    await upsertParticipantProfile({
      participantId: participant.id,
      email: participant.email || '',
      profile: payload,
    });
    setParticipant((prev) => ({
      ...(prev || {}),
      profile: payload,
    }));
    setStatus('ready');
  }

  useEffect(() => {
    if (status !== 'ready' || !participant?.id) return;
    onReady?.({
      participantId: participant.id,
      email: participant.email || '',
      profile: participant.profile || {},
    });
  }, [status, participant, onReady]);

  if (status === 'ready' && participant?.id) {
    if (typeof children === 'function') {
      return children({
        participantId: participant.id,
        email: participant.email || '',
        profile: participant.profile || {},
      });
    }
    return null;
  }

  return (
    <div className='study study--centered study-access'>
      <div className='study__done study-access__card'>
        {IS_DEV && (
          <div className='study-access__dev-tools'>
            <div className='study-access__dev-box'>
              <button
                type='button'
                className='study__chip-btn'
                onClick={() => {
                  void handleDevReset();
                }}
              >
                Reset Demo State
              </button>
              <div className='study-access__dev-note'>Dev only</div>
            </div>
          </div>
        )}
        {status === 'loading' && (
          <>
            <h2>Loading…</h2>
            <p>Preparing your study session.</p>
          </>
        )}

        {status === 'email' && (
          <form onSubmit={handleEmailSubmit} className='study__form'>
            <h2>Sign In</h2>
            <p>Enter your email to receive a magic link.</p>
            <input
              className='study__input'
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='you@example.com'
              required
            />
            <button
              type='submit'
              className='study__btn study__btn--primary study-access__primary'
            >
              Send Magic Link
            </button>
          </form>
        )}

        {status === 'waiting' && (
          <>
            <h2>Check Your Email</h2>
            <p>Open the magic link to continue your study.</p>
          </>
        )}

        {status === 'profile' && (
          <form onSubmit={handleProfileSubmit} className='study__form study__form--survey'>
            <h2>Quick Profile</h2>
            <p>Pre-study survey (2-3 minutes).</p>
            <input
              className='study__input'
              type='text'
              value={profileForm.name}
              onChange={(e) =>
                setProfileForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder='Name'
              required
            />
            <input
              className='study__input'
              type='text'
              value={profileForm.roleTitle}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  roleTitle: e.target.value,
                }))
              }
              placeholder='Current role/title'
              required
            />
            <select
              className='study__input'
              value={profileForm.yearsExperience}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  yearsExperience: e.target.value,
                }))
              }
              required
            >
              <option value=''>Years of design experience</option>
              <option value='<1'>Less than 1 year</option>
              <option value='1-3'>1-3 years</option>
              <option value='4-7'>4-7 years</option>
              <option value='8-12'>8-12 years</option>
              <option value='13+'>13+ years</option>
            </select>
            <select
              className='study__input'
              value={profileForm.productType}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  productType: e.target.value,
                }))
              }
              required
            >
              <option value=''>Main product type</option>
              <option value='Mobile app'>Mobile app</option>
              <option value='Web app'>Web app</option>
              <option value='Responsive web'>Responsive web</option>
              <option value='Mixed'>Mixed</option>
            </select>
            <select
              className='study__input'
              value={profileForm.industry}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  industry: e.target.value,
                }))
              }
              required
            >
              <option value=''>Industry/domain</option>
              {INDUSTRY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              className='study__input'
              value={profileForm.changeFrequency}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  changeFrequency: e.target.value,
                }))
              }
              required
            >
              <option value=''>Incremental changes vs redesigns</option>
              <option value='Mostly incremental changes'>
                Mostly incremental changes
              </option>
              <option value='Balanced'>Balanced</option>
              <option value='Mostly larger redesigns'>
                Mostly larger redesigns
              </option>
            </select>
            <fieldset className='study__fieldset-inline'>
              <legend className='study__field-label'>
                Primary tools used (pick all that apply)
              </legend>
              <div className='study__checks'>
                {TOOL_OPTIONS.map((tool) => (
                  <label key={tool} className='study__check'>
                    <input
                      type='checkbox'
                      checked={profileForm.primaryTools.includes(tool)}
                      onChange={(e) => {
                        setProfileForm((prev) => {
                          const nextSet = new Set(prev.primaryTools);
                          if (e.target.checked) nextSet.add(tool);
                          else nextSet.delete(tool);
                          return { ...prev, primaryTools: Array.from(nextSet) };
                        });
                      }}
                    />
                    <span>{tool}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <input
              className='study__input'
              type='text'
              value={profileForm.otherTools}
              onChange={(e) =>
                setProfileForm((prev) => ({ ...prev, otherTools: e.target.value }))
              }
              placeholder='Other tools (optional)'
            />
            <input
              className='study__input'
              type='text'
              value={profileForm.aiToolsUsed}
              onChange={(e) =>
                setProfileForm((prev) => ({ ...prev, aiToolsUsed: e.target.value }))
              }
              placeholder='AI tools currently used (optional)'
            />
            <select
              className='study__input'
              value={profileForm.aiUsageFrequency}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  aiUsageFrequency: e.target.value,
                }))
              }
              required
            >
              <option value=''>AI usage frequency in your workflow</option>
              <option value='Never'>Never</option>
              <option value='Rarely'>Rarely</option>
              <option value='Sometimes'>Sometimes</option>
              <option value='Often'>Often</option>
              <option value='Daily'>Daily</option>
            </select>
            <textarea
              className='study__textarea'
              value={profileForm.biggestPain}
              onChange={(e) =>
                setProfileForm((prev) => ({ ...prev, biggestPain: e.target.value }))
              }
              rows={3}
              placeholder='Biggest pain point in small UI changes'
              required
            />
            <select
              className='study__input'
              value={profileForm.biggestAiBlocker}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  biggestAiBlocker: e.target.value,
                }))
              }
              required
            >
              <option value=''>Biggest blocker to using AI more</option>
              <option value='Output quality'>Output quality</option>
              <option value='Trust/reliability'>Trust/reliability</option>
              <option value='Speed'>Speed</option>
              <option value='Privacy/security'>Privacy/security</option>
              <option value='Policy restrictions'>Policy restrictions</option>
              <option value='Cost'>Cost</option>
            </select>
            <fieldset className='study__fieldset-inline'>
              <legend className='study__field-label'>
                Top quality criteria (pick up to 3)
              </legend>
              <div className='study__checks'>
                {CRITERIA_OPTIONS.map((criterion) => (
                  <label key={criterion} className='study__check'>
                    <input
                      type='checkbox'
                      checked={profileForm.topCriteria.includes(criterion)}
                      onChange={(e) => {
                        setProfileForm((prev) => {
                          const nextSet = new Set(prev.topCriteria);
                          if (e.target.checked) {
                            if (nextSet.size >= 3) return prev;
                            nextSet.add(criterion);
                          } else {
                            nextSet.delete(criterion);
                          }
                          return { ...prev, topCriteria: Array.from(nextSet) };
                        });
                      }}
                    />
                    <span>{criterion}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <select
              className='study__input'
              value={profileForm.willingToResume}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  willingToResume: e.target.value,
                }))
              }
              required
            >
              <option value=''>Willing to return later and resume?</option>
              <option value='Yes'>Yes</option>
              <option value='No'>No</option>
            </select>
            <input
              className='study__input'
              type='url'
              value={profileForm.portfolioUrl}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  portfolioUrl: e.target.value,
                }))
              }
              placeholder='Portfolio/LinkedIn (optional)'
            />
            <label className='study__check study__check--consent'>
              <input
                type='checkbox'
                checked={profileForm.consent}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, consent: e.target.checked }))
                }
              />
              <span>I consent to participate and store anonymized responses.</span>
            </label>
            <button
              type='submit'
              className='study__btn study__btn--primary study-access__primary'
            >
              Continue
            </button>
          </form>
        )}

        {status === 'error' && (
          <>
            <h2>Something Went Wrong</h2>
            <p>{error || 'Unable to initialize access.'}</p>
          </>
        )}

        {error && status !== 'error' && <p className='study__error-text'>{error}</p>}
      </div>
      <style>{`
        .study-access {
          width: 100%;
          min-height: calc(100vh - 92px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.25rem;
        }
        .study-access__card {
          width: min(560px, 92vw);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 1.5rem;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
        }
        .study-access__dev-tools {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 0.75rem;
        }
        .study-access__dev-box {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
        }
        .study-access__dev-note {
          font-size: 0.75rem;
          color: var(--muted);
        }
        .study__form {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          align-items: flex-start;
        }
        .study__form--survey {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem 1rem;
          align-items: start;
        }
        .study__form--survey h2,
        .study__form--survey p,
        .study__form--survey .study__fieldset-inline,
        .study__form--survey .study__textarea,
        .study__form--survey .study__check--consent,
        .study__form--survey .study-access__primary {
          grid-column: 1 / -1;
        }
        .study__form p {
          margin: 0;
          color: var(--muted);
        }
        .study__input {
          width: min(360px, 100%);
          padding: 0.75rem 1rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text);
          font-size: 1rem;
        }
        .study__textarea {
          width: min(460px, 100%);
          padding: 0.75rem 1rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text);
          font-size: 1rem;
          resize: vertical;
        }
        .study__form--survey .study__input,
        .study__form--survey .study__textarea,
        .study__form--survey .study__fieldset-inline,
        .study__form--survey .study__check--consent {
          width: 100%;
          max-width: none;
        }
        .study__fieldset-inline {
          width: min(460px, 100%);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.75rem;
          margin: 0;
        }
        .study__field-label {
          font-size: 0.86rem;
          color: var(--muted);
          padding: 0 0.35rem;
        }
        .study__checks {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 0.45rem 0.75rem;
          margin-top: 0.35rem;
        }
        .study__check {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.92rem;
        }
        .study__check--consent {
          width: min(460px, 100%);
          margin-top: 0.25rem;
        }
        .study__input:focus {
          outline: none;
          border-color: var(--accent);
        }
        .study__textarea:focus {
          outline: none;
          border-color: var(--accent);
        }
        .study-access__primary {
          min-width: 170px;
          width: auto;
        }
        .study__form--survey .study-access__primary {
          justify-self: start;
        }
        .study__error-text {
          color: #fca5a5;
          margin: 0.5rem 0 0;
        }
        @media (max-width: 720px) {
          .study-access {
            min-height: calc(100vh - 68px);
            align-items: flex-start;
            padding: 1rem;
          }
          .study-access__card {
            width: 100%;
            padding: 1rem;
            margin-top: 0.5rem;
          }
          .study__input,
          .study__textarea {
            width: 100%;
          }
          .study__form--survey {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
