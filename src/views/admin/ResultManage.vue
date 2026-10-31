<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  CircleCheck,
  CircleClose,
  DataAnalysis,
  Download,
  Refresh,
  Search,
  User,
  Monitor,
  Document,
  TrendCharts,
  ArrowDown,
  Reading,
} from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import {
  exportResults,
  listAdminResults,
  listPapers,
  listSessions,
  regradeResult,
  listUsers,
  getSessionSummaryStats,
  getPaperDetail,
  getStudentKnowledgeMastery,
  getStudentKnowledgeInsights,
  getStudentScoreTrend
} from '@/api/admin'
import { getResultDetail } from '@/api/student'
import type { ExamSession, SessionSummaryStats } from '@/types/exam'
import type { Paper } from '@/types/paper'
import type { ExamResultItem, ResultDetail } from '@/types/result'
import type { UserDetail } from '@/types/user'
import type { QuestionType, Difficulty } from '@/types/common'
import { flattenAnswerUnits } from '@/utils/questionUnits'

interface SessionResultsState {
  records: ExamResultItem[]
  total: number
  pageNum: number
  pageSize: number
  loading: boolean
  loaded: boolean
  userName: string
  minScore: number | undefined
  maxScore: number | undefined
  isPass: boolean | undefined
}

const router = useRouter()
/** [2026-10-31] 三种成绩视图：按考试 / 按试卷 / 单条成绩流水 */
const viewMode = ref<'exam' | 'paper' | 'record'>('exam')
const query = reactive({
  sessionName: '',
  paperId: undefined as number | undefined,
  status: undefined as number | undefined,
  timeRange: [] as string[],
  studentIds: [] as number[],
  pageNum: 1,
  pageSize: 20,
})

/** 单条成绩视图的独立分页 */
const recordQuery = reactive({
  pageNum: 1,
  pageSize: 20,
  userName: '',
  minScore: undefined as number | undefined,
  maxScore: undefined as number | undefined,
})
const recordList = ref<ExamResultItem[]>([])
const recordTotal = ref(0)
const recordLoading = ref(false)

const loadRecords = async () => {
  recordLoading.value = true
  try {
    const res = await listAdminResults({
      pageNum: recordQuery.pageNum,
      pageSize: recordQuery.pageSize,
      userName: recordQuery.userName.trim() || undefined,
      minScore: recordQuery.minScore,
      maxScore: recordQuery.maxScore,
      paperId: query.paperId,
      startTime: query.timeRange[0],
      endTime: query.timeRange[1],
    })
    recordList.value = res.data.records ?? []
    recordTotal.value = res.data.total ?? 0
  } catch {
    recordList.value = []
    recordTotal.value = 0
  } finally {
    recordLoading.value = false
  }
}

/** 按试卷聚合：把场次按 paperId 分组，算场次数/提交/均分 */
const paperGroups = computed(() => {
  const map = new Map<number, {
    paperId: number
    paperName: string
    sessions: typeof sessions.value
    sessionCount: number
    submitted: number
    avgScore: number | null
    scores: number[]
  }>()
  for (const s of sessions.value) {
    const key = s.paperId ?? 0
    if (!map.has(key)) {
      map.set(key, {
        paperId: key,
        paperName: s.paperName || `试卷 #${key}`,
        sessions: [],
        sessionCount: 0,
        submitted: 0,
        avgScore: null,
        scores: [],
      })
    }
    const g = map.get(key)!
    g.sessions.push(s)
    g.sessionCount += 1
    g.submitted += s.submittedCount ?? 0
    if (s.averageScore != null) g.scores.push(Number(s.averageScore))
  }
  return [...map.values()].map((g) => ({
    ...g,
    avgScore: g.scores.length
      ? g.scores.reduce((a, b) => a + b, 0) / g.scores.length
      : null,
  })).sort((a, b) => b.sessionCount - a.sessionCount)
})
const expandedPaperIds = ref<number[]>([])

const sessions = ref<ExamSession[]>([])
const papers = ref<Paper[]>([])
const allStudents = ref<UserDetail[]>([])
const total = ref(0)
const loading = ref(false)
const expandedSessionIds = ref<number[]>([])
const activeSessionId = ref<number | null>(null)
const activeSession = computed(() => sessions.value.find(session => session.id === activeSessionId.value))
const activeSessionKey = computed(() => activeSession.value?.id ?? 0)
const sessionResults = reactive<Record<number, SessionResultsState>>({})

// 大盘汇总统计（多表动态聚合计算，0 物理库表字段）
const summaryStats = ref<SessionSummaryStats | null>(null)
const loadSummaryStats = async () => {
  try {
    const res = await getSessionSummaryStats()
    summaryStats.value = res.data
  } catch {
    summaryStats.value = null
  }
}

const stateForSession = (sessionId: number): SessionResultsState => {
  if (!sessionResults[sessionId]) {
    sessionResults[sessionId] = {
      records: [],
      total: 0,
      pageNum: 1,
      pageSize: 20,
      loading: false,
      loaded: false,
      userName: '',
      minScore: undefined,
      maxScore: undefined,
      isPass: undefined,
    }
  }
  return sessionResults[sessionId]
}

const loadSessions = async (keepExpanded = false) => {
  loading.value = true
  loadSummaryStats()
  if (!keepExpanded) {
    expandedSessionIds.value = []
    activeSessionId.value = null
  }
  try {
    const res = await listSessions({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      sessionName: query.sessionName.trim() || undefined,
      paperId: query.paperId,
      status: query.status,
      startTimeFrom: query.timeRange[0],
      endTimeTo: query.timeRange[1],
      studentIds: query.studentIds && query.studentIds.length ? query.studentIds : undefined,
    })
    sessions.value = res.data.records ?? []
    total.value = res.data.total ?? 0
  } catch {
    sessions.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const loadPickers = async () => {
  try {
    const res = await listPapers({ pageNum: 1, pageSize: 200 })
    papers.value = res.data.records ?? []
  } catch {
    papers.value = []
  }
  try {
    const uRes = await listUsers({ pageNum: 1, pageSize: 500, role: 'STUDENT' })
    allStudents.value = uRes.data.records ?? []
  } catch {
    allStudents.value = []
  }
}

const searchSessions = () => {
  query.pageNum = 1
  recordQuery.pageNum = 1
  if (viewMode.value === 'record') {
    loadRecords()
  } else {
    loadSessions()
  }
}

/** [2026-10-31] 切换视图时按需拉数 */
watch(viewMode, (mode) => {
  if (mode === 'record') loadRecords()
  else if (mode === 'exam') loadSessions(true)
})

const resetSessionQuery = () => {
  query.sessionName = ''
  query.paperId = undefined
  query.status = undefined
  query.timeRange = []
  query.studentIds = []
  query.pageNum = 1
  loadSessions()
}

const loadSessionResults = async (sessionId: number, resetPage = false) => {
  const state = stateForSession(sessionId)
  if (resetPage) state.pageNum = 1
  state.loading = true
  try {
    const res = await listAdminResults({
      sessionId,
      pageNum: state.pageNum,
      pageSize: state.pageSize,
      userName: state.userName.trim() || undefined,
      minScore: state.minScore,
      maxScore: state.maxScore,
      isPass: state.isPass,
    })
    state.records = res.data.records ?? []
    state.total = res.data.total ?? 0
    state.loaded = true
  } catch {
    state.records = []
    state.total = 0
    state.loaded = false
  } finally {
    state.loading = false
  }
}

const handleExpandChange = (row: ExamSession, expandedRows: ExamSession[]) => {
  const isExpanded = expandedRows.some(item => item.id === row.id)
  if (isExpanded) {
    expandedSessionIds.value = [row.id]
    activeSessionId.value = row.id
    const state = stateForSession(row.id)
    if (!state.loaded && !state.loading) loadSessionResults(row.id)
    return
  }
  expandedSessionIds.value = expandedRows.map(item => item.id)
  activeSessionId.value = expandedRows[0]?.id ?? null
}

const toggleSessionExpand = (row: ExamSession) => {
  const isExp = expandedSessionIds.value.includes(row.id)
  if (isExp) {
    expandedSessionIds.value = []
    activeSessionId.value = null
  } else {
    expandedSessionIds.value = [row.id]
    activeSessionId.value = row.id
    const state = stateForSession(row.id)
    if (!state.loaded && !state.loading) loadSessionResults(row.id)
  }
}

const searchSessionResults = (sessionId: number) => loadSessionResults(sessionId, true)
const searchActiveSessionResults = () => {
  if (activeSessionId.value != null) searchSessionResults(activeSessionId.value)
}

const resetSessionResultFilters = (sessionId: number) => {
  const state = stateForSession(sessionId)
  state.userName = ''
  state.minScore = undefined
  state.maxScore = undefined
  state.isPass = undefined
  searchSessionResults(sessionId)
}

const resetActiveSessionResultFilters = () => {
  if (activeSessionId.value != null) resetSessionResultFilters(activeSessionId.value)
}

const changeResultPage = (sessionId: number, page: number) => {
  const state = stateForSession(sessionId)
  state.pageNum = page
  loadSessionResults(sessionId)
}

const changeResultPageSize = (sessionId: number, size: number) => {
  const state = stateForSession(sessionId)
  state.pageSize = size
  state.pageNum = 1
  loadSessionResults(sessionId)
}

const changeActiveResultPage = (page: number) => {
  if (activeSessionId.value != null) changeResultPage(activeSessionId.value, page)
}

const changeActiveResultPageSize = (size: number) => {
  if (activeSessionId.value != null) changeResultPageSize(activeSessionId.value, size)
}

const statusTag = (row: ExamSession) => {
  if (row.status === 0) return { label: '草稿', type: 'info' as const }
  if (row.status === 2) return { label: '已结束', type: 'info' as const }
  if (row.sessionState === 'NOT_STARTED') return { label: '未开始', type: 'warning' as const }
  if (row.sessionState === 'RUNNING') return { label: '进行中', type: 'success' as const }
  if (row.sessionState === 'ENDED') return { label: '已结束', type: 'info' as const }
  return { label: '已发布', type: 'success' as const }
}

const formatTime = (value?: string) => value?.replace('T', ' ').slice(0, 16) || '-'
const durationText = (seconds?: number) => seconds ? `${Math.round(seconds / 60)} 分钟` : '-'
const scoreColor = (row: ExamResultItem) => {
  const pct = row.scorePercentage
  if (pct == null) return '#909399'
  if (pct >= 80) return '#67c23a'
  if (pct >= 60) return '#e6a23c'
  return '#f56c6c'
}
const sessionScoreColor = (score?: number) => {
  if (score == null) return '#909399'
  if (score >= 80) return '#67c23a'
  if (score >= 60) return '#e6a23c'
  return '#f56c6c'
}
const correctRateText = (row: ExamResultItem) => {
  if (row.correctRate != null) return `${row.correctRate.toFixed(1)}%`
  if (row.correctCount != null && row.wrongCount != null) {
    const totalQuestions = row.correctCount + row.wrongCount
    return totalQuestions ? `${((row.correctCount / totalQuestions) * 100).toFixed(1)}%` : '-'
  }
  return '-'
}

const typeLabel = (type?: QuestionType | string) => {
  if (!type) return '-'
  const labels: Record<string, string> = {
    SINGLE: '单选题',
    MULTIPLE: '多选题',
    JUDGE: '判断题',
    FILL: '填空题',
    FILL_HINT: '填空题',
    READING: '阅读理解题',
  }
  return labels[type] || type
}

const diffLabel = (d?: Difficulty | number | string) => {
  if (d === 1 || d === '1' || d === 'EASY' || d === '简单') return '简单'
  if (d === 2 || d === '2' || d === 'MEDIUM' || d === '中等') return '中等'
  if (d === 3 || d === '3' || d === 'HARD' || d === '困难') return '困难'
  return '-'
}

const diffTagType = (d?: Difficulty | number | string): 'success' | 'warning' | 'danger' | 'info' => {
  if (d === 1 || d === '1' || d === 'EASY' || d === '简单') return 'success'
  if (d === 2 || d === '2' || d === 'MEDIUM' || d === '中等') return 'warning'
  if (d === 3 || d === '3' || d === 'HARD' || d === '困难') return 'danger'
  return 'info'
}

const answerText = (answer: string | undefined | null, type?: QuestionType) => {
  if (answer === undefined || answer === null || answer === '') return '（未作答）'
  if (type === 'JUDGE') {
    const normalized = answer.trim().toUpperCase()
    if (['TRUE', 'T', '对', '正确'].includes(normalized)) return '对'
    if (['FALSE', 'F', '错', '错误'].includes(normalized)) return '错'
  }
  return answer
}

const exportingId = ref<number | null>(null)
const doExport = async (sessionId: number) => {
  const state = stateForSession(sessionId)
  exportingId.value = sessionId
  try {
    const response = await exportResults({
      sessionId,
      userName: state.userName.trim() || undefined,
      minScore: state.minScore,
      maxScore: state.maxScore,
      isPass: state.isPass,
    }) as unknown as { data: Blob; headers?: Record<string, string> }
    const blob = new Blob([response.data], { type: 'text/csv;charset=UTF-8' })
    let filename = `成绩数据-场次${sessionId}-${new Date().toISOString().slice(0, 10)}.csv`
    const disposition = response.headers?.['content-disposition'] || response.headers?.['Content-Disposition']
    if (disposition) {
      const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition)
      const name = decodeURIComponent(match?.[1] || match?.[2] || '')
      if (name) filename = name
    }
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    ElMessage.success('本场成绩已导出')
  } catch {
  } finally {
    exportingId.value = null
  }
}

const exportActiveSessionResults = () => {
  if (activeSessionId.value != null) doExport(activeSessionId.value)
}

// ---------------- 答题详情弹窗 ----------------
const detailVisible = ref(false)
const detail = ref<ResultDetail | null>(null)
const detailLoading = ref(false)
const regrading = ref(false)
const detailSessionId = ref<number | null>(null)

const openDetail = async (row: ExamResultItem, sessionId: number) => {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  detailSessionId.value = sessionId
  try {
    const res = await getResultDetail(row.examId ?? row.id)
    detail.value = res.data
  } finally {
    detailLoading.value = false
  }
}

const openActiveResultDetail = (row: ExamResultItem) => {
  if (activeSessionId.value != null) openDetail(row, activeSessionId.value)
}

const doRegrade = async () => {
  if (!detail.value?.id) return
  let reason: string
  try {
    const response = await ElMessageBox.prompt(
      '请填写重新阅卷的原因（后端会记录处理时间）',
      '重新阅卷',
      { confirmButtonText: '确认重阅', cancelButtonText: '取消', inputPlaceholder: '如：题目标准答案修正' },
    )
    reason = response.value || ''
  } catch {
    return
  }

  try {
    regrading.value = true
    await regradeResult(Number(detail.value.id), reason)
    ElMessage.success('重新阅卷完成')
    const refreshed = await getResultDetail(Number(detail.value.id))
    detail.value = refreshed.data
    if (detailSessionId.value != null) {
      await Promise.all([
        loadSessions(true),
        loadSessionResults(detailSessionId.value),
      ])
    }
  } catch {
    ElMessage.error('重新阅卷失败')
  } finally {
    regrading.value = false
  }
}

const openSessionStatistics = (row: ExamSession) => {
  router.push(`/admin/exams/${row.id}/statistics`)
}

// ---------------- 试卷与答案解析抽屉 ----------------
const paperDrawerVisible = ref(false)
const paperDetailLoading = ref(false)
const currentViewingSession = ref<ExamSession | null>(null)
const currentViewingPaper = ref<Paper | null>(null)
const showAnswersInDrawer = ref(true)

const openSessionPaperView = async (row: ExamSession) => {
  currentViewingSession.value = row
  currentViewingPaper.value = null
  paperDrawerVisible.value = true
  paperDetailLoading.value = true
  try {
    const res = await getPaperDetail(row.paperId)
    currentViewingPaper.value = res.data
  } catch (err: any) {
    ElMessage.error(err?.message || '加载试卷详情失败')
  } finally {
    paperDetailLoading.value = false
  }
}

// ---------------- 学生学情与知识画像抽屉（Student Insight Drawer） ----------------
const studentDrawerVisible = ref(false)
const studentDrawerLoading = ref(false)
const targetStudent = ref<UserDetail | null>(null)
const studentMastery = ref<any[]>([])
const studentInsights = ref<any | null>(null)
const studentTrends = ref<any[]>([])

const openStudentInsight = async (studentId: number, studentName?: string) => {
  studentDrawerVisible.value = true
  studentDrawerLoading.value = true
  targetStudent.value = allStudents.value.find(s => s.id === studentId) || ({
    id: studentId,
    username: studentName || `用户 ${studentId}`,
    realName: studentName,
    role: 'STUDENT'
  } as any)
  studentMastery.value = []
  studentInsights.value = null
  studentTrends.value = []

  try {
    const [mRes, iRes, tRes] = await Promise.all([
      getStudentKnowledgeMastery(studentId).catch(() => ({ data: [] })),
      getStudentKnowledgeInsights(studentId).catch(() => ({ data: null })),
      getStudentScoreTrend(studentId).catch(() => ({ data: [] }))
    ])
    studentMastery.value = mRes.data || []
    studentInsights.value = iRes.data || null
    studentTrends.value = tRes.data || []
  } finally {
    studentDrawerLoading.value = false
  }
}

const studentSummary = computed(() => {
  const list = studentMastery.value || []
  const totalAnswers = list.reduce((sum, item) => sum + (Number(item.totalAnswers) || 0), 0)
  const correctCount = list.reduce((sum, item) => sum + (Number(item.correctCount) || 0), 0)
  const overallAccuracy = totalAnswers > 0 ? (correctCount / totalAnswers * 100).toFixed(1) : '-'
  const weakCount = studentInsights.value?.weakTop?.length ?? list.filter(item => Number(item.accuracy || 0) < 60).length
  return { totalAnswers, correctCount, overallAccuracy, weakCount }
})

onMounted(() => {
  loadSessions()
  loadPickers()
})
</script>

<template>
  <div class="page">
    <div class="page-heading">
      <h1>成绩管理</h1>
      <span class="session-count">{{ viewMode === 'record' ? `${recordTotal} 条成绩` : `${total} 场考试` }}</span>
    </div>

    <!-- [2026-10-31] 三种成绩视图切换 -->
    <el-card shadow="never" class="filter-panel" style="margin-bottom: 0">
      <el-radio-group v-model="viewMode" size="large">
        <el-radio-button value="exam">按考试</el-radio-button>
        <el-radio-button value="paper">按试卷</el-radio-button>
        <el-radio-button value="record">单条成绩</el-radio-button>
      </el-radio-group>
      <span class="view-hint">
        {{ viewMode === 'exam' ? '按考试场次展开查看每场成绩明细' : viewMode === 'paper' ? '按试卷聚合各场次的提交与均分' : '扁平化成绩流水，可按姓名/分数筛选' }}
      </span>
    </el-card>

    <!-- 顶部 6 列大盘指标看板（全库多表动态实时计算） -->
    <div class="stat-banner">
      <el-row :gutter="12">
        <el-col :xs="12" :sm="8" :md="4">
          <div class="stat-card">
            <div class="stat-label">场次总数</div>
            <div class="stat-num text-primary">{{ summaryStats?.totalSessions ?? total }}</div>
            <div class="stat-sub">进行中 {{ summaryStats?.runningSessions ?? '-' }} · 已结束 {{ summaryStats?.endedSessions ?? '-' }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="4">
          <div class="stat-card">
            <div class="stat-label">累计指派人次</div>
            <div class="stat-num">{{ summaryStats?.totalAssigned ?? '-' }}</div>
            <div class="stat-sub">全校参考名额池</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="4">
          <div class="stat-card">
            <div class="stat-label">累计实考人次</div>
            <div class="stat-num text-success">{{ summaryStats?.totalSubmitted ?? '-' }}</div>
            <div class="stat-sub">有效交卷考生成绩</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="4">
          <div class="stat-card">
            <div class="stat-label">全站综合出考率</div>
            <div class="stat-num" :style="{ color: Number(summaryStats?.overallAttendanceRate ?? 0) >= 60 ? '#67c23a' : '#e6a23c' }">
              {{ summaryStats?.overallAttendanceRate != null ? Number(summaryStats.overallAttendanceRate).toFixed(1) + '%' : '-' }}
            </div>
            <div class="stat-sub">出考/指派考勤比</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="4">
          <div class="stat-card">
            <div class="stat-label">综合及格率</div>
            <div class="stat-num" :style="{ color: Number(summaryStats?.overallPassRate ?? 0) >= 60 ? '#67c23a' : '#f56c6c' }">
              {{ summaryStats?.overallPassRate != null ? Number(summaryStats.overallPassRate).toFixed(1) + '%' : '-' }}
            </div>
            <div class="stat-sub">及格考生占比</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="4">
          <div class="stat-card">
            <div class="stat-label">全站考试平均分</div>
            <div class="stat-num" :style="{ color: sessionScoreColor(summaryStats?.overallAvgScore) }">
              {{ summaryStats?.overallAvgScore != null ? Number(summaryStats.overallAvgScore).toFixed(1) : '-' }}
            </div>
            <div class="stat-sub">多表加权成绩均值</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 顶层查询栏（增加学生批量查询条件！） -->
    <el-card shadow="never" class="filter-panel">
      <el-form :inline="true" :model="query" @submit.prevent>
        <el-form-item label="考试名称">
          <el-input v-model="query.sessionName" clearable placeholder="搜索考试名称" style="width:170px" @keyup.enter="searchSessions" />
        </el-form-item>
        <el-form-item label="试卷">
          <el-select v-model="query.paperId" clearable filterable placeholder="全部试卷" style="width:170px">
            <el-option v-for="paper in papers" :key="paper.id" :label="paper.paperName" :value="paper.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="参考学生">
          <el-select
            v-model="query.studentIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="多选批量学生筛选"
            style="width:230px"
          >
            <el-option
              v-for="s in allStudents"
              :key="s.id"
              :label="`${s.realName || s.username} (${s.username})`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="全部" style="width:105px">
            <el-option label="草稿" :value="0" />
            <el-option label="已发布" :value="1" />
            <el-option label="已结束" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="考试时间">
          <el-date-picker
            v-model="query.timeRange"
            type="datetimerange"
            value-format="YYYY-MM-DDTHH:mm:ss"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            style="width:280px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="searchSessions"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="resetSessionQuery"><el-icon><Refresh /></el-icon>重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 考试场次主列表（按考试视图） -->
    <el-card v-if="viewMode === 'exam'" shadow="never" v-loading="loading" class="session-list-panel">
      <el-table
        :data="sessions"
        row-key="id"
        :expand-row-keys="expandedSessionIds"
        @expand-change="handleExpandChange"
      >
        <el-table-column type="expand" width="42">
          <template #default>
            <div class="session-detail">
              <div class="session-metrics">
                <div class="metric"><span>已进入</span><strong>{{ activeSession?.attendedCount ?? 0 }}</strong></div>
                <div class="metric"><span>已交卷</span><strong>{{ activeSession?.submittedCount ?? 0 }}</strong></div>
                <div class="metric"><span>实考率</span><strong>{{ activeSession?.attendanceRate != null ? `${Number(activeSession.attendanceRate).toFixed(1)}%` : '-' }}</strong></div>
                <div class="metric"><span>平均分</span><strong :style="{ color: sessionScoreColor(activeSession?.averageScore) }">{{ activeSession?.averageScore != null ? Number(activeSession.averageScore).toFixed(1) : '-' }}</strong></div>
                <div class="metric"><span>及格率</span><strong>{{ activeSession?.passRate != null ? `${Number(activeSession.passRate).toFixed(1)}%` : '-' }}</strong></div>
                <div class="metric"><span>最高 / 最低</span><strong>{{ activeSession?.highestScore ?? '-' }} / {{ activeSession?.lowestScore ?? '-' }}</strong></div>
              </div>

              <!-- 展开行内考生成绩筛选栏 -->
              <el-form :inline="true" :model="stateForSession(activeSessionKey)" class="result-filter" @submit.prevent>
                <el-form-item label="学生">
                  <el-input
                    v-model="stateForSession(activeSessionKey).userName"
                    clearable
                    placeholder="姓名或账号"
                    style="width:160px"
                    @keyup.enter="searchActiveSessionResults"
                  />
                </el-form-item>
                <el-form-item label="成绩状态">
                  <el-select v-model="stateForSession(activeSessionKey).isPass" clearable placeholder="全部" style="width:110px">
                    <el-option label="及格" :value="true" />
                    <el-option label="不及格" :value="false" />
                  </el-select>
                </el-form-item>
                <el-form-item label="分数">
                  <el-input-number v-model="stateForSession(activeSessionKey).minScore" :min="0" placeholder="最低" controls-position="right" style="width:95px" />
                  <span class="range-separator">至</span>
                  <el-input-number v-model="stateForSession(activeSessionKey).maxScore" :min="0" placeholder="最高" controls-position="right" style="width:95px" />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" size="small" @click="searchActiveSessionResults"><el-icon><Search /></el-icon>查询</el-button>
                  <el-button size="small" @click="resetActiveSessionResultFilters"><el-icon><Refresh /></el-icon>重置</el-button>
                  <el-button
                    size="small"
                    type="success"
                    :loading="exportingId === activeSessionKey"
                    @click="exportActiveSessionResults"
                  ><el-icon><Download /></el-icon>导出本场</el-button>
                </el-form-item>
              </el-form>

              <!-- 展开行考生成绩表格（增加弱项语法考点与画像操作！） -->
              <el-table
                :data="stateForSession(activeSessionKey).records"
                size="small"
                stripe
                v-loading="stateForSession(activeSessionKey).loading"
                class="result-table"
              >
                <el-table-column type="index" label="#" width="48" />
                <el-table-column label="头像" width="56" align="center">
                  <template #default="{ row }">
                    <el-avatar :size="28" :src="row.avatar || ''"><el-icon><User /></el-icon></el-avatar>
                  </template>
                </el-table-column>
                <el-table-column label="学生" min-width="140" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span style="font-weight:600; cursor:pointer; color:#409eff" @click="openStudentInsight(row.userId || row.id, row.realName || row.username)">
                      {{ row.realName || row.username || `学生 ${row.userId ?? ''}` }}
                    </span>
                    <span v-if="row.username && row.realName" class="username">({{ row.username }})</span>
                  </template>
                </el-table-column>
                <el-table-column label="得分" width="115" align="center">
                  <template #default="{ row }">
                    <strong :style="{ color: scoreColor(row) }">{{ row.totalScore ?? '-' }}</strong>
                    <span class="score-total"> / {{ row.paperTotalScore ?? '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="得分率" width="85" align="center">
                  <template #default="{ row }">
                    <span :style="{ color: scoreColor(row) }">{{ row.scorePercentage != null ? `${Number(row.scorePercentage).toFixed(1)}%` : '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="正确率" width="85" align="center">
                  <template #default="{ row }">{{ correctRateText(row) }}</template>
                </el-table-column>
                <el-table-column label="状态" width="80" align="center">
                  <template #default="{ row }">
                    <el-tag v-if="row.passed != null" :type="row.passed ? 'success' : 'danger'" size="small">
                      {{ row.passed ? '及格' : '不及格' }}
                    </el-tag>
                    <span v-else class="muted">-</span>
                  </template>
                </el-table-column>
                <el-table-column label="错题薄弱语法点" min-width="170">
                  <template #default="{ row }">
                    <div v-if="row.weakCategories && row.weakCategories.length" style="display:flex; gap:4px; flex-wrap:wrap">
                      <el-tag v-for="cat in row.weakCategories" :key="cat" size="small" type="danger" effect="plain">{{ cat }}</el-tag>
                    </div>
                    <span v-else-if="row.wrongCount === 0" style="color:#67c23a; font-size:12px">全对优秀</span>
                    <span v-else style="color:#c0c4cc">-</span>
                  </template>
                </el-table-column>
                <el-table-column label="排名" width="80" align="center">
                  <template #default="{ row }">{{ row.classRank != null ? `${row.classRank} / ${row.totalCount ?? '-'}` : '-' }}</template>
                </el-table-column>
                <el-table-column prop="submitTime" label="提交时间" width="150">
                  <template #default="{ row }">{{ formatTime(row.submitTime || row.createTime) }}</template>
                </el-table-column>
                <el-table-column label="用时" width="80" align="center">
                  <template #default="{ row }">{{ durationText(row.durationSeconds) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="190" fixed="right" align="center">
                  <template #default="{ row }">
                    <el-button link type="primary" size="small" @click="openActiveResultDetail(row)">详情</el-button>
                    <el-button link type="success" size="small" @click="openStudentInsight(row.userId || row.id, row.realName || row.username)">
                      <el-icon><TrendCharts /></el-icon>知识画像
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>

              <el-empty
                v-if="stateForSession(activeSessionKey).loaded && !stateForSession(activeSessionKey).loading && stateForSession(activeSessionKey).total === 0"
                description="本场暂无符合条件的成绩"
                :image-size="64"
              />
              <el-pagination
                v-if="stateForSession(activeSessionKey).total > 0"
                :current-page="stateForSession(activeSessionKey).pageNum"
                :page-size="stateForSession(activeSessionKey).pageSize"
                :page-sizes="[10, 20, 50, 100]"
                :total="stateForSession(activeSessionKey).total"
                layout="total, sizes, prev, pager, next, jumper"
                class="nested-pagination"
                @current-change="changeActiveResultPage"
                @size-change="changeActiveResultPageSize"
              />
            </div>
          </template>
        </el-table-column>

        <el-table-column type="index" label="#" width="50" />
        <el-table-column label="考试名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="session-name">{{ row.sessionName }}</div>
            <span class="session-id">场次 #{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="paperName" label="试卷" min-width="160" show-overflow-tooltip />
        <el-table-column label="考试时间" min-width="220">
          <template #default="{ row }">
            <div>{{ formatTime(row.startTime) }}</div>
            <span class="muted">至 {{ formatTime(row.endTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTag(row).type" size="small">{{ statusTag(row).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="指派/已考" width="105" align="center">
          <template #default="{ row }">{{ row.attendedCount ?? 0 }} / {{ row.assignedCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="已交卷" width="80" align="center">
          <template #default="{ row }">{{ row.submittedCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="平均分" width="85" align="center">
          <template #default="{ row }">
            <strong v-if="row.averageScore != null" :style="{ color: sessionScoreColor(row.averageScore) }">
              {{ Number(row.averageScore).toFixed(1) }}
            </strong>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="及格率" width="85" align="center">
          <template #default="{ row }">{{ row.passRate != null ? `${Number(row.passRate).toFixed(1)}%` : '-' }}</template>
        </el-table-column>

        <!-- 丰富多样的操作列（常驻核心 + 折叠下拉）彻底解决只有“统计”的问题！ -->
        <el-table-column label="操作" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openSessionStatistics(row)">
              <el-icon><DataAnalysis /></el-icon>统计
            </el-button>
            <el-button link type="primary" size="small" @click="toggleSessionExpand(row)">
              <el-icon><User /></el-icon>{{ expandedSessionIds.includes(row.id) ? '收起成绩' : '展开成绩' }}
            </el-button>
            <el-button link type="success" size="small" :loading="exportingId === row.id" @click="doExport(row.id)">
              <el-icon><Download /></el-icon>导出
            </el-button>

            <!-- 更多折叠下拉菜单 -->
            <el-dropdown trigger="click" style="margin-left:6px">
              <el-button link type="info" size="small">
                更多<el-icon><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="openSessionPaperView(row)">
                    <el-icon><Document /></el-icon>查看试卷与解析
                  </el-dropdown-item>
                  <el-dropdown-item @click="router.push(`/admin/exams/${row.id}/monitor`)">
                    <el-icon><Monitor /></el-icon>考场监控与作答
                  </el-dropdown-item>
                  <el-dropdown-item @click="router.push(`/admin/exams/${row.id}/statistics`)">
                    <el-icon><TrendCharts /></el-icon>学情总览与考情
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && sessions.length === 0" description="暂无符合条件的考试场次" :image-size="100" />
      <el-pagination
        v-if="total > 0"
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @size-change="() => loadSessions()"
        @current-change="() => loadSessions()"
      />
    </el-card>

    <!-- [2026-10-31] 按试卷视图 -->
    <el-card v-else-if="viewMode === 'paper'" shadow="never" v-loading="loading" class="session-list-panel">
      <el-table :data="paperGroups" row-key="paperId" :expand-row-keys="expandedPaperIds">
        <el-table-column type="expand" width="42">
          <template #default="{ row }">
            <div class="session-detail">
              <el-table :data="row.sessions" size="small">
                <el-table-column prop="sessionName" label="考试场次" min-width="200" show-overflow-tooltip />
                <el-table-column label="状态" width="90" align="center">
                  <template #default="{ row: s }">
                    <el-tag size="small" :type="s.status === 2 ? 'info' : s.status === 1 ? 'success' : 'warning'">
                      {{ s.status === 2 ? '已结束' : s.status === 1 ? '已发布' : '草稿' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="提交" width="80" align="center">
                  <template #default="{ row: s }">{{ s.submittedCount ?? 0 }}</template>
                </el-table-column>
                <el-table-column label="平均分" width="90" align="center">
                  <template #default="{ row: s }">{{ s.averageScore != null ? Number(s.averageScore).toFixed(1) : '-' }}</template>
                </el-table-column>
                <el-table-column prop="startTime" label="开始时间" width="150" />
                <el-table-column label="操作" width="100" align="center">
                  <template #default="{ row: s }">
                    <el-button link type="primary" @click="viewMode = 'exam'; activeSessionId = s.id; expandedSessionIds = [s.id]">
                      看成绩
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="paperName" label="试卷" min-width="220" show-overflow-tooltip />
        <el-table-column label="场次数" width="90" align="center">
          <template #default="{ row }">{{ row.sessionCount }}</template>
        </el-table-column>
        <el-table-column label="提交总数" width="100" align="center">
          <template #default="{ row }">{{ row.submitted }}</template>
        </el-table-column>
        <el-table-column label="场均分" width="100" align="center">
          <template #default="{ row }">
            <span :style="{ color: sessionScoreColor(row.avgScore) }">
              {{ row.avgScore != null ? row.avgScore.toFixed(1) : '-' }}
            </span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!paperGroups.length && !loading" description="暂无试卷成绩数据" />
    </el-card>

    <!-- [2026-10-31] 单条成绩视图 -->
    <el-card v-else shadow="never" v-loading="recordLoading" class="session-list-panel">
      <el-form :inline="true" class="result-filter" @submit.prevent>
        <el-form-item label="学生">
          <el-input v-model="recordQuery.userName" clearable placeholder="姓名" style="width:150px" @keyup.enter="searchSessions" />
        </el-form-item>
        <el-form-item label="最低分">
          <el-input-number v-model="recordQuery.minScore" :min="0" :max="150" style="width:110px" />
        </el-form-item>
        <el-form-item label="最高分">
          <el-input-number v-model="recordQuery.maxScore" :min="0" :max="150" style="width:110px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="searchSessions"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="recordQuery.userName = ''; recordQuery.minScore = undefined; recordQuery.maxScore = undefined; searchSessions()">
            <el-icon><Refresh /></el-icon>重置
          </el-button>
        </el-form-item>
      </el-form>
      <el-table :data="recordList" stripe>
        <el-table-column type="index" label="#" width="55" />
        <el-table-column prop="sessionName" label="考试名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="paperName" label="试卷" min-width="120" show-overflow-tooltip />
        <el-table-column label="学生" width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ row.userName || row.studentName || '-' }}</template>
        </el-table-column>
        <el-table-column label="得分" width="100" align="center">
          <template #default="{ row }">
            <span :style="{ color: sessionScoreColor(row.totalScore), fontWeight: 600 }">{{ row.totalScore ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="得分率" width="90" align="center">
          <template #default="{ row }">{{ row.scorePercentage != null ? Number(row.scorePercentage).toFixed(1) + '%' : '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.submitStatus === 1 ? 'success' : 'info'">
              {{ row.submitStatus === 1 ? '已提交' : row.submitStatus === 2 ? '超时' : '缺考' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="submitTime" label="提交时间" width="150" />
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row, row.sessionId ?? 0)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination
          v-model:current-page="recordQuery.pageNum"
          v-model:page-size="recordQuery.pageSize"
          :total="recordTotal"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          @size-change="loadRecords"
          @current-change="loadRecords"
        />
      </div>
    </el-card>

    <!-- 答题详情弹窗 -->
    <el-dialog v-model="detailVisible" width="760px" top="6vh">
      <template #header>
        <div class="dialog-header">
          <span>答题详情</span>
          <el-button type="warning" :loading="regrading" @click="doRegrade">
            <el-icon><Refresh /></el-icon>重新阅卷
          </el-button>
        </div>
      </template>
      <div v-loading="detailLoading" class="detail-content">
        <template v-if="detail">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="考试">{{ detail.sessionName }}</el-descriptions-item>
            <el-descriptions-item label="学生">{{ detail.realName || detail.username }}</el-descriptions-item>
            <el-descriptions-item label="得分">
              <strong class="detail-score">{{ detail.totalScore }}</strong> / {{ detail.paperTotalScore ?? '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="得分率">{{ detail.scorePercentage != null ? `${Number(detail.scorePercentage).toFixed(1)}%` : '-' }}</el-descriptions-item>
            <el-descriptions-item label="用时">{{ durationText(detail.durationSeconds) }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ formatTime(detail.submitTime) }}</el-descriptions-item>
            <el-descriptions-item label="答对 / 答错">{{ detail.correctCount }} / {{ detail.wrongCount }}</el-descriptions-item>
            <el-descriptions-item label="正确率">{{ correctRateText(detail as unknown as ExamResultItem) }}</el-descriptions-item>
          </el-descriptions>

          <h3 class="answers-heading">逐题明细</h3>
          <div class="answers">
            <div
              v-for="(answer, index) in flattenAnswerUnits(detail.answers)"
              :key="answer.questionId"
              class="answer-item"
              :class="{ correct: answer.isCorrect === 1, incorrect: answer.isCorrect === 0 }"
            >
              <div class="answer-head">
                <span class="answer-result">
                  <el-icon><CircleCheck v-if="answer.isCorrect === 1" /><CircleClose v-else /></el-icon>
                  第 {{ index + 1 }} 题
                </span>
                <el-tag size="small">{{ typeLabel(answer.questionType) }}</el-tag>
                <el-tag size="small" type="info">{{ answer.obtainedScore ?? 0 }} 分</el-tag>
              </div>
              <div class="answer-stem">{{ answer.stem }}</div>
              <div class="answer-row"><span>你的答案</span><strong :class="answer.isCorrect === 1 ? 'correct-text' : 'incorrect-text'">{{ answerText(answer.userAnswer, answer.questionType) }}</strong></div>
              <div class="answer-row"><span>正确答案</span><strong class="correct-text">{{ answerText(answer.standardAnswer, answer.questionType) }}</strong></div>
              <div v-if="answer.analysis" class="answer-row"><span>解析</span><span>{{ answer.analysis }}</span></div>
            </div>
          </div>
        </template>
      </div>
    </el-dialog>

    <!-- 关联试卷与标准答案解析抽屉 -->
    <el-drawer
      v-model="paperDrawerVisible"
      :title="`《${currentViewingSession?.sessionName || '考试'}》关联试卷详情`"
      size="720px"
      direction="rtl"
      destroy-on-close
    >
      <div v-loading="paperDetailLoading" class="paper-drawer-container">
        <template v-if="currentViewingPaper">
          <div class="drawer-header-meta">
            <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #303133;">
              {{ currentViewingPaper.paperName }}
            </h3>
            <div style="font-size: 13px; color: #606266; display: flex; gap: 16px; flex-wrap: wrap;">
              <span>总分：<strong style="color: #409eff;">{{ currentViewingPaper.totalScore }}</strong> 分</span>
              <span>题量：<strong>{{ currentViewingPaper.questionCount }}</strong> 题</span>
              <span>及格分：<strong>{{ currentViewingPaper.passScore ?? '-' }}</strong></span>
              <span>建议时长：<strong>{{ currentViewingPaper.suggestedDuration || 60 }}</strong> 分钟</span>
              <span>加权难度：<strong>{{ currentViewingPaper.avgDifficulty != null ? Number(currentViewingPaper.avgDifficulty).toFixed(2) : '-' }}</strong></span>
            </div>
          </div>

          <div class="drawer-ctrl-bar">
            <span style="font-size: 13px; color: #606266; font-weight: 500;">
              考卷题目与参考答案全景（含单选、多选、判断、填空、阅读理解）
            </span>
            <el-switch
              v-model="showAnswersInDrawer"
              active-text="显示标准答案与逐题解析"
              style="--el-switch-on-color: #67c23a;"
            />
          </div>

          <div class="drawer-question-list">
            <div
              v-for="(unit, idx) in (currentViewingPaper.questions || [])"
              :key="unit.unitType === 'READING' ? `p-${unit.passageId || idx}` : `q-${unit.questionId || idx}`"
              class="d-q-card"
            >
              <template v-if="unit.unitType === 'READING'">
                <div class="d-q-head">
                  <span class="d-q-no">第 {{ idx + 1 }} 题</span>
                  <el-tag size="small" type="warning">阅读理解</el-tag>
                  <span class="d-q-score">{{ unit.questionScore }} 分 · {{ unit.subQuestions?.length || 0 }} 小题</span>
                </div>
                <div v-if="unit.passageTitle || unit.passageContent" class="d-passage-box">
                  <h4 v-if="unit.passageTitle">{{ unit.passageTitle }}</h4>
                  <div class="d-passage-body" style="white-space: pre-wrap;">{{ unit.passageContent }}</div>
                </div>

                <div v-for="(sub, sIdx) in (unit.subQuestions || [])" :key="sub.questionId" class="d-sub-card">
                  <div class="d-sub-head">
                    <span>({{ sIdx + 1 }})</span>
                    <el-tag size="small">{{ typeLabel(sub.questionType) }}</el-tag>
                    <el-tag size="small" :type="diffTagType(sub.difficulty)">{{ diffLabel(sub.difficulty) }}</el-tag>
                    <span style="color:#409eff;font-weight:600;margin-left:4px">{{ sub.questionScore }} 分</span>
                  </div>
                  <div class="d-q-stem">{{ sub.stem }}</div>
                  <div v-if="sub.options && sub.options.length" class="d-opts-list">
                    <div
                      v-for="opt in sub.options"
                      :key="opt.optionLabel"
                      class="d-opt-item"
                      :class="{ 'd-opt-correct': showAnswersInDrawer && (sub.standardAnswer && sub.standardAnswer.includes(opt.optionLabel)) }"
                    >
                      <strong style="margin-right: 6px;">{{ opt.optionLabel }}.</strong>
                      <span>{{ opt.optionContent }}</span>
                      <el-tag
                        v-if="showAnswersInDrawer && (sub.standardAnswer && sub.standardAnswer.includes(opt.optionLabel))"
                        size="small"
                        type="success"
                        style="margin-left: 8px;"
                      >正确答案</el-tag>
                    </div>
                  </div>
                  <div v-if="showAnswersInDrawer" class="d-ans-box">
                    <div class="d-std-ans">
                      <strong>标准答案：</strong>
                      <span style="color: #67c23a; font-weight: 600;">{{ sub.standardAnswer || '-' }}</span>
                    </div>
                    <div v-if="sub.analysis" class="d-analysis">
                      <strong>解析：</strong>
                      <span>{{ sub.analysis }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="d-q-head">
                  <span class="d-q-no">第 {{ idx + 1 }} 题</span>
                  <el-tag size="small" type="primary">{{ typeLabel(unit.questionType) }}</el-tag>
                  <el-tag size="small" :type="diffTagType(unit.difficulty)">{{ diffLabel(unit.difficulty) }}</el-tag>
                  <span class="d-q-score">{{ unit.questionScore }} 分</span>
                </div>
                <div class="d-q-stem">{{ unit.stem }}</div>
                <div v-if="unit.options && unit.options.length" class="d-opts-list">
                  <div
                    v-for="opt in unit.options"
                    :key="opt.optionLabel"
                    class="d-opt-item"
                    :class="{ 'd-opt-correct': showAnswersInDrawer && (unit.standardAnswer && unit.standardAnswer.includes(opt.optionLabel)) }"
                  >
                    <strong style="margin-right: 6px;">{{ opt.optionLabel }}.</strong>
                    <span>{{ opt.optionContent }}</span>
                    <el-tag
                      v-if="showAnswersInDrawer && (unit.standardAnswer && unit.standardAnswer.includes(opt.optionLabel))"
                      size="small"
                      type="success"
                      style="margin-left: 8px;"
                    >正确答案</el-tag>
                  </div>
                </div>
                <div v-if="showAnswersInDrawer" class="d-ans-box">
                  <div class="d-std-ans">
                    <strong>标准答案：</strong>
                    <span style="color: #67c23a; font-weight: 600;">{{ unit.standardAnswer || '-' }}</span>
                  </div>
                  <div v-if="unit.analysis" class="d-analysis">
                    <strong>解析：</strong>
                    <span>{{ unit.analysis }}</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </template>
        <el-empty v-else description="暂无试卷内容" />
      </div>
    </el-drawer>

    <!-- 学生个人知识画像与学情诊断抽屉（Student Insight Drawer） -->
    <el-drawer
      v-model="studentDrawerVisible"
      :title="`学生知识掌握度画像 —— ${targetStudent?.realName || targetStudent?.username || ''}`"
      size="650px"
      direction="rtl"
      destroy-on-close
    >
      <div v-loading="studentDrawerLoading" class="student-insight-container">
        <!-- 学生基本头部 -->
        <div class="stu-header-box">
          <el-avatar :size="54" :src="targetStudent?.avatar || ''">
            <el-icon :size="28"><User /></el-icon>
          </el-avatar>
          <div class="stu-meta">
            <div class="stu-name">
              {{ targetStudent?.realName || targetStudent?.username }}
              <el-tag size="small" type="success" style="margin-left:6px">在籍学生</el-tag>
            </div>
            <div class="stu-sub">
              <span>账号：{{ targetStudent?.username }}</span>
              <span v-if="targetStudent?.englishName" style="margin-left:12px">英文名：{{ targetStudent?.englishName }}</span>
            </div>
          </div>
        </div>

        <!-- 知识掌握度洞察概览 -->
        <div class="insight-cards">
          <div class="in-card">
            <div class="in-label">总作答题数</div>
            <div class="in-num text-primary">{{ studentSummary.totalAnswers }} 题</div>
          </div>
          <div class="in-card">
            <div class="in-label">综合正确率</div>
            <div class="in-num" :style="{ color: studentSummary.overallAccuracy !== '-' && Number(studentSummary.overallAccuracy) >= 60 ? '#67c23a' : '#f56c6c' }">
              {{ studentSummary.overallAccuracy !== '-' ? studentSummary.overallAccuracy + '%' : '-' }}
            </div>
          </div>
          <div class="in-card">
            <div class="in-label">薄弱语法项</div>
            <div class="in-num text-danger">{{ studentSummary.weakCount }} 个</div>
          </div>
        </div>

        <!-- 知识掌握度清单 -->
        <h4 style="margin: 20px 0 10px; color:#303133; display:flex; align-items:center; gap:6px">
          <el-icon><Reading /></el-icon> 核心语法掌握度清单（实时多表聚合）
        </h4>
        <div v-if="studentMastery && studentMastery.length" class="mastery-list">
          <div v-for="m in studentMastery" :key="m.id || m.tagId" class="mastery-item">
            <div class="m-head">
              <span class="m-name">
                <strong>{{ m.tagName || m.categoryName }}</strong>
                <el-tag v-if="m.categoryName" size="small" type="info" style="margin-left:6px">{{ m.categoryName }}</el-tag>
                <el-tag v-if="m.masteryLevelLabel" size="small" type="warning" style="margin-left:4px">{{ m.masteryLevelLabel }}</el-tag>
              </span>
              <span class="m-rate" :style="{ color: Number(m.accuracy ?? 0) >= 60 ? '#67c23a' : '#f56c6c' }">
                {{ Number(m.accuracy ?? 0).toFixed(1) }}%
              </span>
            </div>
            <el-progress
              :percentage="Math.min(100, Math.max(0, Number(m.accuracy ?? 0)))"
              :color="Number(m.accuracy ?? 0) >= 80 ? '#67c23a' : Number(m.accuracy ?? 0) >= 60 ? '#e6a23c' : '#f56c6c'"
              :stroke-width="10"
              :show-text="false"
            />
            <div class="m-foot">
              <span>已答 {{ m.totalAnswers ?? 0 }} 题 · 正确 {{ m.correctCount ?? 0 }} 题</span>
              <span v-if="Number(m.accuracy ?? 0) < 60" style="color:#f56c6c">⚠️ 需重点巩固</span>
            </div>
          </div>
        </div>
        <el-empty v-else description="该学生暂无语法掌握度记录" :image-size="60" />

        <!-- 历史成绩趋势简览 -->
        <h4 style="margin: 24px 0 10px; color:#303133; display:flex; align-items:center; gap:6px">
          <el-icon><TrendCharts /></el-icon> 历次考试得分走势（最近场次）
        </h4>
        <div v-if="studentTrends && studentTrends.length" class="trend-list">
          <div v-for="t in studentTrends" :key="t.id || t.sessionId || t.examId" class="trend-item">
            <div class="t-name">{{ t.examName || t.sessionName || t.paperName || '考试' }}</div>
            <div class="t-score" :style="{ color: Number(t.score ?? t.totalScore ?? 0) >= 60 ? '#67c23a' : '#f56c6c' }">
              {{ t.score ?? t.totalScore }} 分 <span style="font-size:12px; font-weight:normal; color:#909399">/ {{ t.totalScore }}分</span>
            </div>
            <div class="t-time">{{ t.examDate || formatTime(t.submitTime || t.createTime) }}</div>
          </div>
        </div>
        <el-empty v-else description="暂无历史成绩走势" :image-size="60" />
      </div>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-heading h1 {
  margin: 0;
  color: #303133;
  font-size: 20px;
  font-weight: 600;
}

.session-count,
.muted,
.session-id,
.username,
.score-total {
  color: #909399;
  font-size: 12px;
}

.filter-panel :deep(.el-card__body) {
  padding-bottom: 2px;
}

.view-hint {
  margin-left: 14px;
  font-size: 12px;
  color: #909399;
}

.session-detail {
  padding: 12px 16px 16px;
  background: #f7f9fc;
  border-radius: 4px;
}

.session-metrics {
  display: grid;
  grid-template-columns: repeat(6, minmax(100px, 1fr));
  gap: 12px;
  padding: 8px 0 14px;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.metric span {
  color: #909399;
  font-size: 12px;
}

.metric strong {
  color: #303133;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}

.result-filter {
  margin: 0;
  padding: 8px 10px 0;
  background: #fff;
  border: 1px solid #ebeef5;
  border-bottom: 0;
}

.result-filter :deep(.el-form-item) {
  margin-bottom: 8px;
}

.range-separator {
  padding: 0 5px;
  color: #909399;
}

.result-table {
  border: 1px solid #ebeef5;
}

.session-name {
  color: #303133;
  font-weight: 600;
}

.session-id,
.username {
  display: block;
  margin-top: 2px;
}

.pagination,
.nested-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.nested-pagination {
  padding-top: 10px;
}

/* 顶部大盘卡片 */
.stat-banner {
  margin-bottom: 4px;
}
.stat-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 14px 16px;
  transition: all 0.2s ease;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
.stat-card .stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 6px;
}
.stat-card .stat-num {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}
.stat-card .stat-sub {
  font-size: 12px;
  color: #a8abb2;
  margin-top: 4px;
}
.text-primary { color: #409eff; }
.text-success { color: #67c23a; }
.text-danger { color: #f56c6c; }

/* 试卷抽屉样式 */
.drawer-header-meta { margin-bottom: 12px; }
.drawer-ctrl-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #ecf5ff;
  border: 1px solid #d9ecff;
  border-radius: 6px;
  margin-bottom: 16px;
}
.drawer-question-list { display: flex; flex-direction: column; gap: 16px; }
.d-q-card { background: #fff; border: 1px solid #ebeef5; border-radius: 6px; padding: 14px 16px; }
.d-q-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.d-q-no { font-weight: 700; font-size: 15px; color: #303133; }
.d-q-score { font-weight: 600; color: #409eff; margin-left: 6px; }
.d-q-stem { font-size: 14px; color: #303133; line-height: 1.6; margin-bottom: 10px; }
.d-passage-box { background: #fdf6ec; border: 1px solid #faecd8; border-radius: 4px; padding: 10px 14px; margin-bottom: 12px; }
.d-passage-box h4 { margin: 0 0 6px; color: #b88230; }
.d-passage-body { font-size: 13px; line-height: 1.6; color: #606266; }
.d-sub-card { padding: 10px 12px; background: #fafafa; border-radius: 4px; margin-bottom: 10px; }
.d-sub-head { font-weight: 600; font-size: 13px; margin-bottom: 6px; }
.d-opts-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.d-opt-item { padding: 6px 10px; background: #f5f7fa; border-radius: 4px; font-size: 13px; color: #606266; }
.d-opt-correct { background: #f0f9eb; color: #67c23a; font-weight: 600; border-left: 3px solid #67c23a; }
.d-ans-box { background: #f0f9eb; border: 1px dashed #67c23a; border-radius: 4px; padding: 8px 12px; margin-top: 8px; font-size: 13px; }
.d-std-ans { margin-bottom: 4px; }
.d-analysis { color: #529b2e; line-height: 1.5; }

/* 学生学情抽屉样式 */
.student-insight-container { padding: 4px 6px; }
.stu-header-box {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  margin-bottom: 16px;
}
.stu-name { font-size: 18px; font-weight: 700; color: #303133; }
.stu-sub { font-size: 13px; color: #909399; margin-top: 4px; }
.insight-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
.in-card {
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  text-align: center;
}
.in-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.in-num { font-size: 20px; font-weight: 700; }
.mastery-list { display: flex; flex-direction: column; gap: 10px; }
.mastery-item {
  padding: 10px 14px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}
.m-head { display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
.m-foot { display: flex; justify-content: space-between; font-size: 12px; color: #909399; margin-top: 6px; }
.trend-list { display: flex; flex-direction: column; gap: 8px; }
.trend-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #fafafa;
  border-radius: 4px;
  font-size: 13px;
}
.t-name { font-weight: 600; color: #303133; }
.t-score { font-weight: 700; }
.t-time { color: #909399; font-size: 12px; }

/* 详情弹窗样式 */
.dialog-header { display: flex; justify-content: space-between; align-items: center; }
.detail-score { font-size: 20px; color: #409eff; }
.answers-heading { margin: 16px 0 10px; font-size: 15px; color: #303133; }
.answers { display: flex; flex-direction: column; gap: 10px; max-height: 420px; overflow-y: auto; }
.answer-item { padding: 12px 14px; border: 1px solid #ebeef5; border-radius: 6px; background: #fff; }
.answer-item.correct { border-left: 4px solid #67c23a; }
.answer-item.incorrect { border-left: 4px solid #f56c6c; }
.answer-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.answer-result { display: flex; align-items: center; gap: 4px; font-weight: 600; }
.answer-item.correct .answer-result { color: #67c23a; }
.answer-item.incorrect .answer-result { color: #f56c6c; }
.answer-stem { font-size: 13px; color: #303133; line-height: 1.5; margin-bottom: 6px; }
.answer-row { display: flex; gap: 8px; font-size: 13px; margin-top: 4px; }
.correct-text { color: #67c23a; }
.incorrect-text { color: #f56c6c; }
</style>
