export const ITERATIONS = [
  {
    id: 0,
    slug: '0',
    title: 'Pre-study User Survey',
    description:
      'Collect participant background, tooling, and workflow context before or during study participation.',
    path: '/iterations/0',
  },
  {
    id: 1,
    slug: '1',
    title: 'Iteration #1: Screen Taxonomy + Reverse Engineering',
    description:
      'Build a taxonomy of mobile UI screens, sample diverse screenshots from MUD, and reverse-engineer them into HTML/CSS to create realistic starting screens for revision.',
    path: '/iterations/1',
  },
  {
    id: 2,
    slug: '2',
    title: 'Iteration #2: Human Evaluation + Criteria Mining',
    description:
      'UX designers write revision tasks from initial screens, three SOTA LMs generate revisions, and designers grade pass/fail with criteria. This produces a preliminary labeled dataset and qualitative judgment criteria.',
    path: '/iterations/2',
  },
  {
    id: 3,
    slug: '3',
    title: 'Iteration #3: Full-scale Hybrid Data for Auto-eval',
    description:
      'Use the full initial-screen set, LLM pre-generated revision tasks, and three SOTA LMs for revisions, then collect UXD pass/fail grading using the summarized criteria to train an auto-evaluation model.',
    path: '/iterations/3',
  },
];
