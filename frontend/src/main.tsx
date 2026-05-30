import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Auth from './pages/Auth.tsx'
import Dashboard from './pages/Dashboard.tsx'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/conversation" element={<Dashboard />} />
    </Routes>
  </BrowserRouter>
)