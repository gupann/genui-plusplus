import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { generateAfterScreen } from '../services/api'

// Placeholder image per task. Replace with your images in public/ e.g. task1-before.png
function getBeforeImageUrl(taskId) {
  return `/task${taskId}-before.png`
}

export default function Study() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const id = parseInt(taskId, 10) || 1

  const [beforeImageFailed, setBeforeImageFailed] = useState(false)
  const [changes, setChanges] = useState([{ id: 1, problem: '', prompt: '' }])
  const [phase, setPhase] = useState('collect') // 'collect' | 'review' | 'done'
  const [currentIndex, setCurrentIndex] = useState(0)
  const [validationById, setValidationById] = useState({})

  // Per-change generation + feedback
  const [resultsById, setResultsById] = useState({})
  const [successById, setSuccessById] = useState({})
  const [notSuccessById, setNotSuccessById] = useState({})
  const [approvedById, setApprovedById] = useState({})

  const beforeImageUrl = getBeforeImageUrl(id)

  function handleChangeField(index, field, value) {
    setChanges((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
    setValidationById((prev) => {
      const changeId = changes[index]?.id
      if (!changeId) return prev
      const next = { ...prev }
      const trimmed = value.trim()
      if (trimmed) {
        next[changeId] = { ...(next[changeId] || {}) }
        delete next[changeId][field]
        if (Object.keys(next[changeId]).length === 0) {
          delete next[changeId]
        }
      }
      return next
    })
  }

  function handleAddChange() {
    setChanges((prev) => [
      ...prev,
      { id: prev.length ? prev[prev.length - 1].id + 1 : 1, problem: '', prompt: '' },
    ])
  }

  function handleRemoveChange(idToRemove) {
    setChanges((prev) => prev.filter((c) => c.id !== idToRemove))
    setValidationById((prev) => {
      if (!prev[idToRemove]) return prev
      const next = { ...prev }
      delete next[idToRemove]
      return next
    })
  }

  function handleStartReview(e) {
    e.preventDefault()
    const errors = {}
    changes.forEach((c) => {
      const problemEmpty = !c.problem.trim()
      const promptEmpty = !c.prompt.trim()
      if (problemEmpty || promptEmpty) {
        errors[c.id] = {}
        if (problemEmpty) errors[c.id].problem = 'Please describe the change.'
        if (promptEmpty) errors[c.id].prompt = 'Please add an AI prompt.'
      }
    })
    if (Object.keys(errors).length > 0) {
      setValidationById(errors)
      return
    }
    setPhase('review')
    setCurrentIndex(0)
    // eslint-disable-next-line no-console
    console.log('Saved changes for task', id, changes)
  }

  // Trigger generation for current change when entering review phase / moving to next change
  useEffect(() => {
    if (phase !== 'review') return
    const current = changes[currentIndex]
    if (!current) return
    if (resultsById[current.id]?.done || resultsById[current.id]?.loading) return

    let cancelled = false
    async function run() {
      setResultsById((prev) => ({
        ...prev,
        [current.id]: { ...(prev[current.id] || {}), loading: true, error: null },
      }))
      try {
        const result = await generateAfterScreen({
          taskId: id,
          prompt: current.prompt,
          beforeImageUrl,
        })
        if (cancelled) return
        setResultsById((prev) => ({
          ...prev,
          [current.id]: { ...(prev[current.id] || {}), loading: false, done: true, result },
        }))
      } catch (err) {
        if (cancelled) return
        setResultsById((prev) => ({
          ...prev,
          [current.id]: {
            ...(prev[current.id] || {}),
            loading: false,
            done: true,
            error: err.message || 'Failed to generate screen.',
          },
        }))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [phase, currentIndex, changes, beforeImageUrl, id, resultsById])

  function handleNextChange() {
    if (currentIndex < changes.length - 1) {
      setCurrentIndex((i) => i + 1)
    } else {
      // End of all changes
      setPhase('done')
      // eslint-disable-next-line no-console
      console.log('Completed review for task', id, {
        changes,
        successById,
        notSuccessById,
        approvedById,
      })
    }
  }

  if (phase === 'done') {
    return (
      <div className="study study--centered">
        <div className="study__done">
          <h2>Thank you</h2>
          <p>
            Your small changes, prompts, and evaluations have been captured for this case study. You can start another
            case study or close this page.
          </p>
          <button type="button" className="study__btn study__btn--primary" onClick={() => navigate('/')}>
            Back to case studies
          </button>
        </div>
        <style>{studyStyles}</style>
      </div>
    )
  }

  const isCollect = phase === 'collect'
  const currentChange = changes[currentIndex]
  const currentResult = currentChange ? resultsById[currentChange.id] : null
  const hasMissingRequired = changes.some((c) => !c.problem.trim() || !c.prompt.trim())

  return (
    <div className="study">
      <header className="study__header">
        <button type="button" className="study__back" onClick={() => navigate('/')}>
          ← Case studies
        </button>
        <h1>Case Study {id}</h1>
      </header>

      <section className="study__section">
        <h2>Screen</h2>
        <p className="study__hint">
          Look at this screen and identify small, incremental changes you would make. For each change, describe the
          problem and write the exact AI prompt you would use to implement it.
        </p>
        <div className="study__screen-wrap">
          {beforeImageFailed ? (
            <div className="study__img-placeholder">
              Add your screenshot as <code>public/task{id}-before.png</code> (or .jpg)
            </div>
          ) : (
            <img
              src={beforeImageUrl}
              alt="Screen for this case study"
              className="study__img"
              onError={() => setBeforeImageFailed(true)}
            />
          )}
        </div>
      </section>

      {isCollect ? (
        <section className="study__section">
          <h2>Small changes and AI prompts</h2>
          <p className="study__hint">
            Add as many small changes as you like. Each row is one small, incremental change (e.g. move a button,
            adjust copy, tweak spacing, etc.) with the corresponding AI prompt you&apos;d send to your design agent.
          </p>

          <form onSubmit={handleStartReview} className="study__form">
            {changes.map((change, index) => (
              <div key={change.id} className="study__change">
                <div className="study__change-header">
                  <span className="study__change-label">Change {index + 1}</span>
                  {changes.length > 1 && (
                    <button
                      type="button"
                      className="study__chip-btn"
                      onClick={() => handleRemoveChange(change.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <label className="study__label">
                  What is the small change or issue?
                  <textarea
                    className={`study__textarea${validationById[change.id]?.problem ? ' study__textarea--error' : ''}`}
                    value={change.problem}
                    onChange={(e) => handleChangeField(index, 'problem', e.target.value)}
                    rows={2}
                    placeholder="e.g. The primary button is too low in the hierarchy; move it closer to the form."
                  />
                  {validationById[change.id]?.problem && (
                    <span className="study__error-text">{validationById[change.id].problem}</span>
                  )}
                </label>

                <label className="study__label">
                  AI prompt you would use for this change
                  <textarea
                    className={`study__textarea${validationById[change.id]?.prompt ? ' study__textarea--error' : ''}`}
                    value={change.prompt}
                    onChange={(e) => handleChangeField(index, 'prompt', e.target.value)}
                    rows={2}
                    placeholder='e.g. "Move the primary submit button directly below the last form field and increase its size by 10%."'
                  />
                  {validationById[change.id]?.prompt && (
                    <span className="study__error-text">{validationById[change.id].prompt}</span>
                  )}
                </label>
              </div>
            ))}

            <button type="button" className="study__btn study__btn--ghost" onClick={handleAddChange}>
              + Add another small change
            </button>

            <button type="submit" className="study__btn study__btn--primary" disabled={hasMissingRequired}>
              Save changes and start evaluation
            </button>
          </form>
        </section>
      ) : (
        <section className="study__section">
          <h2>
            Evaluate change {currentIndex + 1} of {changes.length}
          </h2>
          <p className="study__hint">
            We used your AI prompt for this small change to generate an updated screen. Tell us what is successful,
            what is not, and whether you would approve this result as a designer.
          </p>

          <div className="study__change study__change--summary">
            <div className="study__change-header">
              <span className="study__change-label">Original change</span>
            </div>
            <p className="study__meta-label">Issue / small change</p>
            <p className="study__meta-body">{currentChange.problem || <em>(No description provided)</em>}</p>
            <p className="study__meta-label">AI prompt</p>
            <p className="study__meta-body">{currentChange.prompt || <em>(No prompt provided)</em>}</p>
          </div>

          <div className="study__screen-wrap study__screen-wrap--after">
            {currentResult?.loading && (
              <div className="study__section--centered">
                <div className="study__spinner" aria-hidden />
                <p>Generating the after screen…</p>
              </div>
            )}
            {currentResult?.error && !currentResult.loading && (
              <div className="study__error" role="alert">
                {currentResult.error}
              </div>
            )}
            {currentResult?.result && !currentResult.loading && !currentResult.error && (
              <>
                {currentResult.result.afterImageUrl ? (
                  <img
                    src={currentResult.result.afterImageUrl}
                    alt="Screen after applying this change"
                    className="study__img"
                  />
                ) : (currentResult.result.afterHtml || currentResult.result.afterCode) ? (
                  <iframe
                    title="After screen"
                    srcDoc={currentResult.result.afterHtml || currentResult.result.afterCode}
                    className="study__iframe"
                    sandbox="allow-same-origin"
                  />
                ) : null}
              </>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleNextChange()
            }}
            className="study__form"
          >
            <label className="study__label">
              What is successful about this result?
              <textarea
                className="study__textarea"
                value={successById[currentChange.id] || ''}
                onChange={(e) =>
                  setSuccessById((prev) => ({ ...prev, [currentChange.id]: e.target.value }))
                }
                rows={3}
                placeholder="e.g. The new button position makes it easier to find; the color and hierarchy are correct."
              />
            </label>

            <label className="study__label">
              What is not successful about this result?
              <textarea
                className="study__textarea"
                value={notSuccessById[currentChange.id] || ''}
                onChange={(e) =>
                  setNotSuccessById((prev) => ({ ...prev, [currentChange.id]: e.target.value }))
                }
                rows={3}
                placeholder="e.g. Other unrelated elements moved; typography changed unexpectedly; spacing is off."
              />
            </label>

            <fieldset className="study__fieldset">
              <legend className="study__label">Would you approve this screen as a designer?</legend>
              <div className="study__radio-row">
                <label className="study__radio-label">
                  <input
                    type="radio"
                    name={`approve-${currentChange.id}`}
                    checked={approvedById[currentChange.id] === true}
                    onChange={() =>
                      setApprovedById((prev) => ({ ...prev, [currentChange.id]: true }))
                    }
                  />
                  <span>Yes, I would approve it</span>
                </label>
                <label className="study__radio-label">
                  <input
                    type="radio"
                    name={`approve-${currentChange.id}`}
                    checked={approvedById[currentChange.id] === false}
                    onChange={() =>
                      setApprovedById((prev) => ({ ...prev, [currentChange.id]: false }))
                    }
                  />
                  <span>No, I would not approve it</span>
                </label>
              </div>
            </fieldset>

            <button type="submit" className="study__btn study__btn--primary">
              {currentIndex < changes.length - 1 ? 'Next change' : 'Finish case study'}
            </button>
          </form>
        </section>
      )}

      <style>{studyStyles}</style>
    </div>
  )
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
  .study__screen-wrap--after {
    min-height: 200px;
  }
  .study__img {
    display: block;
    max-width: 100%;
    height: auto;
    min-height: 120px;
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
  @keyframes study-spin {
    to { transform: rotate(360deg); }
  }
`
