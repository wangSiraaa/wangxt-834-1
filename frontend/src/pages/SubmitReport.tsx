import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { severityLabels } from '../utils/statusLabels'

interface Asset {
  id: string
  name: string
  url: string
}

interface DuplicateMatch {
  reportId: string
  title: string
  similarity: number
  reason: string
  severity: string
  submitter: string
  status: string
}

interface DuplicateCheckResult {
  isDuplicate: boolean
  matches: DuplicateMatch[]
  message: string
  shouldMerge: boolean
  mergeTarget?: { id: string; title: string }
}

export default function SubmitReport() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedAsset, setSelectedAsset] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('MEDIUM')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheckResult | null>(null)
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showMergeConfirm, setShowMergeConfirm] = useState(false)
  const [confirmedMerge, setConfirmedMerge] = useState(false)

  useEffect(() => {
    fetchAssets()
  }, [])

  async function fetchAssets() {
    try {
      const res = await axios.get('/api/assets')
      setAssets(res.data.data || [])
      if (res.data.data && res.data.data.length > 0) {
        setSelectedAsset(res.data.data[0].id)
      }
    } catch (err) {
      console.error('Fetch assets error:', err)
    }
  }

  const checkDuplicate = useCallback(async () => {
    if (!selectedAsset || !title.trim() || title.length < 5) {
      setDuplicateCheck(null)
      return
    }

    setLoading(true)
    try {
      const res = await axios.post('/api/reports/check-duplicate', {
        assetId: selectedAsset,
        title: title,
        description: description,
        severity: severity
      })
      setDuplicateCheck(res.data.data)
    } catch (err: any) {
      console.error('Check duplicate error:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedAsset, title, description, severity])

  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    const timer = setTimeout(() => {
      checkDuplicate()
    }, 500)
    setDebounceTimer(timer)
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [selectedAsset, title, description, severity, checkDuplicate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAsset || !title.trim() || !description.trim()) {
      setError('请填写完整的漏洞信息')
      return
    }

    if (duplicateCheck?.isDuplicate && !confirmedMerge) {
      setShowMergeConfirm(true)
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const res = await axios.post('/api/reports', {
        assetId: selectedAsset,
        title: title.trim(),
        description: description.trim(),
        severity: severity,
        confirmMerge: confirmedMerge
      })

      if (res.data.data?.isMerged) {
        setSuccess(`✅ 报告已提交并自动合并到原始报告：${res.data.data.duplicateOf?.title}`)
        setTimeout(() => {
          navigate(`/reports/${res.data.data.id}`)
        }, 2000)
      } else {
        setSuccess('✅ 漏洞报告提交成功！')
        setTimeout(() => {
          navigate(`/reports/${res.data.data.id}`)
        }, 1500)
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || '提交失败'
      setError(msg)
      if (msg.includes('硬校验')) {
        alert('⚠️ 硬校验失败：' + msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleMergeConfirm() {
    setConfirmedMerge(true)
    setShowMergeConfirm(false)
    setTimeout(() => {
      const form = document.getElementById('reportForm') as HTMLFormElement
      if (form) form.requestSubmit()
    }, 100)
  }

  return (
    <div>
      <div className="page-header">
        <h2>提交漏洞报告</h2>
        <button className="btn btn-secondary" onClick={() => navigate('/reports')}>
          ← 返回列表
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="form-row">
        <div className="card">
          <form id="reportForm" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>选择资产 <span style={{ color: '#e53e3e' }}>*</span></label>
              <select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                required
              >
                <option value="">请选择资产...</option>
                {assets.map(asset => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} ({asset.url})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>漏洞标题 <span style={{ color: '#e53e3e' }}>*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="请简要描述漏洞，例如：用户登录处存在SQL注入漏洞"
                required
                minLength={5}
              />
              <small style={{ color: '#718096' }}>
                输入标题后系统将自动检测是否有重复报告
              </small>
            </div>

            <div className="form-group">
              <label>严重等级 <span style={{ color: '#e53e3e' }}>*</span></label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                required
              >
                {Object.entries(severityLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <small style={{ color: '#718096', display: 'block', marginTop: '0.25rem' }}>
                <span className="badge badge-LOW">低危</span> 一般性问题 /
                <span className="badge badge-MEDIUM">中危</span> 普通漏洞 /
                <span className="badge badge-HIGH">严重</span> 重要业务影响 /
                <span className="badge badge-CRITICAL">高危</span> 核心系统严重漏洞
              </small>
            </div>

            <div className="form-group">
              <label>漏洞详情描述 <span style={{ color: '#e53e3e' }}>*</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="请详细描述：&#10;1. 漏洞位置和复现步骤&#10;2. 影响范围和危害程度&#10;3. 建议的修复方案&#10;4. 相关截图或POC"
                rows={10}
                required
                minLength={20}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !selectedAsset || !title.trim() || !description.trim()}
              >
                {submitting ? '提交中...' : '提交漏洞报告'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/reports')}
                disabled={submitting}
              >
                取消
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="detail-section">
            <h3>🔍 重复检测</h3>

            {loading && (
              <div className="alert alert-info">
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                正在检测是否有重复报告...
              </div>
            )}

            {!loading && !duplicateCheck && (
              <div style={{ color: '#718096', textAlign: 'center', padding: '2rem' }}>
                <p style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔍</p>
                <p>输入漏洞标题后，系统将自动检测是否存在重复报告</p>
                <small>检测维度：标题相似度、描述相似度、关键词匹配、严重等级</small>
              </div>
            )}

            {!loading && duplicateCheck && (
              <div>
                {duplicateCheck.isDuplicate ? (
                  <div className="alert alert-warning" style={{ borderColor: '#ed8936' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                      <strong>硬校验：检测到 {duplicateCheck.matches.length} 个可能的重复报告</strong>
                    </div>
                    <p style={{ marginBottom: '0.75rem' }}>{duplicateCheck.message}</p>

                    {duplicateCheck.shouldMerge && duplicateCheck.mergeTarget && (
                      <div style={{
                        background: 'rgba(237, 137, 54, 0.1)',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        marginBottom: '0.75rem'
                      }}>
                        <strong>自动合并建议：</strong>
                        <p style={{ marginTop: '0.25rem' }}>
                          此报告将自动合并到：
                          <a
                            onClick={() => navigate(`/reports/${duplicateCheck.mergeTarget!.id}`)}
                            style={{ color: '#dd6b20', textDecoration: 'underline', cursor: 'pointer', fontWeight: '600' }}
                          >
                            {duplicateCheck.mergeTarget.title}
                          </a>
                        </p>
                      </div>
                    )}

                    <div style={{ marginTop: '1rem' }}>
                      <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>相似报告列表：</p>
                      {duplicateCheck.matches.map((match, index) => (
                        <div
                          key={match.reportId}
                          style={{
                            background: 'white',
                            padding: '0.75rem',
                            borderRadius: '6px',
                            marginBottom: '0.5rem',
                            border: '1px solid #fbd38d'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <a
                              onClick={() => navigate(`/reports/${match.reportId}`)}
                              style={{ fontWeight: '600', color: '#667eea', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              {match.title}
                            </a>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <span className={`badge badge-${match.severity}`} style={{ fontSize: '0.65rem' }}>
                                {severityLabels[match.severity]}
                              </span>
                              <span className="badge badge-MEDIUM" style={{ fontSize: '0.65rem', background: '#e9d8fd', color: '#44337a' }}>
                                匹配度 {(match.similarity * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#718096' }}>
                            提交者：{match.submitter} | {match.reason}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fefcbf', borderRadius: '6px', fontSize: '0.875rem' }}>
                      <strong>💡 提示：</strong>
                      <p style={{ marginTop: '0.25rem' }}>
                        确认提交后，您的报告将被标记为重复并合并到原始报告。
                        奖金将分配给原始报告提交者。
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-success">
                    <span style={{ fontSize: '1.5rem', marginRight: '0.5rem' }}>✅</span>
                    <strong>未检测到重复报告</strong>
                    <p style={{ marginTop: '0.25rem', marginBottom: 0 }}>
                      {duplicateCheck.message || '可以正常提交此漏洞报告'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="detail-section">
            <h3>📝 提交规范</h3>
            <div style={{ fontSize: '0.875rem', color: '#4a5568', lineHeight: '1.8' }}>
              <p><strong>标题规范：</strong>[模块] 简要描述问题</p>
              <p><strong>描述建议包含：</strong></p>
              <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                <li>漏洞产生的具体位置</li>
                <li>详细的复现步骤</li>
                <li>漏洞的影响范围</li>
                <li>漏洞的危害程度</li>
                <li>建议的修复方案</li>
              </ul>
              <p style={{ marginTop: '0.75rem' }}><strong>🔒 硬校验规则：</strong></p>
              <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                <li>重复报告会自动合并到最早提交的报告</li>
                <li>严重/高危漏洞必须修复并经研究员确认才能发奖</li>
                <li>修复结果必须由提交报告的研究员确认</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {showMergeConfirm && (
        <div className="modal-overlay" onClick={() => setShowMergeConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ 确认提交重复报告</h3>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
                <p style={{ marginBottom: '0.5rem' }}><strong>硬校验提示：</strong></p>
                <p>检测到您提交的漏洞与已有报告高度相似。</p>
              </div>
              <p>确认提交后：</p>
              <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', color: '#4a5568' }}>
                <li>您的报告将被标记为 <strong>重复报告</strong></li>
                <li>自动合并到最早提交的原始报告</li>
                <li>奖金将分配给原始报告提交者</li>
                <li>您将作为共同发现者被记录</li>
              </ul>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowMergeConfirm(false)}>
                取消，重新编辑
              </button>
              <button className="btn btn-warning" onClick={handleMergeConfirm}>
                确认提交（将合并）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
