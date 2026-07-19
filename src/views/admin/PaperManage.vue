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
  listCategoryTree,
  type AdminQuestionQuery,
} from '@/api/admin'
import type { Paper, PaperForm } from '@/types/paper'
import type { Question } from '@/types/question'
import type { Category } from '@/types/category'
import type { QuestionType, Difficulty } from '@/types/common'

const query = reactive({
  paperName: '',
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

interface PickedQuestion {
  questionId: number
  stem: string
  questionType: QuestionType
  difficulty: Difficulty
  score: number
}

const paperForm = reactive({
  id: 0,
  paperName: '',
  description: '',
  passScore: 60 as number | undefined,
  shuffleQuestions: false,
  status: 0 as 0 | 1 | 2,
})

const picked = ref<PickedQuestion[]>([])
const totalScore = computed(() => picked.value.reduce((s, q) => s + Number(q.score || 0), 0))
const pickedIds = computed(() => new Set(picked.value.map((q) => q.questionId)))

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
    picked.value = (res.data.questions ?? []).map((pq) => ({
      questionId: pq.questionId,
      stem: pq.stem,
      questionType: pq.questionType,
      difficulty: pq.difficulty,
      score: Number(pq.questionScore),
    }))
  } catch { /* silent */ }
}

/* ---------------- 题库选择器 ---------------- */
const bankVisible = ref(false)
const bank = reactive<AdminQuestionQuery & { total: number }>({
  keyword: '', categoryId: undefined, questionType: undefined, difficulty: undefined,
  pageNum: 1, pageSize: 8, total: 0,
})
const bankList = ref<Question[]>([])
const bankLoading = ref(false)
const categories = ref<Category[]>([])

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

const loadBank = async () => {
  bankLoading.value = true
  try {
    const res = await listAdminQuestions({
      pageNum: bank.pageNum, pageSize: bank.pageSize,
      keyword: bank.keyword || undefined,
      categoryId: bank.categoryId,
      questionType: bank.questionType,
      difficulty: bank.difficulty,
      status: 1,
    })
    bankList.value = res.data.records ?? []
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

const addQuestion = (q: Question) => {
  if (pickedIds.value.has(q.id)) { ElMessage.info('已选择过'); return }
  picked.value.push({
    questionId: q.id,
    stem: q.stem,
    questionType: q.questionType,
    difficulty: q.difficulty,
    score: q.defaultScore ?? 2,
  })
  ElMessage.success(`已加入：${q.stem.slice(0, 20)}${q.stem.length > 20 ? '...' : ''}`)
}
const removePicked = (id: number) => {
  picked.value = picked.value.filter((q) => q.questionId !== id)
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
    if (picked.value.some((q) => !q.score || q.score <= 0)) { ElMessage.warning('每题必须设置分值'); return }
    step.value = 2
    return
  }
}
const prevStep = () => { if (step.value > 0) step.value-- }

/* ---------------- 保存 ---------------- */
const submit = async () => {
  submitting.value = true
  const payload: PaperForm = {
    paperName: paperForm.paperName,
    description: paperForm.description,
    passScore: paperForm.passScore,
    shuffleQuestions: paperForm.shuffleQuestions,
    status: paperForm.status,
    questions: picked.value.map((q, i) => ({
      questionId: q.questionId,
      questionScore: q.score,
      questionOrder: i + 1,
    })),
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
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-form-item label="试卷名称">
          <el-input v-model="query.paperName" clearable placeholder="试卷名称" style="width:200px" />
        </el-form-item>
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
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" v-loading="loading">
      <div class="toolbar">
        <el-button type="primary" @click="openCreate"><el-icon><Plus /></el-icon>新建试卷</el-button>
      </div>
      <el-table :data="list" style="width:100%">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="paperName" label="试卷名称" min-width="200" />
        <el-table-column prop="questionCount" label="题量" width="80" align="center" />
        <el-table-column prop="totalScore" label="总分" width="80" align="center" />
        <el-table-column prop="passScore" label="及格分" width="80" align="center" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="AI 生成" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.aiGenerated" type="warning" size="small" effect="light">AI</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="280" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="row.status !== 1" link type="success" size="small" @click="publish(row)">发布</el-button>
            <el-button v-else link type="warning" size="small" @click="unpublish(row)">下架</el-button>
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
              已选 <b>{{ picked.length }}</b> 题，总分 <b style="color:#409eff">{{ totalScore }}</b>
            </div>
            <el-button type="primary" @click="openBank">
              <el-icon><Plus /></el-icon>从题库选题
            </el-button>
          </div>
          <el-table :data="picked" style="width:100%; margin-top:12px" empty-text="尚未选题，请点击右上角">
            <el-table-column type="index" label="题号" width="70" />
            <el-table-column prop="stem" label="题干" min-width="360" show-overflow-tooltip />
            <el-table-column label="题型" width="100">
              <template #default="{ row }">{{ typeLabel(row.questionType) }}</template>
            </el-table-column>
            <el-table-column label="难度" width="80">
              <template #default="{ row }">
                <el-tag :type="diffTagType(row.difficulty)" size="small">{{ diffLabel(row.difficulty) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="分值" width="140">
              <template #default="{ row }">
                <el-input-number v-model="row.score" :min="0.5" :max="100" :step="0.5" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" align="center">
              <template #default="{ row }">
                <el-button link type="danger" size="small" @click="removePicked(row.questionId)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- Step 3 -->
        <div v-else-if="step === 2" class="step3">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="试卷名称">{{ paperForm.paperName }}</el-descriptions-item>
            <el-descriptions-item label="题量">{{ picked.length }}</el-descriptions-item>
            <el-descriptions-item label="总分">{{ totalScore }}</el-descriptions-item>
            <el-descriptions-item label="及格分">{{ paperForm.passScore ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="随机乱序">{{ paperForm.shuffleQuestions ? '是' : '否' }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ statusText(paperForm.status) }}</el-descriptions-item>
            <el-descriptions-item label="描述" :span="2">{{ paperForm.description || '-' }}</el-descriptions-item>
          </el-descriptions>
          <h4 style="margin-top:16px">题目列表</h4>
          <el-table :data="picked" style="width:100%">
            <el-table-column type="index" label="#" width="60" />
            <el-table-column prop="stem" label="题干" show-overflow-tooltip />
            <el-table-column label="题型" width="100">
              <template #default="{ row }">{{ typeLabel(row.questionType) }}</template>
            </el-table-column>
            <el-table-column prop="score" label="分值" width="80" align="center" />
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
        <el-form-item>
          <el-input v-model="bank.keyword" placeholder="题干关键词" clearable style="width:180px" />
        </el-form-item>
        <el-form-item>
          <el-cascader
            v-model="bank.categoryId"
            :options="categories"
            :props="{ value: 'id', label: 'categoryName', children: 'children', checkStrictly: true, emitPath: false }"
            clearable placeholder="分类" style="width:180px"
          />
        </el-form-item>
        <el-form-item>
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

      <el-table :data="bankList" v-loading="bankLoading" style="width:100%">
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
            <el-button
              size="small"
              type="primary"
              :disabled="pickedIds.has(row.id)"
              @click="addQuestion(row)"
            >
              {{ pickedIds.has(row.id) ? '已加入' : '加入' }}
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
          <span>已选 {{ picked.length }} 题，总分 {{ totalScore }}</span>
          <el-button type="primary" @click="bankVisible = false">完成</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.toolbar { margin-bottom: 12px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }

.step-body { min-height: 300px; padding: 8px 4px; }
.step2-header { display: flex; justify-content: space-between; align-items: center; padding-top: 16px; }
.step3 h4 { margin: 12px 0; font-size: 14px; color: #606266; }
</style>
