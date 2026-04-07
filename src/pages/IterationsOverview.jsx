import { useNavigate } from 'react-router-dom'
import { ITERATIONS } from '../config/iterations'

export default function IterationsOverview() {
  const navigate = useNavigate()

  return (
    <div className='user-study'>
      <header className='user-study__header'>
        <h1>Project Iterations</h1>
        <p className='user-study__subtitle'>
          Follow the three-study-iteration progression from screen generation to auto-evaluation.
        </p>
      </header>
      <nav className='user-study__nav' aria-label='Project iterations'>
        {ITERATIONS.map((iteration) => (
          <button
            key={iteration.id}
            type='button'
            className='user-study__card'
            onClick={() => navigate(iteration.path)}
          >
            <span className='user-study__card-label'>{iteration.title}</span>
            <span className='user-study__card-desc'>{iteration.description}</span>
          </button>
        ))}
      </nav>
      <style>{`
        .user-study {
          min-height: calc(100vh - 80px);
          padding: 0 0 3rem;
        }
        .user-study__header {
          margin-bottom: 2.5rem;
        }
        .user-study__header h1 {
          font-size: 1.75rem;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
          letter-spacing: -0.02em;
        }
        .user-study__subtitle {
          color: var(--muted);
          margin: 0;
          font-size: 1rem;
        }
        .user-study__nav {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .user-study__card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          gap: 0.45rem;
          padding: 1.25rem 1.5rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text);
          font-size: 1rem;
          text-align: left;
          transition: border-color 0.2s, background 0.2s;
        }
        .user-study__card:hover {
          border-color: var(--accent);
          background: rgba(99, 102, 241, 0.06);
        }
        .user-study__card-label {
          font-weight: 600;
        }
        .user-study__card-desc {
          color: var(--muted);
          font-size: 0.95rem;
          line-height: 1.45;
        }
      `}</style>
    </div>
  )
}
