import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { UserRole } from '@prisma/client'
import { JwtPayload, AuthRequest } from '../types'
import prisma from '../prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key'

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ success: false, error: '未提供认证令牌' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
    req.user = decoded
    next()
  } catch (err) {
    return res.status(403).json({ success: false, error: '认证令牌无效或已过期' })
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未登录' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: `需要以下角色之一: ${roles.join(', ')}，当前角色: ${req.user.role}` 
      })
    }
    next()
  }
}

export async function authenticateByUsername(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) return null

  const bcrypt = await import('bcryptjs')
  const isValid = await bcrypt.compare(password, user.password)
  if (!isValid) return null

  return user
}

export function generateToken(user: { id: string; username: string; role: UserRole }) {
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  )
}
