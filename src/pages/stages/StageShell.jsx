import { useNavigate } from 'react-router-dom'

export default function StageShell({ title, description, children }) {
  const navigate = useNavigate()

  return (
    <div className='stage'>
      <div className='stage__top'>
        <button type='button' className='stage__back' onClick={() => navigate('/stages')}>
          ← Back to stages
        </button>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
      <style>{`
        .stage {
          display: grid;
          gap: 1.25rem;
        }
        .stage__top h1 {
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          letter-spacing: -0.02em;
        }
        .stage__top p {
          margin: 0;
          color: var(--muted);
        }
        .stage__back {
          margin: 0 0 0.8rem 0;
          border: none;
          background: transparent;
          color: var(--muted);
          padding: 0;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .stage__back:hover {
          color: var(--accent);
        }
        .stage-card {
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
          padding: 1.1rem 1.2rem;
        }
        .stage-card h2 {
          margin: 0 0 0.5rem 0;
          font-size: 1.05rem;
        }
        .stage-card p {
          margin: 0;
          color: var(--muted);
        }
      `}</style>
    </div>
  )
}
