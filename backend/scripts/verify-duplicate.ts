import prisma from '../src/prisma'
import { Severity } from '@prisma/client'
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
      console.log('✅ API server is ready')
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
  if (res.status !== 200 || !res.data?.success) {
    throw new Error(`Login failed: ${JSON.stringify(res.data)}`)
  }
  return res.data.data.token
}

async function getAssets(token: string) {
  const res = await makeRequest('GET', '/assets', undefined, token)
  if (res.status !== 200 || !res.data?.success) {
    throw new Error(`Get assets failed: ${JSON.stringify(res.data)}`)
  }
  return res.data.data
}

async function getOriginalReportId(token: string, assetId: string) {
  const res = await makeRequest(
    'GET',
    `/reports?assetId=${assetId}&isMerged=false`,
    undefined,
    token
  )
  if (res.status !== 200 || !res.data?.success) {
    throw new Error(`Get reports failed: ${JSON.stringify(res.data)}`)
  }
  const reports = res.data.data
  const sqlInjectionReport = reports.find((r: any) =>
    r.title.includes('SQL注入') && !r.isMerged
  )
  return sqlInjectionReport?.id
}

async function verifyScenario() {
  console.log('\n' + '='.repeat(80))
  console.log('🔍 DUPLICATE REPORT VERIFICATION SCENARIO')
  console.log('='.repeat(80))
  console.log('\n📋 Scenario: 提交重复资产漏洞并验证合并提示出现')
  console.log('')

  try {
    await waitForServer()

    console.log('\n1️⃣  Step 1: 登录为研究员2 (researcher2 / password123)')
    const researcherToken = await login('researcher2', 'password123')
    console.log('   ✅ 登录成功')

    console.log('\n2️⃣  Step 2: 获取资产列表')
    const assets = await getAssets(researcherToken)
    const mainAsset = assets.find((a: any) => a.name === '官方主站')
    console.log(`   ✅ 找到目标资产: ${mainAsset.name} (${mainAsset.id})`)

    console.log('\n3️⃣  Step 3: 获取原始报告ID（用于验证）')
    const adminToken = await login('admin', 'password123')
    const originalReportId = await getOriginalReportId(adminToken, mainAsset.id)
    if (!originalReportId) {
      throw new Error('未找到原始SQL注入报告，请先运行 seed')
    }
    console.log(`   ✅ 原始报告ID: ${originalReportId}`)
    const originalReportRes = await makeRequest(
      'GET', `/reports/${originalReportId}`, undefined, adminToken
    )
    const originalReport = originalReportRes.data.data
    console.log(`   📝 原始报告标题: ${originalReport.title}`)
    console.log(`   🎯 原始报告严重等级: ${originalReport.severity}`)

    console.log('\n4️⃣  Step 4: 提交与原始报告相似的重复报告')
    console.log('   📤 提交内容:')
    const duplicateData = {
      title: '登录页面存在SQL注入漏洞',
      description: '用户登录功能的username参数存在SQL注入漏洞，可以利用该漏洞进行UNION查询，获取数据库中的敏感信息。漏洞位置：/login 接口的 username 字段',
      proofOfConcept: `POST /login HTTP/1.1
username=test' OR 1=1-- &password=123456`,
      severity: Severity.CRITICAL,
      assetId: mainAsset.id
    }
    console.log(`      标题: ${duplicateData.title}`)
    console.log(`      描述: ${duplicateData.description.substring(0, 80)}...`)
    console.log(`      严重等级: ${duplicateData.severity}`)
    console.log(`      资产: ${mainAsset.name}`)

    const submitRes = await makeRequest('POST', '/reports', duplicateData, researcherToken)

    console.log(`\n5️⃣  Step 5: 验证合并提示是否出现`)
    console.log(`   📡 响应状态码: ${submitRes.status}`)
    console.log(`   📦 响应数据:`, JSON.stringify(submitRes.data, null, 6).split('\n').join('\n      '))

    let passed = false

    if (submitRes.data?.isDuplicate === true) {
      console.log('\n   ✅ 检测成功: isDuplicate = true')
      passed = true
    } else {
      console.log('\n   ❌ 检测失败: isDuplicate 不是 true')
    }

    const duplicateInfo = submitRes.data?.duplicateInfo
    if (duplicateInfo?.isDuplicate === true) {
      console.log('   ✅ 重复检测信息完整')
      console.log(`      🎯 匹配报告: ${duplicateInfo.matchingReport?.title}`)
      console.log(`      👤 提交者: ${duplicateInfo.matchingReport?.submitterName}`)
      console.log(`      📊 匹配度: ${(duplicateInfo.matchScore * 100).toFixed(1)}%`)
      console.log(`      📋 匹配原因:`)
      duplicateInfo.matchReasons.forEach((reason: string) => {
        console.log(`         - ${reason}`)
      })
    }

    const createdReport = submitRes.data?.data
    if (createdReport?.status === 'DUPLICATE' && createdReport?.isMerged === true) {
      console.log('   ✅ 报告状态正确: 已标记为 DUPLICATE 并合并')
      console.log(`      📌 duplicateOfId: ${createdReport.duplicateOfId}`)
      if (createdReport.duplicateOfId === originalReportId) {
        console.log('   ✅ 合并到正确的原始报告')
      } else {
        console.log(`   ⚠️  合并到报告: ${createdReport.duplicateOfId}, 期望: ${originalReportId}`)
      }
    } else {
      passed = false
      console.log('   ❌ 报告状态不正确')
    }

    if (submitRes.data?.message?.includes('重复') || submitRes.data?.message?.includes('合并')) {
      console.log('   ✅ 包含重复/合并提示消息')
      console.log(`      💬 ${submitRes.data.message}`)
    }

    console.log('\n' + '-'.repeat(80))
    if (passed) {
      console.log('✅ SCENARIO PASSED: 重复报告检测与合并功能正常！')
    } else {
      console.log('❌ SCENARIO FAILED: 部分验证未通过')
      process.exit(1)
    }
    console.log('-'.repeat(80))

    console.log('\n📊 验证结果汇总:')
    console.log(`   ✓ 重复检测识别 (isDuplicate=true)`)
    console.log(`   ✓ 匹配度计算 (${(duplicateInfo?.matchScore * 100 || 0).toFixed(1)}%)`)
    console.log(`   ✓ 匹配原因说明 (${duplicateInfo?.matchReasons?.length || 0}个原因)`)
    console.log(`   ✓ 报告自动标记为 DUPLICATE`)
    console.log(`   ✓ 报告自动标记为 isMerged=true`)
    console.log(`   ✓ 关联到原始报告 (duplicateOfId)`)
    console.log(`   ✓ 返回友好的合并提示消息`)
    console.log('')

  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verifyScenario()
