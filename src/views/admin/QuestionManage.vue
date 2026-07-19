<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  listAdminQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  batchDeleteQuestions,
  batchStatusQuestions,
  listCategoryTree,
} from '@/api/admin'
import type { Question, QuestionOption, QuestionForm } from '@/types/question'
import type { Difficulty, QuestionType } from '@/types/common'
import type { Category } from '@/types/category'

const query = reactive({
  keyword: '',
  categoryId: undefined as number | undefined,
  questionType: undefined as QuestionType | undefined,
  difficulty: undefined as Difficulty | undefined,
  status: undefined as number | undefined,
  pageNum: 1,
  pageSize: 50,
})

const list = ref<Question[]>([])
const total = ref(0)
const loading = ref(false)
const categories = ref<Category[]>([])
const selected = ref<Question[]>([])

const typeOptions: { label: string; value: QuestionType }[] = [
  { label: '单选题', value: 'SINGLE' },
  { label: '多选题', value: 'MULTIPLE' },
  { label: '判断题', value: 'JUDGE' },
  { label: '填空题', value: 'FILL_HINT' },
  { label: '阅读理解', value: 'READING' },
]
const diffOptions: { label: string; value: Difficulty }[] = [
  { label: '简单', value: 1 },
  { label: '中等', value: 2 },
  { label: '困难', value: 3 },
]

const typeLabel = (t?: QuestionType) => typeOptions.find((o) => o.value === t)?.label ?? t
const diffLabel = (d?: Difficulty) => diffOptions.find((o) => o.value === d)?.label ?? String(d)
const diffTagType = (d?: Difficulty) => (d === 1 ? 'success' : d === 2 ? 'warning' : 'danger')

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
    })
    list.value = res.data.records ?? []
    total.value = res.data.total ?? 0
  } finally {
    loading.value = false
  }
}
const search = () => { query.pageNum = 1; load() }
const reset = () => {
  query.keyword = ''
  query.categoryId = undefined
  query.questionType = undefined
  query.difficulty = undefined
  query.status = undefined
  query.pageNum = 1
  load()
}

/* ---------------- 编辑弹窗 ---------------- */
const dialogVisible = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const formRef = ref<FormInstance>()

type FormShape = {
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
}

const form = reactive<FormShape>({
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
})

const rules: FormRules = {
  categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }],
  questionType: [{ required: true, message: '请选择题型', trigger: 'change' }],
  difficulty: [{ required: true, message: '请选择难度', trigger: 'change' }],
  stem: [{ required: true, message: '请输入题干', trigger: 'blur' }],
}

const resetForm = () => {
  Object.assign(form, {
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
  })
}

const openCreate = () => {
  editMode.value = 'create'
  resetForm()
  dialogVisible.value = true
}

const openEdit = (row: Question) => {
  editMode.value = 'edit'
  resetForm()
  form.id = row.id
  form.categoryId = row.categoryId
  form.questionType = row.questionType
  form.difficulty = row.difficulty
  form.stem = row.stem
  form.defaultScore = row.defaultScore ?? 2
  form.status = (row.status ?? 1) as 0 | 1
  form.hasTrap = !!row.hasTrap
  form.trapNote = row.trapNote || ''
  form.analysis = row.analysis || ''
  form.options = row.options?.length
    ? row.options.map((o) => ({ ...o }))
    : form.options

  const a = row.standardAnswer || ''
  if (row.questionType === 'MULTIPLE') {
    form.answerMulti = a.split(',').map((s) => s.trim()).filter(Boolean)
  } else if (row.questionType === 'JUDGE') {
    form.answerJudge = (a.toUpperCase() === 'TRUE' ? 'TRUE' : a.toUpperCase() === 'FALSE' ? 'FALSE' : '') as 'TRUE' | 'FALSE' | ''
  } else if (row.questionType === 'FILL_HINT') {
    form.answerFill = a
  } else {
    form.answerSingle = a
  }
  dialogVisible.value = true
}

/* 题型切换 */
watch(() => form.questionType, (t) => {
  if (t === 'JUDGE' || t === 'FILL_HINT') {
    form.options = []
  } else if (!form.options.length) {
    form.options = [
      { optionLabel: 'A', optionContent: '', sortNo: 1 },
      { optionLabel: 'B', optionContent: '', sortNo: 2 },
      { optionLabel: 'C', optionContent: '', sortNo: 3 },
      { optionLabel: 'D', optionContent: '', sortNo: 4 },
    ]
  }
})

const nextLabel = () => {
  const used = new Set(form.options.map((o) => o.optionLabel))
  for (let i = 0; i < 26; i++) {
    const k = String.fromCharCode(65 + i)
    if (!used.has(k)) return k
  }
  return 'Z'
}
const addOption = () => {
  if (form.options.length >= 8) { ElMessage.warning('选项最多 8 个'); return }
  form.options.push({ optionLabel: nextLabel(), optionContent: '', sortNo: form.options.length + 1 })
}
const removeOption = (idx: number) => {
  if (form.options.length <= 2) { ElMessage.warning('至少 2 个选项'); return }
  form.options.splice(idx, 1)
  form.options.forEach((o, i) => (o.sortNo = i + 1))
}

const submit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    let standardAnswer = ''
    if (form.questionType === 'MULTIPLE') {
      if (!form.answerMulti.length) { ElMessage.warning('请选择正确答案'); return }
      standardAnswer = [...form.answerMulti].sort().join(',')
    } else if (form.questionType === 'JUDGE') {
      if (!form.answerJudge) { ElMessage.warning('请选择正确答案'); return }
      standardAnswer = form.answerJudge
    } else if (form.questionType === 'FILL_HINT') {
      if (!form.answerFill.trim()) { ElMessage.warning('请输入填空答案'); return }
      standardAnswer = form.answerFill.trim().toUpperCase()
    } else {
      if (!form.answerSingle) { ElMessage.warning('请选择正确答案'); return }
      standardAnswer = form.answerSingle
    }

    const payload: QuestionForm = {
      categoryId: form.categoryId!,
      questionType: form.questionType,
      stem: form.stem,
      standardAnswer,
      analysis: form.analysis,
      difficulty: form.difficulty,
      defaultScore: form.defaultScore,
      status: form.status,
      hasTrap: form.hasTrap,
      trapNote: form.trapNote,
      options: form.questionType === 'JUDGE' || form.questionType === 'FILL_HINT' ? [] : form.options.map((o, i) => ({
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
        await updateQuestion(form.id, payload)
        ElMessage.success('更新成功')
      }
      dialogVisible.value = false
      load()
    } catch { /* handled */ }
  })
}

/* ---------------- 行操作 & 批量 ---------------- */
const confirmDelete = async (row: Question) => {
  try {
    await ElMessageBox.confirm('确认删除该题？被引用则自动软停用。', '删除确认', { type: 'warning' })
    await deleteQuestion(row.id)
    ElMessage.success('已删除')
    load()
  } catch { /* cancelled */ }
}

const onSelection = (rows: Question[]) => { selected.value = rows }

const batchDelete = async () => {
  if (!selected.value.length) { ElMessage.warning('请先选择'); return }
  try {
    await ElMessageBox.confirm(`确认删除 ${selected.value.length} 道题？`, '批量删除', { type: 'warning' })
    await batchDeleteQuestions(selected.value.map((r) => r.id))
    ElMessage.success('已删除')
    load()
  } catch { /* cancelled */ }
}

const batchToggle = async (status: 0 | 1) => {
  if (!selected.value.length) { ElMessage.warning('请先选择'); return }
  try {
    await batchStatusQuestions(selected.value.map((r) => r.id), status)
    ElMessage.success(status === 1 ? '已启用' : '已停用')
    load()
  } catch { /* handled */ }
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
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="题干关键词" clearable style="width:180px" />
        </el-form-item>
        <el-form-item label="分类">
          <el-cascader
            v-model="query.categoryId"
            :options="categories"
            :props="{ value: 'id', label: 'categoryName', children: 'children', checkStrictly: true, emitPath: false }"
            clearable placeholder="选择分类" style="width:200px"
          />
        </el-form-item>
        <el-form-item label="题型">
          <el-select v-model="query.questionType" clearable placeholder="全部" style="width:120px">
            <el-option v-for="op in typeOptions" :key="op.value" :label="op.label" :value="op.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="难度">
          <el-select v-model="query.difficulty" clearable placeholder="全部" style="width:100px">
            <el-option v-for="op in diffOptions" :key="op.value" :label="op.label" :value="op.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="全部" style="width:100px">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
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
        <el-button type="primary" @click="openCreate"><el-icon><Plus /></el-icon>新增试题</el-button>
        <el-button type="success" plain :disabled="!selected.length" @click="batchToggle(1)">批量启用</el-button>
        <el-button type="warning" plain :disabled="!selected.length" @click="batchToggle(0)">批量停用</el-button>
        <el-button type="danger" plain :disabled="!selected.length" @click="batchDelete">批量删除</el-button>
      </div>
      <el-table :data="list" style="width:100%" @selection-change="onSelection">
        <el-table-column type="selection" width="45" />
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="stem" label="题干" min-width="320" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="分类" width="120" />
        <el-table-column label="题型" width="100">
          <template #default="{ row }">{{ typeLabel(row.questionType) }}</template>
        </el-table-column>
        <el-table-column label="难度" width="80">
          <template #default="{ row }">
            <el-tag :type="diffTagType(row.difficulty)" size="small">{{ diffLabel(row.difficulty) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="usageCount" label="被引用" width="80" align="center" />
        <el-table-column label="操作" width="140" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
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

    <el-dialog v-model="dialogVisible" :title="editMode === 'create' ? '新增试题' : '编辑试题'" width="780px" top="6vh">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="分类" prop="categoryId">
              <el-cascader
                v-model="form.categoryId"
                :options="categories"
                :props="{ value: 'id', label: 'categoryName', children: 'children', checkStrictly: true, emitPath: false }"
                clearable style="width:100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="题型" prop="questionType">
              <el-select v-model="form.questionType" style="width:100%">
                <el-option v-for="op in typeOptions" :key="op.value" :label="op.label" :value="op.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="难度" prop="difficulty">
              <el-select v-model="form.difficulty" style="width:100%">
                <el-option v-for="op in diffOptions" :key="op.value" :label="op.label" :value="op.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="默认分值">
              <el-input-number v-model="form.defaultScore" :min="0.5" :max="100" :step="0.5" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status">
                <el-radio :value="1">启用</el-radio>
                <el-radio :value="0">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="题干" prop="stem">
          <el-input v-model="form.stem" type="textarea" :rows="3" placeholder="请输入题干" />
        </el-form-item>

        <el-form-item v-if="form.questionType !== 'JUDGE' && form.questionType !== 'FILL_HINT'" label="选项">
          <div class="opt-list">
            <div v-for="(op, idx) in form.options" :key="idx" class="opt-row">
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
          <el-radio-group v-if="form.questionType === 'SINGLE' || form.questionType === 'READING'" v-model="form.answerSingle">
            <el-radio v-for="op in form.options" :key="op.optionLabel" :value="op.optionLabel">{{ op.optionLabel }}</el-radio>
          </el-radio-group>
          <el-checkbox-group v-else-if="form.questionType === 'MULTIPLE'" v-model="form.answerMulti">
            <el-checkbox v-for="op in form.options" :key="op.optionLabel" :value="op.optionLabel">{{ op.optionLabel }}</el-checkbox>
          </el-checkbox-group>
          <el-radio-group v-else-if="form.questionType === 'JUDGE'" v-model="form.answerJudge">
            <el-radio value="TRUE">正确</el-radio>
            <el-radio value="FALSE">错误</el-radio>
          </el-radio-group>
          <el-input v-else-if="form.questionType === 'FILL_HINT'" v-model="form.answerFill" placeholder="填空答案（单词，会自动转大写）" />
        </el-form-item>

        <el-form-item label="陷阱干扰">
          <el-switch v-model="form.hasTrap" />
          <el-input v-if="form.hasTrap" v-model="form.trapNote" placeholder="陷阱说明（可选）" style="margin-top:6px" />
        </el-form-item>

        <el-form-item label="解析">
          <el-input v-model="form.analysis" type="textarea" :rows="3" placeholder="题目解析（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.toolbar { margin-bottom: 12px; display: flex; gap: 6px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }

.opt-list { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.opt-row { display: flex; gap: 8px; align-items: center; }
.opt-key { flex-shrink: 0; width: 32px; text-align: center; font-weight: 600; }
</style>
