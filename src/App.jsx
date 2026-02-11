import { NavLink, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import UserStudy from './pages/UserStudy'
import Results from './pages/Results'
import Paper from './pages/Paper'
import Dataset from './pages/Dataset'
import Study from './pages/Study'

const NAV_ITEMS = [
  { label: 'Home', to: '/' },
  { label: 'User Study', to: '/user-study' },
  { label: 'Results', to: '/results' },
  { label: 'Paper', to: '/paper' },
  { label: 'Dataset', to: '/dataset' },
]

export default function App() {
  return (
    <div className="app">
      <header className="site-nav">
        <div className="site-shell site-nav__inner">
          <nav className="site-nav__links" aria-label="Primary">
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

      <main className="site-shell site-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/user-study" element={<UserStudy />} />
          <Route path="/results" element={<Results />} />
          <Route path="/paper" element={<Paper />} />
          <Route path="/dataset" element={<Dataset />} />
          <Route path="/study/:taskId" element={<Study />} />
        </Routes>
      </main>
    </div>
  )
}
