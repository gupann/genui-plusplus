export default function ReviewSection({
  beforeScreen,
  currentIndex,
  changes,
  currentChange,
  currentResult,
  providersForChange,
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
}) {
  const provider = activeProvider;
  const providerResult = provider ? currentResult?.[provider.id] : null;
  const isLoading = providerResult?.loading;
  const error = providerResult?.error;
  const result = providerResult?.result;
  const code = result?.afterHtml || result?.afterCode || '';
  const successCountForProvider = scopedSuccess.length;
  const failureCountForProvider = scopedFailure.length;

  return (
    <section className='study__section'>
      <h2>Evaluate change {currentIndex + 1} of {changes.length}</h2>
      <p className='study__hint'>
        Let&apos;s use your issue description for this small change to generate
        an updated screen. Tell us what is successful, what is not, and whether
        you would approve this result as a designer. Each success or failure
        should be one thing to keep the feedback itemized.
      </p>

      <div className='study__change study__change--summary'>
        <div className='study__change-header'>
          <span className='study__change-label'>Provided issue</span>
        </div>
        <p className='study__meta-body study__meta-body--single'>
          {currentChange.problem || <em>(No issue provided)</em>}
        </p>
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
                    disabled={Boolean(panelLoading)}
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
                  Let us know whether you&apos;d approve this output by{' '}
                  {provider.label}:
                </span>
                <div className='study__provider-approve-actions'>
                  <button
                    type='button'
                    className={`study__chip-btn study__chip-btn--approve study__chip-btn--decision${approvalsByProvider[currentChange.id]?.[provider.id] === true ? ' is-active' : ''}`}
                    disabled={!result || isLoading || error}
                    onClick={() =>
                      result &&
                      setProviderApproval(currentChange.id, provider.id, true)
                    }
                  >
                    ✅ Approve
                  </button>
                  <button
                    type='button'
                    className={`study__chip-btn study__chip-btn--reject study__chip-btn--decision${approvalsByProvider[currentChange.id]?.[provider.id] === false ? ' is-active' : ''}`}
                    disabled={!result || isLoading || error}
                    onClick={() =>
                      result &&
                      setProviderApproval(currentChange.id, provider.id, false)
                    }
                  >
                    ❌ Disapprove
                  </button>
                </div>
              </div>
            </div>
            <div className='study__feedback-grid'>
              <div className='study__label'>
                <div className='study__label-row'>
                  <span>
                    What is successful about {provider.label}&apos;s output?
                  </span>
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
                      placeholder='e.g. The new button position makes it easier to find.'
                    />
                  </div>
                ))}
              </div>

              <div className='study__label study__feedback-col--failure'>
                <div className='study__label-row'>
                  <span>
                    What is not successful about {provider.label}
                    &apos;s output?
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
                      placeholder='e.g. Other unrelated elements moved.'
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className='study__llm-divider' aria-hidden='true' />
        <fieldset className='study__fieldset'>
          <legend className='study__label'>Rank the model outputs (1 = best)</legend>
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
                  {providersForChange.map((p) => (
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
          {currentIndex < changes.length - 1 ? 'Next change' : 'Finish case study'}
        </button>
      </form>
    </section>
  );
}
