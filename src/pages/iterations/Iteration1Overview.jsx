import IterationShell from './IterationShell'

export default function Iteration1Overview() {
  return (
    <IterationShell
      title='Iteration #1'
      description='This iteration focused on constructing the initial set of realistic mobile UI screens used later in the revision workflow.'
    >
      <div className='iteration-card iteration-overview'>
        <p>
          In Iteration #1, we drew on prior work and developed a{' '}
          <a href='https://apptypesintent.vercel.app/' target='_blank' rel='noreferrer'>
            taxonomy
          </a>{' '}
          of UI screens on mobile apps, based on which we sampled a diverse set
          of app screenshots from the{' '}
          <a
            href='https://github.com/sidongfeng/MUD'
            target='_blank'
            rel='noreferrer'
          >
            MUD dataset
          </a>{' '}
          and then used Gemini to reverse-engineer them into HTML/CSS code.
          This iteration resulted in a{' '}
          <a
            href='https://huggingface.co/datasets/anmolgupta23/MUD_GenreUI/tree/main'
            target='_blank'
            rel='noreferrer'
          >
            set of generated screens
          </a>{' '}
          (grounded in real-world mobile apps) that serve as the starting
          points for UI revision.
        </p>
        <div className='iteration-overview__actions'>
          <a
            className='iteration-overview__link'
            href='https://docs.google.com/forms/d/e/1FAIpQLSfR_Bh8jcmNZMD7nGCUfzSf8p2MrzbXOOko2-6xtE9AEMQXeQ/viewform'
            target='_blank'
            rel='noreferrer'
          >
            User Survey
          </a>
          <a
            className='iteration-overview__link'
            href='https://apptypesintent.vercel.app/'
            target='_blank'
            rel='noreferrer'
          >
            Taxonomy
          </a>
          <a
            className='iteration-overview__link'
            href='https://huggingface.co/datasets/anmolgupta23/MUD_GenreUI/tree/main'
            target='_blank'
            rel='noreferrer'
          >
            Sampled MUD Dataset Screens
          </a>
        </div>
      </div>
      <style>{`
        .iteration-overview {
          display: grid;
          gap: 1rem;
        }
        .iteration-overview__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .iteration-overview p {
          margin: 0;
          color: var(--text);
          line-height: 1.7;
        }
        .iteration-overview__link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          padding: 0.75rem 1rem;
          border-radius: var(--radius);
          background: var(--accent);
          color: white;
          text-decoration: none;
          font-weight: 600;
        }
        .iteration-overview__link:hover {
          filter: brightness(1.05);
        }
      `}</style>
    </IterationShell>
  )
}
