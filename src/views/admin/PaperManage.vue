<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'

import {
  listPapers,
  createPaper,
  updatePaper,
  deletePaper,
  updatePaperStatus,
  getPaperDetail,
  listAdminQuestions,
  listReadingPassages,
  listCategoryTree,
  getPaperUsageStats,
  getPaperSummaryStats,
  copyPaper,
  type AdminQuestionQuery,
} from '@/api/admin'
import { useRouter } from 'vue-router'
import {
  List, Grid, Plus, Search, Refresh, View, Edit, Delete,
  CopyDocument, Download, ArrowDown, Timer, Calendar, DocumentChecked
} from '@element-plus/icons-vue'
import { getQuestionDetail } from '@/api/student'
import type { Paper, PaperForm, PaperSummaryStats } from '@/types/paper'
import type { PaperUsageStats } from '@/types/admin'
import type { Question } from '@/types/question'
import type { ReadingPassage } from '@/types/reading'
import type { Category } from '@/types/category'
import type { QuestionType, Difficulty } from '@/types/common'
import { useViewMode } from '@/composables/useViewMode'

const router = useRouter()
const { viewMode, toggleViewMode } = useViewMode('paper_manage')

const summaryStats = ref<PaperSummaryStats | null>(null)
const summaryLoading = ref(false)

const loadSummaryStats = async () => {
  summaryLoading.value = true
  try {
    const res = await getPaperSummaryStats()
    summaryStats.value = res.data
  } catch {
    summaryStats.value = null
  } finally {
    summaryLoading.value = false
  }
}

const query = reactive({
  paperName: '',
  minQuestionCount: undefined as number | undefined,
  maxQuestionCount: undefined as number | undefined,
  minTotalScore: undefined as number | undefined,
  maxTotalScore: undefined as number | undefined,
  status: undefined as number | undefined,
  pageNum: 1,
  pageSize: 50,
})
const list = ref<Paper[]>([])
const total = ref(0)
const loading = ref(false)

const statusText = (s?: number) => (s === 0 ? '草稿' : s === 1 ? '启用' : s === 2 ? '停用' : '-')
const statusType = (s?: number): 'info' | 'success' | 'danger' => (s === 1 ? 'success' : s === 2 ? 'danger' : 'info')

const load = async () => {
  loading.value = true
  loadSummaryStats()
  try {
    const res = await listPapers({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      paperName: query.paperName || undefined,
      minQuestionCount: query.minQuestionCount,
      maxQuestionCount: query.maxQuestionCount,
      minTotalScore: query.minTotalScore,
      maxTotalScore: query.maxTotalScore,
      status: query.status,
    })
    list.value = res.data.records ?? []
    total.value = res.data.total ?? 0
  } finally {
    loading.value = false
  }
}
const search = () => { query.pageNum = 1; load() }
const reset = () => {
  query.paperName = ''
  query.minQuestionCount = undefined
  query.maxQuestionCount = undefined
  query.minTotalScore = undefined
  query.maxTotalScore = undefined
  query.status = undefined
  query.pageNum = 1
  load()
}

/* ---------------- 组卷 Dialog ---------------- */
const dialogVisible = ref(false)
const step = ref(0)
const editMode = ref<'create' | 'edit'>('create')
const baseFormRef = ref<FormInstance>()
const submitting = ref(false)

interface PickedSubQuestion {
  questionId: number
  stem: string
  questionType: QuestionType
  difficulty: Difficulty
  score: number
}

interface PickedQuestion {
  unitType: 'QUESTION'
  questionId: number
  stem: string
  questionType: QuestionType
  difficulty: Difficulty
  score: number
}

interface PickedPassage {
  unitType: 'READING'
  passageId: number
  passageTitle: string
  passageContent: string
  passageWordCount?: number | undefined
  difficulty: Difficulty
  subQuestions: PickedSubQuestion[]
}

type PickedUnit = PickedQuestion | PickedPassage

const paperForm = reactive({
  id: 0,
  paperName: '',
  description: '',
  passScore: 60 as number | undefined,
  // [2026-10-28] 原「随机乱序」初值：后端 exam_paper.shuffle_questions 在取题排序里不读，假开关 ⇒ 删除
  status: 0 as 0 | 1 | 2,
})

const picked = ref<PickedUnit[]>([])
const totalScore = computed(() => picked.value.reduce((sum, unit) => {
  if (unit.unitType === 'QUESTION') return sum + Number(unit.score || 0)
  return sum + unit.subQuestions.reduce((groupSum, question) => groupSum + Number(question.score || 0), 0)
}, 0))
const pickedQuestionCount = computed(() => picked.value.reduce(
  (sum, unit) => sum + (unit.unitType === 'QUESTION' ? 1 : unit.subQuestions.length),
  0,
))
const scoreValues = computed(() => picked.value.flatMap((unit) =>
  unit.unitType === 'QUESTION' ? [unit.score] : unit.subQuestions.map((question) => question.score),
))
const pickedIds = computed(() => new Set(picked.value.flatMap((unit) =>
  unit.unitType === 'QUESTION'
    ? [unit.questionId]
    : unit.subQuestions.map((question) => question.questionId),
)))
const unitScore = (unit: PickedUnit) => unit.unitType === 'QUESTION'
  ? Number(unit.score || 0)
  : unit.subQuestions.reduce((sum, question) => sum + Number(question.score || 0), 0)
const isPassagePicked = (passageId: number) => picked.value.some(
  (unit) => unit.unitType === 'READING' && unit.passageId === passageId,
)

const baseRules: FormRules = {
  paperName: [{ required: true, message: '请输入试卷名称', trigger: 'blur' }],
}

const resetPaperForm = () => {
  Object.assign(paperForm, { id: 0, paperName: '', description: '', passScore: 60, status: 0 })
  picked.value = []
  step.value = 0
}

const openCreate = () => {
  editMode.value = 'create'
  resetPaperForm()
  dialogVisible.value = true
}

const openEdit = async (row: Paper) => {
  editMode.value = 'edit'
  resetPaperForm()
  paperForm.id = row.id
  paperForm.paperName = row.paperName
  paperForm.description = row.description || ''
  paperForm.passScore = row.passScore
  // [2026-10-28] 原此行把详情里的 shuffle_questions 回填到表单开关；该列后端不读（假开关），表单已无该项 ⇒ 删除
  paperForm.status = row.status
  dialogVisible.value = true
  try {
    const res = await getPaperDetail(row.id)
    picked.value = (res.data.questions ?? []).map((unit): PickedUnit => {
      if (unit.unitType === 'READING') {
        return {
          unitType: 'READING',
          passageId: unit.passageId ?? 0,
          passageTitle: unit.passageTitle || unit.stem || '阅读理解',
          passageContent: unit.passageContent || '',
          passageWordCount: unit.passageWordCount ?? 0,
          difficulty: unit.difficulty ?? 2,
          subQuestions: (unit.subQuestions ?? []).map((question) => ({
            questionId: question.questionId,
            stem: question.stem,
            questionType: question.questionType,
            difficulty: question.difficulty,
            score: Number(question.questionScore),
          })),
        }
      }
      return {
        unitType: 'QUESTION',
        questionId: unit.questionId ?? 0,
        stem: unit.stem,
        questionType: unit.questionType,
        difficulty: unit.difficulty ?? 2,
        score: Number(unit.questionScore),
      }
    })
  } catch { /* silent */ }
}

/* ---------------- 题库选择器 ---------------- */
const bankVisible = ref(false)
const bankKind = ref<'question' | 'reading'>('question')
const bank = reactive<AdminQuestionQuery & { total: number }>({
  keyword: '', categoryId: undefined, questionType: undefined, difficulty: undefined,
  pageNum: 1, pageSize: 50, total: 0,
})
const bankList = ref<Question[]>([])
const passageBankList = ref<ReadingPassage[]>([])
const bankLoading = ref(false)
const categories = ref<Category[]>([])

const typeOptions: { label: string; value: QuestionType }[] = [
  { label: '单选题', value: 'SINGLE' },
  { label: '多选题', value: 'MULTIPLE' },
  { label: '判断题', value: 'JUDGE' },
  { label: '填空题', value: 'FILL_HINT' },
]
const diffOptions: { label: string; value: Difficulty }[] = [
  { label: '简单', value: 1 },
  { label: '中等', value: 2 },
  { label: '困难', value: 3 },
]

const typeLabel = (t?: QuestionType) => typeOptions.find((o) => o.value === t)?.label ?? t
const diffLabel = (d?: Difficulty) => diffOptions.find((o) => o.value === d)?.label ?? String(d)
const diffTagType = (d?: Difficulty) => (d === 1 ? 'success' : d === 2 ? 'warning' : 'danger')

const loadBank = async () => {
  bankLoading.value = true
  try {
    if (bankKind.value === 'reading') {
      const res = await listReadingPassages({
        pageNum: bank.pageNum,
        pageSize: bank.pageSize,
        keyword: bank.keyword || undefined,
        categoryId: bank.categoryId,
        difficulty: bank.difficulty,
        status: 1,
        includeQuestions: true,
      })
      passageBankList.value = res.data.records ?? []
      bankList.value = []
      bank.total = res.data.total ?? 0
      return
    }
    const res = await listAdminQuestions({
      pageNum: bank.pageNum, pageSize: bank.pageSize,
      keyword: bank.keyword || undefined,
      categoryId: bank.categoryId,
      questionType: bank.questionType,
      difficulty: bank.difficulty,
      status: 1,
    })
    bankList.value = (res.data.records ?? []).filter((question) => !question.passageId)
    passageBankList.value = []
    bank.total = res.data.total ?? 0
  } finally { bankLoading.value = false }
}

const openBank = () => {
  bankVisible.value = true
  loadBank()
}
const bankSearch = () => { bank.pageNum = 1; loadBank() }
const bankReset = () => {
  bank.keyword = ''; bank.categoryId = undefined
  bank.questionType = undefined; bank.difficulty = undefined
  bank.pageNum = 1; loadBank()
}

const addPassage = (passage: ReadingPassage) => {
  if (picked.value.some((unit) => unit.unitType === 'READING' && unit.passageId === passage.id)) {
    ElMessage.info('已选择过这篇阅读理解')
    return
  }
  const questions = passage.questions ?? []
  if (!questions.length) {
    ElMessage.warning('这篇文章没有启用子题，暂时不能加入试卷')
    return
  }
  picked.value.push({
    unitType: 'READING',
    passageId: passage.id,
    passageTitle: passage.title || '阅读理解',
    passageContent: passage.content,
    passageWordCount: passage.wordCount,
    difficulty: passage.difficulty,
    subQuestions: questions.map((question) => ({
      questionId: question.id,
      stem: question.stem,
      questionType: question.questionType,
      difficulty: question.difficulty,
      score: question.defaultScore ?? 2,
    })),
  })
  ElMessage.success(`已加入阅读题组：${passage.title || '阅读理解'}（${questions.length} 道小题）`)
}

const addQuestion = (q: Question) => {
  if (q.passageId) {
    ElMessage.warning('阅读理解子题不能单独加入，请切换到阅读理解题组')
    return
  }
  if (pickedIds.value.has(q.id)) { ElMessage.info('已选择过'); return }
  picked.value.push({
    unitType: 'QUESTION',
    questionId: q.id,
    stem: q.stem,
    questionType: q.questionType,
    difficulty: q.difficulty,
    score: q.defaultScore ?? 2,
  })
  ElMessage.success(`已加入：${q.stem.slice(0, 20)}${q.stem.length > 20 ? '...' : ''}`)
}
const removePicked = (unit: PickedUnit) => {
  picked.value = picked.value.filter((candidate) => {
    if (candidate.unitType === 'QUESTION' && unit.unitType === 'QUESTION') {
      return candidate.questionId !== unit.questionId
    }
    if (candidate.unitType === 'READING' && unit.unitType === 'READING') {
      return candidate.passageId !== unit.passageId
    }
    return true
  })
}

/* ---------------- Steps ---------------- */
const nextStep = async () => {
  if (step.value === 0) {
    if (!baseFormRef.value) return
    baseFormRef.value.validate((valid) => { if (valid) step.value = 1 })
    return
  }
  if (step.value === 1) {
    if (!picked.value.length) { ElMessage.warning('请至少选一道题'); return }
    if (scoreValues.value.some((score) => !score || score <= 0)) {
      ElMessage.warning('每题必须设置分值')
      return
    }
    step.value = 2
    return
  }
}
const prevStep = () => { if (step.value > 0) step.value-- }

/* ---------------- 保存 ---------------- */
const submit = async () => {
  submitting.value = true
  let questionOrder = 1
  const questionUnits: PaperForm['questionUnits'] = picked.value.map((unit) => {
    if (unit.unitType === 'QUESTION') {
      return { questionId: unit.questionId, questionScore: unit.score, questionOrder: questionOrder++ }
    }
    return {
      passageId: unit.passageId,
      questions: unit.subQuestions.map((question) => ({
        questionId: question.questionId,
        questionScore: question.score,
        questionOrder: questionOrder++,
      })),
    }
  })
  const payload: PaperForm = {
    paperName: paperForm.paperName,
    description: paperForm.description,
    passScore: paperForm.passScore,
    // [2026-10-28] 原此对象多带一个 shuffle_questions 提交项，后端不读该列（假开关），随表单一并删除
    status: paperForm.status,
    questionUnits,
  }
  try {
    if (editMode.value === 'create') {
      await createPaper(payload)
      ElMessage.success('试卷创建成功')
    } else {
      await updatePaper(paperForm.id, payload)
      ElMessage.success('试卷更新成功')
    }
    dialogVisible.value = false
    load()
  } catch { /* handled */ } finally { submitting.value = false }
}

/* ---------------- 查看试卷(含答案与解析, 论文 4.2.2 管理员预览) ---------------- */
const viewVisible = ref(false)
const viewPaper = ref<Paper | null>(null)
const viewQuestions = ref<PickedUnit[]>([])
const viewAnswers = ref<Record<number, { standardAnswer?: string; analysis?: string; options?: Array<{ optionLabel: string; optionContent: string }> }>>({})
const viewLoading = ref(false)
/** [2026-10-30] 试卷使用统计（实时聚合，不落库） */
const paperStats = ref<PaperUsageStats | null>(null)
const paperStatsLoading = ref(false)

/** 正确率配色：≥70 绿 / 40-70 橙 / <40 红 */
const accColor = (rate?: number | null) => {
  const v = Number(rate ?? 0)
  if (v >= 70) return '#67C23A'
  if (v >= 40) return '#E6A23C'
  return '#F56C6C'
}

/** 分数配色：≥80 绿 / 60-80 橙 / <60 红 */
const scoreColor = (score?: number | null) => {
  if (score == null) return '#909399'
  const v = Number(score)
  if (v >= 80) return '#67C23A'
  if (v >= 60) return '#E6A23C'
  return '#F56C6C'
}

/** 加载试卷使用统计；失败不影响题目预览 */
const loadPaperStats = async (paperId: number) => {
  paperStatsLoading.value = true
  paperStats.value = null
  try {
    const res = await getPaperUsageStats(paperId)
    paperStats.value = res.data
  } catch {
    paperStats.value = null
  } finally {
    paperStatsLoading.value = false
  }
}

const showAllAnswers = ref(false)

const openView = async (row: Paper, defaultShowAnswers = false) => {
  viewPaper.value = row
  viewQuestions.value = []
  viewAnswers.value = {}
  showAllAnswers.value = defaultShowAnswers
  paperStats.value = null
  viewVisible.value = true
  viewLoading.value = true
  loadPaperStats(row.id)
  try {
    const res = await getPaperDetail(row.id)
    const questions = res.data.questions ?? []
    
    // 一键预填充所有题目的标准答案、解析与选项（由后端多表联合下发，0ms响应）
    for (const q of questions) {
      if (q.unitType === 'READING') {
        for (const sub of q.subQuestions ?? []) {
          viewAnswers.value[sub.questionId] = {
            standardAnswer: sub.standardAnswer ?? '',
            analysis: sub.analysis ?? '',
            options: (sub.options ?? []).map((o) => ({ optionLabel: o.optionLabel, optionContent: o.optionContent })),
          }
        }
      } else if (q.questionId) {
        viewAnswers.value[q.questionId] = {
          standardAnswer: q.standardAnswer ?? '',
          analysis: q.analysis ?? '',
          options: (q.options ?? []).map((o) => ({ optionLabel: o.optionLabel, optionContent: o.optionContent })),
        }
      }
    }

    viewQuestions.value = questions.map((unit): PickedUnit => {
      if (unit.unitType === 'READING') {
        return {
          unitType: 'READING',
          passageId: unit.passageId ?? 0,
          passageTitle: unit.passageTitle || unit.stem || '阅读理解',
          passageContent: unit.passageContent || '',
          passageWordCount: unit.passageWordCount,
          difficulty: unit.difficulty ?? 2,
          subQuestions: (unit.subQuestions ?? []).map((question) => ({
            questionId: question.questionId,
            stem: question.stem,
            questionType: question.questionType,
            difficulty: question.difficulty,
            score: Number(question.questionScore),
          })),
        }
      }
      return {
        unitType: 'QUESTION',
        questionId: unit.questionId ?? 0,
        stem: unit.stem,
        questionType: unit.questionType,
        difficulty: unit.difficulty ?? 2,
        score: Number(unit.questionScore),
      }
    })
  } catch { /* silent */ } finally { viewLoading.value = false }
}

/** 快速复制/克隆试卷 */
const handleCopyPaper = async (row: Paper) => {
  try {
    await ElMessageBox.confirm(`确认复制试卷《${row.paperName}》为新副本？`, '复制试卷', { type: 'info' })
    const res = await copyPaper(row.id)
    ElMessage.success(`试卷已复制：${res.data.paperName}`)
    load()
  } catch { /* cancelled */ }
}

/** 以此试卷为模板快速创建考试 */
const handleCreateExamFromPaper = (row: Paper) => {
  router.push({ path: '/admin/exams', query: { createPaperId: row.id } })
}

/** 复制试卷全文到剪贴板 */
const copyPaperText = async () => {
  if (!viewPaper.value) return
  let text = `# ${viewPaper.value.paperName}\n总分：${viewPaper.value.totalScore} 分 | 题量：${viewQuestions.value.length}\n\n`
  viewQuestions.value.forEach((unit, idx) => {
    if (unit.unitType === 'READING') {
      text += `## ${idx + 1}. [阅读理解] ${unit.passageTitle} (${unitScore(unit)} 分)\n${unit.passageContent}\n\n`
      unit.subQuestions.forEach((sub, subIdx) => {
        text += `(${subIdx + 1}) [${typeLabel(sub.questionType)}] ${sub.stem} (${sub.score} 分)\n`
        const ans = viewAnswers.value[sub.questionId]
        if (ans?.options?.length) {
          ans.options.forEach((opt: any) => { text += `  ${opt.optionLabel}. ${opt.optionContent}\n` })
        }
        if (showAllAnswers.value && ans) {
          text += `  【标准答案】: ${formatAnswerText(ans.standardAnswer, sub.questionType)}\n  【解析】: ${ans.analysis || '无'}\n`
        }
        text += '\n'
      })
    } else {
      text += `## ${idx + 1}. [${typeLabel(unit.questionType)}] ${unit.stem} (${unit.score} 分)\n`
      const ans = viewAnswers.value[unit.questionId]
      if (ans?.options?.length) {
        ans.options.forEach((opt: any) => { text += `  ${opt.optionLabel}. ${opt.optionContent}\n` })
      }
      if (showAllAnswers.value && ans) {
        text += `  【标准答案】: ${formatAnswerText(ans.standardAnswer, unit.questionType)}\n  【解析】: ${ans.analysis || '无'}\n`
      }
      text += '\n'
    }
  })
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('试卷文本已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动选择复制')
  }
}

/** 导出试卷为 Markdown 文件 */
const exportPaper = (row: Paper, withAnswers = false) => {
  let md = `# ${row.paperName}\n> 导出时间：${new Date().toLocaleString()} | 总分：${row.totalScore} 分\n\n`
  const questions = row.questions || []
  if (questions.length === 0) {
    ElMessage.info('正在加载题目内容进行导出...')
    openView(row, withAnswers)
    return
  }
  questions.forEach((unit, idx) => {
    if (unit.unitType === 'READING') {
      md += `### ${idx + 1}. [阅读理解] ${unit.passageTitle || '阅读篇章'}\n\n${unit.passageContent}\n\n`
      ;(unit.subQuestions || []).forEach((sub, subIdx) => {
        md += `**(${subIdx + 1}) [${typeLabel(sub.questionType)}] ${sub.stem}** (${sub.questionScore}分)\n\n`
        ;(sub.options || []).forEach(opt => {
          md += `- ${opt.optionLabel}. ${opt.optionContent}\n`
        })
        if (withAnswers) {
          md += `\n> **标准答案**：${sub.standardAnswer || '-'}\n> **解析**：${sub.analysis || '无'}\n\n`
        }
      })
    } else {
      md += `### ${idx + 1}. [${typeLabel(unit.questionType)}] ${unit.stem} (${unit.questionScore}分)\n\n`
      ;(unit.options || []).forEach(opt => {
        md += `- ${opt.optionLabel}. ${opt.optionContent}\n`
      })
      if (withAnswers) {
        md += `\n> **标准答案**：${unit.standardAnswer || '-'}\n> **解析**：${unit.analysis || '无'}\n\n`
      }
    }
  })
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${row.paperName}${withAnswers ? '-带答案解析版' : '-空白答卷版'}.md`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('试卷 Markdown 已导出')
}

const diffLevelTag = (lvl?: string): 'info' | 'success' | 'warning' | 'danger' => {
  if (lvl === '简单') return 'success'
  if (lvl === '中等') return 'warning'
  if (lvl === '困难') return 'danger'
  return 'info'
}

const loadAnswer = async (questionId: number) => {
  if (viewAnswers.value[questionId]) return
  try {
    const res = await getQuestionDetail(questionId)
    viewAnswers.value[questionId] = {
      standardAnswer: res.data.standardAnswer ?? '',
      analysis: res.data.analysis ?? '',
      options: (res.data.options ?? []).map((o) => ({ optionLabel: o.optionLabel, optionContent: o.optionContent })),
    }
  } catch { ElMessage.error('答案加载失败') }
}

const formatAnswerText = (ans?: string, type?: string) => {
  if (!ans) return '-'
  if (type === 'JUDGE') {
    const up = ans.trim().toUpperCase()
    if (up === 'TRUE' || up === 'T' || up === '对' || up === '正确') return '对'
    if (up === 'FALSE' || up === 'F' || up === '错' || up === '错误') return '错'
  }
  return ans
}

/* ---------------- 行操作 ---------------- */
const publish = async (row: Paper) => {
  try {
    await ElMessageBox.confirm(`发布试卷《${row.paperName}》后即可用于组织考试。`, '发布确认', { type: 'info' })
    await updatePaperStatus(row.id, 1)
    ElMessage.success('已发布')
    load()
  } catch { /* cancelled */ }
}
const unpublish = async (row: Paper) => {
  try {
    await ElMessageBox.confirm(`下架《${row.paperName}》？已关联的考试不受影响。`, '下架确认', { type: 'warning' })
    await updatePaperStatus(row.id, 2)
    ElMessage.success('已下架')
    load()
  } catch { /* cancelled */ }
}
const confirmDelete = async (row: Paper) => {
  try {
    await ElMessageBox.confirm(`确认删除试卷《${row.paperName}》？被引用则改为软停用。`, '删除确认', { type: 'warning' })
    await deletePaper(row.id)
    ElMessage.success('已删除')
    load()
  } catch { /* cancelled */ }
}

onMounted(async () => {
  try {
    const c = await listCategoryTree()
    categories.value = c.data ?? []
  } catch { /* silent */ }
  load()
})
</script>

<template>
  <div class="page">
    <!-- [2026-09-27 新增] 造卷双入口的主从说明：本页是手动/高级入口（C 项） -->
    <el-alert type="info" :closable="false" show-icon>
      <template #title>
        <b>手动组卷 · 人工精挑</b>
      </template>
      从题库逐题挑选、排序并定分值，适合需要精确控制题序与分值的卷子；
      若只需一份常规试卷，去「试卷模板」按配比自动生成更快。
      论文 §4.2.3：试卷只保存可复用的题目结构，开放时间与场次由「考试管理」单独维护。
    </el-alert>
    <!-- 顶部多维动态汇总看板（全部多表实时聚合，零库表字段） -->
    <div v-if="summaryStats" class="stat-banner" v-loading="summaryLoading">
      <el-row :gutter="12">
        <el-col :xs="12" :sm="8" :md="4">
          <div class="stat-card">
            <div class="stat-label">试卷总数</div>
            <div class="stat-num text-primary">{{ summaryStats.totalPapers }}</div>
            <div class="stat-sub">启用 {{ summaryStats.publishedPapers }} · 草稿 {{ summaryStats.draftPapers }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="4">
          <div class="stat-card">
            <div class="stat-label">累计组卷题数</div>
            <div class="stat-num text-success">{{ summaryStats.totalQuestionsInPapers }}</div>
            <div class="stat-sub">平均每卷约 {{ Math.round(summaryStats.totalQuestionsInPapers / (summaryStats.totalPapers || 1)) }} 题</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="4">
          <div class="stat-card">
            <div class="stat-label">试卷平均满分</div>
            <div class="stat-num" style="color:#e6a23c">{{ summaryStats.avgPaperScore }}</div>
            <div class="stat-sub">标准满分多为 100/120</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="4">
          <div class="stat-card">
            <div class="stat-label">试卷利用率</div>
            <div class="stat-num" :style="{ color: (summaryStats.referenceRate ?? 0) >= 30 ? '#67c23a' : '#909399' }">
              {{ summaryStats.referenceRate }}%
            </div>
            <div class="stat-sub">已被 {{ summaryStats.referencedPapers }} 场考试引用</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="4">
          <div class="stat-card">
            <div class="stat-label">累计答卷人次</div>
            <div class="stat-num text-info">{{ summaryStats.totalExaminees }}</div>
            <div class="stat-sub">全网有效考生试卷</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="4">
          <div class="stat-card">
            <div class="stat-label">全站综合及格率</div>
            <div class="stat-num" :style="{ color: (summaryStats.overallPassRate ?? 0) >= 60 ? '#67c23a' : '#f56c6c' }">
              {{ summaryStats.overallPassRate }}%
            </div>
            <div class="stat-sub">平均得分 {{ summaryStats.overallAvgScore }} 分</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-row :gutter="8">
          <el-form-item label="试卷名称">
            <el-input v-model="query.paperName" clearable placeholder="试卷名称" style="width:200px" />
          </el-form-item>
          <el-form-item label="AI 生成">
          </el-form-item>
          <el-form-item label="题量范围">
            <el-input-number v-model="query.minQuestionCount" :min="0" placeholder="最低" controls-position="right" style="width:100px" />
            <span style="margin:0 4px; color:#909399">~</span>
            <el-input-number v-model="query.maxQuestionCount" :min="0" placeholder="最高" controls-position="right" style="width:100px" />
          </el-form-item>
          <el-form-item label="总分范围">
            <el-input-number v-model="query.minTotalScore" :min="0" placeholder="最低" controls-position="right" style="width:100px" />
            <span style="margin:0 4px; color:#909399">~</span>
            <el-input-number v-model="query.maxTotalScore" :min="0" placeholder="最高" controls-position="right" style="width:100px" />
          </el-form-item>
        </el-row>
        <el-row :gutter="8" style="margin-top: 8px;">
          <el-form-item label="状态">
            <el-select v-model="query.status" clearable placeholder="全部" style="width:140px">
              <el-option label="草稿" :value="0" />
              <el-option label="启用" :value="1" />
              <el-option label="停用" :value="2" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
            <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
            <el-button @click="toggleViewMode" :type="viewMode === 'card' ? 'primary' : 'default'">
              <el-icon><List v-if="viewMode === 'card'" /><Grid v-else /></el-icon>
              {{ viewMode === 'card' ? '表格' : '卡片' }}
            </el-button>
          </el-form-item>
        </el-row>
      </el-form>
    </el-card>

    <el-card shadow="never" v-loading="loading">
      <div class="toolbar">
        <el-button type="primary" @click="openCreate"><el-icon><Plus /></el-icon>新建试卷</el-button>
      </div>

      <!-- 表格布局（支持多表计算展开行与丰富操作折叠） -->
      <el-table v-if="viewMode === 'table'" :data="list" style="width:100%" row-key="id">
        <!-- 列表折叠展开行：展示深度多维画像 -->
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-detail">
              <!-- 题型与分值配比 -->
              <div class="expand-section">
                <div class="section-title">题型与分值配比（多表计算）</div>
                <div class="type-badges">
                  <el-tag effect="plain" type="primary" class="t-badge">
                    单选题：{{ row.typeCounts?.['SINGLE'] || 0 }} 题 ({{ row.typeScores?.['SINGLE'] || 0 }} 分)
                  </el-tag>
                  <el-tag effect="plain" type="success" class="t-badge">
                    多选题：{{ row.typeCounts?.['MULTIPLE'] || 0 }} 题 ({{ row.typeScores?.['MULTIPLE'] || 0 }} 分)
                  </el-tag>
                  <el-tag effect="plain" type="warning" class="t-badge">
                    判断题：{{ row.typeCounts?.['JUDGE'] || 0 }} 题 ({{ row.typeScores?.['JUDGE'] || 0 }} 分)
                  </el-tag>
                  <el-tag effect="plain" type="info" class="t-badge">
                    填空题：{{ (row.typeCounts?.['FILL'] || 0) + (row.typeCounts?.['FILL_HINT'] || 0) }} 题 ({{ ((row.typeScores?.['FILL'] || 0) + (row.typeScores?.['FILL_HINT'] || 0)) }} 分)
                  </el-tag>
                  <el-tag effect="plain" type="danger" class="t-badge">
                    阅读理解：{{ row.typeCounts?.['READING'] || 0 }} 篇 ({{ row.typeScores?.['READING'] || 0 }} 分)
                  </el-tag>
                </div>
              </div>

              <!-- 考点雷达与难度画像 -->
              <div class="expand-section">
                <div class="section-title">难度指数与考点覆盖</div>
                <div class="meta-row">
                  <span class="meta-label">加权难度：</span>
                  <el-tag :type="diffLevelTag(row.difficultyLevel)" size="small">
                    {{ row.difficultyLevel || '中等' }} ({{ row.avgDifficulty != null ? Number(row.avgDifficulty).toFixed(2) : '2.00' }})
                  </el-tag>
                  <span class="meta-label" style="margin-left:16px">算法建议时长：</span>
                  <span class="meta-val"><el-icon><Timer /></el-icon> {{ row.suggestedDuration || 60 }} 分钟</span>
                  <span class="meta-label" style="margin-left:16px">覆盖语法分类：</span>
                  <span class="meta-val">{{ row.categoryCount || 0 }} 个分类</span>
                  <div v-if="row.categoryNames?.length" class="cat-tags" style="display:inline-flex; gap:4px; margin-left:8px">
                    <el-tag v-for="cat in row.categoryNames" :key="cat" size="small" type="info">{{ cat }}</el-tag>
                  </div>
                </div>
              </div>

              <!-- 历史考试表现 -->
              <div class="expand-section">
                <div class="section-title">历史考试与作答表现（多表动态聚合）</div>
                <div class="stat-boxes">
                  <div class="stat-box">
                    <div class="sb-label">引用场次</div>
                    <div class="sb-val">{{ row.sessionCount || 0 }} 场</div>
                  </div>
                  <div class="stat-box">
                    <div class="sb-label">累计参考</div>
                    <div class="sb-val">{{ row.totalExamined || 0 }} 人次</div>
                  </div>
                  <div class="stat-box">
                    <div class="sb-label">平均得分</div>
                    <div class="sb-val" :style="{ color: scoreColor(row.averageScore) }">{{ row.averageScore != null ? Number(row.averageScore).toFixed(1) : '-' }}</div>
                  </div>
                  <div class="stat-box">
                    <div class="sb-label">综合及格率</div>
                    <div class="sb-val" :style="{ color: (row.passRate ?? 0) >= 60 ? '#67c23a' : '#f56c6c' }">{{ row.passRate != null ? Number(row.passRate).toFixed(1) + '%' : '-' }}</div>
                  </div>
                  <div class="stat-box">
                    <div class="sb-label">最高分 / 最低分</div>
                    <div class="sb-val">{{ row.highestScore ?? '-' }} / {{ row.lowestScore ?? '-' }}</div>
                  </div>
                </div>
              </div>

              <!-- 快捷操作栏 -->
              <div class="expand-actions">
                <el-button type="primary" size="small" @click="openView(row, false)"><el-icon><View /></el-icon> 试卷全景预览</el-button>
                <el-button type="success" size="small" @click="openView(row, true)"><el-icon><DocumentChecked /></el-icon> 一键查看标准答案与解析</el-button>
                <el-button type="warning" size="small" @click="handleCreateExamFromPaper(row)"><el-icon><Calendar /></el-icon> 以此卷创建考试</el-button>
                <el-button size="small" @click="handleCopyPaper(row)"><el-icon><CopyDocument /></el-icon> 快速克隆试卷</el-button>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column type="index" label="#" width="55" />
        <el-table-column prop="paperName" label="试卷名称" min-width="180" show-overflow-tooltip />
        <el-table-column label="题量" width="70" align="center">
          <template #default="{ row }">{{ row.questionCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="总分" width="70" align="center">
          <template #default="{ row }">{{ row.totalScore ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="加权难度" width="95" align="center">
          <template #default="{ row }">
            <el-tag :type="diffLevelTag(row.difficultyLevel)" size="small">
              {{ row.difficultyLevel || '中等' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="考场引用" width="85" align="center">
          <template #default="{ row }">
            <span :style="{ fontWeight:600, color: (row.sessionCount ?? 0) > 0 ? '#409eff' : '#909399' }">
              {{ row.sessionCount ?? 0 }} 场
            </span>
          </template>
        </el-table-column>
        <el-table-column label="参考人次" width="85" align="center">
          <template #default="{ row }">
            <span :style="{ fontWeight:600, color: (row.totalExamined ?? 0) > 0 ? '#67c23a' : '#909399' }">
              {{ row.totalExamined ?? 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="及格率" width="85" align="center">
          <template #default="{ row }">
            <span v-if="row.passRate != null" :style="{ fontWeight:600, color: Number(row.passRate) >= 60 ? '#67c23a' : '#f56c6c' }">
              {{ Number(row.passRate).toFixed(1) }}%
            </span>
            <span v-else style="color:#c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="85" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="165" show-overflow-tooltip />
        <el-table-column label="操作" width="240" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openView(row, false)">
              <el-icon><View /></el-icon>查看
            </el-button>
            <el-button type="primary" link size="small" @click="openEdit(row)">
              <el-icon><Edit /></el-icon>编辑
            </el-button>
            <el-dropdown trigger="click" style="margin-left:8px">
              <el-button link type="info" size="small">
                更多<el-icon><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="openView(row, true)">
                    <el-icon><DocumentChecked /></el-icon>一键查看答案与解析
                  </el-dropdown-item>
                  <el-dropdown-item @click="handleCreateExamFromPaper(row)">
                    <el-icon><Calendar /></el-icon>以此卷创建考试
                  </el-dropdown-item>
                  <el-dropdown-item @click="handleCopyPaper(row)">
                    <el-icon><CopyDocument /></el-icon>快速克隆试卷
                  </el-dropdown-item>
                  <el-dropdown-item @click="exportPaper(row, false)">
                    <el-icon><Download /></el-icon>导出学生答卷版
                  </el-dropdown-item>
                  <el-dropdown-item @click="exportPaper(row, true)">
                    <el-icon><Download /></el-icon>导出教师解析版
                  </el-dropdown-item>
                  <el-dropdown-item v-if="row.status !== 1" divided @click="publish(row)">
                    发布上线
                  </el-dropdown-item>
                  <el-dropdown-item v-else divided @click="unpublish(row)">
                    下架试卷
                  </el-dropdown-item>
                  <el-dropdown-item style="color:#f56c6c" @click="confirmDelete(row)">
                    <el-icon><Delete /></el-icon>删除试卷
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <!-- 卡片网格布局 -->
      <div v-else class="paper-grid">
        <el-card
          v-for="item in list"
          :key="item.id"
          class="paper-card"
          hover
          @click="openEdit(item)"
        >
          <div class="card-header">
            <span class="paper-id">#{{ item.id }}</span>
            <el-tag :type="statusType(item.status)">{{ statusText(item.status) }}</el-tag>
            <el-tag v-if="item.archiveStatus === 1" type="info">已归档</el-tag>
          </div>
          <div class="card-title">{{ item.paperName }}</div>
          <div v-if="item.description" class="card-desc">{{ item.description }}</div>
          <div class="card-stats">
            <div class="stat-item">
              <span class="stat-num">{{ item.questionCount ?? 0 }}</span>
              <span class="stat-label">题量</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">{{ item.totalScore ?? 0 }}</span>
              <span class="stat-label">总分</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">{{ item.passScore ?? 60 }}</span>
              <span class="stat-label">及格分</span>
            </div>
            <!-- [2026-10-28] 原「建议时长」统计位：读的是 exam_paper.suggested_duration（无写入点恒 NULL），
                 卡片上恒显示「-」⇒ 删除，避免留下一格假数据 -->
          </div>
          <div class="card-footer">
            <span class="create-time">{{ item.createTime || '-' }}</span>
            <div class="actions">
              <el-button type="primary" @click.stop="openView(item)">查看</el-button>
              <el-button v-if="item.status !== 1" type="success" @click.stop="publish(item)">发布</el-button>
              <el-button v-else type="warning" @click.stop="unpublish(item)">下架</el-button>
              <el-button type="danger" @click.stop="confirmDelete(item)">删除</el-button>
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
          :page-sizes="[10, 20, 50, 100, 200, 500, 1000]"
          @size-change="load"
          @current-change="load"
        />
      </div>
    </el-card>

    <!-- 组卷 Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="editMode === 'create' ? '新建试卷' : '编辑试卷'"
      width="920px"
      top="4vh"
      :close-on-click-modal="false"
    >
      <el-steps :active="step" finish-status="success" align-center>
        <el-step title="基本信息" />
        <el-step title="选择题目" />
        <el-step title="预览确认" />
      </el-steps>

      <div class="step-body">
        <!-- Step 1 -->
        <el-form v-if="step === 0" ref="baseFormRef" :model="paperForm" :rules="baseRules" label-width="90px" style="margin-top: 20px">
          <el-form-item label="试卷名称" prop="paperName">
            <el-input v-model="paperForm.paperName" placeholder="如：初级语法综合测验" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="paperForm.description" type="textarea" :rows="3" placeholder="试卷描述（可选）" />
          </el-form-item>
          <el-form-item label="及格分">
            <el-input-number v-model="paperForm.passScore" :min="0" :max="1000" />
          </el-form-item>
          <!-- [2026-10-28] 原「随机乱序」el-form-item + el-switch 已删除：
               后端 exam_paper.shuffle_questions 在取题排序里完全不被读取，该开关拨了也不生效，属假功能 -->
          <el-form-item label="状态">
            <el-radio-group v-model="paperForm.status">
              <el-radio :value="0">草稿</el-radio>
              <el-radio :value="1">启用</el-radio>
              <el-radio :value="2">停用</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>

        <!-- Step 2 -->
        <div v-else-if="step === 1">
          <div class="step2-header">
            <div>
              已选 <b>{{ pickedQuestionCount }}</b> 道题（{{ picked.length }} 个单元），总分 <b style="color:#409eff">{{ totalScore }}</b>
            </div>
            <el-button type="primary" @click="openBank">
              <el-icon><Plus /></el-icon>从题库选题
            </el-button>
          </div>
          <el-table :data="picked" style="width:100%; margin-top:12px" empty-text="尚未选题，请点击右上角">
            <el-table-column type="index" label="单元" width="70" />
            <el-table-column label="题目单元" min-width="420">
              <template #default="{ row }">
                <template v-if="row.unitType === 'READING'">
                  <div class="picked-passage">
                    <strong>阅读理解 · {{ row.passageTitle }}</strong>
                    <div class="picked-passage-content">{{ row.passageContent }}</div>
                    <div v-for="(question, qi) in row.subQuestions" :key="question.questionId" class="picked-sub-question">
                      <span>{{ qi + 1 }}. {{ question.stem }}</span>
                      <el-input-number v-model="question.score" :min="0.5" :max="100" :step="0.5" />
                    </div>
                  </div>
                </template>
                <span v-else>{{ row.stem }}</span>
              </template>
            </el-table-column>
            <el-table-column label="题型" width="100">
              <template #default="{ row }">{{ row.unitType === 'READING' ? '阅读理解' : typeLabel(row.questionType) }}</template>
            </el-table-column>
            <el-table-column label="难度" width="80">
              <template #default="{ row }">
                <el-tag :type="diffTagType(row.difficulty)">{{ diffLabel(row.difficulty) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="单元总分" width="150" align="center">
              <template #default="{ row }">
                <el-input-number v-if="row.unitType === 'QUESTION'" v-model="row.score" :min="0.5" :max="100" :step="0.5" />
                <span v-else>{{ unitScore(row) }} 分 · {{ row.subQuestions.length }} 小题</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="95" align="center">
              <template #default="{ row }">
                <el-button link type="danger" @click="removePicked(row)">移除单元</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- Step 3 -->
        <div v-else-if="step === 2" class="step3">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="试卷名称">{{ paperForm.paperName }}</el-descriptions-item>
            <el-descriptions-item label="题量">{{ pickedQuestionCount }}</el-descriptions-item>
            <el-descriptions-item label="总分">{{ totalScore }}</el-descriptions-item>
            <el-descriptions-item label="及格分">{{ paperForm.passScore ?? '-' }}</el-descriptions-item>
            <!-- [2026-10-28] 原「随机乱序」预览行恒显示「否」（后端不读该列），随表单开关删除 -->
            <el-descriptions-item label="状态">{{ statusText(paperForm.status) }}</el-descriptions-item>
            <el-descriptions-item label="描述" :span="2">{{ paperForm.description || '-' }}</el-descriptions-item>
          </el-descriptions>
          <h4 style="margin-top:16px">题目列表</h4>
          <el-table :data="picked" style="width:100%">
            <el-table-column type="index" label="#" width="60" />
            <el-table-column label="题目单元" min-width="420">
              <template #default="{ row }">
                <template v-if="row.unitType === 'READING'">
                  <div class="picked-passage">
                    <strong>阅读理解 · {{ row.passageTitle }}</strong>
                    <div class="picked-passage-content">{{ row.passageContent }}</div>
                    <div v-for="(question, qi) in row.subQuestions" :key="question.questionId" class="picked-sub-question">
                      <span>{{ qi + 1 }}. {{ question.stem }}</span>
                      <span>{{ question.score }} 分</span>
                    </div>
                  </div>
                </template>
                <span v-else>{{ row.stem }}</span>
              </template>
            </el-table-column>
            <el-table-column label="题型" width="100">
              <template #default="{ row }">{{ row.unitType === 'READING' ? '阅读理解' : typeLabel(row.questionType) }}</template>
            </el-table-column>
            <el-table-column label="单元总分" width="100" align="center">
              <template #default="{ row }">{{ unitScore(row) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <template #footer>
        <el-button v-if="step > 0" @click="prevStep">上一步</el-button>
        <el-button v-if="step < 2" type="primary" @click="nextStep">下一步</el-button>
        <el-button v-else type="primary" :loading="submitting" @click="submit">保存试卷</el-button>
      </template>
    </el-dialog>

    <!-- 题库选择器 -->
    <el-dialog v-model="bankVisible" title="从题库选题" width="1000px" top="4vh" append-to-body>
      <el-form :inline="true" :model="bank">
        <el-form-item label="题目范围">
          <el-radio-group v-model="bankKind" @change="bank.pageNum = 1; loadBank()">
            <el-radio-button value="question">独立题</el-radio-button>
            <el-radio-button value="reading">阅读理解</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <el-input v-model="bank.keyword" :placeholder="bankKind === 'reading' ? '文章关键词' : '题干关键词'" clearable style="width:180px" />
        </el-form-item>
        <el-form-item>
          <el-cascader
            v-model="bank.categoryId"
            :options="categories"
            :props="{ value: 'id', label: 'categoryName', children: 'children', checkStrictly: true, emitPath: false }"
            clearable placeholder="分类" style="width:180px"
          />
        </el-form-item>
        <el-form-item v-if="bankKind === 'question'">
          <el-select v-model="bank.questionType" clearable placeholder="题型" style="width:120px">
            <el-option v-for="op in typeOptions" :key="op.value" :label="op.label" :value="op.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-select v-model="bank.difficulty" clearable placeholder="难度" style="width:100px">
            <el-option v-for="op in diffOptions" :key="op.value" :label="op.label" :value="op.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="bankSearch"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="bankReset"><el-icon><Refresh /></el-icon>重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-if="bankKind === 'question'" :data="bankList" v-loading="bankLoading" style="width:100%">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="stem" label="题干" min-width="300" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="分类" width="120" />
        <el-table-column label="题型" width="90">
          <template #default="{ row }">{{ typeLabel(row.questionType) }}</template>
        </el-table-column>
        <el-table-column label="难度" width="80">
          <template #default="{ row }">
            <el-tag :type="diffTagType(row.difficulty)">{{ diffLabel(row.difficulty) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-button type="primary" :disabled="pickedIds.has(row.id)" @click="addQuestion(row)">
              {{ pickedIds.has(row.id) ? '已加入' : '加入' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-table v-else :data="passageBankList" v-loading="bankLoading" style="width:100%">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column label="阅读文章" min-width="300">
          <template #default="{ row }">
            <div class="passage-choice-title">{{ row.title || '阅读短文' }}</div>
            <div class="passage-choice-content">{{ row.content }}</div>
            <div v-for="(question, qi) in (row.questions ?? []).slice(0, 3)" :key="question.id" class="passage-choice-question">
              {{ qi + 1 }}. {{ question.stem }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="categoryName" label="分类" width="120" />
        <el-table-column label="小题数" width="85" align="center">
          <template #default="{ row }">{{ row.questions?.length ?? 0 }}</template>
        </el-table-column>
        <el-table-column prop="totalScore" label="总分" width="80" align="center" />
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-button type="primary" :disabled="isPassagePicked(row.id)" @click="addPassage(row)">
              {{ isPassagePicked(row.id) ? '已加入' : '加入整组' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination
          v-model:current-page="bank.pageNum"
          v-model:page-size="bank.pageSize"
          :total="bank.total"
          layout="total, prev, pager, next"
          @current-change="loadBank"
        />
      </div>
      <template #footer>
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%">
          <span>已选 {{ pickedQuestionCount }} 道题（{{ picked.length }} 个单元），总分 {{ totalScore }}</span>
          <el-button type="primary" @click="bankVisible = false">完成</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 查看试卷(含题目、答案、解析 —— 论文 4.2.2 管理员预览) -->
    <el-dialog v-model="viewVisible" :title="'查看试卷：' + (viewPaper?.paperName || '')" width="950px" top="4vh">
      <!-- 预览操作工具栏：一键开关答案与解析、复制、导出 -->
      <div class="view-ctrl-bar">
        <div class="view-ctrl-left">
          <el-switch
            v-model="showAllAnswers"
            active-text="👁️ 一键显示标准答案与逐题解析"
            inactive-text="隐藏答案与解析（答卷视角）"
            style="--el-switch-on-color: #67c23a"
          />
        </div>
        <div class="view-ctrl-right">
          <el-button size="small" @click="copyPaperText">
            <el-icon><CopyDocument /></el-icon>复制试卷文本
          </el-button>
          <el-button size="small" type="primary" plain @click="exportPaper(viewPaper!, showAllAnswers)">
            <el-icon><Download /></el-icon>导出 Markdown
          </el-button>
        </div>
      </div>

      <el-descriptions :column="4" border style="margin-bottom:12px">
        <el-descriptions-item label="题量">{{ viewPaper?.questionCount ?? viewQuestions.length }}</el-descriptions-item>
        <el-descriptions-item label="总分">{{ viewPaper?.totalScore ?? viewQuestions.length * 2 }}</el-descriptions-item>
        <el-descriptions-item label="及格分">{{ viewPaper?.passScore ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="建议时长">{{ viewPaper?.suggestedDuration || 60 }} 分钟</el-descriptions-item>
      </el-descriptions>

      <!-- 使用统计：全部实时聚合 exam_session / exam_record / exam_score / answer_record，不落库 -->
      <div v-loading="paperStatsLoading" class="paper-stats">
        <template v-if="paperStats">
          <div class="ps-row">
            <div class="ps-item">
              <div class="ps-num">{{ paperStats.sessionCount }}</div>
              <div class="ps-name">引用场次</div>
            </div>
            <div class="ps-item">
              <div class="ps-num">{{ paperStats.recordCount }}</div>
              <div class="ps-name">参考人次</div>
            </div>
            <div class="ps-item">
              <div class="ps-num">{{ paperStats.scoredCount }}</div>
              <div class="ps-name">已出分</div>
            </div>
            <div class="ps-item">
              <div class="ps-num" :style="{ color: accColor(paperStats.utilizationRate) }">
                {{ Number(paperStats.utilizationRate ?? 0).toFixed(1) }}%
              </div>
              <div class="ps-name">利用率</div>
            </div>
            <div class="ps-item">
              <div class="ps-num">{{ Number(paperStats.averageScore ?? 0).toFixed(1) }}</div>
              <div class="ps-name">平均分</div>
            </div>
            <div class="ps-item">
              <div class="ps-num">{{ Number(paperStats.highestScore ?? 0).toFixed(1) }}</div>
              <div class="ps-name">最高分</div>
            </div>
            <div class="ps-item">
              <div class="ps-num">{{ Number(paperStats.lowestScore ?? 0).toFixed(1) }}</div>
              <div class="ps-name">最低分</div>
            </div>
            <div class="ps-item">
              <div class="ps-num" :style="{ color: accColor(paperStats.overallAccuracy) }">
                {{ Number(paperStats.overallAccuracy ?? 0).toFixed(1) }}%
              </div>
              <div class="ps-name">正确率</div>
            </div>
          </div>

          <div v-if="paperStats.sessionCount === 0" class="ps-tip">
            该试卷尚未被任何考试场次引用，统计为空
          </div>
          <div v-else-if="paperStats.scoredCount === 0" class="ps-tip">
            已被 {{ paperStats.sessionCount }} 个场次引用，但还没有考生出分
          </div>

          <div class="ps-dims">
            <div v-if="paperStats.typeAccuracies?.length" class="ps-dim">
              <div class="ps-dim-title">按题型正确率</div>
              <div v-for="r in paperStats.typeAccuracies" :key="r.name" class="ps-dim-row">
                <span class="ps-dim-name">{{ r.name }}</span>
                <el-progress
                  :percentage="Number(Number(r.accuracy).toFixed(1))"
                  :color="accColor(r.accuracy)"
                  :stroke-width="14"
                  :show-text="false"
                  class="ps-bar"
                />
                <span class="ps-dim-val" :style="{ color: accColor(r.accuracy) }">
                  {{ Number(r.accuracy).toFixed(1) }}%
                </span>
                <span class="ps-dim-cnt">({{ r.correctCount }}/{{ r.totalAttempts }})</span>
              </div>
            </div>
            <div v-if="paperStats.categoryAccuracies?.length" class="ps-dim">
              <div class="ps-dim-title">按语法分类正确率（作答量前 8）</div>
              <div
                v-for="r in paperStats.categoryAccuracies.slice(0, 8)"
                :key="r.id ?? r.name"
                class="ps-dim-row"
              >
                <span class="ps-dim-name" :title="r.name">{{ r.name }}</span>
                <el-progress
                  :percentage="Number(Number(r.accuracy).toFixed(1))"
                  :color="accColor(r.accuracy)"
                  :stroke-width="14"
                  :show-text="false"
                  class="ps-bar"
                />
                <span class="ps-dim-val" :style="{ color: accColor(r.accuracy) }">
                  {{ Number(r.accuracy).toFixed(1) }}%
                </span>
                <span class="ps-dim-cnt">({{ r.correctCount }}/{{ r.totalAttempts }})</span>
              </div>
            </div>
          </div>
        </template>
        <el-empty v-else-if="!paperStatsLoading" description="暂无统计数据" :image-size="50" />
      </div>

      <div v-loading="viewLoading">
        <el-empty v-if="!viewLoading && viewQuestions.length === 0" description="卷内无题目" />
        <div v-for="(unit, idx) in viewQuestions" :key="unit.unitType === 'READING' ? `p-${unit.passageId}` : `q-${unit.questionId}`" class="view-q">
          <template v-if="unit.unitType === 'READING'">
            <div class="view-q-head">
              <span class="q-no">{{ idx + 1 }}.</span>
              <el-tag type="warning">阅读理解</el-tag>
              <span class="q-score">{{ unitScore(unit) }} 分 · {{ unit.subQuestions.length }} 小题</span>
            </div>
            <h4>{{ unit.passageTitle }}</h4>
            <div class="q-stem">{{ unit.passageContent }}</div>
            <div v-for="(question, qi) in unit.subQuestions" :key="question.questionId" class="view-sub-question">
              <div class="view-q-head">
                <span class="q-no">{{ qi + 1 }}.</span>
                <el-tag>{{ typeLabel(question.questionType) }}</el-tag>
                <span class="q-score">{{ question.score }} 分</span>
                <el-button link type="primary" style="margin-left:auto" @click="loadAnswer(question.questionId)">
                  {{ viewAnswers[question.questionId] ? '隐藏答案' : '查看答案与解析' }}
                </el-button>
              </div>
              <div class="q-stem">{{ question.stem }}</div>
              <div v-if="showAllAnswers || viewAnswers[question.questionId]" class="q-answer">
                <div v-for="option in (viewAnswers[question.questionId]?.options ?? [])" :key="option.optionLabel" class="q-opt">
                  <b>{{ option.optionLabel }}.</b> {{ option.optionContent }}
                </div>
                <div class="q-ana"><b>标准答案：{{ formatAnswerText(viewAnswers[question.questionId]?.standardAnswer, question.questionType) }}</b></div>
                <div class="q-ana">解析：{{ viewAnswers[question.questionId]?.analysis || '(无解析)' }}</div>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="view-q-head">
              <span class="q-no">{{ idx + 1 }}.</span>
              <el-tag>{{ typeLabel(unit.questionType) }}</el-tag>
              <el-tag :type="diffTagType(unit.difficulty)" style="margin-right:6px">{{ diffLabel(unit.difficulty) }}</el-tag>
              <span class="q-score">{{ unit.score }} 分</span>
              <el-button link type="primary" style="margin-left:auto" @click="loadAnswer(unit.questionId)">
                {{ viewAnswers[unit.questionId] ? '隐藏答案' : '查看答案与解析' }}
              </el-button>
            </div>
            <div class="q-stem">{{ unit.stem }}</div>
            <div v-if="showAllAnswers || viewAnswers[unit.questionId]" class="q-answer">
              <template v-for="option in (viewAnswers[unit.questionId]?.options ?? [])" :key="option.optionLabel">
                <div class="q-opt" :class="{ 'q-opt-right': option.optionLabel === viewAnswers[unit.questionId]?.standardAnswer }">
                  <b>{{ option.optionLabel }}.</b> {{ option.optionContent }}
                </div>
              </template>
              <div class="q-ana"><b>标准答案：{{ formatAnswerText(viewAnswers[unit.questionId]?.standardAnswer, unit.questionType) }}</b></div>
              <div class="q-ana">解析：{{ viewAnswers[unit.questionId]?.analysis || '(无解析)' }}</div>
            </div>
          </template>
        </div>
      </div>
      <template #footer>
        <el-button @click="viewVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.view-q { border: 1px solid #ebeef5; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; }
.view-q-head { display: flex; align-items: center; gap: 4px; }
.q-no { font-weight: 600; }
.q-score { color: #909399; font-size: 12px; }
.q-stem { margin: 8px 0; white-space: pre-wrap; }
.q-answer { background: #f5f7fa; border-radius: 6px; padding: 8px 12px; margin-top: 6px; }
.q-opt { padding: 2px 0; }
.q-opt-right { color: #67c23a; font-weight: 600; }
.q-ana { margin-top: 6px; color: #606266; font-size: 13px; }
.page { display: flex; flex-direction: column; gap: 12px; }
.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.toolbar { margin-bottom: 12px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }

.step-body { min-height: 300px; padding: 8px 4px; }
.step2-header { display: flex; justify-content: space-between; align-items: center; padding-top: 16px; }
.step3 h4 { margin: 12px 0; font-size: 14px; color: #606266; }

.paper-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.paper-card {
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

.paper-id {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}

.card-desc {
  font-size: 13px;
  color: #909399;
  line-height: 1.5;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 20px;
  font-weight: 700;
  color: #409eff;
}

.stat-label {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.create-time {
  font-size: 12px;
  color: #909399;
}

.actions {
  display: flex;
  gap: 6px;
}
.picked-passage { display: grid; gap: 8px; min-width: 0; }
.picked-passage-content,
.passage-choice-content {
  color: #606266;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.picked-sub-question {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #ebeef5;
  padding-top: 6px;
}
.passage-choice-title { font-weight: 600; margin-bottom: 4px; }
.passage-choice-question { color: #606266; margin-top: 4px; font-size: 12px; }
.view-sub-question { border-top: 1px solid #ebeef5; padding-top: 8px; margin-top: 8px; }

/* ---------- 试卷使用统计（实时聚合） ---------- */
.paper-stats {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #fafbfc;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  min-height: 64px;
}

.ps-row {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
}

.ps-item {
  text-align: center;
  padding: 6px 2px;
  background: #fff;
  border: 1px solid #f0f2f5;
  border-radius: 6px;
}

.ps-num {
  font-size: 17px;
  font-weight: 650;
  line-height: 1.2;
  color: #303133;
  font-variant-numeric: tabular-nums;
}

.ps-name {
  margin-top: 3px;
  font-size: 11px;
  color: #909399;
}

.ps-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #e6a23c;
}

.ps-dims {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e4e7ed;
}

.ps-dim-title {
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 6px;
}

.ps-dim-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
}

.ps-dim-name {
  width: 96px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #606266;
}

.ps-bar { flex: 1; min-width: 40px; }

.ps-dim-val {
  width: 48px;
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.ps-dim-cnt {
  width: 62px;
  text-align: right;
  color: #909399;
  font-size: 11px;
}


/* ---------------- 顶部大盘与折叠展开行样式 ---------------- */
.stat-banner {
  margin-bottom: 16px;
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
.text-info { color: #909399; }

.expand-detail {
  padding: 16px 24px;
  background: #f8fafc;
  border-radius: 6px;
}
.expand-section {
  margin-bottom: 12px;
}
.expand-section .section-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.type-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.t-badge {
  font-size: 13px;
  padding: 6px 10px;
}
.meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  font-size: 13px;
}
.meta-label {
  color: #606266;
  font-weight: 500;
}
.meta-val {
  color: #303133;
  font-weight: 600;
}
.stat-boxes {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.stat-box {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 8px 16px;
  min-width: 120px;
}
.stat-box .sb-label {
  font-size: 12px;
  color: #909399;
}
.stat-box .sb-val {
  font-size: 15px;
  font-weight: 600;
  margin-top: 2px;
}
.expand-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed #dcdfe6;
}

.view-ctrl-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #ecf5ff;
  border: 1px solid #d9ecff;
  border-radius: 6px;
  margin-bottom: 12px;
}

</style>
