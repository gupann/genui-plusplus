import UserStudy from '../UserStudy'
import IterationShell from './IterationShell'

export default function Iteration1HumanEvaluation() {
  return (
    <IterationShell
      title='Iteration #1: Human Evaluation'
      description='Manual review with per-model generation, approvals, itemized feedback, and ranking.'
    >
      <UserStudy studyBasePath='/iterations/1/study' title='Case Study Selection' subtitle='Pick a case study to start Iteration #1.' />
    </IterationShell>
  )
}
