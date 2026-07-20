<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { getWrongBook, getCategoryTree } from '@/api/student'
import type { WrongBookItem } from '@/types/result'
import type { Category } from '@/types/category'
import type { QuestionType, Difficulty } from '@/types/common'
import { getJudgeOptionLabel } from '@/utils/dict'

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

        <!-- 非选项题的答案区 -->
        <div v-if="w.questionType === 'FILL' || w.questionType === 'JUDGE'" class="wc-answer-row">
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
  b { color: #f56c6c; font-size: 18px; margin: 0 2px; }
}

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
</style>
