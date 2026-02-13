import { useNavigate } from 'react-router-dom';

const CASE_STUDIES = [
  { id: 1, label: 'Case Study 1' },
  { id: 2, label: 'Case Study 2' },
  { id: 3, label: 'Case Study 3' },
];

export default function UserStudy() {
  const navigate = useNavigate();

  return (
    <div className='user-study'>
      <header className='user-study__header'>
        <h1>Pick a case study to start</h1>
        <p className='user-study__subtitle'>blah</p>
      </header>
      <nav className='user-study__nav' aria-label='Case studies'>
        {CASE_STUDIES.map(({ id, label }) => (
          <button
            key={id}
            type='button'
            className='user-study__card'
            onClick={() => navigate(`/study/${id}`)}
          >
            <span className='user-study__card-label'>{label}</span>
            <span className='user-study__card-hint'>Start study →</span>
          </button>
        ))}
      </nav>
      <style>{`
        .user-study {
          min-height: calc(100vh - 80px);
          padding: 2.5rem 0 3rem;
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
        .user-study__card:hover {
          border-color: var(--accent);
          background: rgba(99, 102, 241, 0.06);
        }
        .user-study__card-label {
          font-weight: 500;
        }
        .user-study__card-hint {
          color: var(--muted);
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
