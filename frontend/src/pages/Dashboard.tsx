import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { statusLabels } from '../utils/statusLabels'

interface Report {
  id: string
  title: string
  severity: string
  status: string
  asset: { name: string }
  submitter: { name: string }
  createdAt: string
}

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, myReports: 0, assigned: 0, verified: 0 })
  const [recentReports, setRecentReports] = useState<Report[]>([])
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [allRes, myRes, assignedRes] = await Promise.all([
        axios.get('/api/reports'),
        axios.get('/api/reports/my'),
        axios.get('/api/reports/assigned')
      ])

      const all = allRes.data.data || []
      const mine = myRes.data.data || []
      const assigned = assignedRes.data.data || []
      const verified = all.filter((r: Report) => r.status === 'VERIFIED' || r.status === 'BOUNTY_APPROVED')

      setStats({
        total: all.length,
        myReports: mine.length,
        assigned: assigned.length,
        verified: verified.length
      })

      setRecentReports(all.slice(0, 5))
    } catch (err) {
      console.error('Fetch dashboard error:', err)
    }
  }

  return (
    <div>
      <div className="page-header">
      <h2>仪表板</h2>
      <div>
        <span style={{ color: '#718096' }}>欢迎回来，{user?.name}</span>
      </div>
    </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">全部报告</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.myReports}</div>
          <div className="stat-label">我提交的</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.assigned}</div>
          <div className="stat-label">分配给我的</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.verified}</div>
          <div className="stat-label">已验证</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem', color: '#2d3748' }}>最近的报告</h3>
        {recentReports.length === 0 ? (
          <p style={{ color: '#718096' }}>暂无报告</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>标题</th>
                <th>资产</th>
                <th>严重等级</th>
                <th>状态</th>
                <th>提交者</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {recentReports.map((report) => (
                <tr key={report.id}>
                  <td>{report.title}</td>
                  <td>{report.asset.name}</td>
                  <td>
                    <span className={`badge badge-${report.severity}`}>{report.severity}</span>
                  </td>
                  <td>
                    <span className={`badge status-${report.status}`}>{statusLabels[report.status]}</span>
                  </td>
                  <td>{report.submitter.name}</td>
                  <td>
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate(`/reports/${report.id}`)}
                    >
                      查看
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem', color: '#2d3748' }}>快速操作</h3>
        <div className="action-buttons">
          <button className="btn btn-primary" onClick={() => navigate('/submit')}>
            + 提交新漏洞
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/reports')}>
            查看所有报告
          </button>
        </div>
      </div>
    </div>
  )
}
