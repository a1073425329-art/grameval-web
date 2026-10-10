<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getWrongBook, getCategoryTree, getRedoQuestions, submitPractice } from '@/api/student'
import type { WrongBookItem } from '@/types/result'
import type { Question } from '@/types/question'
import type { Category } from '@/types/category'
import type { QuestionType, Difficulty } from '@/types/common'
import { getJudgeOptionLabel } from '@/utils/dict'
import PassageCard from '@/components/PassageCard.vue'
import { Cpu } from '@element-plus/icons-vue'

const query = reactive({
  source: 'ALL' as 'ALL' | 'EXAM' | 'PRACTICE',
  categoryId: undefined as number | undefined,
  questionType: undefined as QuestionType | undefined,
  difficulty: undefined as Difficulty | undefined,
  pageNum: 1,
  pageSize: 50,
})

const list = ref<WrongBookItem[]>([])
const total = ref(0)
const loading = ref(false)
const categories = ref<Category[]>([])

const typeOptions = [
  { label: '单选题', value: 'SINGLE' as QuestionType },
  { label: '多选题', value: 'MULTIPLE' as QuestionType },
  { label: '判断题', value: 'JUDGE' as QuestionType },
  { label: '填空题', value: 'FILL' as QuestionType },
  { label: '阅读理解', value: 'READING' as QuestionType },
]

const diffOptions = [
  { label: '简单', value: 1 as Difficulty },
  { label: '中等', value: 2 as Difficulty },
  { label: '困难', value: 3 as Difficulty },
]

const typeLabel = (t?: QuestionType) => typeOptions.find(o => o.value === t)?.label ?? t
const diffLabel = (d?: number) => diffOptions.find(o => o.value === d)?.label ?? '-'
const diffTagType = (d?: number) => (d === 1 ? 'success' : d === 2 ? 'warning' : d === 3 ? 'danger' : 'info')

const load = async () => {
  loading.value = true
  try {
    const res = await getWrongBook({
      source: query.source,
      categoryId: query.categoryId,
      questionType: query.questionType,
      difficulty: query.difficulty,
      pageNum: query.pageNum,
      pageSize: query.pageSize,
    })
    list.value = res.data?.records ?? []
    total.value = res.data?.total ?? 0
  } finally { loading.value = false }
}

const onFilterChange = () => { query.pageNum = 1; load() }

const sourceTag = (s: string) => (s === 'EXAM' ? 'danger' : 'warning')
const sourceLabel = (s: string) => (s === 'EXAM' ? '考试错题' : '练习错题')

const answerText = (a?: string | null, type?: QuestionType) => {
  if (!a) return '（未作答）'
  if (type === 'JUDGE') return getJudgeOptionLabel(a)
  return a
}
const answerCorrect = (user: string | undefined | null, standard: string) => {
  if (!user) return false
  return user.trim().toUpperCase() === standard.trim().toUpperCase()
}

// 展开解析
const expandedAnalysis = ref<Set<number>>(new Set())
const toggleAnalysis = (idx: number) => {
  if (expandedAnalysis.value.has(idx)) expandedAnalysis.value.delete(idx)
  else expandedAnalysis.value.add(idx)
}

// ====== 错题重做 ======
const redoModal = ref(false)
const redoQuestions = ref<Question[]>([])
const redoCurrentIndex = ref(0)
const redoAnswers = ref<Record<number, string>>({})
const redoSubmitting = ref(false)
const redoResult = ref<{ total: number; correct: number } | null>(null)

const currentRedoQuestion = computed(() => redoQuestions.value[redoCurrentIndex.value])
const redoProgress = computed(() => ({
  current: redoCurrentIndex.value + 1,
  total: redoQuestions.value.length,
  percent: redoQuestions.value.length > 0 ? ((redoCurrentIndex.value + 1) / redoQuestions.value.length) * 100 : 0,
}))

const startRedo = async () => {
  redoSubmitting.value = true
  try {
    const res = await getRedoQuestions({ categoryId: query.categoryId, count: 10 })
    redoQuestions.value = res.data ?? []
    if (!redoQuestions.value.length) {
      ElMessage.info('当前没有可重做的错题')
      return
    }
    redoCurrentIndex.value = 0
    redoAnswers.value = {}
    redoResult.value = null
    redoModal.value = true
  } finally {
    redoSubmitting.value = false
  }
}

const selectRedoOption = (optionLabel: string) => {
  const q = currentRedoQuestion.value
  if (!q) return
  if (q.questionType === 'MULTIPLE') {
    const current = redoAnswers.value[q.id] || ''
    if (current.includes(optionLabel)) {
      redoAnswers.value[q.id] = current.replace(optionLabel, '')
    } else {
      redoAnswers.value[q.id] = [...current.split(''), optionLabel].sort().join('')
    }
  } else {
    redoAnswers.value[q.id] = optionLabel
  }
}

const isOptionSelected = (optionLabel: string) => {
  const qid = currentRedoQuestion.value?.id
  if (qid === undefined) return false
  const answer = redoAnswers.value[qid] || ''
  return answer.includes(optionLabel)
}

/** 无选项题（填空 / 判断 / 无选项阅读题）的文本作答读写 */
const redoAnswerOf = (id?: number) => (id === undefined ? '' : (redoAnswers.value[id] ?? ''))
const setRedoAnswer = (v: string) => {
  const q = currentRedoQuestion.value
  if (q) redoAnswers.value[q.id] = v
}

const submitRedo = async () => {
  const q = currentRedoQuestion.value
  if (!q || !redoAnswers.value[q.id]) {
    ElMessage.warning('请选择答案')
    return
  }
  redoSubmitting.value = true
  try {
    await submitPractice({
      questionId: q.id,
      userAnswer: redoAnswers.value[q.id] ?? '',
    })
    if (redoCurrentIndex.value < redoQuestions.value.length - 1) {
      redoCurrentIndex.value++
    } else {
      // 完成所有重做题目，计算结果
      let correct = 0
      redoQuestions.value.forEach(rq => {
        const user = (redoAnswers.value[rq.id] || '').trim().toUpperCase()
        const standard = (rq.standardAnswer || '').trim().toUpperCase()
        if (user === standard) correct++
      })
      redoResult.value = { total: redoQuestions.value.length, correct }
    }
  } finally {
    redoSubmitting.value = false
  }
}

const closeRedoModal = () => {
  redoModal.value = false
  redoQuestions.value = []
  redoAnswers.value = {}
  redoResult.value = null
  load()
}

/** 从分类树拍平，供级联选择器直接识别（不用 children 嵌套也可用） */
const flatCategories = computed(() => {
  const result: Category[] = []
  const walk = (cats: Category[]) => {
    cats.forEach(c => {
      result.push(c)
      if (c.children?.length) walk(c.children)
    })
  }
  walk(categories.value)
  return result
})

onMounted(async () => {
  try { const c = await getCategoryTree(); categories.value = Array.isArray(c.data) ? c.data : [] } catch { }
  load()
})
</script>

<template>
  <div class="wrong-book-page">
    <el-alert type="info" :closable="false" style="margin-bottom:12px">
      <template #title>
        <span style="font-weight:600">📚 艾宾浩斯遗忘曲线复习策略</span>
        <el-tooltip content="每次答错后，系统自动计算下次复习时间：第1次=1天后、第2次=2天后、第3次=4天后、第4次=7天后、第5次=15天后。连续3次复习正确→标记'已掌握'。再次答错→重置为1天。" placement="bottom" effect="light">
          <el-icon style="margin-left:4px;cursor:help;color:#909399"><QuestionFilled /></el-icon>
        </el-tooltip>
      </template>
      错题本不是简单的错题列表——每道错题都有复习状态和下次复习时间。点击"重做错题"可以针对薄弱题目进行专项练习。
    </el-alert>
    <!-- ========== 顶部筛选 ========== -->
    <div class="filter-bar">
      <div class="filter-row">
        <el-radio-group v-model="query.source" @change="onFilterChange" size="default">
          <el-radio-button value="ALL">全部错题</el-radio-button>
          <el-radio-button value="EXAM">考试错题</el-radio-button>
          <el-radio-button value="PRACTICE">练习错题</el-radio-button>
        </el-radio-group>

        <el-divider direction="vertical" style="height:28px" />

        <el-select
          v-model="query.categoryId"
          clearable
          filterable
          placeholder="所有语法分类"
          style="width:200px"
          @change="onFilterChange"
        >
          <el-option
            v-for="c in flatCategories"
            :key="c.id"
            :label="c.categoryName"
            :value="c.id"
          >
            <span>{{ c.categoryName }}</span>
            <span v-if="c.questionCount" style="color:#909399;font-size:12px;float:right">
              {{ c.questionCount }}
            </span>
          </el-option>
        </el-select>

        <el-select
          v-model="query.questionType"
          clearable
          placeholder="所有题型"
          style="width:130px"
          @change="onFilterChange"
        >
          <el-option v-for="op in typeOptions" :key="op.value" :label="op.label" :value="op.value" />
        </el-select>

        <el-select
          v-model="query.difficulty"
          clearable
          placeholder="所有难度"
          style="width:110px"
          @change="onFilterChange"
        >
          <el-option v-for="op in diffOptions" :key="op.value" :label="op.label" :value="op.value" />
        </el-select>
      </div>

      <div class="filter-summary">
        共 <b>{{ total }}</b> 道错题<span v-if="list.length"> · 当前第 {{ (query.pageNum - 1) * query.pageSize + 1 }} - {{ Math.min(query.pageNum * query.pageSize, total) }} 题</span>
        <div class="filter-actions">
          <el-button type="primary" @click="startRedo" :loading="redoSubmitting">
            <el-icon><Refresh /></el-icon> 开始重做
          </el-button>
          <el-button type="primary" @click="$router.push('/student/ai-assistant')">
            <el-icon><Cpu /></el-icon>AI错题分析
          </el-button>
        </div>
      </div>
    </div>

    <!-- ========== 题目列表 ========== -->
    <div v-loading="loading" class="wrong-list">
      <el-empty v-if="!loading && !list.length" description="🎉 恭喜！暂无错题" :image-size="120" />

      <div
        v-for="(w, idx) in list"
        :key="`${w.questionId}-${w.source}`"
        class="wrong-card"
      >
        <!-- 题头 -->
        <div class="wc-head">
          <div class="wc-tags">
            <span class="wc-idx">#{{ (query.pageNum - 1) * query.pageSize + idx + 1 }}</span>
            <el-tag :type="sourceTag(w.source)" size="small" effect="dark">{{ sourceLabel(w.source) }}</el-tag>
            <el-tag size="small">{{ typeLabel(w.questionType) }}</el-tag>
            <el-tag :type="diffTagType(w.difficulty)" size="small">{{ diffLabel(w.difficulty) }}</el-tag>
            <el-tag type="info" size="small">{{ w.categoryName }}</el-tag>
          </div>
          <span class="wc-time">首次错误：{{ w.firstWrongTime?.slice(0, 16) }}</span>
        </div>

        <!-- 阅读理解：复盘必须带上当时的文章，否则题干里的 "According to the passage" 无从对照 -->
        <PassageCard
          v-if="w.passageContent"
          :content="w.passageContent"
          :title="w.passageTitle"
          :word-count="w.passageWordCount"
        />

        <!-- 题干 -->
        <div class="wc-stem">{{ w.stem }}</div>

        <!-- 选项 -->
        <div v-if="w.options?.length" class="wc-options">
          <div
            v-for="op in w.options"
            :key="op.optionLabel"
            class="wc-opt"
            :class="{
              'opt-correct': op.optionLabel === w.standardAnswer,
              'opt-wrong': op.optionLabel === w.userAnswer && w.userAnswer !== w.standardAnswer,
            }"
          >
            <span class="opt-key">{{ op.optionLabel }}.</span>
            <span>{{ op.optionContent }}</span>
            <el-tag v-if="op.optionLabel === w.standardAnswer" size="small" type="success" effect="plain" class="opt-tag">✓</el-tag>
            <el-tag v-if="op.optionLabel === w.userAnswer && w.userAnswer !== w.standardAnswer" size="small" type="danger" effect="plain" class="opt-tag">✗ 你的答案</el-tag>
          </div>
        </div>

        <!-- 非选项题的答案区（填空 / 判断 / 无选项阅读题，如摘要填空、句子补全） -->
        <div v-if="!w.options?.length" class="wc-answer-row">
          <div class="answer-block wrong-block">
            <div class="answer-label">你的答案</div>
            <div class="answer-val" :class="{ correct: answerCorrect(w.userAnswer, w.standardAnswer) }">
              {{ answerText(w.userAnswer, w.questionType) }}
            </div>
          </div>
          <div class="answer-block correct-block">
            <div class="answer-label">正确答案</div>
            <div class="answer-val correct">{{ answerText(w.standardAnswer, w.questionType) }}</div>
          </div>
        </div>

        <!-- 解析（可展开） -->
        <div v-if="w.analysis" class="wc-analysis-toggle" @click="toggleAnalysis(idx)">
          <el-icon><component :is="expandedAnalysis.has(idx) ? 'ArrowUp' : 'ArrowDown'" /></el-icon>
          <span>题目解析</span>
        </div>
        <div v-if="w.analysis && expandedAnalysis.has(idx)" class="wc-analysis">
          {{ w.analysis }}
        </div>

        <!-- 来源信息 -->
        <div v-if="w.sourceName" class="wc-source">
          <el-icon><Link /></el-icon> 来源：{{ w.sourceName }}
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="total > query.pageSize">
      <el-pagination
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[20, 50, 100]"
        @size-change="load"
        @current-change="load"
        background
      />
    </div>

    <!-- ====== 错题重做模态框 ====== -->
    <el-dialog v-model="redoModal" title="错题重做" width="700px" class="redo-modal" :close-on-click-modal="false">
      <!-- 进度条 -->
      <div v-if="redoQuestions.length" class="redo-progress">
        <div class="rp-info">第 {{ redoProgress.current }} / {{ redoProgress.total }} 题</div>
        <el-progress :percentage="redoProgress.percent" :stroke-width="8" />
      </div>

      <!-- 答题界面 -->
      <div v-if="redoQuestions.length && !redoResult" class="redo-content">
        <div v-if="currentRedoQuestion" key="question">
          <div class="rq-head">
            <el-tag size="small">{{ typeLabel(currentRedoQuestion.questionType) }}</el-tag>
            <el-tag :type="diffTagType(currentRedoQuestion.difficulty)" size="small">{{ diffLabel(currentRedoQuestion.difficulty) }}</el-tag>
            <el-tag type="info" size="small">{{ currentRedoQuestion.categoryName }}</el-tag>
          </div>
          <div class="rq-stem">{{ currentRedoQuestion.stem }}</div>
          <div v-if="currentRedoQuestion.options?.length" class="rq-options">
            <div
              v-for="op in currentRedoQuestion.options"
              :key="op.optionLabel"
              class="rq-opt"
              :class="{ selected: isOptionSelected(op.optionLabel) }"
              @click="selectRedoOption(op.optionLabel)"
            >
              <span class="rq-opt-key">{{ op.optionLabel }}.</span>
              <span>{{ op.optionContent }}</span>
              <el-icon v-if="isOptionSelected(op.optionLabel)"><Check /></el-icon>
            </div>
          </div>

          <!-- 判断题：对 / 错 -->
          <div v-else-if="currentRedoQuestion.questionType === 'JUDGE'" class="rq-options">
            <div
              class="rq-opt"
              :class="{ selected: redoAnswerOf(currentRedoQuestion.id) === 'TRUE' }"
              @click="setRedoAnswer('TRUE')"
            >
              <span class="rq-opt-key">✓</span><span>对</span>
              <el-icon v-if="redoAnswerOf(currentRedoQuestion.id) === 'TRUE'"><Check /></el-icon>
            </div>
            <div
              class="rq-opt"
              :class="{ selected: redoAnswerOf(currentRedoQuestion.id) === 'FALSE' }"
              @click="setRedoAnswer('FALSE')"
            >
              <span class="rq-opt-key">✗</span><span>错</span>
              <el-icon v-if="redoAnswerOf(currentRedoQuestion.id) === 'FALSE'"><Check /></el-icon>
            </div>
          </div>

          <!-- 填空 / 无选项阅读题（摘要填空、句子补全等）：文本作答 -->
          <div v-else class="rq-blank">
            <el-input
              :model-value="redoAnswerOf(currentRedoQuestion.id)"
              :placeholder="currentRedoQuestion.hintText ? `提示：${currentRedoQuestion.hintText}` : '输入答案（单词/短语）'"
              @update:model-value="setRedoAnswer"
            />
          </div>
        </div>
      </div>

      <!-- 结果界面 -->
      <div v-if="redoResult" class="redo-result">
        <div class="result-icon" :class="redoResult.correct === redoResult.total ? 'success' : redoResult.correct >= redoResult.total / 2 ? 'warning' : 'danger'">
          <el-icon :size="48">{{ redoResult.correct === redoResult.total ? 'CircleCheck' : redoResult.correct >= redoResult.total / 2 ? 'Warning' : 'Close' }}</el-icon>
        </div>
        <div class="result-title">{{ redoResult.correct === redoResult.total ? '太棒了！全部正确！' : `重做完成，正确 ${redoResult.correct}/${redoResult.total} 题` }}</div>
        <div class="result-desc">正确率 {{ Math.round((redoResult.correct / redoResult.total) * 100) }}%</div>
      </div>

      <!-- 按钮 -->
      <template #footer>
        <el-button @click="closeRedoModal">关闭</el-button>
        <el-button v-if="redoQuestions.length && !redoResult" type="primary" @click="submitRedo" :loading="redoSubmitting">
          {{ redoCurrentIndex < redoQuestions.length - 1 ? '下一题' : '提交答案' }}
        </el-button>
        <el-button v-if="redoResult" type="primary" @click="startRedo">再做一次</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.wrong-book-page { display: flex; flex-direction: column; gap: 14px; }

// Filter
.filter-bar {
  background: #fff; border-radius: 8px; padding: 16px 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.filter-row {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
.filter-summary {
  margin-top: 12px; font-size: 13px; color: #606266;
  display: flex; align-items: center; justify-content: space-between;
  b { color: #f56c6c; font-size: 18px; margin: 0 2px; }
}
.filter-actions { display: flex; align-items: center; gap: 10px; }

// Card
.wrong-list { display: flex; flex-direction: column; gap: 12px; }
.wrong-card {
  background: #fff;
  border-left: 4px solid #f56c6c;
  border-radius: 8px;
  padding: 16px 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  transition: box-shadow 0.15s;
  &:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
}

.wc-head {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 8px; margin-bottom: 12px;
}
.wc-tags { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.wc-idx { font-weight: 700; color: #f56c6c; font-size: 15px; margin-right: 2px; }
.wc-time { color: #909399; font-size: 12px; }

.wc-stem {
  font-size: 15px; line-height: 1.8; color: #303133; margin-bottom: 14px;
  white-space: pre-wrap; word-break: break-word;
}

// Options
.wc-options { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.wc-opt {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 6px; background: #f5f7fa;
  font-size: 14px; color: #606266; position: relative;
  &.opt-correct { background: #f0f9ff; border: 1px solid #b3e19d; }
  &.opt-wrong { background: #fef0f0; border: 1px solid #fab6b6; }
  .opt-key { font-weight: 700; color: #409eff; min-width: 20px; }
  .opt-tag { margin-left: auto; }
}

// Answer row for fill/judge
.wc-answer-row { display: flex; gap: 20px; margin-bottom: 14px; }
.answer-block {
  padding: 10px 16px; border-radius: 6px; min-width: 140px;
  .answer-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
  .answer-val { font-size: 16px; font-weight: 600; color: #f56c6c;
    &.correct { color: #67c23a; }
  }
}
.wrong-block { background: #fef0f0; }
.correct-block { background: #f0f9ff; }

// Analysis
.wc-analysis-toggle {
  display: inline-flex; align-items: center; gap: 4px;
  color: #409eff; font-size: 13px; cursor: pointer; padding: 4px 0;
  &:hover { text-decoration: underline; }
}
.wc-analysis {
  margin-top: 8px; padding: 12px 16px; background: #fafafa;
  border-radius: 6px; font-size: 13px; color: #606266; line-height: 1.7;
  border-left: 3px solid #409eff;
}

.wc-source {
  margin-top: 8px; font-size: 12px; color: #909399;
  display: flex; align-items: center; gap: 4px;
}

.pagination { display: flex; justify-content: center; padding: 8px 0; }

// Redo Modal
.redo-progress { margin-bottom: 20px; }
.rp-info { font-size: 14px; color: #606266; margin-bottom: 8px; }

.redo-content { padding: 10px 0; }
.rq-head { display: flex; gap: 8px; margin-bottom: 16px; }
.rq-stem { font-size: 16px; line-height: 1.8; color: #303133; margin-bottom: 20px; white-space: pre-wrap; }
.rq-options { display: flex; flex-direction: column; gap: 10px; }
.rq-blank { margin-top: 12px; }
.rq-opt {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; border-radius: 8px;
  border: 2px solid #e4e7ed;
  background: #fff; cursor: pointer;
  transition: all 0.2s;
  &:hover { border-color: #c0c4cc; background: #fafafa; }
  &.selected { border-color: #409eff; background: #ecf5ff; }
  .rq-opt-key { font-weight: 700; color: #409eff; min-width: 24px; }
}

.redo-result {
  display: flex; flex-direction: column; align-items: center; padding: 30px 0;
  .result-icon {
    margin-bottom: 16px;
    &.success { color: #67c23a; }
    &.warning { color: #e6a23c; }
    &.danger { color: #f56c6c; }
  }
  .result-title { font-size: 20px; font-weight: 600; color: #303133; margin-bottom: 8px; }
  .result-desc { font-size: 14px; color: #606266; }
}
</style>
