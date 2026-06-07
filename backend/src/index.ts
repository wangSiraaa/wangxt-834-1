import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth'
import assetRoutes from './routes/assets'
import reportRoutes from './routes/reports'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/assets', assetRoutes)
app.use('/api/reports', reportRoutes)

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  })
})

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    success: false,
    error: err.message || '服务器内部错误'
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Bug Bounty Platform API server running on http://localhost:${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`)
})

export default app
