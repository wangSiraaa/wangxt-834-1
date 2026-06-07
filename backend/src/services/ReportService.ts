import prisma from '../prisma'
import { ReportStatus, Severity, UserRole } from '@prisma/client'
import { DuplicateDetectionService } from './DuplicateDetectionService'

export class ReportService {
  private static async addStatusHistory(
    reportId: string,
    fromStatus: ReportStatus | null,
    toStatus: ReportStatus,
    changedById: string,
    note?: string
  ) {
    return prisma.statusHistory.create({
      data: {
        reportId,
        fromStatus,
        toStatus,
        changedById,
        note
      }
    })
  }

  private static async addAuditLog(
    action: string,
    userId?: string,
    reportId?: string,
    details?: string
  ) {
    return prisma.auditLog.create({
      data: { action, userId, reportId, details }
    })
  }

  static async createReport(
    submitterId: string,
    data: {
      title: string
      description: string
      proofOfConcept?: string
      severity: Severity
      assetId: string
    }
  ) {
    const duplicateCheck = await DuplicateDetectionService.checkDuplicate(
      data.assetId,
      data.title,
      data.description,
      data.severity
    )

    if (duplicateCheck.isDuplicate && duplicateCheck.matchingReport) {
      const report = await prisma.report.create({
        data: {
          ...data,
          submitterId,
          status: ReportStatus.DUPLICATE,
          duplicateOfId: duplicateCheck.matchingReport.id,
          isMerged: true
        },
        include: {
          asset: true,
          submitter: { select: { id: true, name: true, username: true } }
        }
      })

      await this.addStatusHistory(report.id, null, ReportStatus.DUPLICATE, submitterId, '系统自动检测为重复报告')
      await this.addAuditLog('REPORT_SUBMITTED_DUPLICATE', submitterId, report.id, 
        `检测为重复报告，原始报告ID: ${duplicateCheck.matchingReport.id}`)

      return {
        report,
        isDuplicate: true,
        duplicateInfo: duplicateCheck
      }
    }

    const report = await prisma.report.create({
      data: {
        ...data,
        submitterId,
        status: ReportStatus.SUBMITTED
      },
      include: {
        asset: true,
        submitter: { select: { id: true, name: true, username: true } }
      }
    })

    await this.addStatusHistory(report.id, null, ReportStatus.SUBMITTED, submitterId)
    await this.addAuditLog('REPORT_SUBMITTED', submitterId, report.id)

    return {
      report,
      isDuplicate: false,
      duplicateInfo: null
    }
  }

  static async checkDuplicate(reportId: string, userId: string) {
    const report = await prisma.report.findUnique({ where: { id: reportId } })
    if (!report) throw new Error('报告不存在')

    const duplicateCheck = await DuplicateDetectionService.checkDuplicate(
      report.assetId,
      report.title,
      report.description,
      report.severity,
      reportId
    )

    await this.addAuditLog('DUPLICATE_CHECK', userId, reportId, 
      `检测结果: ${duplicateCheck.isDuplicate ? '发现重复' : '未发现重复'}, 匹配度: ${duplicateCheck.matchScore}`)

    return duplicateCheck
  }

  static async preCheckDuplicate(
    assetId: string,
    title: string,
    description: string,
    severity: Severity
  ) {
    const duplicateCheck = await DuplicateDetectionService.checkDuplicate(
      assetId,
      title,
      description,
      severity
    )

    return {
      isDuplicate: duplicateCheck.isDuplicate,
      matches: duplicateCheck.matches?.map((m: any) => ({
        reportId: m.report.id,
        title: m.report.title,
        similarity: m.similarity,
        reason: m.reason,
        severity: m.report.severity,
        submitter: m.report.submitter.name,
        status: m.report.status
      })) || [],
      message: duplicateCheck.isDuplicate 
        ? `硬校验：检测到 ${duplicateCheck.matches?.length || 0} 个相似报告，最高匹配度 ${(duplicateCheck.matchScore * 100).toFixed(0)}%，将自动合并`
        : '未检测到重复报告，可以正常提交',
      shouldMerge: duplicateCheck.isDuplicate && duplicateCheck.matchScore >= 0.5,
      mergeTarget: duplicateCheck.matches?.[0] ? {
        id: duplicateCheck.matches[0].report.id,
        title: duplicateCheck.matches[0].report.title
      } : undefined
    }
  }

  static async markAsDuplicate(
    reportId: string, 
    originalReportId: string, 
    userId: string
  ) {
    if (reportId === originalReportId) {
      throw new Error('不能将报告标记为自身的重复')
    }

    const report = await prisma.report.findUnique({ where: { id: reportId } })
    const originalReport = await prisma.report.findUnique({ where: { id: originalReportId } })

    if (!report || !originalReport) {
      throw new Error('报告不存在')
    }

    if (originalReport.status === ReportStatus.DUPLICATE || originalReport.isMerged) {
      throw new Error('原始报告本身是重复报告，不能作为目标')
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.DUPLICATE,
        duplicateOfId: originalReportId,
        isMerged: true
      },
      include: {
        duplicateOf: { include: { submitter: { select: { name: true } } } }
      }
    })

    await this.addStatusHistory(reportId, report.status, ReportStatus.DUPLICATE, userId,
      `手动标记为重复报告，原始报告: ${originalReportId}`)
    await this.addAuditLog('MARK_DUPLICATE', userId, reportId,
      `合并到报告 ${originalReportId}`)

    return updated
  }

  static async assignToDeveloper(
    reportId: string,
    assigneeId: string,
    userId: string,
    note?: string
  ) {
    const report = await prisma.report.findUnique({ where: { id: reportId } })
    if (!report) throw new Error('报告不存在')
    if (report.status === ReportStatus.DUPLICATE || report.isMerged) {
      throw new Error('重复报告不能分派')
    }
    if (report.status === ReportStatus.REJECTED) {
      throw new Error('已拒绝的报告不能分派')
    }

    const assignee = await prisma.user.findUnique({ 
      where: { id: assigneeId },
      select: { role: true, name: true }
    })
    if (!assignee) throw new Error('开发人员不存在')
    if (![UserRole.DEVELOPER, UserRole.ADMIN].includes(assignee.role)) {
      throw new Error('只能分派给开发人员或管理员')
    }

    const fromStatus = report.status
    const updated = await prisma.report.update({
      where: { id: reportId },
      data: {
        assigneeId,
        status: ReportStatus.ASSIGNED
      },
      include: {
        assignee: { select: { name: true } },
        asset: true,
        submitter: { select: { name: true } }
      }
    })

    await this.addStatusHistory(reportId, fromStatus, ReportStatus.ASSIGNED, userId,
      `分派给 ${assignee.name}${note ? ': ' + note : ''}`)
    await this.addAuditLog('ASSIGN_REPORT', userId, reportId,
      `分派给 ${assigneeId} (${assignee.name})`)

    return updated
  }

  static async startFixing(reportId: string, userId: string) {
    const report = await prisma.report.findUnique({ where: { id: reportId } })
    if (!report) throw new Error('报告不存在')
    if (report.status !== ReportStatus.ASSIGNED) {
      throw new Error('只有已分派的报告才能开始修复')
    }
    if (report.assigneeId !== userId) {
      throw new Error('只有被指派的开发人员才能开始修复')
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: { status: ReportStatus.FIXING }
    })

    await this.addStatusHistory(reportId, ReportStatus.ASSIGNED, ReportStatus.FIXING, userId)
    await this.addAuditLog('START_FIXING', userId, reportId)

    return updated
  }

  static async markAsFixed(reportId: string, userId: string, fixNote?: string) {
    const report = await prisma.report.findUnique({ where: { id: reportId } })
    if (!report) throw new Error('报告不存在')
    if (![ReportStatus.FIXING, ReportStatus.ASSIGNED].includes(report.status)) {
      throw new Error('只有修复中的报告才能标记为已修复')
    }
    if (report.assigneeId !== userId) {
      throw new Error('只有被指派的开发人员才能标记修复完成')
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: { status: ReportStatus.FIXED }
    })

    await this.addStatusHistory(reportId, report.status, ReportStatus.FIXED, userId, fixNote)
    await this.addAuditLog('MARK_FIXED', userId, reportId, fixNote)

    return updated
  }

  static async requestRetest(reportId: string, userId: string) {
    const report = await prisma.report.findUnique({ where: { id: reportId } })
    if (!report) throw new Error('报告不存在')
    if (report.status !== ReportStatus.FIXED) {
      throw new Error('只有已修复的报告才能请求复测')
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: { status: ReportStatus.RETESTING }
    })

    await this.addStatusHistory(reportId, ReportStatus.FIXED, ReportStatus.RETESTING, userId,
      '请求研究员复测')
    await this.addAuditLog('REQUEST_RETEST', userId, reportId)

    return updated
  }

  static async verifyFix(
    reportId: string,
    researcherId: string,
    isVerified: boolean,
    comment?: string
  ) {
    const report = await prisma.report.findUnique({ where: { id: reportId } })
    if (!report) throw new Error('报告不存在')
    if (report.status !== ReportStatus.RETESTING) {
      throw new Error('只有复测中的报告才能进行验证')
    }
    if (report.submitterId !== researcherId) {
      throw new Error('硬校验：只有提交报告的研究员才能确认修复结果')
    }

    const toStatus = isVerified ? ReportStatus.VERIFIED : ReportStatus.FIXING

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: { status: toStatus }
    })

    await prisma.retestRecord.create({
      data: {
        reportId,
        researcherId,
        isVerified,
        comment,
        verifiedAt: isVerified ? new Date() : null
      }
    })

    await this.addStatusHistory(reportId, ReportStatus.RETESTING, toStatus, researcherId,
      `复测${isVerified ? '通过' : '不通过'}: ${comment || ''}`)
    await this.addAuditLog(
      isVerified ? 'FIX_VERIFIED' : 'FIX_REJECTED',
      researcherId,
      reportId,
      comment
    )

    return updated
  }

  static async requestBountyApproval(reportId: string, userId: string, bountyAmount: number) {
    const report = await prisma.report.findUnique({ where: { id: reportId } })
    if (!report) throw new Error('报告不存在')
    
    if (report.status !== ReportStatus.VERIFIED) {
      throw new Error('只有验证通过的报告才能申请奖金审批')
    }

    if ([Severity.HIGH, Severity.CRITICAL].includes(report.severity)) {
      if (report.status !== ReportStatus.VERIFIED) {
        throw new Error('硬校验：严重/高危漏洞必须修复并验证通过后才能申请奖金')
      }
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.APPROVING_BOUNTY,
        bountyAmount
      }
    })

    await this.addStatusHistory(reportId, ReportStatus.VERIFIED, ReportStatus.APPROVING_BOUNTY, userId,
      `申请奖金: ¥${bountyAmount}`)
    await this.addAuditLog('REQUEST_BOUNTY', userId, reportId, `金额: ¥${bountyAmount}`)

    return updated
  }

  static async approveBounty(
    reportId: string,
    approverId: string,
    isApproved: boolean,
    amount: number,
    comment?: string
  ) {
    const report = await prisma.report.findUnique({ where: { id: reportId } })
    if (!report) throw new Error('报告不存在')
    if (report.status !== ReportStatus.APPROVING_BOUNTY) {
      throw new Error('只有审批中的奖金申请才能处理')
    }

    if (isApproved && [Severity.HIGH, Severity.CRITICAL].includes(report.severity)) {
      if (report.status !== ReportStatus.APPROVING_BOUNTY) {
        throw new Error('硬校验：严重/高危漏洞必须验证通过后才能发奖')
      }
      const hasVerifiedRetest = await prisma.retestRecord.findFirst({
        where: { reportId, isVerified: true }
      })
      if (!hasVerifiedRetest) {
        throw new Error('硬校验：严重/高危漏洞必须有研究员复测确认记录才能发奖')
      }
    }

    const toStatus = isApproved ? ReportStatus.BOUNTY_APPROVED : ReportStatus.BOUNTY_REJECTED

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: toStatus,
        bountyAmount: isApproved ? amount : report.bountyAmount
      }
    })

    await prisma.bountyApproval.create({
      data: {
        reportId,
        approverId,
        amount,
        isApproved,
        comment,
        approvedAt: isApproved ? new Date() : null
      }
    })

    await this.addStatusHistory(reportId, ReportStatus.APPROVING_BOUNTY, toStatus, approverId,
      `奖金${isApproved ? '通过' : '拒绝'}: ¥${amount}${comment ? ' - ' + comment : ''}`)
    await this.addAuditLog(
      isApproved ? 'BOUNTY_APPROVED' : 'BOUNTY_REJECTED',
      approverId,
      reportId,
      `金额: ¥${amount}, ${comment || ''}`
    )

    return updated
  }

  static async acknowledgePublicly(reportId: string, userId: string) {
    const report = await prisma.report.findUnique({ where: { id: reportId } })
    if (!report) throw new Error('报告不存在')
    if (report.status !== ReportStatus.BOUNTY_APPROVED) {
      throw new Error('只有奖金已批准的报告才能公开致谢')
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.PUBLICLY_ACKNOWLEDGED,
        acknowledged: true
      },
      include: {
        submitter: { select: { name: true, username: true } }
      }
    })

    await this.addStatusHistory(reportId, ReportStatus.BOUNTY_APPROVED, ReportStatus.PUBLICLY_ACKNOWLEDGED, userId)
    await this.addAuditLog('PUBLIC_ACKNOWLEDGED', userId, reportId)

    return updated
  }

  static async rejectReport(reportId: string, userId: string, reason: string) {
    const report = await prisma.report.findUnique({ where: { id: reportId } })
    if (!report) throw new Error('报告不存在')
    if (report.status === ReportStatus.DUPLICATE || report.isMerged) {
      throw new Error('重复报告不能拒绝')
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: { status: ReportStatus.REJECTED }
    })

    await this.addStatusHistory(reportId, report.status, ReportStatus.REJECTED, userId, reason)
    await this.addAuditLog('REPORT_REJECTED', userId, reportId, reason)

    return updated
  }

  static async getReportList(filters?: {
    status?: ReportStatus
    severity?: Severity
    submitterId?: string
    assigneeId?: string
    assetId?: string
    isMerged?: boolean
  }) {
    return prisma.report.findMany({
      where: filters,
      include: {
        asset: { select: { id: true, name: true, url: true } },
        submitter: { select: { id: true, name: true, username: true } },
        assignee: { select: { id: true, name: true } },
        duplicateOf: { select: { id: true, title: true, submitter: { select: { name: true } } } },
        _count: {
          select: {
            comments: true,
            duplicates: true,
            retestRecords: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  static async getReportDetail(reportId: string) {
    return prisma.report.findUnique({
      where: { id: reportId },
      include: {
        asset: true,
        submitter: { select: { id: true, name: true, username: true, role: true } },
        assignee: { select: { id: true, name: true, role: true } },
        duplicateOf: {
          include: { submitter: { select: { name: true } }, asset: true }
        },
        duplicates: {
          include: { submitter: { select: { name: true } } }
        },
        statusHistory: {
          include: { changedBy: { select: { name: true, role: true } } },
          orderBy: { createdAt: 'asc' }
        },
        comments: {
          include: { user: { select: { name: true, role: true } } },
          orderBy: { createdAt: 'asc' }
        },
        retestRecords: {
          include: { researcher: { select: { name: true } } },
          orderBy: { createdAt: 'desc' }
        },
        bountyApprovals: {
          include: { approver: { select: { name: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    })
  }

  static async addComment(
    reportId: string,
    userId: string,
    content: string,
    isPrivate: boolean = false
  ) {
    return prisma.reportComment.create({
      data: {
        reportId,
        userId,
        content,
        isPrivate
      },
      include: {
        user: { select: { name: true, role: true } }
      }
    })
  }

  static async getAcknowledgedResearchers() {
    return prisma.report.findMany({
      where: {
        acknowledged: true,
        status: ReportStatus.PUBLICLY_ACKNOWLEDGED
      },
      include: {
        submitter: { select: { id: true, name: true, username: true } },
        asset: { select: { name: true } }
      },
      orderBy: { updatedAt: 'desc' },
      distinct: ['submitterId']
    })
  }
}
