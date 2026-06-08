import { Response } from 'express'
import prisma from '../prisma'
import { AuthRequest, Severity } from '../types'
import { ReportService } from '../services/ReportService'
import { z } from 'zod'

const createReportSchema = z.object({
  title: z.string().min(5, '标题至少5个字符'),
  description: z.string().min(20, '描述至少20个字符'),
  proofOfConcept: z.string().optional(),
  severity: z.enum([Severity.LOW, Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL]),
  assetId: z.string().uuid('无效的资产ID')
})

export async function createReport(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未登录' })
    }

    const result = createReportSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: '参数校验失败',
        details: result.error.issues
      })
    }

    const reportResult = await ReportService.createReport(
      req.user.userId,
      result.data
    )

    if (reportResult.isDuplicate) {
      return res.status(200).json({
        success: true,
        data: reportResult.report,
        isDuplicate: true,
        duplicateInfo: reportResult.duplicateInfo,
        message: '检测到可能为重复报告，已自动合并'
      })
    }

    return res.status(201).json({
      success: true,
      data: reportResult.report,
      isDuplicate: false,
      message: '报告提交成功'
    })
  } catch (err) {
    console.error('Create report error:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : '提交报告失败'
    })
  }
}

export async function checkDuplicate(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未登录' })
    }

    const { id } = req.params
    const result = await ReportService.checkDuplicate(id, req.user.userId)

    return res.json({
      success: true,
      data: result
    })
  } catch (err) {
    console.error('Check duplicate error:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : '重复检测失败'
    })
  }
}

export async function preCheckDuplicate(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未登录' })
    }

    const { assetId, title, description, severity } = req.body

    if (!assetId || !title || !description || !severity) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：assetId, title, description, severity'
      })
    }

    const result = await ReportService.preCheckDuplicate(
      assetId,
      title,
      description,
      severity as Severity
    )

    return res.json({
      success: true,
      data: result
    })
  } catch (err) {
    console.error('Pre-check duplicate error:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : '重复检测失败'
    })
  }
}

export async function markAsDuplicate(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未登录' })
    }

    const { id } = req.params
    const { originalReportId } = req.body

    if (!originalReportId) {
      return res.status(400).json({
        success: false,
        error: '必须指定原始报告ID'
      })
    }

    const report = await ReportService.markAsDuplicate(
      id,
      originalReportId,
      req.user.userId
    )

    return res.json({
      success: true,
      data: report,
      message: '已标记为重复报告'
    })
  } catch (err) {
    console.error('Mark as duplicate error:', err)
    return res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : '标记重复失败'
    })
  }
}

export async function assignToDeveloper(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未登录' })
    }

    const { id } = req.params
    const { assigneeId, note } = req.body

    if (!assigneeId) {
      return res.status(400).json({
        success: false,
        error: '必须指定开发人员ID'
      })
    }

    const report = await ReportService.assignToDeveloper(
      id,
      assigneeId,
      req.user.userId,
      note
    )

    return res.json({
      success: true,
      data: report,
      message: '已分派给开发人员'
    })
  } catch (err) {
    console.error('Assign report error:', err)
    return res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : '分派失败'
    })
  }
}

export async function startFixing(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '未登录' })

    const { id } = req.params
    const report = await ReportService.startFixing(id, req.user.userId)

    return res.json({
      success: true,
      data: report,
      message: '已开始修复'
    })
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : '操作失败'
    })
  }
}

export async function markAsFixed(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '未登录' })

    const { id } = req.params
    const { fixNote } = req.body

    const report = await ReportService.markAsFixed(id, req.user.userId, fixNote)

    return res.json({
      success: true,
      data: report,
      message: '已标记为修复完成'
    })
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : '操作失败'
    })
  }
}

export async function requestRetest(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '未登录' })

    const { id } = req.params
    const report = await ReportService.requestRetest(id, req.user.userId)

    return res.json({
      success: true,
      data: report,
      message: '已请求复测'
    })
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : '操作失败'
    })
  }
}

export async function verifyFix(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '未登录' })

    const { id } = req.params
    const { isVerified, comment } = req.body

    if (isVerified === undefined) {
      return res.status(400).json({
        success: false,
        error: '必须指定验证结果'
      })
    }

    const report = await ReportService.verifyFix(
      id,
      req.user.userId,
      isVerified,
      comment
    )

    return res.json({
      success: true,
      data: report,
      message: isVerified ? '修复验证通过' : '修复验证不通过'
    })
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : '验证失败'
    })
  }
}

export async function requestBountyApproval(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '未登录' })

    const { id } = req.params
    const { bountyAmount } = req.body

    if (!bountyAmount || bountyAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: '必须指定有效的奖金金额'
      })
    }

    const result = await ReportService.requestBountyApproval(
      id,
      req.user.userId,
      bountyAmount
    )

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      })
    }

    return res.json({
      success: true,
      data: result.data,
      message: '已提交奖金审批申请'
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : '申请失败'
    })
  }
}

export async function approveBounty(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '未登录' })

    const { id } = req.params
    const { isApproved, amount, comment } = req.body

    if (amount === undefined || amount < 0) {
      return res.status(400).json({
        success: false,
        error: '必须指定有效的奖金金额'
      })
    }

    const result = await ReportService.approveBounty(
      id,
      req.user.userId,
      isApproved,
      amount,
      comment
    )

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      })
    }

    return res.json({
      success: true,
      data: result.data,
      message: isApproved ? '奖金已批准' : '奖金已拒绝'
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : '操作失败'
    })
  }
}

export async function acknowledgePublicly(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '未登录' })

    const { id } = req.params
    const report = await ReportService.acknowledgePublicly(id, req.user.userId)

    return res.json({
      success: true,
      data: report,
      message: '已公开致谢'
    })
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : '操作失败'
    })
  }
}

export async function rejectReport(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '未登录' })

    const { id } = req.params
    const { reason } = req.body

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: '必须填写拒绝原因'
      })
    }

    const report = await ReportService.rejectReport(id, req.user.userId, reason)

    return res.json({
      success: true,
      data: report,
      message: '报告已拒绝'
    })
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : '操作失败'
    })
  }
}

export async function getReportList(req: AuthRequest, res: Response) {
  try {
    const { status, severity, submitterId, assigneeId, assetId, isMerged } = req.query
    const filters: any = {}
    
    if (status) filters.status = status
    if (severity) filters.severity = severity
    if (submitterId) filters.submitterId = submitterId
    if (assigneeId) filters.assigneeId = assigneeId
    if (assetId) filters.assetId = assetId
    if (isMerged !== undefined) filters.isMerged = isMerged === 'true'

    const reports = await ReportService.getReportList(filters)

    return res.json({
      success: true,
      data: reports
    })
  } catch (err) {
    console.error('Get report list error:', err)
    return res.status(500).json({
      success: false,
      error: '获取报告列表失败'
    })
  }
}

export async function getMyReports(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '未登录' })

    const reports = await ReportService.getReportList({
      submitterId: req.user.userId
    })

    return res.json({
      success: true,
      data: reports
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: '获取我的报告失败'
    })
  }
}

export async function getAssignedReports(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '未登录' })

    const reports = await ReportService.getReportList({
      assigneeId: req.user.userId
    })

    return res.json({
      success: true,
      data: reports
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: '获取分配给我的报告失败'
    })
  }
}

export async function getReportDetail(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const report = await ReportService.getReportDetail(id)

    if (!report) {
      return res.status(404).json({
        success: false,
        error: '报告不存在'
      })
    }

    return res.json({
      success: true,
      data: report
    })
  } catch (err) {
    console.error('Get report detail error:', err)
    return res.status(500).json({
      success: false,
      error: '获取报告详情失败'
    })
  }
}

export async function addComment(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '未登录' })

    const { id } = req.params
    const { content, isPrivate } = req.body

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: '评论内容不能为空'
      })
    }

    const comment = await ReportService.addComment(
      id,
      req.user.userId,
      content,
      isPrivate || false
    )

    return res.status(201).json({
      success: true,
      data: comment
    })
  } catch (err) {
    console.error('Add comment error:', err)
    return res.status(500).json({
      success: false,
      error: '添加评论失败'
    })
  }
}

export async function getAcknowledgedResearchers(req: AuthRequest, res: Response) {
  try {
    const researchers = await ReportService.getAcknowledgedResearchers()

    return res.json({
      success: true,
      data: researchers
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: '获取公开致谢列表失败'
    })
  }
}

export async function getAuditReplay(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '未登录' })

    const { id } = req.params
    const data = await ReportService.getAuditReplay(id)

    return res.json({
      success: true,
      data
    })
  } catch (err) {
    console.error('Get audit replay error:', err)
    return res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : '获取审计回放数据失败'
    })
  }
}

export async function getAuditLogs(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '未登录' })

    const { id } = req.params
    const { page = 1, limit = 20 } = req.query

    const auditLogs = await prisma.auditLog.findMany({
      where: { reportId: id },
      include: {
        user: { select: { name: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit)
    })

    return res.json({
      success: true,
      data: auditLogs
    })
  } catch (err) {
    console.error('Get audit logs error:', err)
    return res.status(500).json({
      success: false,
      error: '获取审计日志失败'
    })
  }
}

export async function validateBountyEligibility(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: '未登录' })

    const { id } = req.params
    const result = await ReportService.validateCriticalVulnerabilityBounty(id)

    return res.json({
      success: true,
      data: {
        eligible: result.valid,
        errors: result.errors
      }
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: '奖金资格校验失败'
    })
  }
}
