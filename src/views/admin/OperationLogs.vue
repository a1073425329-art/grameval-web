<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { listOperationLogs, getOperationLogTypes } from '@/api/admin'
import type { OperationLog } from '@/types/admin'

const query = reactive({
  operationType: '',
  userId: undefined as number | undefined,
  timeRange: [] as string[],
  pageNum: 1,
  pageSize: 20,
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
    types.value = res.data ?? []
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
      <el-table :data="list" style="width:100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="createTime" label="时间" width="180" />
        <el-table-column label="用户" width="180">
          <template #default="{ row }">
            <span>{{ row.username }}</span>
            <span style="color:#909399; margin-left:4px">#{{ row.userId }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作类型" width="140">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.operationType)" size="small">
              {{ typeLabel(row.operationType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="目标" width="180">
          <template #default="{ row }">
            <span v-if="row.targetType">
              {{ row.targetType }}
              <span v-if="row.targetId" style="color:#909399">#{{ row.targetId }}</span>
            </span>
            <span v-else style="color:#c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="详情" min-width="240" show-overflow-tooltip />
        <el-table-column prop="requestUri" label="请求路径" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="mono">{{ row.requestUri }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="clientIp" label="IP" width="140" />
        <el-table-column label="结果" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.resultCode === '200' ? 'success' : 'danger'" size="small">
              {{ row.resultCode }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

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
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.mono { font-family: Consolas, Menlo, monospace; font-size: 12px; color: #606266; }
</style>
