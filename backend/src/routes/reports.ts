import { Router } from 'express'
import { authenticateToken, requireRoles } from '../middleware/auth'
import {
  createReport,
  checkDuplicate,
  preCheckDuplicate,
  markAsDuplicate,
  assignToDeveloper,
  startFixing,
  markAsFixed,
  requestRetest,
  verifyFix,
  requestBountyApproval,
  approveBounty,
  acknowledgePublicly,
  rejectReport,
  getReportList,
  getMyReports,
  getAssignedReports,
  getReportDetail,
  addComment,
  getAcknowledgedResearchers
} from '../controllers/reportController'
import { UserRole } from '../types'

const router = Router()

router.get('/acknowledged', getAcknowledgedResearchers)
router.get('/my', authenticateToken, getMyReports)
router.get('/assigned', authenticateToken, getAssignedReports)
router.get('/', authenticateToken, getReportList)
router.get('/:id', authenticateToken, getReportDetail)

router.post('/check-duplicate', authenticateToken, preCheckDuplicate)
router.post('/', authenticateToken, requireRoles(UserRole.RESEARCHER, UserRole.ADMIN), createReport)

router.post('/:id/check-duplicate', authenticateToken, checkDuplicate)
router.post('/:id/mark-duplicate', authenticateToken, requireRoles(UserRole.TRIAGER, UserRole.ADMIN), markAsDuplicate)
router.post('/:id/assign', authenticateToken, requireRoles(UserRole.TRIAGER, UserRole.ADMIN), assignToDeveloper)
router.post('/:id/start-fixing', authenticateToken, requireRoles(UserRole.DEVELOPER, UserRole.ADMIN), startFixing)
router.post('/:id/mark-fixed', authenticateToken, requireRoles(UserRole.DEVELOPER, UserRole.ADMIN), markAsFixed)
router.post('/:id/request-retest', authenticateToken, requireRoles(UserRole.TRIAGER, UserRole.DEVELOPER, UserRole.ADMIN), requestRetest)
router.post('/:id/verify-fix', authenticateToken, requireRoles(UserRole.RESEARCHER, UserRole.ADMIN), verifyFix)
router.post('/:id/request-bounty', authenticateToken, requireRoles(UserRole.TRIAGER, UserRole.ADMIN), requestBountyApproval)
router.post('/:id/approve-bounty', authenticateToken, requireRoles(UserRole.APPROVER, UserRole.ADMIN), approveBounty)
router.post('/:id/acknowledge', authenticateToken, requireRoles(UserRole.ADMIN), acknowledgePublicly)
router.post('/:id/reject', authenticateToken, requireRoles(UserRole.TRIAGER, UserRole.ADMIN), rejectReport)

router.post('/:id/comments', authenticateToken, addComment)

export default router
