import { useNavigate } from 'react-router-dom'

export default function IterationShell({ title, description, children }) {
  const navigate = useNavigate()

  return (
    <div className='iteration'>
      <div className='iteration__top'>
        <button type='button' className='iteration__back' onClick={() => navigate('/iterations')}>
          ← Back to iterations
        </button>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
      <style>{`
        .iteration {
          display: grid;
          gap: 1.25rem;
        }
        .iteration__top h1 {
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          letter-spacing: -0.02em;
        }
        .iteration__top p {
          margin: 0;
          color: var(--muted);
        }
        .iteration__back {
          margin: 0 0 0.8rem 0;
          border: none;
          background: transparent;
          color: var(--muted);
          padding: 0;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .iteration__back:hover {
          color: var(--accent);
        }
        .iteration-card {
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
          padding: 1.1rem 1.2rem;
        }
        .iteration-card h2 {
          margin: 0 0 0.5rem 0;
          font-size: 1.05rem;
        }
        .iteration-card p {
          margin: 0;
          color: var(--muted);
        }
      `}</style>
    </div>
  )
}
