import { NavLink, Navigate, Routes, Route, useParams } from 'react-router-dom';
import Home from './pages/Home';
import Results from './pages/Results';
import Paper from './pages/Paper';
import Dataset from './pages/Dataset';
import Study from './pages/Study';
import Iteration1Overview from './pages/iterations/Iteration1Overview';
import Iteration1HumanEvaluation from './pages/iterations/Iteration1HumanEvaluation';
import Iteration3FullAutoEval from './pages/iterations/Iteration3FullAutoEval';
import PreStudySurvey from './pages/iterations/PreStudySurvey';
import IterationAuthGate from './components/auth/IterationAuthGate';

const NAV_ITEMS = [
  { label: 'Home', to: '/' },
  { label: 'Iteration #1', to: '/iterations/1' },
  { label: 'Iteration #2', to: '/iterations/2' },
  { label: 'Iteration #3', to: '/iterations/3' },
  { label: 'Results', to: '/results' },
  { label: 'Paper', to: '/paper' },
  { label: 'Dataset', to: '/dataset' },
];

const TEMPORARILY_DISABLED_CASE_STUDIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function LegacyStudyRedirect() {
  const { taskId } = useParams();
  return <Navigate to={`/iterations/2/study/${taskId || 1}`} replace />;
}

function IterationProtected({ children }) {
  return <IterationAuthGate>{children}</IterationAuthGate>;
}

function IterationAuthRequired({ children }) {
  return (
    <IterationAuthGate
      hideChildrenUntilAuthenticated
      dismissible={false}
      variant='inline'
    >
      {children}
    </IterationAuthGate>
  );
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
                {item.to === '/' ? (
                  <>
                    <img
                      src='/logo.png'
                      alt=''
                      aria-hidden='true'
                      className='site-nav__logo'
                    />
                    <span>{item.label}</span>
                  </>
                ) : (
                  item.label
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className='site-shell site-main'>
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/iterations' element={<Navigate to='/iterations/1' replace />} />
          <Route
            path='/iterations/0'
            element={
              <IterationProtected>
                <PreStudySurvey />
              </IterationProtected>
            }
          />
          <Route
            path='/iterations/1'
            element={<Iteration1Overview />}
          />
          <Route
            path='/iterations/1/study/:taskId'
            element={<LegacyStudyRedirect />}
          />
          <Route
            path='/iterations/2'
            element={
              <Iteration1HumanEvaluation
                title='Iteration #2'
                studyBasePath='/iterations/2/study'
                subtitle='Pick a case study to start Iteration #2. If any LLM-generated screen fails to generate even after 2-3 attempts, let us know the case study number and LLM model as soon as possible.'
                requireAuthBeforeStudy
                disabledCaseStudyIds={TEMPORARILY_DISABLED_CASE_STUDIES}
              />
            }
          />
          <Route
            path='/iterations/2/study/:taskId'
            element={
              <IterationAuthRequired>
                <Study
                  listPath='/iterations/2'
                  iterationId={2}
                  disabledCaseStudyIds={TEMPORARILY_DISABLED_CASE_STUDIES}
                />
              </IterationAuthRequired>
            }
          />
          <Route
            path='/iterations/3'
            element={
              <IterationProtected>
                <Iteration3FullAutoEval />
              </IterationProtected>
            }
          />
          <Route path='/stages' element={<Navigate to='/iterations/1' replace />} />
          <Route path='/stages/0' element={<Navigate to='/iterations/0' replace />} />
          <Route path='/stages/1' element={<Navigate to='/iterations/2' replace />} />
          <Route path='/stages/1/study/:taskId' element={<LegacyStudyRedirect />} />
          <Route path='/stages/2' element={<Navigate to='/iterations/2' replace />} />
          <Route path='/stages/3' element={<Navigate to='/iterations/3' replace />} />
          <Route path='/stages/4' element={<Navigate to='/iterations/2' replace />} />
          <Route path='/stages/5' element={<Navigate to='/iterations/3' replace />} />
          <Route
            path='/user-study'
            element={<Navigate to='/iterations/2' replace />}
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
