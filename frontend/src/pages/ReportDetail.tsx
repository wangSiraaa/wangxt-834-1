import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { statusLabels, severityLabels, roleLabels, formatDate } from '../utils/statusLabels'

interface StatusHistory {
  id: string
  status: string
  note: string | null
  createdAt: string
  createdBy: { name: string; role: string }
}

interface ReportComment {
  id: string
  content: string
  createdAt: string
  author: { name: string; role: string }
}

interface Report {
  id: string
  title: string
  description: string
  severity: string
  status: string
  bountyAmount: number | null
  isMerged: boolean
  duplicateOf?: { id: string; title: string; submitter: { name: string } }
  duplicates?: Array<{ id: string; title: string; submitter: { name: string } }>
  asset: { id: string; name: string; url: string }
  submitter: { id: string; name: string; email: string }
  assignee?: { id: string; name: string; email: string; role: string }
  statusHistory: StatusHistory[]
  comments: ReportComment[]
  retestRecords?: Array<{ id: string; isVerified: boolean; note: string; createdAt: string }>
  bountyApprovals?: Array<{ id: string; status: string; amount: number; note: string; approvedBy: { name: string } }>
  createdAt: string
  updatedAt: string
}

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showBountyModal, setShowBountyModal] = useState(false)
  const [selectedDeveloper, setSelectedDeveloper] = useState('')
  const [bountyAmount, setBountyAmount] = useState('')
  const [bountyNote, setBountyNote] = useState('')
  const [developers, setDevelopers] = useState<Array<{ id: string; name: string }>>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchReport()
    fetchDevelopers()
  }, [id])

  async function fetchReport() {
    try {
      const res = await axios.get(`/api/reports/${id}`)
      setReport(res.data.data)
    } catch (err: any) {
      setError(err.response?.data?.message || '加载报告失败')
    } finally {
      setLoading(false)
    }
  }

  async function fetchDevelopers() {
    try {
      const res = await axios.get('/api/auth/users?role=DEVELOPER')
      setDevelopers(res.data.data || [])
    } catch (err) {
      console.error('Fetch developers error:', err)
    }
  }

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  async function handleAction(action: string, data?: any) {
    clearMessages()
    setActionLoading(true)
    try {
      const res = await axios.post(`/api/reports/${id}/${action}`, data)
      setSuccess(res.data.message || '操作成功')
      fetchReport()
      return true
    } catch (err: any) {
      const msg = err.response?.data?.message || '操作失败'
      setError(msg)
      if (msg.includes('硬校验')) {
        alert('⚠️ 硬校验失败：' + msg)
      }
      return false
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAssign() {
    if (!selectedDeveloper) {
      setError('请选择开发人员')
      return
    }
    const success = await handleAction('assign', { assigneeId: selectedDeveloper })
    if (success) {
      setShowAssignModal(false)
      setSelectedDeveloper('')
    }
  }

  async function handleApproveBounty() {
    if (!bountyAmount || parseFloat(bountyAmount) <= 0) {
      setError('请输入有效的奖金金额')
      return
    }
    const success = await handleAction('approve-bounty', {
      amount: parseFloat(bountyAmount),
      note: bountyNote
    })
    if (success) {
      setShowBountyModal(false)
      setBountyAmount('')
      setBountyNote('')
    }
  }

  async function handleAddComment() {
    if (!comment.trim()) return
    try {
      await axios.post(`/api/reports/${id}/comments`, { content: comment })
      setComment('')
      fetchReport()
    } catch (err: any) {
      setError(err.response?.data?.message || '添加评论失败')
    }
  }

  function canPerformAction(action: string): boolean {
    if (!report || !user) return false
    const role = user.role
    const status = report.status

    switch (action) {
      case 'mark-duplicate':
        return (role === 'TRIAGER' || role === 'ADMIN') && status === 'SUBMITTED'
      case 'assign':
        return (role === 'TRIAGER' || role === 'ADMIN') && (status === 'SUBMITTED' || status === 'TRIAGING')
      case 'start-fixing':
        return (role === 'DEVELOPER' || role === 'ADMIN') && status === 'ASSIGNED' && report.assignee?.id === user.id
      case 'mark-fixed':
        return (role === 'DEVELOPER' || role === 'ADMIN') && status === 'FIXING' && report.assignee?.id === user.id
      case 'request-retest':
        return (role === 'TRIAGER' || role === 'DEVELOPER' || role === 'ADMIN') && status === 'FIXED'
      case 'verify-fix':
        return (role === 'RESEARCHER' || role === 'ADMIN') && status === 'RETESTING'
      case 'request-bounty':
        return (role === 'TRIAGER' || role === 'ADMIN') && status === 'VERIFIED'
      case 'approve-bounty':
        return (role === 'APPROVER' || role === 'ADMIN') && status === 'APPROVING_BOUNTY'
      case 'acknowledge':
        return role === 'ADMIN' && status === 'BOUNTY_APPROVED'
      case 'reject':
        return (role === 'TRIAGER' || role === 'ADMIN') && (status === 'SUBMITTED' || status === 'TRIAGING')
      default:
        return false
    }
  }

  if (loading) {
    return <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>加载中...</div>
  }

  if (!report) {
    return <div className="container" style={{ padding: '2rem' }}>
      <div className="alert alert-error">报告不存在或已被删除</div>
      <button className="btn btn-secondary" onClick={() => navigate('/reports')}>返回列表</button>
    </div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-secondary" style={{ marginBottom: '1rem' }} onClick={() => navigate('/reports')}>
            ← 返回列表
          </button>
          <h2>{report.title}</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className={`badge badge-${report.severity}`}>{severityLabels[report.severity]}</span>
          <span className={`badge status-${report.status}`}>{statusLabels[report.status]}</span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {report.isMerged && report.duplicateOf && (
        <div className="duplicate-banner">
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div>
            <strong>硬校验：此报告已被自动合并为重复报告</strong>
            <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
              原始报告：<a onClick={() => navigate(`/reports/${report.duplicateOf!.id}`)} style={{ color: 'white', textDecoration: 'underline', cursor: 'pointer' }}>
                {report.duplicateOf.title}
              </a>（提交者：{report.duplicateOf.submitter.name}）
            </div>
          </div>
        </div>
      )}

      {report.duplicates && report.duplicates.length > 0 && (
        <div className="alert alert-warning">
          <strong>📋 已有 {report.duplicates.length} 个重复报告合并到此报告：</strong>
          <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
            {report.duplicates.map(d => (
              <li key={d.id}>
                <a onClick={() => navigate(`/reports/${d.id}`)} style={{ color: '#744210', cursor: 'pointer', textDecoration: 'underline' }}>
                  {d.title}
                </a>（提交者：{d.submitter.name}）
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="action-buttons" style={{ marginBottom: '1.5rem' }}>
        {canPerformAction('mark-duplicate') && (
          <button className="btn btn-warning" disabled={actionLoading} onClick={() => handleAction('mark-duplicate')}>
            标记为重复
          </button>
        )}
        {canPerformAction('assign') && (
          <button className="btn btn-primary" disabled={actionLoading} onClick={() => setShowAssignModal(true)}>
            分派给开发
          </button>
        )}
        {canPerformAction('start-fixing') && (
          <button className="btn btn-primary" disabled={actionLoading} onClick={() => handleAction('start-fixing')}>
            开始修复
          </button>
        )}
        {canPerformAction('mark-fixed') && (
          <button className="btn btn-success" disabled={actionLoading} onClick={() => handleAction('mark-fixed')}>
            标记已修复
          </button>
        )}
        {canPerformAction('request-retest') && (
          <button className="btn btn-primary" disabled={actionLoading} onClick={() => handleAction('request-retest')}>
            申请复测
          </button>
        )}
        {canPerformAction('verify-fix') && (
          <button className="btn btn-success" disabled={actionLoading} onClick={() => {
            if (report.submitter.id !== user?.id) {
              alert('⚠️ 硬校验：只有提交报告的研究员才能确认修复结果')
              return
            }
            handleAction('verify-fix')
          }}>
            确认修复（研究员）
          </button>
        )}
        {canPerformAction('request-bounty') && (
          <button className="btn btn-warning" disabled={actionLoading} onClick={() => {
            if ((report.severity === 'CRITICAL' || report.severity === 'HIGH') && report.status !== 'VERIFIED') {
              alert('⚠️ 硬校验：严重/高危漏洞必须修复并经研究员确认后才能申请奖金')
              return
            }
            handleAction('request-bounty')
          }}>
            申请奖金审批
          </button>
        )}
        {canPerformAction('approve-bounty') && (
          <button className="btn btn-success" disabled={actionLoading} onClick={() => {
            if ((report.severity === 'CRITICAL' || report.severity === 'HIGH') && !report.retestRecords?.some(r => r.isVerified)) {
              alert('⚠️ 硬校验：严重/高危漏洞未修复不能发奖，请确认已有复测记录')
              return
            }
            setShowBountyModal(true)
          }}>
            批准奖金
          </button>
        )}
        {canPerformAction('acknowledge') && (
          <button className="btn btn-primary" disabled={actionLoading} onClick={() => handleAction('acknowledge')}>
            公开致谢
          </button>
        )}
        {canPerformAction('reject') && (
          <button className="btn btn-danger" disabled={actionLoading} onClick={() => {
            if (confirm('确定要拒绝此报告吗？')) {
              handleAction('reject')
            }
          }}>
            拒绝报告
          </button>
        )}
      </div>

      <div className="form-row">
        <div className="card">
          <div className="detail-section">
            <h3>基本信息</h3>
            <div className="detail-grid">
              <div className="detail-label">报告ID</div>
              <div className="detail-value">{report.id}</div>
              <div className="detail-label">严重等级</div>
              <div className="detail-value">
                <span className={`badge badge-${report.severity}`}>{severityLabels[report.severity]}</span>
              </div>
              <div className="detail-label">当前状态</div>
              <div className="detail-value">
                <span className={`badge status-${report.status}`}>{statusLabels[report.status]}</span>
              </div>
              <div className="detail-label">关联资产</div>
              <div className="detail-value">{report.asset.name} ({report.asset.url})</div>
              <div className="detail-label">提交者</div>
              <div className="detail-value">{report.submitter.name} ({report.submitter.email})</div>
              <div className="detail-label">处理人</div>
              <div className="detail-value">
                {report.assignee ? `${report.assignee.name} (${roleLabels[report.assignee.role]})` : '未分配'}
              </div>
              <div className="detail-label">奖金金额</div>
              <div className="detail-value">
                {report.bountyAmount ? `¥${report.bountyAmount.toLocaleString()}` : '未评定'}
              </div>
              <div className="detail-label">提交时间</div>
              <div className="detail-value">{formatDate(report.createdAt)}</div>
              <div className="detail-label">更新时间</div>
              <div className="detail-value">{formatDate(report.updatedAt)}</div>
            </div>
          </div>

          <div className="detail-section">
            <h3>漏洞描述</h3>
            <div style={{ background: '#f7fafc', padding: '1rem', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
              {report.description}
            </div>
          </div>

          {report.retestRecords && report.retestRecords.length > 0 && (
            <div className="detail-section">
              <h3>复测记录</h3>
              {report.retestRecords.map(record => (
                <div key={record.id} className="comment" style={{ borderLeftColor: record.isVerified ? '#48bb78' : '#e53e3e' }}>
                  <div className="comment-header">
                    <span>
                      <span className={`badge ${record.isVerified ? 'badge-LOW' : 'badge-HIGH'}`}>
                        {record.isVerified ? '已验证修复' : '修复未通过'}
                      </span>
                    </span>
                    <span>{formatDate(record.createdAt)}</span>
                  </div>
                  <div>{record.note || '无备注'}</div>
                </div>
              ))}
            </div>
          )}

          {report.bountyApprovals && report.bountyApprovals.length > 0 && (
            <div className="detail-section">
              <h3>奖金审批记录</h3>
              {report.bountyApprovals.map(approval => (
                <div key={approval.id} className="comment" style={{ borderLeftColor: '#48bb78' }}>
                  <div className="comment-header">
                    <span>
                      <span className="badge status-BOUNTY_APPROVED">
                        {statusLabels[approval.status]} ¥{approval.amount.toLocaleString()}
                      </span>
                      <span style={{ marginLeft: '0.5rem' }}>审批人：{approval.approvedBy.name}</span>
                    </span>
                  </div>
                  <div>{approval.note || '无备注'}</div>
                </div>
              ))}
            </div>
          )}

          <div className="detail-section">
            <h3>评论</h3>
            {report.comments.length === 0 ? (
              <p style={{ color: '#718096' }}>暂无评论</p>
            ) : (
              report.comments.map(c => (
                <div key={c.id} className="comment">
                  <div className="comment-header">
                    <span>
                      <strong>{c.author.name}</strong>
                      <span style={{ marginLeft: '0.5rem', color: '#a0aec0' }}>({roleLabels[c.author.role]})</span>
                    </span>
                    <span>{formatDate(c.createdAt)}</span>
                  </div>
                  <div>{c.content}</div>
                </div>
              ))
            )}
            <div style={{ marginTop: '1rem' }}>
              <textarea
                className="form-group"
                placeholder="添加评论..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
              <button className="btn btn-primary" onClick={handleAddComment} disabled={!comment.trim()}>
                发表评论
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="detail-section">
            <h3>状态流转</h3>
            <div className="status-timeline">
              {report.statusHistory.map((history, index) => (
                <div key={history.id} className="timeline-item">
                  <div className="timeline-date">{formatDate(history.createdAt)}</div>
                  <div className="timeline-status">
                    <span className={`badge status-${history.status}`}>
                      {statusLabels[history.status]}
                    </span>
                    <span style={{ marginLeft: '0.5rem', fontWeight: 'normal', color: '#718096' }}>
                      由 {history.createdBy.name} 操作
                    </span>
                  </div>
                  {history.note && (
                    <div className="timeline-note">{history.note}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <h3>操作说明</h3>
            <div style={{ fontSize: '0.875rem', color: '#4a5568', lineHeight: '1.8' }}>
              <p><strong>🔒 硬校验规则：</strong></p>
              <p>1. 重复报告会自动合并到最早提交的原始报告</p>
              <p>2. 严重/高危漏洞必须先修复并经研究员确认，才能申请和批准奖金</p>
              <p>3. 修复结果必须由最初提交报告的研究员确认</p>
              <hr style={{ margin: '1rem 0', borderColor: '#e2e8f0' }} />
              <p><strong>📋 标准流程：</strong></p>
              <p>提交 → 审核 → 分派 → 修复 → 申请复测 → 研究员确认 → 申请奖金 → 审批 → 公开致谢</p>
            </div>
          </div>
        </div>
      </div>

      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>分派给开发人员</h3>
              <button className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>×</button>
            </div>
            <div className="form-group">
              <label>选择开发人员</label>
              <select value={selectedDeveloper} onChange={(e) => setSelectedDeveloper(e.target.value)}>
                <option value="">请选择...</option>
                {developers.map(dev => (
                  <option key={dev.id} value={dev.id}>{dev.name}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleAssign} disabled={!selectedDeveloper}>
                确认分派
              </button>
            </div>
          </div>
        </div>
      )}

      {showBountyModal && (
        <div className="modal-overlay" onClick={() => setShowBountyModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>批准奖金</h3>
              <button className="btn btn-secondary" onClick={() => setShowBountyModal(false)}>×</button>
            </div>
            {(report.severity === 'CRITICAL' || report.severity === 'HIGH') && (
              <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
                ⚠️ 硬校验：{report.severity === 'CRITICAL' ? '高危' : '严重'}漏洞必须已修复并经研究员确认后才能发奖
              </div>
            )}
            <div className="form-group">
              <label>奖金金额（元）</label>
              <input
                type="number"
                value={bountyAmount}
                onChange={(e) => setBountyAmount(e.target.value)}
                placeholder="请输入奖金金额"
                min="0"
                step="100"
              />
            </div>
            <div className="form-group">
              <label>审批备注</label>
              <textarea
                value={bountyNote}
                onChange={(e) => setBountyNote(e.target.value)}
                placeholder="请输入审批备注（可选）"
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowBountyModal(false)}>取消</button>
              <button className="btn btn-success" onClick={handleApproveBounty} disabled={!bountyAmount}>
                确认批准
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
