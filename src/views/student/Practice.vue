<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getCategoryTree, getPracticeQuestions, submitPractice } from '@/api/student'
import type { Category } from '@/types/category'
import type { Question, QuickPracticeResult } from '@/types/question'
import type { QuestionType } from '@/types/common'
import { ElMessage } from 'element-plus'

const categories = ref<Category[]>([])
const activeCategoryId = ref<number | null>(null)

const questions = ref<Question[]>([])
const currentIndex = ref(0)
const loading = ref(false)

/** 学生输入的答案（值都是 string —— 多选前端 join 成 "A,B"） */
const userAnswers = ref<Record<number, string | string[]>>({})
/** 每道题的反馈；未提交则为空 */
const feedbacks = ref<Record<number, QuickPracticeResult>>({})

const current = computed<Question | undefined>(() => questions.value[currentIndex.value])
const currentFeedback = computed(() => current.value ? feedbacks.value[current.value.id] : undefined)

const loadCategories = async () => {
  try {
    const res = await getCategoryTree()
    categories.value = res.data ?? []
  } catch { /* silent */ }
}

/** 打平树，方便左侧列表点击 */
const flatCategories = computed<Category[]>(() => {
  const out: Category[] = []
  const walk = (arr: Category[]) => {
    arr.forEach((c) => {
      out.push(c)
      if (c.children?.length) walk(c.children)
    })
  }
  walk(categories.value)
  return out
})

const startPractice = async (catId: number) => {
  activeCategoryId.value = catId
  loading.value = true
  try {
    const res = await getPracticeQuestions(catId, 10)
    questions.value = res.data ?? []
    currentIndex.value = 0
    userAnswers.value = {}
    feedbacks.value = {}
    if (!questions.value.length) {
      ElMessage.info('该专题下暂无可练习的题目')
    }
  } finally {
    loading.value = false
  }
}

const submitting = ref(false)

/** 把当前输入格式化为后端接受的 string（多选 join，其他直接转字符串） */
const formatAnswer = (t: QuestionType, v: unknown): string => {
  if (Array.isArray(v)) return v.filter(Boolean).join(',')
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

const submit = async () => {
  if (!current.value) return
  const ans = formatAnswer(current.value.questionType, userAnswers.value[current.value.id])
  if (!ans) { ElMessage.warning('请先作答'); return }
  submitting.value = true
  try {
    const res = await submitPractice({ questionId: current.value.id, userAnswer: ans })
    feedbacks.value = { ...feedbacks.value, [current.value.id]: res.data }
  } finally {
    submitting.value = false
  }
}

const next = () => { if (currentIndex.value < questions.value.length - 1) currentIndex.value++ }
const prev = () => { if (currentIndex.value > 0) currentIndex.value-- }

const answerText = (a: string | string[] | undefined) => {
  if (a === undefined) return '-'
  return Array.isArray(a) ? a.join(', ') : String(a)
}

onMounted(loadCategories)
</script>

<template>
  <div class="practice-page">
    <!-- 左侧：专题列表 -->
    <div class="left-panel">
      <div class="panel-title">选择语法专题</div>
      <el-scrollbar height="calc(100vh - 180px)">
        <div
          v-for="c in flatCategories"
          :key="c.id"
          class="cat-item"
          :class="{ active: activeCategoryId === c.id, sub: c.parentId }"
          @click="startPractice(c.id)"
        >
          <el-icon><Files /></el-icon>
          <span>{{ c.categoryName }}</span>
          <span v-if="c.questionCount" class="q-count">{{ c.questionCount }}</span>
        </div>
        <el-empty v-if="!flatCategories.length" description="暂无分类" :image-size="60" />
      </el-scrollbar>
    </div>

    <!-- 右侧：练习区 -->
    <div class="right-panel" v-loading="loading">
      <el-empty v-if="!questions.length" description="从左侧选一个专题开始练习" />

      <template v-else-if="current">
        <div class="q-header">
          <span class="q-index">第 {{ currentIndex + 1 }} / {{ questions.length }} 题</span>
          <el-progress
            :percentage="((currentIndex + 1) / questions.length) * 100"
            :show-text="false"
            style="flex:1; margin: 0 16px"
          />
          <span class="answered-count">
            已作答 {{ Object.keys(feedbacks).length }} / {{ questions.length }}
          </span>
        </div>

        <div class="q-content">
          <div class="q-stem">{{ currentIndex + 1 }}. {{ current.stem }}</div>

          <!-- 单选 / 阅读理解 -->
          <el-radio-group
            v-if="current.questionType === 'SINGLE' || current.questionType === 'READING'"
            v-model="userAnswers[current.id]"
            :disabled="!!currentFeedback"
            class="opt-list"
          >
            <el-radio v-for="op in current.options" :key="op.optionLabel" :value="op.optionLabel" class="opt-row">
              <span class="opt-key">{{ op.optionLabel }}.</span> {{ op.optionContent }}
            </el-radio>
          </el-radio-group>

          <!-- 多选 -->
          <el-checkbox-group
            v-else-if="current.questionType === 'MULTIPLE'"
            v-model="userAnswers[current.id] as string[]"
            :disabled="!!currentFeedback"
            class="opt-list"
          >
            <el-checkbox v-for="op in current.options" :key="op.optionLabel" :value="op.optionLabel" class="opt-row">
              <span class="opt-key">{{ op.optionLabel }}.</span> {{ op.optionContent }}
            </el-checkbox>
          </el-checkbox-group>

          <!-- 判断 -->
          <el-radio-group
            v-else-if="current.questionType === 'JUDGE'"
            v-model="userAnswers[current.id]"
            :disabled="!!currentFeedback"
            class="opt-list"
          >
            <el-radio value="TRUE" class="opt-row">正确</el-radio>
            <el-radio value="FALSE" class="opt-row">错误</el-radio>
          </el-radio-group>

          <!-- 填空 -->
          <el-input
            v-else-if="current.questionType === 'FILL_HINT'"
            v-model="userAnswers[current.id] as string"
            :disabled="!!currentFeedback"
            placeholder="请输入答案（单词）"
            style="max-width: 400px; margin-top: 12px"
          />

          <!-- 反馈区 -->
          <div v-if="currentFeedback" class="feedback" :class="{ ok: currentFeedback.isCorrect, ng: !currentFeedback.isCorrect }">
            <div class="fb-head">
              <el-icon><CircleCheck v-if="currentFeedback.isCorrect" /><CircleClose v-else /></el-icon>
              <span>{{ currentFeedback.isCorrect ? '回答正确' : '回答错误' }}</span>
            </div>
            <div class="fb-row">
              <span class="fb-label">你的答案：</span>
              <span>{{ answerText(userAnswers[current.id]) }}</span>
            </div>
            <div class="fb-row">
              <span class="fb-label">正确答案：</span>
              <span class="ok-text">{{ currentFeedback.standardAnswer }}</span>
            </div>
            <div class="fb-row" v-if="currentFeedback.analysis">
              <span class="fb-label">解析：</span>
              <span class="analysis">{{ currentFeedback.analysis }}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <el-button :disabled="currentIndex === 0" @click="prev"><el-icon><ArrowLeft /></el-icon>上一题</el-button>
          <el-button v-if="!currentFeedback" type="primary" :loading="submitting" @click="submit">确认回答</el-button>
          <el-button
            type="primary"
            :disabled="currentIndex === questions.length - 1"
            @click="next"
          >下一题<el-icon><ArrowRight /></el-icon></el-button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.practice-page {
  display: flex;
  gap: 12px;
  height: calc(100vh - 100px);
}

.left-panel {
  width: 240px;
  background: #fff;
  border-radius: 6px;
  padding: 12px;
  flex-shrink: 0;
}
.panel-title {
  font-weight: 600;
  padding: 4px 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
}
.cat-item {
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #606266;
  font-size: 14px;

  .q-count {
    margin-left: auto;
    font-size: 11px;
    color: #909399;
    background: #f0f2f5;
    padding: 1px 6px;
    border-radius: 8px;
  }

  &.sub { padding-left: 24px; font-size: 13px; color: #909399; }
  &:hover { background: #f5f7fa; color: #409eff; }
  &.active { background: #ecf5ff; color: #409eff; font-weight: 600; }
}

.right-panel {
  flex: 1;
  background: #fff;
  border-radius: 6px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.q-header {
  display: flex;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 20px;
}
.q-index { font-weight: 600; color: #303133; }
.answered-count { color: #909399; font-size: 13px; }

.q-content { flex: 1; overflow-y: auto; }
.q-stem {
  font-size: 16px;
  line-height: 1.8;
  color: #303133;
  margin-bottom: 20px;
  white-space: pre-wrap;
}
.opt-list { display: flex; flex-direction: column; gap: 12px; }
.opt-row { display: flex !important; align-items: flex-start; margin: 0; padding: 10px 12px; border-radius: 4px; background: #fafafa; }
.opt-key { font-weight: 600; color: #409eff; margin-right: 6px; }

.feedback {
  margin-top: 24px;
  padding: 16px 20px;
  border-radius: 6px;
  border-left: 4px solid;
}
.feedback.ok { background: #f0f9ff; border-left-color: #67c23a; }
.feedback.ng { background: #fef0f0; border-left-color: #f56c6c; }
.fb-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 15px;
}
.feedback.ok .fb-head { color: #67c23a; }
.feedback.ng .fb-head { color: #f56c6c; }
.fb-row { margin: 4px 0; font-size: 14px; line-height: 1.7; }
.fb-label { color: #909399; margin-right: 4px; }
.ok-text { color: #67c23a; font-weight: 600; }
.analysis { color: #606266; }

.footer {
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
</style>
