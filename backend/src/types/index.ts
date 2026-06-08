import { Request } from 'express'

export const UserRole = {
  RESEARCHER: 'RESEARCHER',
  TRIAGER: 'TRIAGER',
  DEVELOPER: 'DEVELOPER',
  ADMIN: 'ADMIN',
  APPROVER: 'APPROVER',
} as const

export type UserRole = typeof UserRole[keyof typeof UserRole]

export const ReportStatus = {
  SUBMITTED: 'SUBMITTED',
  TRIAGING: 'TRIAGING',
  DUPLICATE: 'DUPLICATE',
  ASSIGNED: 'ASSIGNED',
  FIXING: 'FIXING',
  FIXED: 'FIXED',
  RETESTING: 'RETESTING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  APPROVING_BOUNTY: 'APPROVING_BOUNTY',
  BOUNTY_APPROVED: 'BOUNTY_APPROVED',
  BOUNTY_REJECTED: 'BOUNTY_REJECTED',
  PUBLICLY_ACKNOWLEDGED: 'PUBLICLY_ACKNOWLEDGED',
} as const

export type ReportStatus = typeof ReportStatus[keyof typeof ReportStatus]

export const Severity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const

export type Severity = typeof Severity[keyof typeof Severity]

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

export interface DuplicateMatch {
  report: {
    id: string
    title: string
    severity: string
    status: string
    submitter: {
      name: string
    }
  }
  similarity: number
  reason: string
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  matches?: DuplicateMatch[]
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

export function isValidUserRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole)
}

export function isValidReportStatus(status: string): status is ReportStatus {
  return Object.values(ReportStatus).includes(status as ReportStatus)
}

export function isValidSeverity(severity: string): severity is Severity {
  return Object.values(Severity).includes(severity as Severity)
}

export function asUserRole(role: string): UserRole {
  return role as UserRole
}

export function asReportStatus(status: string): ReportStatus {
  return status as ReportStatus
}

export function asSeverity(severity: string): Severity {
  return severity as Severity
}
