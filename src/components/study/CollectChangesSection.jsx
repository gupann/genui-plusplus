export default function CollectChangesSection({
  changes,
  validationById,
  hasMissingRequired,
  onStartReview,
  onAddChange,
  onRemoveChange,
  onChangeField,
}) {
  return (
    <section className='study__section'>
      <h2>Small changes</h2>
      <p className='study__hint'>
        Add as many small changes as you like. Each row is one small,
        incremental change (e.g. move a button, adjust copy, tweak spacing,
        etc.).
      </p>
      <p className='study__hint'>What is the small change or issue?</p>
      <p className='study__hint'>
        We&apos;ll convert each issue into a concrete UI revision prompt
        internally.
      </p>

      <form onSubmit={onStartReview} className='study__form'>
        {changes.map((change, index) => (
          <div key={change.id} className='study__entry'>
            <div className='study__entry-header'>
              <span className='study__entry-label'>Issue {index + 1}</span>
              {changes.length > 1 && (
                <button
                  type='button'
                  className='study__chip-btn'
                  onClick={() => onRemoveChange(change.id)}
                >
                  Remove
                </button>
              )}
            </div>

            <label className='study__label'>
              <textarea
                className={`study__textarea${validationById[change.id]?.problem ? ' study__textarea--error' : ''}`}
                value={change.problem}
                onChange={(e) => onChangeField(index, 'problem', e.target.value)}
                rows={2}
                placeholder='e.g. The primary button is too low in the hierarchy; move it closer to the form.'
              />
              {validationById[change.id]?.problem && (
                <span className='study__error-text'>
                  {validationById[change.id].problem}
                </span>
              )}
            </label>
          </div>
        ))}

        <button
          type='button'
          className='study__btn study__btn--ghost'
          onClick={onAddChange}
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
  );
}
