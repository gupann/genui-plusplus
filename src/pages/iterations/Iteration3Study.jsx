import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  completeStudySession,
  loadStudySession,
  saveStudySession,
  startStudySession,
} from '../../services/sessionApi';
import { getCurrentParticipant } from '../../services/participantSession';
import {
  ITERATION_3_CRITERIA,
  ITERATION_3_PROVIDERS,
  ITERATION_3_RATING_OPTIONS,
  getIteration3CaseManifest,
} from '../../config/iteration3Study';

function createEmptyEvaluations() {
  return ITERATION_3_PROVIDERS.reduce((accumulator, provider) => {
    accumulator[provider.id] = {
      criteria: ITERATION_3_CRITERIA.reduce((criteriaState, criterion) => {
        criteriaState[criterion.id] = '';
        return criteriaState;
      }, {}),
    };
    return accumulator;
  }, {});
}

function hasHtmlContent(value) {
  return Boolean(value && value.trim());
}

function getOutputTitle(label) {
  return `${label} generated screen`;
}

export default function Iteration3Study() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const id = parseInt(taskId, 10) || 1;
  const manifest = useMemo(() => getIteration3CaseManifest(id), [id]);

  const [participantId, setParticipantId] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [participantStatus, setParticipantStatus] = useState('loading');
  const [hydrationStatus, setHydrationStatus] = useState('idle');
  const [phase, setPhase] = useState('review');
  const [promptText, setPromptText] = useState('');
  const [promptStatus, setPromptStatus] = useState('loading');
  const [beforeCode, setBeforeCode] = useState('');
  const [beforeImageFailed, setBeforeImageFailed] = useState(false);
  const [outputsByModel, setOutputsByModel] = useState({});
  const [activeModelId, setActiveModelId] = useState(manifest.models[0]?.id || 'modelA');
  const [evaluationsByModel, setEvaluationsByModel] = useState(createEmptyEvaluations);
  const [overallEvaluation, setOverallEvaluation] = useState('');
  const [overallComment, setOverallComment] = useState('');

  useEffect(() => {
    let cancelled = false;
    getCurrentParticipant()
      .then((participant) => {
        if (cancelled) return;
        setParticipantId(participant?.participantId || '');
        setParticipantEmail(participant?.email || '');
        setParticipantStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setParticipantId('');
        setParticipantEmail('');
        setParticipantStatus('ready');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPromptStatus('loading');
    setPromptText('');
    setBeforeCode('');
    setBeforeImageFailed(false);
    setOutputsByModel({});

    async function loadAssets() {
      try {
        const beforeResponse = await fetch(manifest.originalHtmlUrl);
        if (!beforeResponse.ok) throw new Error('original html missing');
        const html = await beforeResponse.text();
        if (!cancelled) setBeforeCode(html || '');
      } catch {
        if (!cancelled) setBeforeCode('');
      }

      try {
        const promptResponse = await fetch(manifest.promptUrl);
        if (!promptResponse.ok) throw new Error('prompt missing');
        const prompt = await promptResponse.text();
        if (!cancelled) {
          setPromptText(prompt.trim());
          setPromptStatus(prompt.trim() ? 'ready' : 'missing');
        }
      } catch {
        if (!cancelled) {
          setPromptText('');
          setPromptStatus('missing');
        }
      }

      const entries = await Promise.all(
        manifest.models.map(async (model) => {
          try {
            const response = await fetch(model.htmlUrl);
            if (!response.ok) throw new Error('html missing');
            const html = await response.text();
            return [
              model.providerId,
              {
                status: hasHtmlContent(html) ? 'ready' : 'missing',
                html: html || '',
                htmlUrl: model.htmlUrl,
              },
            ];
          } catch {
            return [
              model.providerId,
              {
                status: 'missing',
                html: '',
                htmlUrl: model.htmlUrl,
              },
            ];
          }
        }),
      );

      if (!cancelled) {
        setOutputsByModel(Object.fromEntries(entries));
      }
    }

    void loadAssets();

    return () => {
      cancelled = true;
    };
  }, [manifest]);

  useEffect(() => {
    if (participantStatus !== 'ready') return;
    if (!participantId) {
      setHydrationStatus('ready');
      return;
    }
    let cancelled = false;

    async function hydrateSession() {
      setHydrationStatus('loading');
      const loaded = await loadStudySession({
        participantId,
        email: participantEmail,
        iterationId: 3,
        taskId: id,
      });

      if (cancelled) return;

      if (loaded?.session) {
        const snapshot = loaded.session.snapshot || {};
        setSessionId(loaded.session.id);
        setPhase(snapshot.phase || 'review');
        setActiveModelId(snapshot.activeModelId || manifest.models[0]?.id || 'modelA');
        setEvaluationsByModel(snapshot.evaluationsByModel || createEmptyEvaluations());
        setOverallEvaluation(snapshot.overallEvaluation || '');
        setOverallComment(snapshot.overallComment || '');
      } else {
        const snapshot = {
          phase: 'review',
          activeModelId: manifest.models[0]?.id || 'modelA',
          evaluationsByModel: createEmptyEvaluations(),
          overallEvaluation: '',
          overallComment: '',
        };
        const started = await startStudySession({
          participantId,
          email: participantEmail,
          iterationId: 3,
          taskId: id,
          snapshot,
        });
        if (cancelled) return;
        setSessionId(started?.session?.id || '');
        setPhase(snapshot.phase);
        setActiveModelId(snapshot.activeModelId);
        setEvaluationsByModel(snapshot.evaluationsByModel);
        setOverallEvaluation(snapshot.overallEvaluation);
        setOverallComment(snapshot.overallComment);
      }

      setHydrationStatus('ready');
    }

    hydrateSession().catch(() => {
      if (!cancelled) setHydrationStatus('ready');
    });

    return () => {
      cancelled = true;
    };
  }, [id, manifest.models, participantEmail, participantId, participantStatus]);

  const sessionSnapshot = useMemo(
    () => ({
      phase,
      activeModelId,
      displayMapping: Object.fromEntries(
        manifest.models.map((model) => [model.id, model.providerId]),
      ),
      evaluationsByModel,
      overallEvaluation,
      overallComment,
    }),
    [
      phase,
      activeModelId,
      manifest.models,
      evaluationsByModel,
      overallEvaluation,
      overallComment,
    ],
  );

  useEffect(() => {
    if (hydrationStatus !== 'ready' || !sessionId || !participantId) return;
    if (phase === 'done') return;

    const timeoutId = window.setTimeout(() => {
      saveStudySession({
        sessionId,
        status: 'in_progress',
        snapshot: sessionSnapshot,
      }).catch(() => {});
    }, 600);

    return () => window.clearTimeout(timeoutId);
  }, [hydrationStatus, participantId, phase, sessionId, sessionSnapshot]);

  const availableModels = useMemo(
    () =>
      manifest.models.filter(
        (model) => outputsByModel[model.providerId]?.status === 'ready',
      ),
    [manifest.models, outputsByModel],
  );

  const activeSlot =
    manifest.models.find((model) => model.id === activeModelId) || manifest.models[0];
  const activeEvaluation =
    evaluationsByModel[activeSlot.providerId] || createEmptyEvaluations()[activeSlot.providerId];

  const allRequiredComplete = availableModels.every((model) => {
    const evaluation = evaluationsByModel[model.providerId];
    return ITERATION_3_CRITERIA.every(
      (criterion) => Boolean(evaluation.criteria?.[criterion.id]),
    );
  }) && Boolean(overallEvaluation);

  function updateCriterion(modelId, criterionId, value) {
    setEvaluationsByModel((previous) => ({
      ...previous,
      [modelId]: {
        ...(previous[modelId] || {}),
        criteria: {
          ...(previous[modelId]?.criteria || {}),
          [criterionId]: value,
        },
      },
    }));
  }

  async function handleFinish() {
    if (!sessionId) {
      navigate('/iterations/3');
      return;
    }
    const nextSnapshot = {
      ...sessionSnapshot,
      phase: 'done',
    };
    setPhase('done');
    await completeStudySession({
      sessionId,
      snapshot: nextSnapshot,
    }).catch(() => {});
    navigate('/iterations/3', { replace: true });
  }

  const beforeScreen = (
    <div className='iteration3-study__screen-wrap'>
      {beforeCode ? (
        <iframe
          title='Original screen'
          srcDoc={beforeCode}
          className='iteration3-study__iframe'
          sandbox='allow-same-origin allow-scripts'
        />
      ) : beforeImageFailed ? (
        <div className='iteration3-study__placeholder'>
          Missing original asset for Case Study {id}.
        </div>
      ) : (
        <img
          src={manifest.originalImageUrl}
          alt='Original screen'
          className='iteration3-study__image'
          onError={() => setBeforeImageFailed(true)}
        />
      )}
    </div>
  );

  if (participantStatus !== 'ready') {
    return (
      <div className='iteration3-study iteration3-study--centered'>
        <div className='iteration3-study__message-card'>
          <h2>Preparing session...</h2>
          <p>Checking local study access.</p>
        </div>
        <style>{iteration3StudyStyles}</style>
      </div>
    );
  }

  if (hydrationStatus === 'loading') {
    return (
      <div className='iteration3-study iteration3-study--centered'>
        <div className='iteration3-study__message-card'>
          <h2>Loading your session...</h2>
          <p>Please wait while we restore your progress.</p>
        </div>
        <style>{iteration3StudyStyles}</style>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className='iteration3-study iteration3-study--centered'>
        <div className='iteration3-study__message-card'>
          <h2>Case study completed</h2>
          <p>Your Iteration #3 evaluation has been saved.</p>
          <button
            type='button'
            className='iteration3-study__primary-btn'
            onClick={() => navigate('/iterations/3')}
          >
            Back to case studies
          </button>
        </div>
        <style>{iteration3StudyStyles}</style>
      </div>
    );
  }

  return (
    <div className='iteration3-study'>
      <header className='iteration3-study__header'>
        <button
          type='button'
          className='iteration3-study__back'
          onClick={() => navigate('/iterations/3')}
        >
          ← Case studies
        </button>
        <h1>Case Study #{id}</h1>
        <p>
          Review the fixed revision prompt, compare the original screen against
          the three pregenerated model outputs, and complete the rubric for each
          model.
        </p>
      </header>

      <section className='iteration3-study__panel'>
        <div className='iteration3-study__panel-head'>
          <h2>Revision Prompt</h2>
          <span className='iteration3-study__panel-kicker'>Read only</span>
        </div>
        {promptStatus === 'loading' ? (
          <p className='iteration3-study__muted'>Loading prompt...</p>
        ) : promptText ? (
          <div className='iteration3-study__prompt-box'>{promptText}</div>
        ) : (
          <div className='iteration3-study__placeholder'>
            Add the prompt at <code>{manifest.promptUrl}</code>.
          </div>
        )}
      </section>

      <section className='iteration3-study__compare-grid'>
        <article className='iteration3-study__compare-col'>
          <div className='iteration3-study__compare-head'>
            <h3>Original</h3>
          </div>
          {beforeScreen}
        </article>

            {manifest.models.map((model) => {
          const output = outputsByModel[model.providerId];

          return (
            <article className='iteration3-study__compare-col' key={model.id}>
              <div className='iteration3-study__compare-head'>
                <h3>{model.label}</h3>
              </div>
              <div className='iteration3-study__screen-wrap'>
                {output?.status === 'ready' ? (
                  <iframe
                    title={getOutputTitle(model.label)}
                    srcDoc={output.html}
                    className='iteration3-study__iframe'
                    sandbox='allow-same-origin allow-scripts'
                  />
                ) : (
                  <div className='iteration3-study__placeholder'>
                    Add the pregenerated HTML at <code>{model.htmlUrl}</code>.
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className='iteration3-study__panel'>
        <div className='iteration3-study__tabs'>
          {manifest.models.map((model) => (
            <button
              key={model.id}
              type='button'
              className={`iteration3-study__tab${model.id === activeSlot.id ? ' is-active' : ''}`}
              onClick={() => setActiveModelId(model.id)}
            >
              Feedback: {model.label}
            </button>
          ))}
        </div>

        <div className='iteration3-study__feedback'>
          <div className='iteration3-study__feedback-header'>
            <div>
              <p className='iteration3-study__eyebrow'>Structured Rubric</p>
              <h2>{activeSlot.label}</h2>
            </div>
            {outputsByModel[activeSlot.providerId]?.status !== 'ready' && (
              <p className='iteration3-study__muted'>
                This model output is missing. Add its HTML file to evaluate it.
              </p>
            )}
          </div>

          <div className='iteration3-study__rubric-list'>
            <div className='iteration3-study__matrix' role='table' aria-label='Structured rubric'>
              <div className='iteration3-study__matrix-head' role='row'>
                <span className='iteration3-study__matrix-label' role='columnheader'>
                  Criterion
                </span>
                {ITERATION_3_RATING_OPTIONS.map((option) => (
                  <span
                    key={option.value}
                    className='iteration3-study__matrix-score'
                    role='columnheader'
                  >
                    {option.label}
                  </span>
                ))}
              </div>
              {ITERATION_3_CRITERIA.map((criterion) => (
                <div className='iteration3-study__matrix-row' role='row' key={criterion.id}>
                  <span className='iteration3-study__matrix-label' role='rowheader'>
                    {criterion.label}
                  </span>
                  {ITERATION_3_RATING_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className='iteration3-study__matrix-cell'
                      aria-label={`${criterion.label}: ${option.label}`}
                    >
                      <input
                        type='radio'
                        name={`${activeSlot.id}-${criterion.id}`}
                        value={option.value}
                        checked={activeEvaluation.criteria?.[criterion.id] === option.value}
                        onChange={(event) =>
                          updateCriterion(activeSlot.providerId, criterion.id, event.target.value)
                        }
                        disabled={outputsByModel[activeSlot.providerId]?.status !== 'ready'}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className='iteration3-study__panel'>
        <div className='iteration3-study__overall'>
          <p className='iteration3-study__eyebrow'>Overall Evaluation</p>
          <fieldset className='iteration3-study__overall-group'>
            <legend>Overall Evaluation</legend>
            <div className='iteration3-study__overall-options'>
              {ITERATION_3_RATING_OPTIONS.map((option) => (
                <label key={option.value} className='iteration3-study__radio'>
                  <input
                    type='radio'
                    name='iteration3-overall-evaluation'
                    value={option.value}
                    checked={overallEvaluation === option.value}
                    onChange={(event) => setOverallEvaluation(event.target.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className='iteration3-study__comment-label'>
            <span>Comment</span>
            <textarea
              className='iteration3-study__textarea'
              rows={4}
              value={overallComment}
              onChange={(event) => setOverallComment(event.target.value)}
              placeholder='Briefly explain the most important reason for your rating.'
            />
          </label>
        </div>
      </section>

      <div className='iteration3-study__footer'>
        <p className='iteration3-study__muted'>
          Complete all rubric criteria and the overall evaluation for each
          available model before finishing this case study.
        </p>
        <button
          type='button'
          className='iteration3-study__primary-btn'
          disabled={!allRequiredComplete || availableModels.length === 0}
          onClick={() => {
            void handleFinish();
          }}
        >
          Finish case study
        </button>
      </div>

      <style>{iteration3StudyStyles}</style>
    </div>
  );
}

const iteration3StudyStyles = `
  .iteration3-study {
    min-height: 100vh;
    max-width: 1400px;
    margin: 0 auto;
    padding: 1.5rem;
    display: grid;
    gap: 1.25rem;
    padding-bottom: 3rem;
  }
  .iteration3-study--centered {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .iteration3-study__message-card {
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: var(--radius);
  }
  .iteration3-study__message-card {
    width: min(100%, 560px);
    padding: 1.4rem;
  }
  .iteration3-study__header {
    margin-bottom: 0.25rem;
  }
  .iteration3-study__header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }
  .iteration3-study__header p {
    margin: 0;
    color: var(--muted);
    font-size: 0.95rem;
  }
  .iteration3-study__back {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 0.9rem;
    padding: 0.25rem 0;
    margin: 0 0 0.5rem 0;
    cursor: pointer;
  }
  .iteration3-study__back:hover {
    color: var(--accent);
  }
  .iteration3-study__panel {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    padding: 1rem 1.1rem;
  }
  .iteration3-study__panel--prompt {
    padding: 1rem;
  }
  .iteration3-study__panel-head,
  .iteration3-study__feedback-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .iteration3-study__panel-head h2,
  .iteration3-study__feedback-header h2 {
    border: none;
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  .iteration3-study__panel-kicker,
  .iteration3-study__eyebrow {
    color: var(--muted);
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .iteration3-study__eyebrow {
    display: block;
    margin: 0 0 0.4rem 0;
  }
  .iteration3-study__prompt-box {
    margin-top: 0.75rem;
    padding: 0.95rem 1rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: rgba(148, 163, 184, 0.06);
    white-space: pre-wrap;
    line-height: 1.6;
  }
  .iteration3-study__compare-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-items: start;
    margin: 0 0 1rem 0;
  }
  .iteration3-study__compare-col {
    min-width: 0;
    padding: 0 0.75rem;
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .iteration3-study__compare-col:first-child {
    border-left: none;
    padding-left: 0;
  }
  .iteration3-study__compare-col:last-child {
    padding-right: 0;
  }
  .iteration3-study__compare-head {
    width: min(100%, 390px);
    margin-bottom: 0.75rem;
    display: block;
  }
  .iteration3-study__compare-head h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
  }
  .iteration3-study__screen-wrap {
    width: min(100%, 390px);
    max-width: 100%;
    aspect-ratio: 390 / 844;
    margin: 0;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 2rem;
    overflow: auto;
    box-shadow:
      0 14px 30px rgba(15, 23, 42, 0.2),
      inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  }
  .iteration3-study__iframe,
  .iteration3-study__image {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
    background: #f8f9fb;
  }
  .iteration3-study__image {
    object-fit: contain;
    background: #f8f9fb;
  }
  .iteration3-study__placeholder {
    height: 100%;
    padding: 1.25rem;
    text-align: center;
    color: var(--muted);
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .iteration3-study__placeholder code {
    word-break: break-word;
  }
  .iteration3-study__tabs {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .iteration3-study__tab {
    padding: 0.65rem 0.75rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: rgba(148, 163, 184, 0.06);
    color: var(--muted);
    cursor: pointer;
    font-weight: 600;
    transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
  }
  .iteration3-study__tab:hover {
    background: rgba(148, 163, 184, 0.12);
    color: var(--text);
  }
  .iteration3-study__tab.is-active {
    color: var(--text);
    background: rgba(99, 102, 241, 0.12);
    border-color: rgba(99, 102, 241, 0.5);
  }
  .iteration3-study__feedback {
    display: grid;
    gap: 1.25rem;
  }
  .iteration3-study__muted {
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .iteration3-study__rubric-list {
    display: grid;
    gap: 0.75rem;
  }
  .iteration3-study__overall-group {
    margin: 0;
    padding: 0.8rem 0.9rem 0.9rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: rgba(148, 163, 184, 0.06);
    min-width: 0;
  }
  .iteration3-study__overall-group legend {
    padding: 0 0.25rem;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .iteration3-study__matrix {
    border-top: 1px solid rgba(148, 163, 184, 0.18);
  }
  .iteration3-study__matrix-head,
  .iteration3-study__matrix-row {
    display: grid;
    grid-template-columns: minmax(220px, 1.7fr) repeat(3, minmax(84px, 1fr));
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 0;
    border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  }
  .iteration3-study__matrix-head {
    padding-top: 0;
    color: var(--text);
    font-size: 0.95rem;
    font-weight: 600;
  }
  .iteration3-study__matrix-label {
    font-size: 0.95rem;
    color: var(--text);
  }
  .iteration3-study__matrix-score,
  .iteration3-study__matrix-cell {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .iteration3-study__matrix-cell input {
    width: 1.1rem;
    height: 1.1rem;
    margin: 0;
  }
  .iteration3-study__overall-options {
    display: grid;
    gap: 0.45rem;
    margin-top: 0.35rem;
  }
  .iteration3-study__radio {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--text);
    font-size: 0.9rem;
  }
  .iteration3-study__radio input {
    margin: 0;
  }
  .iteration3-study__overall {
    display: grid;
    gap: 0.75rem;
    padding-top: 0.35rem;
    border-top: 1px solid var(--border);
  }
  .iteration3-study__comment-label {
    display: grid;
    gap: 0.5rem;
    font-size: 0.92rem;
    font-weight: 500;
  }
  .iteration3-study__textarea {
    width: 100%;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: rgba(148, 163, 184, 0.04);
    color: var(--text);
    padding: 0.85rem 0.95rem;
    resize: vertical;
    font: inherit;
  }
  .iteration3-study__textarea:focus {
    outline: none;
    border-color: var(--accent);
  }
  .iteration3-study__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .iteration3-study__primary-btn {
    border: none;
    border-radius: var(--radius);
    padding: 0.72rem 1rem;
    background: var(--accent);
    color: #fff;
    font-weight: 600;
    cursor: pointer;
  }
  .iteration3-study__primary-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  @media (max-width: 1220px) {
    .iteration3-study__compare-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }
    .iteration3-study__compare-col {
      border-left: none;
      border-top: 1px solid var(--border);
      padding: 1rem 0 0 0;
    }
    .iteration3-study__compare-col:first-child {
      border-top: none;
      padding-top: 0;
    }
  }
  @media (max-width: 760px) {
    .iteration3-study {
      padding: 1rem;
    }
    .iteration3-study__compare-grid,
    .iteration3-study__tabs {
      grid-template-columns: 1fr;
    }
    .iteration3-study__matrix-head,
    .iteration3-study__matrix-row {
      grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(56px, 0.7fr));
      gap: 0.35rem;
    }
    .iteration3-study__matrix-head {
      font-size: 0.88rem;
    }
    .iteration3-study__matrix-label {
      font-size: 0.88rem;
    }
    .iteration3-study__footer {
      flex-direction: column;
      align-items: stretch;
    }
    .iteration3-study__screen-wrap {
      width: 100%;
      max-width: 100%;
    }
    .iteration3-study__screen-wrap {
      aspect-ratio: 390 / 844;
    }
  }
`;
