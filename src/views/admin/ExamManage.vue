<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
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
import { useViewMode } from '@/composables/useViewMode'

const router = useRouter()
const { viewMode, toggleViewMode, isTable, isCard } = useViewMode('examManage')

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
const statusColor = (s?: number) => (s === 1 ? '#67c23a' : s === 2 ? '#909399' : '#e6a23c')

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
  if (examineesMap.value[row.id]) return
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

/* ---------------- 卡片视图：加载考生状态 ---------------- */
const cardExamineesMap = ref<Record<number, any[]>>({})
const cardLoadingMap = ref<Record<number, boolean>>({})

const loadCardExaminees = async (row: ExamSession) => {
  if (cardExamineesMap.value[row.id]) return
  cardLoadingMap.value[row.id] = true
  try {
    const res = await getExamMonitor(row.id)
    cardExamineesMap.value[row.id] = res.data?.examinees ?? []
  } catch { cardExamineesMap.value[row.id] = [] }
  finally { cardLoadingMap.value[row.id] = false }
}

/* ---------------- 统计概览 ---------------- */
const stats = computed(() => {
  const totalExams = list.value.length
  const published = list.value.filter(e => e.status === 1).length
  const finished = list.value.filter(e => e.status === 2).length
  const totalAssigned = list.value.reduce((sum, e) => sum + (e.assignedCount ?? 0), 0)
  const totalSubmitted = list.value.reduce((sum, e) => sum + (e.submittedCount ?? 0), 0)
  const avgScores = list.value.filter(e => e.averageScore != null).map(e => e.averageScore!)
  const overallAvg = avgScores.length ? avgScores.reduce((a, b) => a + b, 0) / avgScores.length : 0
  return { totalExams, published, finished, totalAssigned, totalSubmitted, overallAvg }
})

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

const formatTime = (t?: string) => t?.replace('T', ' ')?.substring(0, 16) || '-'
const formatDuration = (s?: number) => s ? Math.round(s / 60) + '分钟' : '-'

/* 判断考试是否正在进行 */
const isOngoing = (row: ExamSession) => {
  if (row.status !== 1) return false
  const now = new Date()
  const start = new Date(row.startTime)
  const end = new Date(row.endTime)
  return now >= start && now <= end
}

/* 计算提交率 */
const submitRate = (row: ExamSession) => {
  const assigned = row.assignedCount ?? 0
  const submitted = row.submittedCount ?? 0
  return assigned > 0 ? Math.round((submitted / assigned) * 100) : 0
}

onMounted(() => { load(); loadPickers() })
</script>

<template>
  <div class="page">
    <!-- 统计概览 -->
    <div class="stats-bar">
      <div class="stat-item">
        <div class="stat-icon" style="background:#ecf5ff;color:#409eff"><el-icon><Document /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ stats.totalExams }}</div>
          <div class="stat-label">考试总数</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-icon" style="background:#f0f9eb;color:#67c23a"><el-icon><CircleCheck /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ stats.published }}</div>
          <div class="stat-label">进行中</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-icon" style="background:#f4f4f5;color:#909399"><el-icon><Finished /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ stats.finished }}</div>
          <div class="stat-label">已结束</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-icon" style="background:#fdf6ec;color:#e6a23c"><el-icon><User /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ stats.totalAssigned }}</div>
          <div class="stat-label">指派人数</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-icon" style="background:#fef0f0;color:#f56c6c"><el-icon><Trophy /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ stats.overallAvg.toFixed(1) }}</div>
          <div class="stat-label">总体平均分</div>
        </div>
      </div>
    </div>

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
        <el-button-group class="view-toggle">
          <el-button :type="isTable() ? 'primary' : 'default'" size="small" @click="viewMode = 'table'"><el-icon><Grid /></el-icon>表格</el-button>
          <el-button :type="isCard() ? 'primary' : 'default'" size="small" @click="viewMode = 'card'"><el-icon><Menu /></el-icon>卡片</el-button>
        </el-button-group>
      </div>

      <!-- ===== 表格视图 ===== -->
      <template v-if="isTable()">
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
              <span style="font-size:13px">{{ formatTime(row.startTime) }}</span>
              <span style="margin:0 6px;color:#909399">→</span>
              <span style="font-size:13px">{{ formatTime(row.endTime) }}</span>
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
      </template>

      <!-- ===== 卡片视图 ===== -->
      <template v-else>
        <div v-if="list.length === 0" style="padding:40px 0">
          <el-empty description="暂无考试数据" />
        </div>
        <div v-else class="exam-card-grid">
          <div v-for="row in list" :key="row.id" class="exam-card" :class="{ ongoing: isOngoing(row) }">
            <!-- 卡片头部 -->
            <div class="card-header" :style="{ borderTopColor: statusColor(row.status) }">
              <div class="card-title-area">
                <el-tag :type="statusType(row.status)" size="small" effect="dark">{{ statusText(row.status) }}</el-tag>
                <span v-if="isOngoing(row)" class="live-badge"><span class="live-dot"></span>进行中</span>
              </div>
              <div class="card-title">{{ row.sessionName }}</div>
              <div class="card-subtitle">{{ row.paperName }}</div>
            </div>

            <!-- 卡片内容 -->
            <div class="card-body">
              <!-- 时间信息 -->
              <div class="info-row">
                <el-icon><Clock /></el-icon>
                <span class="info-label">时间</span>
                <span class="info-value">{{ formatTime(row.startTime) }} → {{ formatTime(row.endTime) }}</span>
              </div>
              <div class="info-row">
                <el-icon><Timer /></el-icon>
                <span class="info-label">时长</span>
                <span class="info-value">{{ row.duration }} 分钟</span>
              </div>

              <!-- 统计数据 -->
              <div class="stats-row">
                <div class="mini-stat">
                  <div class="mini-num">{{ row.assignedCount ?? 0 }}</div>
                  <div class="mini-label">指派</div>
                </div>
                <div class="mini-stat">
                  <div class="mini-num" style="color:#67c23a">{{ row.submittedCount ?? 0 }}</div>
                  <div class="mini-label">已提交</div>
                </div>
                <div class="mini-stat">
                  <div class="mini-num" style="color:#409eff">{{ row.attendedCount ?? 0 }}</div>
                  <div class="mini-label">已进入</div>
                </div>
                <div class="mini-stat">
                  <div class="mini-num" :style="{color: scoreColor(row.averageScore)}">{{ row.averageScore?.toFixed(1) ?? '-' }}</div>
                  <div class="mini-label">平均分</div>
                </div>
              </div>

              <!-- 提交进度条 -->
              <div v-if="(row.assignedCount ?? 0) > 0" class="progress-area">
                <div class="progress-label">
                  <span>提交率</span>
                  <span>{{ submitRate(row) }}%</span>
                </div>
                <el-progress :percentage="submitRate(row)" :stroke-width="8" :show-text="false"
                  :color="submitRate(row) >= 80 ? '#67c23a' : submitRate(row) >= 50 ? '#e6a23c' : '#f56c6c'" />
              </div>

              <!-- 考生预览 -->
              <div v-if="cardExamineesMap[row.id]?.length" class="examinee-preview">
                <div v-for="examinee in cardExamineesMap[row.id].slice(0, 5)" :key="examinee.userId" class="examinee-chip">
                  <el-avatar :size="24" :src="examinee.avatar || ''">
                    {{ (examinee.realName || examinee.username || '?').charAt(0) }}
                  </el-avatar>
                  <span class="examinee-name">{{ examinee.realName || examinee.username }}</span>
                  <el-tag :type="submitStatusTag(examinee.submitStatus).type" size="small" effect="plain">
                    {{ submitStatusTag(examinee.submitStatus).text }}
                  </el-tag>
                </div>
                <span v-if="cardExamineesMap[row.id].length > 5" class="more-count">
                  +{{ cardExamineesMap[row.id].length - 5 }}人
                </span>
              </div>
              <el-button v-else link type="primary" size="small" @click="loadCardExaminees(row)" :loading="cardLoadingMap[row.id]">
                <el-icon><View /></el-icon> 查看考生
              </el-button>
            </div>

            <!-- 卡片操作 -->
            <div class="card-footer">
              <el-button link type="primary" size="small" @click="openEdit(row)"><el-icon><Edit /></el-icon>编辑</el-button>
              <el-button link type="primary" size="small" @click="router.push('/admin/exams/'+row.id+'/monitor')"><el-icon><Monitor /></el-icon>监控</el-button>
              <el-button link type="primary" size="small" @click="router.push('/admin/exams/'+row.id+'/statistics')"><el-icon><DataAnalysis /></el-icon>统计</el-button>
              <el-button v-if="row.status===1" link type="warning" size="small" @click="confirmForceSubmit(row)"><el-icon><Warning /></el-icon>收卷</el-button>
              <el-button link type="danger" size="small" @click="confirmDelete(row)"><el-icon><Delete /></el-icon>删除</el-button>
            </div>
          </div>
        </div>
      </template>

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

/* 统计概览栏 */
.stats-bar {
  display: flex; gap: 16px; flex-wrap: wrap;
  .stat-item {
    display: flex; align-items: center; gap: 12px;
    background: #fff; border-radius: 10px; padding: 14px 20px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    flex: 1; min-width: 160px;
    .stat-icon {
      width: 42px; height: 42px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
    }
    .stat-num { font-size: 22px; font-weight: 700; line-height: 1.2; }
    .stat-label { font-size: 12px; color: #909399; }
  }
}

.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.view-toggle { margin-left: auto; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.hint { font-size: 12px; color: #909399; margin-top: 4px; }
.expand-header { font-size: 13px; color: #606266; font-weight: 600; }

/* 卡片视图 */
.exam-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}
.exam-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #ebeef5;
  overflow: hidden;
  transition: all 0.3s ease;
  display: flex; flex-direction: column;

  &:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    transform: translateY(-2px);
  }
  &.ongoing {
    border-color: #67c23a;
    box-shadow: 0 0 0 2px rgba(103,194,58,0.15);
  }
}
.card-header {
  padding: 16px 20px 12px;
  border-top: 3px solid #dcdfe6;
  border-bottom: 1px solid #f0f0f0;
  .card-title-area {
    display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
  }
  .card-title {
    font-size: 16px; font-weight: 600; color: #303133;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .card-subtitle {
    font-size: 13px; color: #909399; margin-top: 4px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
}
.live-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; color: #67c23a; font-weight: 600;
  .live-dot {
    width: 8px; height: 8px; border-radius: 50%; background: #67c23a;
    animation: pulse 1.5s ease-in-out infinite;
  }
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}
.card-body {
  padding: 14px 20px;
  flex: 1;
  display: flex; flex-direction: column; gap: 10px;
}
.info-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: #606266;
  .el-icon { color: #909399; }
  .info-label { color: #909399; min-width: 36px; }
  .info-value { color: #303133; }
}
.stats-row {
  display: flex; gap: 0;
  background: #f5f7fa; border-radius: 8px; padding: 12px 0;
  .mini-stat {
    flex: 1; text-align: center;
    border-right: 1px solid #e4e7ed;
    &:last-child { border-right: none; }
    .mini-num { font-size: 18px; font-weight: 700; color: #303133; }
    .mini-label { font-size: 11px; color: #909399; margin-top: 2px; }
  }
}
.progress-area {
  .progress-label {
    display: flex; justify-content: space-between;
    font-size: 12px; color: #909399; margin-bottom: 4px;
  }
}
.examinee-preview {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  .examinee-chip {
    display: flex; align-items: center; gap: 4px;
    background: #f5f7fa; border-radius: 16px; padding: 2px 8px 2px 2px;
    .examinee-name { font-size: 12px; color: #606266; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  }
  .more-count { font-size: 12px; color: #909399; }
}
.card-footer {
  padding: 10px 20px;
  border-top: 1px solid #f0f0f0;
  display: flex; justify-content: flex-end; gap: 4px;
}
</style>
