<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  listSessions, createSession, updateSession, deleteSession,
  listPapers, listUsers, listExamStudents, assignExamStudents, forceSubmit,
  getExamMonitor,
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
  pageSize: 50,
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
      pageNum: query.pageNum, pageSize: query.pageSize,
      sessionName: query.sessionName || undefined,
      paperId: query.paperId, status: query.status,
    })
    list.value = res.data.records ?? []
    total.value = res.data.total ?? 0
  } finally { loading.value = false }
}
const search = () => { query.pageNum = 1; load() }
const reset = () => { query.sessionName = ''; query.paperId = undefined; query.status = undefined; query.pageNum = 1; load() }

/* ---------------- 展开行：加载考生状态 ---------------- */
const expandedRows = ref<Set<number>>(new Set())
const examineesMap = ref<Record<number, any[]>>({})
const expandLoading = ref<Record<number, boolean>>({})

const onExpand = async (row: ExamSession, expandedRows: ExamSession[]) => {
  const isOpen = expandedRows.some(r => r.id === row.id)
  if (!isOpen) return
  if (examineesMap.value[row.id]) return // already loaded
  expandLoading.value[row.id] = true
  try {
    const res = await getExamMonitor(row.id)
    examineesMap.value[row.id] = res.data?.examinees ?? []
  } catch { examineesMap.value[row.id] = [] }
  finally { expandLoading.value[row.id] = false }
}

const submitStatusTag = (s?: number) => {
  if (s === 0) return { text: '进行中', type: 'warning' as const }
  if (s === 1) return { text: '已提交', type: 'success' as const }
  if (s === 2) return { text: '超时提交', type: 'danger' as const }
  return { text: '未开始', type: 'info' as const }
}

/* ---------------- 发布/编辑弹窗 ---------------- */
const dialogVisible = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive({
  id: 0, sessionName: '', paperId: undefined as number | undefined,
  duration: 60, timeRange: [] as string[],
  maxAttempts: 1, showScoreImmediately: true, status: 1 as 0 | 1 | 2,
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
  try { const p = await listPapers({ pageNum: 1, pageSize: 200, status: 1 }); papers.value = p.data.records ?? [] } catch { }
  try { const u = await listUsers({ pageNum: 1, pageSize: 500, role: 'STUDENT' }); students.value = u.data.records ?? [] } catch { }
}

const openCreate = async () => {
  editMode.value = 'create'
  Object.assign(form, { id: 0, sessionName: '', paperId: undefined, duration: 60, timeRange: [], maxAttempts: 1, showScoreImmediately: true, status: 1, studentIds: [] })
  if (!papers.value.length || !students.value.length) await loadPickers()
  dialogVisible.value = true
}

const openEdit = async (row: ExamSession) => {
  editMode.value = 'edit'
  Object.assign(form, { id: row.id, sessionName: row.sessionName, paperId: row.paperId, duration: row.duration, timeRange: [row.startTime, row.endTime], maxAttempts: row.maxAttempts ?? 1, showScoreImmediately: row.showScoreImmediately ?? true, status: row.status, studentIds: [] })
  if (!papers.value.length || !students.value.length) await loadPickers()
  try { const res = await listExamStudents(row.id); form.studentIds = (res.data ?? []).map((s: any) => s.id) } catch { }
  dialogVisible.value = true
}

const submit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    const payload: SessionForm = { sessionName: form.sessionName, paperId: form.paperId!, duration: form.duration, startTime: form.timeRange[0], endTime: form.timeRange[1], maxAttempts: form.maxAttempts, showScoreImmediately: form.showScoreImmediately, status: form.status }
    try {
      let sessionId: number
      if (editMode.value === 'create') { const r = await createSession(payload); sessionId = r.data.id; ElMessage.success('考试已发布') }
      else { await updateSession(form.id, payload); sessionId = form.id; ElMessage.success('已更新') }
      if (form.studentIds.length > 0) { try { await assignExamStudents(sessionId, form.studentIds) } catch { } }
      dialogVisible.value = false; load()
    } catch { } finally { submitting.value = false }
  })
}

const confirmDelete = async (row: ExamSession) => {
  try { await ElMessageBox.confirm(`确认删除《${row.sessionName}》？`, '删除确认', { type: 'warning' }); await deleteSession(row.id); ElMessage.success('已删除'); load() } catch { }
}

const confirmForceSubmit = async (row: ExamSession) => {
  try { await ElMessageBox.confirm(`确认强制收卷《${row.sessionName}》全部进行中考生？`, '强制收卷', { type: 'warning' }); const res = await forceSubmit(row.id); ElMessage.success(`已收卷 ${res.data.affectedCount ?? 0} 人`); load() } catch { }
}

const scoreColor = (v?: number) => { if (v == null) return '#909399'; if (v >= 80) return '#67c23a'; if (v >= 60) return '#e6a23c'; return '#f56c6c' }

onMounted(() => { load(); loadPickers() })
</script>

<template>
  <div class="page">
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-form-item label="考试名称">
          <el-input v-model="query.sessionName" clearable placeholder="搜索" style="width:200px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="全部" style="width:120px">
            <el-option label="草稿" :value="0" /><el-option label="已发布" :value="1" /><el-option label="已结束" :value="2" />
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

      <el-table :data="list" style="width:100%" row-key="id"
        @expand-change="(row: ExamSession, rows: ExamSession[]) => onExpand(row, rows)">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div v-loading="expandLoading[row.id]" style="padding:12px 24px">
              <template v-if="examineesMap[row.id]?.length">
                <div class="expand-header">
                  <span>考生明细（指派 {{ row.assignedCount ?? 0 }} 人 / 已进入 {{ row.attendedCount ?? 0 }} 人 / 已提交 {{ row.submittedCount ?? 0 }} 人）</span>
                  <span v-if="row.averageScore != null" style="margin-left:16px">平均分：<b :style="{color:scoreColor(row.averageScore)}">{{ row.averageScore?.toFixed(1) }}</b></span>
                </div>
                <el-table :data="examineesMap[row.id]" size="small" style="margin-top:8px">
                  <el-table-column type="index" label="#" width="50" />
                  <el-table-column label="头像" width="70" align="center">
                    <template #default="{ row: r }">
                      <el-avatar :size="32" :src="r.avatar || ''">
                        <el-icon><User /></el-icon>
                      </el-avatar>
                    </template>
                  </el-table-column>
                  <el-table-column label="学生" min-width="140">
                    <template #default="{ row: r }">{{ r.realName || r.username }}<span v-if="r.englishName" style="color:#909399;margin-left:4px">{{ r.englishName }}</span><span v-if="r.realName && r.username" style="color:#909399;margin-left:4px">({{ r.username }})</span></template>
                  </el-table-column>
                  <el-table-column label="状态" width="100" align="center">
                    <template #default="{ row: r }">
                      <el-tag :type="submitStatusTag(r.submitStatus).type" size="small">{{ submitStatusTag(r.submitStatus).text }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="得分" width="100" align="center">
                    <template #default="{ row: r }">
                      <span :style="{color:scoreColor(r.totalScore), fontWeight:600}">{{ r.totalScore ?? '-' }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="开始时间" width="170">
                    <template #default="{ row: r }">{{ r.startTime?.replace('T',' ')?.substring(0,19) || '-' }}</template>
                  </el-table-column>
                  <el-table-column label="提交时间" width="170">
                    <template #default="{ row: r }">{{ r.submitTime?.replace('T',' ')?.substring(0,19) || '-' }}</template>
                  </el-table-column>
                  <el-table-column label="用时" width="90" align="center">
                    <template #default="{ row: r }">{{ r.durationSeconds ? Math.round(r.durationSeconds/60)+'分钟' : '-' }}</template>
                  </el-table-column>
                  <el-table-column label="IP" width="140" prop="clientIp" />
                </el-table>
              </template>
              <el-empty v-else description="暂无考生数据" :image-size="60" />
            </div>
          </template>
        </el-table-column>

        <el-table-column type="index" label="#" width="55" />
        <el-table-column prop="sessionName" label="考试名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="paperName" label="试卷" min-width="140" show-overflow-tooltip />
        <el-table-column label="时间段" min-width="280">
          <template #default="{ row }">
            <span style="font-size:13px">{{ row.startTime?.replace('T',' ')?.substring(0,16) || '-' }}</span>
            <span style="margin:0 6px;color:#909399">→</span>
            <span style="font-size:13px">{{ row.endTime?.replace('T',' ')?.substring(0,16) || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="时长" width="80" align="center">
          <template #default="{ row }">{{ row.duration }}分钟</template>
        </el-table-column>
        <el-table-column label="指派" width="70" align="center">
          <template #default="{ row }">
            <span style="font-weight:600">{{ row.assignedCount ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="已考" width="70" align="center">
          <template #default="{ row }">
            <span :style="{color: (row.submittedCount??0) > 0 ? '#67c23a' : '#909399', fontWeight:600}">{{ row.submittedCount ?? 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="平均分" width="85" align="center">
          <template #default="{ row }">
            <span v-if="row.averageScore != null" :style="{color:scoreColor(row.averageScore), fontWeight:600}">{{ row.averageScore?.toFixed(1) }}</span>
            <span v-else style="color:#909399">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="router.push('/admin/exams/'+row.id+'/monitor')">监控</el-button>
            <el-button link type="primary" size="small" @click="router.push('/admin/exams/'+row.id+'/statistics')">统计</el-button>
            <el-button v-if="row.status===1" link type="warning" size="small" @click="confirmForceSubmit(row)">强制收卷</el-button>
            <el-button link type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination v-model:current-page="query.pageNum" v-model:page-size="query.pageSize" :total="total"
          layout="total, sizes, prev, pager, next, jumper" :page-sizes="[20,50,100]" @size-change="load" @current-change="load" />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editMode==='create'?'发布考试':'编辑考试'" width="680px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="考试名称" prop="sessionName"><el-input v-model="form.sessionName" placeholder="如：期中考试" /></el-form-item>
        <el-form-item label="选择试卷" prop="paperId">
          <el-select v-model="form.paperId" filterable placeholder="选择已发布试卷" style="width:100%">
            <el-option v-for="p in papers" :key="p.id" :label="`${p.paperName} (${p.questionCount}题 / ${p.totalScore}分)`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="考试时间" prop="timeRange">
          <el-date-picker v-model="form.timeRange" type="datetimerange" value-format="YYYY-MM-DDTHH:mm:ss" range-separator="→" start-placeholder="开始" end-placeholder="结束" style="width:100%" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="时长(分钟)" prop="duration"><el-input-number v-model="form.duration" :min="1" :max="480" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="最大参考次数"><el-input-number v-model="form.maxAttempts" :min="1" :max="10" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="立即出分"><el-switch v-model="form.showScoreImmediately" /></el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status"><el-radio :value="0">草稿</el-radio><el-radio :value="1">已发布</el-radio><el-radio :value="2">已结束</el-radio></el-radio-group>
        </el-form-item>
        <el-form-item label="参与学生">
          <el-select v-model="form.studentIds" multiple filterable collapse-tags collapse-tags-tooltip placeholder="不选则全体可参加" style="width:100%">
            <el-option v-for="s in students" :key="s.id" :label="`${s.realName||s.username}（${s.username}）`" :value="s.id" />
          </el-select>
          <div class="hint">共 {{ students.length }} 名学生；不指派则全体可参加</div>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" :loading="submitting" @click="submit">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.toolbar { margin-bottom: 12px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.hint { font-size: 12px; color: #909399; margin-top: 4px; }
.expand-header { font-size: 13px; color: #606266; font-weight: 600; }
</style>
