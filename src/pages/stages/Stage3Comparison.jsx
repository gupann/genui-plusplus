import StageShell from './StageShell'

export default function Stage3Comparison() {
  return (
    <StageShell
      title='Stage 3: Human vs Auto-Eval'
      description='Run auto-eval side-by-side with human ratings and measure agreement.'
    >
      <div className='stage-card'>
        <h2>Planned in this stage</h2>
        <p>Rubric scoring per model output and comparison views for disagreement analysis.</p>
      </div>
    </StageShell>
  )
}
