import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { generateAfterScreen, getProviderStatus } from '../services/api';

// Placeholder image per task. Replace with your images in public/ e.g. task1-before.png
function getBeforeImageUrl(taskId) {
  return `/task${taskId}-before.png`;
}

function getBeforeCodeUrl(taskId) {
  return `/task${taskId}-before.html`;
}

export default function Study() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const id = parseInt(taskId, 10) || 1;

  const [beforeImageFailed, setBeforeImageFailed] = useState(false);
  const [beforeCode, setBeforeCode] = useState('');
  const [changes, setChanges] = useState([{ id: 1, problem: '', prompt: '' }]);
  const [phase, setPhase] = useState('collect'); // 'collect' | 'review' | 'done'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [validationById, setValidationById] = useState({});

  // Per-change generation + feedback
  const [resultsById, setResultsById] = useState({});
  const [successById, setSuccessById] = useState({});
  const [notSuccessById, setNotSuccessById] = useState({});
  const [approvedById, setApprovedById] = useState({});
  const [approvalsByProvider, setApprovalsByProvider] = useState({});
  const [rankingById, setRankingById] = useState({});
  const [iframeHeightsById, setIframeHeightsById] = useState({});

  const beforeImageUrl = getBeforeImageUrl(id);
  const beforeCodeUrl = getBeforeCodeUrl(id);

  function handleChangeField(index, field, value) {
    setChanges((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
    setValidationById((prev) => {
      const changeId = changes[index]?.id;
      if (!changeId) return prev;
      const next = { ...prev };
      const trimmed = value.trim();
      if (trimmed) {
        next[changeId] = { ...(next[changeId] || {}) };
        delete next[changeId][field];
        if (Object.keys(next[changeId]).length === 0) {
          delete next[changeId];
        }
      }
      return next;
    });
  }

  function handleAddChange() {
    setChanges((prev) => [
      ...prev,
      {
        id: prev.length ? prev[prev.length - 1].id + 1 : 1,
        problem: '',
        prompt: '',
      },
    ]);
  }

  function handleRemoveChange(idToRemove) {
    setChanges((prev) => prev.filter((c) => c.id !== idToRemove));
    setValidationById((prev) => {
      if (!prev[idToRemove]) return prev;
      const next = { ...prev };
      delete next[idToRemove];
      return next;
    });
  }

  function handleStartReview(e) {
    e.preventDefault();
    const errors = {};
    changes.forEach((c) => {
      const problemEmpty = !c.problem.trim();
      const promptEmpty = !c.prompt.trim();
      if (problemEmpty || promptEmpty) {
        errors[c.id] = {};
        if (problemEmpty) errors[c.id].problem = 'Please describe the change.';
        if (promptEmpty) errors[c.id].prompt = 'Please add an AI prompt.';
      }
    });
    if (Object.keys(errors).length > 0) {
      setValidationById(errors);
      return;
    }
    setPhase('review');
    setCurrentIndex(0);
    // eslint-disable-next-line no-console
    console.log('Saved changes for task', id, changes);
  }

  function getEntriesById(map, changeId) {
    const entries = map[changeId];
    if (Array.isArray(entries) && entries.length) return entries;
    return [{ text: '', providerId: '' }];
  }

  function updateEntry(setter, changeId, index, key, value) {
    setter((prev) => {
      const next = { ...prev };
      const entries = Array.isArray(next[changeId])
        ? [...next[changeId]]
        : [{ text: '', providerId: '' }];
      while (entries.length <= index)
        entries.push({ text: '', providerId: '' });
      entries[index] = { ...entries[index], [key]: value };
      next[changeId] = entries;
      return next;
    });
  }

  function addEntry(setter, changeId) {
    setter((prev) => {
      const next = { ...prev };
      const entries = Array.isArray(next[changeId])
        ? [...next[changeId]]
        : [{ text: '', providerId: '' }];
      entries.push({ text: '', providerId: '' });
      next[changeId] = entries;
      return next;
    });
  }

  function removeEntry(setter, changeId, index) {
    setter((prev) => {
      const next = { ...prev };
      const entries = Array.isArray(next[changeId])
        ? [...next[changeId]]
        : [{ text: '', providerId: '' }];
      if (entries.length <= 1) {
        next[changeId] = [{ text: '', providerId: '' }];
        return next;
      }
      entries.splice(index, 1);
      next[changeId] = entries.length
        ? entries
        : [{ text: '', providerId: '' }];
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadBeforeCode() {
      try {
        const response = await fetch(beforeCodeUrl);
        if (!response.ok) throw new Error('missing before code');
        const text = await response.text();
        if (!cancelled) setBeforeCode(text);
      } catch {
        if (!cancelled) setBeforeCode('');
      }
    }

    loadBeforeCode();

    return () => {
      cancelled = true;
    };
  }, [beforeCodeUrl]);

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        const status = await getProviderStatus();
        if (cancelled) return;
        setProviderStatus({
          loading: false,
          error: null,
          providers: status.providers || null,
          mode: status.mode || 'unknown',
        });
      } catch (err) {
        if (cancelled) return;
        setProviderStatus({
          loading: false,
          error: err.message || 'Unable to reach generation server.',
          providers: null,
          mode: 'unknown',
        });
      }
    }
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const providers = [
    { id: 'openai', label: 'OpenAI' },
    { id: 'gemini', label: 'Gemini' },
    { id: 'claude', label: 'Claude' },
  ];
  const [providerStatus, setProviderStatus] = useState({
    loading: true,
    error: null,
    providers: null,
    mode: 'unknown',
  });

  const availableProviders = providerStatus?.providers
    ? providers.filter(
        (p) => providerStatus.providers[p.id]?.available !== false,
      )
    : providers;
  const missingProviders = providerStatus?.providers
    ? providers.filter(
        (p) => providerStatus.providers[p.id]?.available === false,
      )
    : [];

  function buildDownloadHref(code) {
    if (!code) return '';
    return `data:text/html;charset=utf-8,${encodeURIComponent(code)}`;
  }

  async function handleDownloadFull(changeId, providerId) {
    const change = changes.find((c) => c.id === changeId);
    const providerResult = resultsById[changeId]?.[providerId]?.result;
    const code = providerResult?.afterHtml || providerResult?.afterCode || '';
    const promptText = change?.prompt || '';
    const zip = new JSZip();
    zip.file(
      `before-task-${changeId}.html`,
      beforeCode || '<!-- no before code found -->',
    );
    zip.file(
      `task-${changeId}-prompt.txt`,
      promptText || '(no prompt provided)',
    );
    zip.file(
      `after-task-${changeId}-${providerId}.html`,
      code || '<!-- no after code returned -->',
    );
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `task-${changeId}-${providerId}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const CLIENT_WATCHDOG_MS = 50000;

  function triggerProviderGeneration(providerId, { force = false } = {}) {
    // eslint-disable-next-line no-console
    console.log('[ui] triggerProviderGeneration', { providerId, force });
    const current = changes[currentIndex];
    if (!current) return;
    const changeId = current.id;
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setResultsById((prev) => {
      const existingForChange = prev[changeId] || {};
      const existingProvider = existingForChange[providerId];
      if (!force && (existingProvider?.loading || existingProvider?.done))
        return prev;
      return {
        ...prev,
        [changeId]: {
          ...existingForChange,
          [providerId]: {
            ...(existingProvider || {}),
            loading: true,
            error: null,
            requestId,
            startedAt: Date.now(),
          },
        },
      };
    });
    // eslint-disable-next-line no-console
    console.log('[ui] scheduling run', { providerId, requestId });

    setTimeout(() => {
      setResultsById((prev) => {
        const currentProvider = prev?.[changeId]?.[providerId];
        if (!currentProvider?.loading) return prev;
        if (currentProvider.requestId !== requestId) return prev;
        return {
          ...prev,
          [changeId]: {
            ...(prev[changeId] || {}),
            [providerId]: {
              ...(currentProvider || {}),
              loading: false,
              done: true,
              error: 'Request timed out or was blocked. Try again.',
            },
          },
        };
      });
    }, CLIENT_WATCHDOG_MS);

    const run = async () => {
      try {
        // eslint-disable-next-line no-console
        console.log('[ui] calling generateAfterScreen', {
          providerId,
          apiUrl: import.meta.env.VITE_UI_GENERATION_API_URL,
        });
        const result = await generateAfterScreen({
          taskId: id,
          prompt: current.prompt,
          beforeImageUrl,
          beforeCode,
          provider: providerId,
        });
        // eslint-disable-next-line no-console
        console.log('[ui] generateAfterScreen success', { providerId });
        setResultsById((prev) => ({
          ...prev,
          [changeId]: {
            ...(prev[changeId] || {}),
            [providerId]: {
              ...(prev[changeId]?.[providerId] || {}),
              loading: false,
              done: true,
              result,
            },
          },
        }));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[ui] generateAfterScreen error', { providerId, err });
        setResultsById((prev) => ({
          ...prev,
          [changeId]: {
            ...(prev[changeId] || {}),
            [providerId]: {
              ...(prev[changeId]?.[providerId] || {}),
              loading: false,
              done: true,
              error: err.message || 'Failed to generate screen.',
            },
          },
        }));
      }
    };

    run();
  }

  function handleNextChange() {
    if (currentIndex < changes.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      // End of all changes
      setPhase('done');
      // eslint-disable-next-line no-console
      console.log('Completed review for task', id, {
        changes,
        successById,
        notSuccessById,
        approvedById,
      });
    }
  }

  if (phase === 'done') {
    return (
      <div className='study study--centered'>
        <div className='study__done'>
          <h2>Thank you</h2>
          <p>
            Your small changes, prompts, and evaluations have been captured for
            this case study. You can start another case study or close this
            page.
          </p>
          <button
            type='button'
            className='study__btn study__btn--primary'
            onClick={() => navigate('/')}
          >
            Back to case studies
          </button>
        </div>
        <style>{studyStyles}</style>
      </div>
    );
  }

  const isCollect = phase === 'collect';
  const currentChange = changes[currentIndex];
  const currentChangeId = currentChange?.id;
  const currentResult = currentChange
    ? resultsById[currentChange.id] || {}
    : {};
  const getIframeHeight = (changeId, providerId) =>
    iframeHeightsById[changeId]?.[providerId] || 900;

  function scrollToBottom() {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  }

  function setProviderApproval(changeId, providerId, value) {
    setApprovalsByProvider((prev) => ({
      ...prev,
      [changeId]: { ...(prev[changeId] || {}), [providerId]: value },
    }));
  }

  function updateRanking(changeId, slot, providerId) {
    setRankingById((prev) => ({
      ...prev,
      [changeId]: { ...(prev[changeId] || {}), [slot]: providerId },
    }));
  }

  function handleIframeLoad(changeId, providerId, event) {
    try {
      const doc = event.target?.contentDocument;
      if (!doc) return;
      const height =
        doc.documentElement?.scrollHeight ||
        doc.body?.scrollHeight ||
        doc.documentElement?.offsetHeight ||
        900;
      setIframeHeightsById((prev) => {
        const next = { ...prev };
        const entry = { ...(next[changeId] || {}) };
        entry[providerId] = Math.max(height, 600);
        next[changeId] = entry;
        return next;
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Could not read iframe height', err);
    }
  }
  const successEntries = currentChange
    ? getEntriesById(successById, currentChange.id)
    : [''];
  const notSuccessEntries = currentChange
    ? getEntriesById(notSuccessById, currentChange.id)
    : [''];
  const hasMissingRequired = changes.some(
    (c) => !c.problem.trim() || !c.prompt.trim(),
  );
  const providersForChange = availableProviders;
  const ranksToShow = providersForChange.length || 0;
  const approvalsComplete =
    providersForChange.length > 0 &&
    providersForChange.every(
      (p) =>
        approvalsByProvider[currentChangeId]?.[p.id] === true ||
        approvalsByProvider[currentChangeId]?.[p.id] === false,
    );
  const rankingCurrent = rankingById[currentChangeId] || {};
  const rankingValues = Array.from(
    { length: ranksToShow },
    (_, i) => rankingCurrent[i + 1],
  ).filter(Boolean);
  const uniqueRankCount = new Set(rankingValues).size;
  const rankingComplete =
    ranksToShow === 0 ||
    (rankingValues.length === ranksToShow && uniqueRankCount === ranksToShow);
  const finishDisabled =
    hasMissingRequired || !approvalsComplete || !rankingComplete;

  return (
    <div className='study'>
      <header className='study__header'>
        <button
          type='button'
          className='study__back'
          onClick={() => navigate('/user-study')}
        >
          ← Case studies
        </button>
        <h1>Case Study {id}</h1>
        {/* 
        <p className="study__debug">
          Generator: {import.meta.env.VITE_UI_GENERATION_API_URL ? 'API' : 'Mock'}{' '}
          {import.meta.env.VITE_UI_GENERATION_API_URL
            ? `( ${import.meta.env.VITE_UI_GENERATION_API_URL} )`
            : '(no VITE_UI_GENERATION_API_URL)'}
        </p>
        <p className="study__debug">
          Debug: phase={phase} currentIndex={currentIndex}{' '}
          {currentChange ? `changeId=${currentChange.id}` : 'changeId=none'}{' '}
          {currentResult
            ? `loading=${Boolean(currentResult.loading)} done=${Boolean(currentResult.done)} error=${
                currentResult.error ? 'yes' : 'no'
              }`
            : 'result=none'}
        </p>
        */}
      </header>

      <section className='study__section'>
        <h2>Screen</h2>
        <p className='study__hint'>
          Scroll through this screen and identify small, incremental changes you
          would make. For each change, describe the problem and write the exact
          AI prompt you would use to implement it.
        </p>
        <div className='study__screen-wrap study__screen-wrap--before'>
          {beforeCode ? (
            <iframe
              title='Before screen'
              srcDoc={beforeCode}
              className='study__iframe study__iframe--before'
              sandbox='allow-same-origin allow-scripts'
            />
          ) : beforeImageFailed ? (
            <div className='study__img-placeholder'>
              Add your screenshot as <code>public/task{id}-before.png</code> (or
              .jpg). Optional code: <code>public/task{id}-before.html</code>
            </div>
          ) : (
            <img
              src={beforeImageUrl}
              alt='Screen for this case study'
              className='study__img'
              onError={() => setBeforeImageFailed(true)}
            />
          )}
        </div>
      </section>

      {isCollect ? (
        <section className='study__section'>
          <h2>Small changes and AI prompts</h2>
          <p className='study__hint'>
            Add as many small changes as you like. Each row is one small,
            incremental change (e.g. move a button, adjust copy, tweak spacing,
            etc.) with the corresponding AI prompt you&apos;d send to your
            design agent.
          </p>

          <form onSubmit={handleStartReview} className='study__form'>
            {changes.map((change, index) => (
              <div key={change.id} className='study__change'>
                <div className='study__change-header'>
                  <span className='study__change-label'>
                    Change {index + 1}
                  </span>
                  {changes.length > 1 && (
                    <button
                      type='button'
                      className='study__chip-btn'
                      onClick={() => handleRemoveChange(change.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <label className='study__label'>
                  What is the small change or issue?
                  <textarea
                    className={`study__textarea${validationById[change.id]?.problem ? ' study__textarea--error' : ''}`}
                    value={change.problem}
                    onChange={(e) =>
                      handleChangeField(index, 'problem', e.target.value)
                    }
                    rows={2}
                    placeholder='e.g. The primary button is too low in the hierarchy; move it closer to the form.'
                  />
                  {validationById[change.id]?.problem && (
                    <span className='study__error-text'>
                      {validationById[change.id].problem}
                    </span>
                  )}
                </label>

                <label className='study__label'>
                  AI prompt you would use for this change
                  <textarea
                    className={`study__textarea${validationById[change.id]?.prompt ? ' study__textarea--error' : ''}`}
                    value={change.prompt}
                    onChange={(e) =>
                      handleChangeField(index, 'prompt', e.target.value)
                    }
                    rows={2}
                    placeholder='e.g. "Move the primary submit button directly below the last form field and increase its size by 10%."'
                  />
                  {validationById[change.id]?.prompt && (
                    <span className='study__error-text'>
                      {validationById[change.id].prompt}
                    </span>
                  )}
                </label>
              </div>
            ))}

            <button
              type='button'
              className='study__btn study__btn--ghost'
              onClick={handleAddChange}
            >
              + Add another small change
            </button>

            <button
              type='submit'
              className='study__btn study__btn--primary'
              disabled={hasMissingRequired}
            >
              Save changes and start evaluation
            </button>
          </form>
        </section>
      ) : (
        <section className='study__section'>
          <h2>
            Evaluate change {currentIndex + 1} of {changes.length}
          </h2>
          <p className='study__hint'>
            Let's use your AI prompt for this small change to generate an
            updated screen. Tell us what is successful, what is not, and whether
            you would approve this result as a designer. Each success or failure
            should be one thing to keep the feedback itemized.
          </p>

          <div className='study__change study__change--summary'>
            <div className='study__change-header'>
              <span className='study__change-label'>Provided AI prompt</span>
            </div>
            <p className='study__meta-body study__meta-body--single'>
              {currentChange.prompt || <em>(No prompt provided)</em>}
            </p>
          </div>

          <div className='study__screen-wrap study__screen-wrap--after'>
            <div className='study__provider-grid'>
              {availableProviders.map((provider) => {
                const providerResult = currentResult?.[provider.id];
                const isLoading = providerResult?.loading;
                const error = providerResult?.error;
                const result = providerResult?.result;
                const code = result?.afterHtml || result?.afterCode || '';
                const downloadHref = buildDownloadHref(code);

                return (
                  <div key={provider.id} className='study__provider-card'>
                    <div className='study__provider-header'>
                      <span className='study__provider-name'>
                        {provider.label}
                      </span>
                      <div className='study__provider-actions'>
                        {downloadHref ? (
                          <button
                            type='button'
                            className='study__chip-btn'
                            onClick={() =>
                              handleDownloadFull(currentChange.id, provider.id)
                            }
                          >
                            Download Full Item
                          </button>
                        ) : (
                          <span className='study__provider-status'>
                            No code yet
                          </span>
                        )}
                        <button
                          type='button'
                          className='study__chip-btn'
                          disabled={isLoading}
                          onClick={() =>
                            triggerProviderGeneration(provider.id, {
                              force: true,
                            })
                          }
                        >
                          {error ? 'Generate' : 'Generate'}
                        </button>
                      </div>
                    </div>
                    <p className='study__provider-approve-hint'>
                      Let us know whether you'd approve this output:
                      <button
                        type='button'
                        className={`study__chip-btn study__chip-btn--approve${approvalsByProvider[currentChange.id]?.[provider.id] === true ? ' is-active' : ''}`}
                        disabled={!result || isLoading || error}
                        onClick={() =>
                          result &&
                          setProviderApproval(
                            currentChange.id,
                            provider.id,
                            true,
                          )
                        }
                      >
                        ✅ Approve
                      </button>
                      <button
                        type='button'
                        className={`study__chip-btn study__chip-btn--reject${approvalsByProvider[currentChange.id]?.[provider.id] === false ? ' is-active' : ''}`}
                        disabled={!result || isLoading || error}
                        onClick={() =>
                          result &&
                          setProviderApproval(
                            currentChange.id,
                            provider.id,
                            false,
                          )
                        }
                      >
                        ❌ Disapprove
                      </button>
                    </p>

                    {isLoading && (
                      <div className='study__section--centered study__provider-state'>
                        <div className='study__spinner' aria-hidden />
                        <p>Generating…</p>
                      </div>
                    )}

                    {error && !isLoading && (
                      <div className='study__error' role='alert'>
                        {error}
                      </div>
                    )}

                    {result && !isLoading && !error && (
                      <>
                        {result.afterImageUrl ? (
                          <img
                            src={result.afterImageUrl}
                            alt={`${provider.label} after screen`}
                            className='study__img'
                          />
                        ) : code ? (
                          <iframe
                            title={`${provider.label} after screen`}
                            srcDoc={code}
                            className='study__iframe'
                            sandbox='allow-same-origin allow-scripts'
                            scrolling='yes'
                            style={{
                              height: `${Math.min(
                                Math.max(
                                  getIframeHeight(
                                    currentChange.id,
                                    provider.id,
                                  ),
                                  700,
                                ),
                                900,
                              )}px`,
                              maxHeight: '75vh',
                            }}
                            onLoad={(e) =>
                              handleIframeLoad(currentChange.id, provider.id, e)
                            }
                          />
                        ) : (
                          <div className='study__img-placeholder'>
                            No output returned.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              {!providerStatus.loading && missingProviders.length > 0 && (
                <div className='study__provider-note'>
                  Missing API keys:{' '}
                  {missingProviders.map((p) => p.label).join(', ')}. Those
                  providers are hidden.
                </div>
              )}
              {providerStatus.error && (
                <div className='study__provider-note study__provider-note--error'>
                  {providerStatus.error}
                </div>
              )}
              {!providerStatus.loading &&
                availableProviders.length === 0 &&
                !providerStatus.error && (
                  <div className='study__provider-note study__provider-note--error'>
                    No providers available. Add an API key and restart the
                    server.
                  </div>
                )}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleNextChange();
            }}
            className='study__form'
          >
            <div className='study__label'>
              <div className='study__label-row'>
                <span>
                  What is successful about each result? Mention all that you can
                  think of.
                </span>
                <button
                  type='button'
                  className='study__add-btn'
                  onClick={() => addEntry(setSuccessById, currentChange.id)}
                  aria-label='Add another successful point'
                  title='Add another success'
                >
                  +
                </button>
              </div>
              {successEntries.map((entry, index) => (
                <div
                  key={`success-${currentChange.id}-${index}`}
                  className='study__entry'
                >
                  <div className='study__entry-header'>
                    <span className='study__entry-label'>
                      Success {index + 1}
                    </span>
                    <button
                      type='button'
                      className='study__chip-btn'
                      onClick={() =>
                        removeEntry(setSuccessById, currentChange.id, index)
                      }
                      aria-label='Remove this successful point'
                      title='Remove entry'
                    >
                      Remove
                    </button>
                  </div>
                  <div className='study__entry-row'>
                    <select
                      className='study__select'
                      value={entry.providerId}
                      onChange={(e) =>
                        updateEntry(
                          setSuccessById,
                          currentChange.id,
                          index,
                          'providerId',
                          e.target.value,
                        )
                      }
                    >
                      <option value=''>Select a model</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <textarea
                      className='study__textarea'
                      value={entry.text || ''}
                      onChange={(e) =>
                        updateEntry(
                          setSuccessById,
                          currentChange.id,
                          index,
                          'text',
                          e.target.value,
                        )
                      }
                      rows={3}
                      placeholder='e.g. The new button position makes it easier to find.'
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className='study__label'>
              <div className='study__label-row'>
                <span>
                  What is not successful about each result? Mention all that you
                  can think of.
                </span>
                <button
                  type='button'
                  className='study__add-btn'
                  onClick={() => addEntry(setNotSuccessById, currentChange.id)}
                  aria-label='Add another unsuccessful point'
                  title='Add another issue'
                >
                  +
                </button>
              </div>
              {notSuccessEntries.map((entry, index) => (
                <div
                  key={`not-success-${currentChange.id}-${index}`}
                  className='study__entry'
                >
                  <div className='study__entry-header'>
                    <span className='study__entry-label'>
                      Issue {index + 1}
                    </span>
                    <button
                      type='button'
                      className='study__chip-btn'
                      onClick={() =>
                        removeEntry(setNotSuccessById, currentChange.id, index)
                      }
                      aria-label='Remove this unsuccessful point'
                      title='Remove entry'
                    >
                      Remove
                    </button>
                  </div>
                  <div className='study__entry-row'>
                    <select
                      className='study__select'
                      value={entry.providerId}
                      onChange={(e) =>
                        updateEntry(
                          setNotSuccessById,
                          currentChange.id,
                          index,
                          'providerId',
                          e.target.value,
                        )
                      }
                    >
                      <option value=''>Select a model</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <textarea
                      className='study__textarea'
                      value={entry.text || ''}
                      onChange={(e) =>
                        updateEntry(
                          setNotSuccessById,
                          currentChange.id,
                          index,
                          'text',
                          e.target.value,
                        )
                      }
                      rows={3}
                      placeholder='e.g. Other unrelated elements moved.'
                    />
                  </div>
                </div>
              ))}
            </div>

            <fieldset className='study__fieldset'>
              <legend className='study__label'>
                Rank the model outputs (1 = best)
              </legend>
              <div className='study__rank-grid'>
                {Array.from({ length: Math.max(ranksToShow, 1) }, (_, idx) => idx + 1).map((rank) => (
                  <label key={rank} className='study__rank-row'>
                    <span>Rank {rank}</span>
                    <select
                      className='study__select'
                      value={rankingById[currentChange.id]?.[rank] || ''}
                      onChange={(e) =>
                        updateRanking(currentChange.id, rank, e.target.value)
                      }
                    >
                      <option value=''>Select a model</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </fieldset>

            <button
              type='submit'
              className='study__btn study__btn--primary'
              disabled={finishDisabled}
            >
              {currentIndex < changes.length - 1
                ? 'Next change'
                : 'Finish case study'}
            </button>
          </form>
        </section>
      )}

      <style>{studyStyles}</style>
      <button
        type='button'
        className='study__scroll-down'
        onClick={scrollToBottom}
        aria-label='Scroll to bottom'
      >
        ↓
      </button>
    </div>
  );
}

const studyStyles = `
  .study {
    min-height: 100vh;
    padding: 1.5rem;
    max-width: 720px;
    margin: 0 auto;
  }
  .study--centered {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .study__header {
    margin-bottom: 1.5rem;
  }
  .study__back {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 0.9rem;
    padding: 0.25rem 0;
    margin-bottom: 0.5rem;
  }
  .study__back:hover {
    color: var(--accent);
  }
  .study__header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }
  .study__debug {
    margin: 0.35rem 0 0;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .study__error {
    padding: 0.75rem 1rem;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid var(--error);
    border-radius: var(--radius);
    color: #fca5a5;
    margin-bottom: 1rem;
  }
  .study__section {
    margin-bottom: 2rem;
  }
  .study__section--centered {
    text-align: center;
    padding: 3rem 0;
  }
  .study__section h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }
  .study__hint {
    color: var(--muted);
    font-size: 0.95rem;
    margin: 0 0 1rem 0;
  }
  .study__screen-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 1.5rem;
  }
  .study__screen-wrap--before {
    max-height: 75vh;
    min-height: 320px;
    overflow: auto;
    background: linear-gradient(180deg, rgba(148, 163, 184, 0.08) 0%, rgba(148, 163, 184, 0.04) 100%);
  }
  .study__screen-wrap--after {
    min-height: 200px;
    background: linear-gradient(180deg, rgba(148, 163, 184, 0.08) 0%, rgba(148, 163, 184, 0.04) 100%);
  }
  .study__provider-grid {
    display: grid;
    gap: 1rem;
    padding: 1rem;
  }
  .study__provider-card {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: rgba(148, 163, 184, 0.06);
    overflow: auto;
  }
  .study__provider-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    background: rgba(148, 163, 184, 0.05);
  }
  .study__provider-approve-hint {
    padding: 0.75rem 1rem;
    margin: 0;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
    font-size: 0.92rem;
    color: var(--text);
  }
  .study__provider-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .study__provider-name {
    font-weight: 600;
  }
  .study__provider-status {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .study__provider-state {
    padding: 2rem 0;
  }
  .study__provider-note {
    padding: 0.75rem 1rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: rgba(148, 163, 184, 0.08);
    color: var(--muted);
    font-size: 0.9rem;
  }
  .study__provider-note--error {
    border-color: var(--error);
    color: var(--error);
    background: rgba(239, 68, 68, 0.08);
  }
  .study__img {
    display: block;
    max-width: 100%;
    height: auto;
    min-height: 120px;
    margin: 0 auto;
  }
  /* Make scrollbars visible on dark background */
  .study__screen-wrap--before,
  .study__screen-wrap--after,
  .study__iframe {
    scrollbar-width: auto;
    scrollbar-color: #111827 #d1d5db;
  }
  .study__screen-wrap--before::-webkit-scrollbar,
  .study__screen-wrap--after::-webkit-scrollbar,
  .study__iframe::-webkit-scrollbar {
    width: 14px;
    height: 14px;
  }
  .study__screen-wrap--before::-webkit-scrollbar-track,
  .study__screen-wrap--after::-webkit-scrollbar-track,
  .study__iframe::-webkit-scrollbar-track {
    background: #d1d5db;
    border-radius: 8px;
  }
  .study__screen-wrap--before::-webkit-scrollbar-thumb,
  .study__screen-wrap--after::-webkit-scrollbar-thumb,
  .study__iframe::-webkit-scrollbar-thumb {
    background: #111827;
    border-radius: 8px;
    border: 3px solid #d1d5db;
  }
  .study__img-placeholder {
    padding: 2rem;
    color: var(--muted);
    font-size: 0.9rem;
    text-align: center;
    min-height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .study__img-placeholder code {
    background: var(--border);
    padding: 0.2em 0.4em;
    border-radius: 4px;
    font-size: 0.85em;
  }
  .study__iframe {
    width: 100%;
    min-height: 320px;
    border: none;
    display: block;
    overflow: auto;
    background: #f8f9fb;
  }
  .study__iframe--before {
    min-height: 75vh;
  }
  .study__form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .study__label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.95rem;
  }
  .study__label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .study__radio-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .study__rank-grid {
    display: grid;
    gap: 0.75rem;
  }
  .study__rank-row {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 0.75rem;
    align-items: center;
  }
  .study__entry {
    display: grid;
    gap: 0.5rem;
  }
  .study__entry-row {
    display: grid;
    grid-template-columns: minmax(140px, 1fr) 3fr;
    gap: 0.75rem;
    align-items: start;
  }
  .study__entry-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .study__entry-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .study__textarea {
    padding: 0.75rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    resize: vertical;
    min-height: 80px;
  }
  .study__textarea:focus {
    outline: none;
    border-color: var(--accent);
  }
  .study__textarea--error {
    border-color: var(--error);
  }
  .study__textarea::placeholder {
    color: var(--muted);
  }
  .study__select {
    padding: 0.65rem 0.75rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 0.95rem;
  }
  .study__error-text {
    color: var(--error);
    font-size: 0.85rem;
  }
  .study__btn {
    padding: 0.75rem 1.25rem;
    border-radius: var(--radius);
    font-size: 1rem;
    font-weight: 500;
    border: none;
    align-self: flex-start;
  }
  .study__add-btn {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--accent);
    font-size: 1.2rem;
    font-weight: 600;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
  }
  .study__add-btn:hover {
    border-color: var(--accent);
    background: rgba(99, 102, 241, 0.08);
  }
  .study__btn--primary {
    background: var(--accent);
    color: white;
  }
  .study__btn--primary:hover:not(:disabled) {
    background: var(--accent-hover);
  }
  .study__btn--ghost {
    background: transparent;
    color: var(--accent);
    border: 1px dashed var(--border);
  }
  .study__btn--ghost:hover {
    border-color: var(--accent);
    background: rgba(99, 102, 241, 0.06);
  }
  .study__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .study__scroll-down {
    position: fixed;
    right: 1rem;
    bottom: 1.25rem;
    padding: 0.65rem 0.85rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
    cursor: pointer;
    font-weight: 600;
    transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
    z-index: 10;
  }
  .study__scroll-down:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 34px rgba(15, 23, 42, 0.16);
    border-color: var(--accent);
  }
  .study__spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: study-spin 0.8s linear infinite;
    margin: 0 auto 1rem;
  }
  .study__done {
    text-align: center;
    padding: 2rem;
  }
  .study__done h2 {
    font-size: 1.5rem;
    margin: 0 0 0.75rem 0;
  }
  .study__done p {
    color: var(--muted);
    margin: 0 0 1.5rem 0;
  }
  .study__change {
    padding: 1.25rem 1.5rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .study__change--summary {
    margin-bottom: 1rem;
  }
  .study__change--summary {
    margin-bottom: 1rem;
  }
  .study__change-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.25rem;
  }
  .study__change-label {
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }
  .study__chip-btn {
    background: rgba(148, 163, 184, 0.08);
    border-radius: 999px;
    border: none;
    padding: 0.25rem 0.7rem;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .study__chip-btn:hover {
    color: var(--text);
    background: rgba(148, 163, 184, 0.18);
  }
  .study__chip-btn--approve.is-active {
    background: rgba(34, 197, 94, 0.15);
    color: #16a34a;
    border: 1px solid rgba(22, 163, 74, 0.35);
  }
  .study__chip-btn--reject.is-active {
    background: rgba(239, 68, 68, 0.15);
    color: #dc2626;
    border: 1px solid rgba(220, 38, 38, 0.35);
  }
  @keyframes study-spin {
    to { transform: rotate(360deg); }
  }
`;
