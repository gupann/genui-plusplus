import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { useCaseStudyAssets } from '../hooks/useCaseStudyAssets';
import { useProviderCatalog } from '../hooks/useProviderCatalog';
import { useStudyGeneration } from '../hooks/useStudyGeneration';
import { useStudyEvaluation } from '../hooks/useStudyEvaluation';
import CollectChangesSection from '../components/study/CollectChangesSection';
import ReviewSection from '../components/study/ReviewSection';

export default function Study({ listPath = '/user-study' }) {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const id = parseInt(taskId, 10) || 1;

  const {
    beforeCode,
    beforeImageUrl,
    beforeImageFailed,
    setBeforeImageFailed,
  } = useCaseStudyAssets(id);
  const [changes, setChanges] = useState([{ id: 1, problem: '' }]);
  const [phase, setPhase] = useState('collect'); // 'collect' | 'review' | 'done'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [validationById, setValidationById] = useState({});

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
      if (problemEmpty) {
        errors[c.id] = {};
        if (problemEmpty) errors[c.id].problem = 'Please describe the change.';
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

  const { providerStatus, availableProviders, missingProviders } =
    useProviderCatalog();

  const { resultsById, triggerProviderGeneration, handleIframeLoad } =
    useStudyGeneration({
      taskId: id,
      changes,
      currentIndex,
      beforeImageUrl,
      beforeCode,
    });

  function buildDownloadHref(code) {
    if (!code) return '';
    return `data:text/html;charset=utf-8,${encodeURIComponent(code)}`;
  }

  async function handleDownloadFull(changeId, providerId) {
    const change = changes.find((c) => c.id === changeId);
    const providerResult = resultsById[changeId]?.[providerId]?.result;
    const code = providerResult?.afterHtml || providerResult?.afterCode || '';
    const issueText = change?.problem || '';
    const zip = new JSZip();
    zip.file(
      `before-task-${changeId}.html`,
      beforeCode || '<!-- no before code found -->',
    );
    zip.file(`task-${changeId}-issue.txt`, issueText || '(no issue provided)');
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

  async function handleDownloadOriginal(changeId) {
    const change = changes.find((c) => c.id === changeId);
    const issueText = change?.problem || '';
    const zip = new JSZip();

    zip.file(
      `before-task-${changeId}.html`,
      beforeCode || '<!-- no before code found -->',
    );
    zip.file(`task-${changeId}-issue.txt`, issueText || '(no issue provided)');

    if (beforeImageUrl) {
      try {
        const response = await fetch(beforeImageUrl);
        if (response.ok) {
          const blob = await response.blob();
          const extFromPath = beforeImageUrl.split('.').pop()?.toLowerCase();
          const ext =
            extFromPath && ['png', 'jpg', 'jpeg', 'webp'].includes(extFromPath)
              ? extFromPath
              : blob.type.includes('jpeg')
                ? 'jpg'
                : blob.type.includes('webp')
                  ? 'webp'
                  : 'png';
          zip.file(`before-task-${changeId}.${ext}`, blob);
        }
      } catch {
        // If the image is missing/unreadable, still allow HTML + task text download.
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `task-${changeId}-original.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
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
        successById: evaluation.successById,
        notSuccessById: evaluation.notSuccessById,
        approvalsByProvider: evaluation.approvalsByProvider,
        rankingById: evaluation.rankingById,
      });
      navigate(listPath, { replace: true });
    }
  }

  if (phase === 'done') {
    return (
      <div className='study study--centered'>
        <div className='study__done'>
          <h2>Thank you</h2>
          <p>
            Your small changes, evaluations, and rankings have been captured for
            this case study. You can start another case study or close this
            page.
          </p>
          <button
            type='button'
            className='study__btn study__btn--primary'
            onClick={() => navigate(listPath)}
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
  const currentResult = currentChange
    ? resultsById[currentChange.id] || {}
    : {};

  const evaluation = useStudyEvaluation({
    phase,
    changes,
    currentIndex,
    availableProviders,
  });

  function scrollToBottom() {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  }

  const hasMissingRequired = changes.some((c) => !c.problem.trim());
  const providersForChange = evaluation.providersForChange;
  const finishDisabled =
    hasMissingRequired ||
    !evaluation.approvalsComplete ||
    !evaluation.rankingComplete ||
    !evaluation.successComplete ||
    !evaluation.failureComplete;

  const beforeScreen = (
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
          Add your screenshot as{' '}
          <code>
            public/case-study-{id}/task{id}-before.png
          </code>{' '}
          (or .jpg). Optional code:{' '}
          <code>
            public/case-study-{id}/task{id}-before.html
          </code>
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
  );

  return (
    <div className={`study${isCollect ? ' study--collect' : ' study--review'}`}>
      <header className='study__header'>
        <button
          type='button'
          className='study__back'
          onClick={() => navigate(listPath)}
        >
          ← Case studies
        </button>
        <h1>Case Study {id}</h1>
      </header>

      {isCollect ? (
        <section className='study__collect-layout'>
          <aside className='study__collect-preview'>
            <h2>Screen</h2>
            <p className='study__hint'>
              Scroll through this screen and identify small, incremental changes
              you would make. For each change, describe the issue you want
              fixed.
            </p>
            {beforeScreen}
          </aside>
          <CollectChangesSection
            changes={changes}
            validationById={validationById}
            hasMissingRequired={hasMissingRequired}
            onStartReview={handleStartReview}
            onAddChange={handleAddChange}
            onRemoveChange={handleRemoveChange}
            onChangeField={handleChangeField}
          />
        </section>
      ) : (
        <ReviewSection
          beforeScreen={beforeScreen}
          currentIndex={currentIndex}
          changes={changes}
          currentChange={currentChange}
          currentResult={currentResult}
          providersForChange={providersForChange}
          activeProvider={evaluation.activeProvider}
          scopedSuccess={evaluation.scopedSuccess}
          scopedFailure={evaluation.scopedFailure}
          providerStatus={providerStatus}
          missingProviders={missingProviders}
          approvalsByProvider={evaluation.approvalsByProvider}
          rankingById={evaluation.rankingById}
          ranksToShow={evaluation.ranksToShow}
          finishDisabled={finishDisabled}
          onSubmit={(e) => {
            e.preventDefault();
            handleNextChange();
          }}
          setActiveProviderId={evaluation.setActiveProviderId}
          buildDownloadHref={buildDownloadHref}
          handleDownloadFull={handleDownloadFull}
          handleDownloadOriginal={handleDownloadOriginal}
          triggerProviderGeneration={triggerProviderGeneration}
          setProviderApproval={evaluation.setProviderApproval}
          handleIframeLoad={handleIframeLoad}
          addEntryForProvider={evaluation.addEntryForProvider}
          removeEntryForProvider={evaluation.removeEntryForProvider}
          updateEntry={evaluation.updateEntry}
          setSuccessById={evaluation.setSuccessById}
          setNotSuccessById={evaluation.setNotSuccessById}
          updateRanking={evaluation.updateRanking}
        />
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
  .study--collect {
    max-width: 1200px;
  }
  .study--review {
    max-width: 1400px;
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
  .study__collect-layout {
    display: grid;
    grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }
  .study__collect-preview {
    position: static;
  }
  .study__collect-preview h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }
  .study__collect-preview .study__hint {
    margin: 0 0 1rem 0;
  }
  .study__collect-preview .study__screen-wrap {
    margin: 0;
  }
  .study__collect-layout > .study__section {
    margin-top: 0;
  }
  .study__compare-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-items: start;
    margin: 0 0 1rem 0;
  }
  .study__compare-col {
    min-width: 0;
    padding: 0 0.75rem;
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .study__compare-col:first-child {
    border-left: none;
    padding-left: 0;
  }
  .study__compare-col:last-child {
    padding-right: 0;
  }
  .study__compare-label {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
    width: min(100%, 320px);
  }
  .study__compare-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin: 0 0 0.75rem 0;
    min-height: 32px;
    width: min(100%, 320px);
  }
  .study__compare-phone-slot {
    width: min(100%, 320px);
    aspect-ratio: 375 / 812;
  }
  .study__compare-phone-slot > .study__screen-wrap,
  .study__compare-phone .study__screen-wrap {
    width: 100%;
    height: 100%;
    margin: 0;
  }
  .study__compare-phone-slot > .study__provider-state,
  .study__compare-phone-slot > .study__error,
  .study__compare-phone-slot > .study__img-placeholder {
    width: 100%;
    height: 100%;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: 2rem;
    background: rgba(148, 163, 184, 0.04);
    text-align: center;
    padding: 1rem;
  }
  .study__compare-phone .study__screen-wrap {
    margin: 0;
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
    width: min(100%, 320px);
    max-width: 100%;
    aspect-ratio: 375 / 812;
    margin: 0 auto 1.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 2rem;
    overflow: auto;
    box-shadow:
      0 14px 30px rgba(15, 23, 42, 0.2),
      inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  }
  .study__screen-wrap--before {
    background: linear-gradient(180deg, rgba(148, 163, 184, 0.08) 0%, rgba(148, 163, 184, 0.04) 100%);
  }
  .study__screen-wrap--after {
    background: linear-gradient(180deg, rgba(148, 163, 184, 0.08) 0%, rgba(148, 163, 184, 0.04) 100%);
  }
  .study__llm-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.55), transparent);
    margin: 0.25rem 0 1.25rem 0;
  }
  .study__tabs {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 0.5rem;
    margin: 0 0 1rem 0;
  }
  .study__tab {
    padding: 0.65rem 0.75rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: rgba(148, 163, 184, 0.06);
    color: var(--muted);
    cursor: pointer;
    font-weight: 600;
    transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
  }
  .study__tab:hover {
    background: rgba(148, 163, 184, 0.12);
    color: var(--text);
  }
  .study__tab.is-active {
    background: rgba(99, 102, 241, 0.12);
    border-color: rgba(99, 102, 241, 0.5);
    color: var(--text);
  }
  .study__tab-panel {
    display: grid;
    gap: 1.25rem;
  }
  .study__providers-actions {
    display: flex;
    justify-content: flex-end;
  }
  .study__providers-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(400px, 1fr));
    gap: 1rem;
  }
  .study__provider-card {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: rgba(148, 163, 184, 0.06);
    overflow: hidden;
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
    margin: 0;
    padding: 0;
    color: inherit;
    font-size: inherit;
  }
  .study__provider-approve-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
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
    padding: 1rem 0;
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
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #f8f9fb;
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
    height: 100%;
    padding: 1.25rem;
    color: var(--muted);
    font-size: 0.9rem;
    text-align: center;
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
    height: 100%;
    border: none;
    display: block;
    overflow: auto;
    background: #f8f9fb;
  }
  .study__iframe--before {
    height: 100%;
  }
  @media (max-width: 1360px) {
    .study__compare-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }
    .study__compare-col {
      border-left: none;
      border-top: 1px solid var(--border);
      padding: 1rem 0 0 0;
    }
    .study__compare-col:first-child {
      border-top: none;
      padding-top: 0;
    }
  }
  @media (max-width: 1200px) {
    .study__screen-wrap,
    .study__compare-phone-slot,
    .study__compare-label,
    .study__compare-actions {
      width: min(100%, 280px);
    }
  }
  @media (max-width: 900px) {
    .study__collect-layout {
      grid-template-columns: 1fr;
    }
    .study__collect-preview {
      position: static;
    }
    .study__compare-grid {
      grid-template-columns: 1fr;
    }
    .study__screen-wrap {
      width: 100%;
      max-width: 100%;
    }
  }
  @media (max-width: 780px) {
    .study {
      padding: 1rem;
    }
    .study__feedback-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    .study__feedback-col--failure {
      border-left: none;
      border-top: 1px solid var(--border);
      padding-left: 0;
      padding-top: 1rem;
    }
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
  .study__feedback-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.5rem;
    align-items: start;
  }
  .study__feedback-col--failure {
    border-left: 1px solid var(--border);
    padding-left: 1.5rem;
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
  .study__chip-btn--decision {
    padding: 0.45rem 0.85rem;
    font-size: 0.95rem;
    font-weight: 600;
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
