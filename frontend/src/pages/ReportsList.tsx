import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { statusLabels, severityLabels, formatDate } from '../utils/statusLabels'

interface Report {
  id: string
  title: string
  severity: string
  status: string
  asset: { name: string }
  submitter: { name: string }
  assignee?: { name: string }
  isMerged: boolean
  duplicateOf?: { title: string; submitter: { name: string } }
  createdAt: string
  _count: { comments: number; duplicates: number }
}

export default function ReportsList() {
  const [reports, setReports] = useState<Report[]>([])
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterMy, setFilterMy] = useState(false)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchReports()
  }, [filterStatus, filterSeverity, filterMy])

  async function fetchReports() {
    setLoading(true)
    try {
      let url = '/api/reports'
      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)
      if (filterSeverity) params.append('severity', filterSeverity)
      if (params.toString()) url += '?' + params.toString()

      const res = await axios.get(url)
      let data = res.data.data || []

      if (filterMy) {
        data = data.filter((r: Report) => r.submitter.id === user?.id || r.assignee?.id === user?.id)
      }

      setReports(data)
    } catch (err) {
      console.error('Fetch reports error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>加载中...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h2>漏洞报告列表</h2>
        {user?.role === 'RESEARCHER' || user?.role === 'ADMIN' ? (
          <button className="btn btn-primary" onClick={() => navigate('/submit')}>
            + 提交漏洞
          </button>
        ) : null}
      </div>

      <div className="filters">
        <div className="filter-item">
          <label>状态筛选</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">全部</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label>严重等级</label>
          <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
            <option value="">全部</option>
            {Object.entries(severityLabels).map(([value, label]) => (
              <option key={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="filter-item" style={{ justifyContent: 'flex-end' }}>
          <label> </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={filterMy}
              onChange={(e) => setFilterMy(e.target.checked)}
            />
            只看与我相关
          </label>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#718096' }}>暂无报告数据</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>标题</th>
              <th>资产</th>
              <th>严重等级</th>
              <th>状态</th>
              <th>提交者</th>
              <th>处理人</th>
              <th>提交时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id}>
                <td>
                  {report.isMerged && (
                  <span style={{ color: '#ed8936', fontSize: '0.75rem', display: 'block' }}>
                    ⚠️ 已合并到: {report.duplicateOf?.title}
                  </span>
                )}
                  {report.title}
                  {report._count.duplicates > 0 && (
                    <span style={{ color: '#667eea', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                      ({report._count.duplicates} 个重复)
                    </span>
                  )}
                </td>
                <td>{report.asset.name}</td>
                <td>
                  <span className={`badge badge-${report.severity}`}>
                    {severityLabels[report.severity]}
                  </span>
                </td>
                <td>
                  <span className={`badge status-${report.status}`}>
                    {statusLabels[report.status]}
                  </span>
                </td>
                <td>{report.submitter.name}</td>
                <td>{report.assignee?.name || '-'}</td>
                <td>{formatDate(report.createdAt)}</td>
                <td>
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate(`/reports/${report.id}`)}
                  >
                    详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
