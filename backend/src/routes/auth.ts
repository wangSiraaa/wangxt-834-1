import { Router } from 'express'
import { authenticateToken, requireRoles } from '../middleware/auth'
import {
  login,
  register,
  getCurrentUser,
  getUserList
} from '../controllers/authController'
import { UserRole } from '@prisma/client'

const router = Router()

router.post('/login', login)
router.post('/register', register)
router.get('/me', authenticateToken, getCurrentUser)
router.get('/users', authenticateToken, requireRoles(UserRole.ADMIN, UserRole.TRIAGER), getUserList)

export default router
