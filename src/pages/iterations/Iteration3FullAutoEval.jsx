import IterationShell from './IterationShell'

export default function Iteration3FullAutoEval() {
  return (
    <IterationShell
      title='Iteration #3'
      description='This iteration focused on generating large-scale revision data and using UXD grading outcomes to support auto-evaluation model training.'
    >
      <div className='iteration-card'>
        <p>
          In Iteration #3, we used the full set of generated UI screens from
          Iteration #1 as the initial screens, an LLM to pre-generate revision
          tasks, and three SOTA LMs to perform those tasks and generate the
          revised screens, which were then graded pass/fail by recruited UXDs
          based on the above-summarized criteria. This iteration resulted in
          data to train an auto-evaluation model.
        </p>
      </div>
    </IterationShell>
  )
}
