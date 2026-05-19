import { NavLink, Navigate, Routes, Route, useParams } from 'react-router-dom';
import Home from './pages/Home';
import Results from './pages/Results';
import Paper from './pages/Paper';
import Dataset from './pages/Dataset';
import Study from './pages/Study';
import Iteration1Overview from './pages/iterations/Iteration1Overview';
import Iteration1HumanEvaluation from './pages/iterations/Iteration1HumanEvaluation';
import Iteration3FullAutoEval from './pages/iterations/Iteration3FullAutoEval';
import Iteration3Study from './pages/iterations/Iteration3Study';
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

const TEMPORARILY_DISABLED_CASE_STUDIES = [];
const ITERATION_2_GUIDE = {
  title: 'How to Complete Iteration #2',
  intro:
    'Use this flow to review each case study consistently and submit complete feedback for all three model outputs.',
  videoUrl:
    'https://drive.google.com/file/d/1V2gusAduzbl1NbHmgrsBcRzOVNOkv5fW/view?usp=sharing',
  steps: [
    'Go to the Iteration #2 tab.',
    'Verify your email to receive the study link.',
    'One session usually includes about 12 to 15 case studies.',
    'For each case study, you will see one screen. As a UI/UX designer, identify issues and write 2 issue prompts for that screen.',
    'For each prompt, generate output screens for all 3 LLMs one by one: OpenAI, Claude, and Gemini.',
    'For each LLM output, write an evaluation describing what worked well and what did not.',
    'Then move on to the next prompt or the next case study.',
  ],
};

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
                subtitle='Pick a case study to start Iteration #2. Please complete at least 15 case studies per session, or more if you can. If any LLM-generated screen fails to generate even after 2-3 attempts, let us know the case study number and LLM model as soon as possible.'
                iterationId={2}
                requireAuthBeforeStudy
                disabledCaseStudyIds={TEMPORARILY_DISABLED_CASE_STUDIES}
                guide={ITERATION_2_GUIDE}
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
            element={<Iteration3FullAutoEval />}
          />
          <Route
            path='/iterations/3/study/:taskId'
            element={<Iteration3Study />}
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
