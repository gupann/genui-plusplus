import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Study from './pages/Study'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/study/:taskId" element={<Study />} />
    </Routes>
  )
}
