<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate, generatePaperFromTemplate, checkTemplateAvailability } from '@/api/paperTemplate'
import type { PaperTemplate, PaperTemplateForm, QuestionConfigRow, GenerateSource } from '@/types/paperTemplate'
import { useRouter } from 'vue-router'
import {
  paperScoreDict, getQuestionTypeLabel, questionTypeDict,
  examTypePresets, getExamTypePreset, getExamTypeLabel,
} from '@/utils/dict'
import { listCategoryTree } from '@/api/admin'
import CategoryMultiPicker from '@/components/CategoryMultiPicker.vue'
import { directGenerate } from '@/api/ai'

const router = useRouter()
const tableData = ref<PaperTemplate[]>([])
const loading = ref(false)
const total = ref(0)
const query = reactive({ pageNum: 1, pageSize: 50, templateName: '', status: undefined as number | undefined })
/** 视图：table 列表（默认）/ card 卡片 */
const viewMode = ref<'table' | 'card'>('table')

const load = async () => {
  loading.value = true
  try {
    const res = await listTemplates(query)
    tableData.value = res.data?.records ?? []
    total.value = res.data?.total ?? 0
  } finally { loading.value = false }
}

interface CategoryNode { id: number; categoryName: string; children?: CategoryNode[] }
const categories = ref<CategoryNode[]>([])
const loadCategories = async () => {
  try {
    const res = await listCategoryTree()
    categories.value = (res.data ?? []) as unknown as CategoryNode[]
  } catch { /* ignore */ }
}
onMounted(() => { load(); loadCategories() })

type View = 'list' | 'edit'
const view = ref<View>('list')
const editingId = ref(0)
const saving = ref(false)
const formRef = ref<FormInstance>()

const configRows = ref<QuestionConfigRow[]>([])
const diffMix = reactive({ easy: 30, medium: 50, hard: 20 })
const diffSum = computed(() => diffMix.easy + diffMix.medium + diffMix.hard)
const diffValid = computed(() => diffSum.value === 100)
const categoryIds = ref<number[]>([])
const generateSource = ref<GenerateSource>('BANK')
const examType = ref<string>('CUSTOM')

const form = reactive<PaperTemplateForm & { id: number }>({
  id: 0, templateName: '', description: '', questionConfig: '[]',
  difficultyDistribution: '', knowledgeRequirements: '', gradeLevel: '',
  generateSource: 'BANK', aiNotes: '', totalScore: 100, questionCount: 100, status: 1,
})

const totalFromRows = computed(() => configRows.value.reduce((s, r) => s + r.count * r.score, 0))
const countFromRows = computed(() => configRows.value.reduce((s, r) => s + r.count, 0))
const onePointOneQ = computed(() => countFromRows.value === totalFromRows.value)

const SOURCE_OPTIONS: Array<{ value: GenerateSource; title: string; desc: string; icon: string; tone: string }> = [
  { value: 'BANK', title: '题库抽题', desc: '从 3 万+ 题库按规则随机抽，秒出卷', icon: '📚', tone: 'bank' },
  { value: 'AI', title: 'AI 造新题', desc: '按规则现生成全新题目，适合查漏补缺', icon: '✨', tone: 'ai' },
  { value: 'MIX', title: '混合出卷', desc: '题库为主，不足部分 AI 补齐', icon: '⚡', tone: 'mix' },
]

const DEFAULT_ROWS = (): QuestionConfigRow[] => [
  { type: 'SINGLE', count: 40, score: 1, difficulty: [1, 2] },
  { type: 'MULTIPLE', count: 15, score: 1, difficulty: [2, 3] },
  { type: 'JUDGE', count: 15, score: 1, difficulty: [1, 2] },
  { type: 'FILL_HINT', count: 10, score: 1, difficulty: [2, 3] },
  { type: 'READING', count: 20, score: 1, difficulty: [2] },
]

const applyExamPreset = (val: string) => {
  const p = getExamTypePreset(val)
  if (!p) return
  form.totalScore = p.totalScore
  form.questionCount = p.questionCount
  diffMix.easy = p.easyPct
  diffMix.medium = p.mediumPct
  diffMix.hard = p.hardPct
  const rows = configRows.value
  const n = rows.reduce((s, r) => s + r.count, 0)
  rows.forEach((r) => { r.score = 1 })
  if (n > 0 && rows.length) {
    let assigned = 0
    rows.forEach((r, i) => {
      if (i === rows.length - 1) r.count = p.questionCount - assigned
      else {
        r.count = Math.max(0, Math.round((r.count / n) * p.questionCount))
        assigned += r.count
      }
    })
    const lastRow = rows.at(-1)
    const firstRow = rows[0]
    if (lastRow && firstRow && lastRow.count < 0) {
      firstRow.count += lastRow.count
      lastRow.count = 0
    }
  }
}
watch(examType, applyExamPreset)

const alignOnePointOneQ = () => {
  configRows.value.forEach((r) => { r.score = 1 })
  const target = form.totalScore
  const rows = configRows.value
  const n = rows.reduce((s, r) => s + r.count, 0)
  if (n <= 0 || !rows.length) return
  let assigned = 0
  rows.forEach((r, i) => {
    if (i === rows.length - 1) r.count = target - assigned
    else {
      r.count = Math.max(0, Math.round((r.count / n) * target))
      assigned += r.count
    }
  })
  form.questionCount = countFromRows.value
}

const rules: FormRules = {
  templateName: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
}

const serializeForm = (): PaperTemplateForm => {
  const questionConfig = JSON.stringify(
    configRows.value.map((r) => ({ type: r.type, count: r.count, score: r.score, difficulty: r.difficulty }))
  )
  const difficultyDistribution = JSON.stringify({ easy: diffMix.easy, medium: diffMix.medium, hard: diffMix.hard })
  const knowledgeRequirements = categoryIds.value.length
    ? JSON.stringify(categoryIds.value.map((id) => ({ tagId: id, tagName: '', count: 0 })))
    : ''
  const payload: PaperTemplateForm = {
    templateName: form.templateName,
    questionConfig,
    difficultyDistribution,
    knowledgeRequirements,
    gradeLevel: examType.value,
    generateSource: generateSource.value,
    aiNotes: form.aiNotes ?? '',
    totalScore: form.totalScore,
    questionCount: countFromRows.value,
    status: form.status === 0 ? 0 : 1,
  }
  if (form.description != null && form.description !== '') payload.description = form.description
  return payload
}

const deserializeForm = (d: PaperTemplate) => {
  try {
    const rows = JSON.parse(d.questionConfig || '[]') as QuestionConfigRow[]
    if (Array.isArray(rows) && rows.length) configRows.value = rows.map((r) => ({
      type: r.type, count: r.count ?? 0, score: r.score ?? 1,
      difficulty: Array.isArray(r.difficulty) ? r.difficulty : [1, 2],
    }))
  } catch { configRows.value = DEFAULT_ROWS() }
  try {
    const dm = JSON.parse(d.difficultyDistribution || '{}')
    diffMix.easy = Number(dm.easy ?? 30)
    diffMix.medium = Number(dm.medium ?? 50)
    diffMix.hard = Number(dm.hard ?? 20)
  } catch { /* ignore */ }
  try {
    const kr = JSON.parse(d.knowledgeRequirements || '[]')
    if (Array.isArray(kr)) categoryIds.value = kr.map((x: { tagId?: number }) => Number(x.tagId)).filter(Boolean)
  } catch { categoryIds.value = [] }
  examType.value = d.gradeLevel || 'CUSTOM'
  generateSource.value = d.generateSource || 'BANK'
  form.generateSource = generateSource.value
  form.aiNotes = d.aiNotes ?? ''
  form.totalScore = d.totalScore
  form.questionCount = d.questionCount
}

const resetEditor = () => {
  Object.assign(form, {
    id: 0, templateName: '', description: '', questionConfig: '[]',
    difficultyDistribution: '', knowledgeRequirements: '', gradeLevel: '',
    generateSource: 'BANK', aiNotes: '', totalScore: 100, questionCount: 100, status: 1,
  })
  configRows.value = DEFAULT_ROWS()
  diffMix.easy = 30; diffMix.medium = 50; diffMix.hard = 20
  categoryIds.value = []
  examType.value = 'CUSTOM'
  generateSource.value = 'BANK'
  editingId.value = 0
}

const openCreate = () => { resetEditor(); view.value = 'edit' }

const openEdit = async (row: PaperTemplate) => {
  const res = await getTemplate(row.id)
  const d = res.data
  Object.assign(form, {
    id: d.id, templateName: d.templateName, description: d.description ?? '',
    questionConfig: d.questionConfig, difficultyDistribution: d.difficultyDistribution ?? '',
    knowledgeRequirements: d.knowledgeRequirements ?? '', gradeLevel: d.gradeLevel ?? '',
    generateSource: d.generateSource || 'BANK', aiNotes: d.aiNotes ?? '',
    totalScore: d.totalScore, questionCount: d.questionCount, status: d.status,
  })
  deserializeForm(d)
  editingId.value = d.id
  view.value = 'edit'
}

const goList = () => { view.value = 'list'; load() }

const save = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    if (!diffValid.value) { ElMessage.warning('难度三档百分比之和必须为 100%'); return }
    if (!configRows.value.length) { ElMessage.warning('至少配置一种题型'); return }
    saving.value = true
    try {
      const payload = serializeForm()
      if (editingId.value) { await updateTemplate(editingId.value, payload); ElMessage.success('已保存') }
      else { await createTemplate(payload); ElMessage.success('模板已创建') }
      goList()
    } catch { /* handled */ }
    finally { saving.value = false }
  })
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('删除后不可恢复，确定删除这个模板？', '删除模板', {
    type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
  })
  await deleteTemplate(id)
  ElMessage.success('已删除')
  load()
}

const addRow = () => configRows.value.push({ type: 'SINGLE', count: 10, score: 1, difficulty: [1, 2] })
const removeRow = (i: number) => configRows.value.splice(i, 1)
const moveRow = (i: number, dir: -1 | 1) => {
  const rows = configRows.value
  const j = i + dir
  if (j < 0 || j >= rows.length) return
  const a = rows[i]
  const b = rows[j]
  if (!a || !b) return
  rows[i] = b
  rows[j] = a
}

const generating = ref(false)
/* ---- 生成试卷对话框：定试卷名 / 说明 / 本次出题方式 ---- */
const genDialog = ref(false)
const genForm = reactive({
  paperName: '',
  description: '',
  source: 'BANK' as GenerateSource,
})
const genRow = ref<PaperTemplate | null>(null)

const openGenerate = (row: PaperTemplate) => {
  genRow.value = row
  const d = new Date()
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  genForm.paperName = `${row.templateName} · ${ymd}`
  genForm.description = `基于模板「${row.templateName}」生成。`
  genForm.source = row.generateSource || 'BANK'
  genDialog.value = true
}

const confirmGenerate = async () => {
  const row = genRow.value
  if (!row) return
  if (!genForm.paperName.trim()) { ElMessage.warning('请填写试卷名称'); return }
  const src = genForm.source
  const srcLabel = SOURCE_OPTIONS.find((s) => s.value === src)?.title ?? '题库抽题'
  try {
    if (src === 'AI') {
      await ElMessageBox.confirm(
        `将由 ${srcLabel} 按模板规则现生成新题，试卷名「${genForm.paperName}」。开始？`,
        'AI 生成试卷', { confirmButtonText: '开始生成', type: 'info' }
      )
      generating.value = true
      const res = await directGenerate(buildAiParams(row))
      ElMessage.success(`AI 试卷「${genForm.paperName}」已生成，paperId=${res.data?.paperId}`)
      genDialog.value = false
      router.push('/admin/papers')
      return
    }
    let shortage = ''
    try {
      const av = await checkTemplateAvailability(row.id)
      const bad = (av.data?.items ?? []).filter((i) => !i.ok)
      if (bad.length) shortage = bad.map((i) => `${getQuestionTypeLabel(i.type)}需${i.requested}题/题库仅${i.available}题`).join('；')
    } catch { /* ignore */ }
    const baseMsg = `将从题库按模板规则抽题，试卷名「${genForm.paperName}」。确认生成？`
    await ElMessageBox.confirm(
      shortage ? `${baseMsg}\n⚠ 题库不足：${shortage}` : baseMsg,
      shortage ? '题库题目不足' : '生成试卷',
      { confirmButtonText: '生成', type: shortage ? 'warning' : 'info' }
    )
    generating.value = true
    const res = await generatePaperFromTemplate(row.id, genForm.paperName.trim())
    ElMessage.success(`「${res.data?.paperName}」已生成，共 ${res.data?.questionCount} 题 / ${res.data?.totalScore} 分`)
    const warns = res.data?.warnings ?? []
    if (warns.length) ElMessage.warning(warns.join('；'))
    genDialog.value = false
    router.push('/admin/papers')
  } catch { /* canceled */ }
  finally { generating.value = false }
}

const buildAiParams = (row: PaperTemplate) => {
  let rows: QuestionConfigRow[] = []
  try { rows = JSON.parse(row.questionConfig || '[]') } catch { /* ignore */ }
  let dm = { easy: 30, medium: 50, hard: 20 }
  try { dm = { ...dm, ...JSON.parse(row.difficultyDistribution || '{}') } } catch { /* ignore */ }
  const byType = (t: string) => rows.find((r) => r.type === t)?.count ?? 0
  const n = Math.max(1, rows.reduce((s, r) => s + r.count, 0))
  const pct = (c: number) => Math.round((c / n) * 100)
  const base = {
    targetUserId: 0,
    categoryIds: [] as number[],
    easyPct: Number(dm.easy) || 30,
    mediumPct: Number(dm.medium) || 50,
    hardPct: Number(dm.hard) || 20,
    withTrap: false,
    focusWeak: false,
    questionCount: row.questionCount || n,
    totalScore: row.totalScore,
    singleWeight: pct(byType('SINGLE')),
    multipleWeight: pct(byType('MULTIPLE')),
    readingWeight: pct(byType('READING')),
    judgeWeight: pct(byType('JUDGE')),
    fillWeight: pct(byType('FILL_HINT')),
    paperName: `${row.templateName} · ${new Date().toISOString().slice(0, 10)}`,
    duration: (getExamTypePreset(row.gradeLevel)?.suggestDuration) || 60,
  }
  return row.aiNotes ? { ...base, notes: row.aiNotes } : base
}

const handleGenerate = (row: PaperTemplate) => openGenerate(row)

const statusMap: Record<number, string> = { 0: '停用', 1: '启用' }
const srcLabel = (s?: GenerateSource) => SOURCE_OPTIONS.find((x) => x.value === s)?.title ?? '题库抽题'
const srcTone = (s?: GenerateSource) => s === 'AI' ? 'ai' : s === 'MIX' ? 'mix' : 'bank'
const parseDiff = (json?: string) => {
  try {
    const d = JSON.parse(json || '{}')
    return { easy: Number(d.easy ?? 30), medium: Number(d.medium ?? 50), hard: Number(d.hard ?? 20) }
  } catch { return { easy: 30, medium: 50, hard: 20 } }
}
const diffBar = (json?: string) => {
  const d = parseDiff(json)
  const s = Math.max(1, d.easy + d.medium + d.hard)
  return { e: (d.easy / s) * 100, m: (d.medium / s) * 100, h: (d.hard / s) * 100 }
}
const examTone = (v?: string) => {
  const idx = examTypePresets.findIndex((x) => x.value === (v || 'CUSTOM'))
  return idx < 0 ? 0 : idx % 4
}
</script>


<template>
  <div v-if="view === 'list'" class="tpl-page">
    <header class="tpl-bar">
      <div class="tpl-bar-left">
        <h1 class="tpl-bar-title">试卷模板</h1>
        <span class="tpl-bar-count">{{ total }} 个模板</span>
      </div>
      <div class="tpl-bar-right">
        <el-input v-model="query.templateName" placeholder="搜索模板名称" clearable class="tpl-search" @keyup.enter="load" />
        <el-select v-model="query.status" placeholder="全部状态" clearable style="width:120px">
          <el-option label="启用" :value="1" /><el-option label="停用" :value="0" />
        </el-select>
        <el-button type="primary" plain @click="load">查询</el-button>
        <el-radio-group v-model="viewMode" class="tpl-view-switch">
          <el-radio-button value="table">列表</el-radio-button>
          <el-radio-button value="card">卡片</el-radio-button>
        </el-radio-group>
        <el-button type="primary" @click="openCreate">
          <span style="margin-right:4px">＋</span> 新建模板
        </el-button>
      </div>
    </header>

    <!-- 表格视图（默认） -->
    <div v-if="viewMode === 'table'" v-loading="loading" class="tpl-table-wrap">
      <el-table :data="tableData" stripe class="tpl-table" :header-cell-style="{ background: '#f7f9fc', color: '#475467', fontWeight: 600 }">
        <el-table-column label="模板名称" min-width="240">
          <template #default="{ row }">
            <div class="cell-name">
              <div class="cell-name-main">{{ row.templateName }}</div>
              <div v-if="row.description" class="cell-name-desc">{{ row.description }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="考试类型" width="130">
          <template #default="{ row }">
            <span class="tag-exam" :class="`tone-${examTone(row.gradeLevel)}`">{{ getExamTypeLabel(row.gradeLevel || 'CUSTOM') }}</span>
          </template>
        </el-table-column>
        <el-table-column label="难度配比" width="160">
          <template #default="{ row }">
            <div class="cell-diff">
              <div class="cell-diff-bar">
                <i :style="{ width: diffBar(row.difficultyDistribution).e + '%', background: '#34c98e' }" />
                <i :style="{ width: diffBar(row.difficultyDistribution).m + '%', background: '#f5b83d' }" />
                <i :style="{ width: diffBar(row.difficultyDistribution).h + '%', background: '#f06a6a' }" />
              </div>
              <div class="cell-diff-txt">
                <span class="e">{{ parseDiff(row.difficultyDistribution).easy }}</span>
                <span class="m">{{ parseDiff(row.difficultyDistribution).medium }}</span>
                <span class="h">{{ parseDiff(row.difficultyDistribution).hard }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="卷面" width="130" align="center">
          <template #default="{ row }">
            <div class="cell-score">
              <b>{{ row.questionCount }}</b><span>题 · </span><b>{{ row.totalScore }}</b><span>分</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="出题方式" width="110">
          <template #default="{ row }">
            <span class="tag-src" :class="`src-${srcTone(row.generateSource)}`">{{ srcLabel(row.generateSource) }}</span>
          </template>
        </el-table-column>
        <!-- [2026-10-28] 后端 exam_paper_template.usage_count 列已清除 ⇒ 原「使用」列（N 次使用）整列删除。
             题量列（questionCount，后端改由 question_config 解析）按契约保留。 -->
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <span class="tag-status" :class="row.status === 1 ? 'on' : 'off'">{{ statusMap[row.status] }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <div class="cell-actions">
              <el-button type="primary" size="small" :loading="generating" @click="handleGenerate(row)">生成试卷</el-button>
              <el-button size="small" @click="openEdit(row)">编辑</el-button>
              <el-button size="small" type="danger" text @click="handleDelete(row.id)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!loading && !tableData.length" class="tpl-empty">
        <p class="tpl-empty-title">还没有组卷模板</p>
        <p class="tpl-empty-desc">选考试类型 → 调难度考点 → 选出题方式，一键出卷。</p>
        <el-button type="primary" @click="openCreate">新建模板</el-button>
      </div>
    </div>

    <!-- 卡片视图 -->
    <div v-else v-loading="loading" class="tpl-grid">
      <article v-for="row in tableData" :key="row.id" class="tpl-card">
        <div class="tpl-card-head">
          <span class="tag-exam" :class="`tone-${examTone(row.gradeLevel)}`">{{ getExamTypeLabel(row.gradeLevel || 'CUSTOM') }}</span>
          <span class="tag-src" :class="`src-${srcTone(row.generateSource)}`">{{ srcLabel(row.generateSource) }}</span>
        </div>
        <h3 class="tpl-card-title">{{ row.templateName }}</h3>
        <p v-if="row.description" class="tpl-card-desc">{{ row.description }}</p>
        <div class="tpl-diff">
          <div class="tpl-diff-bar">
            <i :style="{ width: diffBar(row.difficultyDistribution).e + '%', background: '#34c98e' }" />
            <i :style="{ width: diffBar(row.difficultyDistribution).m + '%', background: '#f5b83d' }" />
            <i :style="{ width: diffBar(row.difficultyDistribution).h + '%', background: '#f06a6a' }" />
          </div>
          <div class="tpl-diff-legend">
            <span class="easy">简 {{ parseDiff(row.difficultyDistribution).easy }}%</span>
            <span class="medium">中 {{ parseDiff(row.difficultyDistribution).medium }}%</span>
            <span class="hard">难 {{ parseDiff(row.difficultyDistribution).hard }}%</span>
          </div>
        </div>
        <div class="tpl-stats">
          <div class="tpl-stat"><b>{{ row.questionCount }}</b><span>题</span></div>
          <div class="tpl-stat"><b>{{ row.totalScore }}</b><span>分</span></div>
          <!-- [2026-10-28] 后端 exam_paper_template.usage_count 列已清除 ⇒ 卡片视图原「N 次使用」统计项删除。 -->
          <div class="tpl-stat"><span class="tpl-dot" :class="row.status === 1 ? 'on' : 'off'" />{{ statusMap[row.status] }}</div>
        </div>
        <div class="tpl-actions">
          <el-button type="primary" class="tpl-gen" :loading="generating" @click="handleGenerate(row)">生成试卷</el-button>
          <el-button text @click="openEdit(row)">编辑</el-button>
          <el-button text type="danger" @click="handleDelete(row.id)">删除</el-button>
        </div>
      </article>
      <div v-if="!loading && !tableData.length" class="tpl-empty">
        <p class="tpl-empty-title">还没有组卷模板</p>
        <p class="tpl-empty-desc">先建一个：选考试类型 → 调难度考点 → 选出题方式。</p>
        <el-button type="primary" @click="openCreate">新建模板</el-button>
      </div>
    </div>

    <el-pagination
      v-model:current-page="query.pageNum" v-model:page-size="query.pageSize"
      :total="total" :page-sizes="[10, 20, 50, 100, 200, 500, 1000]" layout="total, sizes, prev, pager, next"
      @change="load" class="tpl-pager"
    />
  </div>

  <div v-else class="ed-page">
    <header class="ed-top">
      <button class="ed-back" @click="goList">← 返回列表</button>
      <h1 class="ed-title">{{ editingId ? '编辑模板' : '新建模板' }}</h1>
      <div class="ed-top-actions">
        <el-button size="large" @click="goList">取消</el-button>
        <el-button type="primary" size="large" :loading="saving" @click="save">保存模板</el-button>
      </div>
    </header>

    <div class="ed-body">
      <div class="ed-main">
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="ed-form">
          <section class="ed-sec">
            <h3 class="ed-sec-h">1 · 基本信息</h3>
            <el-form-item label="模板名称" prop="templateName">
              <el-input v-model="form.templateName" size="large" placeholder="如：高考英语模拟卷模板" />
            </el-form-item>
            <el-form-item label="说明">
              <el-input v-model="form.description" type="textarea" :rows="2" placeholder="给同事看的用途说明（可选）" />
            </el-form-item>
            <div class="ed-inline">
              <el-form-item label="卷面总分">
                <el-select v-model="form.totalScore" size="large" style="width:100%">
                  <el-option v-for="d in paperScoreDict" :key="d.value" :label="d.label" :value="Number(d.value)" />
                </el-select>
              </el-form-item>
              <el-form-item label="状态">
                <el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" />
              </el-form-item>
            </div>
          </section>

          <section class="ed-sec">
            <h3 class="ed-sec-h">2 · 目标考试</h3>
            <el-select v-model="examType" size="large" class="ed-exam-select" @change="applyExamPreset">
              <el-option v-for="p in examTypePresets" :key="p.value" :label="p.label" :value="p.value">
                <div class="exam-opt">
                  <span class="exam-opt-name">{{ p.label }}</span>
                  <span class="exam-opt-meta">{{ p.totalScore }} 分 · {{ p.questionCount }} 题 · 难度 {{ p.easyPct }}/{{ p.mediumPct }}/{{ p.hardPct }}</span>
                </div>
              </el-option>
            </el-select>
            <p class="ed-hint">选定后自动带出总分、题量和难度配比，下面都能再改。</p>
          </section>

          <section class="ed-sec">
            <h3 class="ed-sec-h">3 · 难度配比</h3>
            <div class="diff-visual">
              <div class="diff-visual-bar">
                <i :style="{ width: diffMix.easy + '%', background: '#34c98e' }" />
                <i :style="{ width: diffMix.medium + '%', background: '#f5b83d' }" />
                <i :style="{ width: diffMix.hard + '%', background: '#f06a6a' }" />
              </div>
              <div class="diff-visual-row">
                <label class="diff-lab"><i class="sw easy" />简单
                  <el-input-number v-model="diffMix.easy" :min="0" :max="100" controls-position="right" />
                </label>
                <label class="diff-lab"><i class="sw medium" />中等
                  <el-input-number v-model="diffMix.medium" :min="0" :max="100" controls-position="right" />
                </label>
                <label class="diff-lab"><i class="sw hard" />困难
                  <el-input-number v-model="diffMix.hard" :min="0" :max="100" controls-position="right" />
                </label>
                <el-tag :type="diffValid ? 'success' : 'danger'" effect="plain" round>合计 {{ diffSum }}%</el-tag>
                <el-button text size="small" @click="diffMix.easy = 30; diffMix.medium = 50; diffMix.hard = 20">重置</el-button>
              </div>
            </div>
          </section>

          <section class="ed-sec">
            <h3 class="ed-sec-h">
              4 · 题型结构
              <span class="ed-sec-meta">合计 {{ countFromRows }} 题 · 卷面 {{ totalFromRows }} 分</span>
              <el-button size="small" round @click="alignOnePointOneQ">一键 1 题 1 分</el-button>
            </h3>
            <div class="qtype-list">
              <div v-for="(row, i) in configRows" :key="i" class="qtype-card">
                <div class="qtype-idx">{{ i + 1 }}</div>
                <div class="qtype-fields">
                  <el-select v-model="row.type" size="large" class="qtype-type">
                    <el-option v-for="t in questionTypeDict" :key="t.value" :label="t.label" :value="t.value" />
                  </el-select>
                  <div class="qtype-num">
                    <span class="qtype-lab">题数</span>
                    <el-input-number v-model="row.count" :min="0" :max="300" size="large" controls-position="right" />
                  </div>
                  <div class="qtype-num">
                    <span class="qtype-lab">每题分</span>
                    <el-input-number v-model="row.score" :min="0.5" :max="20" :step="0.5" size="large" controls-position="right" />
                  </div>
                  <div class="qtype-diff">
                    <span class="qtype-lab">难度</span>
                    <el-checkbox-group v-model="row.difficulty">
                      <el-checkbox :value="1">简</el-checkbox>
                      <el-checkbox :value="2">中</el-checkbox>
                      <el-checkbox :value="3">难</el-checkbox>
                    </el-checkbox-group>
                  </div>
                </div>
                <div class="qtype-ops">
                  <el-button text size="small" :disabled="i === 0" @click="moveRow(i, -1)">↑</el-button>
                  <el-button text size="small" :disabled="i === configRows.length - 1" @click="moveRow(i, 1)">↓</el-button>
                  <el-button text type="danger" size="small" @click="removeRow(i)">删除</el-button>
                </div>
              </div>
              <el-button class="qtype-add" size="large" @click="addRow">＋ 添加题型</el-button>
            </div>
          </section>

          <section class="ed-sec">
            <h3 class="ed-sec-h">5 · 考点范围 <span class="ed-sec-meta">不选 = 全专题抽题</span></h3>
            <CategoryMultiPicker v-model="categoryIds" :categories="categories as any" />
          </section>
        </el-form>
      </div>

      <aside class="ed-side">
        <div class="ed-side-sticky">
          <section class="preview-card">
            <h3 class="ed-sec-h">卷面预览</h3>
            <div class="preview-score">
              <span class="preview-num">{{ totalFromRows }}</span>
              <span class="preview-unit">分</span>
              <span class="preview-count">{{ countFromRows }} 题</span>
            </div>
            <div class="preview-line">
              <span>每题</span>
              <b :class="{ ok: onePointOneQ }">{{ onePointOneQ ? '1 分' : (countFromRows ? (totalFromRows / countFromRows).toFixed(2) : '—') + ' 分' }}</b>
            </div>
            <div class="diff-visual-bar preview-diff">
              <i :style="{ width: diffMix.easy + '%', background: '#34c98e' }" />
              <i :style="{ width: diffMix.medium + '%', background: '#f5b83d' }" />
              <i :style="{ width: diffMix.hard + '%', background: '#f06a6a' }" />
            </div>
            <ul class="preview-types">
              <li v-for="(r, i) in configRows" :key="i">
                <span class="pt-name">{{ getQuestionTypeLabel(r.type) }}</span>
                <span class="pt-val">{{ r.count }} 题 × {{ r.score }} 分</span>
              </li>
            </ul>
            <div class="preview-meta">
              <div><span>考试类型</span><b>{{ getExamTypeLabel(examType) }}</b></div>
              <div><span>考点</span><b>{{ categoryIds.length ? categoryIds.length + ' 个专题' : '全专题' }}</b></div>
            </div>
          </section>

          <section class="ed-sec">
            <h3 class="ed-sec-h">出题方式</h3>
            <div class="src-grid">
              <button
                v-for="opt in SOURCE_OPTIONS" :key="opt.value"
                type="button"
                class="src-card" :class="[`src-${opt.tone}`, { active: generateSource === opt.value }]"
                @click="generateSource = opt.value"
              >
                <span class="src-icon">{{ opt.icon }}</span>
                <div class="src-body">
                  <span class="src-title">{{ opt.title }}</span>
                  <span class="src-desc">{{ opt.desc }}</span>
                </div>
                <span v-if="generateSource === opt.value" class="src-check">✓</span>
              </button>
            </div>
          </section>

          <section class="ed-sec">
            <h3 class="ed-sec-h">出题备注 <span class="ed-sec-meta">开放性 · 交给 AI</span></h3>
            <el-input
              v-model="form.aiNotes"
              type="textarea"
              :rows="5"
              maxlength="1000"
              show-word-limit
              placeholder="还想要什么样的题？直接写给大模型，例如：&#10;· 多考时态辨析，题干贴近校园生活&#10;· 阅读话题希望是科技或环保&#10;· 干扰项要像学生常犯的错误"
            />
          </section>
        </div>
      </aside>
    </div>
  </div>

    <!-- 生成试卷：定名称 / 说明 / 本次出题方式 -->
    <el-dialog v-model="genDialog" title="生成试卷" width="560px" destroy-on-close class="gen-dialog">
      <div v-if="genRow" class="gen-summary">
        <div class="gen-sum-row"><span>模板</span><b>{{ genRow.templateName }}</b></div>
        <div class="gen-sum-row"><span>规则</span><b>{{ genRow.questionCount }} 题 · {{ genRow.totalScore }} 分 · {{ getExamTypeLabel(genRow.gradeLevel || 'CUSTOM') }}</b></div>
      </div>
      <el-form label-position="top" class="gen-form">
        <el-form-item label="试卷名称" required>
          <el-input v-model="genForm.paperName" size="large" placeholder="生成后的试卷名称" maxlength="200" />
        </el-form-item>
        <el-form-item label="试卷说明（可选）">
          <el-input v-model="genForm.description" type="textarea" :rows="2" maxlength="500" placeholder="写入试卷描述，便于日后查找" />
        </el-form-item>
        <el-form-item label="本次出题方式">
          <div class="gen-src">
            <button
              v-for="opt in SOURCE_OPTIONS" :key="opt.value"
              type="button"
              class="src-card" :class="[`src-${opt.tone}`, { active: genForm.source === opt.value }]"
              @click="genForm.source = opt.value"
            >
              <span class="src-icon">{{ opt.icon }}</span>
              <div class="src-body">
                <span class="src-title">{{ opt.title }}</span>
                <span class="src-desc">{{ opt.desc }}</span>
              </div>
              <span v-if="genForm.source === opt.value" class="src-check">✓</span>
            </button>
          </div>
          <p class="ed-hint">模板默认「{{ srcLabel(genRow?.generateSource) }}」，此处可临时覆盖。</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="genDialog = false">取消</el-button>
        <el-button type="primary" :loading="generating" @click="confirmGenerate">生成试卷</el-button>
      </template>
    </el-dialog>
</template>


<style scoped>
.tpl-page {
  padding: 20px 24px 32px;
  background: radial-gradient(1200px 400px at 80% -10%, rgba(79,110,247,.08), transparent 60%), #f5f7fb;
  min-height: calc(100vh - 56px);
}
.tpl-bar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; margin-bottom: 18px; flex-wrap: wrap;
}
.tpl-bar-left { display: flex; align-items: baseline; gap: 12px; }
.tpl-bar-title {
  margin: 0; font-size: 22px; font-weight: 700; color: #1c2536; letter-spacing: -.02em;
}
.tpl-bar-count { font-size: 13px; color: #98a2b3; }
.tpl-bar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tpl-view-switch :deep(.el-radio-button__inner) { padding: 8px 16px; }
.tpl-search { width: 220px; }

.tpl-table-wrap {
  background: #fff; border-radius: 14px; border: 1px solid #e6eaf2;
  overflow: hidden;
}
.tpl-table { width: 100%; }
.tpl-table :deep(.el-table__cell) { padding: 12px 8px; }
.tpl-table :deep(.el-table__row) { cursor: default; }
.tpl-table :deep(.el-table__row:hover > td) { background: #f5f8ff !important; }

.cell-name-main { font-size: 14px; font-weight: 600; color: #1c2536; line-height: 1.4; }
.cell-name-desc {
  margin-top: 3px; font-size: 12px; color: #98a2b3;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320px;
}

.tag-exam {
  display: inline-block; font-size: 12px; font-weight: 600;
  padding: 3px 10px; border-radius: 999px;
}
.tag-exam.tone-0 { background: #e8f0ff; color: #2f55d4; }
.tag-exam.tone-1 { background: #e9f8f1; color: #12805c; }
.tag-exam.tone-2 { background: #fff3df; color: #a15c00; }
.tag-exam.tone-3 { background: #f3eaff; color: #6b3fc4; }

.tag-src {
  display: inline-block; font-size: 11px; font-weight: 600;
  padding: 3px 8px; border-radius: 6px; background: #f1f4f9; color: #5b6575;
}
.tag-src.src-ai { background: #efe8ff; color: #6b3fc4; }
.tag-src.src-mix { background: #fff0e6; color: #b35a16; }

.tag-status {
  display: inline-block; font-size: 12px; font-weight: 600;
  padding: 3px 12px; border-radius: 999px;
  white-space: nowrap;
}
.tag-status.on { background: #e8f8f0; color: #12805c; }
.tag-status.off { background: #f2f4f7; color: #7a8496; }

.cell-diff { display: flex; flex-direction: column; gap: 5px; }
.cell-diff-bar {
  display: flex; height: 6px; border-radius: 999px; overflow: hidden; background: #eef1f6;
}
.cell-diff-bar i { display: block; height: 100%; }
.cell-diff-txt { display: flex; gap: 8px; font-size: 11px; }
.cell-diff-txt .e { color: #1f9d6b; }
.cell-diff-txt .m { color: #b8860b; }
.cell-diff-txt .h { color: #d14b4b; }

.cell-score { font-size: 13px; color: #667085; }
.cell-score b { color: #1c2536; font-size: 15px; font-weight: 700; }
.cell-actions {
  display: flex; align-items: center; gap: 8px; flex-wrap: nowrap;
}
.cell-actions :deep(.el-button + .el-button) { margin-left: 0; }

.tpl-toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.tpl-search { width: 240px; }
.tpl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; min-height: 120px; }
.tpl-card {
  background: #fff; border-radius: 16px; border: 1px solid #e6eaf2;
  padding: 18px 18px 14px; display: flex; flex-direction: column; gap: 12px;
  transition: box-shadow .15s ease, transform .15s ease, border-color .15s;
}
.tpl-card:hover { box-shadow: 0 12px 32px rgba(28,37,54,.08); border-color: #d5dced; transform: translateY(-2px); }
.tpl-card-head { display: flex; gap: 8px; align-items: center; }
.tpl-exam { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
.tpl-exam.tone-0 { background: #e8f0ff; color: #2f55d4; }
.tpl-exam.tone-1 { background: #e9f8f1; color: #12805c; }
.tpl-exam.tone-2 { background: #fff3df; color: #a15c00; }
.tpl-exam.tone-3 { background: #f3eaff; color: #6b3fc4; }
.tpl-src { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: #f1f4f9; color: #5b6575; }
.tpl-src.src-ai { background: #efe8ff; color: #6b3fc4; }
.tpl-src.src-mix { background: #fff0e6; color: #b35a16; }
.tpl-card-title { margin: 0; font-size: 18px; font-weight: 700; color: #1c2536; line-height: 1.35; }
.tpl-card-desc {
  margin: 0; font-size: 12px; color: #8a94a6; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.tpl-diff { display: flex; flex-direction: column; gap: 6px; }
.tpl-diff-bar { display: flex; height: 8px; border-radius: 999px; overflow: hidden; background: #eef1f6; }
.tpl-diff-bar i { display: block; height: 100%; }
.tpl-diff-legend { display: flex; gap: 12px; font-size: 11px; color: #7a8496; }
.tpl-diff-legend .easy { color: #1f9d6b; }
.tpl-diff-legend .medium { color: #b8860b; }
.tpl-diff-legend .hard { color: #d14b4b; }
.tpl-stats { display: flex; gap: 14px; align-items: center; padding: 10px 0; border-top: 1px dashed #e8ecf3; border-bottom: 1px dashed #e8ecf3; }
.tpl-stat { display: flex; align-items: baseline; gap: 4px; font-size: 12px; color: #8a94a6; }
.tpl-stat b { font-size: 18px; color: #1c2536; font-weight: 700; letter-spacing: -.02em; }
.tpl-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.tpl-dot.on { background: #34c98e; }
.tpl-dot.off { background: #c3cad6; }
.tpl-actions { display: flex; gap: 8px; align-items: center; margin-top: auto; }
.tpl-gen { flex: 1; border-radius: 10px; font-weight: 600; }
.tpl-empty {
  grid-column: 1 / -1; text-align: center; padding: 56px 20px;
  background: #fff; border-radius: 16px; border: 1px dashed #d6dce8;
}
.tpl-empty-title { margin: 0 0 6px; font-size: 16px; font-weight: 600; color: #344054; }
.tpl-empty-desc { margin: 0 0 16px; font-size: 13px; color: #8a94a6; }
.tpl-pager { margin-top: 18px; justify-content: flex-end; }

.ed-page { min-height: calc(100vh - 56px); background: #eef1f7; display: flex; flex-direction: column; }
.ed-top {
  display: flex; align-items: center; gap: 18px;
  padding: 16px 32px; background: #fff; border-bottom: 1px solid #e4e9f2;
  position: sticky; top: 0; z-index: 20;
  box-shadow: 0 1px 0 rgba(28,37,54,.04);
}
.ed-back { border: 0; background: transparent; cursor: pointer; font-size: 15px; color: #5b6575; padding: 8px 12px; border-radius: 10px; }
.ed-back:hover { background: #f0f3f9; color: #1c2536; }
.ed-title { margin: 0; font-size: 22px; font-weight: 700; color: #1c2536; flex: 1; letter-spacing: -.01em; }
.ed-top-actions { display: flex; gap: 10px; }
.ed-body { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(360px, 1fr); gap: 24px; padding: 24px 32px 48px; align-items: start; }
.ed-main { min-width: 0; }
.ed-form :deep(.el-form-item) { margin-bottom: 18px; }
.ed-form :deep(.el-form-item__label) { font-weight: 600; color: #344054; padding-bottom: 6px; }
.ed-sec { background: #fff; border-radius: 18px; padding: 26px 28px; border: 1px solid #e6eaf2; margin-bottom: 18px; box-shadow: 0 1px 2px rgba(28,37,54,.04); }
.ed-sec-h { margin: 0 0 18px; font-size: 16px; font-weight: 700; color: #1c2536; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ed-sec-meta { font-size: 13px; color: #98a2b3; font-weight: 500; }
.ed-hint { margin: 10px 0 0; font-size: 13px; color: #98a2b3; }
.ed-inline { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.ed-exam-select { width: 100%; }
.exam-opt { display: flex; justify-content: space-between; align-items: center; width: 100%; }
.exam-opt-name { font-weight: 600; color: #1c2536; }
.exam-opt-meta { font-size: 12px; color: #98a2b3; }

.diff-visual { display: flex; flex-direction: column; gap: 14px; }
.diff-visual-bar { display: flex; height: 14px; border-radius: 999px; overflow: hidden; background: #eef1f6; }
.diff-visual-bar i { display: block; height: 100%; transition: width .2s ease; }
.diff-visual-row { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
.diff-lab { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: #475467; }
.diff-lab .sw { width: 10px; height: 10px; border-radius: 3px; }
.diff-lab .sw.easy { background: #34c98e; }
.diff-lab .sw.medium { background: #f5b83d; }
.diff-lab .sw.hard { background: #f06a6a; }

.qtype-list { display: flex; flex-direction: column; gap: 12px; }
.qtype-card {
  display: flex; align-items: center; gap: 14px;
  padding: 18px 20px; background: #f8fafc; border: 1px solid #e8edf5; border-radius: 16px;
}
.qtype-idx {
  width: 28px; height: 28px; border-radius: 50%;
  background: #e8f0ff; color: #2f55d4; font-weight: 700; font-size: 13px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.qtype-fields { flex: 1; display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
.qtype-type { width: 150px; }
.qtype-num, .qtype-diff { display: flex; flex-direction: column; gap: 4px; }
.qtype-lab { font-size: 12px; color: #98a2b3; font-weight: 600; }
.qtype-ops { display: flex; flex-direction: column; gap: 2px; }
.qtype-add { border-style: dashed; width: 100%; }

.ed-side { min-width: 0; }
.ed-side-sticky { position: sticky; top: 80px; display: flex; flex-direction: column; gap: 16px; }

.preview-card {
  background: linear-gradient(160deg, #1c2536, #2a3550);
  color: #fff; border-radius: 20px; padding: 26px 26px 22px;
}
.preview-card .ed-sec-h { color: #fff; opacity: .85; font-size: 12px; letter-spacing: .12em; }
.preview-score { display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px; }
.preview-num { font-size: 60px; font-weight: 800; letter-spacing: -.03em; line-height: 1; }
.preview-unit { font-size: 18px; opacity: .7; }
.preview-count {
  margin-left: auto; font-size: 14px; opacity: .8;
  background: rgba(255,255,255,.12); padding: 4px 10px; border-radius: 999px;
}
.preview-line { display: flex; justify-content: space-between; font-size: 14px; opacity: .85; margin-bottom: 14px; }
.preview-line .ok { color: #6ee7b7; }
.preview-diff { background: rgba(255,255,255,.12); height: 10px; margin-bottom: 14px; }
.preview-types { list-style: none; margin: 0 0 14px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.preview-types li {
  display: flex; justify-content: space-between; font-size: 13px;
  padding: 6px 10px; background: rgba(255,255,255,.08); border-radius: 8px;
}
.pt-name { opacity: .85; }
.pt-val { font-weight: 600; }
.preview-meta { display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(255,255,255,.12); padding-top: 12px; }
.preview-meta > div { display: flex; justify-content: space-between; font-size: 12px; }
.preview-meta span { opacity: .6; }
.preview-meta b { font-weight: 600; }

.src-grid { display: flex; flex-direction: column; gap: 10px; }
.src-card {
  position: relative; display: flex; align-items: center; gap: 12px;
  padding: 18px 18px; border-radius: 16px; border: 2px solid #e6eaf2; background: #fff;
  cursor: pointer; text-align: left;
  transition: border-color .15s, box-shadow .15s, transform .15s;
}
.src-card:hover { transform: translateY(-1px); border-color: #c7d0f5; }
.src-card.active { border-color: #4f6ef7; box-shadow: 0 10px 24px rgba(79,110,247,.14); }
.src-card.active.src-ai { border-color: #7c4dff; box-shadow: 0 10px 24px rgba(124,77,255,.14); }
.src-card.active.src-mix { border-color: #e8963c; box-shadow: 0 10px 24px rgba(232,150,60,.14); }
.src-icon { font-size: 22px; line-height: 1; }
.src-body { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.src-title { font-size: 15px; font-weight: 700; color: #1c2536; }
.src-desc { font-size: 12px; color: #8a94a6; line-height: 1.55; }
.src-check {
  width: 22px; height: 22px; border-radius: 50%;
  background: #4f6ef7; color: #fff; font-size: 12px;
  display: flex; align-items: center; justify-content: center;
}
.src-card.active.src-ai .src-check { background: #7c4dff; }
.src-card.active.src-mix .src-check { background: #e8963c; }

/* FHD 1920 加大表单控件与标签 */
.ed-form :deep(.el-form-item__label) {
  font-size: 14px; font-weight: 600; color: #344054; padding-bottom: 8px;
  line-height: 1.4;
}
.ed-form :deep(.el-input__wrapper),
.ed-form :deep(.el-textarea__inner),
.ed-form :deep(.el-select__wrapper) {
  font-size: 14px;
}
.ed-form :deep(.el-input-number) { width: 130px; }
.qtype-type { width: 170px; }
.ed-inline { gap: 20px; }
.diff-visual-row { gap: 22px; }
.src-grid { gap: 12px; }

.gen-summary {
  background: #f7f9fc; border-radius: 12px; padding: 14px 16px; margin-bottom: 18px;
  display: flex; flex-direction: column; gap: 8px;
}
.gen-sum-row { display: flex; justify-content: space-between; font-size: 13px; }
.gen-sum-row span { color: #98a2b3; }
.gen-sum-row b { color: #1c2536; font-weight: 600; text-align: right; }
.gen-src { display: flex; flex-direction: column; gap: 10px; width: 100%; }
.gen-form :deep(.el-form-item__label) { font-weight: 600; color: #344054; }

@media (max-width: 1100px) {
  .ed-body { grid-template-columns: 1fr; }
  .ed-side-sticky { position: static; }
  .ed-inline { grid-template-columns: 1fr; }
  .qtype-card { flex-wrap: wrap; }
}
</style>
