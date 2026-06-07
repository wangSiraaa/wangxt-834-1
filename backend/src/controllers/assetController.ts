import { Response } from 'express'
import prisma from '../prisma'
import { AuthRequest } from '../types'
import { z } from 'zod'

const createAssetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  url: z.string().url(),
  assetType: z.string().min(1)
})

export async function createAsset(req: AuthRequest, res: Response) {
  try {
    const result = createAssetSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: '参数校验失败',
        details: result.error.issues
      })
    }

    const asset = await prisma.asset.create({
      data: result.data
    })

    return res.status(201).json({
      success: true,
      data: asset
    })
  } catch (err) {
    console.error('Create asset error:', err)
    return res.status(500).json({
      success: false,
      error: '创建资产失败'
    })
  }
}

export async function getAssetList(req: AuthRequest, res: Response) {
  try {
    const { assetType, isActive } = req.query
    const where: any = {}
    if (assetType) where.assetType = assetType
    if (isActive !== undefined) where.isActive = isActive === 'true'

    const assets = await prisma.asset.findMany({
      where,
      include: {
        _count: {
          select: { reports: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return res.json({
      success: true,
      data: assets
    })
  } catch (err) {
    console.error('Get asset list error:', err)
    return res.status(500).json({
      success: false,
      error: '获取资产列表失败'
    })
  }
}

export async function getAssetDetail(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        reports: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            submitter: { select: { name: true } },
            _count: { select: { comments: true } }
          }
        },
        _count: {
          select: { reports: true }
        }
      }
    })

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: '资产不存在'
      })
    }

    return res.json({
      success: true,
      data: asset
    })
  } catch (err) {
    console.error('Get asset detail error:', err)
    return res.status(500).json({
      success: false,
      error: '获取资产详情失败'
    })
  }
}

export async function updateAsset(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const data = req.body

    const asset = await prisma.asset.update({
      where: { id },
      data
    })

    return res.json({
      success: true,
      data: asset
    })
  } catch (err) {
    console.error('Update asset error:', err)
    return res.status(500).json({
      success: false,
      error: '更新资产失败'
    })
  }
}

export async function toggleAssetActive(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params

    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: '资产不存在'
      })
    }

    const updated = await prisma.asset.update({
      where: { id },
      data: { isActive: !asset.isActive }
    })

    return res.json({
      success: true,
      data: updated
    })
  } catch (err) {
    console.error('Toggle asset active error:', err)
    return res.status(500).json({
      success: false,
      error: '切换资产状态失败'
    })
  }
}
