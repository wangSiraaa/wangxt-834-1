import { UserRole, ReportStatus, Severity } from '@prisma/client'

export interface JwtPayload {
  userId: string
  username: string
  role: UserRole
}

export interface AuthRequest extends Request {
  user?: JwtPayload
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface ReportCreateInput {
  title: string
  description: string
  proofOfConcept?: string
  severity: Severity
  assetId: string
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  matchingReport?: {
    id: string
    title: string
    severity: Severity
    status: ReportStatus
    submitterName: string
  }
  matchScore: number
  matchReasons: string[]
}
