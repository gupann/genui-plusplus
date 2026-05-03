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
        Add small, specific UI issues, one per row.
      </p>
      <p className='study__hint'>
        Each issue should describe what is wrong, where it is on the screen,
        and what exact change should be made. Focus on small revisions, not
        full redesigns.
      </p>
      <div className='study__rubric-box'>
        <p className='study__rubric-title'>Good revision issues are:</p>
        <ul className='study__rubric-list'>
          <li>specific: mention the exact UI element</li>
          <li>localized: describe a small change, not a full redesign</li>
          <li>justified: explain why the change matters</li>
          <li>minimal: avoid changing unrelated parts of the UI</li>
        </ul>
        <div className='study__rubric-examples'>
          <div>
            <p className='study__rubric-subtitle'>Good</p>
            <ul className='study__rubric-list'>
              <li>
                The upvote button is hard to see in the action bar. Increase
                contrast and keep it aligned with the other action icons.
              </li>
              <li>
                The post metadata is visually crowded under the title. Add
                spacing between subreddit, author, and timestamp.
              </li>
            </ul>
          </div>
          <div>
            <p className='study__rubric-subtitle'>Bad</p>
            <ul className='study__rubric-list'>
              <li>Make it better</li>
              <li>Fix the layout</li>
              <li>Make it cleaner</li>
            </ul>
          </div>
        </div>
      </div>

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
                rows={4}
                placeholder={`Problem: …\nLocation: …\nChange: …`}
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
