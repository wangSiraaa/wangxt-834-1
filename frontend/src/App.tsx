import React from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import ReportsList from './pages/ReportsList'
import ReportDetail from './pages/ReportDetail'
import AuditReplay from './pages/AuditReplay'
import SubmitReport from './pages/SubmitReport'
import Acknowledgments from './pages/Acknowledgments'
import Dashboard from './pages/Dashboard'

function App() {
  const { user, logout, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>加载中...</div>
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div>
      <nav className="navbar">
        <h1>🐛 漏洞赏金平台</h1>
        <ul>
          <li><NavLink to="/" end>仪表板</NavLink></li>
          <li><NavLink to="/reports">漏洞报告</NavLink></li>
          <li><NavLink to="/submit">提交漏洞</NavLink></li>
          <li><NavLink to="/acknowledgments">公开致谢</NavLink></li>
          <li style={{ color: 'white', marginLeft: '1rem' }}>
            {user.name} ({user.role})
          </li>
          <li><button className="btn btn-secondary" onClick={handleLogout}>退出</button></li>
        </ul>
      </nav>

      <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reports" element={<ReportsList />} />
          <Route path="/reports/:id" element={<ReportDetail />} />
          <Route path="/reports/:id/audit" element={<AuditReplay />} />
          <Route path="/submit" element={<SubmitReport />} />
          <Route path="/acknowledgments" element={<Acknowledgments />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
