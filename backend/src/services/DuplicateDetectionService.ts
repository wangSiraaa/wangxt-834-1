import prisma from '../prisma'
import { Severity, ReportStatus, DuplicateCheckResult, DuplicateMatch, asSeverity, asReportStatus } from '../types'

export class DuplicateDetectionService {
  private static calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim()
    const s2 = str2.toLowerCase().trim()
    
    if (s1 === s2) return 1.0
    
    const words1 = new Set(s1.split(/\s+/))
    const words2 = new Set(s2.split(/\s+/))
    
    let common = 0
    for (const word of words1) {
      if (words2.has(word)) common++
    }
    
    const union = words1.size + words2.size - common
    const jaccard = union > 0 ? common / union : 0
    
    if (s1.includes(s2) || s2.includes(s1)) {
      return Math.max(jaccard, 0.7)
    }
    
    return jaccard
  }

  private static extractKeywords(text: string): string[] {
    const keywords = [
      'sql注入', 'xss', '跨站脚本', 'csrf', '跨站请求伪造', 'rce', '远程命令执行',
      '命令执行', '代码执行', '文件上传', '文件包含', '目录遍历', '路径遍历',
      '越权', '未授权', '敏感信息泄露', '信息泄露', '暴力破解', '弱口令',
      'sql injection', 'cross site', 'command injection', 'file upload',
      'path traversal', 'directory traversal', 'unauthorized', 'information disclosure'
    ]
    
    const lowerText = text.toLowerCase()
    return keywords.filter(kw => lowerText.includes(kw.toLowerCase()))
  }

  static async checkDuplicate(
    assetId: string,
    title: string,
    description: string,
    severity: Severity,
    excludeReportId?: string
  ): Promise<DuplicateCheckResult & { matches: DuplicateMatch[] }> {
    const excludedStatuses = [ReportStatus.REJECTED, ReportStatus.DUPLICATE] as string[]
    
    const activeReports = await prisma.report.findMany({
      where: {
        assetId,
        id: { not: excludeReportId },
        status: { notIn: excludedStatuses },
        isMerged: false
      },
      include: {
        submitter: { select: { name: true } }
      }
    })

    const matches: DuplicateMatch[] = []
    let bestMatch: typeof activeReports[0] | null = null
    let bestScore = 0
    let bestReasons: string[] = []

    const newKeywords = this.extractKeywords(title + ' ' + description)

    for (const report of activeReports) {
      const reasons: string[] = []
      let score = 0

      if (report.severity === severity) {
        score += 0.2
        reasons.push('严重等级相同')
      }

      const titleSimilarity = this.calculateSimilarity(title, report.title)
      if (titleSimilarity >= 0.5) {
        score += titleSimilarity * 0.4
        reasons.push(`标题相似度 ${(titleSimilarity * 100).toFixed(0)}%`)
      }

      const descSimilarity = this.calculateSimilarity(description, report.description)
      if (descSimilarity >= 0.3) {
        score += descSimilarity * 0.3
        reasons.push(`描述相似度 ${(descSimilarity * 100).toFixed(0)}%`)
      }

      const existingKeywords = this.extractKeywords(report.title + ' ' + report.description)
      const commonKeywords = newKeywords.filter(k => existingKeywords.includes(k))
      if (commonKeywords.length > 0) {
        score += Math.min(commonKeywords.length * 0.1, 0.3)
        reasons.push(`匹配漏洞关键词: ${commonKeywords.join(', ')}`)
      }

      if (score >= 0.4) {
        matches.push({
          report: {
            id: report.id,
            title: report.title,
            severity: report.severity,
            status: report.status,
            submitter: { name: report.submitter.name }
          },
          similarity: score,
          reason: reasons.join('; ')
        })
      }

      if (score > bestScore && score >= 0.4) {
        bestScore = score
        bestMatch = report
        bestReasons = reasons
      }
    }

    matches.sort((a, b) => b.similarity - a.similarity)

    if (bestMatch && bestScore >= 0.5) {
      return {
        isDuplicate: true,
        matches,
        matchingReport: {
          id: bestMatch.id,
          title: bestMatch.title,
          severity: asSeverity(bestMatch.severity),
          status: asReportStatus(bestMatch.status),
          submitterName: bestMatch.submitter.name
        },
        matchScore: bestScore,
        matchReasons: bestReasons
      }
    }

    return {
      isDuplicate: false,
      matches,
      matchScore: bestScore,
      matchReasons: []
    }
  }

  static async findDuplicateGroup(originalReportId: string) {
    const report = await prisma.report.findUnique({
      where: { id: originalReportId },
      include: {
        duplicates: {
          include: { submitter: { select: { name: true, username: true } } }
        }
      }
    })
    return report?.duplicates || []
  }
}
