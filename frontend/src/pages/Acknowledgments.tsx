import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { formatDate } from '../utils/statusLabels'

interface AcknowledgedResearcher {
  id: string
  name: string
  email: string
  totalReports: number
  totalBounty: number
  reports: Array<{
    id: string
    title: string
    severity: string
    bountyAmount: number
    acknowledgedAt: string
  }>
}

export default function Acknowledgments() {
  const [researchers, setResearchers] = useState<AcknowledgedResearcher[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSeverity, setFilterSeverity] = useState('')
  const [sortBy, setSortBy] = useState<'bounty' | 'reports'>('bounty')

  useEffect(() => {
    fetchAcknowledgments()
  }, [])

  async function fetchAcknowledgments() {
    try {
      const res = await axios.get('/api/reports/acknowledged')
      setResearchers(res.data.data || [])
    } catch (err) {
      console.error('Fetch acknowledgments error:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredResearchers = researchers
    .map(r => ({
      ...r,
      reports: filterSeverity
        ? r.reports.filter(report => report.severity === filterSeverity)
        : r.reports
    }))
    .filter(r => r.reports.length > 0)
    .sort((a, b) => {
      if (sortBy === 'bounty') {
        const aTotal = a.reports.reduce((sum, r) => sum + r.bountyAmount, 0)
        const bTotal = b.reports.reduce((sum, r) => sum + r.bountyAmount, 0)
        return bTotal - aTotal
      }
      return b.reports.length - a.reports.length
    })

  const totalBounty = researchers.reduce((sum, r) => sum + r.totalBounty, 0)
  const totalResearchers = researchers.length
  const totalReports = researchers.reduce((sum, r) => sum + r.totalReports, 0)

  if (loading) {
    return <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>加载中...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h2>🏆 公开致谢</h2>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{totalResearchers}</div>
          <div className="stat-label">安全研究员</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalReports}</div>
          <div className="stat-label">有效漏洞报告</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">¥{totalBounty.toLocaleString()}</div>
          <div className="stat-label">累计发放奖金</div>
        </div>
      </div>

      <div className="card">
        <div className="detail-section">
          <h3>感谢名单</h3>

          <div className="filters">
            <div className="filter-item">
              <label>按严重等级筛选</label>
              <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
                <option value="">全部等级</option>
                <option value="LOW">低危</option>
                <option value="MEDIUM">中危</option>
                <option value="HIGH">严重</option>
                <option value="CRITICAL">高危</option>
              </select>
            </div>
            <div className="filter-item">
              <label>排序方式</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'bounty' | 'reports')}>
                <option value="bounty">按奖金排名</option>
                <option value="reports">按报告数排名</option>
              </select>
            </div>
          </div>

          {filteredResearchers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
              <p style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎖️</p>
              <p>暂无公开致谢记录</p>
              <small>通过审核并发放奖金的漏洞报告将在此处展示</small>
            </div>
          ) : (
            <div className="acknowledgments-grid">
              {filteredResearchers.map((researcher, index) => {
                const researcherBounty = researcher.reports.reduce((sum, r) => sum + r.bountyAmount, 0)
                return (
                  <div key={researcher.id} className="card" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <div className="acknowledgment-avatar" style={{ margin: 0 }}>
                        {researcher.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h4 style={{ margin: 0 }}>{researcher.name}</h4>
                          {index === 0 && <span style={{ fontSize: '1.25rem' }}>🥇</span>}
                          {index === 1 && <span style={{ fontSize: '1.25rem' }}>🥈</span>}
                          {index === 2 && <span style={{ fontSize: '1.25rem' }}>🥉</span>}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                          {researcher.reports.length} 个有效报告 | 奖金 ¥{researcherBounty.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#4a5568', marginBottom: '0.5rem' }}>
                        漏洞贡献：
                      </p>
                      {researcher.reports.map(report => (
                        <div
                          key={report.id}
                          style={{
                            padding: '0.5rem 0.75rem',
                            background: '#f7fafc',
                            borderRadius: '4px',
                            marginBottom: '0.5rem',
                            fontSize: '0.875rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '500' }}>{report.title}</span>
                            <span className={`badge badge-${report.severity}`} style={{ fontSize: '0.65rem' }}>
                              {report.severity === 'CRITICAL' ? '高危' :
                               report.severity === 'HIGH' ? '严重' :
                               report.severity === 'MEDIUM' ? '中危' : '低危'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', color: '#718096' }}>
                            <span>奖金：¥{report.bountyAmount.toLocaleString()}</span>
                            <span>{formatDate(report.acknowledgedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="detail-section">
          <h3>ℹ️ 致谢说明</h3>
          <div style={{ fontSize: '0.875rem', color: '#4a5568', lineHeight: '1.8' }}>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>公开致谢标准：</strong>漏洞报告经完整流程审核通过并发放奖金后，将自动列入公开致谢名单。
            </p>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>致谢条件：</strong>
            </p>
            <ul style={{ marginLeft: '1.5rem', marginBottom: '0.5rem' }}>
              <li>漏洞报告真实有效，经审核确认存在安全问题</li>
              <li>漏洞已修复并经提交者确认验证</li>
              <li>奖金已审核通过并发放</li>
              <li>研究员同意公开致谢（默认同意）</li>
            </ul>
            <p>
              <strong>🔒 隐私保护：</strong>如研究员不希望公开显示姓名，请在提交报告时注明，我们将使用匿名形式展示。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
