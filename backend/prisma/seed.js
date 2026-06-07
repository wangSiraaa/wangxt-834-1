import prisma from '../src/prisma';
import bcrypt from 'bcryptjs';
import { UserRole, Severity, ReportStatus } from '@prisma/client';
async function main() {
    console.log('🌱 Seeding database...');
    const passwordHash = await bcrypt.hash('password123', 10);
    await prisma.user.deleteMany({});
    await prisma.asset.deleteMany({});
    await prisma.report.deleteMany({});
    const users = await prisma.user.createMany({
        data: [
            {
                username: 'admin',
                email: 'admin@example.com',
                password: passwordHash,
                name: '系统管理员',
                role: UserRole.ADMIN
            },
            {
                username: 'triager',
                email: 'triager@example.com',
                password: passwordHash,
                name: '漏洞审核员',
                role: UserRole.TRIAGER
            },
            {
                username: 'developer1',
                email: 'dev1@example.com',
                password: passwordHash,
                name: '开发工程师甲',
                role: UserRole.DEVELOPER
            },
            {
                username: 'developer2',
                email: 'dev2@example.com',
                password: passwordHash,
                name: '开发工程师乙',
                role: UserRole.DEVELOPER
            },
            {
                username: 'researcher1',
                email: 'r1@example.com',
                password: passwordHash,
                name: '安全研究员甲',
                role: UserRole.RESEARCHER
            },
            {
                username: 'researcher2',
                email: 'r2@example.com',
                password: passwordHash,
                name: '安全研究员乙',
                role: UserRole.RESEARCHER
            },
            {
                username: 'approver',
                email: 'approver@example.com',
                password: passwordHash,
                name: '奖金审批员',
                role: UserRole.APPROVER
            }
        ]
    });
    console.log(`  ✅ Created ${users.count} users`);
    const createdUsers = await prisma.user.findMany();
    const userMap = new Map(createdUsers.map(u => [u.username, u]));
    const assets = await prisma.asset.createMany({
        data: [
            {
                name: '官方主站',
                description: '公司官方网站 www.example.com',
                url: 'https://www.example.com',
                assetType: 'Web应用'
            },
            {
                name: '用户API服务',
                description: '用户相关的 REST API 接口服务',
                url: 'https://api.example.com/users',
                assetType: 'API服务'
            },
            {
                name: '支付网关',
                description: '在线支付处理系统',
                url: 'https://pay.example.com',
                assetType: '核心系统'
            },
            {
                name: '后台管理系统',
                description: '内部运营管理后台',
                url: 'https://admin.example.com',
                assetType: 'Web应用'
            },
            {
                name: '移动APP后端',
                description: '移动端应用的后端服务',
                url: 'https://mobile.example.com',
                assetType: 'API服务'
            }
        ]
    });
    console.log(`  ✅ Created ${assets.count} assets`);
    const createdAssets = await prisma.asset.findMany();
    const assetMap = new Map(createdAssets.map(a => [a.name, a]));
    const researcher1 = userMap.get('researcher1');
    const researcher2 = userMap.get('researcher2');
    const admin = userMap.get('admin');
    const triager = userMap.get('triager');
    const developer1 = userMap.get('developer1');
    const mainAsset = assetMap.get('官方主站');
    const apiAsset = assetMap.get('用户API服务');
    const originalReport = await prisma.report.create({
        data: {
            title: '用户登录页面存在SQL注入漏洞',
            description: '在用户登录页面的username参数处存在SQL注入漏洞，可以通过UNION查询获取数据库敏感信息。漏洞参数：username，payload示例：\' OR 1=1--',
            proofOfConcept: 'POST /login HTTP/1.1\\nusername=admin\' UNION SELECT 1,version(),database()--&password=test',
            severity: Severity.CRITICAL,
            assetId: mainAsset.id,
            submitterId: researcher1.id,
            status: ReportStatus.VERIFIED,
            assigneeId: developer1.id
        },
        include: { submitter: true, asset: true }
    });
    console.log(`  ✅ Created original report: ${originalReport.title}`);
    await prisma.statusHistory.createMany({
        data: [
            {
                reportId: originalReport.id,
                toStatus: ReportStatus.SUBMITTED,
                changedById: researcher1.id,
                note: '初始提交'
            },
            {
                reportId: originalReport.id,
                fromStatus: ReportStatus.SUBMITTED,
                toStatus: ReportStatus.ASSIGNED,
                changedById: triager.id,
                note: '分派给开发工程师甲'
            },
            {
                reportId: originalReport.id,
                fromStatus: ReportStatus.ASSIGNED,
                toStatus: ReportStatus.FIXING,
                changedById: developer1.id
            },
            {
                reportId: originalReport.id,
                fromStatus: ReportStatus.FIXING,
                toStatus: ReportStatus.FIXED,
                changedById: developer1.id,
                note: '已修复参数化查询'
            },
            {
                reportId: originalReport.id,
                fromStatus: ReportStatus.FIXED,
                toStatus: ReportStatus.RETESTING,
                changedById: triager.id,
                note: '请求研究员复测'
            },
            {
                reportId: originalReport.id,
                fromStatus: ReportStatus.RETESTING,
                toStatus: ReportStatus.VERIFIED,
                changedById: researcher1.id,
                note: '复测通过，漏洞已修复'
            }
        ]
    });
    await prisma.retestRecord.create({
        data: {
            reportId: originalReport.id,
            researcherId: researcher1.id,
            isVerified: true,
            comment: '漏洞已修复，不再存在SQL注入',
            verifiedAt: new Date()
        }
    });
    const verifiedReport = await prisma.report.create({
        data: {
            title: 'API接口存在越权访问漏洞',
            description: '在用户信息查询接口 /api/users/{id} 处存在越权访问漏洞，普通用户可以通过修改ID参数访问其他用户的敏感信息。',
            proofOfConcept: 'GET /api/users/1  Authorization: Bearer user2_token',
            severity: Severity.HIGH,
            assetId: apiAsset.id,
            submitterId: researcher2.id,
            status: ReportStatus.VERIFIED,
            assigneeId: developer1.id
        }
    });
    await prisma.retestRecord.create({
        data: {
            reportId: verifiedReport.id,
            researcherId: researcher2.id,
            isVerified: true,
            comment: '已验证修复',
            verifiedAt: new Date()
        }
    });
    const fixingReport = await prisma.report.create({
        data: {
            title: '后台管理系统存在存储型XSS漏洞',
            description: '在后台用户管理模块，用户名字段存在存储型XSS漏洞。攻击者可以在用户名中注入恶意脚本，当管理员查看用户列表时触发。',
            proofOfConcept: '注册用户名为 <script>alert(document.cookie)</script> 的账户',
            severity: Severity.HIGH,
            assetId: assetMap.get('后台管理系统').id,
            submitterId: researcher1.id,
            status: ReportStatus.FIXING,
            assigneeId: developer1.id
        }
    });
    const submittedReport = await prisma.report.create({
        data: {
            title: '支付回调接口存在未授权访问',
            description: '支付结果回调接口未进行签名验证，攻击者可以伪造支付成功的回调请求，导致订单状态异常更新。',
            proofOfConcept: 'POST /pay/callback  amount=9999&orderId=123&status=success',
            severity: Severity.CRITICAL,
            assetId: assetMap.get('支付网关').id,
            submitterId: researcher2.id,
            status: ReportStatus.SUBMITTED
        }
    });
    console.log(`  ✅ Created ${4} sample reports with various statuses`);
    console.log('\n📋 Seed Data Summary:');
    console.log('  👤 Users:');
    console.log('     - admin / password123    (系统管理员)');
    console.log('     - triager / password123  (漏洞审核员)');
    console.log('     - developer1 / password123 (开发工程师甲)');
    console.log('     - developer2 / password123 (开发工程师乙)');
    console.log('     - researcher1 / password123 (安全研究员甲)');
    console.log('     - researcher2 / password123 (安全研究员乙)');
    console.log('     - approver / password123 (奖金审批员)');
    console.log('  🏢 Assets: 5');
    console.log('  📄 Reports: 4 (1 original for duplicate testing)');
    console.log('\n✅ Seeding completed successfully!');
}
main()
    .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
