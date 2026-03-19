export const STAGES = [
  {
    id: 1,
    slug: '1',
    title: 'Stage 1: Existing Human Study',
    description:
      'Manual human evaluation with per-model approvals, success/failure feedback, and rankings.',
    path: '/stages/1',
  },
  {
    id: 2,
    slug: '2',
    title: 'Stage 2: Human Corrected Hybrid Eval',
    description:
      'Use auto-eval by default and route uncertain or low-confidence cases to human adjudication.',
    path: '/stages/2',
  },
  {
    id: 3,
    slug: '3',
    title: 'Stage 3: Full Auto Eval',
    description:
      'Primary automated evaluation with monitoring, drift checks, and periodic audit sampling.',
    path: '/stages/3',
  },
]
