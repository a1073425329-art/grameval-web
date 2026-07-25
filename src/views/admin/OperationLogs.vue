<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import {
  List, Grid, Search, Refresh, Delete, View, Warning,
  Clock, Connection, Document, Monitor, Cpu, WarningFilled
} from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { 
  listOperationLogs, 
  getOperationLogTypes, 
  getOperationLogDetail,
  clearAllOperationLogs,
  deleteOperationLog
} from '@/api/admin'
import type { OperationLog } from '@/types/admin'
import { useViewMode } from '@/composables/useViewMode'

const { viewMode, toggleViewMode } = useViewMode('operation_logs')

const query = reactive({
  operationType: '',
  userId: undefined as number | undefined,
  username: '',
  clientIp: '',
  resultCode: '',
  targetType: '',
  httpMethod: '',
  timeRange: [] as string[],
  pageNum: 1,
  pageSize: 50,
})

const list = ref<OperationLog[]>([])
const total = ref(0)
const loading = ref(false)
const types = ref<Array<{ value: string; label: string }>>([])

// 详情弹窗
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailLog = ref<OperationLog | null>(null)

// 操作日志
const load = async () => {
  loading.value = true
  try {
    const res = await listOperationLogs({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      operationType: query.operationType || undefined,
      userId: query.userId,
      username: query.username || undefined,
      clientIp: query.clientIp || undefined,
      resultCode: query.resultCode || undefined,
      targetType: query.targetType || undefined,
      httpMethod: query.httpMethod || undefined,
      startTime: query.timeRange?.[0],
      endTime: query.timeRange?.[1],
    })
    list.value = res.data.records ?? []
    total.value = res.data.total ?? 0
  } finally { loading.value = false }
}

const search = () => { query.pageNum = 1; load() }
const reset = () => {
  query.operationType = ''
  query.userId = undefined
  query.username = ''
  query.clientIp = ''
  query.resultCode = ''
  query.targetType = ''
  query.httpMethod = ''
  query.timeRange = []
  query.pageNum = 1
  load()
}

const loadTypes = async () => {
  try {
    const res = await getOperationLogTypes()
    const data = res.data
    types.value = Array.isArray(data) ? data : Object.entries(data).map(([value, label]) => ({ value, label: String(label) }))
  } catch { /* silent */ }
}

/** 不同操作类型对应不同 tag 颜色 */
const typeTag = (t?: string): 'success' | 'primary' | 'warning' | 'danger' | 'info' => {
  if (!t) return 'info'
  if (['LOGIN', 'REGISTER', 'EXAM_START', 'PRACTICE_START'].includes(t)) return 'primary'
  if (['CREATE', 'AI_ANALYZE', 'AI_PREVIEW', 'IMPORT'].includes(t)) return 'success'
  if (['UPDATE', 'BATCH_STATUS', 'CHANGE_PASSWORD', 'ASSIGN_STUDENT'].includes(t)) return 'warning'
  if (['DELETE', 'FORCE_SUBMIT', 'BATCH_DELETE', 'RESET_PASSWORD', 'SESSION_TIMEOUT'].includes(t)) return 'danger'
  if (['ERROR'].includes(t)) return 'danger'
  return 'info'
}

const typeLabel = (t?: string) => types.value.find((o) => o.value === t)?.label ?? t

/** 结果码颜色 */
const resultTag = (code?: string): 'success' | 'warning' | 'danger' | 'info' => {
  if (!code) return 'info'
  if (code === '200') return 'success'
  if (code.startsWith('4')) return 'warning'
  if (code.startsWith('5')) return 'danger'
  return 'info'
}

/** 格式化耗时 */
const formatDuration = (ms?: number) => {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`
}

/** 格式化内存 */
const formatMemory = (bytes?: number) => {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

/** 查看详情 */
const showDetail = async (log: OperationLog) => {
  detailLoading.value = true
  try {
    const res = await getOperationLogDetail(log.id)
    detailLog.value = res.data
    detailVisible.value = true
  } finally {
    detailLoading.value = false
  }
}

/** 关闭详情 */
const closeDetail = () => {
  detailVisible.value = false
  detailLog.value = null
}

/** 删除单条 */
const handleDelete = async (log: OperationLog) => {
  await ElMessageBox.confirm('确定要删除这条日志吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
  await deleteOperationLog(log.id)
  ElMessage.success('删除成功')
  load()
}

/** 一键清空 */
const handleClearAll = async () => {
  await ElMessageBox.confirm('确定要清空所有操作日志吗？此操作不可恢复！', '警告', {
    confirmButtonText: '确定清空',
    cancelButtonText: '取消',
    type: 'error'
  })
  await clearAllOperationLogs()
  ElMessage.success('所有日志已清空')
  load()
}

/** 判断JSON是否格式化显示 */
const isJson = (str?: string) => {
  if (!str) return false
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

/** 格式化JSON */
const formatJson = (str?: string) => {
  if (!str) return ''
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

/** HTTP方法颜色 */
const methodTag = (method?: string): 'success' | 'primary' | 'warning' | 'danger' => {
  if (!method) return 'primary'
  if (method === 'GET') return 'success'
  if (method === 'POST') return 'primary'
  if (method === 'PUT') return 'warning'
  if (method === 'DELETE') return 'danger'
  return 'primary'
}

const methodLabel = (method?: string) => {
  if (!method) return '-'
  return method
}

onMounted(async () => {
  await loadTypes()
  await load()
})
</script>

<template>
  <div class="page">
    <!-- 筛选卡片 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-row :gutter="8">
          <el-form-item label="操作类型">
            <el-select v-model="query.operationType" clearable placeholder="全部" style="width:160px" filterable>
              <el-option v-for="op in types" :key="op.value" :label="op.label" :value="op.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="HTTP方法">
            <el-select v-model="query.httpMethod" clearable placeholder="全部" style="width:120px">
              <el-option label="GET" value="GET" />
              <el-option label="POST" value="POST" />
              <el-option label="PUT" value="PUT" />
              <el-option label="DELETE" value="DELETE" />
            </el-select>
          </el-form-item>
          <el-form-item label="用户名">
            <el-input v-model="query.username" clearable placeholder="用户名" style="width:150px" />
          </el-form-item>
          <el-form-item label="用户ID">
            <el-input-number v-model="query.userId" placeholder="userId" :min="1" controls-position="right" style="width:120px" />
          </el-form-item>
          <el-form-item label="客户端IP">
            <el-input v-model="query.clientIp" clearable placeholder="IP" style="width:150px" />
          </el-form-item>
        </el-row>
        <el-row :gutter="8" style="margin-top: 8px;">
          <el-form-item label="操作结果">
            <el-select v-model="query.resultCode" clearable placeholder="全部" style="width:120px">
              <el-option label="成功" value="200" />
              <el-option label="4xx" value="4" />
              <el-option label="5xx" value="5" />
            </el-select>
          </el-form-item>
          <el-form-item label="目标类型">
            <el-select v-model="query.targetType" clearable placeholder="全部" style="width:150px">
              <el-option label="用户" value="USER" />
              <el-option label="题目" value="QUESTION" />
              <el-option label="试卷" value="PAPER" />
              <el-option label="场次" value="SESSION" />
              <el-option label="分类" value="CATEGORY" />
              <el-option label="考试" value="EXAM" />
              <el-option label="练习" value="PRACTICE" />
              <el-option label="AI" value="AI" />
              <el-option label="系统" value="SYSTEM" />
            </el-select>
          </el-form-item>
          <el-form-item label="时间范围">
            <el-date-picker
              v-model="query.timeRange"
              type="datetimerange"
              value-format="YYYY-MM-DDTHH:mm:ss"
              range-separator="~"
              start-placeholder="开始"
              end-placeholder="结束"
              style="width:300px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
            <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
            <el-button @click="toggleViewMode" :type="viewMode === 'card' ? 'primary' : 'default'" size="small">
              <el-icon><List v-if="viewMode === 'card'" /><Grid v-else /></el-icon>
              {{ viewMode === 'card' ? '表格' : '卡片' }}
            </el-button>
            <el-button type="danger" @click="handleClearAll" :disabled="total === 0">
              <el-icon><Delete /></el-icon>一键清空
            </el-button>
          </el-form-item>
        </el-row>
      </el-form>
    </el-card>

    <!-- 统计卡片 -->
    <el-card shadow="never" class="stats-card">
      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-value">{{ total }}</div>
          <div class="stat-label">总日志数</div>
        </div>
        <div class="stat-item success">
          <div class="stat-value">{{ list.filter(l => l.resultCode === '200').length }}</div>
          <div class="stat-label">成功</div>
        </div>
        <div class="stat-item warning">
          <div class="stat-value">{{ list.filter(l => l.resultCode?.startsWith('4')).length }}</div>
          <div class="stat-label">客户端错误</div>
        </div>
        <div class="stat-item danger">
          <div class="stat-value">{{ list.filter(l => l.resultCode?.startsWith('5')).length }}</div>
          <div class="stat-label">服务端错误</div>
        </div>
      </div>
    </el-card>

    <!-- 表格布局 -->
    <el-card shadow="never" v-loading="loading">
      <template v-if="viewMode === 'table'">
        <el-table :data="list" style="width:100%" @row-click="showDetail">
          <el-table-column type="index" label="#" width="60" />
          <el-table-column prop="createTime" label="时间" width="180" />
          <el-table-column label="头像" width="80" align="center">
            <template #default="{ row }">
              <el-avatar :size="36" :src="row.avatar || ''">
                <el-icon><View /></el-icon>
              </el-avatar>
            </template>
          </el-table-column>
          <el-table-column label="用户" width="180">
            <template #default="{ row }">
              <div>{{ row.realName || row.username }}</div>
              <div class="text-sm text-gray">{{ row.userRole }} | ID:{{ row.userId }}</div>
            </template>
          </el-table-column>
          <el-table-column label="方法" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="methodTag(row.httpMethod)" size="small">{{ methodLabel(row.httpMethod) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作类型" width="140">
            <template #default="{ row }">
              <el-tag :type="typeTag(row.operationType)" size="small">{{ typeLabel(row.operationType) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="结果" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="resultTag(row.resultCode)" size="small">{{ row.resultCode || '-' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="目标" width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.targetType">{{ row.targetType }}</span>
              <span v-if="row.targetType && row.targetId"> #{{ row.targetId }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="requestUri" label="接口"  show-overflow-tooltip />
          <el-table-column prop="requestParams" label="请求参数"  show-overflow-tooltip />
          <el-table-column label="耗时" width="100" align="center">
            <template #default="{ row }">
              <span :class="{ 'text-danger': row.durationMs && row.durationMs > 5000 }">
                {{ formatDuration(row.durationMs) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="clientIp" label="IP" width="130" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click.stop="showDetail(row)">查看</el-button>
              <el-button type="danger" size="small" @click.stop="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <!-- 卡片列表布局 -->
      <div v-else class="log-list">
        <div
          v-for="item in list"
          :key="item.id"
          class="log-item"
          @click="showDetail(item)"
        >
          <div class="log-header">
            <div class="log-time">{{ item.createTime }}</div>
            <div class="log-id">#{{ item.id }}</div>
          </div>
          <div class="log-body">
            <div class="log-user">
              <el-avatar :size="32">
                <el-icon><View /></el-icon>
              </el-avatar>
              <span>{{ item.realName || item.username }}</span>
              <span v-if="item.userRole" style="color:#909399">{{ item.userRole }}</span>
              <span class="user-id">#{{ item.userId }}</span>
            </div>
            <div class="log-tags">
              <el-tag :type="methodTag(item.httpMethod)" size="small">
                {{ methodLabel(item.httpMethod) }}
              </el-tag>
              <el-tag :type="typeTag(item.operationType)" size="small">
                {{ typeLabel(item.operationType) }}
              </el-tag>
              <el-tag :type="resultTag(item.resultCode)" size="small">
                {{ item.resultCode || '-' }}
              </el-tag>
              <el-tag v-if="item.durationMs && item.durationMs > 5000" type="danger" size="small">
                <el-icon><Clock /></el-icon>{{ formatDuration(item.durationMs) }}
              </el-tag>
            </div>
            <div v-if="item.targetType" class="log-target">
              <span class="target-label">目标：</span>
              <span>{{ item.targetType }}</span>
              <span v-if="item.targetId" class="target-id">#{{ item.targetId }}</span>
            </div>
            <div v-if="item.detail" class="log-detail">{{ item.detail }}</div>
            <div v-if="item.errorMessage" class="log-error">
              <el-icon><WarningFilled /></el-icon>
              <span>{{ item.errorMessage }}</span>
            </div>
          </div>
          <div class="log-footer">
            <span class="log-uri">{{ item.requestUri }}</span>
            <div class="log-footer-right">
              <span class="log-ip"><el-icon><Connection /></el-icon>{{ item.clientIp }}</span>
              <span class="log-duration"><el-icon><Clock /></el-icon>{{ formatDuration(item.durationMs) }}</span>
              <span class="log-memory"><el-icon><Monitor /></el-icon>{{ formatMemory(item.memoryUsedBytes) }}</span>
            </div>
          </div>
          <div class="log-actions">
            <el-button type="primary" size="small" @click.stop="showDetail(item)">查看详情</el-button>
            <el-button type="danger" size="small" @click.stop="handleDelete(item)">删除</el-button>
          </div>
        </div>
      </div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[20, 50, 100, 200]"
          @size-change="load"
          @current-change="load"
        />
      </div>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="操作日志详情"
      width="70%"
      top="5vh"
      :close-on-click-modal="false"
    >
      <div v-loading="detailLoading" v-if="detailLog">
        <!-- 基本信息 -->
        <div class="detail-section">
          <h4><el-icon><Document /></el-icon>基本信息</h4>
          <el-descriptions :column="3" border>
            <el-descriptions-item label="日志ID">{{ detailLog.id }}</el-descriptions-item>
            <el-descriptions-item label="操作时间">{{ detailLog.createTime }}</el-descriptions-item>
            <el-descriptions-item label="追踪ID">{{ detailLog.traceId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="操作用户">{{ detailLog.realName || detailLog.username }}</el-descriptions-item>
            <el-descriptions-item label="用户ID">{{ detailLog.userId }}</el-descriptions-item>
            <el-descriptions-item label="用户角色">{{ detailLog.userRole || '-' }}</el-descriptions-item>
            <el-descriptions-item label="HTTP方法">
              <el-tag :type="methodTag(detailLog.httpMethod)" size="small">{{ detailLog.httpMethod }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="操作类型">
              <el-tag :type="typeTag(detailLog.operationType)" size="small">{{ typeLabel(detailLog.operationType) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="操作结果">
              <el-tag :type="resultTag(detailLog.resultCode)" size="small">{{ detailLog.resultCode }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="目标类型">{{ detailLog.targetType || '-' }}</el-descriptions-item>
            <el-descriptions-item label="目标ID">{{ detailLog.targetId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="线程名称">{{ detailLog.threadName || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 请求信息 -->
        <div class="detail-section">
          <h4><el-icon><Monitor /></el-icon>请求信息</h4>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="请求URI" :span="2">{{ detailLog.requestUri || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户端IP">{{ detailLog.clientIp || '-' }}</el-descriptions-item>
            <el-descriptions-item label="Referer">{{ detailLog.referer || '-' }}</el-descriptions-item>
            <el-descriptions-item label="User-Agent" :span="2">{{ detailLog.userAgent || '-' }}</el-descriptions-item>
            <el-descriptions-item label="请求参数" :span="2">
              <span v-if="detailLog.requestParams" class="code-text">{{ detailLog.requestParams }}</span>
              <span v-else>-</span>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 请求体 -->
        <div v-if="detailLog.requestBody" class="detail-section">
          <h4><el-icon><Cpu /></el-icon>请求体</h4>
          <pre class="code-block">{{ formatJson(detailLog.requestBody) }}</pre>
        </div>

        <!-- 响应体 -->
        <div v-if="detailLog.responseBody" class="detail-section">
          <h4><el-icon><Cpu /></el-icon>响应体</h4>
          <pre class="code-block">{{ formatJson(detailLog.responseBody) }}</pre>
        </div>

        <!-- 错误信息 -->
        <div v-if="detailLog.errorMessage" class="detail-section error">
          <h4><el-icon><Warning /></el-icon>错误信息</h4>
          <p class="error-message">{{ detailLog.errorMessage }}</p>
        </div>

        <!-- 异常堆栈 -->
        <div v-if="detailLog.errorStackTrace" class="detail-section error">
          <h4><el-icon><Warning /></el-icon>异常堆栈</h4>
          <pre class="code-block error-stack">{{ detailLog.errorStackTrace }}</pre>
        </div>

        <!-- 性能信息 -->
        <div class="detail-section">
          <h4><el-icon><Clock /></el-icon>性能信息</h4>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="耗时">{{ formatDuration(detailLog.durationMs) }}</el-descriptions-item>
            <el-descriptions-item label="内存使用">{{ formatMemory(detailLog.memoryUsedBytes) }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 详情 -->
        <div v-if="detailLog.detail" class="detail-section">
          <h4><el-icon><Document /></el-icon>操作详情</h4>
          <p>{{ detailLog.detail }}</p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.mono { font-family: Consolas, Menlo, monospace; font-size: 12px; color: #606266; }

.text-sm { font-size: 12px; }
.text-gray { color: #909399; }

/* 统计卡片 */
.stats-card {
  .stats-row {
    display: flex;
    gap: 16px;
  }
  .stat-item {
    flex: 1;
    text-align: center;
    padding: 12px 0;
    background: #fafafa;
    border-radius: 8px;
    &.success .stat-value { color: #67c23a; }
    &.warning .stat-value { color: #e6a23c; }
    &.danger .stat-value { color: #f56c6c; }
  }
  .stat-value {
    font-size: 24px;
    font-weight: 600;
    color: #303133;
  }
  .stat-label {
    font-size: 13px;
    color: #909399;
    margin-top: 4px;
  }
}

/* 卡片列表 */
.log-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.log-item {
  padding: 14px 16px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  transition: all 0.2s;
  cursor: pointer;
  &:hover {
    border-color: #409eff;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
  }
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.log-time {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.log-id {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
}

.log-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.log-user {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #606266;
}

.user-id {
  font-size: 12px;
  color: #909399;
}

.log-tags {
  display: flex;
  gap: 6px;
}

.log-target {
  font-size: 13px;
  color: #606266;
}

.target-label {
  color: #909399;
}

.target-id {
  color: #909399;
  margin-left: 4px;
}

.log-detail {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  padding-left: 20px;
  border-left: 3px solid #dcdfe6;
}

.log-error {
  font-size: 13px;
  color: #f56c6c;
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 20px;
  border-left: 3px solid #f56c6c;
}

.log-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px dashed #ebeef5;
}

.log-footer-right {
  display: flex;
  gap: 16px;
}

.log-uri {
  font-family: Consolas, Menlo, monospace;
  font-size: 12px;
  color: #409eff;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-ip, .log-duration, .log-memory {
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 4px;
}

.log-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #f2f6fc;
}

/* 详情弹窗 */
.detail-section {
  margin-bottom: 20px;
  h4 {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  &.error h4 {
    color: #f56c6c;
  }
}

.code-text {
  font-family: Consolas, Menlo, monospace;
  font-size: 12px;
  color: #606266;
  word-break: break-all;
}

.code-block {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  font-family: Consolas, Menlo, monospace;
  font-size: 12px;
  color: #303133;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  &.error-stack {
    background: #fef0f0;
    color: #f56c6c;
  }
}

.error-message {
  color: #f56c6c;
  font-size: 14px;
  line-height: 1.6;
}
</style>
