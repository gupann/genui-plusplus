export default function ReviewSection({
  beforeScreen,
  currentIndex,
  changes,
  currentChange,
  currentResult,
  issueDraft,
  issueDirty,
  issueDraftError,
  providersForChange,
  requiredProvidersForChange,
  activeProvider,
  scopedSuccess,
  scopedFailure,
  providerStatus,
  missingProviders,
  approvalsByProvider,
  rankingById,
  ranksToShow,
  finishDisabled,
  onSubmit,
  setActiveProviderId,
  buildDownloadHref,
  handleDownloadFull,
  handleDownloadOriginal,
  triggerProviderGeneration,
  setProviderApproval,
  handleIframeLoad,
  addEntryForProvider,
  removeEntryForProvider,
  updateEntry,
  setSuccessById,
  setNotSuccessById,
  updateRanking,
  onIssueDraftChange,
  onApplyIssueUpdate,
}) {
  const provider = activeProvider;
  const providerResult = provider ? currentResult?.[provider.id] : null;
  const isLoading = providerResult?.loading;
  const error = providerResult?.error;
  const result = providerResult?.result;
  const code = result?.afterHtml || result?.afterCode || '';
  const successCountForProvider = scopedSuccess.length;
  const failureCountForProvider = scopedFailure.length;
  const rankingCurrent = rankingById[currentChange.id] || {};
  const approvalValue = approvalsByProvider[currentChange.id]?.[provider?.id];
  const normalizedOutcome =
    approvalValue === true
      ? 'passed'
      : approvalValue === false
        ? 'failed'
        : approvalValue || '';
  const getAssignedRank = (providerId) => {
    if (rankingCurrent[providerId]) return rankingCurrent[providerId];
    const legacyRankKey = Object.keys(rankingCurrent).find(
      (rank) => rankingCurrent[rank] === providerId,
    );
    return legacyRankKey || '';
  };

  return (
    <section className='study__section'>
      <h2>Evaluate change {currentIndex + 1} of {changes.length}</h2>
      <p className='study__hint'>
        Let&apos;s use your issue description for this small change to generate
        an updated screen. Tell us what is successful, what is not, and whether
        this result passed, partially passed, or failed as a designer. Each
        success or failure should be one thing to keep the feedback itemized.
      </p>

      <div className='study__change study__change--summary'>
        <div className='study__change-header'>
          <span className='study__change-label'>Provided issue</span>
          <button
            type='button'
            className='study__chip-btn'
            onClick={onApplyIssueUpdate}
            disabled={!issueDirty}
            title='Apply updated issue and reset generated outputs for this change'
          >
            Apply update
          </button>
        </div>
        <textarea
          className={`study__textarea${issueDraftError ? ' study__textarea--error' : ''}`}
          value={issueDraft}
          onChange={(e) => onIssueDraftChange(e.target.value)}
          rows={4}
          placeholder={`Problem: …\nLocation: …\nChange: …`}
        />
        <p className='study__hint' style={{ margin: 0 }}>
          When you apply an update, old model outputs for this change are cleared
          and re-generation will use the new issue text.
        </p>
        {issueDraftError && <p className='study__error-text'>{issueDraftError}</p>}
      </div>

      <form onSubmit={onSubmit} className='study__form'>
        <div className='study__llm-divider' aria-hidden='true' />
        <div className='study__compare-grid'>
          <section className='study__compare-col'>
            <h3 className='study__compare-label'>Original</h3>
            <div className='study__compare-actions'>
              <button
                type='button'
                className='study__chip-btn'
                onClick={() => handleDownloadOriginal(currentChange.id)}
              >
                Download
              </button>
            </div>
            <div className='study__compare-phone-slot'>
              <div className='study__compare-phone'>{beforeScreen}</div>
            </div>
          </section>

          {providersForChange.map((panelProvider) => {
            const panelResult = currentResult?.[panelProvider.id];
            const panelLoading = panelResult?.loading;
            const panelError = panelResult?.error;
            const panelOutput = panelResult?.result;
            const panelCode = panelOutput?.afterHtml || panelOutput?.afterCode || '';
            const panelDownloadHref = buildDownloadHref(panelCode);

            return (
              <section className='study__compare-col' key={panelProvider.id}>
                <h3 className='study__compare-label'>{panelProvider.label}</h3>
                <div className='study__compare-actions'>
                  {panelDownloadHref ? (
                    <button
                      type='button'
                      className='study__chip-btn'
                      onClick={() =>
                        handleDownloadFull(currentChange.id, panelProvider.id)
                      }
                    >
                      Download
                    </button>
                  ) : (
                    <span className='study__provider-status'>No code yet</span>
                  )}
                  <button
                    type='button'
                    className='study__chip-btn'
                    disabled={Boolean(panelLoading) || !currentChange?.problem?.trim()}
                    onClick={() =>
                      triggerProviderGeneration(panelProvider.id, { force: true })
                    }
                  >
                    Generate
                  </button>
                </div>

                <div className='study__compare-phone-slot'>
                  {panelLoading ? (
                    <div className='study__section--centered study__provider-state'>
                      <div className='study__spinner' aria-hidden />
                      <p>Generating…</p>
                    </div>
                  ) : panelError ? (
                    <div className='study__error' role='alert'>
                      {panelError}
                    </div>
                  ) : panelOutput ? (
                    <div className='study__screen-wrap study__screen-wrap--after'>
                      {panelOutput.afterImageUrl ? (
                        <img
                          src={panelOutput.afterImageUrl}
                          alt={`${panelProvider.label} after screen`}
                          className='study__img'
                        />
                      ) : panelCode ? (
                        <iframe
                          title={`${panelProvider.label} after screen`}
                          srcDoc={panelCode}
                          className='study__iframe'
                          sandbox='allow-same-origin allow-scripts'
                          scrolling='yes'
                          onLoad={(e) =>
                            handleIframeLoad(currentChange.id, panelProvider.id, e)
                          }
                        />
                      ) : (
                        <div className='study__img-placeholder'>
                          No output returned.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className='study__img-placeholder'>No output returned.</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {!providerStatus.loading && missingProviders.length > 0 && (
          <div className='study__provider-note'>
            Missing API keys: {missingProviders.map((p) => p.label).join(', ')}.
            Those providers are hidden.
          </div>
        )}
        {providerStatus.error && (
          <div className='study__provider-note study__provider-note--error'>
            {providerStatus.error}
          </div>
        )}

        <div className='study__tabs'>
          {providersForChange.map((tabProvider) => (
            <button
              key={tabProvider.id}
              type='button'
              className={`study__tab${tabProvider.id === provider?.id ? ' is-active' : ''}`}
              onClick={() => setActiveProviderId(tabProvider.id)}
            >
              Feedback: {tabProvider.label}
            </button>
          ))}
        </div>

        {provider && (
          <>
            <div className='study__llm-divider' aria-hidden='true' />
            <div className='study__label study__provider-approve'>
              <div className='study__label-row'>
                <span>
                  Rate the outcome for {provider.label}&apos;s output:
                </span>
                <div className='study__provider-approve-actions'>
                  <button
                    type='button'
                    className={`study__chip-btn study__chip-btn--approve study__chip-btn--decision${normalizedOutcome === 'passed' ? ' is-active' : ''}`}
                    disabled={!result || isLoading || error}
                    onClick={() =>
                      result &&
                      setProviderApproval(
                        currentChange.id,
                        provider.id,
                        'passed',
                      )
                    }
                  >
                    ✅ Passed
                  </button>
                  <button
                    type='button'
                    className={`study__chip-btn study__chip-btn--partial study__chip-btn--decision${normalizedOutcome === 'partially_passed' ? ' is-active' : ''}`}
                    disabled={!result || isLoading || error}
                    onClick={() =>
                      result &&
                      setProviderApproval(
                        currentChange.id,
                        provider.id,
                        'partially_passed',
                      )
                    }
                  >
                    🟡 Partially passed
                  </button>
                  <button
                    type='button'
                    className={`study__chip-btn study__chip-btn--reject study__chip-btn--decision${normalizedOutcome === 'failed' ? ' is-active' : ''}`}
                    disabled={!result || isLoading || error}
                    onClick={() =>
                      result &&
                      setProviderApproval(
                        currentChange.id,
                        provider.id,
                        'failed',
                      )
                    }
                  >
                    ❌ Failed
                  </button>
                </div>
              </div>
              <div className='study__rubric-box study__rubric-box--compact'>
                <p className='study__rubric-copy'>
                  <strong>PASSED</strong>: solves the requested change,
                  preserves unrelated UI, no meaningful issues.
                </p>
                <p className='study__rubric-copy'>
                  <strong>PARTIALLY PASSED</strong>: addresses the main request
                  but has minor issues, omissions, or small unrelated changes.
                </p>
                <p className='study__rubric-copy'>
                  <strong>FAILED</strong>: misses the request, breaks
                  layout/behavior, or makes substantial unrelated changes.
                </p>
              </div>
            </div>
            <div className='study__feedback-grid'>
              <div className='study__label'>
                <div className='study__label-row'>
                  <span>What did {provider.label} do well? Be specific.</span>
                  <button
                    type='button'
                    className='study__add-btn'
                    onClick={() =>
                      addEntryForProvider(
                        setSuccessById,
                        currentChange.id,
                        provider.id,
                      )
                    }
                    aria-label='Add another successful point'
                    title='Add another success'
                  >
                    +
                  </button>
                </div>
                <p className='study__hint study__hint--compact'>
                  Good feedback mentions specific elements, layout choices,
                  behavior, or constraints the model handled correctly.
                </p>
                {scopedSuccess.map(({ entry, index }, scopedIndex) => (
                  <div
                    key={`success-${currentChange.id}-${provider.id}-${scopedIndex}`}
                    className='study__entry'
                  >
                    <div className='study__entry-header'>
                      <span className='study__entry-label'>
                        Success {scopedIndex + 1}
                      </span>
                      <button
                        type='button'
                        className='study__chip-btn'
                        disabled={successCountForProvider <= 1}
                        onClick={() =>
                          removeEntryForProvider(
                            setSuccessById,
                            currentChange.id,
                            provider.id,
                            index,
                          )
                        }
                        aria-label='Remove this successful point'
                        title='Remove entry'
                      >
                        Remove
                      </button>
                    </div>
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
                      placeholder={`e.g. Preserved the existing layout while changing only the relevant element.\nAdded the requested control without moving unrelated components.\nMatched the existing spacing, typography, and visual style.`}
                    />
                  </div>
                ))}
              </div>

              <div className='study__label study__feedback-col--failure'>
                <div className='study__label-row'>
                  <span>
                    What problems did {provider.label} introduce or fail to
                    fix?
                  </span>
                  <button
                    type='button'
                    className='study__add-btn'
                    onClick={() =>
                      addEntryForProvider(
                        setNotSuccessById,
                        currentChange.id,
                        provider.id,
                      )
                    }
                    aria-label='Add another unsuccessful point'
                    title='Add another issue'
                  >
                    +
                  </button>
                </div>
                <p className='study__hint study__hint--compact'>
                  Look for unrelated changes, broken alignment, missing
                  behavior, ignored instructions, or inconsistency with the
                  existing design.
                </p>
                {scopedFailure.map(({ entry, index }, scopedIndex) => (
                  <div
                    key={`not-success-${currentChange.id}-${provider.id}-${scopedIndex}`}
                    className='study__entry'
                  >
                    <div className='study__entry-header'>
                      <span className='study__entry-label'>
                        Issue {scopedIndex + 1}
                      </span>
                      <button
                        type='button'
                        className='study__chip-btn'
                        disabled={failureCountForProvider <= 1}
                        onClick={() =>
                          removeEntryForProvider(
                            setNotSuccessById,
                            currentChange.id,
                            provider.id,
                            index,
                          )
                        }
                        aria-label='Remove this unsuccessful point'
                        title='Remove entry'
                      >
                        Remove
                      </button>
                    </div>
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
                      placeholder={`e.g. Moved unrelated elements that should have stayed the same.\nAdded the control, but did not define or show the interaction behavior.\nChanged the visual style in a way that no longer matches the original UI.`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className='study__llm-divider' aria-hidden='true' />
        <fieldset className='study__fieldset'>
          <legend className='study__label'>
            Rank each model with output (1 = best, ties allowed, use consecutive ranks)
          </legend>
          <div className='study__rubric-box study__rubric-box--compact'>
            <p className='study__rubric-title'>Rank outputs based on:</p>
            <ol className='study__rubric-list study__rubric-list--ordered'>
              <li>correctness: did it satisfy the requested change?</li>
              <li>minimality: did it avoid unnecessary edits?</li>
              <li>consistency: does it match the existing UI?</li>
              <li>completeness: are placement and behavior clear?</li>
            </ol>
            <p className='study__rubric-copy'>
              Do not rank based only on which output looks coolest or most
              redesigned.
            </p>
          </div>
          <p className='study__hint' style={{ margin: '0 0 0.5rem 0' }}>
            Only models that successfully generated output are required.
            Example: 1,1,2 is valid. 1,1,3 is not.
          </p>
          <div className='study__rank-grid'>
            {requiredProvidersForChange.map((rankProvider) => (
              <label key={rankProvider.id} className='study__rank-row'>
                <span>{rankProvider.label}</span>
                <select
                  className='study__select'
                  value={getAssignedRank(rankProvider.id)}
                  onChange={(e) =>
                    updateRanking(currentChange.id, rankProvider.id, e.target.value)
                  }
                >
                  <option value=''>Select rank</option>
                  {Array.from(
                    { length: Math.max(ranksToShow, 1) },
                    (_, idx) => idx + 1,
                  ).map((rank) => (
                    <option key={rank} value={String(rank)}>
                      Rank {rank}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {requiredProvidersForChange.length === 0 && (
              <p className='study__hint' style={{ margin: 0 }}>
                No generated outputs to rank yet.
              </p>
            )}
          </div>
        </fieldset>

        <button
          type='submit'
          className='study__btn study__btn--primary'
          disabled={finishDisabled}
        >
          {currentIndex < changes.length - 1 ? 'Next change' : 'Finish case study'}
        </button>
      </form>
    </section>
  );
}
