import { Response } from 'express'
import prisma from '../prisma'
import { AuthRequest } from '../types'
import { authenticateByUsername, generateToken } from '../middleware/auth'
import bcrypt from 'bcryptjs'

export async function login(req: AuthRequest, res: Response) {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码不能为空'
      })
    }

    const user = await authenticateByUsername(username, password)
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      })
    }

    const token = generateToken(user)

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({
      success: false,
      error: '登录失败'
    })
  }
}

export async function register(req: AuthRequest, res: Response) {
  try {
    const { username, password, email, name } = req.body

    if (!username || !password || !email || !name) {
      return res.status(400).json({
        success: false,
        error: '所有字段不能为空'
      })
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] }
    })

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: '用户名或邮箱已存在'
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email,
        name,
        role: 'RESEARCHER'
      }
    })

    const token = generateToken(user)

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    })
  } catch (err) {
    console.error('Register error:', err)
    return res.status(500).json({
      success: false,
      error: '注册失败'
    })
  }
}

export async function getCurrentUser(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: '未登录'
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    })

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      })
    }

    return res.json({
      success: true,
      data: user
    })
  } catch (err) {
    console.error('Get current user error:', err)
    return res.status(500).json({
      success: false,
      error: '获取用户信息失败'
    })
  }
}

export async function getUserList(req: AuthRequest, res: Response) {
  try {
    const { role } = req.query
    const where = role ? { role: role as any } : undefined

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return res.json({
      success: true,
      data: users
    })
  } catch (err) {
    console.error('Get user list error:', err)
    return res.status(500).json({
      success: false,
      error: '获取用户列表失败'
    })
  }
}
