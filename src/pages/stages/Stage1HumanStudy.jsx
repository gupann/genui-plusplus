import UserStudy from '../UserStudy'
import StageShell from './StageShell'

export default function Stage1HumanStudy() {
  return (
    <StageShell
      title='Stage 1: Human Evaluation'
      description='Manual review with per-model generation, approvals, itemized feedback, and ranking.'
    >
      <UserStudy studyBasePath='/stages/1/study' title='Case Study Selection' subtitle='Pick a case study to start Stage 1.' />
    </StageShell>
  )
}
