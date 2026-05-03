import UserStudy from '../UserStudy'
import IterationAuthGate from '../../components/auth/IterationAuthGate'
import IterationShell from './IterationShell'

export default function Iteration1HumanEvaluation({
  title = 'Iteration #1: Human Evaluation',
  description = 'Manual review with per-model generation, approvals, itemized feedback, and ranking.',
  studyBasePath = '/iterations/1/study',
  subtitle = 'Pick a case study to start Iteration #1.',
  requireAuthBeforeStudy = false,
}) {
  const studySelection = (
    <UserStudy
      studyBasePath={studyBasePath}
      title='Case Study Selection'
      subtitle={subtitle}
    />
  )

  return (
    <IterationShell
      title={title}
      description={description}
    >
      {requireAuthBeforeStudy ? (
        <IterationAuthGate
          hideChildrenUntilAuthenticated
          dismissible={false}
          variant='inline'
        >
          {studySelection}
        </IterationAuthGate>
      ) : (
        studySelection
      )}
    </IterationShell>
  )
}
