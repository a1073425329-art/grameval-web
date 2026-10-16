<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getExamQuestions,
  resumeExam,
  saveAnswer,
  submitExam,
} from '@/api/student'
import type { ExamPaperView, ExamQuestion } from '@/types/exam'
import { flattenExamQuestionUnits, type ExamQuestionItem } from '@/utils/questionUnits'
import type { QuestionType } from '@/types/common'
import Countdown from '@/components/Countdown.vue'
import AnswerSheet from '@/components/AnswerSheet.vue'
import PassageCard from '@/components/PassageCard.vue'
import { readingSubtypeLabel } from '@/utils/dict'

import { useExamWebSocket } from '@/composables/useExamWebSocket'

const route = useRoute()
const router = useRouter()

/** URL 里的 examId 是 ExamRecord 的 id（不是 sessionId） */
const examId = Number(route.params.examId)

/**
 * 考试 WebSocket：用于实时心跳 / 时间同步 / 答案保存 / 交卷 / 强制交卷。
 * 连接失败或断线时，下方 saveCurrent / autoSaveAll / doSubmit 会自动回退到 HTTP。
 * 注意：remainingSeconds 由本 composable 提供，onTick 会写入它，
 *      WebSocket heartbeat 与 HTTP save-answer 共用同一个值。
 */
const {
  connected: wsConnected,
  status: wsStatus,
  serverTime: wsServerTime,
  remainingSeconds,
  connect: wsConnect,
  disconnect: wsDisconnect,
  sendAnswer: wsSendAnswer,
  submit: wsSubmit,
  onForceSubmit: onWsForceSubmit,
} = useExamWebSocket()

const paperView = ref<ExamPaperView | null>(null)
const questions = computed(() => flattenExamQuestionUnits(paperView.value?.questions ?? []))
const loading = ref(true)
const submitting = ref(false)
const submitted = ref(false)

/** 当前题号 1-based */
const currentIdx = ref(1)
const current = computed<ExamQuestionItem | undefined>(() => questions.value[currentIdx.value - 1])

/** 学生答案 map，key = questionId（值都是 string 或 string[]，提交前 join） */
const answers = reactive<Record<number, string | string[]>>({})

/** 已答集合（1-based idx） */
const answeredIdx = computed(() => {
  const s = new Set<number>()
  questions.value.forEach((q, i) => {
    const a = answers[q.questionId]
    const has = a !== undefined && a !== '' && !(Array.isArray(a) && !a.length)
    if (has) s.add(i + 1)
  })
  return s
})

const hasAnswer = (qid: number) => {
  const a = answers[qid]
  return a !== undefined && a !== '' && !(Array.isArray(a) && !a.length)
}

/** 后端返回的 deadline（ISO 字符串），直接转时间戳给 Countdown */
const deadlineTs = computed(() => {
  if (!paperView.value?.deadline) return 0
  return Date.parse(paperView.value.deadline)
})

/** 剩余秒数（用于 save-answer 上报）—— 已改用 useExamWebSocket 提供的 remainingSeconds */
// const remainingSeconds = ref(0)

/* ---------------- 加载 ---------------- */
/**
 * 需要多个作答位的题：多选，以及多空阅读题（标准答案形如 "A,C,D"）。
 * 阅读题的 question_type 仍是 READING，作答组件由答案形态决定，否则会拿单选框去答多选答案。
 */
const isMultiAnswer = (q: ExamQuestion) =>
  q.questionType === 'MULTIPLE' || (q.questionType === 'READING' && q.multiAnswer === true)

/**
 * 需要「文本作答」的题：填空题，或**没有选项**的题（如阅读的摘要填空 SUMMARY_CLOZE、
 * 句子补全 SENTENCE_COMPLETION，答案是单词/短语，形如 (run)→running）。
 * 这类题的 question_type 可能仍是 READING，若只按题型渲染会拿到空的单选组、无法作答，
 * 因此渲染以「答案形态」为准：无选项 → 文本框。
 */
const isTextAnswer = (q: ExamQuestion) =>
  q.questionType !== 'JUDGE' &&
  (q.questionType === 'FILL_HINT' || (q.options?.length ?? 0) === 0)

/**
 * 左侧连续试卷结构：阅读理解「整篇短文 + 全部子题」成块展示，不拆成一题一屏。
 * 右侧题号只做锚点跳转 + 高亮。
 */
interface PaperQRef {
  q: ExamQuestionItem
  /** 1-based 全卷题号 */
  index: number
}
interface ReadingBlock {
  kind: 'reading'
  key: string
  passageId: number
  title?: string | undefined
  content: string
  wordCount?: number | undefined
  groupScore?: number | undefined
  items: PaperQRef[]
}
interface SingleBlock {
  kind: 'single'
  key: string
  item: PaperQRef
}
type PaperBlock = ReadingBlock | SingleBlock

const paperBlocks = computed<PaperBlock[]>(() => {
  const blocks: PaperBlock[] = []
  const readingMap = new Map<number, ReadingBlock>()
  questions.value.forEach((q, i) => {
    const ref: PaperQRef = { q, index: i + 1 }
    const pid = q.passageId
    if (pid != null) {
      let block = readingMap.get(pid)
      if (!block) {
        block = {
          kind: 'reading',
          key: `r-${pid}`,
          passageId: pid,
          title: q.passageTitle,
          content: q.passageContent ?? '',
          wordCount: q.passageWordCount,
          groupScore: q.readingGroupScore,
          items: [],
        }
        readingMap.set(pid, block)
        blocks.push(block)
      }
      block.items.push(ref)
      return
    }
    blocks.push({ kind: 'single', key: `q-${ref.index}`, item: ref })
  })
  return blocks
})

/** 去掉阅读卡的组内第 X 题角标——整组一起展示时不需要 */
const passageWordCountOf = (content: string, declared?: number) => {
  const real = content.trim() ? content.trim().split(/\s+/).length : 0
  // word_count 有的库写成字符数，优先用正文实测词数
  return real || declared || 0
}

/** 当前题所属的阅读整组（文章 + 全部子题）；普通题为 null */
const currentReadingBlock = computed<ReadingBlock | null>(() => {
  const pid = current.value?.passageId
  if (pid == null) return null
  return (
    paperBlocks.value.find((b): b is ReadingBlock => b.kind === 'reading' && b.passageId === pid) ?? null
  )
})

const buildAnswerFrom = (q: ExamQuestion) => {
  const v = q.userAnswer
  if (v === undefined || v === null || v === '') {
    return isMultiAnswer(q) ? [] : ''
  }
  if (isMultiAnswer(q)) {
    return v.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return v
}

const applyPaperView = (view: ExamPaperView) => {
  paperView.value = view
  questions.value
    .slice()
    .sort((a, b) => (a.questionOrder ?? 0) - (b.questionOrder ?? 0))
    .forEach((q) => {
      answers[q.questionId] = buildAnswerFrom(q)
    })
  remainingSeconds.value = view.remainingSeconds ?? 0
  currentIdx.value = Math.max(1, Math.min(currentIdx.value, questions.value.length))
}

const load = async () => {
  loading.value = true
  try {
    const res = await getExamQuestions(examId)
    applyPaperView(res.data)
    if (res.data.resumeCount && res.data.resumeCount > 0) {
      ElMessage.info(`已恢复上次进度（第 ${res.data.resumeCount + 1} 次进入）`)
    }
  } catch {
    ElMessage.error('试卷加载失败')
    router.replace('/student/exams')
  } finally {
    loading.value = false
  }
}

/** 手动断点续考（比 GET /questions 更准，同时会累加 resumeCount） */
const doResume = async () => {
  try {
    const res = await resumeExam(examId)
    // [2026-10-16 防御] 已交卷/记录异常时后端可能返回 data:null，旧代码直接解构会抛异常且静默
    if (!res.data || !Array.isArray(res.data.questions)) {
      ElMessage.warning('该考试已交卷或无可续考内容，即将跳转成绩页')
      router.replace('/student/results')
      return
    }
    applyPaperView(res.data)
    ElMessage.success('已续考')
  } catch { /* handled */ }
}

/* ---------------- 格式化答案 ---------------- */
const formatAnswer = (_t: QuestionType, v: string | string[] | undefined): string => {
  if (v === undefined || v === null) return ''
  if (Array.isArray(v)) return [...v].sort().join(',')
  return String(v).trim()
}

/* ---------------- 单题保存 ---------------- */
let saveTimer: number | null = null
const saveQuestion = async (q?: ExamQuestionItem) => {
  if (!q?.questionId) return
  const a = answers[q.questionId]
  const formatted = formatAnswer(q.questionType, a)
  if (!formatted) return
  // 优先走 WebSocket（实时保存，后端回 save-ack）；断线时回退 HTTP
  if (wsConnected.value) {
    wsSendAnswer(q.questionId, formatted, remainingSeconds.value)
    flashSaved() // 新增：答案暂存视觉反馈
    return
  }
  try {
    await saveAnswer(examId, {
      questionId: q.questionId,
      userAnswer: formatted,
      remainingSeconds: remainingSeconds.value,
    })
    flashSaved() // 新增：答案暂存视觉反馈
  } catch { /* silent */ }
}
const saveCurrent = () => saveQuestion(current.value)

/** 30s 自动保存所有变更题 */
const autoSaveAll = async () => {
  const jobs = questions.value
    .filter((q) => hasAnswer(q.questionId))
    .map((q) => {
      const formatted = formatAnswer(q.questionType, answers[q.questionId])
      // WebSocket 连接时批量走 WS（每题一条 save-answer）
      if (wsConnected.value) {
        wsSendAnswer(q.questionId, formatted, remainingSeconds.value)
        return Promise.resolve()
      }
      return saveAnswer(examId, {
        questionId: q.questionId,
        userAnswer: formatted,
        remainingSeconds: remainingSeconds.value,
      }).catch(() => null)
    })
  await Promise.allSettled(jobs)
}

/* ---------------- 交卷 ---------------- */
/**
 * 统一交卷流程：先保存全部答案，再交卷，最后跳转结果页。
 * - WebSocket 已连接：用 wsSubmit 等待 submit-result（实时结果）
 * - 否则：回退 HTTP submitExam
 * 跳转使用 examId（即 ExamRecord 主键，与 HTTP 返回的 res.data.id 一致）。
 */
const doSubmit = async () => {
  if (submitted.value) return
  submitting.value = true
  try {
    await autoSaveAll()
    if (wsConnected.value) {
      await wsSubmit(remainingSeconds.value)
    } else {
      await submitExam(examId)
    }
    submitted.value = true
    ElMessage.success('交卷成功')
    // resultId：后端把 examRecordId 作为主键，同时 result 明细也用它
    router.replace(`/student/results/${examId}`)
  } catch { /* handled */ } finally {
    submitting.value = false
  }
}

const handleSubmit = () => {
  // [原实现保留] 使用 ElMessageBox.confirm 弹出简单确认：
  // const unanswered = questions.value.length - answeredIdx.value.size
  // const tip = unanswered > 0
  //   ? `还有 ${unanswered} 题未作答，确认交卷吗？交卷后无法修改。`
  //   : '所有题目均已作答，确认交卷吗？'
  // try {
  //   await ElMessageBox.confirm(tip, '提交试卷', {
  //     confirmButtonText: '交卷',
  //     cancelButtonText: '再检查一下',
  //     type: 'warning',
  //   })
  // } catch { return }
  // await doSubmit()
  // 新增：改为自定义交卷确认对话框，展示未答/标记/用时统计
  openSubmitDialog()
}

/** 倒计时到点 → 自动交卷 */
const handleTimeout = () => {
  if (submitted.value) return
  ElMessage.warning('考试时间已到，系统自动交卷')
  doSubmit()
}

/**
 * 服务器强制交卷（force-submit）→ 触发自动交卷。
 * 与 handleTimeout 区别：reason 来自服务器，且不再走倒计时分支。
 */
const handleForceSubmit = (reason: string) => {
  if (submitted.value) return
  ElMessage.warning(reason || '考试时间已到，系统强制交卷')
  doSubmit()
}

/** 从 Countdown 收剩余毫秒 */
const onTick = (remainMs: number) => {
  remainingSeconds.value = Math.max(0, Math.floor(remainMs / 1000))
}

/* ---------------- 生命周期 ---------------- */
const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
  if (submitted.value) return
  e.preventDefault()
  e.returnValue = ''
}

onMounted(async () => {
  await load()
  // 建立 WebSocket 连接（实时心跳 / 保存 / 交卷）；失败会自动回退 HTTP
  wsConnect(examId)
  // 监听服务器强制交卷
  onWsForceSubmit(handleForceSubmit)
  // 旧的无条件 30s 轮询保存已由 WebSocket 实时保存替代，注释保留（项目约定不删除）：
  // saveTimer = window.setInterval(saveCurrent, 30_000)
  window.addEventListener('beforeunload', beforeUnloadHandler)
})

/**
 * HTTP 兜底轮询：仅当 WebSocket 未连接且未交卷时启动 30s 自动保存，
 * 连接恢复后立即停止。这样实时通道可用时不产生多余轮询。
 */
watch(wsConnected, (isConnected) => {
  if (submitted.value) return
  if (!isConnected) {
    if (saveTimer === null) saveTimer = window.setInterval(saveCurrent, 30_000)
  } else if (saveTimer !== null) {
    clearInterval(saveTimer)
    saveTimer = null
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (saveTimer !== null) clearInterval(saveTimer)
  window.removeEventListener('beforeunload', beforeUnloadHandler)
  // 断开考试 WebSocket（幂等）
  wsDisconnect()
})

onBeforeRouteLeave(async (to) => {
  if (submitted.value || loading.value) return true
  if (to.path.startsWith('/student/results')) return true
  try {
    await ElMessageBox.confirm(
      '确定要离开考试？未交卷的答案已自动保存，重新进入可继续作答。',
      '离开确认',
      { confirmButtonText: '离开', cancelButtonText: '继续答题', type: 'warning' }
    )
    return true
  } catch { return false }
})

/* ---------------- 交互 ---------------- */
/** 锚点高亮：点答题卡题号后短暂高亮对应题块 */
const highlightIdx = ref(0)
let highlightTimer: number | null = null

/**
 * 题号锚点：阅读组内滚到子题；普通题直接切到该题。
 * 阅读是「上文章 + 下子题」双栏，文章在独立区域，不会盖住题目。
 */
const jumpTo = (idx: number) => {
  saveCurrent()
  currentIdx.value = idx
  highlightIdx.value = idx
  if (highlightTimer !== null) clearTimeout(highlightTimer)
  highlightTimer = window.setTimeout(() => {
    if (highlightIdx.value === idx) highlightIdx.value = 0
  }, 1800)
  void nextTick(() => {
    const el = document.getElementById(`q-${idx}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}
const goPrev = () => { if (currentIdx.value > 1) jumpTo(currentIdx.value - 1) }
const goNext = () => { if (currentIdx.value < questions.value.length) jumpTo(currentIdx.value + 1) }

let debTimer: number | null = null
const onAnswerChange = (q?: ExamQuestionItem) => {
  if (debTimer !== null) clearTimeout(debTimer)
  const target = q ?? current.value
  debTimer = window.setTimeout(() => saveQuestion(target), 800)
}

const typeLabel = (t: QuestionType) =>
  ({ SINGLE: '单选', MULTIPLE: '多选', JUDGE: '判断', FILL: '填空', FILL_HINT: '填空', READING: '阅读理解' } as Record<QuestionType, string>)[t] || t

/** 默认「中」已加大；答题区留白充足，默认大字更不易疲劳 */
const fontSize = ref<'small' | 'medium' | 'large'>('large')
const fontSizes = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中' },
  { value: 'large', label: '大' },
] as const

const markedSet = reactive(new Set<number>())
const toggleMark = (idx: number = currentIdx.value) => {
  if (!idx) return
  if (markedSet.has(idx)) {
    markedSet.delete(idx)
  } else {
    markedSet.add(idx)
  }
}

const filterType = ref('')
const questionTypes = computed(() => questions.value.map(q => q.questionType))
const handleFilter = (type: string) => {
  filterType.value = type
}

/* ============================================================ *
 *  新增：考试时间警告（倒计时颜色分级）
 *  green > 10min / yellow 5-10min / red < 5min / blinking < 1min
 * ============================================================ */
const countdownStage = computed<'normal' | 'warning' | 'danger' | 'critical'>(() => {
  const s = remainingSeconds.value
  if (s <= 60) return 'critical'   // <1min 闪烁
  if (s < 300) return 'danger'     // <5min 红色
  if (s <= 600) return 'warning'   // 5-10min 黄色
  return 'normal'                  // >10min 绿色
})

/* ============================================================ *
 *  新增：题目导航优化（题型分组 + 完成进度环）
 * ============================================================ */
const answeredProgress = computed(() =>
  questions.value.length ? (answeredIdx.value.size / questions.value.length) * 100 : 0
)
const typeStats = computed(() => {
  const map: Record<string, { total: number; answered: number }> = {}
  questions.value.forEach((q, i) => {
    const t = q.questionType
    if (!map[t]) map[t] = { total: 0, answered: 0 }
    map[t].total++
    if (answeredIdx.value.has(i + 1)) map[t].answered++
  })
  return Object.entries(map).map(([type, s]) => ({
    type, label: typeLabel(type as QuestionType), total: s.total, answered: s.answered,
  }))
})

/* ============================================================ *
 *  新增：答案暂存视觉反馈（绿色对勾动画）
 * ============================================================ */
const savedFlash = ref(false)
let savedFlashTimer: number | null = null
const flashSaved = () => {
  savedFlash.value = true
  if (savedFlashTimer !== null) clearTimeout(savedFlashTimer)
  savedFlashTimer = window.setTimeout(() => { savedFlash.value = false }, 1600)
}

/* ============================================================ *
 *  新增：交卷确认对话框（未答数 / 标记数 / 用时）
 * ============================================================ */
const submitDialogVisible = ref(false)
const submitStats = computed(() => {
  const totalQ = questions.value.length
  const answered = answeredIdx.value.size
  const unanswered = totalQ - answered
  const marked = markedSet.size
  const totalSeconds = (paperView.value?.duration ?? 0) * 60
  const usedSeconds = Math.max(0, totalSeconds - remainingSeconds.value)
  return { totalQ, answered, unanswered, marked, usedSeconds }
})
const usedTimeText = computed(() => {
  const s = submitStats.value.usedSeconds
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m} 分 ${sec} 秒` : `${sec} 秒`
})
const openSubmitDialog = () => { submitDialogVisible.value = true }
const confirmSubmit = () => {
  submitDialogVisible.value = false
  doSubmit()
}
</script>

<template>
  <div class="exam-room" v-loading="loading" :data-font-size="fontSize">
    <!-- 顶栏 -->
    <div class="top-bar">
      <div class="left">
        <el-icon size="18"><EditPen /></el-icon>
        <span class="exam-title">{{ paperView?.sessionName || '考试中' }}</span>
        <el-tag v-if="paperView?.resumeCount" size="small" type="warning">续考 {{ paperView.resumeCount }} 次</el-tag>
      </div>
      <div class="middle">
        <span class="label">
          剩余时间
          <el-tooltip content="倒计时由服务器计算，不可篡改。断网或关闭浏览器后，计时继续。超时自动提交。" placement="bottom" effect="light">
            <el-icon style="cursor:help;color:#909399;font-size:13px"><QuestionFilled /></el-icon>
          </el-tooltip>
        </span>
        <!-- 新增：考试时间警告（颜色分级：绿>10min / 黄5-10min / 红<5min / 闪烁<1min） -->
        <div class="countdown-wrap" :class="countdownStage" v-if="deadlineTs">
          <Countdown
            :deadline="deadlineTs"
            :warn-seconds="60"
            @timeout="handleTimeout"
            @tick="onTick"
          />
        </div>
      </div>
      <div class="right">
        <!-- WebSocket 连接状态指示 -->
        <el-tooltip
          :content="wsConnected
            ? `实时连接已建立，答案实时同步${wsServerTime ? '（服务器时间 ' + wsServerTime + '）' : ''}`
            : wsStatus === 'connecting'
              ? '正在建立实时连接…'
              : '实时连接未建立，使用 HTTP 兜底'"
          placement="bottom"
          effect="light"
        >
          <span class="ws-status" :class="wsStatus">
            <span class="ws-dot"></span>
            <span class="ws-text">{{ wsConnected ? '实时' : wsStatus === 'connecting' ? '连接中' : '离线' }}</span>
          </span>
        </el-tooltip>
        <div class="font-switch">
          <span class="font-label">字号</span>
          <el-radio-group v-model="fontSize" size="small">
            <el-radio v-for="fs in fontSizes" :key="fs.value" :value="fs.value">{{ fs.label }}</el-radio>
          </el-radio-group>
        </div>
        <el-button v-if="paperView?.resumeCount != null" size="small" @click="doResume">
          <el-icon><Refresh /></el-icon>重新同步
        </el-button>
        <el-tooltip content="本系统会检测切屏、复制粘贴等浏览器层面的异常行为。请自觉诚信考试。系统不能检测第二设备（手机）等物理作弊手段。" placement="bottom" effect="light">
          <el-icon style="cursor:help;color:#E6A23C;margin-right:6px"><WarningFilled /></el-icon>
        </el-tooltip>
        <el-button type="danger" :loading="submitting" @click="handleSubmit">
          <el-icon><Finished /></el-icon>提交试卷
        </el-button>
      </div>
    </div>

    <div class="body">
      <!-- 主答题区：普通题一题一屏；阅读理解=上文章+下全部子题（整组） -->
      <div class="main">
        <div class="main-sticky">
          <div class="q-head">
            <span class="q-idx">第 {{ currentIdx }} 题 / 共 {{ questions.length }} 题</span>
            <div class="q-meta">
              <el-button
                size="small"
                :type="markedSet.has(currentIdx) ? 'warning' : 'default'"
                @click="toggleMark()"
                class="mark-btn"
              >
                <el-icon><StarFilled /></el-icon>
                {{ markedSet.has(currentIdx) ? '已标记' : '标记' }}
              </el-button>
              <el-button size="small" :disabled="currentIdx === 1" @click="goPrev">
                <el-icon><ArrowLeft /></el-icon>上一题
              </el-button>
              <el-button size="small" type="primary" :disabled="currentIdx === questions.length" @click="goNext">
                下一题<el-icon><ArrowRight /></el-icon>
              </el-button>
            </div>
          </div>
          <transition name="saved-pop">
            <div v-if="savedFlash" class="saved-flash">
              <el-icon><CircleCheck /></el-icon>
              <span>答案已暂存</span>
            </div>
          </transition>
        </div>

        <!-- 阅读理解：一篇文章 + 本组全部子题，上下分栏（文章不遮题） -->
        <div v-if="currentReadingBlock" class="reading-pane">
          <div class="reading-passage">
            <PassageCard
              :content="currentReadingBlock.content"
              :title="currentReadingBlock.title"
              :word-count="passageWordCountOf(currentReadingBlock.content, currentReadingBlock.wordCount)"
              :group-total="currentReadingBlock.items.length"
              :group-score="currentReadingBlock.groupScore"
            />
          </div>
          <div class="reading-questions">
            <article
              v-for="item in currentReadingBlock.items"
              :id="`q-${item.index}`"
              :key="item.q.questionId"
              class="q-block"
              :class="{ active: currentIdx === item.index, highlighted: highlightIdx === item.index, answered: hasAnswer(item.q.questionId) }"
              @click="currentIdx = item.index"
            >
              <div class="q-block-head">
                <span class="q-no">{{ item.index }}.</span>
                <el-tag v-if="item.q.questionSubtype && readingSubtypeLabel(item.q.questionSubtype)" size="small" type="success" effect="plain">
                  {{ readingSubtypeLabel(item.q.questionSubtype) }}
                </el-tag>
                <el-tag size="small" type="info" effect="plain">{{ item.q.questionScore ?? item.q.readingGroupScore }} 分</el-tag>
                <button type="button" class="mark-mini" :class="{ on: markedSet.has(item.index) }" @click.stop="toggleMark(item.index)">
                  <el-icon><StarFilled /></el-icon>
                </button>
              </div>
              <div class="q-stem">{{ item.q.stem }}</div>

              <div v-if="isTextAnswer(item.q)" class="text-answer">
                <div v-if="item.q.hintText" class="hint-line">
                  <el-tag size="small" type="warning" effect="plain">提示</el-tag>
                  <span>{{ item.q.hintText }}</span>
                </div>
                <el-input
                  v-model="answers[item.q.questionId] as string"
                  :placeholder="item.q.hintText ? '请填入括号内单词的正确形式' : '请输入答案（单词/短语）'"
                  class="answer-input"
                  @change="onAnswerChange(item.q)"
                />
              </div>
              <el-radio-group
                v-else-if="(item.q.questionType === 'SINGLE' || item.q.questionType === 'READING') && !isMultiAnswer(item.q)"
                v-model="answers[item.q.questionId]"
                class="opt-list"
                @change="onAnswerChange(item.q)"
              >
                <el-radio v-for="op in item.q.options" :key="op.optionLabel" :value="op.optionLabel" class="opt-row">
                  <span class="opt-key">{{ op.optionLabel }}.</span> {{ op.optionContent }}
                </el-radio>
              </el-radio-group>
              <el-checkbox-group
                v-else-if="isMultiAnswer(item.q)"
                v-model="answers[item.q.questionId] as string[]"
                class="opt-list"
                @change="onAnswerChange(item.q)"
              >
                <el-checkbox v-for="op in item.q.options" :key="op.optionLabel" :value="op.optionLabel" class="opt-row">
                  <span class="opt-key">{{ op.optionLabel }}.</span> {{ op.optionContent }}
                </el-checkbox>
              </el-checkbox-group>
              <el-radio-group
                v-else-if="item.q.questionType === 'JUDGE'"
                v-model="answers[item.q.questionId]"
                class="opt-list"
                @change="onAnswerChange(item.q)"
              >
                <el-radio value="TRUE" class="opt-row">对</el-radio>
                <el-radio value="FALSE" class="opt-row">错</el-radio>
              </el-radio-group>
            </article>
          </div>
        </div>

        <!-- 普通题：一题一屏（滚动/上下题切换） -->
        <div v-else-if="current" class="single-pane">
          <article
            :id="`q-${currentIdx}`"
            class="q-block standalone"
            :class="{ active: true, highlighted: highlightIdx === currentIdx, answered: hasAnswer(current.questionId) }"
          >
            <div class="q-block-head">
              <span class="q-no">{{ currentIdx }}.</span>
              <el-tag size="small">{{ typeLabel(current.questionType) }}</el-tag>
              <el-tag size="small" type="info" effect="plain">{{ current.questionScore }} 分</el-tag>
            </div>
            <div class="q-stem">{{ current.stem }}</div>

            <div v-if="isTextAnswer(current)" class="text-answer">
              <div v-if="current.hintText" class="hint-line">
                <el-tag size="small" type="warning" effect="plain">提示</el-tag>
                <span>{{ current.hintText }}</span>
              </div>
              <el-input
                v-model="answers[current.questionId] as string"
                :placeholder="current.hintText ? '请填入括号内单词的正确形式' : '请输入答案（单词/短语）'"
                class="answer-input"
                @change="onAnswerChange(current)"
              />
            </div>
            <el-radio-group
              v-else-if="(current.questionType === 'SINGLE' || current.questionType === 'READING') && !isMultiAnswer(current)"
              v-model="answers[current.questionId]"
              class="opt-list"
              @change="onAnswerChange(current)"
            >
              <el-radio v-for="op in current.options" :key="op.optionLabel" :value="op.optionLabel" class="opt-row">
                <span class="opt-key">{{ op.optionLabel }}.</span> {{ op.optionContent }}
              </el-radio>
            </el-radio-group>
            <el-checkbox-group
              v-else-if="isMultiAnswer(current)"
              v-model="answers[current.questionId] as string[]"
              class="opt-list"
              @change="onAnswerChange(current)"
            >
              <el-checkbox v-for="op in current.options" :key="op.optionLabel" :value="op.optionLabel" class="opt-row">
                <span class="opt-key">{{ op.optionLabel }}.</span> {{ op.optionContent }}
              </el-checkbox>
            </el-checkbox-group>
            <el-radio-group
              v-else-if="current.questionType === 'JUDGE'"
              v-model="answers[current.questionId]"
              class="opt-list"
              @change="onAnswerChange(current)"
            >
              <el-radio value="TRUE" class="opt-row">对</el-radio>
              <el-radio value="FALSE" class="opt-row">错</el-radio>
            </el-radio-group>
          </article>
        </div>
      </div>

      <!-- 答题卡 -->
      <div class="sheet">
        <!-- 新增：题目导航优化（完成进度环 + 题型分组统计） -->
        <div class="nav-progress">
          <div class="np-ring">
            <el-progress type="circle" :percentage="answeredProgress" :width="66" :stroke-width="6" color="#409eff">
              <template #default>
                <div class="np-ring-inner">
                  <span class="np-num">{{ answeredIdx.size }}</span>
                  <span class="np-total">/ {{ questions.length }}</span>
                </div>
              </template>
            </el-progress>
          </div>
          <div class="np-types">
            <div v-for="ts in typeStats" :key="ts.type" class="np-type-item">
              <span class="np-type-label">{{ ts.label }}</span>
              <span class="np-type-count" :class="{ done: ts.answered === ts.total && ts.total > 0 }">
                {{ ts.answered }}/{{ ts.total }}
              </span>
            </div>
          </div>
        </div>
        <AnswerSheet
          :total="questions.length"
          :current="currentIdx"
          :answered="Array.from(answeredIdx)"
          :marked="Array.from(markedSet)"
          :filter-type="filterType"
          :question-types="questionTypes"
          @jump="jumpTo"
          @filter="handleFilter"
        />
      </div>
    </div>

    <!-- 新增：交卷确认对话框（未答数 / 标记数 / 用时） -->
    <el-dialog v-model="submitDialogVisible" title="确认交卷" width="420px" :close-on-click-modal="false" align-center>
      <div class="submit-summary">
        <div class="ss-row" :class="{ warn: submitStats.unanswered > 0 }">
          <el-icon><Document /></el-icon>
          <span class="ss-label">未作答</span>
          <span class="ss-value">{{ submitStats.unanswered }} 题</span>
        </div>
        <div class="ss-row" :class="{ warn: submitStats.marked > 0 }">
          <el-icon><StarFilled /></el-icon>
          <span class="ss-label">已标记</span>
          <span class="ss-value">{{ submitStats.marked }} 题</span>
        </div>
        <div class="ss-row">
          <el-icon><CircleCheck /></el-icon>
          <span class="ss-label">已作答</span>
          <span class="ss-value">{{ submitStats.answered }} / {{ submitStats.totalQ }} 题</span>
        </div>
        <div class="ss-row">
          <el-icon><Clock /></el-icon>
          <span class="ss-label">已用时间</span>
          <span class="ss-value">{{ usedTimeText }}</span>
        </div>
      </div>
      <el-alert
        v-if="submitStats.unanswered > 0"
        type="warning"
        :closable="false"
        show-icon
        title="仍有未作答题目，交卷后无法修改"
        style="margin-top:12px"
      />
      <template #footer>
        <el-button @click="submitDialogVisible = false">再检查一下</el-button>
        <el-button type="danger" :loading="submitting" @click="confirmSubmit">
          <el-icon><Finished /></el-icon>确认交卷
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.exam-room {
  height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* 默认「大」：答题区留白足，默认大字降低视疲劳 */
  --exam-font-size: 20px;
  --exam-opt-font-size: 18px;
  --exam-passage-font-size: 18px;
  /* 传给 PassageCard：长文整篇展示，不限死高度 */
  --passage-font-size: var(--exam-passage-font-size);
  --passage-max-height: none;
}

[data-font-size="small"] {
  --exam-font-size: 16px;
  --exam-opt-font-size: 15px;
  --exam-passage-font-size: 15px;
}

[data-font-size="medium"] {
  --exam-font-size: 18px;
  --exam-opt-font-size: 17px;
  --exam-passage-font-size: 17px;
}

[data-font-size="large"] {
  --exam-font-size: 20px;
  --exam-opt-font-size: 18px;
  --exam-passage-font-size: 18px;
}

.top-bar {
  background: #fff;
  border-radius: 6px;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);

  .left { display: flex; align-items: center; gap: 8px; .exam-title { font-size: 16px; font-weight: 600; } }
  .middle { display: flex; align-items: center; gap: 10px; .label { color: #909399; font-size: 13px; } }
  .right { display: flex; align-items: center; gap: 12px; }
  .font-switch { display: flex; align-items: center; gap: 6px; }
  .font-label { font-size: 13px; color: #606266; }
}

/* WebSocket 连接状态指示 */
.ws-status {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; line-height: 1; padding: 5px 10px; border-radius: 11px;
  background: #f5f7fa; color: #909399; cursor: default; user-select: none;
  .ws-dot { width: 6px; height: 6px; border-radius: 50%; background: #c0c4cc; }
  &.open { background: #f0f9eb; color: #67c23a; .ws-dot { background: #67c23a; } }
  &.connecting { background: #fdf6ec; color: #e6a23c; .ws-dot { background: #e6a23c; animation: ws-blink 1s infinite; } }
  &.closed { background: #fef0f0; color: #f56c6c; .ws-dot { background: #f56c6c; } }
}
@keyframes ws-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

.body {
  flex: 1;
  display: flex;
  gap: 12px;
  overflow: hidden;
}

.main {
  flex: 1;
  background: #fff;
  border-radius: 6px;
  padding: 16px 20px 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.main-sticky {
  flex-shrink: 0;
  background: #fff;
  z-index: 2;
}

/** 阅读整组：上栏文章（固定）+ 下栏子题（滚动），互不遮挡 */
.reading-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.reading-passage {
  flex-shrink: 0;
  max-height: 38vh;
  overflow-y: auto;
  padding-right: 4px;
  border-bottom: 1px solid #ebeef5;

  :deep(.passage-box) {
    max-height: none;
    overflow: visible;
    margin-bottom: 0;
    box-shadow: none;
  }
}

.reading-questions {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scroll-behavior: smooth;
  padding: 8px 4px 12px 0;
}

/** 普通题一题一屏 */
.single-pane {
  flex: 1;
  overflow-y: auto;
  padding: 8px 4px 12px 0;
}

.q-block {
  scroll-margin-top: 8px;
  margin: 12px 0 18px;
  padding: 16px 18px;
  border-radius: 10px;
  border: 1.5px solid transparent;
  background: #fafbfc;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  cursor: pointer;

  &.standalone {
    background: #fff;
    border-color: #ebeef5;
    margin-bottom: 22px;
  }

  &.active {
    border-color: #409eff;
    background: #f5f9ff;
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.12);
  }

  &.highlighted {
    animation: q-flash 1.6s ease;
  }

  &.answered {
    border-left: 4px solid #67c23a;
  }
}

@keyframes q-flash {
  0% { background: #ecf5ff; box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.25); }
  100% { background: #f5f9ff; box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.12); }
}

.q-block-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.q-no {
  font-size: var(--exam-font-size);
  font-weight: 700;
  color: #1f2d3d;
}

.mark-mini {
  margin-left: auto;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #c0c4cc;
  display: inline-flex;
  align-items: center;
  padding: 4px;
  border-radius: 6px;

  &:hover { background: #fef0e6; color: #e6a23c; }
  &.on { color: #e6a23c; }
}

.q-head {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 12px; border-bottom: 1px solid #f0f0f0; margin-bottom: 12px;
  .q-idx {
    display: inline-flex; align-items: center; gap: 6px;
    background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
    color: #fff; padding: 6px 14px; border-radius: 20px;
    font-weight: 600; font-size: 15px;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
    transition: all 0.2s;
    &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4); }
  }
  .q-meta { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .mark-btn {
    border-radius: 20px;
    transition: all 0.2s;
    &:hover { transform: translateY(-1px); }
  }
}

/* 阅读理解文章卡样式见 @/components/PassageCard.vue */

.q-subtype { margin-bottom: 8px; }
.q-stem {
  font-size: var(--exam-font-size);
  line-height: 1.85;
  color: #303133;
  margin-bottom: 16px;
  white-space: pre-wrap;
  font-weight: 500;
}
.opt-list { display: flex; flex-direction: column; gap: 12px; width: 100%; }
/* 文本作答（填空 / 无选项阅读题：摘要填空、句子补全等） */
.text-answer { width: 100%; }
.answer-input {
  max-width: 560px;
  margin-top: 8px;
  :deep(.el-input__wrapper) { min-height: 44px; }
  :deep(.el-input__inner) { font-size: var(--exam-opt-font-size); }
}
.hint-line {
  display: inline-flex; align-items: center; gap: 8px;
  margin-top: 4px; padding: 8px 12px;
  background: #fff8e6; border: 1px dashed #f0c36d; border-radius: 6px;
  font-size: 15px; color: #8a6d3b;
}
/* 选项卡片：不要用 display:flex !important 覆盖 el-radio/el-checkbox 根元素，
   那会把内部 __input(圆圈) 与 __label(文字) 挤到同一行，圆圈被压没、点击热区错乱。 */
.opt-row {
  display: flex; align-items: center;
  width: 100%; height: auto; min-height: 52px;
  padding: 14px 18px; margin: 0; border-radius: 8px;
  background: #fff; transition: all 0.18s;
  font-size: var(--exam-opt-font-size);
  border: 1px solid #e4e7ed;
  border-left: 3px solid transparent;
  cursor: pointer;
  &:hover { background: #f5f9ff; border-color: #a3cfff; }
}
.opt-key { font-weight: 700; color: #409eff; margin-right: 8px; font-size: var(--exam-font-size); }
:deep(.el-radio__input), :deep(.el-checkbox__input) { flex-shrink: 0; margin-right: 8px; }
:deep(.el-radio__label), :deep(.el-checkbox__label) {
  display: flex; align-items: center; flex: 1;
  white-space: normal; line-height: 1.7; color: #303133; padding-left: 8px;
  font-size: var(--exam-opt-font-size);
}
:deep(.opt-row.is-checked) {
  background: #ecf5ff;
  border-left-color: #409eff;
  & .opt-key { color: #409eff; }
}

.footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
}

.sheet {
  width: 280px;
  flex-shrink: 0;
  overflow-y: auto;
}

/* 新增：考试时间警告 倒计时颜色分级 */
.countdown-wrap { display: inline-flex; }
.countdown-wrap :deep(.countdown) { transition: color 0.3s; }
.countdown-wrap.normal :deep(.countdown) { color: #67c23a; }
.countdown-wrap.warning :deep(.countdown) { color: #e6a23c; }
.countdown-wrap.danger :deep(.countdown) { color: #f56c6c; }
.countdown-wrap.critical {
  animation: exam-pulse 1s ease-in-out infinite;
}
.countdown-wrap.critical :deep(.countdown) { color: #f56c6c; }
@keyframes exam-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

/* 新增：答案暂存视觉反馈 */
.saved-flash {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 12px;
  padding: 4px 12px;
  background: linear-gradient(135deg, #f0f9eb 0%, #e1f3d8 100%);
  color: #67c23a;
  border: 1px solid #b3e19d;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(103, 194, 58, 0.18);
}
.saved-flash .el-icon { animation: saved-check 0.4s ease; }
@keyframes saved-check {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
.saved-pop-enter-active { transition: all 0.3s ease; }
.saved-pop-leave-active { transition: all 0.3s ease; }
.saved-pop-enter-from, .saved-pop-leave-to { opacity: 0; transform: translateY(-6px) scale(0.9); }

/* 新增：题目导航优化（进度环 + 题型分组） */
.nav-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #f5faff 0%, #ffffff 100%);
  border-radius: 8px;
  border: 1px solid #ecf5ff;
}
.np-ring { flex-shrink: 0; }
.np-ring-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
}
.np-num { font-size: 18px; font-weight: 700; color: #409eff; }
.np-total { font-size: 11px; color: #909399; }
.np-types {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.np-type-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: #fff;
  border-radius: 4px;
  border: 1px solid #ebeef5;
  font-size: 12px;
}
.np-type-label { color: #606266; }
.np-type-count { color: #909399; font-weight: 600; }
.np-type-count.done { color: #67c23a; }

/* 新增：交卷确认对话框 */
.submit-summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ss-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #f5f7fa;
  border-radius: 6px;
  border-left: 3px solid #dcdfe6;
  transition: all 0.2s;
}
.ss-row .el-icon { color: #909399; font-size: 16px; }
.ss-row.warn { border-left-color: #f56c6c; background: #fef0f0; }
.ss-row.warn .el-icon { color: #f56c6c; }
.ss-label { color: #606266; font-size: 14px; }
.ss-value { margin-left: auto; font-weight: 700; color: #303133; }
.ss-row.warn .ss-value { color: #f56c6c; }
</style>
