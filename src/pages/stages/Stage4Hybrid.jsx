import StageShell from './StageShell'

export default function Stage4Hybrid() {
  return (
    <StageShell
      title='Stage 2: Human Corrected Hybrid Eval'
      description='Use auto-eval as primary and send uncertain samples to human adjudication.'
    >
      <div className='stage-card'>
        <h2>Planned in this stage</h2>
        <p>Confidence-based routing, disagreement handling, and reviewer escalation queue.</p>
      </div>
    </StageShell>
  )
}
