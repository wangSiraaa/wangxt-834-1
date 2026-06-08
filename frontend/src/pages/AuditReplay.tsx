import React, { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { statusLabels, severityLabels, roleLabels, formatDate } from '../utils/statusLabels'

interface TimelineItem {
  id: string
  fromStatus: string | null
  toStatus: string
  changedBy: {
    id: string
    name: string
    role: string
  }
  note: string | null
  createdAt: string
  snapshot: {
    status: string
    assigneeId: string | null
    bountyAmount: number | null
  }
}

interface AuditLog {
  id: string
  action: string
  userId: string | null
  userName: string | null
  details: string | null
  createdAt: string
}

interface RetestRecord {
  id: string
  isVerified: boolean
  comment: string | null
  researcherName: string
  verifiedAt: string | null
  createdAt: string
}

interface AuditReplayData {
  reportId: string
  reportTitle: string
  severity: string
  status: string
  timeline: TimelineItem[]
  auditLogs: AuditLog[]
  retestRecords: RetestRecord[]
}

const speeds = [0.5, 1, 2]

export default function AuditReplay() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState<AuditReplayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [bountyValidation, setBountyValidation] = useState<{
    eligible: boolean
    errors: Array<{ code: string; message: string }>
  } | null>(null)
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchData()
    fetchBountyValidation()
  }, [id])

  useEffect(() => {
    if (isPlaying && data && data.timeline.length > 0) {
      playIntervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= data.timeline.length - 1) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, 2000 / speed)
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current)
      }
    }
  }, [isPlaying, speed, data])

  async function fetchData() {
    try {
      setLoading(true)
      const res = await axios.get(`/api/reports/${id}/audit`)
      setData(res.data.data)
      if (res.data.data.timeline.length > 0) {
        setCurrentIndex(res.data.data.timeline.length - 1)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '加载审计数据失败')
    } finally {
      setLoading(false)
    }
  }

  async function fetchBountyValidation() {
    try {
      const res = await axios.get(`/api/reports/${id}/validate-bounty`)
      setBountyValidation(res.data.data)
    } catch (err) {
      console.error('Fetch bounty validation error:', err)
    }
  }

  const handlePlayPause = useCallback(() => {
    if (!data || data.timeline.length === 0) return
    
    if (isPlaying) {
      setIsPlaying(false)
    } else {
      if (currentIndex >= data.timeline.length - 1) {
        setCurrentIndex(0)
      }
      setIsPlaying(true)
    }
  }, [isPlaying, currentIndex, data])

  const handlePrev = useCallback(() => {
    if (!data || currentIndex <= 0) return
    setIsPlaying(false)
    setCurrentIndex(prev => prev - 1)
  }, [currentIndex, data])

  const handleNext = useCallback(() => {
    if (!data || currentIndex >= data.timeline.length - 1) return
    setIsPlaying(false)
    setCurrentIndex(prev => prev + 1)
  }, [currentIndex, data])

  const handleJumpTo = useCallback((index: number) => {
    setIsPlaying(false)
    setCurrentIndex(index)
  }, [])

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!data || data.timeline.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const newIndex = Math.min(
      Math.floor(percent * data.timeline.length),
      data.timeline.length - 1
    )
    handleJumpTo(Math.max(0, newIndex))
  }, [data, handleJumpTo])

  const getBountyValidationClass = () => {
    if (!bountyValidation) return 'warning'
    if (bountyValidation.eligible) return 'eligible'
    return 'not-eligible'
  }

  const getBountyValidationIcon = () => {
    if (!bountyValidation) return '⚠️'
    if (bountyValidation.eligible) return '✅'
    return '❌'
  }

  const getBountyValidationText = () => {
    if (!bountyValidation) return '校验中...'
    if (bountyValidation.eligible) return '奖金发放资格校验通过'
    return '奖金发放资格校验不通过'
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="card">
          <p>加载审计回放数据中...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container">
        <div className="alert alert-error">{error || '加载失败'}</div>
        <Link to="/reports" className="btn btn-secondary">
          返回报告列表
        </Link>
      </div>
    )
  }

  const currentItem = data.timeline[currentIndex]
  const progressPercent = data.timeline.length > 0 
    ? ((currentIndex + 1) / data.timeline.length) * 100 
    : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🔍 审计回放</h2>
          <p style={{ color: '#718096', marginTop: '0.5rem' }}>
            {data.reportTitle}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to={`/reports/${id}`} className="btn btn-secondary">
            返回报告详情
          </Link>
          <Link to="/reports" className="btn btn-secondary">
            报告列表
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: '#718096', fontSize: '0.85rem' }}>严重程度</span>
            <div style={{ marginTop: '0.25rem' }}>
              <span className={`badge badge-${data.severity}`}>
                {severityLabels[data.severity]}
              </span>
            </div>
          </div>
          <div>
            <span style={{ color: '#718096', fontSize: '0.85rem' }}>当前状态</span>
            <div style={{ marginTop: '0.25rem' }}>
              <span className={`badge status-${data.status}`}>
                {statusLabels[data.status]}
              </span>
            </div>
          </div>
          <div>
            <span style={{ color: '#718096', fontSize: '0.85rem' }}>状态变更次数</span>
            <div style={{ marginTop: '0.25rem', fontSize: '1.5rem', fontWeight: '700', color: '#667eea' }}>
              {data.timeline.length}
            </div>
          </div>
          <div>
            <span style={{ color: '#718096', fontSize: '0.85rem' }}>审计日志条数</span>
            <div style={{ marginTop: '0.25rem', fontSize: '1.5rem', fontWeight: '700', color: '#667eea' }}>
              {data.auditLogs.length}
            </div>
          </div>
        </div>
      </div>

      {bountyValidation && (data.severity === 'HIGH' || data.severity === 'CRITICAL') && (
        <div className={`bounty-validation-card ${getBountyValidationClass()}`}>
          <div className="bounty-validation-title">
            {getBountyValidationIcon()} {getBountyValidationText()}
          </div>
          {!bountyValidation.eligible && bountyValidation.errors.length > 0 && (
            <div>
              {bountyValidation.errors.map((err, idx) => (
                <div key={idx} className="bounty-validation-error">
                  <span className="bounty-validation-error-code">[{err.code}]</span>
                  {err.message}
                </div>
              ))}
            </div>
          )}
          {bountyValidation.eligible && (
            <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
              该严重漏洞已满足发奖条件：状态已验证、存在复测通过记录、复测由提交研究员确认。
            </p>
          )}
        </div>
      )}

      <div className="audit-replay-container">
        <div>
          <div className="audit-timeline-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '2px solid #e2e8f0' }}>
              <h3 style={{ color: '#2d3748' }}>📊 状态时间线</h3>
              <span style={{ fontSize: '0.85rem', color: '#718096' }}>
                共 {data.timeline.length} 次状态变更
              </span>
            </div>
            
            <div className="audit-timeline">
              {data.timeline.map((item, index) => (
                <div
                  key={item.id}
                  className={`audit-timeline-item ${
                    index === currentIndex ? 'active' : 
                    index < currentIndex ? 'past' : 'future'
                  }`}
                  onClick={() => handleJumpTo(index)}
                >
                  <div className="audit-timeline-dot"></div>
                  <div className="audit-timeline-time">
                    {formatDate(item.createdAt)}
                  </div>
                  <div className="audit-timeline-status">
                    <span className={`badge status-${item.toStatus}`}>
                      {statusLabels[item.toStatus]}
                    </span>
                    {item.fromStatus && (
                      <span style={{ marginLeft: '0.5rem', color: '#a0aec0', fontSize: '0.8rem' }}>
                        ← {statusLabels[item.fromStatus]}
                      </span>
                    )}
                  </div>
                  <div className="audit-timeline-user">
                    操作人：{item.changedBy.name} ({roleLabels[item.changedBy.role]})
                  </div>
                  {item.note && (
                    <div className="audit-timeline-note">
                      {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="audit-controls">
            <button
              className="audit-control-btn"
              onClick={handlePrev}
              disabled={currentIndex <= 0}
              title="上一步"
            >
              ⏮
            </button>
            <button
              className="audit-control-btn play"
              onClick={handlePlayPause}
              disabled={data.timeline.length === 0}
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              className="audit-control-btn"
              onClick={handleNext}
              disabled={currentIndex >= data.timeline.length - 1}
              title="下一步"
            >
              ⏭
            </button>
            
            <div 
              className="audit-progress"
              onClick={handleProgressClick}
              title="点击跳转"
            >
              <div 
                className="audit-progress-bar" 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            <div className="audit-counter">
              {currentIndex + 1} / {data.timeline.length}
            </div>

            <select
              className="audit-speed-select"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              {speeds.map(s => (
                <option key={s} value={s}>{s}x</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="audit-detail-panel">
            <div className="audit-detail-header">
              <h3>🔍 当前状态详情</h3>
              {currentItem && (
                <div className="audit-detail-status">
                  {statusLabels[currentItem.toStatus]}
                </div>
              )}
            </div>

            {currentItem && (
              <>
                <div className="audit-detail-section">
                  <h4>基本信息</h4>
                  <div className="audit-detail-row">
                    <span className="audit-detail-label">操作时间</span>
                    <span className="audit-detail-value">{formatDate(currentItem.createdAt)}</span>
                  </div>
                  <div className="audit-detail-row">
                    <span className="audit-detail-label">操作人</span>
                    <span className="audit-detail-value">{currentItem.changedBy.name}</span>
                  </div>
                  <div className="audit-detail-row">
                    <span className="audit-detail-label">角色</span>
                    <span className="audit-detail-value">{roleLabels[currentItem.changedBy.role]}</span>
                  </div>
                  <div className="audit-detail-row">
                    <span className="audit-detail-label">变更前</span>
                    <span className="audit-detail-value">
                      {currentItem.fromStatus ? statusLabels[currentItem.fromStatus] : '—'}
                    </span>
                  </div>
                  <div className="audit-detail-row">
                    <span className="audit-detail-label">变更后</span>
                    <span className="audit-detail-value">
                      <span className={`badge status-${currentItem.toStatus}`}>
                        {statusLabels[currentItem.toStatus]}
                      </span>
                    </span>
                  </div>
                </div>

                {currentItem.note && (
                  <div className="audit-detail-section">
                    <h4>操作备注</h4>
                    <div className="audit-snapshot">
                      {currentItem.note}
                    </div>
                  </div>
                )}

                <div className="audit-detail-section">
                  <h4>数据快照</h4>
                  <div className="audit-snapshot">
                    <div style={{ marginBottom: '0.5rem' }}>
                      <div className="audit-snapshot-label">当前状态</div>
                      <div className="audit-snapshot-value">
                        <span className={`badge status-${currentItem.snapshot.status}`}>
                          {statusLabels[currentItem.snapshot.status]}
                        </span>
                      </div>
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <div className="audit-snapshot-label">指派开发</div>
                      <div className="audit-snapshot-value">
                        {currentItem.snapshot.assigneeId ? '已指派' : '未指派'}
                      </div>
                    </div>
                    <div>
                      <div className="audit-snapshot-label">奖金金额</div>
                      <div className="audit-snapshot-value">
                        {currentItem.snapshot.bountyAmount 
                          ? `¥${currentItem.snapshot.bountyAmount.toLocaleString()}` 
                          : '未设置'}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {data.retestRecords.length > 0 && (
              <div className="audit-detail-section">
                <h4>复测记录 ({data.retestRecords.length})</h4>
                {data.retestRecords.map(record => (
                  <div 
                    key={record.id} 
                    className="audit-snapshot"
                    style={{ marginBottom: '0.75rem', borderLeftColor: record.isVerified ? '#48bb78' : '#e53e3e' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span className={`badge ${record.isVerified ? 'status-VERIFIED' : 'status-REJECTED'}`}>
                        {record.isVerified ? '复测通过' : '复测未通过'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#718096' }}>
                        {record.researcherName}
                      </span>
                    </div>
                    {record.comment && (
                      <div style={{ fontSize: '0.85rem', color: '#4a5568' }}>
                        {record.comment}
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: '0.5rem' }}>
                      {record.verifiedAt ? formatDate(record.verifiedAt) : formatDate(record.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="audit-detail-section">
              <h4>审计日志</h4>
              <div className="audit-logs">
                {data.auditLogs.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#a0aec0' }}>
                    暂无审计日志
                  </div>
                ) : (
                  data.auditLogs.slice().reverse().slice(0, 10).map(log => (
                    <div key={log.id} className="audit-log-item">
                      <div>
                        <span className="audit-log-action">{log.action}</span>
                        <span style={{ marginLeft: '0.5rem', color: '#a0aec0', fontSize: '0.75rem' }}>
                          {log.userName || '系统'} · {formatDate(log.createdAt)}
                        </span>
                      </div>
                      {log.details && (
                        <div className="audit-log-details">{log.details}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
