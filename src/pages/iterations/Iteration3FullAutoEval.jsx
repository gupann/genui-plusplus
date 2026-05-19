import UserStudy from '../UserStudy';
import IterationShell from './IterationShell';

export default function Iteration3FullAutoEval() {
  return (
    <IterationShell
      title='Iteration #3'
      description='Evaluate pregenerated revision outputs with a structured rubric to support large-scale auto-evaluation training data.'
    >
      <UserStudy
        studyBasePath='/iterations/3/study'
        title='Case Study Selection'
        subtitle='Pick a case study to review its fixed revision prompt and evaluate the three pregenerated model outputs.'
        iterationId={3}
      />
    </IterationShell>
  );
}
