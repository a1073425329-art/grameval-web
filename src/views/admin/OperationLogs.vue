<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { listOperationLogs, getOperationLogTypes } from '@/api/admin'
import type { OperationLog } from '@/types/admin'

const query = reactive({
  operationType: '',
  userId: undefined as number | undefined,
  timeRange: [] as string[],
  pageNum: 1,
  pageSize: 50,
})

const list = ref<OperationLog[]>([])
const total = ref(0)
const loading = ref(false)
const types = ref<Array<{ value: string; label: string }>>([])

const load = async () => {
  loading.value = true
  try {
    const res = await listOperationLogs({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      operationType: query.operationType || undefined,
      userId: query.userId,
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
  query.timeRange = []
  query.pageNum = 1
  load()
}

const loadTypes = async () => {
  try {
    const res = await getOperationLogTypes()
    const data = res.data
    types.value = Array.isArray(data) ? data : []
  } catch { /* silent */ }
}

/** 不同操作类型对应不同 tag 颜色 */
const typeTag = (t?: string): 'success' | 'primary' | 'warning' | 'danger' | 'info' => {
  if (!t) return 'info'
  if (['LOGIN', 'REGISTER', 'EXAM_START', 'PRACTICE_START'].includes(t)) return 'primary'
  if (['CREATE', 'AI_ANALYZE', 'AI_PREVIEW', 'IMPORT'].includes(t)) return 'success'
  if (['UPDATE', 'BATCH_STATUS', 'CHANGE_PASSWORD', 'ASSIGN_STUDENT'].includes(t)) return 'warning'
  if (['DELETE', 'FORCE_SUBMIT', 'BATCH_DELETE', 'RESET_PASSWORD', 'SESSION_TIMEOUT'].includes(t)) return 'danger'
  return 'info'
}
const typeLabel = (t?: string) => types.value.find((o) => o.value === t)?.label ?? t

onMounted(async () => {
  await loadTypes()
  await load()
})
</script>

<template>
  <div class="page">
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-form-item label="操作类型">
          <el-select v-model="query.operationType" clearable placeholder="全部" style="width:200px" filterable>
            <el-option v-for="op in types" :key="op.value" :label="op.label" :value="op.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="用户 ID">
          <el-input-number v-model="query.userId" placeholder="userId" :min="1" controls-position="right" style="width:150px" />
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="query.timeRange"
            type="datetimerange"
            value-format="YYYY-MM-DDTHH:mm:ss"
            range-separator="→"
            start-placeholder="开始"
            end-placeholder="结束"
            style="width:340px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" v-loading="loading">
      <!-- 卡片列表布局 -->
      <div class="log-list">
        <div
          v-for="item in list"
          :key="item.id"
          class="log-item"
        >
          <div class="log-header">
            <div class="log-time">{{ item.createTime }}</div>
            <div class="log-id">#{{ item.id }}</div>
          </div>
          <div class="log-body">
            <div class="log-user">
              <el-icon><User /></el-icon>
              <span>{{ item.username }}</span>
              <span class="user-id">#{{ item.userId }}</span>
            </div>
            <div class="log-tags">
              <el-tag :type="typeTag(item.operationType)" size="small">
                {{ typeLabel(item.operationType) }}
              </el-tag>
              <el-tag :type="item.resultCode === '200' ? 'success' : 'danger'" size="small">
                {{ item.resultCode }}
              </el-tag>
            </div>
            <div v-if="item.targetType" class="log-target">
              <span class="target-label">目标：</span>
              <span>{{ item.targetType }}</span>
              <span v-if="item.targetId" class="target-id">#{{ item.targetId }}</span>
            </div>
            <div v-if="item.detail" class="log-detail">{{ item.detail }}</div>
          </div>
          <div class="log-footer">
            <span class="log-uri">{{ item.requestUri }}</span>
            <span class="log-ip">{{ item.clientIp }}</span>
          </div>
        </div>
      </div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[50, 100, 200]"
          @size-change="load"
          @current-change="load"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.mono { font-family: Consolas, Menlo, monospace; font-size: 12px; color: #606266; }

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

.log-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px dashed #ebeef5;
}

.log-uri {
  font-family: Consolas, Menlo, monospace;
  font-size: 12px;
  color: #409eff;
}

.log-ip {
  font-size: 12px;
  color: #909399;
}
</style>
