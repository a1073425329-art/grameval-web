<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  List,
  Grid,
  Plus,
  Search,
  MagicStick,
  Reading,
  Refresh,
  Delete,
  Lightning,
  CircleCheck,
  Warning,
  Download,
  Upload,
  Document,
  View,
  Hide,
  CopyDocument,
  Tickets,
  ArrowDown,
} from '@element-plus/icons-vue'
import {
  listAdminQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  batchDeleteQuestions,
  batchStatusQuestions,
  listCategoryTree,
  listReadingPassages,
  createReadingPassage,
  updateReadingPassage,
  getReadingPassageDetail,
  addPassageQuestion,
  downloadImportTemplate,
  importQuestions,
} from '@/api/admin'
import type { UploadInstance } from 'element-plus'
import { validateQuestion, generateReading } from '@/api/ai'
import type { Question, QuestionOption, QuestionForm } from '@/types/question'
import type { Difficulty, QuestionType } from '@/types/common'
import type { Category } from '@/types/category'
import type { ReadingPassage, ReadingQuestionItem } from '@/types/reading'
import { useViewMode } from '@/composables/useViewMode'
import PassageCard from '@/components/PassageCard.vue'

const { viewMode, toggleViewMode } = useViewMode('question_manage')

const query = reactive({
  keyword: '',
  categoryId: undefined as number | undefined,
  questionType: undefined as QuestionType | undefined,
  difficulty: undefined as Difficulty | undefined,
  status: undefined as number | undefined,
  hasTrap: undefined as boolean | undefined,
  minUsageCount: undefined as number | undefined,
  maxUsageCount: undefined as number | undefined,
  pageNum: 1,
  pageSize: 50,
})

const list = ref<Question[]>([])
const total = ref(0)
const loading = ref(false)
const categories = ref<Category[]>([])
const selected = ref<Question[]>([])

const normalTypeOptions: { label: string; value: QuestionType }[] = [
  { label: '单选题', value: 'SINGLE' },
  { label: '多选题', value: 'MULTIPLE' },
  { label: '判断题', value: 'JUDGE' },
  { label: '填空题', value: 'FILL' },
  { label: '带提示填空题', value: 'FILL_HINT' },
]
const diffOptions: { label: string; value: Difficulty }[] = [
  { label: '简单', value: 1 },
  { label: '中等', value: 2 },
  { label: '困难', value: 3 },
]

/* 题型 Tabs：把原先"题型下拉框"换成顶部页签，切换更直观 */
const typeTabOptions: { label: string; value: string }[] = [
  { label: '全部', value: 'ALL' },
  { label: '单选题', value: 'SINGLE' },
  { label: '多选题', value: 'MULTIPLE' },
  { label: '判断题', value: 'JUDGE' },
  { label: '填空题', value: 'FILL_HINT' },
  { label: '阅读理解', value: 'READING' },
]
const typeTab = ref<string>('ALL')
const onTypeTabChange = (name: string | number) => {
  query.questionType = name === 'ALL' ? undefined : (name as QuestionType)
  search()
}

const allTypeOptions: { label: string; value: QuestionType }[] = [
  ...normalTypeOptions,
  { label: '阅读理解选择题', value: 'READING' },
]

const typeLabel = (t?: QuestionType) =>
  allTypeOptions.find((o) => o.value === t)?.label ?? t
const diffLabel = (d?: Difficulty) =>
  diffOptions.find((o) => o.value === d)?.label ?? String(d)
const diffTagType = (d?: Difficulty) =>
  d === 1 ? 'success' : d === 2 ? 'warning' : 'danger'

/** 来源列：库里取值历史上有中英混杂（MANUAL / 系统 / SEED_READING…），认得的翻成中文，认得的原文兜底 */
const SOURCE_LABELS: Record<string, string> = {
  MANUAL: '人工录入',
  AI: 'AI 生成',
  AI_STUDENT: '学生错题变式',
  IMPORT: '批量导入',
  SEED_READING: '阅读题库',
  系统: '系统内置',
}
const sourceLabel = (s?: string) => {
  if (!s) return '-'
  return SOURCE_LABELS[s] ?? s
}

/** 更新时间只到分钟，列表里够用来判断新旧 */
const fmtDate = (s?: string) => {
  if (!s) return '-'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s.slice(0, 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}`
}

const load = async () => {
  loading.value = true
  try {
    const res = await listAdminQuestions({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      categoryId: query.categoryId,
      questionType: query.questionType,
      difficulty: query.difficulty,
      status: query.status,
      hasTrap: query.hasTrap,
      minUsageCount: query.minUsageCount,
      maxUsageCount: query.maxUsageCount,
    })
    list.value = res.data.records ?? []
    total.value = res.data.total ?? 0
  } finally {
    loading.value = false
  }
}
const search = () => {
  query.pageNum = 1
  load()
}
const reset = () => {
  query.keyword = ''
  query.categoryId = undefined
  query.questionType = undefined
  query.difficulty = undefined
  query.status = undefined
  query.hasTrap = undefined
  query.minUsageCount = undefined
  query.maxUsageCount = undefined
  query.pageNum = 1
  typeTab.value = 'ALL'
  load()
}

/* ============================================================
 *  编辑弹窗
 * ============================================================ */
const dialogVisible = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const formRef = ref<FormInstance>()

/* 当前活动标签页（同时作为当前题型） */
type TabType = QuestionType | 'READING'
const activeTab = ref<TabType>('SINGLE')

/* tab 配置 */
const tabOptions: { label: string; value: TabType }[] = [
  { label: '单选题', value: 'SINGLE' },
  { label: '多选题', value: 'MULTIPLE' },
  { label: '判断题', value: 'JUDGE' },
  { label: '填空题', value: 'FILL' },
  { label: '带提示填空', value: 'FILL_HINT' },
  { label: '阅读理解', value: 'READING' },
]

/* ---------- 普通题型表单 ---------- */
type NormalForm = {
  id: number
  categoryId: number | undefined
  questionType: QuestionType
  difficulty: Difficulty
  stem: string
  options: QuestionOption[]
  defaultScore: number
  status: 0 | 1
  hasTrap: boolean
  trapNote: string
  answerSingle: string
  answerMulti: string[]
  answerJudge: 'TRUE' | 'FALSE' | ''
  answerFill: string
  /** 填空类答案的大小写要求（answer_format），仅 FILL_HINT 有意义 */
  answerFormat: string
  analysis: string
  knowledgePoints: string[]
  fillHint: string
  passageId?: number | undefined
}

const normalForm = reactive<NormalForm>({
  id: 0,
  categoryId: undefined,
  questionType: 'SINGLE',
  difficulty: 2,
  stem: '',
  options: [
    { optionLabel: 'A', optionContent: '', sortNo: 1 },
    { optionLabel: 'B', optionContent: '', sortNo: 2 },
    { optionLabel: 'C', optionContent: '', sortNo: 3 },
    { optionLabel: 'D', optionContent: '', sortNo: 4 },
  ],
  defaultScore: 2.0,
  status: 1,
  hasTrap: false,
  trapNote: '',
  answerSingle: '',
  answerMulti: [],
  answerJudge: '',
  answerFill: '',
  answerFormat: 'CASE_INSENSITIVE',
  analysis: '',
  knowledgePoints: [],
  fillHint: '',
})

const rules = {
  categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }],
  questionType: [{ required: true, message: '请选择题型', trigger: 'change' }],
  difficulty: [{ required: true, message: '请选择难度', trigger: 'change' }],
  stem: [{ required: true, message: '请输入题干', trigger: 'blur' }],
} as FormRules

const resetNormalForm = () => {
  Object.assign(normalForm, {
    id: 0,
    categoryId: undefined,
    questionType: 'SINGLE',
    difficulty: 2,
    stem: '',
    options: [
      { optionLabel: 'A', optionContent: '', sortNo: 1 },
      { optionLabel: 'B', optionContent: '', sortNo: 2 },
      { optionLabel: 'C', optionContent: '', sortNo: 3 },
      { optionLabel: 'D', optionContent: '', sortNo: 4 },
    ],
    defaultScore: 2.0,
    status: 1,
    hasTrap: false,
    trapNote: '',
    answerSingle: '',
    answerMulti: [],
    answerJudge: '',
    answerFill: '',
    answerFormat: 'CASE_INSENSITIVE',
    analysis: '',
    knowledgePoints: [],
    fillHint: '',
    passageId: undefined,
  })
}

const nextLabel = () => {
  const used = new Set(normalForm.options.map((o) => o.optionLabel))
  for (let i = 0; i < 26; i++) {
    const k = String.fromCharCode(65 + i)
    if (!used.has(k)) return k
  }
  return 'Z'
}
const addOption = () => {
  if (normalForm.options.length >= 8) {
    ElMessage.warning('选项最多 8 个')
    return
  }
  normalForm.options.push({
    optionLabel: nextLabel(),
    optionContent: '',
    sortNo: normalForm.options.length + 1,
  })
}
const removeOption = (idx: number) => {
  if (normalForm.options.length <= 2) {
    ElMessage.warning('至少 2 个选项')
    return
  }
  normalForm.options.splice(idx, 1)
  normalForm.options.forEach((o, i) => (o.sortNo = i + 1))
}

/* ---------- 阅读理解表单 ---------- */
/** 阅读子题型：与后端 QuestionSubtype 枚举一致 */
const subtypeOptions: { label: string; value: string }[] = [
  { label: '细节题', value: 'DETAIL' },
  { label: '主旨题', value: 'MAIN_IDEA' },
  { label: '推断题', value: 'INFERENCE' },
  { label: '词义题', value: 'VOCABULARY' },
  { label: '态度题', value: 'ATTITUDE' },
]
const subtypeLabel = (v?: string) =>
  subtypeOptions.find((o) => o.value === v)?.label || ''

/** 历史数据里出现过 READING_DETAIL / MAIN 这类写法，下拉框要先认得才能显示出来 */
const normalizeSubtype = (raw?: string | null): string => {
  if (!raw) return ''
  let s = String(raw).trim().toUpperCase()
  if (s.startsWith('READING_')) s = s.slice('READING_'.length)
  if (s === 'MAIN') s = 'MAIN_IDEA'
  return subtypeOptions.some((o) => o.value === s) ? s : ''
}

/** 给分方式只认 PARTIAL，其余一律按整题给分显示 —— 与后端 resolveScoreType 同口径 */
const normalizeScoreType = (raw?: string | null): 'FULL' | 'PARTIAL' =>
  String(raw ?? '').trim().toUpperCase() === 'PARTIAL' ? 'PARTIAL' : 'FULL'

type ReadingSubQ = {
  /** 已有题的 ID；显式放宽 undefined —— 项目开了 exactOptionalPropertyTypes，复制新建要清空 ID */
  id?: number | undefined
  stem: string
  /** 作答位：单选用一个单选框，多空用复选框 —— 决定答案串里是几个字母 */
  blankMode: 'single' | 'multi'
  picks: string[]
  questionSubtype: string
  /** 给分方式：整题给分 / 逐空给分（只有多空作答位时才有意义） */
  scoreType: 'FULL' | 'PARTIAL'
  status: 0 | 1
  analysis: string
  knowledgePoints: string[]
  options: QuestionOption[]
  defaultScore: number
}

const defaultOptions = (): QuestionOption[] => [
  { optionLabel: 'A', optionContent: '', sortNo: 1 },
  { optionLabel: 'B', optionContent: '', sortNo: 2 },
  { optionLabel: 'C', optionContent: '', sortNo: 3 },
  { optionLabel: 'D', optionContent: '', sortNo: 4 },
]

/** 答案串：多空按字母排序落库，与后端「保存前统一去重排序」保持一致 */
const readingAnswerOf = (q: ReadingSubQ): string => {
  const picked = [...q.picks].sort()
  return q.blankMode === 'single' ? String(picked[0] ?? '') : picked.join(',')
}

/** 英文词数：与后端 estimateWordCount 同口径（按空白切分），让老师边写边看到达标没有 */
const wordCountOf = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).length : 0

const onBlankModeChange = (q: ReadingSubQ) => {
  if (q.blankMode === 'single' && q.picks.length > 1) {
    q.picks = q.picks.slice(0, 1)
  }
  // 退回单个作答位时比例给分没有意义，必须一起清掉，否则界面上看不见却仍在库里存着 PARTIAL
  if (q.blankMode === 'single') {
    q.scoreType = 'FULL'
  }
}

const toReadingSubQ = (q: Question): ReadingSubQ => {
  const picks = (q.standardAnswer || '')
    .toUpperCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    id: q.id,
    stem: q.stem,
    blankMode: picks.length > 1 ? 'multi' : 'single',
    picks,
    questionSubtype: normalizeSubtype(q.questionSubtype),
    scoreType: normalizeScoreType(q.scoreType),
    status: (q.status ?? 1) as 0 | 1,
    analysis: q.analysis || '',
    knowledgePoints: q.knowledgePoints ? [...q.knowledgePoints] : [],
    options: q.options?.length ? q.options.map((o) => ({ ...o })) : defaultOptions(),
    defaultScore: Number(q.defaultScore ?? 2),
  }
}

type ReadingForm = {
  categoryId: number | undefined
  difficulty: Difficulty
  passageMode: 'select' | 'create' // 从库中选 / 临时新建
  selectedPassageId: number | undefined
  passageTitle: string
  passageContent: string
  passageType: string
  topic: string
  summary: string
  source: string
  subQuestions: ReadingSubQ[]
}

const readingForm = reactive<ReadingForm>({
  categoryId: undefined,
  difficulty: 2,
  passageMode: 'select',
  selectedPassageId: undefined,
  passageTitle: '',
  passageContent: '',
  passageType: '',
  topic: '',
  summary: '',
  source: 'TEMP',
  subQuestions: [],
})

const resetReadingForm = () => {
  Object.assign(readingForm, {
    categoryId: undefined,
    difficulty: 2,
    passageMode: 'select',
    selectedPassageId: undefined,
    passageTitle: '',
    passageContent: '',
    passageType: '',
    topic: '',
    summary: '',
    source: 'TEMP',
    subQuestions: [],
  })
}

/* 文章选择器相关 */
const passageSearchKw = ref('')
const passageList = ref<ReadingPassage[]>([])
const passageLoading = ref(false)
const passagePage = 1
const passageTotal = ref(0)

const loadPassages = async () => {
  passageLoading.value = true
  try {
    const res = await listReadingPassages({
      keyword: passageSearchKw.value || undefined,
      difficulty: readingForm.difficulty,
      pageNum: passagePage,
      pageSize: 20,
      status: 1,
    })
    passageList.value = res.data.records ?? []
    passageTotal.value = res.data.total ?? 0
  } finally {
    passageLoading.value = false
  }
}

const selectPassage = (p: ReadingPassage) => {
  readingForm.selectedPassageId = p.id
  readingForm.passageTitle = p.title ?? ''
  readingForm.passageContent = p.content
  readingForm.passageType = p.passageType ?? ''
  readingForm.topic = p.topic ?? ''
  readingForm.summary = p.summary ?? ''
  readingForm.categoryId = p.categoryId
  readingForm.difficulty = p.difficulty
}

/* 子题目管理 */
const addSubQuestion = () => {
  if (readingForm.subQuestions.length >= 10) {
    ElMessage.warning('一篇文章最多 10 道题')
    return
  }
  readingForm.subQuestions.push({
    stem: '',
    blankMode: 'single',
    picks: [],
    questionSubtype: '',
    scoreType: 'FULL',
    status: 1,
    analysis: '',
    knowledgePoints: [],
    options: defaultOptions(),
    defaultScore: 2,
  })
}
const removeSubQuestion = (idx: number) => {
  const q = readingForm.subQuestions[idx]
  if (q?.id) {
    // 已入库的题不做物理删除：论文 L956 的原则是被引用只停用
    q.status = 0
    ElMessage.warning('该题已入库，已就地停用；如需彻底删除请到列表用「删除」')
    return
  }
  readingForm.subQuestions.splice(idx, 1)
}
const addSubOpt = (qIdx: number) => {
  const q = readingForm.subQuestions[qIdx]
  if (!q) return
  if (q.options.length >= 8) {
    ElMessage.warning('最多 8 个选项')
    return
  }
  const used = new Set(q.options.map((o) => o.optionLabel))
  let label = 'A'
  for (let i = 0; i < 26; i++) {
    const k = String.fromCharCode(65 + i)
    if (!used.has(k)) {
      label = k
      break
    }
  }
  q.options.push({ optionLabel: label, optionContent: '', sortNo: q.options.length + 1 })
}
const removeSubOpt = (qIdx: number, oIdx: number) => {
  const q = readingForm.subQuestions[qIdx]
  if (!q) return
  if (q.options.length <= 2) {
    ElMessage.warning('至少 2 个选项')
    return
  }
  q.options.splice(oIdx, 1)
  q.options.forEach((o, i) => (o.sortNo = i + 1))
}

/* AI 生成文章 + 题目 */
const aiGenerating = ref(false)
const aiGenerateReading = async () => {
  if (!readingForm.topic && !readingForm.passageType) {
    ElMessage.warning('请先填写主题或选择文章类型')
    return
  }
  aiGenerating.value = true
  try {
    const res = await generateReading({
      topic: readingForm.topic || undefined,
      passageType: readingForm.passageType || undefined,
      difficulty: readingForm.difficulty || 2,
      questionCount: 5,
    })
    const data = res.data
    readingForm.passageTitle = data.title
    readingForm.passageContent = data.content
    readingForm.summary = data.summary || ''
    readingForm.subQuestions = data.questions.map((q: any): ReadingSubQ => {
      const picks = String(q.standardAnswer || '')
        .toUpperCase()
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
      return {
        stem: q.stem,
        blankMode: picks.length > 1 ? 'multi' : 'single',
        picks,
        questionSubtype: normalizeSubtype(q.questionSubtype),
        scoreType: normalizeScoreType(q.scoreType),
        status: 1,
        analysis: q.analysis || '',
        knowledgePoints: q.knowledgePoints || ['阅读理解'],
        options: (q.options || []).map((o: any, i: number) => ({
          optionLabel: o.optionLabel || String.fromCharCode(65 + i),
          optionContent: o.optionContent,
          sortNo: i + 1,
        })),
        defaultScore: 2,
      }
    })
    readingForm.source = 'AI'
    ElMessage.success('AI 生成成功')
  } catch {
    /* handled by global interceptor */
  } finally {
    aiGenerating.value = false
  }
}

/* AI 验证 */
const validating = ref(false)
const validationResult = ref<{
  isValid: boolean
  confidence: number
  suggestions: string[]
  correctedAnswer?: string
  improvedAnalysis?: string
} | null>(null)

const doValidate = async () => {
  if (!formRef.value || activeTab.value === 'READING') return
  // 将当前 tab 赋值给 questionType
  normalForm.questionType = activeTab.value
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    let standardAnswer: string
    if (activeTab.value === 'MULTIPLE') {
      if (!normalForm.answerMulti.length) return
      standardAnswer = [...normalForm.answerMulti].sort().join(',')
    } else if (activeTab.value === 'JUDGE') {
      if (!normalForm.answerJudge) return
      standardAnswer = normalForm.answerJudge
    } else if (activeTab.value === 'FILL_HINT' || activeTab.value === 'FILL') {
      if (!normalForm.answerFill.trim()) return
      // [2026-10-03 修正] 这里原注释写「按自然大小写保存、强制大写会让答案库显示失真」，
      // 但后端 QuestionService.normalizeAnswer 会按 answer_format 归一化：
      //   · CASE_INSENSITIVE（默认）→ 存大写（与库内既有 4600+ 行一致），判分时两边都转大写，
      //     所以 was reading / WAS READING 都能判对；
      //   · CASE_SENSITIVE（专有名词等必须照抄）→ 原样保留大小写。
      // 前端只负责把管理员输入原样提交，是否大写由上面的下拉决定，不再在注释里假设行为。
      standardAnswer = normalForm.answerFill.trim()
    } else {
      if (!normalForm.answerSingle) return
      standardAnswer = normalForm.answerSingle
    }

    validating.value = true
    validationResult.value = null
    try {
      const res = await validateQuestion({
        questionType: normalForm.questionType,
        stem: normalForm.stem,
        options:
          normalForm.options.length > 0
            ? normalForm.options.map((o) => ({
                optionLabel: o.optionLabel,
                optionContent: o.optionContent,
              }))
            : undefined,
        standardAnswer,
        analysis: normalForm.analysis,
      })
      validationResult.value = res.data
      if (res.data.isValid) {
        ElMessage.success(`AI验证通过，置信度 ${res.data.confidence}%`)
      } else {
        ElMessage.warning('AI验证未通过，请查看建议')
      }
    } catch {
      ElMessage.error('AI验证失败')
    } finally {
      validating.value = false
    }
  })
}

/* ---------- 弹窗打开/关闭 ---------- */
/** 编辑态锁题型：改题型会让历史作答记录失去意义，只能停用后另建（后端同步拒绝） */
const typeLocked = computed(() => editMode.value === 'edit')
const isReadingEdit = computed(
  () => activeTab.value === 'READING' && editMode.value === 'edit'
)
/** 编辑态拦下 tab 切换：题型不能改，切换前先说明为什么改不了 */
const lockTabsIfEditing = () => {
  if (!typeLocked.value) return true
  ElMessage.warning('编辑态不能切换题型，如需换题型请用「复制新建」另存一题')
  return false
}

const dialogTitle = computed(() => {
  if (editMode.value === 'edit') {
    const tabLabel = tabOptions.find((t) => t.value === activeTab.value)?.label || ''
    return `编辑${tabLabel}`
  }
  const tabLabel = tabOptions.find((t) => t.value === activeTab.value)?.label || ''
  return `新增${tabLabel}`
})

const openCreate = (tab: TabType = 'SINGLE') => {
  editMode.value = 'create'
  activeTab.value = tab
  resetNormalForm()
  resetReadingForm()
  validationResult.value = null
  activeSubIndex.value = -1
  if (tab === 'READING') {
    loadPassages()
    // 默认添加 5 道题
    for (let i = 0; i < 5; i++) addSubQuestion()
  }
  dialogVisible.value = true
}

const openEdit = (row: Question) => {
  editMode.value = 'edit'
  resetNormalForm()
  resetReadingForm()
  validationResult.value = null
  activeSubIndex.value = -1

  // 设置活动标签页
  activeTab.value = row.questionType

  if (row.questionType === 'READING') {
    // 阅读题必须用阅读编辑器打开：一道题离不开它的那篇文章
    loadReadingGroup(row)
    return
  }

  normalForm.id = row.id
  normalForm.categoryId = row.categoryId
  normalForm.questionType = row.questionType
  normalForm.difficulty = row.difficulty
  normalForm.stem = row.stem
  normalForm.defaultScore = row.defaultScore ?? 2
  normalForm.status = (row.status ?? 1) as 0 | 1
  normalForm.hasTrap = !!row.hasTrap
  normalForm.trapNote = row.trapNote || ''
  normalForm.analysis = row.analysis || ''
  normalForm.knowledgePoints = row.knowledgePoints || []
  normalForm.options = row.options?.length
    ? row.options.map((o) => ({ ...o }))
    : normalForm.options

  const a = row.standardAnswer || ''
  if (row.questionType === 'MULTIPLE') {
    normalForm.answerMulti = a.split(',').map((s) => s.trim()).filter(Boolean)
  } else if (row.questionType === 'JUDGE') {
    normalForm.answerJudge = (a.toUpperCase() === 'TRUE'
      ? 'TRUE'
      : a.toUpperCase() === 'FALSE'
        ? 'FALSE'
        : '') as 'TRUE' | 'FALSE' | ''
  } else if (row.questionType === 'FILL_HINT' || row.questionType === 'FILL') {
    normalForm.answerFill = a
    normalForm.answerFormat = row.answerFormat || 'CASE_INSENSITIVE'
  } else {
    normalForm.answerSingle = a
  }

  dialogVisible.value = true
}

/* ---------- 阅读题组编辑 ---------- */
const groupLoading = ref(false)
const activeSubIndex = ref(-1)
const groupWordCount = ref(0)
const groupQuestionTotal = ref(0)

/** 按题序加载整组：编辑一道阅读题 = 编辑它所在的那一组 */
const loadReadingGroup = async (row: Question) => {
  if (!row.passageId) {
    ElMessage.error('该题没有绑定文章，请先在文章库里补全关联')
    return
  }
  groupLoading.value = true
  dialogVisible.value = true
  try {
    const res = await getReadingPassageDetail(row.passageId, true)
    const p = res.data
    readingForm.selectedPassageId = p.id
    readingForm.passageTitle = p.title ?? ''
    readingForm.passageContent = p.content ?? ''
    readingForm.passageType = p.passageType ?? ''
    readingForm.topic = p.topic ?? ''
    readingForm.summary = p.summary ?? ''
    readingForm.categoryId = p.categoryId ?? row.categoryId
    readingForm.difficulty = p.difficulty ?? row.difficulty
    readingForm.source = p.source ?? 'MANUAL'
    groupWordCount.value = p.wordCount ?? 0
    const rows = (p.questions ?? []).slice().sort(
      (a, b) =>
        (a.passageQuestionOrder ?? 9999) - (b.passageQuestionOrder ?? 9999) ||
        a.id - b.id
    )
    groupQuestionTotal.value = rows.length
    readingForm.subQuestions = rows.map(toReadingSubQ)
    activeSubIndex.value = readingForm.subQuestions.findIndex((q) => q.id === row.id)
  } catch {
    dialogVisible.value = false
  } finally {
    groupLoading.value = false
  }
}

const readingItemPayload = (q: ReadingSubQ) => ({
  stem: q.stem,
  standardAnswer: readingAnswerOf(q),
  analysis: q.analysis,
  knowledgePoints: q.knowledgePoints,
  options: q.options.map((o, i) => ({
    optionLabel: o.optionLabel,
    optionContent: o.optionContent,
    sortNo: i + 1,
  })),
  defaultScore: q.defaultScore,
  questionSubtype: q.questionSubtype || undefined,
  scoreType: q.scoreType,
})

/** 逐题校验：空题干、选项不足、答案缺失或不足 2 个作答位都在这里挡下 */
const validateReadingRows = (): string | null => {
  const rows = readingForm.subQuestions
  for (let i = 0; i < rows.length; i++) {
    const q = rows[i]!
    const no = `第 ${i + 1} 题`
    if (!q.stem.trim()) return `${no}题干不能为空`
    if (q.options.length < 2) return `${no}至少需要 2 个选项`
    if (q.options.some((o) => !o.optionContent.trim()))
      return `${no}存在空白选项，请补全或删除`
    if (!q.picks.length) return `请选择${no}的正确答案`
    if (q.blankMode === 'multi' && q.picks.length < 2)
      return `${no}是多空题，至少勾选 2 个答案（或改回「单个作答位」）`
  }
  return null
}

/** 保存题组：文章信息一次 PUT，题目按新增/更新分别落库 */
const saveReadingGroup = async () => {
  const pid = readingForm.selectedPassageId
  if (!pid) {
    ElMessage.error('缺少文章 ID，无法保存')
    return
  }
  const err = validateReadingRows()
  if (err) {
    ElMessage.warning(err)
    return
  }
  submittingReading.value = true
  try {
    await updateReadingPassage(pid, {
      categoryId: readingForm.categoryId,
      title: readingForm.passageTitle,
      content: readingForm.passageContent,
      difficulty: readingForm.difficulty,
      passageType: readingForm.passageType || undefined,
      topic: readingForm.topic || undefined,
      summary: readingForm.summary,
    })
    let updated = 0
    let created = 0
    for (const q of readingForm.subQuestions) {
      const item = readingItemPayload(q)
      if (q.id) {
        await updateQuestion(q.id, {
          categoryId: readingForm.categoryId!,
          questionType: 'READING',
          stem: item.stem,
          standardAnswer: item.standardAnswer,
          analysis: item.analysis,
          knowledgePoints: item.knowledgePoints,
          difficulty: readingForm.difficulty,
          defaultScore: item.defaultScore,
          status: q.status,
          passageId: pid,
          questionSubtype: item.questionSubtype,
          scoreType: item.scoreType,
          options: item.options,
        })
        updated++
      } else {
        await addPassageQuestion(pid, item as ReadingQuestionItem)
        created++
      }
    }
    ElMessage.success(
      `已保存：更新 ${updated} 道${created ? ` / 新增 ${created} 道` : ''}`
    )
    dialogVisible.value = false
    load()
  } catch {
    /* 拦截器已提示 */
  } finally {
    submittingReading.value = false
  }
}

/* ---------- 提交 ---------- */
const submit = async () => {
  // 阅读理解：编辑态保存整个题组，新增态批量建文+建题
  if (activeTab.value === 'READING') {
    if (editMode.value === 'edit') await saveReadingGroup()
    else await submitReadingBatch()
    return
  }

  const form = formRef.value
  if (!form) return

  // 将当前 tab 赋值给 questionType
  normalForm.questionType = activeTab.value

  await form.validate(async (valid) => {
    if (!valid) return

    let standardAnswer = ''
    if (activeTab.value === 'SINGLE' || activeTab.value === 'READING') {
      if (!normalForm.answerSingle) {
        ElMessage.warning('请选择正确答案')
        return
      }
      standardAnswer = normalForm.answerSingle
    } else if (activeTab.value === 'MULTIPLE') {
      if (!normalForm.answerMulti.length) {
        ElMessage.warning('请选择正确答案')
        return
      }
      if (normalForm.answerMulti.length < 2) {
        ElMessage.warning('多选题至少选择2个答案')
        return
      }
      standardAnswer = [...normalForm.answerMulti].sort().join(',')
    } else if (activeTab.value === 'JUDGE') {
      if (!normalForm.answerJudge) {
        ElMessage.warning('请选择正确答案')
        return
      }
      standardAnswer = normalForm.answerJudge
    } else if (activeTab.value === 'FILL_HINT') {
      if (!normalForm.fillHint.trim()) {
        ElMessage.warning('请输入提示词')
        return
      }
      if (!normalForm.answerFill.trim()) {
        ElMessage.warning('请输入填空答案')
        return
      }
      // 只有「仅单词(WORD_ONLY)」才禁止空格；SENTENCE 允许整句作答。
      // 其余情况下是否含空格由管理员按题目实际需要决定（如 "ARE PLAYING" 这种多词答案）。
      if (normalForm.answerFormat === 'WORD_ONLY' && normalForm.answerFill.trim().includes(' ')) {
        ElMessage.warning('答案格式为「仅单词(WORD_ONLY)」，填空答案不能包含空格')
        return
      }
      standardAnswer = normalForm.answerFill.trim()
    } else if (activeTab.value === 'FILL') {
      if (!normalForm.answerFill.trim()) {
        ElMessage.warning('请输入填空答案')
        return
      }
      if (normalForm.answerFormat === 'WORD_ONLY' && normalForm.answerFill.trim().includes(' ')) {
        ElMessage.warning('答案格式为「仅单词(WORD_ONLY)」，填空答案不能包含空格')
        return
      }
      standardAnswer = normalForm.answerFill.trim()
    }

    const payload: QuestionForm = {
      categoryId: normalForm.categoryId!,
      questionType: normalForm.questionType,
      stem: normalForm.stem,
      standardAnswer,
      // 仅填空类携带该字段；选择题类的答案就是选项标签，后端会统一回落 CASE_INSENSITIVE
      answerFormat:
        activeTab.value === 'FILL_HINT' || activeTab.value === 'FILL'
          ? normalForm.answerFormat
          : undefined,
      analysis: normalForm.analysis,
      knowledgePoints: normalForm.knowledgePoints,
      difficulty: normalForm.difficulty,
      defaultScore: normalForm.defaultScore,
      status: normalForm.status,
      hasTrap: normalForm.hasTrap,
      trapNote: normalForm.trapNote,
      passageId: normalForm.passageId,
      options:
        activeTab.value === 'JUDGE' ||
        activeTab.value === 'FILL_HINT' ||
        activeTab.value === 'FILL'
          ? []
          : normalForm.options.map((o, i) => ({
              optionLabel: o.optionLabel,
              optionContent: o.optionContent,
              sortNo: i + 1,
            })),
    }

    try {
      if (editMode.value === 'create') {
        await createQuestion(payload)
        ElMessage.success('创建成功')
      } else {
        await updateQuestion(normalForm.id, payload)
        ElMessage.success('更新成功')
      }
      dialogVisible.value = false
      load()
    } catch {
      /* handled */
    }
  })
}

/* 阅读理解批量提交：先建文章，再逐个建题目（选已有文章时只追加题目） */
const submittingReading = ref(false)
const submitReadingBatch = async () => {
  if (!readingForm.passageContent.trim()) {
    ElMessage.warning('请输入或选择文章内容')
    return
  }
  if (readingForm.subQuestions.length === 0) {
    ElMessage.warning('请至少添加一道题目')
    return
  }
  const err = validateReadingRows()
  if (err) {
    ElMessage.warning(err)
    return
  }

  submittingReading.value = true
  try {
    let passageId = readingForm.selectedPassageId

    // 如果是新建模式，先创建文章
    if (readingForm.passageMode === 'create' || !passageId) {
      const passageRes = await createReadingPassage({
        categoryId: readingForm.categoryId,
        title: readingForm.passageTitle,
        content: readingForm.passageContent,
        difficulty: readingForm.difficulty,
        passageType: readingForm.passageType || undefined,
        topic: readingForm.topic || undefined,
        source: readingForm.source,
        summary: readingForm.summary,
        status: 1,
        isTemp: readingForm.source === 'TEMP',
        questions: readingForm.subQuestions.map(readingItemPayload),
      })
      passageId = passageRes.data.id
    } else {
      // 使用已有文章，逐个添加题目
      for (const q of readingForm.subQuestions) {
        await addPassageQuestion(passageId, readingItemPayload(q) as ReadingQuestionItem)
      }
    }

    ElMessage.success(
      `创建成功：${readingForm.subQuestions.length} 道阅读理解题`
    )
    dialogVisible.value = false
    load()
  } catch (e) {
    ElMessage.error('创建失败')
  } finally {
    submittingReading.value = false
  }
}

/* ---------- 行操作 & 批量 ---------- */
const confirmDelete = async (row: Question) => {
  try {
    await ElMessageBox.confirm('确认删除该题？被引用则自动软停用。', '删除确认', {
      type: 'warning',
    })
    await deleteQuestion(row.id)
    ElMessage.success('已删除')
    load()
  } catch {
    /* cancelled */
  }
}

/* ---------- 答案显隐 ---------- */
/**
 * 标准答案默认遮起来：列表页常投屏，答案露着会被学生顺手看到；
 * 老师点眼睛才展开，逐题控制而不是整页开关。
 */
const revealedIds = ref<number[]>([])
const isRevealed = (id: number) => revealedIds.value.includes(id)
const toggleReveal = (id: number) => {
  revealedIds.value = isRevealed(id)
    ? revealedIds.value.filter((x) => x !== id)
    : [...revealedIds.value, id]
}
const revealAll = () => {
  revealedIds.value = revealedIds.value.length
    ? []
    : list.value.map((q) => q.id)
}

/**
 * 卡片视图里高亮正确选项 —— 只在答案已展开时高亮，
 * 否则遮罩就白做了（阅读题多空答案形如 "A,C"，逐项比对而不是整串相等）。
 */
const isRightOption = (q: Question, label: string) => {
  if (!isRevealed(q.id)) return false
  const a = (q.standardAnswer || '').toUpperCase()
  if (!a || q.questionType === 'JUDGE' || q.questionType === 'FILL' || q.questionType === 'FILL_HINT') {
    return false
  }
  return a
    .split(',')
    .map((s) => s.trim())
    .includes(label.toUpperCase())
}

/* ---------- 详情抽屉 ---------- */

/** 把题干里的 (提示词) 与 ____ 高亮切分（FILL_HINT 预览用） */
interface StemSeg { text: string; hint?: boolean }
const stemSegments = (stem?: string): StemSeg[] => {
  if (!stem) return []
  const re = /(\([^()]{1,40}\)|_{2,}|\[BLANK\])/g
  const out: StemSeg[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(stem))) {
    if (m.index > last) out.push({ text: stem.slice(last, m.index) })
    out.push({ text: m[0], hint: true })
    last = m.index + m[0].length
  }
  if (last < stem.length) out.push({ text: stem.slice(last) })
  return out
}
const drawerVisible = ref(false)
const detail = ref<Question | null>(null)
const detailPassage = ref<ReadingPassage | null>(null)
const detailLoading = ref(false)

const openDetail = async (row: Question) => {
  detail.value = row
  detailPassage.value = null
  drawerVisible.value = true
  if (!row.passageId) return
  detailLoading.value = true
  try {
    const res = await getReadingPassageDetail(row.passageId, false)
    detailPassage.value = res.data
  } finally {
    detailLoading.value = false
  }
}

/* ---------- 行内启停 ---------- */
const toggleStatus = async (row: Question) => {
  const next: 0 | 1 = row.status === 1 ? 0 : 1
  try {
    await batchStatusQuestions([row.id], next)
    row.status = next
    ElMessage.success(next === 1 ? '已启用' : '已停用')
  } catch {
    /* 拦截器已提示 */
  }
}

/* ---------- 复制新建 ---------- */
/** 题型一旦定下就不能改（改题型会让历史作答失去意义），要换题型只能复制一条新的 */
const openCopy = async (row: Question) => {
  if (row.questionType === 'READING') {
    editMode.value = 'create'
    activeTab.value = 'READING'
    resetNormalForm()
    resetReadingForm()
    validationResult.value = null
    activeSubIndex.value = -1
    const copy = toReadingSubQ(row)
    copy.id = undefined
    readingForm.passageMode = 'select'
    readingForm.selectedPassageId = row.passageId
    readingForm.subQuestions = [copy]
    loadPassages()
    dialogVisible.value = true
    if (row.passageId) {
      const res = await getReadingPassageDetail(row.passageId, false)
      const p = res.data
      Object.assign(readingForm, {
        passageTitle: p.title ?? '',
        passageContent: p.content ?? '',
        passageType: p.passageType ?? '',
        topic: p.topic ?? '',
        summary: p.summary ?? '',
        categoryId: p.categoryId ?? row.categoryId,
        difficulty: p.difficulty ?? row.difficulty,
        source: p.source ?? 'MANUAL',
      })
    }
    ElMessage.info('已复制本题：保存后作为同组新题入库')
    return
  }
  openEdit(row)
  editMode.value = 'create'
  normalForm.id = 0
  ElMessage.info('已复制到新增表单，可换题型后另存为新题')
}

const onRowCommand = (cmd: string, row: Question) => {
  if (cmd === 'copy') void openCopy(row)
  else if (cmd === 'toggle') void toggleStatus(row)
  else if (cmd === 'delete') void confirmDelete(row)
}

const onSelection = (rows: Question[]) => {
  selected.value = rows
}

const batchDelete = async () => {
  if (!selected.value.length) {
    ElMessage.warning('请先选择')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认删除 ${selected.value.length} 道题？`,
      '批量删除',
      { type: 'warning' }
    )
    await batchDeleteQuestions(selected.value.map((r) => r.id))
    ElMessage.success('已删除')
    load()
  } catch {
    /* cancelled */
  }
}

const batchToggle = async (status: 0 | 1) => {
  if (!selected.value.length) {
    ElMessage.warning('请先选择')
    return
  }
  await batchStatusQuestions(selected.value.map((r) => r.id), status)
  ElMessage.success(status === 1 ? '已启用' : '已停用')
  load()
}

/* CSV 导出（前端从当前 list 生成） */
const exporting = ref(false)
const escapeCsv = (val: unknown): string => {
  if (val == null) return ''
  const s = String(val)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
const exportCsv = () => {
  if (!list.value.length) {
    ElMessage.warning('当前列表无数据')
    return
  }
  exporting.value = true
  try {
    const headers = ['ID', '题干', '分类', '题型', '难度', '默认分值', '状态', '引用次数', '陷阱', 'AI生成', '标准答案', '知识点']
    const rows = list.value.map((q) => [
      q.id,
      q.stem,
      q.categoryName ?? '',
      q.questionType,
      q.difficulty,
      q.defaultScore ?? '',
      q.status === 1 ? '启用' : '停用',
      q.usageCount ?? 0,
      q.hasTrap ? '是' : '否',
      q.aiGenerated ? '是' : '否',
      q.standardAnswer ?? '',
      (q.knowledgePoints ?? []).join(';'),
    ].map(escapeCsv).join(','))
    const csv = '\ufeff' + headers.join(',') + '\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=UTF-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `题目数据-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${list.value.length} 条数据`)
  } finally {
    exporting.value = false
  }
}

/* CSV 模板下载 */
const downloadTemplate = async () => {
  try {
    const res = (await downloadImportTemplate()) as unknown as { data: Blob; headers: Record<string, string> }
    const blob = new Blob([res.data], { type: 'text/csv;charset=UTF-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '题目导入模板.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    ElMessage.success('模板已下载')
  } catch {
    ElMessage.error('模板下载失败')
  }
}

/* CSV 导入 */
const importDialogVisible = ref(false)
const importFile = ref<File | null>(null)
const importing = ref(false)
const importResult = ref<{ successCount: number; failedCount: number; errors?: string[] } | null>(null)
const uploadRef = ref<UploadInstance>()

const openImportDialog = () => {
  uploadRef.value?.clearFiles()
  importFile.value = null
  importResult.value = null
  importDialogVisible.value = true
}

const handleFileChange = (file: { raw: File } | File) => {
  importFile.value = ('raw' in file ? file.raw : file) as File
}

const handleImport = async () => {
  if (!importFile.value) {
    ElMessage.warning('请先选择 CSV 文件')
    return
  }
  importing.value = true
  importResult.value = null
  try {
    const res = await importQuestions(importFile.value)
    importResult.value = res.data
    if (res.data.failedCount === 0) {
      ElMessage.success(`成功导入 ${res.data.successCount} 条`)
      importDialogVisible.value = false
      load()
    } else {
      ElMessage.warning(`成功 ${res.data.successCount} 条，失败 ${res.data.failedCount} 条`)
    }
  } catch {
    ElMessage.error('导入失败')
  } finally {
    importing.value = false
  }
}

onMounted(async () => {
  try {
    const c = await listCategoryTree()
    categories.value = c.data ?? []
  } catch {
    /* silent */
  }
  load()
})
</script>

<template>
  <div class="page">
    <!-- 题型切换 Tabs（替代原来的题型下拉框，切换更直观） -->
    <el-tabs
      v-model="typeTab"
      class="type-tabs"
      @tab-change="onTypeTabChange"
    >
      <el-tab-pane
        v-for="t in typeTabOptions"
        :key="t.value"
        :label="t.label"
        :name="t.value"
      />
    </el-tabs>

    <!-- 筛选栏 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-row :gutter="8">
          <el-form-item label="关键词">
            <el-input
              v-model="query.keyword"
              placeholder="题干关键词"
              clearable
              style="width: 180px"
            />
          </el-form-item>
          <el-form-item label="分类">
            <el-cascader
              v-model="query.categoryId"
              :options="categories"
              :props="{
                value: 'id',
                label: 'categoryName',
                children: 'children',
                checkStrictly: true,
                emitPath: false,
              }"
              clearable
              placeholder="选择分类"
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item label="难度">
            <el-select
              v-model="query.difficulty"
              clearable
              placeholder="全部"
              style="width: 100px"
            >
              <el-option
                v-for="op in diffOptions"
                :key="op.value"
                :label="op.label"
                :value="op.value"
              />
            </el-select>
          </el-form-item>
        </el-row>
        <el-row :gutter="8" style="margin-top: 8px">
          <el-form-item label="状态">
            <el-select
              v-model="query.status"
              clearable
              placeholder="全部"
              style="width: 100px"
            >
              <el-option label="启用" :value="1" />
              <el-option label="停用" :value="0" />
            </el-select>
          </el-form-item>
          <el-form-item label="陷阱题">
            <el-select
              v-model="query.hasTrap"
              clearable
              placeholder="全部"
              style="width: 100px"
            >
              <el-option label="是" :value="true" />
              <el-option label="否" :value="false" />
            </el-select>
          </el-form-item>
          <el-form-item label="引用次数">
            <el-input-number
              v-model="query.minUsageCount"
              :min="0"
              placeholder="最低"
              controls-position="right"
              style="width: 100px"
            />
            <span style="margin: 0 4px; color: #909399">~</span>
            <el-input-number
              v-model="query.maxUsageCount"
              :min="0"
              placeholder="最高"
              controls-position="right"
              style="width: 100px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="search">
              <el-icon><Search /></el-icon>查询
            </el-button>
            <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
            <el-button size="small" @click="revealAll">
              <el-icon><Hide v-if="revealedIds.length" /><View v-else /></el-icon>
              {{ revealedIds.length ? '隐藏全部答案' : '显示全部答案' }}
            </el-button>
            <el-button
              @click="toggleViewMode"
              :type="viewMode === 'card' ? 'primary' : 'default'"
              size="small"
            >
              <el-icon><List v-if="viewMode === 'card'" /><Grid v-else /></el-icon>
              {{ viewMode === 'card' ? '表格' : '卡片' }}
            </el-button>
          </el-form-item>
        </el-row>
      </el-form>
    </el-card>

    <!-- 列表区 -->
    <el-card shadow="never" v-loading="loading">
      <div class="toolbar">
        <el-button type="primary" @click="openCreate('SINGLE')">
          <el-icon><Plus /></el-icon>新增试题
        </el-button>
        <el-button
          type="success"
          @click="openCreate('READING')"
          class="reading-btn"
        >
          <el-icon><Reading /></el-icon>新增阅读理解
        </el-button>
        <el-button
          type="success"
          plain
          :disabled="!selected.length"
          @click="batchToggle(1)"
        >
          批量启用
        </el-button>
        <el-button
          type="warning"
          plain
          :disabled="!selected.length"
          @click="batchToggle(0)"
        >
          批量停用
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="!selected.length"
          @click="batchDelete"
        >
          批量删除
        </el-button>
        <el-button :loading="exporting" @click="exportCsv">
          <el-icon><Download /></el-icon>导出 CSV
        </el-button>
        <el-button @click="downloadTemplate">
          <el-icon><Document /></el-icon>下载模板
        </el-button>
        <el-button type="primary" plain @click="openImportDialog">
          <el-icon><Upload /></el-icon>导入 CSV
        </el-button>
      </div>

      <!-- 表格布局 -->
      <el-table
        v-if="viewMode === 'table'"
        :data="list"
        style="width: 100%"
        @selection-change="onSelection"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column type="index" label="#" width="55" />
        <el-table-column label="题干" min-width="230" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="stem-cell">
              <el-tag
                v-if="row.questionType === 'READING' && row.passageId"
                size="small"
                type="warning"
                effect="plain"
                class="group-tag"
              >
                {{ row.passageTitle || '文章#' + row.passageId }}
                ·第{{ row.passageQuestionOrder ?? '?' }}题
              </el-tag>
              {{ row.stem }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          prop="categoryName"
          label="分类"
          width="110"
          show-overflow-tooltip
        />
        <el-table-column label="题型" width="120">
          <template #default="{ row }">
            <el-tag
              v-if="row.questionType === 'READING'"
              type="warning"
              size="small"
              effect="light"
            >
              {{ typeLabel(row.questionType) }}
            </el-tag>
            <span v-else>{{ typeLabel(row.questionType) }}</span>
            <el-tag
              v-if="row.questionSubtype"
              size="small"
              type="info"
              effect="plain"
              class="subtype-tag"
            >
              {{ subtypeLabel(row.questionSubtype) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="分值" width="72" align="center">
          <template #default="{ row }">{{ row.defaultScore ?? 2 }}</template>
        </el-table-column>
        <el-table-column label="标准答案" width="130" align="center">
          <template #default="{ row }">
            <div class="answer-cell">
              <span class="answer-text" :class="{ masked: !isRevealed(row.id) }">
                {{ row.standardAnswer || '-' }}
              </span>
              <el-button
                link
                size="small"
                :title="isRevealed(row.id) ? '隐藏答案' : '显示答案'"
                @click="toggleReveal(row.id)"
              >
                <el-icon><Hide v-if="isRevealed(row.id)" /><View v-else /></el-icon>
              </el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="难度" width="90">
          <template #default="{ row }">
            <el-tag :type="diffTagType(row.difficulty)" size="small">{{
              diffLabel(row.difficulty)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{
              row.status === 1 ? '启用' : '停用'
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="知识点" min-width="150">
          <template #default="{ row }">
            <el-tag
              v-for="tag in (row.knowledgePoints || []).slice(0, 3)"
              :key="tag"
              size="small"
              type="info"
              effect="plain"
              class="kp-tag"
            >
              {{ tag }}
            </el-tag>
            <span v-if="(row.knowledgePoints || []).length > 3" class="kp-more">
              +{{ row.knowledgePoints.length - 3 }}
            </span>
            <span v-if="!(row.knowledgePoints || []).length" class="empty-dash">-</span>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="86" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.aiGenerated" type="primary" size="small" effect="light">AI</el-tag>
            <span v-else class="source-text">{{ sourceLabel(row.source) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建人" width="92" show-overflow-tooltip>
          <template #default="{ row }">{{ row.createByName || '-' }}</template>
        </el-table-column>
        <el-table-column label="更新" width="112" align="center">
          <template #default="{ row }">{{ fmtDate(row.updateTime || row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="引用" width="62" align="center">
          <template #default="{ row }">{{ row.usageCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="陷阱" width="62" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.hasTrap" type="danger" size="small" effect="light">是</el-tag>
            <span v-else style="color: #c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="188" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">
              <el-icon><Tickets /></el-icon>详情
            </el-button>
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-dropdown trigger="click" size="small" @command="(cmd: string) => onRowCommand(cmd, row)">
              <el-button link type="primary" size="small">
                更多<el-icon><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="copy">复制新建</el-dropdown-item>
                  <el-dropdown-item command="toggle">
                    {{ row.status === 1 ? '停用该题' : '启用该题' }}
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" divided>
                    <span class="danger-item">删除/停用</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <!-- 卡片布局 -->
      <div v-else class="question-grid">
        <el-card
          v-for="item in list"
          :key="item.id"
          class="question-card"
          hover
          @click="openEdit(item)"
        >
          <div class="card-header">
            <el-checkbox
              :checked="selected.some((s) => s.id === item.id)"
              @change="(v: unknown) => {
                if (v) selected.push(item)
                else
                  selected = selected.filter(
                    (s: Question) => s.id !== item.id
                  )
              }"
              @click.stop
            />
            <span class="q-id">#{{ item.id }}</span>
            <el-tag :type="item.status === 1 ? 'success' : 'info'" size="small">{{
              item.status === 1 ? '启用' : '停用'
            }}</el-tag>
            <el-tag :type="diffTagType(item.difficulty)" size="small">{{
              diffLabel(item.difficulty)
            }}</el-tag>
            <el-tag
              :type="item.questionType === 'READING' ? 'warning' : 'info'"
              size="small"
            >
              {{ typeLabel(item.questionType) }}
            </el-tag>
          </div>
          <div class="card-stem">{{ item.stem }}</div>
          <div class="card-meta">
            <span class="meta-item">
              <span class="meta-label">分类</span>
              <span class="meta-value">{{ item.categoryName || '-' }}</span>
            </span>
            <span class="meta-item">
              <span class="meta-label">引用</span>
              <span class="meta-value">{{ item.usageCount ?? 0 }} 次</span>
            </span>
            <span class="meta-item">
              <span class="meta-label">分值</span>
              <span class="meta-value">{{ item.defaultScore ?? 2 }} 分</span>
            </span>
            <span class="meta-item">
              <span class="meta-label">来源</span>
              <span class="meta-value">
                {{ item.aiGenerated ? 'AI 生成' : sourceLabel(item.source) }}
              </span>
            </span>
          </div>
          <div class="card-passage" v-if="item.questionType === 'READING' && item.passageTitle">
            <el-tag size="small" type="warning" effect="plain">
              {{ item.passageTitle }} · 第{{ item.passageQuestionOrder ?? '?' }}题
            </el-tag>
          </div>
          <div class="card-options" v-if="item.options?.length">
            <div
              v-for="opt in item.options"
              :key="opt.optionLabel"
              class="opt-item"
              :class="{ 'opt-right': isRightOption(item, opt.optionLabel) }"
            >
              <span class="opt-label">{{ opt.optionLabel }}.</span>
              <span class="opt-content">{{ opt.optionContent }}</span>
            </div>
          </div>
          <div class="card-tags" v-if="item.knowledgePoints?.length">
            <el-tag
              v-for="tag in item.knowledgePoints"
              :key="tag"
              size="small"
              type="info"
            >
              {{ tag }}
            </el-tag>
          </div>
          <div class="card-footer">
            <span class="answer-hint">
              答案：
              <span class="answer-text" :class="{ masked: !isRevealed(item.id) }">
                {{ item.standardAnswer || '-' }}
              </span>
              <el-button link size="small" @click.stop="toggleReveal(item.id)">
                <el-icon><Hide v-if="isRevealed(item.id)" /><View v-else /></el-icon>
              </el-button>
            </span>
            <div class="actions">
              <el-button link type="primary" size="small" @click.stop="openDetail(item)">
                详情
              </el-button>
              <el-button link type="primary" size="small" @click.stop="openEdit(item)">
                编辑
              </el-button>
              <el-button link type="primary" size="small" @click.stop="openCopy(item)">
                <el-icon><CopyDocument /></el-icon>复制
              </el-button>
              <el-button
                link
                :type="item.status === 1 ? 'warning' : 'success'"
                size="small"
                @click.stop="toggleStatus(item)"
              >
                {{ item.status === 1 ? '停用' : '启用' }}
              </el-button>
              <el-button link type="danger" size="small" @click.stop="confirmDelete(item)">
                删除
              </el-button>
            </div>
          </div>
        </el-card>
      </div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[20, 50, 100]"
          @size-change="load"
          @current-change="load"
        />
      </div>
    </el-card>

    <!-- ======================================================
         新增/编辑 弹窗
         ====================================================== -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="860px"
      top="5vh"
      class="question-dialog"
    >
      <!-- 编辑态提示：题型决定作答组件与判分方式，改题型会让历史作答记录失去意义 -->
      <el-alert
        v-if="typeLocked"
        class="type-lock-tip"
        type="info"
        :closable="false"
        show-icon
        title="编辑态已锁定题型"
        :description="
          activeTab === 'READING'
            ? '正在按题组编辑：上方是本组文章，下方是共用这篇文章的全部题目。'
            : '需要改成别的题型时，请关闭本窗口用「复制新建」另存一道，原题可停用。'
        "
      />

      <!-- 题型标签页切换 -->
      <el-tabs
        v-model="activeTab"
        type="card"
        :before-leave="lockTabsIfEditing"
        @tab-change="(tab: TabType) => {
          if (tab === 'READING') loadPassages()
          // 切换题型时初始化选项
          if (tab === 'JUDGE' || tab === 'FILL_HINT' || tab === 'FILL') {
            normalForm.options = []
          } else if (!normalForm.options.length) {
            normalForm.options = [
              { optionLabel: 'A', optionContent: '', sortNo: 1 },
              { optionLabel: 'B', optionContent: '', sortNo: 2 },
              { optionLabel: 'C', optionContent: '', sortNo: 3 },
              { optionLabel: 'D', optionContent: '', sortNo: 4 },
            ]
          }
        }"
      >
        <!-- 单选题 -->
        <el-tab-pane label="单选题" name="SINGLE">
          <el-form ref="formRef" :model="normalForm" :rules="rules" label-width="90px">
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="分类" prop="categoryId">
                  <el-cascader
                    v-model="normalForm.categoryId"
                    :options="categories"
                    :props="{ value: 'id', label: 'categoryName', children: 'children', checkStrictly: true, emitPath: false }"
                    clearable
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="难度" prop="difficulty">
                  <el-select v-model="normalForm.difficulty" style="width: 100%">
                    <el-option v-for="op in diffOptions" :key="op.value" :label="op.label" :value="op.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="默认分值">
                  <el-input-number v-model="normalForm.defaultScore" :min="0.5" :max="100" :step="0.5" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="状态">
              <el-radio-group v-model="normalForm.status">
                <el-radio :value="1">启用</el-radio>
                <el-radio :value="0">停用</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="题干" prop="stem">
              <el-input v-model="normalForm.stem" type="textarea" :rows="3" placeholder="请输入题干" />
            </el-form-item>
            <el-form-item label="选项">
              <div class="opt-list">
                <div v-for="(op, idx) in normalForm.options" :key="idx" class="opt-row">
                  <el-tag class="opt-key">{{ op.optionLabel }}</el-tag>
                  <el-input v-model="op.optionContent" placeholder="选项内容" />
                  <el-button link type="danger" size="small" @click="removeOption(idx)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
                <el-button size="small" @click="addOption"><el-icon><Plus /></el-icon>添加选项</el-button>
              </div>
            </el-form-item>
            <el-form-item label="正确答案">
              <el-radio-group v-model="normalForm.answerSingle">
                <el-radio v-for="op in normalForm.options" :key="op.optionLabel" :value="op.optionLabel">
                  {{ op.optionLabel }}
                </el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="陷阱干扰">
              <el-switch v-model="normalForm.hasTrap" />
              <el-input v-if="normalForm.hasTrap" v-model="normalForm.trapNote" placeholder="陷阱说明（可选）" style="margin-top: 6px" />
            </el-form-item>
            <el-form-item label="解析">
              <el-input v-model="normalForm.analysis" type="textarea" :rows="3" placeholder="题目解析（可选）" />
            </el-form-item>
            <el-form-item label="知识点">
              <el-select v-model="normalForm.knowledgePoints" multiple collapse-tags allow-create filterable placeholder="输入知识点标签后按回车添加" style="width: 100%" />
            </el-form-item>
            <div v-if="validationResult" class="validation-result" :class="{ 'validation-success': validationResult.isValid, 'validation-fail': !validationResult.isValid }">
              <div class="validation-header">
                <el-icon><CircleCheck v-if="validationResult.isValid" /><Warning v-else /></el-icon>
                <span>{{ validationResult.isValid ? 'AI验证通过' : 'AI验证未通过' }}</span>
                <span class="validation-confidence">置信度：{{ validationResult.confidence }}%</span>
              </div>
              <div v-if="validationResult.suggestions?.length" class="validation-suggestions">
                <div class="suggestions-title">💡 修改建议：</div>
                <ul><li v-for="(s, idx) in validationResult.suggestions" :key="idx">{{ s }}</li></ul>
              </div>
              <div v-if="validationResult.correctedAnswer" class="validation-corrected">
                <span>修正答案：</span><span class="corrected-value">{{ validationResult.correctedAnswer }}</span>
              </div>
              <div v-if="validationResult.improvedAnalysis" class="validation-improved">
                <span>优化解析：</span><span class="improved-value">{{ validationResult.improvedAnalysis }}</span>
              </div>
            </div>
          </el-form>
        </el-tab-pane>

        <!-- 多选题 -->
        <el-tab-pane label="多选题" name="MULTIPLE">
          <el-form ref="formRef" :model="normalForm" :rules="rules" label-width="90px">
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="分类" prop="categoryId">
                  <el-cascader
                    v-model="normalForm.categoryId"
                    :options="categories"
                    :props="{ value: 'id', label: 'categoryName', children: 'children', checkStrictly: true, emitPath: false }"
                    clearable
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="难度" prop="difficulty">
                  <el-select v-model="normalForm.difficulty" style="width: 100%">
                    <el-option v-for="op in diffOptions" :key="op.value" :label="op.label" :value="op.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="默认分值">
                  <el-input-number v-model="normalForm.defaultScore" :min="0.5" :max="100" :step="0.5" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="状态">
              <el-radio-group v-model="normalForm.status">
                <el-radio :value="1">启用</el-radio>
                <el-radio :value="0">停用</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="题干" prop="stem">
              <el-input v-model="normalForm.stem" type="textarea" :rows="3" placeholder="请输入题干" />
            </el-form-item>
            <el-form-item label="选项">
              <div class="opt-list">
                <div v-for="(op, idx) in normalForm.options" :key="idx" class="opt-row">
                  <el-tag class="opt-key">{{ op.optionLabel }}</el-tag>
                  <el-input v-model="op.optionContent" placeholder="选项内容" />
                  <el-button link type="danger" size="small" @click="removeOption(idx)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
                <el-button size="small" @click="addOption"><el-icon><Plus /></el-icon>添加选项</el-button>
              </div>
              <span class="fill-hint">提示：多选题至少需要 2 个选项</span>
            </el-form-item>
            <el-form-item label="正确答案">
              <el-checkbox-group v-model="normalForm.answerMulti">
                <el-checkbox v-for="op in normalForm.options" :key="op.optionLabel" :value="op.optionLabel">
                  {{ op.optionLabel }}
                </el-checkbox>
                <span v-if="normalForm.answerMulti.length > 0" class="multi-hint">
                  已选 {{ normalForm.answerMulti.length }} 个答案
                </span>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item label="陷阱干扰">
              <el-switch v-model="normalForm.hasTrap" />
              <el-input v-if="normalForm.hasTrap" v-model="normalForm.trapNote" placeholder="陷阱说明（可选）" style="margin-top: 6px" />
            </el-form-item>
            <el-form-item label="解析">
              <el-input v-model="normalForm.analysis" type="textarea" :rows="3" placeholder="题目解析（可选）" />
            </el-form-item>
            <el-form-item label="知识点">
              <el-select v-model="normalForm.knowledgePoints" multiple collapse-tags allow-create filterable placeholder="输入知识点标签后按回车添加" style="width: 100%" />
            </el-form-item>
            <div v-if="validationResult" class="validation-result" :class="{ 'validation-success': validationResult.isValid, 'validation-fail': !validationResult.isValid }">
              <div class="validation-header">
                <el-icon><CircleCheck v-if="validationResult.isValid" /><Warning v-else /></el-icon>
                <span>{{ validationResult.isValid ? 'AI验证通过' : 'AI验证未通过' }}</span>
                <span class="validation-confidence">置信度：{{ validationResult.confidence }}%</span>
              </div>
              <div v-if="validationResult.suggestions?.length" class="validation-suggestions">
                <div class="suggestions-title">💡 修改建议：</div>
                <ul><li v-for="(s, idx) in validationResult.suggestions" :key="idx">{{ s }}</li></ul>
              </div>
              <div v-if="validationResult.correctedAnswer" class="validation-corrected">
                <span>修正答案：</span><span class="corrected-value">{{ validationResult.correctedAnswer }}</span>
              </div>
              <div v-if="validationResult.improvedAnalysis" class="validation-improved">
                <span>优化解析：</span><span class="improved-value">{{ validationResult.improvedAnalysis }}</span>
              </div>
            </div>
          </el-form>
        </el-tab-pane>

        <!-- 判断题 -->
        <el-tab-pane label="判断题" name="JUDGE">
          <el-form ref="formRef" :model="normalForm" :rules="rules" label-width="90px">
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="分类" prop="categoryId">
                  <el-cascader
                    v-model="normalForm.categoryId"
                    :options="categories"
                    :props="{ value: 'id', label: 'categoryName', children: 'children', checkStrictly: true, emitPath: false }"
                    clearable
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="难度" prop="difficulty">
                  <el-select v-model="normalForm.difficulty" style="width: 100%">
                    <el-option v-for="op in diffOptions" :key="op.value" :label="op.label" :value="op.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="默认分值">
                  <el-input-number v-model="normalForm.defaultScore" :min="0.5" :max="100" :step="0.5" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="状态">
              <el-radio-group v-model="normalForm.status">
                <el-radio :value="1">启用</el-radio>
                <el-radio :value="0">停用</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="题干" prop="stem">
              <el-input v-model="normalForm.stem" type="textarea" :rows="3" placeholder="请输入题干" />
            </el-form-item>
            <el-form-item label="正确答案">
              <el-radio-group v-model="normalForm.answerJudge">
                <el-radio value="TRUE">正确</el-radio>
                <el-radio value="FALSE">错误</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="陷阱干扰">
              <el-switch v-model="normalForm.hasTrap" />
              <el-input v-if="normalForm.hasTrap" v-model="normalForm.trapNote" placeholder="陷阱说明（可选）" style="margin-top: 6px" />
            </el-form-item>
            <el-form-item label="解析">
              <el-input v-model="normalForm.analysis" type="textarea" :rows="3" placeholder="题目解析（可选）" />
            </el-form-item>
            <el-form-item label="知识点">
              <el-select v-model="normalForm.knowledgePoints" multiple collapse-tags allow-create filterable placeholder="输入知识点标签后按回车添加" style="width: 100%" />
            </el-form-item>
            <div v-if="validationResult" class="validation-result" :class="{ 'validation-success': validationResult.isValid, 'validation-fail': !validationResult.isValid }">
              <div class="validation-header">
                <el-icon><CircleCheck v-if="validationResult.isValid" /><Warning v-else /></el-icon>
                <span>{{ validationResult.isValid ? 'AI验证通过' : 'AI验证未通过' }}</span>
                <span class="validation-confidence">置信度：{{ validationResult.confidence }}%</span>
              </div>
              <div v-if="validationResult.suggestions?.length" class="validation-suggestions">
                <div class="suggestions-title">💡 修改建议：</div>
                <ul><li v-for="(s, idx) in validationResult.suggestions" :key="idx">{{ s }}</li></ul>
              </div>
              <div v-if="validationResult.correctedAnswer" class="validation-corrected">
                <span>修正答案：</span><span class="corrected-value">{{ validationResult.correctedAnswer }}</span>
              </div>
              <div v-if="validationResult.improvedAnalysis" class="validation-improved">
                <span>优化解析：</span><span class="improved-value">{{ validationResult.improvedAnalysis }}</span>
              </div>
            </div>
          </el-form>
        </el-tab-pane>

        <!-- 填空题 -->
        <el-tab-pane label="填空题" name="FILL">
          <el-form ref="formRef" :model="normalForm" :rules="rules" label-width="90px">
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="分类" prop="categoryId">
                  <el-cascader
                    v-model="normalForm.categoryId"
                    :options="categories"
                    :props="{ value: 'id', label: 'categoryName', children: 'children', checkStrictly: true, emitPath: false }"
                    clearable
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="难度" prop="difficulty">
                  <el-select v-model="normalForm.difficulty" style="width: 100%">
                    <el-option v-for="op in diffOptions" :key="op.value" :label="op.label" :value="op.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="默认分值">
                  <el-input-number v-model="normalForm.defaultScore" :min="0.5" :max="100" :step="0.5" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="状态">
              <el-radio-group v-model="normalForm.status">
                <el-radio :value="1">启用</el-radio>
                <el-radio :value="0">停用</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="题干" prop="stem">
              <el-input v-model="normalForm.stem" type="textarea" :rows="3" placeholder="请输入题干，使用 [BLANK] 或 __ 表示填空位置" />
            </el-form-item>
            <el-form-item label="填空答案">
              <el-input v-model="normalForm.answerFill" placeholder="填空答案，如 GETS / ARE PLAYING / Paris" />
              <span class="fill-hint">默认忽略大小写判分；选「区分大小写」后学生必须原样输入</span>
            </el-form-item>
            <el-form-item label="答案格式">
              <el-select v-model="normalForm.answerFormat" style="width: 100%">
                <el-option label="忽略大小写（默认，推荐）" value="CASE_INSENSITIVE" />
                <el-option label="区分大小写（专有名词等必须照抄）" value="CASE_SENSITIVE" />
                <el-option label="仅单词（答案不含空格）" value="WORD_ONLY" />
                <el-option label="整句作答（允许空格与标点）" value="SENTENCE" />
              </el-select>
            </el-form-item>
            <el-form-item label="陷阱干扰">
              <el-switch v-model="normalForm.hasTrap" />
              <el-input v-if="normalForm.hasTrap" v-model="normalForm.trapNote" placeholder="陷阱说明（可选）" style="margin-top: 6px" />
            </el-form-item>
            <el-form-item label="解析">
              <el-input v-model="normalForm.analysis" type="textarea" :rows="3" placeholder="题目解析（可选）" />
            </el-form-item>
            <el-form-item label="知识点">
              <el-select v-model="normalForm.knowledgePoints" multiple collapse-tags allow-create filterable placeholder="输入知识点标签后按回车添加" style="width: 100%" />
            </el-form-item>
            <div v-if="validationResult" class="validation-result" :class="{ 'validation-success': validationResult.isValid, 'validation-fail': !validationResult.isValid }">
              <div class="validation-header">
                <el-icon><CircleCheck v-if="validationResult.isValid" /><Warning v-else /></el-icon>
                <span>{{ validationResult.isValid ? 'AI验证通过' : 'AI验证未通过' }}</span>
                <span class="validation-confidence">置信度：{{ validationResult.confidence }}%</span>
              </div>
              <div v-if="validationResult.suggestions?.length" class="validation-suggestions">
                <div class="suggestions-title">💡 修改建议：</div>
                <ul><li v-for="(s, idx) in validationResult.suggestions" :key="idx">{{ s }}</li></ul>
              </div>
              <div v-if="validationResult.correctedAnswer" class="validation-corrected">
                <span>修正答案：</span><span class="corrected-value">{{ validationResult.correctedAnswer }}</span>
              </div>
              <div v-if="validationResult.improvedAnalysis" class="validation-improved">
                <span>优化解析：</span><span class="improved-value">{{ validationResult.improvedAnalysis }}</span>
              </div>
            </div>
          </el-form>
        </el-tab-pane>

        <!-- 带提示填空 -->
        <el-tab-pane label="带提示填空" name="FILL_HINT">
          <el-form ref="formRef" :model="normalForm" :rules="rules" label-width="90px">
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="分类" prop="categoryId">
                  <el-cascader
                    v-model="normalForm.categoryId"
                    :options="categories"
                    :props="{ value: 'id', label: 'categoryName', children: 'children', checkStrictly: true, emitPath: false }"
                    clearable
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="难度" prop="difficulty">
                  <el-select v-model="normalForm.difficulty" style="width: 100%">
                    <el-option v-for="op in diffOptions" :key="op.value" :label="op.label" :value="op.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="默认分值">
                  <el-input-number v-model="normalForm.defaultScore" :min="0.5" :max="100" :step="0.5" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="状态">
              <el-radio-group v-model="normalForm.status">
                <el-radio :value="1">启用</el-radio>
                <el-radio :value="0">停用</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="题干" prop="stem">
              <el-input v-model="normalForm.stem" type="textarea" :rows="3" placeholder="请输入题干，使用 [BLANK] 或 __ 表示填空位置" />
            </el-form-item>
            <el-form-item label="提示词">
              <el-input v-model="normalForm.fillHint" placeholder="括号内的提示词，如：verb, noun, past tense" />
            </el-form-item>
            <el-form-item label="填空答案">
              <el-input v-model="normalForm.answerFill" placeholder="填空答案，如 GETS / ARE PLAYING / Paris" />
              <span class="fill-hint">默认忽略大小写判分；选「区分大小写」后学生必须原样输入</span>
            </el-form-item>
            <el-form-item label="答案格式">
              <el-select v-model="normalForm.answerFormat" style="width: 100%">
                <el-option label="忽略大小写（默认，推荐）" value="CASE_INSENSITIVE" />
                <el-option label="区分大小写（专有名词等必须照抄）" value="CASE_SENSITIVE" />
                <el-option label="仅单词（答案不含空格）" value="WORD_ONLY" />
                <el-option label="整句作答（允许空格与标点）" value="SENTENCE" />
              </el-select>
            </el-form-item>
            <el-form-item label="陷阱干扰">
              <el-switch v-model="normalForm.hasTrap" />
              <el-input v-if="normalForm.hasTrap" v-model="normalForm.trapNote" placeholder="陷阱说明（可选）" style="margin-top: 6px" />
            </el-form-item>
            <el-form-item label="解析">
              <el-input v-model="normalForm.analysis" type="textarea" :rows="3" placeholder="题目解析（可选）" />
            </el-form-item>
            <el-form-item label="知识点">
              <el-select v-model="normalForm.knowledgePoints" multiple collapse-tags allow-create filterable placeholder="输入知识点标签后按回车添加" style="width: 100%" />
            </el-form-item>
            <div v-if="validationResult" class="validation-result" :class="{ 'validation-success': validationResult.isValid, 'validation-fail': !validationResult.isValid }">
              <div class="validation-header">
                <el-icon><CircleCheck v-if="validationResult.isValid" /><Warning v-else /></el-icon>
                <span>{{ validationResult.isValid ? 'AI验证通过' : 'AI验证未通过' }}</span>
                <span class="validation-confidence">置信度：{{ validationResult.confidence }}%</span>
              </div>
              <div v-if="validationResult.suggestions?.length" class="validation-suggestions">
                <div class="suggestions-title">💡 修改建议：</div>
                <ul><li v-for="(s, idx) in validationResult.suggestions" :key="idx">{{ s }}</li></ul>
              </div>
              <div v-if="validationResult.correctedAnswer" class="validation-corrected">
                <span>修正答案：</span><span class="corrected-value">{{ validationResult.correctedAnswer }}</span>
              </div>
              <div v-if="validationResult.improvedAnalysis" class="validation-improved">
                <span>优化解析：</span><span class="improved-value">{{ validationResult.improvedAnalysis }}</span>
              </div>
            </div>
          </el-form>
        </el-tab-pane>

        <!-- 阅读理解 -->
        <el-tab-pane label="阅读理解" name="READING">
          <div class="reading-form" v-loading="groupLoading">
            <el-form label-width="90px">
              <el-row :gutter="12">
                <el-col :span="10">
                  <el-form-item label="分类">
                    <el-cascader
                      v-model="readingForm.categoryId"
                      :options="categories"
                      :props="{ value: 'id', label: 'categoryName', children: 'children', checkStrictly: true, emitPath: false }"
                      clearable
                      style="width: 100%"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="6">
                  <el-form-item label="难度">
                    <el-select v-model="readingForm.difficulty" style="width: 100%">
                      <el-option v-for="op in diffOptions" :key="op.value" :label="op.label" :value="op.value" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="文章">
                    <span v-if="isReadingEdit" class="bound-passage">
                      文章 #{{ readingForm.selectedPassageId }}
                    </span>
                    <el-radio-group v-else v-model="readingForm.passageMode">
                      <el-radio value="select">从库中选择</el-radio>
                      <el-radio value="create">临时创建</el-radio>
                    </el-radio-group>
                  </el-form-item>
                </el-col>
              </el-row>

              <!-- 文章正文：编辑态按题组改，新增态在「临时创建」下填写 -->
              <template v-if="isReadingEdit || readingForm.passageMode === 'create'">
                <el-row :gutter="12">
                  <el-col :span="14">
                    <el-form-item label="标题">
                      <el-input v-model="readingForm.passageTitle" placeholder="文章标题" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="5">
                    <el-form-item label="主题">
                      <el-input v-model="readingForm.topic" placeholder="如：科技" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="5">
                    <el-form-item label="类型">
                      <el-select v-model="readingForm.passageType" clearable placeholder="选择类型" style="width: 100%">
                        <el-option v-for="op in [{ label: '记叙文', value: 'NARRATIVE' }, { label: '说明文', value: 'EXPOSITORY' }, { label: '议论文', value: 'ARGUMENTATIVE' }, { label: '新闻', value: 'NEWS' }, { label: '故事', value: 'STORY' }]" :key="op.value" :label="op.label" :value="op.value" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-form-item label="文章内容">
                  <el-input
                    v-model="readingForm.passageContent"
                    type="textarea"
                    :rows="isReadingEdit ? 5 : 6"
                    placeholder="请输入文章正文"
                  />
                  <span class="fill-hint">
                    英文词数约 {{ wordCountOf(readingForm.passageContent) }} 词
                    <template v-if="isReadingEdit">（原库存 {{ groupWordCount }} 词）</template>
                  </span>
                </el-form-item>
                <el-form-item label="摘要">
                  <el-input v-model="readingForm.summary" type="textarea" :rows="2" placeholder="文章摘要（可选）" />
                </el-form-item>
              </template>

              <!-- 文章库选择 -->
              <div v-if="!isReadingEdit && readingForm.passageMode === 'select'" class="passage-selector">
                <div class="selector-toolbar">
                  <el-input v-model="passageSearchKw" placeholder="搜索文章标题/内容" clearable size="small" style="width: 240px">
                    <template #prefix><Search /></template>
                  </el-input>
                  <el-button size="small" type="primary" @click="loadPassages">搜索</el-button>
                </div>
                <div class="passage-list" v-loading="passageLoading">
                  <div v-for="p in passageList" :key="p.id" class="passage-item" :class="{ selected: readingForm.selectedPassageId === p.id }" @click="selectPassage(p)">
                    <div class="passage-item-title">
                      {{ p.title || '(无标题)' }}
                      <el-tag size="small" type="info" class="passage-tag">{{ diffLabel(p.difficulty) }}</el-tag>
                      <el-tag size="small" class="passage-tag">{{ p.questionCount ?? 0 }} 题</el-tag>
                    </div>
                    <div class="passage-item-content">{{ p.content }}</div>
                  </div>
                  <el-empty v-if="!passageList.length && !passageLoading" description="暂无文章" />
                </div>
                <div v-if="readingForm.passageContent" class="passage-preview">
                  <div class="preview-title">{{ readingForm.passageTitle || '(无标题)' }}</div>
                  <div class="preview-body">{{ readingForm.passageContent }}</div>
                </div>
              </div>

              <!-- 临时创建的入库方式与 AI 生成 -->
              <template v-if="!isReadingEdit && readingForm.passageMode === 'create'">
                <el-form-item label="入库方式">
                  <el-radio-group v-model="readingForm.source">
                    <el-radio value="TEMP">仅临时出题（不入库）</el-radio>
                    <el-radio value="MANUAL">存入文章库</el-radio>
                    <el-radio value="AI">AI 生成</el-radio>
                  </el-radio-group>
                </el-form-item>
                <div class="ai-btn-row">
                  <el-button type="primary" :loading="aiGenerating" @click="aiGenerateReading">
                    <el-icon><MagicStick /></el-icon>AI 生成文章 + 5 道题
                  </el-button>
                </div>
              </template>

              <!-- 题目列表 -->
              <el-divider content-position="left">
                <span class="divider-title">
                  📝 {{ isReadingEdit ? '本组题目' : '题目列表' }}（{{ readingForm.subQuestions.length }} 道）
                </span>
                <span v-if="isReadingEdit" class="divider-sub">
                  共用这篇文章的题都在下方，改动会逐题保存
                </span>
              </el-divider>

              <div class="sub-questions">
                <div class="sq-toolbar">
                  <el-button size="small" type="primary" plain @click="addSubQuestion">
                    <el-icon><Plus /></el-icon>{{ isReadingEdit ? '给本组加一题' : '添加题目' }}
                  </el-button>
                  <span class="sq-hint">提示：阅读理解通常一篇文章配 3-5 道选择题</span>
                </div>

                <div
                  v-for="(q, qIdx) in readingForm.subQuestions"
                  :key="q.id ?? `new-${qIdx}`"
                  class="sub-q-card"
                  :class="{ 'is-active': qIdx === activeSubIndex, 'is-off': q.status === 0 }"
                >
                  <div class="sub-q-header">
                    <span class="sub-q-num">
                      第 {{ qIdx + 1 }} 题
                      <el-tag v-if="q.id" size="small" type="info" effect="plain">#{{ q.id }}</el-tag>
                      <el-tag v-else size="small" type="success" effect="plain">新增</el-tag>
                    </span>
                    <div class="sub-q-actions">
                      <el-select
                        v-model="q.questionSubtype"
                        size="small"
                        clearable
                        placeholder="子题型"
                        style="width: 104px"
                      >
                        <el-option v-for="st in subtypeOptions" :key="st.value" :label="st.label" :value="st.value" />
                      </el-select>
                      <el-select
                        v-model="q.blankMode"
                        size="small"
                        style="width: 118px"
                        @change="onBlankModeChange(q)"
                      >
                        <el-option label="单个作答位" value="single" />
                        <el-option label="多空（复选）" value="multi" />
                      </el-select>
                      <el-select
                        v-if="q.blankMode === 'multi'"
                        v-model="q.scoreType"
                        size="small"
                        style="width: 108px"
                        title="整题给分＝全选对才得分；逐空给分＝按答对的空数比例给分"
                      >
                        <el-option label="整题给分" value="FULL" />
                        <el-option label="逐空给分" value="PARTIAL" />
                      </el-select>
                      <el-input-number v-model="q.defaultScore" :min="0.5" :max="20" :step="0.5" size="small" />
                      <span style="margin-left: 4px">分</span>
                      <el-switch
                        v-if="q.id"
                        v-model="q.status"
                        :active-value="1"
                        :inactive-value="0"
                        size="small"
                        active-text="启用"
                        inline-prompt
                        style="margin: 0 6px"
                      />
                      <el-button link type="danger" size="small" @click="removeSubQuestion(qIdx)">
                        {{ q.id ? '停用' : '移除' }}
                      </el-button>
                    </div>
                  </div>
                  <el-form-item label="题干" :label-width="60">
                    <el-input v-model="q.stem" placeholder="题目题干" />
                  </el-form-item>
                  <el-form-item label="选项" :label-width="60">
                    <div class="sub-opts-grid">
                      <div v-for="(opt, oIdx) in q.options" :key="oIdx" class="sub-opt-row">
                        <el-tag class="opt-key">{{ opt.optionLabel }}</el-tag>
                        <el-input v-model="opt.optionContent" placeholder="选项内容" size="small" />
                        <el-button link type="danger" size="small" @click="removeSubOpt(qIdx, oIdx)">
                          <el-icon><Delete /></el-icon>
                        </el-button>
                      </div>
                    </div>
                    <el-button size="small" type="primary" link @click="addSubOpt(qIdx)">+ 添加选项</el-button>
                  </el-form-item>
                  <el-form-item label="答案" :label-width="60">
                    <el-radio-group v-if="q.blankMode === 'single'" v-model="q.picks[0]">
                      <el-radio v-for="opt in q.options" :key="opt.optionLabel" :value="opt.optionLabel">
                        {{ opt.optionLabel }}
                      </el-radio>
                    </el-radio-group>
                    <el-checkbox-group v-else v-model="q.picks">
                      <el-checkbox v-for="opt in q.options" :key="opt.optionLabel" :value="opt.optionLabel">
                        {{ opt.optionLabel }}
                      </el-checkbox>
                    </el-checkbox-group>
                    <span class="fill-hint">
                      {{ q.blankMode === 'multi' ? `多空题：已选 ${q.picks.length} 个，落库答案 ${readingAnswerOf(q) || '—'}` : `落库答案 ${readingAnswerOf(q) || '—'}` }}
                    </span>
                  </el-form-item>
                  <el-form-item label="解析" :label-width="60">
                    <el-input v-model="q.analysis" type="textarea" :rows="2" placeholder="答案解析" />
                  </el-form-item>
                  <el-form-item label="知识点" :label-width="60">
                    <el-select v-model="q.knowledgePoints" multiple collapse-tags allow-create filterable placeholder="输入后回车添加" style="width: 100%" />
                  </el-form-item>
                </div>

                <el-empty v-if="readingForm.subQuestions.length === 0" description="暂无题目，点击上方按钮添加" />
              </div>
            </el-form>
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          v-if="activeTab !== 'READING'"
          type="primary"
          @click="doValidate"
          :loading="validating"
        >
          <el-icon><Lightning /></el-icon>AI验证
        </el-button>
        <el-button type="primary" @click="submit" :loading="submittingReading">
          {{ isReadingEdit ? '保存题组' : '保存' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- CSV 导入弹窗 -->
    <!-- ======================================================
         题目详情抽屉：列表里放不下题干全文、解析和文章，这里一次看全
         ====================================================== -->
    <el-drawer v-model="drawerVisible" title="题目详情" size="520px">
      <div v-if="detail" class="detail-box">
        <div class="detail-tags">
          <el-tag size="small" :type="detail.questionType === 'READING' ? 'warning' : 'info'">
            {{ typeLabel(detail.questionType) }}
          </el-tag>
          <el-tag v-if="detail.questionSubtype" size="small" type="info" effect="plain">
            {{ subtypeLabel(detail.questionSubtype) }}
          </el-tag>
          <el-tag :type="diffTagType(detail.difficulty)" size="small">
            {{ diffLabel(detail.difficulty) }}
          </el-tag>
          <el-tag :type="detail.status === 1 ? 'success' : 'info'" size="small">
            {{ detail.status === 1 ? '启用' : '停用' }}
          </el-tag>
          <el-tag v-if="detail.hasTrap" type="danger" size="small" effect="light">陷阱题</el-tag>
          <el-tag v-if="detail.aiGenerated" type="primary" size="small" effect="light">AI</el-tag>
        </div>

        <el-descriptions :column="2" size="small" border class="detail-desc">
          <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
          <el-descriptions-item label="分类">{{ detail.categoryName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="分值">{{ detail.defaultScore ?? 2 }} 分</el-descriptions-item>
          <el-descriptions-item label="被引用">{{ detail.usageCount ?? 0 }} 次</el-descriptions-item>
          <el-descriptions-item label="标准答案">{{ detail.standardAnswer || '-' }}</el-descriptions-item>
          <el-descriptions-item label="作答位">
            {{ detail.multiAnswer ? '多个（复选）' : '单个' }}
          </el-descriptions-item>
          <el-descriptions-item label="来源">{{ sourceLabel(detail.source) }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ detail.createByName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="2">
            {{ fmtDate(detail.createTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间" :span="2">
            {{ fmtDate(detail.updateTime) }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-block">
          <div class="detail-label">题干</div>
          <div class="detail-stem">
            <template v-for="(seg, si) in stemSegments(detail.stem)" :key="si">
              <span v-if="seg.hint" class="stem-hint-mark">{{ seg.text }}</span>
              <template v-else>{{ seg.text }}</template>
            </template>
          </div>
        </div>

        <!-- 填空题：学生视角预览 -->
        <div v-if="detail.questionType === 'FILL_HINT'" class="fill-preview">
          <div class="detail-label">学生视角（填空效果）</div>
          <div class="fill-preview-body">
            <template v-for="(seg, si) in stemSegments(detail.stem)" :key="si">
              <span v-if="seg.hint && seg.text.includes('(')" class="fill-hint-inline">{{ seg.text }}</span>
              <span v-else-if="seg.hint" class="fill-blank-inline">
                <span class="fill-blank-answer">{{ detail.standardAnswer || '?' }}</span>
              </span>
              <template v-else>{{ seg.text }}</template>
            </template>
          </div>
        </div>

        <div class="detail-block" v-if="detail.options?.length">
          <div class="detail-label">选项</div>
          <div
            v-for="opt in detail.options"
            :key="opt.optionLabel"
            class="detail-opt"
            :class="{ 'opt-right': isRightOption(detail, opt.optionLabel) }"
          >
            <span class="opt-label">{{ opt.optionLabel }}.</span>
            <span>{{ opt.optionContent }}</span>
            <el-tag
              v-if="isRightOption(detail, opt.optionLabel)"
              size="small"
              type="success"
              effect="dark"
              class="right-tag"
            >
              正确
            </el-tag>
          </div>
          <div class="detail-hint">
            展开列表答案后（眼睛图标），此处才会标出正确选项
          </div>
        </div>

        <template v-if="detail.hintText">
          <div class="detail-block">
            <div class="detail-label">括号提示</div>
            <div>{{ detail.hintText }}</div>
          </div>
        </template>

        <div class="detail-block" v-if="detail.trapNote">
          <div class="detail-label">陷阱说明</div>
          <div class="trap-note">{{ detail.trapNote }}</div>
        </div>

        <div class="detail-block" v-if="detail.analysis">
          <div class="detail-label">解析</div>
          <div class="detail-analysis">{{ detail.analysis }}</div>
        </div>

        <div class="detail-block" v-if="detail.knowledgePoints?.length">
          <div class="detail-label">知识点</div>
          <div>
            <el-tag
              v-for="tag in detail.knowledgePoints"
              :key="tag"
              size="small"
              type="info"
              class="kp-tag"
            >
              {{ tag }}
            </el-tag>
          </div>
        </div>

        <div class="detail-block" v-if="detail.passageId" v-loading="detailLoading">
          <div class="detail-label">
            阅读理解文章
            <el-tag size="small" type="warning" effect="plain">
              第 {{ detail.passageQuestionOrder ?? '?' }} 题
            </el-tag>
          </div>
          <PassageCard
            :title="detailPassage?.title ?? detail.passageTitle"
            :content="detailPassage?.content ?? detail.passageContent ?? ''"
            :word-count="detailPassage?.wordCount ?? detail.passageWordCount"
            :group-total="detailPassage?.questionCount"
          />
        </div>

        <div class="detail-actions">
          <el-button type="primary" size="small" @click="drawerVisible = false; openEdit(detail)">
            编辑
          </el-button>
          <el-button size="small" @click="drawerVisible = false; openCopy(detail)">
            <el-icon><CopyDocument /></el-icon>复制新建
          </el-button>
          <el-button
            :type="detail.status === 1 ? 'warning' : 'success'"
            size="small"
            @click="toggleStatus(detail)"
          >
            {{ detail.status === 1 ? '停用' : '启用' }}
          </el-button>
        </div>
      </div>
    </el-drawer>

    <el-dialog v-model="importDialogVisible" title="批量导入题目" width="560px">
      <div style="margin-bottom: 12px;">
        <el-button text type="primary" @click="downloadTemplate">
          <el-icon><Document /></el-icon>点击下载 CSV 模板
        </el-button>
      </div>
      <el-upload
        ref="uploadRef"
        :auto-upload="false"
        :limit="1"
        accept=".csv,text/csv"
        :on-change="handleFileChange"
        :on-exceed="() => ElMessage.warning('一次只能上传 1 个文件')"
        drag
      >
        <el-icon class="el-icon--upload"><Upload /></el-icon>
        <div class="el-upload__text">将 CSV 文件拖到此处，或<em>点击选择</em></div>
        <template #tip>
          <div class="el-upload__tip" style="color:#909399">
            仅支持 UTF-8 编码的 CSV 文件，按模板字段填写。
          </div>
        </template>
      </el-upload>

      <div v-if="importResult" style="margin-top: 12px;">
        <el-alert
          :title="`成功 ${importResult.successCount} 条 / 失败 ${importResult.failedCount} 条`"
          :type="importResult.failedCount === 0 ? 'success' : 'warning'"
          :closable="false"
          show-icon
        />
        <div v-if="importResult.errors?.length" style="margin-top: 8px; max-height: 200px; overflow-y: auto;">
          <pre style="background:#fef0f0; padding: 8px; border-radius: 4px; font-size: 12px; color: #f56c6c;">{{ importResult.errors.join('\n') }}</pre>
        </div>
      </div>

      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importing" @click="handleImport">开始导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.filter-card :deep(.el-card__body) {
  padding-bottom: 0;
}
/* 题型 Tabs */
.type-tabs {
  margin-bottom: 12px;
  background: #fff;
  border-radius: 4px;
  padding: 0 16px;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.04);
}
.type-tabs :deep(.el-tabs__header) {
  margin: 0;
}
.type-tabs :deep(.el-tabs__item) {
  font-size: 14px;
  height: 48px;
  line-height: 48px;
}
.type-tabs :deep(.el-tabs__item.is-active) {
  font-weight: 600;
}
.toolbar {
  margin-bottom: 12px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.reading-btn {
  background: linear-gradient(135deg, #67c23a, #85ce61);
  border-color: #67c23a;
}

.opt-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.opt-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.opt-key {
  flex-shrink: 0;
  width: 32px;
  text-align: center;
  font-weight: 600;
}

.question-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 16px;
}

.question-card {
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.q-id {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
}

.card-stem {
  font-size: 14px;
  line-height: 1.6;
  color: #303133;
  margin-bottom: 10px;
  white-space: pre-wrap;
}

.card-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 11px;
  color: #909399;
}

.meta-value {
  font-size: 12px;
  color: #606266;
}

.card-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.opt-item {
  display: flex;
  align-items: flex-start;
  padding: 6px 10px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
}

.opt-label {
  font-weight: 600;
  color: #409eff;
  margin-right: 6px;
  flex-shrink: 0;
}

.opt-content {
  color: #606266;
}

.card-tags {
  margin-bottom: 12px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.answer-hint {
  font-size: 13px;
  color: #67c23a;
  font-weight: 500;
}

.actions {
  display: flex;
  gap: 6px;
}

.multi-hint {
  display: inline-block;
  margin-left: 10px;
  font-size: 12px;
  color: #909399;
}

.fill-hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

/* 弹窗模式切换 */
.question-dialog :deep(.el-dialog__body) {
  max-height: 75vh;
  overflow-y: auto;
  padding-top: 12px;
}

.mode-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 20px;
  border-bottom: 2px solid #ebeef5;
}

.mode-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  cursor: pointer;
  color: #909399;
  font-size: 14px;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;

  &:hover {
    color: #409eff;
  }

  &.active {
    color: #409eff;
    font-weight: 600;
    border-bottom-color: #409eff;
  }
}

/* 阅读理解表单 */
.reading-form {
  .divider-title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  .ai-btn-row {
    margin: 12px 0;
    display: flex;
    justify-content: center;
  }
}

.passage-selector {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  background: #fafafa;

  .selector-toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .passage-list {
    max-height: 280px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .passage-item {
    padding: 10px 12px;
    background: #fff;
    border: 1px solid #ebeef5;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #409eff;
      background: #f0f9ff;
    }

    &.selected {
      border-color: #409eff;
      background: #ecf5ff;
      box-shadow: 0 0 0 1px #409eff;
    }
  }

  .passage-item-title {
    font-weight: 600;
    font-size: 13px;
    color: #303133;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .passage-tag {
    font-weight: normal;
  }

  .passage-item-content {
    font-size: 12px;
    color: #606266;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

.passage-create {
  margin-bottom: 16px;
}

/* 子题目卡片 */
.sub-questions {
  .sq-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .sq-hint {
    font-size: 12px;
    color: #909399;
  }
}

.sub-q-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 12px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, #409eff, #67c23a);
    border-radius: 8px 0 0 8px;
  }
}

.sub-q-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #ebeef5;
}

.sub-q-num {
  font-weight: 600;
  font-size: 14px;
  color: #409eff;
}

.sub-q-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #606266;
}

.sub-opts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  width: 100%;
  margin-bottom: 4px;
}

.sub-opt-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* AI验证结果样式 */
.validation-result {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 8px;
  border-left: 4px solid;

  &.validation-success {
    background: #f0f9ff;
    border-color: #67c23a;
  }

  &.validation-fail {
    background: #fef0f0;
    border-color: #f56c6c;
  }
}

.validation-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 10px;

  .el-icon {
    font-size: 18px;
    color: inherit;
  }
}

.validation-confidence {
  margin-left: auto;
  font-size: 12px;
  font-weight: normal;
  color: #909399;
}

.validation-suggestions {
  margin-bottom: 10px;

  .suggestions-title {
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 6px;
  }

  ul {
    margin: 0;
    padding-left: 20px;

    li {
      font-size: 13px;
      color: #606266;
      margin-bottom: 4px;
    }
  }
}

.validation-corrected,
.validation-improved {
  font-size: 13px;
  margin-bottom: 6px;
  color: #606266;

  .corrected-value,
  .improved-value {
    font-weight: 500;
    color: #409eff;
  }
}

/* ============ 列表新增列 ============ */
.stem-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.group-tag {
  flex-shrink: 0;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtype-tag {
  margin-left: 6px;
}

.answer-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

/* 遮罩用模糊而不是打码字符：列宽固定，展开/收起不抖动 */
.answer-text.masked {
  filter: blur(4.5px);
  user-select: none;
}

.kp-tag {
  margin: 2px 4px 2px 0;
}

.kp-more,
.empty-dash {
  font-size: 12px;
  color: #909399;
}

.source-text {
  font-size: 12px;
  color: #606266;
}

.danger-item {
  color: #f56c6c;
}

.card-passage {
  margin: 6px 0;
}

.opt-item.opt-right {
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
}

/* ============ 阅读题组编辑器 ============ */
.type-lock-tip {
  margin-bottom: 12px;
}

.bound-passage {
  font-size: 13px;
  color: #e6a23c;
  font-weight: 500;
}

.passage-preview {
  margin: 10px 0;
  padding: 10px 14px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  background: #fafcff;
  max-height: 160px;
  overflow-y: auto;

  .preview-title {
    font-weight: 600;
    color: #303133;
    margin-bottom: 6px;
  }

  .preview-body {
    font-size: 13px;
    line-height: 1.8;
    color: #606266;
    white-space: pre-wrap;
  }
}

.divider-sub {
  margin-left: 10px;
  font-size: 12px;
  color: #909399;
  font-weight: normal;
}

.sub-q-card.is-active {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.16);
}

.sub-q-card.is-off {
  opacity: 0.6;
  background: #fafafa;

  &::before {
    background: #c0c4cc;
  }
}

/* ============ 详情抽屉 ============ */
.detail-box {
  padding: 0 4px 12px;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.detail-desc {
  margin-bottom: 14px;
}

.detail-block {
  margin-bottom: 14px;

  .detail-label {
    font-size: 13px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 6px;
  }

  .detail-stem {
    font-size: 14px;
    line-height: 1.8;
    color: #303133;
    white-space: pre-wrap;
  }

  .stem-hint-mark {
    background: #fef0e6;
    color: #b88230;
    padding: 0 4px;
    border-radius: 3px;
    font-weight: 600;
  }

  .fill-preview {
    margin-bottom: 14px;
    padding: 12px 14px;
    background: #f0f7ff;
    border: 1px dashed #b3d8ff;
    border-radius: 6px;

    .fill-preview-body {
      font-size: 15px;
      line-height: 2;
      color: #303133;
    }
    .fill-hint-inline {
      color: #b88230;
      font-size: 12px;
      margin: 0 2px;
    }
    .fill-blank-inline {
      display: inline-block;
      min-width: 70px;
      padding: 0 8px;
      border-bottom: 2px solid #409eff;
      text-align: center;
      margin: 0 2px;
    }
    .fill-blank-answer {
      color: #67c23a;
      font-weight: 700;
    }
  }

  .detail-opt {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 4px;
    background: #f5f7fa;
    font-size: 13px;
    margin-bottom: 4px;

    &.opt-right {
      background: #f0f9eb;
      border: 1px solid #e1f3d8;
    }
  }

  .right-tag {
    margin-left: auto;
  }

  .detail-hint,
  .detail-analysis,
  .trap-note {
    font-size: 12px;
    color: #909399;
    line-height: 1.7;
  }

  .detail-analysis {
    font-size: 13px;
    color: #606266;
    white-space: pre-wrap;
  }

  .trap-note {
    font-size: 13px;
    color: #f56c6c;
  }
}

.detail-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}
</style>
