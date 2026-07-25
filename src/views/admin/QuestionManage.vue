<script setup lang="ts">
import { onMounted, reactive, ref, watch, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  List,
  Grid,
  Plus,
  Search,
  MagicStick,
  Notebook,
  Reading,
  Refresh,
  Delete,
  Lightning,
  CircleCheck,
  Warning,
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
  addPassageQuestion,
} from '@/api/admin'
import { validateQuestion } from '@/api/ai'
import type { Question, QuestionOption, QuestionForm } from '@/types/question'
import type { Difficulty, QuestionType } from '@/types/common'
import type { Category } from '@/types/category'
import type { ReadingPassage, ReadingQuestionItem } from '@/types/reading'
import { useViewMode } from '@/composables/useViewMode'

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
  load()
}

/* ============================================================
 *  编辑弹窗
 * ============================================================ */
const dialogVisible = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const formRef = ref<FormInstance>()

/* 出题模式：普通单题 / 阅读理解组题 */
type ComposeMode = 'normal' | 'reading'
const composeMode = ref<ComposeMode>('normal')

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
  analysis: string
  knowledgePoints: string[]
  fillHint: string
  passageId?: number
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
    analysis: '',
    knowledgePoints: [],
    fillHint: '',
    passageId: undefined,
  })
}

watch(
  () => normalForm.questionType,
  (t) => {
    if (t === 'JUDGE' || t === 'FILL_HINT' || t === 'FILL') {
      normalForm.options = []
    } else if (!normalForm.options.length) {
      normalForm.options = [
        { optionLabel: 'A', optionContent: '', sortNo: 1 },
        { optionLabel: 'B', optionContent: '', sortNo: 2 },
        { optionLabel: 'C', optionContent: '', sortNo: 3 },
        { optionLabel: 'D', optionContent: '', sortNo: 4 },
      ]
    }
  }
)

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
type ReadingSubQ = {
  stem: string
  standardAnswer: string
  analysis: string
  knowledgePoints: string[]
  options: QuestionOption[]
  defaultScore: number
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
    standardAnswer: 'A',
    analysis: '',
    knowledgePoints: [],
    options: [
      { optionLabel: 'A', optionContent: '', sortNo: 1 },
      { optionLabel: 'B', optionContent: '', sortNo: 2 },
      { optionLabel: 'C', optionContent: '', sortNo: 3 },
      { optionLabel: 'D', optionContent: '', sortNo: 4 },
    ],
    defaultScore: 2,
  })
}
const removeSubQuestion = (idx: number) => {
  readingForm.subQuestions.splice(idx, 1)
}
const addSubOpt = (qIdx: number) => {
  const q = readingForm.subQuestions[qIdx]
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
    await new Promise((r) => setTimeout(r, 2000))
    const mock = generateMockReading(
      readingForm.topic || 'Technology',
      readingForm.passageType,
      readingForm.difficulty
    )
    readingForm.passageTitle = mock.title
    readingForm.passageContent = mock.content
    readingForm.summary = mock.summary
    readingForm.subQuestions = mock.questions
    readingForm.source = 'AI'
    ElMessage.success('AI 生成成功')
  } catch {
    ElMessage.error('AI 生成失败')
  } finally {
    aiGenerating.value = false
  }
}

function generateMockReading(topic: string, type?: string, difficulty: Difficulty = 2) {
  const qCount = 5
  const questions: ReadingSubQ[] = []
  for (let i = 0; i < qCount; i++) {
    questions.push({
      stem: `Question ${i + 1}: According to the passage, which of the following statements is ${['true', 'false', 'correct', 'best supported', 'the main idea'][i % 5]}?`,
      standardAnswer: ['A', 'B', 'C', 'D'][i % 4],
      analysis: `Based on paragraph ${i + 1} of the passage, we can infer that the correct answer is ${['A', 'B', 'C', 'D'][i % 4]}.`,
      knowledgePoints: ['阅读理解', '细节理解'],
      options: [
        { optionLabel: 'A', optionContent: `Option A for question ${i + 1}`, sortNo: 1 },
        { optionLabel: 'B', optionContent: `Option B for question ${i + 1}`, sortNo: 2 },
        { optionLabel: 'C', optionContent: `Option C for question ${i + 1}`, sortNo: 3 },
        { optionLabel: 'D', optionContent: `Option D for question ${i + 1}`, sortNo: 4 },
      ],
      defaultScore: 2,
    })
  }
  return {
    title: `The Impact of ${topic} on Modern Society`,
    content: `In recent years, ${topic.toLowerCase()} has emerged as a transformative force shaping various aspects of our daily lives. The rapid advancement of technology and globalization has accelerated this trend significantly.

Scholars and researchers from diverse fields have been studying the implications of ${topic.toLowerCase()} from multiple perspectives. Their findings suggest that while there are numerous benefits, there are also challenges that need careful consideration.

According to recent statistics, more than 70 percent of the population has experienced direct effects of ${topic.toLowerCase()} in their professional or personal lives. This number is expected to grow exponentially in the coming decade.

Experts argue that understanding the nuances of ${topic.toLowerCase()} is crucial for making informed decisions in both policy and practice. The key lies in balancing innovation with responsibility, ensuring that progress benefits all segments of society.

Looking ahead, the future of ${topic.toLowerCase()} appears both promising and uncertain. Continued research, open dialogue, and adaptive strategies will be essential for navigating the complexities that lie ahead.`,
    summary: `本文探讨了${topic}对现代社会的影响，分析了其带来的机遇与挑战。`,
    questions,
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
  if (!formRef.value || composeMode.value !== 'normal') return
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    let standardAnswer = ''
    if (normalForm.questionType === 'MULTIPLE') {
      if (!normalForm.answerMulti.length) return
      standardAnswer = [...normalForm.answerMulti].sort().join(',')
    } else if (normalForm.questionType === 'JUDGE') {
      if (!normalForm.answerJudge) return
      standardAnswer = normalForm.answerJudge
    } else if (
      normalForm.questionType === 'FILL_HINT' ||
      normalForm.questionType === 'FILL'
    ) {
      if (!normalForm.answerFill.trim()) return
      standardAnswer = normalForm.answerFill.trim().toUpperCase()
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
const dialogTitle = computed(() => {
  if (editMode.value === 'edit') return '编辑试题'
  return composeMode.value === 'reading' ? '新增阅读理解题' : '新增试题'
})

const openCreate = (mode: ComposeMode = 'normal') => {
  editMode.value = 'create'
  composeMode.value = mode
  resetNormalForm()
  resetReadingForm()
  validationResult.value = null
  if (mode === 'reading') {
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

  if (row.questionType === 'READING') {
    composeMode.value = 'reading'
    readingForm.selectedPassageId = row.passageId
    readingForm.categoryId = row.categoryId
    readingForm.difficulty = row.difficulty
    readingForm.passageMode = 'select'
    // 单题编辑模式下，只读显示文章，只编辑本题
    normalForm.id = row.id
    normalForm.categoryId = row.categoryId
    normalForm.questionType = 'READING'
    normalForm.difficulty = row.difficulty
    normalForm.stem = row.stem
    normalForm.defaultScore = row.defaultScore ?? 2
    normalForm.status = (row.status ?? 1) as 0 | 1
    normalForm.hasTrap = !!row.hasTrap
    normalForm.trapNote = row.trapNote || ''
    normalForm.analysis = row.analysis || ''
    normalForm.knowledgePoints = row.knowledgePoints || []
    normalForm.passageId = row.passageId
    normalForm.options = row.options?.length
      ? row.options.map((o) => ({ ...o }))
      : normalForm.options
    normalForm.answerSingle = row.standardAnswer || ''
  } else {
    composeMode.value = 'normal'
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
    } else if (row.questionType === 'FILL_HINT') {
      normalForm.answerFill = a
    } else {
      normalForm.answerSingle = a
    }
  }

  dialogVisible.value = true
}

/* ---------- 提交 ---------- */
const submit = async () => {
  if (!formRef.value) return

  if (composeMode.value === 'reading' && editMode.value === 'create') {
    await submitReadingBatch()
    return
  }

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    let standardAnswer = ''
    if (
      normalForm.questionType === 'SINGLE' ||
      normalForm.questionType === 'READING'
    ) {
      if (!normalForm.answerSingle) {
        ElMessage.warning('请选择正确答案')
        return
      }
      standardAnswer = normalForm.answerSingle
    } else if (normalForm.questionType === 'MULTIPLE') {
      if (!normalForm.answerMulti.length) {
        ElMessage.warning('请选择正确答案')
        return
      }
      if (normalForm.answerMulti.length < 2) {
        ElMessage.warning('多选题至少选择2个答案')
        return
      }
      standardAnswer = [...normalForm.answerMulti].sort().join(',')
    } else if (normalForm.questionType === 'JUDGE') {
      if (!normalForm.answerJudge) {
        ElMessage.warning('请选择正确答案')
        return
      }
      standardAnswer = normalForm.answerJudge
    } else if (normalForm.questionType === 'FILL_HINT') {
      if (!normalForm.fillHint.trim()) {
        ElMessage.warning('请输入提示词')
        return
      }
      if (!normalForm.answerFill.trim()) {
        ElMessage.warning('请输入填空答案')
        return
      }
      if (normalForm.answerFill.trim().includes(' ')) {
        ElMessage.warning('填空答案应为单个单词，不含空格')
        return
      }
      standardAnswer = normalForm.answerFill.trim().toUpperCase()
    } else if (normalForm.questionType === 'FILL') {
      if (!normalForm.answerFill.trim()) {
        ElMessage.warning('请输入填空答案')
        return
      }
      if (normalForm.answerFill.trim().includes(' ')) {
        ElMessage.warning('填空答案应为单个单词，不含空格')
        return
      }
      standardAnswer = normalForm.answerFill.trim().toUpperCase()
    }

    const payload: QuestionForm = {
      categoryId: normalForm.categoryId!,
      questionType: normalForm.questionType,
      stem: normalForm.stem,
      standardAnswer,
      analysis: normalForm.analysis,
      knowledgePoints: normalForm.knowledgePoints,
      difficulty: normalForm.difficulty,
      defaultScore: normalForm.defaultScore,
      status: normalForm.status,
      hasTrap: normalForm.hasTrap,
      trapNote: normalForm.trapNote,
      passageId: normalForm.passageId,
      options:
        normalForm.questionType === 'JUDGE' ||
        normalForm.questionType === 'FILL_HINT' ||
        normalForm.questionType === 'FILL'
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

/* 阅读理解批量提交：先建文章，再逐个建题目 */
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

  // 校验每道题
  for (let i = 0; i < readingForm.subQuestions.length; i++) {
    const q = readingForm.subQuestions[i]
    if (!q.stem.trim()) {
      ElMessage.warning(`第 ${i + 1} 题题干不能为空`)
      return
    }
    if (q.options.length < 2) {
      ElMessage.warning(`第 ${i + 1} 题至少需要 2 个选项`)
      return
    }
    if (!q.standardAnswer) {
      ElMessage.warning(`请选择第 ${i + 1} 题的正确答案`)
      return
    }
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
        questions: readingForm.subQuestions.map((q) => ({
          stem: q.stem,
          standardAnswer: q.standardAnswer,
          analysis: q.analysis,
          knowledgePoints: q.knowledgePoints,
          options: q.options,
          defaultScore: q.defaultScore,
        })),
      })
      passageId = passageRes.data.id
    } else {
      // 使用已有文章，逐个添加题目
      for (const q of readingForm.subQuestions) {
        const item: ReadingQuestionItem = {
          stem: q.stem,
          standardAnswer: q.standardAnswer,
          analysis: q.analysis,
          knowledgePoints: q.knowledgePoints,
          options: q.options,
          defaultScore: q.defaultScore,
        }
        await addPassageQuestion(passageId, item)
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
          <el-form-item label="题型">
            <el-select
              v-model="query.questionType"
              clearable
              placeholder="全部"
              style="width: 140px"
            >
              <el-option-group label="普通题型">
                <el-option
                  v-for="op in normalTypeOptions"
                  :key="op.value"
                  :label="op.label"
                  :value="op.value"
                />
              </el-option-group>
              <el-option-group label="阅读理解">
                <el-option label="阅读理解选择题" value="READING" />
              </el-option-group>
            </el-select>
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
        <el-button type="primary" @click="openCreate('normal')">
          <el-icon><Plus /></el-icon>新增试题
        </el-button>
        <el-button
          type="success"
          @click="openCreate('reading')"
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
      </div>

      <!-- 表格布局 -->
      <el-table
        v-if="viewMode === 'table'"
        :data="list"
        style="width: 100%"
        @selection-change="onSelection"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="stem" label="题干" min-width="200" show-overflow-tooltip />
        <el-table-column
          prop="categoryName"
          label="分类"
          width="120"
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
          </template>
        </el-table-column>
        <el-table-column label="难度" width="100">
          <template #default="{ row }">
            <el-tag :type="diffTagType(row.difficulty)" size="small">{{
              diffLabel(row.difficulty)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{
              row.status === 1 ? '启用' : '停用'
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="引用" width="80" align="center">
          <template #default="{ row }">{{ row.usageCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
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
          </div>
          <div class="card-options" v-if="item.options?.length">
            <div v-for="opt in item.options" :key="opt.optionLabel" class="opt-item">
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
            <span class="answer-hint">答案：{{ item.standardAnswer || '-' }}</span>
            <div class="actions">
              <el-button type="primary" size="small" @click.stop="openEdit(item)">
                编辑
              </el-button>
              <el-button type="danger" size="small" @click.stop="confirmDelete(item)">
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
      <!-- 模式切换（仅新增时显示） -->
      <div v-if="editMode === 'create'" class="mode-tabs">
        <div
          class="mode-tab"
          :class="{ active: composeMode === 'normal' }"
          @click="composeMode = 'normal'"
        >
          <el-icon><Notebook /></el-icon>
          <span>普通题型</span>
        </div>
        <div
          class="mode-tab"
          :class="{ active: composeMode === 'reading' }"
          @click="() => { composeMode = 'reading'; loadPassages() }"
        >
          <el-icon><Reading /></el-icon>
          <span>阅读理解（一篇文章 + 多道题）</span>
        </div>
      </div>

      <!-- 普通题型表单 -->
      <el-form
        v-show="composeMode === 'normal'"
        ref="formRef"
        :model="normalForm"
        :rules="rules"
        label-width="90px"
      >
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="分类" prop="categoryId">
              <el-cascader
                v-model="normalForm.categoryId"
                :options="categories"
                :props="{
                  value: 'id',
                  label: 'categoryName',
                  children: 'children',
                  checkStrictly: true,
                  emitPath: false,
                }"
                clearable
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="题型" prop="questionType">
              <el-select v-model="normalForm.questionType" style="width: 100%">
                <el-option
                  v-for="op in normalTypeOptions"
                  :key="op.value"
                  :label="op.label"
                  :value="op.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="难度" prop="difficulty">
              <el-select v-model="normalForm.difficulty" style="width: 100%">
                <el-option
                  v-for="op in diffOptions"
                  :key="op.value"
                  :label="op.label"
                  :value="op.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="默认分值">
              <el-input-number
                v-model="normalForm.defaultScore"
                :min="0.5"
                :max="100"
                :step="0.5"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="normalForm.status">
                <el-radio :value="1">启用</el-radio>
                <el-radio :value="0">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="题干" prop="stem">
          <el-input
            v-model="normalForm.stem"
            type="textarea"
            :rows="3"
            placeholder="请输入题干"
          />
        </el-form-item>

        <el-form-item
          v-if="
            normalForm.questionType !== 'JUDGE' &&
            normalForm.questionType !== 'FILL_HINT' &&
            normalForm.questionType !== 'FILL'
          "
          label="选项"
        >
          <div class="opt-list">
            <div v-for="(op, idx) in normalForm.options" :key="idx" class="opt-row">
              <el-tag class="opt-key">{{ op.optionLabel }}</el-tag>
              <el-input v-model="op.optionContent" placeholder="选项内容" />
              <el-button link type="danger" size="small" @click="removeOption(idx)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <el-button size="small" @click="addOption">
              <el-icon><Plus /></el-icon>添加选项
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="正确答案">
          <!-- 单选题 -->
          <el-radio-group
            v-if="normalForm.questionType === 'SINGLE'"
            v-model="normalForm.answerSingle"
          >
            <el-radio
              v-for="op in normalForm.options"
              :key="op.optionLabel"
              :value="op.optionLabel"
            >
              {{ op.optionLabel }}
            </el-radio>
          </el-radio-group>
          <!-- 多选题 -->
          <el-checkbox-group
            v-else-if="normalForm.questionType === 'MULTIPLE'"
            v-model="normalForm.answerMulti"
          >
            <el-checkbox
              v-for="op in normalForm.options"
              :key="op.optionLabel"
              :value="op.optionLabel"
            >
              {{ op.optionLabel }}
            </el-checkbox>
            <span v-if="normalForm.answerMulti.length > 0" class="multi-hint">
              已选 {{ normalForm.answerMulti.length }} 个答案
            </span>
          </el-checkbox-group>
          <!-- 判断题 -->
          <el-radio-group
            v-else-if="normalForm.questionType === 'JUDGE'"
            v-model="normalForm.answerJudge"
          >
            <el-radio value="TRUE">正确</el-radio>
            <el-radio value="FALSE">错误</el-radio>
          </el-radio-group>
          <!-- 带提示填空题 -->
          <template v-else-if="normalForm.questionType === 'FILL_HINT'">
            <el-input
              v-model="normalForm.fillHint"
              placeholder="提示词（括号内的提示，如：verb, noun）"
              style="margin-bottom: 8px"
            />
            <el-input
              v-model="normalForm.answerFill"
              placeholder="填空答案（单个单词，会自动转大写）"
            />
            <span class="fill-hint">题干中使用 [BLANK] 或 __ 表示填空位置</span>
          </template>
          <!-- 填空题 -->
          <template v-else-if="normalForm.questionType === 'FILL'">
            <el-input
              v-model="normalForm.answerFill"
              placeholder="填空答案（单个单词，会自动转大写）"
            />
            <span class="fill-hint">题干中使用 [BLANK] 或 __ 表示填空位置</span>
          </template>
        </el-form-item>

        <el-form-item label="陷阱干扰">
          <el-switch v-model="normalForm.hasTrap" />
          <el-input
            v-if="normalForm.hasTrap"
            v-model="normalForm.trapNote"
            placeholder="陷阱说明（可选）"
            style="margin-top: 6px"
          />
        </el-form-item>

        <el-form-item label="解析">
          <el-input
            v-model="normalForm.analysis"
            type="textarea"
            :rows="3"
            placeholder="题目解析（可选）"
          />
        </el-form-item>

        <el-form-item label="知识点">
          <el-select
            v-model="normalForm.knowledgePoints"
            multiple
            collapse-tags
            allow-create
            filterable
            placeholder="输入知识点标签后按回车添加"
            style="width: 100%"
          />
        </el-form-item>

        <!-- AI验证结果 -->
        <div
          v-if="validationResult"
          class="validation-result"
          :class="{
            'validation-success': validationResult.isValid,
            'validation-fail': !validationResult.isValid,
          }"
        >
          <div class="validation-header">
            <el-icon>
              <CircleCheck v-if="validationResult.isValid" />
              <Warning v-else />
            </el-icon>
            <span>{{ validationResult.isValid ? 'AI验证通过' : 'AI验证未通过' }}</span>
            <span class="validation-confidence">
              置信度：{{ validationResult.confidence }}%
            </span>
          </div>
          <div v-if="validationResult.suggestions?.length" class="validation-suggestions">
            <div class="suggestions-title">💡 修改建议：</div>
            <ul>
              <li v-for="(s, idx) in validationResult.suggestions" :key="idx">
                {{ s }}
              </li>
            </ul>
          </div>
          <div v-if="validationResult.correctedAnswer" class="validation-corrected">
            <span>修正答案：</span>
            <span class="corrected-value">{{ validationResult.correctedAnswer }}</span>
          </div>
          <div v-if="validationResult.improvedAnalysis" class="validation-improved">
            <span>优化解析：</span>
            <span class="improved-value">{{ validationResult.improvedAnalysis }}</span>
          </div>
        </div>
      </el-form>

      <!-- 阅读理解表单 -->
      <div v-show="composeMode === 'reading'" class="reading-form">
        <el-form label-width="90px">
          <el-row :gutter="12">
            <el-col :span="10">
              <el-form-item label="分类">
                <el-cascader
                  v-model="readingForm.categoryId"
                  :options="categories"
                  :props="{
                    value: 'id',
                    label: 'categoryName',
                    children: 'children',
                    checkStrictly: true,
                    emitPath: false,
                  }"
                  clearable
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="难度">
                <el-select v-model="readingForm.difficulty" style="width: 100%">
                  <el-option
                    v-for="op in diffOptions"
                    :key="op.value"
                    :label="op.label"
                    :value="op.value"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="文章来源">
                <el-radio-group v-model="readingForm.passageMode">
                  <el-radio value="select">从库中选择</el-radio>
                  <el-radio value="create">临时创建</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>

          <!-- 文章库选择 -->
          <div v-if="readingForm.passageMode === 'select'" class="passage-selector">
            <div class="selector-toolbar">
              <el-input
                v-model="passageSearchKw"
                placeholder="搜索文章标题/内容"
                clearable
                size="small"
                style="width: 240px"
              >
                <template #prefix><Search /></template>
              </el-input>
              <el-button size="small" type="primary" @click="loadPassages">
                搜索
              </el-button>
            </div>
            <div class="passage-list" v-loading="passageLoading">
              <div
                v-for="p in passageList"
                :key="p.id"
                class="passage-item"
                :class="{ selected: readingForm.selectedPassageId === p.id }"
                @click="selectPassage(p)"
              >
                <div class="passage-item-title">
                  {{ p.title || '(无标题)' }}
                  <el-tag size="small" type="info" class="passage-tag">
                    {{ diffLabel(p.difficulty) }}
                  </el-tag>
                  <el-tag size="small" class="passage-tag">{{ p.questionCount ?? 0 }} 题</el-tag>
                </div>
                <div class="passage-item-content">{{ p.content }}</div>
              </div>
              <el-empty v-if="!passageList.length && !passageLoading" description="暂无文章" />
            </div>
          </div>

          <!-- 临时创建文章 -->
          <div v-else class="passage-create">
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
                  <el-select
                    v-model="readingForm.passageType"
                    clearable
                    placeholder="选择类型"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="op in [
                        { label: '记叙文', value: 'NARRATIVE' },
                        { label: '说明文', value: 'EXPOSITORY' },
                        { label: '议论文', value: 'ARGUMENTATIVE' },
                        { label: '新闻', value: 'NEWS' },
                        { label: '故事', value: 'STORY' },
                      ]"
                      :key="op.value"
                      :label="op.label"
                      :value="op.value"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="文章内容">
              <el-input
                v-model="readingForm.passageContent"
                type="textarea"
                :rows="6"
                placeholder="请输入文章正文"
              />
            </el-form-item>
            <el-form-item label="摘要">
              <el-input
                v-model="readingForm.summary"
                type="textarea"
                :rows="2"
                placeholder="文章摘要（可选）"
              />
            </el-form-item>
            <el-form-item label="入库方式">
              <el-radio-group v-model="readingForm.source">
                <el-radio value="TEMP">仅临时出题（不入库）</el-radio>
                <el-radio value="MANUAL">存入文章库</el-radio>
                <el-radio value="AI" disabled>AI 生成</el-radio>
              </el-radio-group>
            </el-form-item>
            <div class="ai-btn-row">
              <el-button
                type="primary"
                :loading="aiGenerating"
                @click="aiGenerateReading"
              >
                <el-icon><MagicStick /></el-icon>
                AI 生成文章 + 5 道题
              </el-button>
            </div>
          </div>

          <!-- 题目列表 -->
          <el-divider content-position="left">
            <span class="divider-title">
              📝 题目列表（{{ readingForm.subQuestions.length }} 道）
            </span>
          </el-divider>

          <div class="sub-questions">
            <div class="sq-toolbar">
              <el-button size="small" type="primary" plain @click="addSubQuestion">
                <el-icon><Plus /></el-icon>添加题目
              </el-button>
              <span class="sq-hint">
                提示：阅读理解通常一篇文章配 3-5 道选择题
              </span>
            </div>

            <div
              v-for="(q, qIdx) in readingForm.subQuestions"
              :key="qIdx"
              class="sub-q-card"
            >
              <div class="sub-q-header">
                <span class="sub-q-num">第 {{ qIdx + 1 }} 题</span>
                <div class="sub-q-actions">
                  <el-input-number
                    v-model="q.defaultScore"
                    :min="0.5"
                    :max="20"
                    :step="0.5"
                    size="small"
                  />
                  <span style="margin-left: 4px">分</span>
                  <el-button link type="danger" size="small" @click="removeSubQuestion(qIdx)">
                    移除
                  </el-button>
                </div>
              </div>
              <el-form-item label="题干" :label-width="60">
                <el-input v-model="q.stem" placeholder="题目题干" />
              </el-form-item>
              <el-form-item label="选项" :label-width="60">
                <div class="sub-opts-grid">
                  <div
                    v-for="(opt, oIdx) in q.options"
                    :key="oIdx"
                    class="sub-opt-row"
                  >
                    <el-tag class="opt-key">{{ opt.optionLabel }}</el-tag>
                    <el-input
                      v-model="opt.optionContent"
                      placeholder="选项内容"
                      size="small"
                    />
                    <el-button
                      link
                      type="danger"
                      size="small"
                      @click="removeSubOpt(qIdx, oIdx)"
                    >
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                </div>
                <el-button size="small" type="primary" link @click="addSubOpt(qIdx)">
                  + 添加选项
                </el-button>
              </el-form-item>
              <el-form-item label="答案" :label-width="60">
                <el-radio-group v-model="q.standardAnswer">
                  <el-radio
                    v-for="opt in q.options"
                    :key="opt.optionLabel"
                    :value="opt.optionLabel"
                  >
                    {{ opt.optionLabel }}
                  </el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="解析" :label-width="60">
                <el-input
                  v-model="q.analysis"
                  type="textarea"
                  :rows="2"
                  placeholder="答案解析"
                />
              </el-form-item>
              <el-form-item label="知识点" :label-width="60">
                <el-select
                  v-model="q.knowledgePoints"
                  multiple
                  collapse-tags
                  allow-create
                  filterable
                  placeholder="输入后回车添加"
                  style="width: 100%"
                />
              </el-form-item>
            </div>

            <el-empty
              v-if="readingForm.subQuestions.length === 0"
              description="暂无题目，点击上方按钮添加"
            />
          </div>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          v-if="composeMode === 'normal'"
          type="primary"
          @click="doValidate"
          :loading="validating"
        >
          <el-icon><Lightning /></el-icon>AI验证
        </el-button>
        <el-button type="primary" @click="submit" :loading="submittingReading">
          保存
        </el-button>
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
</style>
