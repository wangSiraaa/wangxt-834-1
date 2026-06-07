export const statusLabels: Record<string, string> = {
  SUBMITTED: '已提交',
  TRIAGING: '审核中',
  DUPLICATE: '重复报告',
  ASSIGNED: '已分派',
  FIXING: '修复中',
  FIXED: '已修复',
  RETESTING: '复测中',
  VERIFIED: '已验证',
  REJECTED: '已拒绝',
  APPROVING_BOUNTY: '奖金审批中',
  BOUNTY_APPROVED: '奖金已批准',
  BOUNTY_REJECTED: '奖金已拒绝',
  PUBLICLY_ACKNOWLEDGED: '已公开致谢'
}

export const severityLabels: Record<string, string> = {
  LOW: '低危',
  MEDIUM: '中危',
  HIGH: '严重',
  CRITICAL: '高危'
}

export const roleLabels: Record<string, string> = {
  RESEARCHER: '安全研究员',
  TRIAGER: '漏洞审核员',
  DEVELOPER: '开发工程师',
  ADMIN: '系统管理员',
  APPROVER: '奖金审批员'
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
