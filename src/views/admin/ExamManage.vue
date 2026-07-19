<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  listPapers,
  listUsers,
  listExamStudents,
  assignExamStudents,
  forceSubmit,
} from '@/api/admin'
import type { ExamSession, SessionForm } from '@/types/exam'
import type { Paper } from '@/types/paper'
import type { UserDetail } from '@/types/user'

const router = useRouter()

const query = reactive({
  sessionName: '',
  paperId: undefined as number | undefined,
  status: undefined as number | undefined,
  pageNum: 1,
  pageSize: 10,
})
const list = ref<ExamSession[]>([])
const total = ref(0)
const loading = ref(false)

const statusText = (s?: number) => (s === 0 ? '草稿' : s === 1 ? '已发布' : s === 2 ? '已结束' : '-')
const statusType = (s?: number): 'info' | 'success' | 'warning' => (s === 1 ? 'success' : s === 2 ? 'info' : 'warning')

const load = async () => {
  loading.value = true
  try {
    const res = await listSessions({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      sessionName: query.sessionName || undefined,
      paperId: query.paperId,
      status: query.status,
    })
    list.value = res.data.records ?? []
    total.value = res.data.total ?? 0
  } finally { loading.value = false }
}
const search = () => { query.pageNum = 1; load() }
const reset = () => {
  query.sessionName = ''
  query.paperId = undefined
  query.status = undefined
  query.pageNum = 1
  load()
}

/* ---------------- 发布/编辑弹窗 ---------------- */
const dialogVisible = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive({
  id: 0,
  sessionName: '',
  paperId: undefined as number | undefined,
  duration: 60,
  timeRange: [] as string[],
  maxAttempts: 1,
  showScoreImmediately: true,
  status: 1 as 0 | 1 | 2,
  studentIds: [] as number[],
})

const rules: FormRules = {
  sessionName: [{ required: true, message: '请输入考试名称', trigger: 'blur' }],
  paperId: [{ required: true, message: '请选择试卷', trigger: 'change' }],
  duration: [{ required: true, message: '请设置时长', trigger: 'change' }],
  timeRange: [{ required: true, message: '请选择考试时间段', trigger: 'change' }],
}

const papers = ref<Paper[]>([])
const students = ref<UserDetail[]>([])

const loadPickers = async () => {
  try {
    const p = await listPapers({ pageNum: 1, pageSize: 200, status: 1 })
    papers.value = p.data.records ?? []
  } catch { /* silent */ }
  try {
    const u = await listUsers({ pageNum: 1, pageSize: 500, role: 'STUDENT' })
    students.value = u.data.records ?? []
  } catch { /* silent */ }
}

const openCreate = async () => {
  editMode.value = 'create'
  Object.assign(form, {
    id: 0, sessionName: '', paperId: undefined, duration: 60,
    timeRange: [], maxAttempts: 1, showScoreImmediately: true, status: 1,
    studentIds: [],
  })
  if (!papers.value.length || !students.value.length) await loadPickers()
  dialogVisible.value = true
}

const openEdit = async (row: ExamSession) => {
  editMode.value = 'edit'
  Object.assign(form, {
    id: row.id,
    sessionName: row.sessionName,
    paperId: row.paperId,
    duration: row.duration,
    timeRange: [row.startTime, row.endTime],
    maxAttempts: row.maxAttempts ?? 1,
    showScoreImmediately: row.showScoreImmediately ?? true,
    status: row.status,
    studentIds: [],
  })
  if (!papers.value.length || !students.value.length) await loadPickers()
  // 回填指派学生
  try {
    const res = await listExamStudents(row.id)
    form.studentIds = (res.data ?? []).map((s) => s.id)
  } catch { /* silent */ }
  dialogVisible.value = true
}

const submit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    const payload: SessionForm = {
      sessionName: form.sessionName,
      paperId: form.paperId!,
      duration: form.duration,
      startTime: form.timeRange[0],
      endTime: form.timeRange[1],
      maxAttempts: form.maxAttempts,
      showScoreImmediately: form.showScoreImmediately,
      status: form.status,
    }
    try {
      let sessionId: number
      if (editMode.value === 'create') {
        const r = await createSession(payload)
        sessionId = r.data.id
        ElMessage.success('考试已发布')
      } else {
        await updateSession(form.id, payload)
        sessionId = form.id
        ElMessage.success('已更新')
      }
      // 指派学生（全量替换）
      if (form.studentIds.length > 0) {
        try { await assignExamStudents(sessionId, form.studentIds) } catch { /* silent */ }
      }
      dialogVisible.value = false
      load()
    } catch { /* handled */ } finally { submitting.value = false }
  })
}

/* ---------------- 行操作 ---------------- */
const confirmDelete = async (row: ExamSession) => {
  try {
    await ElMessageBox.confirm(`确认删除考试《${row.sessionName}》？有记录则改为软标记结束。`, '删除确认', { type: 'warning' })
    await deleteSession(row.id)
    ElMessage.success('已删除')
    load()
  } catch { /* cancelled */ }
}

const confirmForceSubmit = async (row: ExamSession) => {
  try {
    await ElMessageBox.confirm(`确认对《${row.sessionName}》整场进行中的考生统一强制收卷？`, '强制收卷', {
      type: 'warning',
    })
    const res = await forceSubmit(row.id)
    ElMessage.success(`已强制收卷 ${res.data.affectedCount ?? 0} 位考生`)
  } catch { /* cancelled */ }
}

onMounted(async () => {
  load()
  loadPickers()
})
</script>

<template>
  <div class="page">
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-form-item label="考试名称">
          <el-input v-model="query.sessionName" clearable placeholder="搜索名称" style="width:200px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="全部" style="width:140px">
            <el-option label="草稿" :value="0" />
            <el-option label="已发布" :value="1" />
            <el-option label="已结束" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" v-loading="loading">
      <div class="toolbar">
        <el-button type="primary" @click="openCreate"><el-icon><Plus /></el-icon>发布新考试</el-button>
      </div>
      <el-table :data="list" style="width:100%">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="sessionName" label="考试名称" min-width="180" />
        <el-table-column prop="paperName" label="试卷" min-width="160" />
        <el-table-column label="时间段" min-width="260">
          <template #default="{ row }">
            <span>{{ row.startTime }}</span>
            <span style="margin: 0 4px; color:#909399">→</span>
            <span>{{ row.endTime }}</span>
          </template>
        </el-table-column>
        <el-table-column label="时长" width="80" align="center">
          <template #default="{ row }">{{ row.duration }} 分钟</template>
        </el-table-column>
        <el-table-column label="已考人数" width="90" align="center" prop="attendedCount" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="340" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button
              link type="primary" size="small"
              @click="router.push(`/admin/exams/${row.id}/monitor`)"
            >监控</el-button>
            <el-button
              link type="primary" size="small"
              @click="router.push(`/admin/exams/${row.id}/statistics`)"
            >统计</el-button>
            <el-button v-if="row.status === 1" link type="warning" size="small" @click="confirmForceSubmit(row)">强制收卷</el-button>
            <el-button link type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[10, 20, 50]"
          @size-change="load"
          @current-change="load"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editMode === 'create' ? '发布考试' : '编辑考试'" width="680px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="考试名称" prop="sessionName">
          <el-input v-model="form.sessionName" placeholder="如：期中考试" />
        </el-form-item>
        <el-form-item label="选择试卷" prop="paperId">
          <el-select v-model="form.paperId" filterable placeholder="选择已发布试卷" style="width:100%">
            <el-option
              v-for="p in papers" :key="p.id"
              :label="`${p.paperName} (${p.questionCount}题 / ${p.totalScore}分)`"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="考试时间" prop="timeRange">
          <el-date-picker
            v-model="form.timeRange"
            type="datetimerange"
            value-format="YYYY-MM-DDTHH:mm:ss"
            range-separator="→"
            start-placeholder="开始"
            end-placeholder="结束"
            style="width:100%"
          />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="时长(分钟)" prop="duration">
              <el-input-number v-model="form.duration" :min="1" :max="480" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最大参考次数">
              <el-input-number v-model="form.maxAttempts" :min="1" :max="10" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="立即出分">
          <el-switch v-model="form.showScoreImmediately" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="0">草稿</el-radio>
            <el-radio :value="1">已发布</el-radio>
            <el-radio :value="2">已结束</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="参与学生">
          <el-select
            v-model="form.studentIds"
            multiple filterable collapse-tags collapse-tags-tooltip
            placeholder="选择学生（不选则全体可参加）"
            style="width:100%"
          >
            <el-option
              v-for="s in students" :key="s.id"
              :label="`${s.realName || s.username}（${s.username}）`"
              :value="s.id"
            />
          </el-select>
          <div class="hint">共 {{ students.length }} 名学生；不指派则视为全体可参加</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.toolbar { margin-bottom: 12px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.hint { font-size: 12px; color: #909399; margin-top: 4px; }
</style>
