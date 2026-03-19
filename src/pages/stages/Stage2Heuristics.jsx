import StageShell from './StageShell'

export default function Stage2Heuristics() {
  return (
    <StageShell
      title='Stage 2: Human + Heuristics'
      description='Add deterministic checks to the pipeline and compare them against human judgments.'
    >
      <div className='stage-card'>
        <h2>Planned in this stage</h2>
        <p>Automatic checks for HTML validity, preserved structure, and issue-completion signals.</p>
      </div>
    </StageShell>
  )
}
