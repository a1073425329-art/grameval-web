<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { List, Grid } from '@element-plus/icons-vue'
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
  type AdminQuestionQuery,
} from '@/api/admin'
import { getQuestionDetail } from '@/api/student'
import type { Paper, PaperForm } from '@/types/paper'
import type { Question } from '@/types/question'
import type { ReadingPassage } from '@/types/reading'
import type { Category } from '@/types/category'
import type { QuestionType, Difficulty } from '@/types/common'
import { useViewMode } from '@/composables/useViewMode'

const { viewMode, toggleViewMode } = useViewMode('paper_manage')

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
  shuffleQuestions: false,
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
  Object.assign(paperForm, { id: 0, paperName: '', description: '', passScore: 60, shuffleQuestions: false, status: 0 })
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
  paperForm.shuffleQuestions = !!row.shuffleQuestions
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
    shuffleQuestions: paperForm.shuffleQuestions,
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

const openView = async (row: Paper) => {
  viewPaper.value = row
  viewQuestions.value = []
  viewAnswers.value = {}
  viewVisible.value = true
  viewLoading.value = true
  try {
    const res = await getPaperDetail(row.id)
    viewQuestions.value = (res.data.questions ?? []).map((unit): PickedUnit => {
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
            <el-button @click="toggleViewMode" :type="viewMode === 'card' ? 'primary' : 'default'" size="small">
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

      <!-- 表格布局 -->
      <el-table v-if="viewMode === 'table'" :data="list" style="width:100%">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="paperName" label="试卷名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
        <el-table-column label="题量" width="80" align="center">
          <template #default="{ row }">{{ row.questionCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="总分" width="80" align="center">
          <template #default="{ row }">{{ row.totalScore ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="及格分" width="80" align="center">
          <template #default="{ row }">{{ row.passScore ?? 60 }}</template>
        </el-table-column>
        <el-table-column label="建议时长" width="100" align="center">
          <template #default="{ row }">{{ row.suggestedDuration ? row.suggestedDuration + ' 分钟' : '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="归档" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.archiveStatus === 1" type="info" size="small">已归档</el-tag>
            <span v-else style="color:#c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="200" align="center">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="openView(row)">查看</el-button>
            <el-button v-if="row.status !== 1" type="success" size="small" @click="publish(row)">发布</el-button>
            <el-button v-else type="warning" size="small" @click="unpublish(row)">下架</el-button>
            <el-button type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
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
            <el-tag :type="statusType(item.status)" size="small">{{ statusText(item.status) }}</el-tag>
            <el-tag v-if="item.archiveStatus === 1" type="info" size="small">已归档</el-tag>
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
            <div class="stat-item">
              <span class="stat-num">{{ item.suggestedDuration ? item.suggestedDuration + '分' : '-' }}</span>
              <span class="stat-label">建议时长</span>
            </div>
          </div>
          <div class="card-footer">
            <span class="create-time">{{ item.createTime || '-' }}</span>
            <div class="actions">
              <el-button type="primary" size="small" @click.stop="openView(item)">查看</el-button>
              <el-button v-if="item.status !== 1" type="success" size="small" @click.stop="publish(item)">发布</el-button>
              <el-button v-else type="warning" size="small" @click.stop="unpublish(item)">下架</el-button>
              <el-button type="danger" size="small" @click.stop="confirmDelete(item)">删除</el-button>
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
          <el-form-item label="随机乱序">
            <el-switch v-model="paperForm.shuffleQuestions" />
          </el-form-item>
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
                      <el-input-number v-model="question.score" :min="0.5" :max="100" :step="0.5" size="small" />
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
                <el-tag :type="diffTagType(row.difficulty)" size="small">{{ diffLabel(row.difficulty) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="单元总分" width="150" align="center">
              <template #default="{ row }">
                <el-input-number v-if="row.unitType === 'QUESTION'" v-model="row.score" :min="0.5" :max="100" :step="0.5" size="small" />
                <span v-else>{{ unitScore(row) }} 分 · {{ row.subQuestions.length }} 小题</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="95" align="center">
              <template #default="{ row }">
                <el-button link type="danger" size="small" @click="removePicked(row)">移除单元</el-button>
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
            <el-descriptions-item label="随机乱序">{{ paperForm.shuffleQuestions ? '是' : '否' }}</el-descriptions-item>
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
            <el-tag size="small" :type="diffTagType(row.difficulty)">{{ diffLabel(row.difficulty) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-button size="small" type="primary" :disabled="pickedIds.has(row.id)" @click="addQuestion(row)">
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
            <el-button size="small" type="primary" :disabled="isPassagePicked(row.id)" @click="addPassage(row)">
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
    <el-dialog v-model="viewVisible" :title="'查看试卷：' + (viewPaper?.paperName || '')" width="900px" top="4vh">
      <el-descriptions :column="4" size="small" border style="margin-bottom:12px">
        <el-descriptions-item label="题量">{{ viewPaper?.questionCount ?? viewQuestions.length }}</el-descriptions-item>
        <el-descriptions-item label="总分">{{ viewPaper?.totalScore ?? viewQuestions.length * 2 }}</el-descriptions-item>
        <el-descriptions-item label="及格分">{{ viewPaper?.passScore ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ statusText(viewPaper?.status ?? 0) }}</el-descriptions-item>
      </el-descriptions>
      <div v-loading="viewLoading">
        <el-empty v-if="!viewLoading && viewQuestions.length === 0" description="卷内无题目" />
        <div v-for="(unit, idx) in viewQuestions" :key="unit.unitType === 'READING' ? `p-${unit.passageId}` : `q-${unit.questionId}`" class="view-q">
          <template v-if="unit.unitType === 'READING'">
            <div class="view-q-head">
              <span class="q-no">{{ idx + 1 }}.</span>
              <el-tag size="small" type="warning">阅读理解</el-tag>
              <span class="q-score">{{ unitScore(unit) }} 分 · {{ unit.subQuestions.length }} 小题</span>
            </div>
            <h4>{{ unit.passageTitle }}</h4>
            <div class="q-stem">{{ unit.passageContent }}</div>
            <div v-for="(question, qi) in unit.subQuestions" :key="question.questionId" class="view-sub-question">
              <div class="view-q-head">
                <span class="q-no">{{ qi + 1 }}.</span>
                <el-tag size="small">{{ typeLabel(question.questionType) }}</el-tag>
                <span class="q-score">{{ question.score }} 分</span>
                <el-button link type="primary" size="small" style="margin-left:auto" @click="loadAnswer(question.questionId)">
                  {{ viewAnswers[question.questionId] ? '隐藏答案' : '查看答案与解析' }}
                </el-button>
              </div>
              <div class="q-stem">{{ question.stem }}</div>
              <div v-if="viewAnswers[question.questionId]" class="q-answer">
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
              <el-tag size="small">{{ typeLabel(unit.questionType) }}</el-tag>
              <el-tag size="small" :type="diffTagType(unit.difficulty)" style="margin-right:6px">{{ diffLabel(unit.difficulty) }}</el-tag>
              <span class="q-score">{{ unit.score }} 分</span>
              <el-button link type="primary" size="small" style="margin-left:auto" @click="loadAnswer(unit.questionId)">
                {{ viewAnswers[unit.questionId] ? '隐藏答案' : '查看答案与解析' }}
              </el-button>
            </div>
            <div class="q-stem">{{ unit.stem }}</div>
            <div v-if="viewAnswers[unit.questionId]" class="q-answer">
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

</style>
