# 🐛 漏洞赏金报告处理平台

一个完整的漏洞赏金（Bug Bounty）报告处理全栈 Web 应用，覆盖漏洞报告从提交到公开致谢的完整生命周期。

## ✨ 功能特性

### 核心业务流程
1. **报告提交** - 安全研究员提交漏洞报告
2. **重复检测** - 自动检测是否存在重复报告并合并
3. **分派修复** - 审核员分派给开发人员修复
4. **复测确认** - 修复后由研究员确认
5. **奖金审批** - 审批通过后发放奖金
6. **公开致谢** - 向安全研究员公开致谢

### 页面功能
- 📊 **仪表板** - 统计概览和最近报告
- 📋 **报告列表** - 支持按状态、严重等级筛选，显示重复合并状态
- 📝 **报告详情** - 完整信息展示、状态时间轴、操作按钮、评论
- ➕ **提交漏洞** - 表单提交，含实时重复检测提示
- 🏆 **公开致谢** - 展示获得奖金的研究员排名

## 🔒 三个硬校验规则

所有校验在后端 Service 层实现，无法绕过：

### 1. 重复报告自动合并
- 基于多维度相似度算法（标题相似度、描述相似度、关键词匹配、严重等级匹配）
- 综合得分 ≥ 0.5 自动判定为重复
- 重复报告会被标记 `isMerged=true`，状态设为 `DUPLICATE`
- 关联到最早提交的原始报告 `duplicateOfId`

### 2. 严重/高危漏洞未修复不能发奖
- 严重（HIGH）和高危（CRITICAL）漏洞必须先修复
- 必须有研究员复测确认记录（`RetestRecord.isVerified=true`）
- 状态必须流转到 `VERIFIED` 才能申请和批准奖金

### 3. 修复后需研究员确认
- 修复结果只能由**最初提交报告的研究员**确认
- 系统校验 `report.submitterId === researcherId`
- 其他角色（包括管理员）无法替研究员确认

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 18 + TypeScript + Vite + React Router + Axios |
| **后端** | Node.js + Express + TypeScript + Zod |
| **数据库** | SQLite + Prisma ORM |
| **认证** | JWT Token + BCrypt 密码加密 |
| **权限** | 基于角色的访问控制（RBAC） |
| **架构** | Monorepo + npm workspaces |

## 👥 用户角色

| 角色 | 权限 |
|------|------|
| **RESEARCHER** 安全研究员 | 提交漏洞、确认修复结果 |
| **TRIAGER** 漏洞审核员 | 审核报告、标记重复、分派给开发、申请复测、申请奖金 |
| **DEVELOPER** 开发工程师 | 开始修复、标记已修复 |
| **APPROVER** 奖金审批员 | 审批奖金发放 |
| **ADMIN** 系统管理员 | 所有权限，包括公开致谢 |

## 📊 状态流转

```
SUBMITTED (已提交)
    ↓
TRIAGING (审核中) → REJECTED (已拒绝)
    ↓
ASSIGNED (已分派)
    ↓
FIXING (修复中)
    ↓
FIXED (已修复)
    ↓
RETESTING (复测中) → FIXING (修复未通过)
    ↓
VERIFIED (已验证)
    ↓
APPROVING_BOUNTY (奖金审批中) → BOUNTY_REJECTED (奖金已拒绝)
    ↓
BOUNTY_APPROVED (奖金已批准)
    ↓
PUBLICLY_ACKNOWLEDGED (已公开致谢)

DUPLICATE (重复报告) - 重复报告的最终状态
```

## 🚀 快速开始

### 前置要求
- Node.js >= 18
- npm >= 9

### 安装依赖
```bash
npm install
```

### 初始化数据库
```bash
npm run prisma:setup
```

### 导入种子数据
```bash
npm run seed
```

### 启动开发服务
```bash
# 同时启动前后端
npm run dev

# 仅启动后端
npm run dev:backend

# 仅启动前端
npm run dev:frontend
```

- 前端地址: http://localhost:5173
- 后端地址: http://localhost:3000
- 健康检查: http://localhost:3000/api/health

## 🔑 测试账号

所有测试账号密码均为：`password123`

| 用户名 | 角色 |
|--------|------|
| `admin` | 系统管理员 |
| `triager` | 漏洞审核员 |
| `developer1` | 开发工程师甲 |
| `developer2` | 开发工程师乙 |
| `researcher1` | 安全研究员甲 |
| `researcher2` | 安全研究员乙 |
| `approver` | 奖金审批员 |

## ✅ 一键验证

### 场景1：提交重复资产漏洞并验证合并提示出现
**可重复执行** - 每次运行 seed 会重置数据库到初始状态

```bash
# 1. 重置数据库和种子数据
npm run seed

# 2. 启动后端服务（新终端）
npm run dev:backend

# 3. 运行验证脚本（另开新终端）
npm run verify:duplicate
```

**验证脚本执行步骤：**
1. 以研究员身份登录
2. 获取资产列表
3. 确认数据库中已有"用户登录SQL注入漏洞"的原始报告
4. 提交一个内容相似的重复报告（标题含"SQL注入"，严重等级CRITICAL）
5. 验证：
   - ✅ `isDuplicate=true` 检测到重复
   - ✅ 匹配度计算正确
   - ✅ 匹配原因说明正确
   - ✅ `status=DUPLICATE` 状态正确
   - ✅ `isMerged=true` 已标记合并
   - ✅ `duplicateOfId` 正确关联到原始报告
   - ✅ 提示消息包含"硬校验"和"自动合并"

### 场景2：验证所有三个硬校验
```bash
# 1. 重置数据库和种子数据
npm run seed

# 2. 启动后端服务
npm run dev:backend

# 3. 运行完整验证
npm run verify:all
```

**验证内容：**
1. ✅ 重复报告自动合并
2. ✅ 严重/高危漏洞未修复不能发奖
3. ✅ 修复后必须由研究员确认

## 🔌 API 接口概览

### 认证接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/register` | 注册 |
| GET | `/api/auth/me` | 获取当前用户 |
| GET | `/api/auth/users` | 获取用户列表（管理员/审核员） |

### 报告接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/reports/check-duplicate` | 提交前重复检测 |
| POST | `/api/reports` | 提交漏洞报告 |
| GET | `/api/reports` | 获取报告列表 |
| GET | `/api/reports/:id` | 获取报告详情 |
| POST | `/api/reports/:id/mark-duplicate` | 标记为重复 |
| POST | `/api/reports/:id/assign` | 分派给开发 |
| POST | `/api/reports/:id/start-fixing` | 开始修复 |
| POST | `/api/reports/:id/mark-fixed` | 标记已修复 |
| POST | `/api/reports/:id/request-retest` | 申请复测 |
| POST | `/api/reports/:id/verify-fix` | 确认修复（研究员） |
| POST | `/api/reports/:id/request-bounty` | 申请奖金审批 |
| POST | `/api/reports/:id/approve-bounty` | 批准奖金 |
| POST | `/api/reports/:id/acknowledge` | 公开致谢 |
| POST | `/api/reports/:id/reject` | 拒绝报告 |
| POST | `/api/reports/:id/comments` | 添加评论 |
| GET | `/api/reports/acknowledged` | 获取公开致谢名单 |

### 资产接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/assets` | 获取资产列表 |
| GET | `/api/assets/:id` | 获取资产详情 |
| POST | `/api/assets` | 新增资产 |

## 📁 项目结构

```
.
├── backend/                    # 后端应用
│   ├── prisma/
│   │   ├── schema.prisma      # 数据模型
│   │   └── seed.ts            # 种子数据
│   ├── scripts/
│   │   ├── verify-duplicate.ts # 重复检测验证脚本
│   │   └── verify-all.ts      # 全场景验证脚本
│   └── src/
│       ├── controllers/       # 控制器层
│       ├── middleware/        # 中间件（认证、权限）
│       ├── routes/            # 路由定义
│       ├── services/          # 业务逻辑层
│       │   ├── ReportService.ts
│       │   └── DuplicateDetectionService.ts
│       ├── types/             # 类型定义
│       └── index.ts           # 应用入口
├── frontend/                   # 前端应用
│   └── src/
│       ├── context/           # React Context（认证）
│       ├── pages/             # 页面组件
│       │   ├── LoginPage.tsx
│       │   ├── Dashboard.tsx
│       │   ├── ReportsList.tsx
│       │   ├── ReportDetail.tsx
│       │   ├── SubmitReport.tsx
│       │   └── Acknowledgments.tsx
│       ├── utils/             # 工具函数
│       ├── App.tsx
│       └── main.tsx
└── package.json               # Monorepo 配置
```

## 🧮 重复检测算法

### 匹配因素与权重
| 因素 | 权重 | 说明 |
|------|------|------|
| 严重等级相同 | +0.2 | 必须同一等级才算匹配 |
| 标题相似度 | ×0.4 | Jaccard 相似度，≥0.5 计分 |
| 描述相似度 | ×0.3 | Jaccard 相似度，≥0.3 计分 |
| 关键词匹配 | +0.1/个 | 最多 +0.3，含 20+ 漏洞关键词 |

### 判定规则
- 综合得分 ≥ 0.5 → 判定为重复
- 自动合并到最早提交的原始报告
- 关键词库包含：sql注入、xss、越权、未授权访问、命令执行等中英文漏洞术语

## 📝 主流程操作示例

### 完整流程操作
1. **研究员甲** 提交"用户登录SQL注入漏洞" → 状态 SUBMITTED
2. **审核员** 分派给"开发工程师甲" → 状态 ASSIGNED
3. **开发工程师甲** 开始修复 → 状态 FIXING
4. **开发工程师甲** 标记已修复 → 状态 FIXED
5. **审核员** 申请复测 → 状态 RETESTING
6. **研究员甲** 确认修复有效 → 状态 VERIFIED
7. **审核员** 申请奖金审批 → 状态 APPROVING_BOUNTY
8. **审批员** 批准奖金 ¥5000 → 状态 BOUNTY_APPROVED
9. **管理员** 公开致谢 → 状态 PUBLICLY_ACKNOWLEDGED

### 重复报告流程
1. **研究员乙** 提交"登录接口存在SQL注入"（与研究员甲的报告相似）
2. 系统自动检测到重复，匹配度 78%
3. 硬校验触发：自动合并到研究员甲的原始报告
4. 研究员乙的报告状态设为 DUPLICATE，isMerged=true
5. 奖金仅发放给原始报告提交者（研究员甲）

## 🔧 构建生产版本

```bash
npm run build
```

## 📄 许可证

MIT License
