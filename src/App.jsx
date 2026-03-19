import { NavLink, Navigate, Routes, Route, useParams } from 'react-router-dom';
import Home from './pages/Home';
import UserStudy from './pages/UserStudy';
import Results from './pages/Results';
import Paper from './pages/Paper';
import Dataset from './pages/Dataset';
import Study from './pages/Study';
import StagesOverview from './pages/StagesOverview';
import Stage1HumanStudy from './pages/stages/Stage1HumanStudy';
import Stage4Hybrid from './pages/stages/Stage4Hybrid';
import Stage5AutoEval from './pages/stages/Stage5AutoEval';

const NAV_ITEMS = [
  { label: 'Home', to: '/' },
  { label: 'Study Stages', to: '/stages' },
  { label: 'Results', to: '/results' },
  { label: 'Paper', to: '/paper' },
  { label: 'Dataset', to: '/dataset' },
];

function LegacyStudyRedirect() {
  const { taskId } = useParams();
  return <Navigate to={`/stages/1/study/${taskId || 1}`} replace />;
}

export default function App() {
  return (
    <div className='app'>
      <header className='site-nav'>
        <div className='site-shell site-nav__inner'>
          <nav className='site-nav__links' aria-label='Primary'>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `site-nav__link${isActive ? ' site-nav__link--active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className='site-shell site-main'>
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/stages' element={<StagesOverview />} />
          <Route path='/stages/1' element={<Stage1HumanStudy />} />
          <Route
            path='/stages/1/study/:taskId'
            element={<Study listPath='/stages/1' />}
          />
          <Route path='/stages/2' element={<Stage4Hybrid />} />
          <Route path='/stages/3' element={<Stage5AutoEval />} />
          <Route path='/stages/4' element={<Navigate to='/stages/2' replace />} />
          <Route path='/stages/5' element={<Navigate to='/stages/3' replace />} />
          <Route
            path='/user-study'
            element={<Navigate to='/stages/1' replace />}
          />
          <Route path='/study/:taskId' element={<LegacyStudyRedirect />} />
          <Route path='/results' element={<Results />} />
          <Route path='/paper' element={<Paper />} />
          <Route path='/dataset' element={<Dataset />} />
          <Route path='*' element={<Navigate to='/' replace />} />
        </Routes>
      </main>
    </div>
  );
}
