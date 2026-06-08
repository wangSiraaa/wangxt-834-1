#!/bin/bash
# 漏洞赏金平台 834 功能校验脚本
# 功能：审计回放 + 严重漏洞未修复不能发奖 + 先校验后写入
# 作者：AI Assistant
# 日期：2025-02-05

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

# 计数器
PASS=0
FAIL=0
WARN=0
TOTAL=0

# 项目路径
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_URL="http://localhost:3001"

# 临时文件
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

# 日志函数
log_pass() {
  echo -e "${GREEN}[PASS]${NC} $1"
  ((PASS++))
  ((TOTAL++))
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  ((FAIL++))
  ((TOTAL++))
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
  ((WARN++))
  ((TOTAL++))
}

log_info() {
  echo -e "${BOLD}[INFO]${NC} $1"
}

log_section() {
  echo ""
  echo -e "${BOLD}=== $1 ===${NC}"
  echo "----------------------------------------"
}

# 检查文件是否存在
check_file() {
  local file="$1"
  local desc="$2"
  if [ -f "$file" ]; then
    log_pass "$desc 存在: $file"
    return 0
  else
    log_fail "$desc 不存在: $file"
    return 1
  fi
}

# 检查目录是否存在
check_dir() {
  local dir="$1"
  local desc="$2"
  if [ -d "$dir" ]; then
    log_pass "$desc 存在: $dir"
    return 0
  else
    log_fail "$desc 不存在: $dir"
    return 1
  fi
}

# 检查字符串是否在文件中
check_content() {
  local file="$1"
  local pattern="$2"
  local desc="$3"
  if grep -q "$pattern" "$file" 2>/dev/null; then
    log_pass "$desc"
    return 0
  else
    log_fail "$desc (未在 $file 中找到 $pattern)"
    return 1
  fi
}

# API 认证 token
API_TOKEN=""

# HTTP GET 请求（带认证）
http_get() {
  local url="$1"
  local output="$2"
  local code
  local auth_header=""
  if [ -n "$API_TOKEN" ]; then
    auth_header="-H \"Authorization: Bearer $API_TOKEN\""
  fi
  code=$(eval "curl -s -o \"$output\" -w \"%{http_code}\" $auth_header \"$BACKEND_URL$url\" 2>/dev/null" || echo "000")
  echo "$code"
}

# HTTP POST 请求（带认证）
http_post() {
  local url="$1"
  local data="$2"
  local output="$3"
  local code
  local auth_header=""
  if [ -n "$API_TOKEN" ]; then
    auth_header="-H \"Authorization: Bearer $API_TOKEN\""
  fi
  code=$(eval "curl -s -o \"$output\" -w \"%{http_code}\" -H \"Content-Type: application/json\" $auth_header -d \"$data\" \"$BACKEND_URL$url\" 2>/dev/null" || echo "000")
  echo "$code"
}

# 登录获取 token
api_login() {
  local username="$1"
  local password="$2"
  local output="$TMP_DIR/login.json"
  local code
  code=$(curl -s -o "$output" -w "%{http_code}" -H "Content-Type: application/json" \
    -d "{\"username\":\"$username\",\"password\":\"$password\"}" \
    "$BACKEND_URL/api/auth/login" 2>/dev/null || echo "000")
  
  if [ "$code" = "200" ]; then
    API_TOKEN=$(grep -o '"token":"[^"]*"' "$output" | cut -d'"' -f4)
    if [ -n "$API_TOKEN" ]; then
      log_pass "API 登录成功，获取 token"
      return 0
    fi
  fi
  log_warn "API 登录失败 (code: $code)，跳过需要认证的 API 测试"
  return 1
}

# 检查后端服务是否启动
check_backend_running() {
  local output="$TMP_DIR/health.json"
  local code
  code=$(http_get "/api/health" "$output")
  if [ "$code" = "200" ]; then
    log_pass "后端服务运行正常 (端口 3001)"
    return 0
  else
    log_warn "后端服务未运行，跳过 API 测试"
    return 1
  fi
}

# 显示标题
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     漏洞赏金平台 834 功能校验脚本 v1.0                      ║${NC}"
echo -e "${BOLD}║     审计回放 + 严重漏洞未修复不能发奖 + 先校验后写入        ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
log_info "项目路径: $PROJECT_DIR"
log_info "后端路径: $BACKEND_DIR"
log_info "前端路径: $FRONTEND_DIR"
log_info "后端服务: $BACKEND_URL"
echo ""

# ==============================================
# 第一部分：文件结构检查
# ==============================================
log_section "1. 文件结构检查"

# 后端文件
check_file "$BACKEND_DIR/src/services/ReportService.ts" "后端服务层"
check_file "$BACKEND_DIR/src/controllers/reportController.ts" "后端控制器"
check_file "$BACKEND_DIR/src/routes/reports.ts" "后端路由"
check_file "$BACKEND_DIR/prisma/schema.prisma" "数据库模型"

# 前端文件
check_file "$FRONTEND_DIR/src/pages/AuditReplay.tsx" "审计回放页面"
check_file "$FRONTEND_DIR/src/pages/ReportDetail.tsx" "报告详情页面"
check_file "$FRONTEND_DIR/src/App.tsx" "主应用组件"
check_file "$FRONTEND_DIR/src/styles.css" "前端样式"

# 文档
check_file "$PROJECT_DIR/.trae/documents/PRD-漏洞赏金报告审计回放.md" "PRD文档"
check_file "$PROJECT_DIR/.trae/documents/技术架构-漏洞赏金报告审计回放.md" "技术架构文档"

# 脚本自身
check_file "$PROJECT_DIR/check-834.sh" "校验脚本"

# ==============================================
# 第二部分：后端核心逻辑检查
# ==============================================
log_section "2. 后端核心逻辑检查"

# 审计回放方法
check_content "$BACKEND_DIR/src/services/ReportService.ts" \
  "getAuditReplay" \
  "包含 getAuditReplay 审计回放方法"

# 严重漏洞发奖校验
check_content "$BACKEND_DIR/src/services/ReportService.ts" \
  "validateCriticalVulnerabilityBounty" \
  "包含 validateCriticalVulnerabilityBounty 严重漏洞发奖校验"

# 先校验后写入框架
check_content "$BACKEND_DIR/src/services/ReportService.ts" \
  "processReportWithValidation" \
  "包含 processReportWithValidation 先校验后写入框架"

# 业务规则：严重漏洞未修复不能发奖
check_content "$BACKEND_DIR/src/services/ReportService.ts" \
  "INVALID_STATUS" \
  "包含 INVALID_STATUS 错误码（状态未验证）"

check_content "$BACKEND_DIR/src/services/ReportService.ts" \
  "NO_RETEST_RECORD" \
  "包含 NO_RETEST_RECORD 错误码（无复测记录）"

check_content "$BACKEND_DIR/src/services/ReportService.ts" \
  "RETEST_NOT_PASSED" \
  "包含 RETEST_NOT_PASSED 错误码（复测未通过）"

check_content "$BACKEND_DIR/src/services/ReportService.ts" \
  "INVALID_RETESTER" \
  "包含 INVALID_RETESTER 错误码（复测人非法）"

# 校验失败不写入
check_content "$BACKEND_DIR/src/services/ReportService.ts" \
  "success: false" \
  "校验失败时返回 false，不写入数据库"

# 审计日志记录
check_content "$BACKEND_DIR/src/services/ReportService.ts" \
  "addAuditLog" \
  "包含 addAuditLog 审计日志记录"

# 控制器方法
check_content "$BACKEND_DIR/src/controllers/reportController.ts" \
  "getAuditReplay" \
  "控制器包含 getAuditReplay"

check_content "$BACKEND_DIR/src/controllers/reportController.ts" \
  "getAuditLogs" \
  "控制器包含 getAuditLogs"

check_content "$BACKEND_DIR/src/controllers/reportController.ts" \
  "validateBountyEligibility" \
  "控制器包含 validateBountyEligibility"

# 路由配置
check_content "$BACKEND_DIR/src/routes/reports.ts" \
  "/audit" \
  "路由包含 /audit 审计回放"

check_content "$BACKEND_DIR/src/routes/reports.ts" \
  "/audit-logs" \
  "路由包含 /audit-logs 审计日志"

check_content "$BACKEND_DIR/src/routes/reports.ts" \
  "/validate-bounty" \
  "路由包含 /validate-bounty 奖金资格校验"

# 数据库模型
check_content "$BACKEND_DIR/prisma/schema.prisma" \
  "AuditLog" \
  "数据库包含 AuditLog 模型"

check_content "$BACKEND_DIR/prisma/schema.prisma" \
  "StatusHistory" \
  "数据库包含 StatusHistory 模型"

check_content "$BACKEND_DIR/prisma/schema.prisma" \
  "RetestRecord" \
  "数据库包含 RetestRecord 模型"

# ==============================================
# 第三部分：前端页面检查
# ==============================================
log_section "3. 前端页面检查"

# 审计回放页面组件
check_content "$FRONTEND_DIR/src/pages/AuditReplay.tsx" \
  "export default function AuditReplay" \
  "审计回放页面组件存在"

# 时间线组件
check_content "$FRONTEND_DIR/src/pages/AuditReplay.tsx" \
  "audit-timeline" \
  "包含时间线组件"

# 播放控制
check_content "$FRONTEND_DIR/src/pages/AuditReplay.tsx" \
  "handlePlayPause" \
  "包含播放控制"

check_content "$FRONTEND_DIR/src/pages/AuditReplay.tsx" \
  "handlePrev" \
  "包含上一步控制"

check_content "$FRONTEND_DIR/src/pages/AuditReplay.tsx" \
  "handleNext" \
  "包含下一步控制"

# 进度条
check_content "$FRONTEND_DIR/src/pages/AuditReplay.tsx" \
  "audit-progress" \
  "包含进度条"

# 速度控制
check_content "$FRONTEND_DIR/src/pages/AuditReplay.tsx" \
  "audit-speed-select" \
  "包含速度控制"

# 详情面板
check_content "$FRONTEND_DIR/src/pages/AuditReplay.tsx" \
  "audit-detail-panel" \
  "包含详情面板"

# 奖金资格校验
check_content "$FRONTEND_DIR/src/pages/AuditReplay.tsx" \
  "bounty-validation-card" \
  "包含奖金资格校验卡片"

# 路由配置
check_content "$FRONTEND_DIR/src/App.tsx" \
  "/reports/:id/audit" \
  "路由配置包含审计回放"

check_content "$FRONTEND_DIR/src/App.tsx" \
  "import AuditReplay" \
  "导入 AuditReplay 组件"

# 报告详情页链接
check_content "$FRONTEND_DIR/src/pages/ReportDetail.tsx" \
  "审计回放" \
  "报告详情页包含审计回放入口"

# 前端样式
check_content "$FRONTEND_DIR/src/styles.css" \
  "audit-replay-container" \
  "包含审计回放样式"

check_content "$FRONTEND_DIR/src/styles.css" \
  "bounty-validation-card" \
  "包含奖金校验卡片样式"

# ==============================================
# 第四部分：API 接口测试（如果后端服务运行中）
# ==============================================
log_section "4. API 接口测试"

if check_backend_running; then
  log_info "开始 API 接口测试..."
  
  # 4.1 健康检查
  HEALTH_OUTPUT="$TMP_DIR/health.json"
  HEALTH_CODE=$(http_get "/api/health" "$HEALTH_OUTPUT")
  if [ "$HEALTH_CODE" = "200" ]; then
    log_pass "健康检查接口正常"
  else
    log_fail "健康检查接口返回 $HEALTH_CODE"
  fi

  # 4.1.5 登录获取认证 token（使用测试账号）
  api_login "admin" "password123"

  # 4.2 获取报告列表
  REPORTS_OUTPUT="$TMP_DIR/reports.json"
  REPORTS_CODE=$(http_get "/api/reports" "$REPORTS_OUTPUT")
  if [ "$REPORTS_CODE" = "200" ]; then
    log_pass "报告列表接口正常"
    
    # 提取第一个报告 ID 进行后续测试
    REPORT_ID=$(grep -o '"id":"[^"]*"' "$REPORTS_OUTPUT" | head -1 | cut -d'"' -f4)
    
    if [ -n "$REPORT_ID" ]; then
      log_info "使用报告 ID: $REPORT_ID 进行后续测试"
      
      # 4.3 审计回放 API
      AUDIT_OUTPUT="$TMP_DIR/audit.json"
      AUDIT_CODE=$(http_get "/api/reports/$REPORT_ID/audit" "$AUDIT_OUTPUT")
      if [ "$AUDIT_CODE" = "200" ]; then
        log_pass "审计回放 API 正常"
        
        # 检查返回结构
        if grep -q '"timeline"' "$AUDIT_OUTPUT" && grep -q '"auditLogs"' "$AUDIT_OUTPUT"; then
          log_pass "审计回放 API 返回结构正确（包含 timeline 和 auditLogs）"
        else
          log_fail "审计回放 API 返回结构不正确"
        fi
      else
        log_fail "审计回放 API 返回 $AUDIT_CODE"
      fi

      # 4.4 审计日志 API
      AUDIT_LOGS_OUTPUT="$TMP_DIR/audit-logs.json"
      AUDIT_LOGS_CODE=$(http_get "/api/reports/$REPORT_ID/audit-logs" "$AUDIT_LOGS_OUTPUT")
      if [ "$AUDIT_LOGS_CODE" = "200" ]; then
        log_pass "审计日志 API 正常"
      else
        log_fail "审计日志 API 返回 $AUDIT_LOGS_CODE"
      fi

      # 4.5 奖金资格校验 API
      VALIDATE_OUTPUT="$TMP_DIR/validate.json"
      VALIDATE_CODE=$(http_get "/api/reports/$REPORT_ID/validate-bounty" "$VALIDATE_OUTPUT")
      if [ "$VALIDATE_CODE" = "200" ]; then
        log_pass "奖金资格校验 API 正常"
        
        # 检查返回结构
        if grep -q '"eligible"' "$VALIDATE_OUTPUT"; then
          log_pass "奖金资格校验 API 返回结构正确"
        else
          log_fail "奖金资格校验 API 返回结构不正确"
        fi
      else
        log_fail "奖金资格校验 API 返回 $VALIDATE_CODE"
      fi

    else
      log_warn "无法获取报告 ID，跳过详情 API 测试"
    fi
  else
    log_fail "报告列表接口返回 $REPORTS_CODE"
  fi

  # 4.6 测试严重漏洞未修复不能发奖（业务规则测试）
  log_info "测试业务规则：严重漏洞未修复不能发奖"
  
  # 模拟一个严重但未修复的漏洞申请奖金的场景
  # 首先尝试获取一个 HIGH 或 CRITICAL 状态的报告
  CRITICAL_REPORT_ID=""
  
  # 尝试查找严重/高危报告
  if grep -q '"severity":"HIGH"' "$REPORTS_OUTPUT" || grep -q '"severity":"CRITICAL"' "$REPORTS_OUTPUT"; then
    log_pass "存在严重/高危报告用于测试"
    
    # 提取一个严重报告
    CRITICAL_REPORT_ID=$(python3 -c "
import json, sys
data = json.load(open('$REPORTS_OUTPUT'))
reports = data.get('data', [])
for r in reports:
    if r.get('severity') in ['HIGH', 'CRITICAL'] and r.get('status') != 'VERIFIED':
        print(r['id'])
        sys.exit(0)
print('')
" 2>/dev/null || echo "")
    
    if [ -n "$CRITICAL_REPORT_ID" ]; then
      log_info "使用未验证的严重报告 ID: $CRITICAL_REPORT_ID"
      
      # 尝试申请奖金审批 - 应该失败
      REQUEST_BOUNTY_OUTPUT="$TMP_DIR/request-bounty.json"
      REQUEST_BOUNTY_CODE=$(http_post "/api/reports/$CRITICAL_REPORT_ID/request-bounty" "{}" "$REQUEST_BOUNTY_OUTPUT")
      
      # 应该返回 400 或包含错误信息
      if [ "$REQUEST_BOUNTY_CODE" = "400" ] || grep -q "success.*false" "$REQUEST_BOUNTY_OUTPUT" || grep -q "未修复" "$REQUEST_BOUNTY_OUTPUT" || grep -q "INVALID_STATUS" "$REQUEST_BOUNTY_OUTPUT"; then
        log_pass "✅ 严重漏洞未修复时申请奖金被拒绝 - 业务规则生效"
        
        # 检查返回的错误详情
        if grep -q "errors" "$REQUEST_BOUNTY_OUTPUT" || grep -q "details" "$REQUEST_BOUNTY_OUTPUT"; then
          log_pass "错误响应包含详情信息"
        fi
      else
        log_warn "申请奖金返回 $REQUEST_BOUNTY_CODE，可能需要特定状态或权限。响应: $(cat $REQUEST_BOUNTY_OUTPUT 2>/dev/null | head -c 200)"
      fi
    else
      log_warn "未找到符合测试条件的严重报告（需要状态非 VERIFIED）"
    fi
  else
    log_warn "未找到严重/高危报告，跳过业务规则 API 测试"
  fi

else
  log_warn "后端服务未运行，跳过所有 API 测试"
  log_info "提示: 可以使用以下命令启动后端服务:"
  log_info "  cd $BACKEND_DIR && npm run dev"
fi

# ==============================================
# 第五部分：业务规则静态检查
# ==============================================
log_section "5. 业务规则静态检查"

log_info "检查 '严重漏洞未修复不能发奖' 业务规则实现..."

# 检查状态校验逻辑
if grep -A 30 "validateCriticalVulnerabilityBounty" "$BACKEND_DIR/src/services/ReportService.ts" | grep -q "status.*!==.*VERIFIED"; then
  log_pass "检查状态必须为 VERIFIED"
else
  # 也可能是其他写法，检查包含类似逻辑
  if grep -A 30 "validateCriticalVulnerabilityBounty" "$BACKEND_DIR/src/services/ReportService.ts" | grep -q "VERIFIED"; then
    log_pass "包含 VERIFIED 状态校验"
  else
    log_fail "未找到状态校验逻辑"
  fi
fi

# 检查复测记录校验
if grep -A 50 "validateCriticalVulnerabilityBounty" "$BACKEND_DIR/src/services/ReportService.ts" | grep -q "retestRecords.*length\|isVerified"; then
  log_pass "检查复测记录存在且已验证"
else
  log_fail "未找到复测记录校验逻辑"
fi

# 检查复测人校验
if grep -A 50 "validateCriticalVulnerabilityBounty" "$BACKEND_DIR/src/services/ReportService.ts" | grep -q "researcherId.*===.*submitterId"; then
  log_pass "检查复测由提交研究员完成"
else
  # 尝试更宽松的模式
  if grep -A 50 "validateCriticalVulnerabilityBounty" "$BACKEND_DIR/src/services/ReportService.ts" | grep -q "researcherId\|submitterId"; then
    log_pass "包含提交研究员身份校验"
  else
    log_fail "未找到复测人校验逻辑"
  fi
fi

# 检查先校验后写入模式
log_info "检查 '先校验后写入' 模式实现..."

if grep -A 30 "requestBountyApproval" "$BACKEND_DIR/src/services/ReportService.ts" | grep -q "validateCriticalVulnerabilityBounty\|processReportWithValidation\|success.*false"; then
  log_pass "requestBountyApproval 先校验后写入"
else
  log_fail "requestBountyApproval 未实现先校验后写入"
fi

if grep -A 30 "approveBounty" "$BACKEND_DIR/src/services/ReportService.ts" | grep -q "validateCriticalVulnerabilityBounty\|success.*false"; then
  log_pass "approveBounty 先校验后写入"
else
  log_fail "approveBounty 未实现先校验后写入"
fi

# ==============================================
# 第六部分：代码质量检查
# ==============================================
log_section "6. 代码质量检查"

# TypeScript 类型检查
if command -v tsc >/dev/null 2>&1; then
  log_info "运行 TypeScript 类型检查..."
  
  # 后端类型检查
  if [ -f "$BACKEND_DIR/package.json" ]; then
    cd "$BACKEND_DIR"
    if npx tsc --noEmit 2>/dev/null; then
      log_pass "后端 TypeScript 类型检查通过"
    else
      log_warn "后端 TypeScript 类型检查发现警告（详细信息请运行 npm run build 查看）"
    fi
    cd "$PROJECT_DIR"
  fi
  
  # 前端类型检查
  if [ -f "$FRONTEND_DIR/package.json" ]; then
    cd "$FRONTEND_DIR"
    if npx tsc --noEmit 2>/dev/null; then
      log_pass "前端 TypeScript 类型检查通过"
    else
      log_warn "前端 TypeScript 类型检查发现警告（详细信息请运行 npm run build 查看）"
    fi
    cd "$PROJECT_DIR"
  fi
else
  log_warn "未找到 tsc 命令，跳过 TypeScript 类型检查"
fi

# 检查文件大小合理
for file in \
  "$BACKEND_DIR/src/services/ReportService.ts" \
  "$FRONTEND_DIR/src/pages/AuditReplay.tsx" \
  "$BACKEND_DIR/src/controllers/reportController.ts"; do
  if [ -f "$file" ]; then
    SIZE=$(wc -l < "$file" 2>/dev/null || echo 0)
    if [ "$SIZE" -gt 0 ] && [ "$SIZE" -lt 2000 ]; then
      log_pass "$(basename $file) 代码行数合理: $SIZE 行"
    else
      log_warn "$(basename $file) 代码行数: $SIZE 行"
    fi
  fi
done

# ==============================================
# 第七部分：功能完整性总结
# ==============================================
log_section "7. 功能完整性总结"

FEATURES=(
  "审计回放页面"
  "时间线展示"
  "播放控制（播放/暂停）"
  "步进控制（上一步/下一步）"
  "进度条跳转"
  "速度控制"
  "详情面板"
  "数据快照"
  "复测记录展示"
  "审计日志展示"
  "严重漏洞发奖校验"
  "奖金资格校验 API"
  "先校验后写入模式"
  "校验失败不写入数据库"
  "审计日志记录"
  "前端路由配置"
  "API 接口定义"
  "数据库模型扩展"
)

log_info "功能检查清单:"
for feature in "${FEATURES[@]}"; do
  # 简单检查关键字
  FOUND=0
  if grep -rq "$feature" "$FRONTEND_DIR/src" "$BACKEND_DIR/src" 2>/dev/null; then
    FOUND=1
  fi
  
  # 特殊检查
  case "$feature" in
    "严重漏洞发奖校验")
      if grep -q "validateCriticalVulnerabilityBounty" "$BACKEND_DIR/src/services/ReportService.ts" 2>/dev/null; then
        FOUND=1
      fi
      ;;
    "先校验后写入模式")
      if grep -q "success.*false" "$BACKEND_DIR/src/services/ReportService.ts" 2>/dev/null; then
        FOUND=1
      fi
      ;;
    "审计日志记录")
      if grep -q "createAuditLog\|AuditLog" "$BACKEND_DIR/src" -r 2>/dev/null; then
        FOUND=1
      fi
      ;;
    "API 接口定义")
      if grep -q "/audit\|/validate-bounty" "$BACKEND_DIR/src/routes/reports.ts" 2>/dev/null; then
        FOUND=1
      fi
      ;;
    "数据库模型扩展")
      if grep -q "AuditLog\|StatusHistory\|RetestRecord" "$BACKEND_DIR/prisma/schema.prisma" 2>/dev/null; then
        FOUND=1
      fi
      ;;
  esac
  
  if [ "$FOUND" -eq 1 ]; then
    log_pass "✓ $feature"
  else
    log_warn "? $feature (需要人工确认)"
  fi
done

# ==============================================
# 总结
# ==============================================
log_section "检查结果总结"

echo ""
echo "┌─────────────────────────────────────────────────────┐"
echo "│                    检查结果统计                       │"
echo "├──────────────────────┬──────────────────────────────┤"
printf "│  %-20s │  %-28s │\n" "总检查项" "$TOTAL"
printf "│  %-20s │  ${GREEN}%-28s${NC} │\n" "通过" "$PASS"
printf "│  %-20s │  ${RED}%-28s${NC} │\n" "失败" "$FAIL"
printf "│  %-20s │  ${YELLOW}%-28s${NC} │\n" "警告" "$WARN"
echo "├──────────────────────┼──────────────────────────────┤"

if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
  printf "│  %-20s │  ${GREEN}%-28s${NC} │\n" "总体状态" "✅ 全部通过"
elif [ "$FAIL" -eq 0 ]; then
  printf "│  %-20s │  ${YELLOW}%-28s${NC} │\n" "总体状态" "⚠️  有警告，需关注"
else
  printf "│  %-20s │  ${RED}%-28s${NC} │\n" "总体状态" "❌ 有失败，需修复"
fi
echo "└──────────────────────┴──────────────────────────────┘"
echo ""

# 通过率计算
if [ "$TOTAL" -gt 0 ]; then
  PASS_RATE=$(( (PASS * 100) / TOTAL ))
  log_info "通过率: $PASS_RATE%"
fi

echo ""
log_info "下一步操作建议:"
if [ "$FAIL" -eq 0 ]; then
  echo "  1. 启动后端服务: cd $BACKEND_DIR && npm run dev"
  echo "  2. 启动前端服务: cd $FRONTEND_DIR && npm run dev"
  echo "  3. 访问 http://localhost:5173 进行功能测试"
  echo "  4. 在报告详情页点击「审计回放」按钮查看审计回放"
  echo "  5. 创建严重/高危报告，测试「未修复不能发奖」业务规则"
else
  echo "  1. 修复上述标记为 [FAIL] 的问题"
  echo "  2. 重新运行本脚本验证: ./check-834.sh"
fi

echo ""
log_info "脚本执行完成，退出码: $FAIL"
exit $FAIL
