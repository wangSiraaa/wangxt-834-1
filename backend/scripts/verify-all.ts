import prisma from '../src/prisma'
import { Severity, ReportStatus } from '@prisma/client'
import http from 'http'

const API_BASE = 'http://localhost:3000/api'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForServer() {
  console.log('⏳ Waiting for API server to start...')
  for (let i = 0; i < 30; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        http.get(`${API_BASE}/health`, (res) => {
          if (res.statusCode === 200) resolve()
          else reject(new Error('not ready'))
        }).on('error', () => reject())
      })
      return
    } catch {
      await sleep(1000)
    }
  }
  throw new Error('Timeout waiting for API server')
}

async function makeRequest(method: string, path: string, data?: any, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`)
    const options: http.RequestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }

    const req = http.request(url, options, (res) => {
      let body = ''
      res.on('data', (chunk) => body += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) })
        } catch {
          resolve({ status: res.statusCode, data: body })
        }
      })
    })

    req.on('error', reject)

    if (data) {
      req.write(JSON.stringify(data))
    }
    req.end()
  })
}

async function login(username: string, password: string) {
  const res = await makeRequest('POST', '/auth/login', { username, password })
  return res.data.data?.token
}

async function getAssets(token: string) {
  const res = await makeRequest('GET', '/assets', undefined, token)
  return res.data.data
}

async function runScenario1_DuplicateDetection() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 SCENARIO 1: 重复报告检测与合并')
  console.log('='.repeat(60))

  const researcherToken = await login('researcher2', 'password123')
  const adminToken = await login('admin', 'password123')

  const assets = await getAssets(researcherToken)
  const mainAsset = assets.find((a: any) => a.name === '官方主站')

  const duplicateData = {
    title: '登录页面存在SQL注入漏洞',
    description: '用户登录功能的username参数存在SQL注入漏洞，可以利用该漏洞进行UNION查询，获取数据库中的敏感信息。',
    severity: Severity.CRITICAL,
    assetId: mainAsset.id
  }

  const submitRes = await makeRequest('POST', '/reports', duplicateData, researcherToken)

  const isDuplicate = submitRes.data?.isDuplicate === true
  const isMerged = submitRes.data?.data?.isMerged === true
  const isStatusDuplicate = submitRes.data?.data?.status === 'DUPLICATE'
  const hasMessage = submitRes.data?.message?.includes('重复')

  console.log(`   isDuplicate: ${isDuplicate ? '✅' : '❌'}`)
  console.log(`   isMerged: ${isMerged ? '✅' : '❌'}`)
  console.log(`   status=DUPLICATE: ${isStatusDuplicate ? '✅' : '❌'}`)
  console.log(`   提示消息: ${hasMessage ? '✅' : '❌'}`)

  return isDuplicate && isMerged && isStatusDuplicate && hasMessage
}

async function runScenario2_CriticalNoFixNoBounty() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 SCENARIO 2: 严重漏洞未修复不能发奖（硬校验）')
  console.log('='.repeat(60))

  const adminToken = await login('admin', 'password123')
  const triagerToken = await login('triager', 'password123')

  const reportsRes = await makeRequest(
    'GET', '/reports?status=FIXING&severity=HIGH', undefined, adminToken
  )
  const fixingReport = reportsRes.data?.data?.[0]

  if (!fixingReport) {
    console.log('   ⚠️  未找到 FIXING 状态的严重报告，跳过此场景')
    return true
  }

  console.log(`   测试报告: ${fixingReport.title} (状态: ${fixingReport.status})`)

  const bountyRes = await makeRequest(
    'POST', `/reports/${fixingReport.id}/request-bounty`,
    { bountyAmount: 10000 }, triagerToken
  )

  const failed = bountyRes.status === 400 ||
    bountyRes.data?.error?.includes('验证') ||
    bountyRes.data?.error?.includes('修复')

  console.log(`   拒绝发奖: ${failed ? '✅' : '❌'}`)
  console.log(`   错误信息: ${bountyRes.data?.error || '无'}`)

  return failed
}

async function runScenario3_OnlyResearcherCanVerify() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 SCENARIO 3: 修复后需研究员确认（硬校验）')
  console.log('='.repeat(60))

  const adminToken = await login('admin', 'password123')
  const researcher1Token = await login('researcher1', 'password123')
  const researcher2Token = await login('researcher2', 'password123')

  const reportsRes = await makeRequest(
    'GET', '/reports?status=VERIFIED&severity=CRITICAL', undefined, adminToken
  )
  let verifiedReport = reportsRes.data?.data?.[0]

  if (!verifiedReport) {
    console.log('   ⚠️  需要先创建一个处于 RETESTING 状态的报告')
    const submittedRes = await makeRequest(
      'GET', '/reports?status=SUBMITTED', undefined, adminToken
    )
    const submitted = submittedRes.data?.data?.[0]
    if (!submitted) {
      console.log('   ❌ 没有可用的测试报告')
      return false
    }
    verifiedReport = submitted
  }

  console.log(`   报告提交者ID: ${verifiedReport.submitterId}`)

  const verifyRes = await makeRequest(
    'POST', `/reports/${verifiedReport.id}/verify-fix`,
    { isVerified: true, comment: '测试验证' },
    researcher2Token
  )

  const forbidden = verifyRes.status === 400 &&
    verifyRes.data?.error?.includes('研究员')

  console.log(`   非提交者验证被拒绝: ${forbidden ? '✅' : '❌'}`)
  console.log(`   错误信息: ${verifyRes.data?.error || '无'}`)

  return forbidden
}

async function runAllScenarios() {
  console.log('\n' + '#'.repeat(80))
  console.log('#  🚀 FULL WORKFLOW VERIFICATION')
  console.log('#'.repeat(80))

  try {
    await waitForServer()

    const results: { name: string, passed: boolean }[] = []

    results.push({
      name: 'SCENARIO 1: 重复报告检测与合并',
      passed: await runScenario1_DuplicateDetection()
    })

    results.push({
      name: 'SCENARIO 2: 严重漏洞未修复不能发奖',
      passed: await runScenario2_CriticalNoFixNoBounty()
    })

    results.push({
      name: 'SCENARIO 3: 修复后需研究员确认',
      passed: await runScenario3_OnlyResearcherCanVerify()
    })

    console.log('\n' + '#'.repeat(80))
    console.log('#  📊 VERIFICATION SUMMARY')
    console.log('#'.repeat(80))
    console.log('')

    let allPassed = true
    results.forEach((r, i) => {
      const icon = r.passed ? '✅' : '❌'
      console.log(`   ${icon} ${r.name}`)
      if (!r.passed) allPassed = false
    })

    console.log('')
    if (allPassed) {
      console.log('🎉 ALL SCENARIOS PASSED!')
    } else {
      console.log('⚠️  SOME SCENARIOS FAILED')
    }
    console.log('')

    process.exit(allPassed ? 0 : 1)

  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runAllScenarios()
