<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { listUsers, listCategoryTree } from '@/api/admin'
import { analyzeStudent, analyzeStudents, generatePreview, confirmPaper, getMyStudents, directGenerate } from '@/api/ai'
import type { UserDetail } from '@/types/user'
import type { Category } from '@/types/category'
import type { Question } from '@/types/question'
import type { QuestionType, Difficulty } from '@/types/common'
import type {
  StudentAnalysis,
  GeneratePaperForm,
  GeneratePaperPreview,
} from '@/types/ai'
import type { BatchStudentAnalysis } from '@/api/ai'

/* ============================================================ *
 *  1. 学生 & 学情分析
 * ============================================================ */

const students = ref<UserDetail[]>([])
const myStudents = ref<UserDetail[]>([])
const loadingMyStudents = ref(false)
const activeFilter = ref<'all' | 'mine'>('all')

const filteredStudents = computed(() => {
  if (activeFilter.value === 'mine' && myStudents.value.length > 0) {
    return myStudents.value
  }
  return students.value
})

const selectedStudentIds = ref<number[]>([])
const selectedStudents = computed(() =>
  students.value.filter((s) => selectedStudentIds.value.includes(s.id))
)

const allSelectedIds = computed(() => filteredStudents.value.map(s => s.id))
const isAllSelected = computed(() =>
  filteredStudents.value.length > 0 &&
  filteredStudents.value.every(s => selectedStudentIds.value.includes(s.id))
)

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedStudentIds.value = []
  } else {
    selectedStudentIds.value = [...new Set([...selectedStudentIds.value, ...allSelectedIds.value])]
  }
}

const selectMyStudents = async () => {
  if (myStudents.value.length > 0) {
    activeFilter.value = 'mine'
    selectedStudentIds.value = myStudents.value.map(s => s.id)
    ElMessage.success(`已选择 ${myStudents.value.length} 名我的学生`)
    return
  }
  loadingMyStudents.value = true
  try {
    const res = await getMyStudents()
    myStudents.value = res.data ?? []
    activeFilter.value = 'mine'
    if (myStudents.value.length > 0) {
      selectedStudentIds.value = myStudents.value.map(s => s.id)
      ElMessage.success(`已加载并选择 ${myStudents.value.length} 名我的学生`)
    } else {
      ElMessage.info('暂无班级学生，请先在班级管理中分配学生')
    }
  } catch {
    ElMessage.warning('加载我的学生失败，显示全部学生')
    activeFilter.value = 'all'
  } finally {
    loadingMyStudents.value = false
  }
}


const clearSelection = () => {
  selectedStudentIds.value = []
}

const loadStudents = async () => {
  try {
    const res = await listUsers({ pageNum: 1, pageSize: 500, role: 'STUDENT' })
    students.value = res.data.records ?? []
  } catch { /* handled */ }
}

const analysis = ref<StudentAnalysis | null>(null)
const batchAnalysis = ref<BatchStudentAnalysis | null>(null)
const analysisLoading = ref(false)
/** 老师可编辑的学情文本，独立于 analysis.analysis */
const analysisDraft = ref('')

const fetchAnalysis = async () => {
  if (selectedStudentIds.value.length === 0) {
    analysis.value = null
    batchAnalysis.value = null
    analysisDraft.value = ''
    return
  }
  
  analysisLoading.value = true
  try {
    if (selectedStudentIds.value.length === 1) {
      // 单选学生：使用单个分析接口
      const singleId = selectedStudentIds.value[0]
        if (singleId === undefined) return
        const res = await analyzeStudent(singleId)
      analysis.value = res.data
      batchAnalysis.value = null
      analysisDraft.value = res.data.analysis || ''
    } else {
      // 多选学生：使用批量分析接口（整体分析）
      const res = await analyzeStudents(selectedStudentIds.value)
      batchAnalysis.value = res.data
      analysis.value = null
      // 使用整体分析文本作为分析草稿
      analysisDraft.value = res.data.overallAnalysis || ''
    }
  } catch {
    analysis.value = null
    batchAnalysis.value = null
    analysisDraft.value = ''
  } finally {
    analysisLoading.value = false
  }
}

/* 选学生时自动分析 */
import { watch } from 'vue'
watch(selectedStudentIds, (ids) => {
  if (ids.length > 0) fetchAnalysis()
  else { analysis.value = null; analysisDraft.value = '' }
})

/* ============================================================ *
 *  2. 参数表单
 * ============================================================ */

const categories = ref<Category[]>([])
const loadCategories = async () => {
  try {
    const res = await listCategoryTree()
    categories.value = Array.isArray(res.data) ? res.data : []
  } catch { /* silent */ }
}

/** 打平分类树 */
const flatCategories = computed(() => {
  const out: { id: number; label: string; depth: number }[] = []
  const walk = (arr: Category[], depth: number) => {
    arr.forEach((c) => {
      out.push({ id: c.id, label: c.categoryName, depth })
      if (c.children?.length) walk(c.children, depth + 1)
    })
  }
  walk(categories.value, 0)
  return out
})

const formRef = ref<FormInstance>()
const form = reactive({
  categoryIds: [] as number[],
  easyPct: 40,
  mediumPct: 40,
  hardPct: 20,
  withTrap: true,
  focusWeak: true,
  questionCount: 25,
  singleWeight: 50,
  multipleWeight: 15,
  readingWeight: 15,
  judgeWeight: 10,
  fillWeight: 10,
})

const difficultySum = computed(() => form.easyPct + form.mediumPct + form.hardPct)
const difficultyValid = computed(() => difficultySum.value === 100)
const typeSum = computed(() => form.singleWeight + form.multipleWeight + form.readingWeight + form.judgeWeight + form.fillWeight)
const typeValid = computed(() => typeSum.value === 100)

const rules: FormRules = {
  categoryIds: [{
    required: true, trigger: 'change',
    validator: (_r, v: number[], cb) => {
      if (!v || !v.length) cb(new Error('至少选择一个语法专题'))
      else cb()
    },
  }],
  questionCount: [{ required: true, message: '请输入题量' }],
}

/** 一键加入薄弱分类 */
const pickWeakCategories = () => {
  let weaks: number[] = []
  
  if (analysis.value?.categoryStats) {
    // 单选学生：使用单个学生的薄弱分类
    weaks = analysis.value.categoryStats
      .filter((s) => s.wrongCount > 0)
      .sort((a, b) => b.wrongCount - a.wrongCount)
      .slice(0, 5)
      .map((s) => s.categoryId)
  } else if (batchAnalysis.value?.commonWeakCategories) {
    // 多选学生：使用共同薄弱分类
    weaks = batchAnalysis.value.commonWeakCategories
      .slice(0, 5)
      .map((c) => c.categoryId)
  }
  
  if (!weaks.length) { ElMessage.info('暂无薄弱专题数据'); return }
  const merged = new Set([...form.categoryIds, ...weaks])
  form.categoryIds = Array.from(merged)
  ElMessage.success(`已加入 ${weaks.length} 个薄弱专题`)
}
const clearCategories = () => { form.categoryIds = [] }

const typeOptions = [
  { label: '单选题', field: 'singleWeight' as const },
  { label: '多选题', field: 'multipleWeight' as const },
  { label: '阅读理解', field: 'readingWeight' as const },
  { label: '判断题', field: 'judgeWeight' as const },
  { label: '填空题', field: 'fillWeight' as const },
]

/* ============================================================ *
 *  3. 生成预览
 * ============================================================ */

const composing = ref(false)
const preview = ref<GeneratePaperPreview | null>(null)

const doCompose = async () => {
  if (selectedStudentIds.value.length === 0) { ElMessage.warning('请先选择学生'); return }
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    if (!difficultyValid.value) { ElMessage.warning('难度三档百分比之和必须为 100%'); return }
    if (!typeValid.value) { ElMessage.warning('题型占比之和必须为 100%'); return }

    composing.value = true
    preview.value = null

    // 构建出题参数
        const sid = selectedStudentIds.value[0]
          if (sid === undefined) { ElMessage.warning('请先选择学生'); return }
          const payload: GeneratePaperForm = {
          targetUserId: sid,
          targetUserIds: selectedStudentIds.value,  // 传递所有选中的学生 ID
          analysisText: analysisDraft.value,
          categoryIds: [...form.categoryIds],
          easyPct: form.easyPct,
          mediumPct: form.mediumPct,
          hardPct: form.hardPct,
          withTrap: form.withTrap,
          focusWeak: form.focusWeak,
          questionCount: form.questionCount,
          singleWeight: form.singleWeight,
          multipleWeight: form.multipleWeight,
          readingWeight: form.readingWeight,
          judgeWeight: form.judgeWeight,
          fillWeight: form.fillWeight,
        }
    try {
      const res = await generatePreview(payload)
      preview.value = res.data
      const studentNames = selectedStudents.value.map(s => s.realName || s.username).join('、')
      ElMessage.success(`已为 ${studentNames} 生成 ${res.data.questions?.length ?? 0} 道题`)
      setTimeout(() => {
        document.querySelector('#preview-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch { /* handled */ } finally { composing.value = false }
  })
}

/* ============================================================ *
 *  4. 一键出卷/考试
 * ============================================================ */

const directGenerating = ref(false)
const directResult = ref<{ paperId: number; sessionId: number } | null>(null)

const doDirectGenerate = async () => {
  if (selectedStudentIds.value.length === 0) { ElMessage.warning('请先选择学生'); return }
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    if (!difficultyValid.value) { ElMessage.warning('难度三档百分比之和必须为 100%'); return }
    if (!typeValid.value) { ElMessage.warning('题型占比之和必须为 100%'); return }

    const names = selectedStudents.value.map(s => s.realName || s.username).join('、')
    const stamp = new Date().toISOString().slice(0, 10)
    const paperName = `AI · ${names || '学生'} · ${stamp}`
    const sessionName = `${names || '学生'} 专项训练 (${stamp})`
    const now = new Date()
    const later = new Date(now.getTime() + 24 * 3600 * 1000)
    const fmt = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    }

    directGenerating.value = true
    directResult.value = null

    try {
      const sid = selectedStudentIds.value[0]
      if (sid === undefined) { ElMessage.warning('请先选择学生'); return }
      const res = await directGenerate({
        targetUserId: sid,
        targetUserIds: selectedStudentIds.value,
        analysisText: analysisDraft.value,
        categoryIds: [...form.categoryIds],
        easyPct: form.easyPct,
        mediumPct: form.mediumPct,
        hardPct: form.hardPct,
        withTrap: form.withTrap,
        focusWeak: form.focusWeak,
        questionCount: form.questionCount,
        singleWeight: form.singleWeight,
        multipleWeight: form.multipleWeight,
        readingWeight: form.readingWeight,
        judgeWeight: form.judgeWeight,
        fillWeight: form.fillWeight,
        paperName,
        sessionName,
        startTime: fmt(now),
        endTime: fmt(later),
        duration: Math.min(180, Math.max(20, form.questionCount * 1)),
      })
      directResult.value = {
        paperId: res.data.paperId,
        sessionId: res.data.sessionId,
      }
      ElMessage.success(`已为 ${names} 创建试卷和考试！试卷ID:${res.data.paperId}`)
    } catch { /* handled */ } finally { directGenerating.value = false }
  })
}

/* ============================================================ *
 *  5. 确认入库
 * ============================================================ */

const confirmVisible = ref(false)
const confirming = ref(false)
const confirmForm = reactive({
  paperName: '',
  sessionName: '',
  timeRange: [] as string[],
  duration: 45,
})

const fmt = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const openConfirm = () => {
  if (!preview.value) { ElMessage.warning('请先生成题目'); return }
  const names = selectedStudents.value.map(s => s.realName || s.username).join('、')
  const name = names || '学生'
  const stamp = new Date().toISOString().slice(0, 10)
  confirmForm.paperName = `AI · ${name} · ${stamp}`
  confirmForm.sessionName = `${name} 专项训练 (${stamp})`
  const now = new Date()
  const later = new Date(now.getTime() + 24 * 3600 * 1000)
  confirmForm.timeRange = [fmt(now), fmt(later)]
  confirmForm.duration = Math.min(180, Math.max(20, form.questionCount * 1))
  confirmVisible.value = true
}

const doConfirm = async () => {
  if (!preview.value?.logId) return
  if (!confirmForm.paperName.trim()) { ElMessage.warning('请输入试卷名称'); return }
  if (!confirmForm.timeRange?.length) { ElMessage.warning('请选择考试时间段'); return }
  if (!confirmForm.duration) { ElMessage.warning('请填写时长'); return }

  confirming.value = true
  try {
    await confirmPaper({
      logId: preview.value.logId,
      paperName: confirmForm.paperName,
      sessionName: confirmForm.sessionName,
      duration: confirmForm.duration,
      startTime: confirmForm.timeRange[0],
      endTime: confirmForm.timeRange[1],
    })
    confirmVisible.value = false
    const studentNames = selectedStudents.value.map(s => s.realName || s.username).join('、')
    ElMessage.success(`已入库并为 ${studentNames} 生成考试`)
    preview.value = null
  } catch { /* handled */ } finally { confirming.value = false }
}

const doDiscard = async () => {
  if (!preview.value?.logId) { preview.value = null; return }
  try {
    await ElMessageBox.confirm('确认丢弃本次生成的题目？', '丢弃预览', { type: 'warning' })
  } catch { return }
  preview.value = null
  ElMessage.info('已丢弃')
}

/* ============================================================ *
 *  5. 展示辅助
 * ============================================================ */

const typeLabel = (t: QuestionType) =>
  ({ SINGLE: '单选', MULTIPLE: '多选', JUDGE: '判断', FILL_HINT: '填空', READING: '阅读理解' } as Record<QuestionType, string>)[t] || t

const diffLabel = (d: Difficulty) =>
  ({ 1: '简单', 2: '中等', 3: '困难' } as Record<number, string>)[d] || String(d)

const diffTagType = (d: Difficulty) => (d === 1 ? 'success' : d === 2 ? 'warning' : 'danger')

const answerText = (q: Question) => q.standardAnswer || '-'

onMounted(async () => {
  await Promise.all([loadStudents(), loadCategories()])
})
</script>

<template>
  <div class="ai-compose-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">
          <el-icon><MagicStick /></el-icon>
          智能出题
        </h2>
        <p class="page-subtitle">基于学生历史学情，由 Dify + DeepSeek 智能组卷</p>
      </div>
    </div>

    <div class="grid">
      <!-- ============ 左：学生 + 学情 ============ -->
      <el-card shadow="never" class="col-left">
        <template #header>
          <div class="card-head">
            <span><el-icon><User /></el-icon> 学生 &amp; 学情分析</span>
          </div>
        </template>

        <el-form-item label="选择学生（支持多选）">
          <div class="student-filter-bar">
            <el-radio-group v-model="activeFilter" size="small">
              <el-radio-button label="all">全部学生</el-radio-button>
              <el-radio-button label="mine" @click="selectMyStudents" :loading="loadingMyStudents">
                我的学生
              </el-radio-button>
            </el-radio-group>
            <div class="student-actions">
              <el-button size="small" @click="toggleSelectAll" :disabled="filteredStudents.length === 0">
                <el-icon><Select /></el-icon>
                {{ isAllSelected ? '取消全选' : '全选' }}
              </el-button>
              <el-button size="small" @click="clearSelection" :disabled="selectedStudentIds.length === 0">
                <el-icon><Delete /></el-icon>
                清空
              </el-button>
            </div>
          </div>
          <el-select
            v-model="selectedStudentIds"
            multiple
            filterable
            placeholder="搜索学生（姓名/用户名），支持多选"
            style="width: 100%"
          >
            <el-option
              v-for="s in filteredStudents"
              :key="s.id"
              :label="`${s.realName || s.username}（${s.username}）`"
              :value="s.id"
            />
          </el-select>
          <div v-if="selectedStudentIds.length > 0" class="selected-students-info">
            <span class="selected-count">已选择 {{ selectedStudentIds.length }} 名学生</span>
            <span v-if="selectedStudentIds.length <= 5" class="selected-names">{{ selectedStudents.map(s => s.realName || s.username).join('、') }}</span>
            <span v-else class="selected-names">已选择 {{ selectedStudentIds.length }} 名学生，点击查看详情</span>
          </div>
          <div v-if="activeFilter === 'mine' && myStudents.length === 0 && !loadingMyStudents" class="no-mine-hint">
            <el-empty description="暂无班级学生" :image-size="40" />
            <p class="tip">请先在班级管理中为您的班级分配学生</p>
          </div>
        </el-form-item>

        <div v-if="selectedStudentIds.length === 0" class="analysis-empty">
          <el-empty description="请先选择学生，加载其学情" :image-size="60" />
        </div>

        <template v-else>
          <!-- 批量分析概览（多选学生时显示） -->
          <div v-if="batchAnalysis" class="batch-overview">
            <el-card shadow="never" class="batch-summary-card">
              <template #header>
                <div class="batch-summary-header">
                  <span><el-icon><Users /></el-icon> 班级整体分析</span>
                </div>
              </template>
              <div class="batch-stats">
                <div class="stat-item">
                  <span class="stat-value">{{ batchAnalysis.studentCount }}</span>
                  <span class="stat-label">名学生</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ batchAnalysis.avgExams?.toFixed(1) }}</span>
                  <span class="stat-label">平均考试次数</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ batchAnalysis.avgScore?.toFixed(1) }}</span>
                  <span class="stat-label">平均分数</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ batchAnalysis.avgAccuracy?.toFixed(1) }}%</span>
                  <span class="stat-label">平均正确率</span>
                </div>
              </div>
              
              <!-- 共同薄弱分类 -->
              <div v-if="batchAnalysis.commonWeakCategories?.length" class="common-weak-section">
                <div class="common-weak-title">
                  <el-icon><Warning /></el-icon> 共同薄弱专题
                </div>
                <div class="common-weak-list">
                  <div v-for="cat in batchAnalysis.commonWeakCategories.slice(0, 5)" :key="cat.categoryId" class="common-weak-item">
                    <span class="weak-name">{{ cat.categoryName }}</span>
                    <span class="weak-meta">
                      {{ cat.affectedStudentCount }}人受影响 · 共{{ cat.totalWrongCount }}错题 · {{ cat.avgAccuracy }}%正确率
                    </span>
                  </div>
                </div>
              </div>
              
              <!-- 教学建议 -->
              <div v-if="batchAnalysis.teachingSuggestions" class="teaching-suggestions">
                <div class="suggestions-title">
                  <el-icon><Lightbulb /></el-icon> 教学建议
                </div>
                <pre class="suggestions-content">{{ batchAnalysis.teachingSuggestions }}</pre>
              </div>
            </el-card>
          </div>

          <!-- AI 学情分析（可编辑） -->
          <div class="analysis-box" v-loading="analysisLoading">
            <div class="analysis-head">
              <span>
                <el-icon><ChatRound /></el-icon>
                {{ batchAnalysis ? '整体学情分析' : 'AI 一句话学情分析' }}（可编辑）
              </span>
              <el-button size="small" text @click="fetchAnalysis" :loading="analysisLoading">
                <el-icon><Refresh /></el-icon>重新分析
              </el-button>
            </div>
            <el-input
              v-model="analysisDraft"
              type="textarea"
              :rows="5"
              placeholder="AI 生成的学情分析将出现在这里，老师可自行调整措辞或补充要求，作为大模型出题时的提示词"
            />
            <p class="tip">
              💡 此文本会作为 prompt 的一部分交给 DeepSeek
            </p>
          </div>

          <!-- 薄弱分类（单选学生时显示） -->
          <div v-if="analysis?.categoryStats?.length && !batchAnalysis" class="weak-list">
            <div class="weak-title">分类错题统计（Top 5 薄弱专题）：</div>
            <el-tag
              v-for="w in analysis.categoryStats.filter(s => s.wrongCount > 0).slice(0, 5)"
              :key="w.categoryId"
              type="danger"
              effect="light"
              class="weak-tag"
            >
              {{ w.categoryName }} <span class="w-count">({{ w.wrongCount }}/{{ w.totalCount }} 错)</span>
            </el-tag>
            <el-button size="small" link type="primary" @click="pickWeakCategories">
              一键加入语法选择
            </el-button>
          </div>
          
          <!-- 一键加入共同薄弱分类（多选学生时显示） -->
          <div v-if="batchAnalysis?.commonWeakCategories?.length" class="weak-list">
            <el-button size="small" link type="primary" @click="pickWeakCategories">
              一键加入共同薄弱专题
            </el-button>
          </div>
        </template>
      </el-card>

      <!-- ============ 右：参数配置 ============ -->
      <el-card shadow="never" class="col-right">
        <template #header>
          <div class="card-head">
            <span><el-icon><Setting /></el-icon> 出题参数</span>
          </div>
        </template>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
          <el-form-item label="语法专题（多选）" prop="categoryIds">
            <div class="cat-panel">
              <div class="cat-tool">
                <el-checkbox
                  :model-value="!!flatCategories.length && form.categoryIds.length === flatCategories.length"
                  :indeterminate="form.categoryIds.length > 0 && form.categoryIds.length < flatCategories.length"
                  @change="(v: unknown) => form.categoryIds = (v as boolean) ? flatCategories.map(c => c.id) : []"
                >
                  全选
                </el-checkbox>
                <el-button size="small" link @click="clearCategories">清空</el-button>
              </div>
              <el-checkbox-group v-model="form.categoryIds" class="cat-group">
                <el-checkbox
                  v-for="c in flatCategories"
                  :key="c.id"
                  :value="c.id"
                  :style="{ paddingLeft: (c.depth * 14) + 'px' }"
                >
                  {{ c.label }}
                </el-checkbox>
              </el-checkbox-group>
            </div>
          </el-form-item>

          <el-form-item label="难度百分比（三档之和须 = 100%）">
            <div class="diff-row">
              <div class="diff-item">
                <label>简单</label>
                <el-input-number v-model="form.easyPct" :min="0" :max="100" :step="10" size="small" />
                <span>%</span>
              </div>
              <div class="diff-item">
                <label>中等</label>
                <el-input-number v-model="form.mediumPct" :min="0" :max="100" :step="10" size="small" />
                <span>%</span>
              </div>
              <div class="diff-item">
                <label>困难</label>
                <el-input-number v-model="form.hardPct" :min="0" :max="100" :step="10" size="small" />
                <span>%</span>
              </div>
              <el-tag :type="difficultyValid ? 'success' : 'danger'" size="small">
                合计 {{ difficultySum }}%
              </el-tag>
            </div>
          </el-form-item>

          <el-form-item label="题型占比（合计须 = 100%）">
            <div class="diff-row">
              <div v-for="op in typeOptions" :key="op.field" class="diff-item">
                <label>{{ op.label }}</label>
                <el-input-number v-model="form[op.field]" :min="0" :max="100" :step="10" size="small" />
                <span>%</span>
              </div>
              <el-tag :type="typeValid ? 'success' : 'danger'" size="small">
                合计 {{ typeSum }}%
              </el-tag>
            </div>
          </el-form-item>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="陷阱干扰">
                <el-switch v-model="form.withTrap" />
                <span class="switch-hint">加入形近词/易混语法干扰</span>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="专项加强">
                <el-switch v-model="form.focusWeak" />
                <span class="switch-hint">向历史错题最多的分类倾斜</span>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="题量" prop="questionCount">
            <el-slider v-model="form.questionCount" :min="20" :max="200" :step="5" show-input />
          </el-form-item>

          <div class="compose-actions">
            <el-button
              type="primary"
              size="large"
              :loading="composing"
              :disabled="selectedStudentIds.length === 0 || !difficultyValid || !typeValid"
              @click="doCompose"
            >
              <el-icon><MagicStick /></el-icon>
              {{ composing ? 'AI 生成中，请稍候 (约 30-90 秒)…' : '开始 AI 出题（预览）' }}
            </el-button>
            <el-button
              type="success"
              size="large"
              :loading="directGenerating"
              :disabled="selectedStudentIds.length === 0 || !difficultyValid || !typeValid"
              @click="doDirectGenerate"
            >
              <el-icon><Promotion /></el-icon>
              {{ directGenerating ? '正在生成试卷并创建考试…' : '🚀 一键出卷+考试' }}
            </el-button>
          </div>

          <div v-if="directResult" class="direct-result">
            <el-alert type="success" :closable="false" show-icon>
              <template #title>
                ✅ 已成功创建试卷和考试场次！
              </template>
              <div class="direct-result-links">
                <span>试卷 ID: <b>{{ directResult.paperId }}</b></span>
                <span>考试 ID: <b>{{ directResult.sessionId }}</b></span>
              </div>
            </el-alert>
          </div>
        </el-form>
      </el-card>
    </div>

    <!-- ============ 生成预览 ============ -->
    <div v-if="preview" id="preview-anchor" class="preview-section">
      <el-card shadow="never">
        <template #header>
          <div class="card-head">
            <div>
              <el-icon><Document /></el-icon>
              <span>生成预览</span>
              <el-tag type="success" size="small" style="margin-left:8px">
                共 {{ preview.questions.length }} 道题
              </el-tag>
              <el-tag v-if="preview.durationMs" type="info" size="small" style="margin-left:4px">
                耗时 {{ (preview.durationMs / 1000).toFixed(1) }}s
              </el-tag>
              <el-tag type="warning" size="small" style="margin-left:4px">
                logId #{{ preview.logId }}
              </el-tag>
            </div>
            <div>
              <el-button @click="doDiscard">丢弃</el-button>
              <el-button type="primary" @click="openConfirm">
                <el-icon><Check /></el-icon>确认入库并出卷
              </el-button>
            </div>
          </div>
        </template>

        <!-- 阅读理解文章 -->
        <div v-if="preview.passages?.length" class="passages">
          <div v-for="p in preview.passages" :key="p.tempId" class="passage">
            <div class="passage-head">
              <span>📖 {{ p.title || '阅读文章' }}</span>
              <span v-if="p.wordCount" class="word-count">{{ p.wordCount }} 字</span>
            </div>
            <div class="passage-content">{{ p.content }}</div>
          </div>
        </div>

        <div class="q-list">
          <div v-for="(q, idx) in preview.questions" :key="idx" class="q-item">
            <div class="q-head">
              <span class="q-idx">Q{{ idx + 1 }}</span>
              <el-tag size="small">{{ typeLabel(q.questionType) }}</el-tag>
              <el-tag size="small" :type="diffTagType(q.difficulty)">{{ diffLabel(q.difficulty) }}</el-tag>
              <el-tag v-if="q.categoryName" size="small" type="info">{{ q.categoryName }}</el-tag>
              <el-tag v-if="q.hasTrap" size="small" type="danger" effect="plain">⚠ 陷阱</el-tag>
            </div>
            <div class="q-stem">{{ q.stem }}</div>
            <div v-if="q.options?.length" class="q-opts">
              <div v-for="op in q.options" :key="op.optionLabel" class="q-opt">
                <span class="opt-key">{{ op.optionLabel }}.</span> {{ op.optionContent }}
              </div>
            </div>
            <div class="q-meta">
              <span class="ans">正确答案：<b>{{ answerText(q) }}</b></span>
              <span v-if="q.analysis" class="ana">解析：{{ q.analysis }}</span>
              <span v-if="q.trapNote" class="ana" style="color:#f56c6c">陷阱说明：{{ q.trapNote }}</span>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- ============ 确认入库弹窗 ============ -->
    <el-dialog v-model="confirmVisible" title="确认入库" width="560px">
      <el-form :model="confirmForm" label-width="110px">
        <el-form-item label="试卷名称">
          <el-input v-model="confirmForm.paperName" />
        </el-form-item>
        <el-form-item label="考试名称">
          <el-input v-model="confirmForm.sessionName" />
        </el-form-item>
        <el-form-item label="时间段">
          <el-date-picker
            v-model="confirmForm.timeRange"
            type="datetimerange"
            value-format="YYYY-MM-DDTHH:mm:ss"
            range-separator="→"
            start-placeholder="开始"
            end-placeholder="结束"
            style="width:100%"
          />
        </el-form-item>
        <el-form-item label="时长(分钟)">
          <el-input-number v-model="confirmForm.duration" :min="10" :max="240" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="confirmVisible = false">取消</el-button>
        <el-button type="primary" :loading="confirming" @click="doConfirm">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.ai-compose-page { display: flex; flex-direction: column; gap: 16px; }

.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-title {
  margin: 0; font-size: 20px; font-weight: 600;
  display: flex; align-items: center; gap: 6px;
}
.page-subtitle { margin: 4px 0 0; color: #909399; font-size: 13px; }

.grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 16px;
}
@media (max-width: 1100px) {
  .grid { grid-template-columns: 1fr; }
}

.card-head {
  display: flex; justify-content: space-between; align-items: center;
  font-weight: 600;
  span > .el-icon { margin-right: 4px; vertical-align: -2px; }
}

.analysis-empty { padding: 20px 0; }
.analysis-box {
  background: linear-gradient(135deg, #f0f9ff 0%, #f5f7ff 100%);
  padding: 14px 16px;
  border-radius: 6px;
  border-left: 3px solid #409eff;
  margin-top: 12px;
}
.analysis-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px;
  font-size: 13px; font-weight: 600; color: #303133;
  span > .el-icon { margin-right: 4px; vertical-align: -2px; }
}
.tip { margin: 6px 0 0; font-size: 12px; color: #909399; }

.weak-list {
  margin-top: 12px; padding: 12px;
  background: #fff7ed; border-radius: 4px;
  border: 1px dashed #f56c6c33;
}
.weak-title { font-size: 12px; color: #909399; margin-bottom: 6px; }
.weak-tag { margin: 4px 6px 4px 0; }
.w-count { color: #f56c6c; font-size: 11px; margin-left: 2px; }

.cat-panel {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  width: 100%;
  overflow: hidden;
}
.cat-tool {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 12px; background: #fafafa;
  border-bottom: 1px solid #dcdfe6;
}
.cat-group {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px 8px;
  padding: 10px 12px;
  max-height: 220px;
  overflow-y: auto;
}
.cat-group .el-checkbox {
  margin-right: 0 !important;
  width: 100%;
}

.diff-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.diff-item {
  display: flex; align-items: center; gap: 6px;
  label { font-size: 13px; color: #606266; }
}

.switch-hint { margin-left: 10px; font-size: 12px; color: #909399; }
.compose-actions { margin-top: 8px; text-align: center; }

.passages { margin-bottom: 12px; }
.passage {
  background: #f5f7fa; padding: 12px 16px; border-left: 3px solid #409eff;
  border-radius: 4px; margin-bottom: 8px;
}
.passage-head {
  display: flex; justify-content: space-between; font-weight: 600;
  margin-bottom: 6px; color: #303133;
}
.word-count { color: #909399; font-size: 12px; font-weight: normal; }
.passage-content { color: #606266; line-height: 1.8; white-space: pre-wrap; font-size: 13px; }

.q-list { display: flex; flex-direction: column; gap: 12px; }
.q-item {
  padding: 14px 16px; background: #fafafa; border-radius: 6px;
  border-left: 3px solid #67c23a;
}
.q-head {
  display: flex; gap: 6px; align-items: center;
  margin-bottom: 8px; font-weight: 600;
  .q-idx { color: #67c23a; margin-right: 4px; }
}
.q-stem { line-height: 1.7; color: #303133; margin-bottom: 8px; white-space: pre-wrap; }
.q-opts { display: flex; flex-direction: column; gap: 4px; margin: 8px 0; }
.q-opt {
  padding: 4px 8px; background: #fff; border-radius: 3px;
  font-size: 13px; color: #606266;
}
.opt-key { font-weight: 600; color: #409eff; margin-right: 4px; }
.q-meta {
  font-size: 13px; margin-top: 6px; padding-top: 8px;
  border-top: 1px dashed #dcdfe6;
  display: flex; flex-direction: column; gap: 4px;
}
.q-meta .ans b { color: #67c23a; }
.q-meta .ana { color: #909399; }

.selected-students-info {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  
  .selected-count {
    font-size: 13px;
    font-weight: 500;
    color: #409eff;
  }
  
  .selected-names {
    font-size: 12px;
    color: #909399;
  }
}

.student-filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}

.student-actions {
  display: flex;
  gap: 6px;
}

.no-mine-hint {
  margin-top: 12px;
  text-align: center;
}

.direct-result {
  margin-top: 12px;
}

.direct-result-links {
  display: flex;
  gap: 16px;
  margin-top: 4px;
  font-size: 13px;
}

.compose-actions {
  margin-top: 8px;
  text-align: center;
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.batch-overview {
  margin-bottom: 12px;
}

.batch-summary-card {
  border: 1px solid #e6f7ff;
  background: #f0f9ff;
}

.batch-summary-header {
  font-weight: 600;
  color: #1890ff;
}

.batch-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-top: 16px;
}

@media (max-width: 600px) {
  .batch-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}

.stat-item {
  text-align: center;
  padding: 12px 8px;
  background: #fff;
  border-radius: 6px;
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #1890ff;
}

.stat-label {
  font-size: 12px;
  color: #909399;
}

.common-weak-section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #d9ecff;
}

.common-weak-title {
  font-size: 13px;
  font-weight: 600;
  color: #d93026;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.common-weak-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.common-weak-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: #fff7ed;
  border-radius: 4px;
}

.weak-name {
  font-size: 13px;
  color: #d93026;
  font-weight: 500;
}

.weak-meta {
  font-size: 12px;
  color: #909399;
}

.teaching-suggestions {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #d9ecff;
}

.suggestions-title {
  font-size: 13px;
  font-weight: 600;
  color: #722ed1;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.suggestions-content {
  font-size: 13px;
  color: #606266;
  line-height: 1.8;
  white-space: pre-wrap;
  background: #faf5ff;
  padding: 10px 12px;
  border-radius: 4px;
  margin: 0;
}
</style>
