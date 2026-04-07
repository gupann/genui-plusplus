import { useEffect, useState } from 'react';
import IterationShell from './IterationShell';
import {
  loadParticipantProfile,
  upsertParticipantProfile,
} from '../../services/sessionApi';
import { getCurrentParticipant } from '../../services/participantSession';

const TOOL_OPTIONS = [
  'Figma',
  'Sketch',
  'Adobe XD',
  'Framer',
  'Webflow',
  'React / frontend code',
  'Storybook',
  'Jira',
  'Linear',
  'Notion',
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
  'Speed / iteration time',
  'Implementation effort',
  'Business impact',
];

const PAIN_OPTIONS = [
  'Maintaining consistency',
  'Finding where to make changes',
  'Updating multiple components',
  'Design ↔ code mismatch',
  'Slow iteration cycles',
  'Other',
];

const AI_USE_CASE_OPTIONS = [
  'Generating UI',
  'Editing UI',
  'Writing code',
  'Brainstorming ideas',
  'Not using AI',
];

function requiredProfileComplete(profile) {
  const extra = profile?.extra || {};
  const hasAtLeastOneTool =
    Array.isArray(extra.primaryTools) && extra.primaryTools.length > 0;
  const hasCriteria =
    Array.isArray(extra.topCriteria) && extra.topCriteria.length > 0;
  const hasPainAreas =
    Array.isArray(extra.painAreas) && extra.painAreas.length > 0;
  const hasAiUseCases =
    Array.isArray(extra.aiUseCases) && extra.aiUseCases.length > 0;
  return Boolean(
    profile?.name?.trim() &&
    profile?.currentProfession?.trim() &&
    extra?.yearsExperience &&
    extra?.productType &&
    extra?.industry &&
    extra?.changeFrequency &&
    extra?.changeOrigin &&
    extra?.implementsInCode &&
    extra?.iterationsPerChange &&
    extra?.designSystemMaturity &&
    extra?.confidenceInSmallChanges &&
    hasAtLeastOneTool &&
    extra?.aiUsageFrequency &&
    hasPainAreas &&
    extra?.biggestPainDetail?.trim() &&
    extra?.biggestAiBlocker &&
    hasCriteria &&
    hasAiUseCases &&
    extra?.portfolioUrl?.trim() &&
    extra?.consent === true,
  );
}

function toForm(profile) {
  const extra = profile?.extra || {};
  return {
    name: profile?.name || '',
    roleTitle: profile?.currentProfession || '',
    yearsExperience: extra?.yearsExperience || '',
    productType: extra?.productType || '',
    industry: extra?.industry || '',
    changeFrequency: extra?.changeFrequency || '',
    changeOrigin: extra?.changeOrigin || '',
    implementsInCode: extra?.implementsInCode || '',
    iterationsPerChange: extra?.iterationsPerChange || '',
    designSystemMaturity: extra?.designSystemMaturity || '',
    confidenceInSmallChanges: extra?.confidenceInSmallChanges || '',
    primaryTools: Array.isArray(extra?.primaryTools) ? extra.primaryTools : [],
    otherTools: extra?.otherTools || '',
    aiToolsUsed: extra?.aiToolsUsed || '',
    aiUsageFrequency: extra?.aiUsageFrequency || '',
    painAreas: Array.isArray(extra?.painAreas) ? extra.painAreas : [],
    painAreasOther: extra?.painAreasOther || '',
    biggestPainDetail: extra?.biggestPainDetail || profile?.pastWork || '',
    biggestAiBlocker: extra?.biggestAiBlocker || '',
    topCriteria: Array.isArray(extra?.topCriteria) ? extra.topCriteria : [],
    aiUseCases: Array.isArray(extra?.aiUseCases) ? extra.aiUseCases : [],
    consent: extra?.consent === true,
    portfolioUrl: extra?.portfolioUrl || '',
  };
}

function toPayload(form) {
  return {
    name: form.name.trim(),
    currentProfession: form.roleTitle.trim(),
    pastWork: form.biggestPainDetail.trim(),
    extra: {
      yearsExperience: form.yearsExperience,
      productType: form.productType,
      industry: form.industry,
      changeFrequency: form.changeFrequency,
      changeOrigin: form.changeOrigin,
      implementsInCode: form.implementsInCode,
      iterationsPerChange: form.iterationsPerChange,
      designSystemMaturity: form.designSystemMaturity,
      confidenceInSmallChanges: form.confidenceInSmallChanges,
      primaryTools: form.primaryTools,
      otherTools: form.otherTools.trim(),
      aiToolsUsed: form.aiToolsUsed.trim(),
      aiUsageFrequency: form.aiUsageFrequency,
      painAreas: form.painAreas,
      painAreasOther: form.painAreasOther.trim(),
      biggestPainDetail: form.biggestPainDetail.trim(),
      biggestAiBlocker: form.biggestAiBlocker,
      topCriteria: form.topCriteria,
      aiUseCases: form.aiUseCases,
      consent: form.consent === true,
      portfolioUrl: form.portfolioUrl.trim(),
    },
  };
}

export default function PreStudySurvey() {
  const [loading, setLoading] = useState(true);
  const [participant, setParticipant] = useState(null);
  const [form, setForm] = useState(toForm({}));
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const access = await getCurrentParticipant();
      if (!access?.participantId) {
        throw new Error('Please sign in before editing pre-study survey.');
      }
      if (cancelled) return;
      setParticipant(access);
      const loaded = await loadParticipantProfile({
        participantId: access.participantId,
        email: access.email || '',
      });
      if (cancelled) return;
      setForm(toForm(loaded?.profile || {}));
      setLoading(false);
    }
    load().catch((err) => {
      if (cancelled) return;
      setError(err?.message || 'Failed to load survey.');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!participant?.participantId) return;
    setError('');
    const payload = toPayload(form);
    if (!requiredProfileComplete(payload)) {
      setError('Please complete all required fields before saving.');
      return;
    }
    setSaving(true);
    try {
      await upsertParticipantProfile({
        participantId: participant.participantId,
        email: participant.email || '',
        profile: payload,
      });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err?.message || 'Failed to save survey.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <IterationShell
      title='Pre-study User Survey'
      description='Complete this once before or during your study. You can return later to edit your responses.'
    >
      <div className='iteration-card'>
        {loading ? (
          <p>Loading survey...</p>
        ) : (
          <form onSubmit={handleSubmit} className='survey-grid'>
            <h3 className='survey-section'>Background</h3>
            <label className='survey-label'>Name</label>
            <label className='survey-label'>Current role/title</label>
            <input
              className='survey-input'
              type='text'
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder='Name'
              required
            />
            <input
              className='survey-input'
              type='text'
              value={form.roleTitle}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, roleTitle: e.target.value }))
              }
              placeholder='Current role/title'
              required
            />

            <label className='survey-label'>Years of design experience</label>
            <label className='survey-label'>Main product type</label>
            <select
              className='survey-input'
              value={form.yearsExperience}
              onChange={(e) =>
                setForm((prev) => ({
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
              className='survey-input'
              value={form.productType}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, productType: e.target.value }))
              }
              required
            >
              <option value=''>Main product type</option>
              <option value='Mobile app'>Mobile app</option>
              <option value='Web app'>Web app</option>
              <option value='Responsive web'>Responsive web</option>
              <option value='Mixed'>Mixed</option>
            </select>

            <label className='survey-label'>Industry/domain</label>
            <label className='survey-label'>
              How is your work split between incremental updates and full
              redesigns?
            </label>
            <select
              className='survey-input'
              value={form.industry}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, industry: e.target.value }))
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
              className='survey-input'
              value={form.changeFrequency}
              onChange={(e) =>
                setForm((prev) => ({
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

            <h3 className='survey-section'>Workflow</h3>
            <label className='survey-label'>
              Where do UI changes usually start?
            </label>
            <label className='survey-label'>
              Do you implement UI changes in code?
            </label>
            <select
              className='survey-input'
              value={form.changeOrigin}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, changeOrigin: e.target.value }))
              }
              required
            >
              <option value=''>Select one</option>
              <option value='Designer (Figma)'>Designer (Figma)</option>
              <option value='PM / spec'>PM / spec</option>
              <option value='Developer'>Developer</option>
              <option value='Mixed'>Mixed</option>
            </select>
            <select
              className='survey-input'
              value={form.implementsInCode}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  implementsInCode: e.target.value,
                }))
              }
              required
            >
              <option value=''>Select one</option>
              <option value='Yes regularly'>Yes regularly</option>
              <option value='Sometimes'>Sometimes</option>
              <option value='No'>No</option>
            </select>

            <label className='survey-label'>
              How many iterations does a typical UI change go through?
            </label>
            <label className='survey-label'>
              Do you work with a design system?
            </label>
            <select
              className='survey-input'
              value={form.iterationsPerChange}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  iterationsPerChange: e.target.value,
                }))
              }
              required
            >
              <option value=''>Select one</option>
              <option value='1-2'>1-2</option>
              <option value='3-5'>3-5</option>
              <option value='5+'>5+</option>
            </select>
            <select
              className='survey-input'
              value={form.designSystemMaturity}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  designSystemMaturity: e.target.value,
                }))
              }
              required
            >
              <option value=''>Select one</option>
              <option value='No'>No</option>
              <option value='Basic (some components)'>
                Basic (some components)
              </option>
              <option value='Mature (fully standardized)'>
                Mature (fully standardized)
              </option>
            </select>

            <label className='survey-label'>
              How confident are you when making small UI changes?
            </label>
            <div />
            <select
              className='survey-input'
              value={form.confidenceInSmallChanges}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  confidenceInSmallChanges: e.target.value,
                }))
              }
              required
            >
              <option value=''>Select one</option>
              <option value='Low'>Low</option>
              <option value='Medium'>Medium</option>
              <option value='High'>High</option>
            </select>

            <h3 className='survey-section'>Tools</h3>
            <fieldset className='survey-fieldset survey-full'>
              <legend>Primary tools used (pick all that apply)</legend>
              <div className='survey-checks'>
                {TOOL_OPTIONS.map((tool) => (
                  <label key={tool} className='survey-check'>
                    <input
                      type='checkbox'
                      checked={form.primaryTools.includes(tool)}
                      onChange={(e) => {
                        setForm((prev) => {
                          const next = new Set(prev.primaryTools);
                          if (e.target.checked) next.add(tool);
                          else next.delete(tool);
                          return { ...prev, primaryTools: Array.from(next) };
                        });
                      }}
                    />
                    <span>{tool}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <input
              className='survey-input'
              type='text'
              value={form.otherTools}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, otherTools: e.target.value }))
              }
              placeholder='Other (optional)'
            />
            <input
              className='survey-input'
              type='text'
              value={form.aiToolsUsed}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, aiToolsUsed: e.target.value }))
              }
              placeholder='AI tools currently used (optional)'
            />

            <h3 className='survey-section'>Pain Points</h3>
            <fieldset className='survey-fieldset survey-full'>
              <legend>
                Biggest pain points in small UI changes (pick all that apply)
              </legend>
              <div className='survey-checks'>
                {PAIN_OPTIONS.map((option) => (
                  <label key={option} className='survey-check'>
                    <input
                      type='checkbox'
                      checked={form.painAreas.includes(option)}
                      onChange={(e) => {
                        setForm((prev) => {
                          const next = new Set(prev.painAreas);
                          if (e.target.checked) next.add(option);
                          else next.delete(option);
                          return { ...prev, painAreas: Array.from(next) };
                        });
                      }}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {form.painAreas.includes('Other') && (
              <input
                className='survey-input survey-full'
                type='text'
                value={form.painAreasOther}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    painAreasOther: e.target.value,
                  }))
                }
                placeholder='Other pain point'
              />
            )}
            <label className='survey-label survey-full'>
              Biggest pain point details (open-ended)
            </label>
            <textarea
              className='survey-input survey-textarea survey-full'
              value={form.biggestPainDetail}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  biggestPainDetail: e.target.value,
                }))
              }
              rows={3}
              placeholder='Describe your biggest friction with small UI changes.'
              required
            />

            <h3 className='survey-section'>AI Usage</h3>
            <label className='survey-label'>AI usage frequency</label>
            <label className='survey-label'>
              Biggest blocker to using AI more
            </label>
            <select
              className='survey-input'
              value={form.aiUsageFrequency}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  aiUsageFrequency: e.target.value,
                }))
              }
              required
            >
              <option value=''>AI usage frequency in your workflow</option>
              <option value='Never'>Never</option>
              <option value='Rarely'>Rarely</option>
              <option value='Weekly'>Weekly</option>
              <option value='Daily'>Daily</option>
              <option value='Multiple times per day'>
                Multiple times per day
              </option>
            </select>
            <select
              className='survey-input'
              value={form.biggestAiBlocker}
              onChange={(e) =>
                setForm((prev) => ({
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

            <fieldset className='survey-fieldset survey-full'>
              <legend>What do you currently use AI for in UI work?</legend>
              <div className='survey-checks'>
                {AI_USE_CASE_OPTIONS.map((option) => (
                  <label key={option} className='survey-check'>
                    <input
                      type='checkbox'
                      checked={form.aiUseCases.includes(option)}
                      onChange={(e) => {
                        setForm((prev) => {
                          const next = new Set(prev.aiUseCases);
                          if (e.target.checked) next.add(option);
                          else next.delete(option);
                          return { ...prev, aiUseCases: Array.from(next) };
                        });
                      }}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className='survey-fieldset survey-full'>
              <legend>
                What matters most when evaluating a UI change? (pick up to 3)
              </legend>
              <div className='survey-checks'>
                {CRITERIA_OPTIONS.map((criterion) => (
                  <label key={criterion} className='survey-check'>
                    <input
                      type='checkbox'
                      checked={form.topCriteria.includes(criterion)}
                      onChange={(e) => {
                        setForm((prev) => {
                          const next = new Set(prev.topCriteria);
                          if (e.target.checked) {
                            if (next.size >= 3) return prev;
                            next.add(criterion);
                          } else {
                            next.delete(criterion);
                          }
                          return { ...prev, topCriteria: Array.from(next) };
                        });
                      }}
                    />
                    <span>{criterion}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className='survey-label survey-full'>
              Portfolio / Example of Past Work{' '}
            </label>
            <input
              className='survey-input survey-full'
              type='url'
              value={form.portfolioUrl}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, portfolioUrl: e.target.value }))
              }
              placeholder='Portfolio/Past Work URL'
              required
            />

            <label className='survey-check survey-consent survey-full'>
              <input
                type='checkbox'
                checked={form.consent}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, consent: e.target.checked }))
                }
              />
              <span>I consent to participate and store responses.</span>
            </label>

            {error && <p className='survey-msg survey-msg--error'>{error}</p>}
            {savedAt && (
              <p className='survey-msg'>
                Saved at {savedAt}. You can edit anytime.
              </p>
            )}

            <button type='submit' className='survey-save-btn' disabled={saving}>
              {saving ? 'Saving...' : 'Save pre-study survey'}
            </button>
          </form>
        )}
      </div>
      <style>{`
        .survey-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem 1rem;
        }
        .survey-input {
          width: 100%;
          padding: 0.75rem 0.95rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text);
        }
        .survey-textarea {
          resize: vertical;
        }
        .survey-fieldset {
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.7rem;
          margin: 0;
        }
        .survey-fieldset legend {
          font-size: 0.85rem;
          color: var(--muted);
          padding: 0 0.3rem;
        }
        .survey-checks {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 0.45rem 0.7rem;
        }
        .survey-check {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.92rem;
        }
        .survey-label {
          font-size: 0.86rem;
          color: var(--muted);
          margin-top: 0.1rem;
        }
        .survey-note {
          color: var(--muted);
          font-style: italic;
        }
        .survey-section {
          grid-column: 1 / -1;
          margin: 0.2rem 0 0;
          font-size: 1rem;
          letter-spacing: 0.01em;
        }
        .survey-full {
          grid-column: 1 / -1;
        }
        .survey-consent {
          margin-top: -0.2rem;
        }
        .survey-msg {
          margin: 0;
          color: var(--muted);
          grid-column: 1 / -1;
        }
        .survey-msg--error {
          color: #fca5a5;
        }
        .survey-save-btn {
          border: none;
          border-radius: var(--radius);
          background: var(--accent);
          color: #fff;
          padding: 0.75rem 1rem;
          font-weight: 600;
          width: fit-content;
          grid-column: 1 / -1;
        }
        .survey-save-btn:disabled {
          opacity: 0.65;
        }
        @media (max-width: 820px) {
          .survey-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </IterationShell>
  );
}
