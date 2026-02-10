import { useNavigate } from 'react-router-dom';

const CASE_STUDIES = [
  { id: 1, label: 'Case Study 1' },
  { id: 2, label: 'Case Study 2' },
  { id: 3, label: 'Case Study 3' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className='home'>
      <header className='home__header'>
        <h1>
          GenUI++: A Dataset for Understanding, Generating, and Evaluating
          Incremental UI Design
        </h1>
        <p className='home__subtitle'>
          User study - pick a case study to start.
        </p>
      </header>
      <nav className='home__nav' aria-label='Case studies'>
        {CASE_STUDIES.map(({ id, label }) => (
          <button
            key={id}
            type='button'
            className='home__card'
            onClick={() => navigate(`/study/${id}`)}
          >
            <span className='home__card-label'>{label}</span>
            <span className='home__card-hint'>Start study →</span>
          </button>
        ))}
      </nav>
      <style>{`
        .home {
          min-height: 100vh;
          padding: 3rem 1.5rem;
          max-width: 720px;
          margin: 0 auto;
        }
        .home__header {
          margin-bottom: 2.5rem;
        }
        .home__header h1 {
          font-size: 1.75rem;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
          letter-spacing: -0.02em;
        }
        .home__subtitle {
          color: var(--muted);
          margin: 0;
          font-size: 1rem;
        }
        .home__nav {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .home__card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text);
          font-size: 1rem;
          text-align: left;
          transition: border-color 0.2s, background 0.2s;
        }
        .home__card:hover {
          border-color: var(--accent);
          background: rgba(99, 102, 241, 0.06);
        }
        .home__card-label {
          font-weight: 500;
        }
        .home__card-hint {
          color: var(--muted);
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
