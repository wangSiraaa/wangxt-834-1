import { Router } from 'express'
import { authenticateToken, requireRoles } from '../middleware/auth'
import {
  createAsset,
  getAssetList,
  getAssetDetail,
  updateAsset,
  toggleAssetActive
} from '../controllers/assetController'
import { UserRole } from '../types'

const router = Router()

router.get('/', authenticateToken, getAssetList)
router.get('/:id', authenticateToken, getAssetDetail)
router.post('/', authenticateToken, requireRoles(UserRole.ADMIN, UserRole.TRIAGER), createAsset)
router.put('/:id', authenticateToken, requireRoles(UserRole.ADMIN, UserRole.TRIAGER), updateAsset)
router.post('/:id/toggle', authenticateToken, requireRoles(UserRole.ADMIN), toggleAssetActive)

export default router
