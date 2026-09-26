<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { List, Grid, Plus, Upload, MagicStick, Edit, Delete, Search } from '@element-plus/icons-vue'
import {
  listReadingPassages,
  createReadingPassage,
  updateReadingPassage,
  deleteReadingPassage,
  batchStatusReadingPassages,
  batchDeleteReadingPassages,
  listCategoryTree,
} from '@/api/admin'
import { generateReading } from '@/api/ai'
import type { ReadingPassage, ReadingPassageForm } from '@/types/reading'
import type { QuestionOption } from '@/types/question'
import type { Category } from '@/types/category'
import type { Difficulty } from '@/types/common'
import { FormLimits } from '@/utils/formLimits'
import { useViewMode } from '@/composables/useViewMode'

const { viewMode, toggleViewMode } = useViewMode('reading_passage_manage')

const query = reactive({
  keyword: '',
  categoryId: undefined as number | undefined,
  difficulty: undefined as Difficulty | undefined,
  passageType: undefined as string | undefined,
  topic: undefined as string | undefined,
  source: undefined as string | undefined,
  status: undefined as number | undefined,
  includeTemp: false,
  pageNum: 1,
  pageSize: 20,
})

const list = ref<ReadingPassage[]>([])
const total = ref(0)
const loading = ref(false)
const categories = ref<Category[]>([])
const selected = ref<ReadingPassage[]>([])

const difficultyOptions = [
  { label: '简单', value: 1 },
  { label: '中等', value: 2 },
  { label: '困难', value: 3 },
]
const sourceOptions = [
  { label: 'AI生成', value: 'AI' },
  { label: '人工录入', value: 'MANUAL' },
  { label: '批量导入', value: 'IMPORT' },
  { label: '临时出题', value: 'TEMP' },
]
const passageTypeOptions = [
  { label: '记叙文', value: 'NARRATIVE' },
  { label: '说明文', value: 'EXPOSITORY' },
  { label: '议论文', value: 'ARGUMENTATIVE' },
  { label: '新闻报道', value: 'NEWS' },
  { label: '故事', value: 'STORY' },
]

const diffLabel = (d?: Difficulty) =>
  difficultyOptions.find((o) => o.value === d)?.label ?? String(d)
const sourceLabel = (s?: string) =>
  sourceOptions.find((o) => o.value === s)?.label ?? s
const typeLabel = (t?: string) =>
  passageTypeOptions.find((o) => o.value === t)?.label ?? t
const diffTagType = (d?: Difficulty) =>
  d === 1 ? 'success' : d === 2 ? 'warning' : 'danger'

const load = async () => {
  loading.value = true
  try {
    const res = await listReadingPassages({ ...query })
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
  query.difficulty = undefined
  query.passageType = undefined
  query.topic = undefined
  query.source = undefined
  query.status = undefined
  query.includeTemp = false
  query.pageNum = 1
  load()
}

/* ---------- 编辑弹窗 ---------- */
const dialogVisible = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const formRef = ref<FormInstance>()

type SubQuestion = {
  id?: number
  stem: string
  standardAnswer: string
  analysis: string
  knowledgePoints: string[]
  options: QuestionOption[]
  defaultScore: number
}

const form = reactive({
  id: 0,
  categoryId: undefined as number | undefined,
  title: '',
  content: '',
  difficulty: 2 as Difficulty,
  passageType: '',
  topic: '',
  source: 'MANUAL',
  summary: '',
  status: 1 as 0 | 1,
  isTemp: false,
  aiPrompt: '',
  questions: [] as SubQuestion[],
})

const rules: FormRules = {
  content: [{ required: true, message: '请输入文章内容', trigger: 'blur' }],
}

const resetForm = () => {
  form.id = 0
  form.categoryId = undefined
  form.title = ''
  form.content = ''
  form.difficulty = 2
  form.passageType = ''
  form.topic = ''
  form.source = 'MANUAL'
  form.summary = ''
  form.status = 1
  form.isTemp = false
  form.aiPrompt = ''
  form.questions = []
}

const openCreate = () => {
  editMode.value = 'create'
  resetForm()
  dialogVisible.value = true
}

const openAiGenerate = () => {
  editMode.value = 'create'
  resetForm()
  dialogVisible.value = true
  // 延迟一点让弹窗渲染完成后再触发 AI 生成
  setTimeout(() => {
    aiGeneratePassage()
  }, 100)
}

const openEdit = (row: ReadingPassage) => {
  editMode.value = 'edit'
  resetForm()
  form.id = row.id
  form.categoryId = row.categoryId
  form.title = row.title ?? ''
  form.content = row.content
  form.difficulty = row.difficulty
  form.passageType = row.passageType ?? ''
  form.topic = row.topic ?? ''
  form.source = row.source ?? 'MANUAL'
  form.summary = row.summary ?? ''
  form.status = (row.status ?? 1) as 0 | 1
  form.isTemp = !!row.isTemp
  form.aiPrompt = row.aiPrompt ?? ''
  form.questions = (row.questions ?? []).map((q) => ({
    id: q.id,
    stem: q.stem,
    standardAnswer: q.standardAnswer ?? '',
    analysis: q.analysis ?? '',
    knowledgePoints: q.knowledgePoints ?? [],
    options: (q.options ?? []).map((o) => ({ ...o })),
    defaultScore: q.defaultScore ?? 2,
  }))
  dialogVisible.value = true
}

/* 子题目增删 */
const addSubQuestion = () => {
  if (form.questions.length >= 10) {
    ElMessage.warning('一篇文章最多关联 10 道题')
    return
  }
  form.questions.push({
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
  form.questions.splice(idx, 1)
}

/* AI 生成文章 —— 调用后端 POST /admin/ai/generate-reading（DeepSeek） */
const aiGenerating = ref(false)
const aiGeneratePassage = async () => {
  if (!form.topic && !form.passageType) {
    ElMessage.warning('请先选择主题或文章类型')
    return
  }
  aiGenerating.value = true
  try {
    const res = await generateReading({
      topic: form.topic || undefined,
      passageType: form.passageType || undefined,
      difficulty: form.difficulty,
      questionCount: 5,
    })
    const data = res.data
    if (!data?.content) {
      ElMessage.warning('AI 未返回有效内容，请稍后重试')
      return
    }
    form.title = data.title ?? ''
    form.content = data.content
    form.summary = data.summary ?? ''
    form.source = 'AI'
    form.aiPrompt = `AI 生成：主题 ${form.topic || '综合'}，类型 ${typeLabel(form.passageType) || '通用'}，难度 ${diffLabel(form.difficulty)}`
    // 后端生成的配套题目带 options，映射为表单子题结构
    if (data.questions?.length) {
      form.questions = data.questions.map((q) => ({
        stem: q.stem,
        standardAnswer: q.standardAnswer ?? 'A',
        analysis: q.analysis ?? '',
        knowledgePoints: q.knowledgePoints ?? [],
        options: (q.options ?? []).map((o, i) => ({
          optionLabel: o.optionLabel,
          optionContent: o.optionContent,
          sortNo: o.sortNo ?? i + 1,
        })),
        defaultScore: q.defaultScore ?? 2,
      }))
    }
    ElMessage.success('AI 生成成功')
  } catch {
    /* request.ts 已统一弹出后端错误信息 */
  } finally {
    aiGenerating.value = false
  }
}

const submit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    const payload: ReadingPassageForm = {
      categoryId: form.categoryId,
      title: form.title,
      content: form.content,
      difficulty: form.difficulty,
      passageType: form.passageType || undefined,
      topic: form.topic || undefined,
      source: form.source,
      summary: form.summary,
      status: form.status,
      isTemp: form.isTemp,
      aiPrompt: form.aiPrompt || undefined,
      questions: form.questions.map((q) => ({
        stem: q.stem,
        standardAnswer: q.standardAnswer,
        analysis: q.analysis,
        knowledgePoints: q.knowledgePoints,
        options: q.options,
        defaultScore: q.defaultScore,
      })),
    }

    try {
      if (editMode.value === 'create') {
        await createReadingPassage(payload)
        ElMessage.success('创建成功')
      } else {
        await updateReadingPassage(form.id, payload)
        ElMessage.success('更新成功')
      }
      dialogVisible.value = false
      load()
    } catch {
      /* handled */
    }
  })
}

/* ---------- 操作 ---------- */
const confirmDelete = async (row: ReadingPassage) => {
  try {
    await ElMessageBox.confirm('确认删除该文章？被引用则自动软停用。', '删除确认', {
      type: 'warning',
    })
    await deleteReadingPassage(row.id)
    ElMessage.success('已删除')
    load()
  } catch {
    /* cancelled */
  }
}

const onSelection = (rows: ReadingPassage[]) => {
  selected.value = rows
}

const batchDelete = async () => {
  if (!selected.value.length) {
    ElMessage.warning('请先选择')
    return
  }
  try {
    await ElMessageBox.confirm(`确认删除 ${selected.value.length} 篇文章？`, '批量删除', {
      type: 'warning',
    })
    await batchDeleteReadingPassages(selected.value.map((r) => r.id))
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
  await batchStatusReadingPassages(selected.value.map((r) => r.id), status)
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
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-row :gutter="8">
          <el-form-item label="关键词">
            <el-input
              v-model="query.keyword"
              placeholder="标题/内容关键词"
              :maxlength="FormLimits.keyword.max"
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
              style="width: 160px"
            />
          </el-form-item>
          <el-form-item label="难度">
            <el-select v-model="query.difficulty" clearable placeholder="全部" style="width: 100px">
              <el-option v-for="op in difficultyOptions" :key="op.value" :label="op.label" :value="op.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="类型">
            <el-select v-model="query.passageType" clearable placeholder="全部" style="width: 120px">
              <el-option v-for="op in passageTypeOptions" :key="op.value" :label="op.label" :value="op.value" />
            </el-select>
          </el-form-item>
        </el-row>
        <el-row :gutter="8" style="margin-top: 8px">
          <el-form-item label="主题">
            <el-input v-model="query.topic" placeholder="主题标签" :maxlength="FormLimits.shortText.max" clearable style="width: 120px" />
          </el-form-item>
          <el-form-item label="来源">
            <el-select v-model="query.source" clearable placeholder="全部" style="width: 110px">
              <el-option v-for="op in sourceOptions" :key="op.value" :label="op.label" :value="op.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="query.status" clearable placeholder="全部" style="width: 100px">
              <el-option label="启用" :value="1" />
              <el-option label="停用" :value="0" />
            </el-select>
          </el-form-item>
          <el-form-item label="含临时">
            <el-switch v-model="query.includeTemp" />
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

    <el-card shadow="never" v-loading="loading">
      <div class="toolbar">
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>新增文章
        </el-button>
        <el-button type="success" @click="openAiGenerate" :loading="aiGenerating">
          <el-icon><MagicStick /></el-icon>AI 生成文章
        </el-button>
        <el-button type="primary" plain>
          <el-icon><Upload /></el-icon>导入文章
        </el-button>
        <el-button type="success" plain :disabled="!selected.length" @click="batchToggle(1)">
          批量启用
        </el-button>
        <el-button type="warning" plain :disabled="!selected.length" @click="batchToggle(0)">
          批量停用
        </el-button>
        <el-button type="danger" plain :disabled="!selected.length" @click="batchDelete">
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
        <el-table-column prop="title" label="标题" min-width="160" show-overflow-tooltip />
        <el-table-column label="内容预览" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">{{ row.content }}</template>
        </el-table-column>
        <el-table-column label="难度" width="90">
          <template #default="{ row }">
            <el-tag :type="diffTagType(row.difficulty)" size="small">{{ diffLabel(row.difficulty) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">{{ typeLabel(row.passageType) }}</template>
        </el-table-column>
        <el-table-column label="来源" width="100">
          <template #default="{ row }">{{ sourceLabel(row.source) }}</template>
        </el-table-column>
        <el-table-column label="题数" width="80" align="center">
          <template #default="{ row }">{{ row.questionCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="字数" width="80" align="center">
          <template #default="{ row }">{{ row.wordCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{
              row.status === 1 ? '启用' : '停用'
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 卡片布局 -->
      <div v-else class="passage-grid">
        <el-card
          v-for="item in list"
          :key="item.id"
          class="passage-card"
          hover
          @click="openEdit(item)"
        >
          <div class="card-header">
            <el-checkbox
              :checked="selected.some((s) => s.id === item.id)"
              @change="(v: unknown) => {
                if (v) selected.push(item)
                else selected = selected.filter((s) => s.id !== item.id)
              }"
              @click.stop
            />
            <span class="p-id">#{{ item.id }}</span>
            <el-tag :type="item.status === 1 ? 'success' : 'info'" size="small">{{
              item.status === 1 ? '启用' : '停用'
            }}</el-tag>
            <el-tag :type="diffTagType(item.difficulty)" size="small">{{ diffLabel(item.difficulty) }}</el-tag>
            <el-tag size="small" type="info">{{ typeLabel(item.passageType) }}</el-tag>
          </div>
          <div class="card-title">{{ item.title || '(无标题)' }}</div>
          <div class="card-content">{{ item.content }}</div>
          <div class="card-meta">
            <span class="meta-item">
              <span class="meta-label">分类</span>
              <span class="meta-value">{{ item.categoryName || '-' }}</span>
            </span>
            <span class="meta-item">
              <span class="meta-label">字数</span>
              <span class="meta-value">{{ item.wordCount ?? 0 }}</span>
            </span>
            <span class="meta-item">
              <span class="meta-label">题数</span>
              <span class="meta-value">{{ item.questionCount ?? 0 }} 道</span>
            </span>
            <span class="meta-item">
              <span class="meta-label">来源</span>
              <span class="meta-value">{{ sourceLabel(item.source) }}</span>
            </span>
          </div>
          <div class="card-footer">
            <span v-if="item.topic" class="topic-tag">🏷️ {{ item.topic }}</span>
            <div class="actions">
              <el-button type="primary" size="small" @click.stop="openEdit(item)">
                <el-icon><Edit /></el-icon>编辑
              </el-button>
              <el-button type="danger" size="small" @click.stop="confirmDelete(item)">
                <el-icon><Delete /></el-icon>删除
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
          :page-sizes="[10, 20, 50]"
          @size-change="load"
          @current-change="load"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editMode === 'create' ? '新增阅读文章' : '编辑阅读文章'"
      width="860px"
      top="5vh"
      class="passage-dialog"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="分类">
              <el-cascader
                v-model="form.categoryId"
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
              <el-select v-model="form.difficulty" style="width: 100%">
                <el-option v-for="op in difficultyOptions" :key="op.value" :label="op.label" :value="op.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="文章类型">
              <el-select v-model="form.passageType" clearable placeholder="选择类型" style="width: 100%">
                <el-option v-for="op in passageTypeOptions" :key="op.value" :label="op.label" :value="op.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="14">
            <el-form-item label="标题">
              <el-input v-model="form.title" :maxlength="FormLimits.paperTitle.max" show-word-limit placeholder="文章标题（可选）" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="主题">
              <el-input v-model="form.topic" :maxlength="FormLimits.shortText.max" placeholder="如：科技、环保" />
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="来源">
              <el-select v-model="form.source" style="width: 100%">
                <el-option v-for="op in sourceOptions" :key="op.value" :label="op.label" :value="op.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
          <el-checkbox v-model="form.isTemp" style="margin-left: 20px">临时文章（不入正式库）</el-checkbox>
        </el-form-item>

        <el-form-item label="文章内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="8"
            :maxlength="FormLimits.articleText.max"
            show-word-limit
            placeholder="请输入文章正文"
          />
        </el-form-item>

        <el-form-item label="摘要">
          <el-input
            v-model="form.summary"
            type="textarea"
            :rows="2"
            :maxlength="FormLimits.mediumText.max"
            show-word-limit
            placeholder="文章摘要/简介（可选）"
          />
        </el-form-item>

        <el-divider content-position="left">
          <span class="divider-title">📚 关联题目（{{ form.questions.length }} 道）</span>
        </el-divider>

        <div class="questions-section">
          <el-button size="small" type="primary" plain @click="addSubQuestion">
            <el-icon><Plus /></el-icon>添加题目
          </el-button>

          <div v-for="(q, qIdx) in form.questions" :key="qIdx" class="sub-question-item">
            <div class="sub-q-header">
              <span class="sub-q-num">第 {{ qIdx + 1 }} 题</span>
              <el-button link type="danger" size="small" @click="removeSubQuestion(qIdx)">移除</el-button>
            </div>
            <el-form-item label="题干" :label-width="60">
              <el-input v-model="q.stem" :maxlength="FormLimits.questionStem.max" placeholder="题目题干" />
            </el-form-item>
            <el-form-item label="选项" :label-width="60">
              <div class="sub-options">
                <div v-for="(opt, oIdx) in q.options" :key="oIdx" class="sub-opt-row">
                  <el-tag class="opt-key">{{ opt.optionLabel }}</el-tag>
                  <el-input v-model="opt.optionContent" :maxlength="FormLimits.optionContent.max" placeholder="选项内容" size="small" />
                </div>
              </div>
            </el-form-item>
            <el-form-item label="答案" :label-width="60">
              <el-radio-group v-model="q.standardAnswer">
                <el-radio v-for="opt in q.options" :key="opt.optionLabel" :value="opt.optionLabel">
                  {{ opt.optionLabel }}
                </el-radio>
              </el-radio-group>
              <span style="margin-left: 20px">分值：</span>
              <el-input-number v-model="q.defaultScore" :min="0.5" :max="20" :step="0.5" size="small" />
            </el-form-item>
            <el-form-item label="解析" :label-width="60">
              <el-input v-model="q.analysis" type="textarea" :rows="2" :maxlength="FormLimits.analysis.max" show-word-limit placeholder="答案解析" />
            </el-form-item>
            <el-form-item label="知识点" :label-width="60">
              <el-select v-model="q.knowledgePoints" multiple collapse-tags allow-create filterable placeholder="输入后回车添加" style="width: 100%" />
            </el-form-item>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="aiGeneratePassage" :loading="aiGenerating">
          <el-icon><MagicStick /></el-icon>AI 生成
        </el-button>
        <el-button type="primary" @click="submit">保存</el-button>
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

.passage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 16px;
}

.passage-card {
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.p-id {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
  line-height: 1.4;
}

.card-content {
  font-size: 13px;
  line-height: 1.6;
  color: #606266;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
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

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.topic-tag {
  font-size: 12px;
  color: #909399;
}

.actions {
  display: flex;
  gap: 6px;
}

.passage-dialog :deep(.el-dialog__body) {
  max-height: 75vh;
  overflow-y: auto;
}

.divider-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.questions-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sub-question-item {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px 16px;
  border: 1px solid #ebeef5;
}

.sub-q-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.sub-q-num {
  font-weight: 600;
  font-size: 14px;
  color: #409eff;
}

.sub-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  width: 100%;
}

.sub-opt-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.opt-key {
  flex-shrink: 0;
  width: 28px;
  text-align: center;
  font-weight: 600;
}
</style>
