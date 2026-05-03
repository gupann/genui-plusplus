import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PILOT_STUDY_CASES } from '../config/pilotStudyCases';
import { getCurrentParticipant } from '../services/participantSession';
import { listStudySessions } from '../services/sessionApi';

// const CASE_STUDIES = [
//   { id: 1, label: 'Case Study 1' },
//   { id: 2, label: 'Case Study 2' },
//   { id: 3, label: 'Case Study 3' },
//   { id: 4, label: 'Case Study 4' },
//   { id: 5, label: 'Case Study 5' },
//   { id: 6, label: 'Case Study 6' },
//   { id: 7, label: 'Case Study 7' },
//   { id: 8, label: 'Case Study 8' },
//   { id: 9, label: 'Case Study 9' },
//   { id: 10, label: 'Case Study 10' },
//   { id: 11, label: 'Case Study 11' },
// ];

export default function UserStudy({
  studyBasePath = '/study',
  title = 'Phase 1: Data Collection',
  subtitle = 'Pick a case study to start.',
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [completedCaseIds, setCompletedCaseIds] = useState(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadCompletedSessions() {
      try {
        const participant = await getCurrentParticipant();
        if (!participant?.participantId) {
          if (!cancelled) setCompletedCaseIds(new Set());
          return;
        }
        const payload = await listStudySessions({
          participantId: participant.participantId,
          iterationId: 2,
        });
        if (cancelled) return;
        const completed = new Set(
          (payload?.sessions || [])
            .filter((session) => session?.status === 'completed')
            .map((session) => Number(session.taskId))
            .filter(Boolean),
        );
        setCompletedCaseIds(completed);
      } catch {
        if (!cancelled) setCompletedCaseIds(new Set());
      }
    }

    void loadCompletedSessions();

    function handleWindowFocus() {
      void loadCompletedSessions();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void loadCompletedSessions();
      }
    }

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [location.pathname]);

  return (
    <div className='user-study'>
      <header className='user-study__header'>
        <h1>{title}</h1>
        <p className='user-study__subtitle'>{subtitle}</p>
      </header>
      <nav className='user-study__nav' aria-label='Case studies'>
        {PILOT_STUDY_CASES.map(({ caseStudyId, appType, intent }) => (
          <button
            key={caseStudyId}
            type='button'
            className='user-study__card'
            onClick={() => navigate(`${studyBasePath}/${caseStudyId}`)}
          >
            {completedCaseIds.has(caseStudyId) && (
              <span
                className='user-study__completed-badge'
                aria-label='Completed case study'
                title='Completed'
              >
                ✓
              </span>
            )}
            <div className='user-study__card-copy'>
              <span className='user-study__card-label'>
                {`Case Study #${caseStudyId}`}
              </span>
              <div className='user-study__card-tags'>
                <span className='user-study__tag'>{appType}</span>
                <span className='user-study__tag'>{intent}</span>
              </div>
            </div>
            <span className='user-study__card-hint'>Start study →</span>
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
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          align-items: stretch;
          width: min(100%, 1180px);
          margin: 0 auto;
        }
        .user-study__card {
          display: grid;
          gap: 0.9rem;
          width: 100%;
          min-height: 152px;
          padding: 1.2rem 1.1rem 1rem 1.1rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          position: relative;
          color: var(--text);
          font-size: 1rem;
          text-align: center;
          justify-items: center;
          align-content: center;
          transition: border-color 0.2s, background 0.2s;
        }
        .user-study__card:hover {
          border-color: var(--accent);
          background: rgba(99, 102, 241, 0.06);
        }
        .user-study__card-label {
          font-weight: 500;
          font-size: 1.02rem;
        }
        .user-study__completed-badge {
          position: absolute;
          top: 0.8rem;
          left: 0.8rem;
          width: 1.65rem;
          height: 1.65rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #16a34a;
          color: white;
          font-size: 1rem;
          font-weight: 700;
          box-shadow: 0 8px 20px rgba(22, 163, 74, 0.24);
        }
        .user-study__card-copy {
          display: grid;
          gap: 0.6rem;
          min-width: 0;
          align-content: start;
          justify-items: center;
          width: 100%;
          padding-top: 0.4rem;
        }
        .user-study__card-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          justify-content: center;
        }
        .user-study__tag {
          display: inline-flex;
          align-items: center;
          padding: 0.28rem 0.65rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: rgba(148, 163, 184, 0.08);
          color: var(--muted);
          font-size: 0.82rem;
          line-height: 1;
          white-space: nowrap;
        }
        .user-study__card-hint {
          color: var(--muted);
          font-size: 0.88rem;
          align-self: center;
        }
        @media (max-width: 900px) {
          .user-study__nav {
            grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          }
        }
        @media (max-width: 640px) {
          .user-study__nav {
            grid-template-columns: 1fr;
          }
          .user-study__card {
            min-height: 0;
          }
        }
      `}</style>
    </div>
  );
}
