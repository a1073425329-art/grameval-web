<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { getWrongBook } from '@/api/student'
import { getCategoryTree } from '@/api/student'
import type { WrongBookItem } from '@/types/result'
import type { Category } from '@/types/category'
import type { QuestionType } from '@/types/common'

const query = reactive<{
  source: 'ALL' | 'EXAM' | 'PRACTICE'
  categoryId?: number
  questionType?: QuestionType
  pageNum: number
  pageSize: number
}>({
  source: 'ALL',
  categoryId: undefined,
  questionType: undefined,
  pageNum: 1,
  pageSize: 10,
})

const list = ref<WrongBookItem[]>([])
const total = ref(0)
const loading = ref(false)
const categories = ref<Category[]>([])

const typeOptions: { label: string; value: QuestionType }[] = [
  { label: '单选题', value: 'SINGLE' },
  { label: '多选题', value: 'MULTIPLE' },
  { label: '判断题', value: 'JUDGE' },
  { label: '填空题', value: 'FILL_HINT' },
  { label: '阅读理解', value: 'READING' },
]
const typeLabel = (t?: QuestionType) => typeOptions.find((o) => o.value === t)?.label ?? t
const diffLabel = (d?: number) => (d === 1 ? '简单' : d === 2 ? '中等' : d === 3 ? '困难' : '-')
const diffTagType = (d?: number) => (d === 1 ? 'success' : d === 2 ? 'warning' : 'danger')

const load = async () => {
  loading.value = true
  try {
    const res = await getWrongBook({
      source: query.source,
      categoryId: query.categoryId,
      questionType: query.questionType,
      pageNum: query.pageNum,
      pageSize: query.pageSize,
    })
    list.value = res.data.records ?? []
    total.value = res.data.total ?? 0
  } finally { loading.value = false }
}

const search = () => { query.pageNum = 1; load() }
const reset = () => {
  query.source = 'ALL'
  query.categoryId = undefined
  query.questionType = undefined
  query.pageNum = 1
  load()
}

const answerText = (a: string | undefined | null) => {
  if (a === undefined || a === null || a === '') return '（未作答）'
  return a
}

const sourceTag = (s: string) => (s === 'EXAM' ? 'danger' : 'warning')
const sourceLabel = (s: string) => (s === 'EXAM' ? '考试' : '练习')

onMounted(async () => {
  try {
    const c = await getCategoryTree()
    categories.value = c.data ?? []
  } catch { /* silent */ }
  load()
})
</script>

<template>
  <div class="page">
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-form-item label="来源">
          <el-radio-group v-model="query.source" @change="search">
            <el-radio-button value="ALL">全部</el-radio-button>
            <el-radio-button value="EXAM">考试错题</el-radio-button>
            <el-radio-button value="PRACTICE">练习错题</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="分类">
          <el-cascader
            v-model="query.categoryId"
            :options="categories"
            :props="{ value: 'id', label: 'categoryName', children: 'children', checkStrictly: true, emitPath: false }"
            clearable placeholder="全部分类" style="width:180px"
          />
        </el-form-item>
        <el-form-item label="题型">
          <el-select v-model="query.questionType" clearable placeholder="全部" style="width:140px">
            <el-option v-for="op in typeOptions" :key="op.value" :label="op.label" :value="op.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="stats" v-if="!loading">
      <el-alert type="info" :closable="false" show-icon>
        共找到 <b>{{ total }}</b> 道错题（按题目去重，保留首次错误时间）
      </el-alert>
    </div>

    <div v-loading="loading" class="wrong-list">
      <el-empty v-if="!loading && !list.length" description="🎉 恭喜！暂无错题" />

      <div v-for="(w, idx) in list" :key="`${w.questionId}-${w.source}`" class="wrong-item">
        <div class="head">
          <span class="q-idx">#{{ (query.pageNum - 1) * query.pageSize + idx + 1 }}</span>
          <el-tag :type="sourceTag(w.source)" size="small" effect="light">{{ sourceLabel(w.source) }}</el-tag>
          <el-tag size="small">{{ typeLabel(w.questionType) }}</el-tag>
          <el-tag :type="diffTagType(w.difficulty)" size="small">{{ diffLabel(w.difficulty) }}</el-tag>
          <el-tag type="info" size="small">{{ w.categoryName }}</el-tag>
          <span class="time">首错：{{ w.firstWrongTime }}</span>
        </div>
        <div class="stem">{{ w.stem }}</div>
        <div v-if="w.options?.length" class="opts">
          <div v-for="op in w.options" :key="op.optionLabel" class="opt">
            <span class="opt-key">{{ op.optionLabel }}.</span>{{ op.optionContent }}
          </div>
        </div>
        <div class="row">
          <span class="lbl">你的答案：</span>
          <span class="ng-text">{{ answerText(w.userAnswer) }}</span>
        </div>
        <div class="row">
          <span class="lbl">正确答案：</span>
          <span class="ok-text">{{ w.standardAnswer }}</span>
        </div>
        <div class="row" v-if="w.analysis">
          <span class="lbl">解析：</span>
          <span>{{ w.analysis }}</span>
        </div>
        <div class="row" v-if="w.sourceName">
          <span class="lbl">来源：</span>
          <span style="color:#909399">{{ w.sourceName }}</span>
        </div>
      </div>
    </div>

    <div class="pagination" v-if="list.length">
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
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.filter-card :deep(.el-card__body) { padding-bottom: 0; }

.stats { margin: 0; }

.wrong-list { display: flex; flex-direction: column; gap: 12px; }
.wrong-item {
  background: #fff;
  border-left: 4px solid #f56c6c;
  border-radius: 6px;
  padding: 16px 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.head {
  display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
  margin-bottom: 10px;
  .q-idx { font-weight: 600; color: #f56c6c; margin-right: 4px; }
  .time { color: #909399; font-size: 12px; margin-left: auto; }
}
.stem { font-size: 15px; line-height: 1.7; color: #303133; margin-bottom: 12px; white-space: pre-wrap; }
.opts { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.opt { padding: 4px 10px; background: #fafafa; border-radius: 3px; color: #606266; font-size: 13px; }
.opt-key { font-weight: 600; color: #409eff; margin-right: 4px; }
.row { padding: 3px 0; font-size: 14px; line-height: 1.6; }
.lbl { color: #909399; margin-right: 4px; }
.ok-text { color: #67c23a; font-weight: 600; }
.ng-text { color: #f56c6c; font-weight: 600; }

.pagination { display: flex; justify-content: flex-end; }
</style>
