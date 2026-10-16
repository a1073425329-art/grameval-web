<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getCategoryTree, listQuestions, getQuestionStudyMode } from '@/api/student'
import { readingSubtypeLabel } from '@/utils/dict'
import type { Category } from '@/types/category'
import type { Question } from '@/types/question'
import type { Difficulty, QuestionType } from '@/types/common'

/* ============================================================
 * 题库浏览（学生）
 * 设计要点：
 *  1. 「查看答案」：列表行本身不携带答案（后端对学生隐藏），
 *     点开详情时调用 /questions/{id}/study-mode（UC02）补全答案+解析。
 *     [2026-10-12 修 R1] 对齐论文表 2.4(:419)：学生须先作答本题（练习提交判定过）才能查看答案，未作答 403。
 *  2. 阅读理解（READING）按 passageId 分组成「一篇长文 + N 道小题」卡片，
 *     详情弹窗一次呈现：长文、中文翻译、重点词汇、整组小题与其答案标准。
 *  3. 填空题（FILL_HINT）：题干里的括号提示词会高亮展示。
 * ============================================================ */

const query = reactive({
  categoryId: undefined as number | undefined,
  questionType: undefined as QuestionType | undefined,
  difficulty: undefined as Difficulty | undefined,
  keyword: '',
  pageNum: 1,
  pageSize: 50,
})

const categories = ref<Category[]>([])
const list = ref<Question[]>([])
const total = ref(0)
const loading = ref(false)

const typeOptions: { label: string; value: QuestionType }[] = [
  { label: '单选题', value: 'SINGLE' },
  { label: '多选题', value: 'MULTIPLE' },
  { label: '判断题', value: 'JUDGE' },
  { label: '填空题', value: 'FILL_HINT' },
  { label: '阅读理解', value: 'READING' },
]

const difficultyOptions: { label: string; value: Difficulty }[] = [
  { label: '简单', value: 1 },
  { label: '中等', value: 2 },
  { label: '困难', value: 3 },
]

const typeLabel = (t?: QuestionType) => typeOptions.find((o) => o.value === t)?.label ?? t
const diffLabel = (d?: Difficulty) => difficultyOptions.find((o) => o.value === d)?.label ?? String(d)
const diffTagType = (d?: Difficulty) => (d === 1 ? 'success' : d === 2 ? 'warning' : 'danger')

/* ---------- 数据加载 ---------- */
const load = async () => {
  loading.value = true
  try {
    const res = await listQuestions({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      categoryId: query.categoryId,
      questionType: query.questionType,
      difficulty: query.difficulty,
      keyword: query.keyword || undefined,
    })
    list.value = res.data.records ?? []
    total.value = res.data.total ?? 0
  } finally {
    loading.value = false
  }
}

const search = () => { query.pageNum = 1; load() }
const reset = () => {
  query.categoryId = undefined
  query.questionType = undefined
  query.difficulty = undefined
  query.keyword = ''
  query.pageNum = 1
  load()
}

/* ---------- 阅读题按 passage 分组 ---------- */
interface NormalItem {
  kind: 'normal'
  question: Question
}
interface PassageGroup {
  kind: 'passage'
  passageId: number
  title: string
  content: string
  wordCount?: number | undefined
  translation?: string | undefined
  keyVocabulary?: VocabularyItem[] | undefined
  difficulty?: Difficulty | undefined
  categoryName?: string | undefined
  questions: Question[]
}

interface VocabularyItem { word: string; phonetic?: string; meaning: string }
const parseVocab = (json?: string): VocabularyItem[] => {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.filter((v) => v && v.word) : []
  } catch { return [] }
}
type FeedItem = NormalItem | PassageGroup

/** 把后端按 passageId 排序的阅读题折叠成「一组一卡」；普通题保持原顺序 */
const feed = computed<FeedItem[]>(() => {
  const out: FeedItem[] = []
  const groupMap = new Map<number, PassageGroup>()
  for (const q of list.value) {
    if (q.questionType === 'READING' && q.passageId) {
      const pid = q.passageId
      let g = groupMap.get(pid)
      if (!g) {
        g = {
          kind: 'passage',
          passageId: pid,
          title: q.passageTitle || '阅读短文',
          content: q.passageContent || '',
          wordCount: q.passageWordCount,
          translation: q.passageTranslation,
          keyVocabulary: parseVocab(q.passageKeyVocabulary),
          difficulty: q.difficulty,
          categoryName: q.categoryName,
          questions: [],
        }
        groupMap.set(pid, g)
        out.push(g)
      }
      g.questions.push(q)
    } else {
      out.push({ kind: 'normal', question: q })
    }
  }
  // 组内按 passageQuestionOrder 排
  for (const g of groupMap.values()) {
    g.questions.sort((a, b) => (a.passageQuestionOrder ?? 0) - (b.passageQuestionOrder ?? 0))
  }
  return out
})

/* ---------- 题干填空/括号提示高亮 ---------- */
interface StemSeg { text: string; hint?: boolean }
/** 把 (提示词) 或 ____ 切分出来，便于模板高亮 */
const stemSegments = (stem?: string): StemSeg[] => {
  if (!stem) return []
  const re = /(\([^()]{1,40}\)|_{2,})/g
  const out: StemSeg[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(stem))) {
    if (m.index > last) out.push({ text: stem.slice(last, m.index) })
    out.push({ text: m[0], hint: true })
    last = m.index + m[0].length
  }
  if (last < stem.length) out.push({ text: stem.slice(last) })
  return out
}

/** 多选答案 A,C → Set；单选为单元素 Set */
const answerSet = (ans?: string): Set<string> =>
  new Set((ans || '').split(/[,，\s]+/).filter(Boolean))

/** 该小题是否为"填空作答型"（无选项 且 答案不是纯选项标签） */
const isBlankStyleQuestion = (q: Question): boolean => {
  if (q.options?.length) return false
  // 无选项：摘要填空/句子补全/简答/表格填空，或答案是真实单词而不是 A/B/C/D
  const subtypes = ['SUMMARY_CLOZE', 'SENTENCE_COMPLETION', 'SHORT_ANSWER', 'TABLE_COMPLETION']
  if (q.questionSubtype && subtypes.includes(q.questionSubtype)) return true
  const a = (q.standardAnswer || '').trim()
  if (!a) return true
  // 答案是 A/B/C/D（可能多选 "A,C"）→ 不是填空
  return !/^[A-D](\s*[,，]\s*[A-D])*$/i.test(a)
}

/* ---------- 详情弹窗（答案按需查看，对齐论文 UC02 表 2.4） ---------- */
const detailVisible = ref(false)
/** 普通题详情（不含答案，仅公开字段） */
const detail = ref<Question | null>(null)
/** 阅读组详情（不含答案，仅公开字段） */
const passageDetail = ref<PassageGroup | null>(null)
/** 已「查看答案」的题目 id 集合（本次会话内记住，不重复请求） */
const revealedIds = ref<Set<number>>(new Set())
/** 正在加载答案的题目 id 集合 */
const revealingIds = ref<Set<number>>(new Set())
/** 填空题自测输入（学生心算后写下答案再核对） */
const practiceInputs = reactive<Record<number, string>>({})

const isRevealed = (id?: number) => id != null && revealedIds.value.has(id)
const isRevealing = (id?: number) => id != null && revealingIds.value.has(id)

/** 按需拉学习模式补全一道题的答案/解析，写回对应容器 */
const revealAnswer = async (q: Question) => {
  if (!q.id || revealedIds.value.has(q.id) || revealingIds.value.has(q.id)) return
  revealingIds.value.add(q.id)
  try {
    const res = await getQuestionStudyMode(q.id)
    const full: Question = { ...q, ...res.data }
    // 写回普通详情
    if (detail.value?.id === q.id) detail.value = full
    // 写回阅读组
    if (passageDetail.value) {
      passageDetail.value = {
        ...passageDetail.value,
        questions: passageDetail.value.questions.map((x) => (x.id === q.id ? full : x)),
      }
    }
    revealedIds.value.add(q.id)
  } catch {
    /* request.ts 已统一弹错；未作答 403（R1 修复）也由全局拦截器提示"请先作答"，这里静默即可 */
  } finally {
    revealingIds.value.delete(q.id)
  }
}

/** 阅读组「整组查看答案」 */
const revealAllInPassage = async () => {
  if (!passageDetail.value) return
  const pending = passageDetail.value.questions.filter((q) => !isRevealed(q.id))
  await Promise.all(pending.map(revealAnswer))
}

const showNormalDetail = (row: Question) => {
  detailVisible.value = true
  passageDetail.value = null
  detail.value = row
}

const showPassageDetail = (group: PassageGroup) => {
  detailVisible.value = true
  detail.value = null
  passageDetail.value = { ...group, questions: [...group.questions] }
}

const onCardClick = (item: FeedItem) => {
  if (item.kind === 'normal') {
    if (!item.question.id) return
    showNormalDetail(item.question)
  } else {
    showPassageDetail(item)
  }
}

/** 文章摘要（卡片预览取首段，截断） */
const passagePreview = (content: string, max = 160) => {
  const first = (content || '').split(/\n+/)[0] || ''
  return first.length > max ? first.slice(0, max) + '…' : first
}

/* ---------- 阅读组答案总览（未揭答案的题用遮罩占位） ---------- */
const passageAnswerRows = computed(() => {
  if (!passageDetail.value) return []
  return passageDetail.value.questions.map((q) => ({
    id: q.id,
    revealed: isRevealed(q.id),
    subtype: readingSubtypeLabel(q.questionSubtype),
    stem: q.stem,
    answer: isRevealed(q.id) ? q.standardAnswer || '—' : '•••',
    score: q.defaultScore,
    analysis: q.analysis,
  }))
})

/* ---------- 弹窗内「翻译」折叠 ---------- */
const showTranslation = ref(false)
const resetTranslationToggle = () => { showTranslation.value = false }

onMounted(async () => {
  try {
    const res = await getCategoryTree()
    categories.value = Array.isArray(res.data) ? res.data : []
  } catch { /* silent */ }
  load()
})

const copyAnswer = (ans?: string) => {
  if (!ans) return
  navigator.clipboard?.writeText(ans).then(() => ElMessage.success('已复制答案')).catch(() => {})
}

/** 填空题自测判定：trim + 忽略大小写 */
const isPracticeCorrect = (q: Question): boolean => {
  if (!q.id) return false
  const mine = (practiceInputs[q.id] || '').trim().toLowerCase()
  const std = (q.standardAnswer || '').trim().toLowerCase()
  return !!mine && mine === std
}
</script>

<template>
  <div class="page">
    <!-- 顶部筛选 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-form-item label="语法专题">
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
            placeholder="选择专题"
            style="width: 220px"
          />
        </el-form-item>
        <el-form-item label="题型">
          <el-select v-model="query.questionType" clearable placeholder="全部题型" style="width: 140px">
            <el-option v-for="op in typeOptions" :key="op.value" :label="op.label" :value="op.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="难度">
          <el-select v-model="query.difficulty" clearable placeholder="全部难度" style="width: 140px">
            <el-option v-for="op in difficultyOptions" :key="op.value" :label="op.label" :value="op.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" clearable placeholder="题干关键词" style="width: 180px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 题目列表（阅读按组聚合） -->
    <el-card shadow="never" v-loading="loading">
      <div v-if="!feed.length && !loading" class="empty-tip">
        <el-empty description="暂无题目" />
      </div>

      <div class="question-grid">
        <template v-for="item in feed" :key="item.kind === 'passage' ? `p-${item.passageId}` : `q-${item.question.id}`">
          <!-- 阅读理解组卡：长文 + N 道小题 -->
          <el-card
            v-if="item.kind === 'passage'"
            class="question-card passage-card"
            hover
            @click="onCardClick(item)"
          >
            <div class="card-header">
              <span class="passage-badge">阅读理解</span>
              <span class="passage-title">{{ item.title }}</span>
              <el-tag v-if="item.wordCount" size="small" type="info">约 {{ item.wordCount }} 词</el-tag>
              <el-tag size="small" type="warning">共 {{ item.questions.length }} 小题</el-tag>
              <el-tag v-if="item.translation" size="small" type="success" effect="plain">含中文翻译</el-tag>
              <el-tag v-if="item.keyVocabulary?.length" size="small" type="warning" effect="plain">
                词汇 ×{{ item.keyVocabulary.length }}
              </el-tag>
              <el-tag v-if="item.categoryName" size="small" type="info">{{ item.categoryName }}</el-tag>
              <el-tag v-if="item.difficulty" size="small" :type="diffTagType(item.difficulty)">
                {{ diffLabel(item.difficulty) }}
              </el-tag>
            </div>

            <div class="passage-preview">{{ passagePreview(item.content) }}</div>

            <div class="sub-q-brief">
              <div
                v-for="(q, qi) in item.questions.slice(0, 5)"
                :key="q.id"
                class="sub-q-brief-row"
              >
                <span class="sub-no">{{ qi + 1 }}</span>
                <span class="sub-stem">{{ q.stem }}</span>
                <el-tag v-if="q.questionSubtype" size="small" effect="plain" type="success">
                  {{ readingSubtypeLabel(q.questionSubtype) }}
                </el-tag>
              </div>
              <div v-if="item.questions.length > 5" class="sub-more">
                … 其余 {{ item.questions.length - 5 }} 题，点开卡片查看完整文章与全部小题
              </div>
            </div>

            <div class="card-footer">
              <span class="answer-hint">点开查看完整文章与小题（答案需逐题点击查看）</span>
              <el-button type="primary" size="small">阅读全文</el-button>
            </div>
          </el-card>

          <!-- 普通题卡 -->
          <el-card
            v-else
            class="question-card"
            hover
            @click="onCardClick(item)"
          >
            <div class="card-header">
              <span class="q-id">#{{ item.question.id }}</span>
              <el-tag size="small" type="info">{{ item.question.categoryName }}</el-tag>
              <el-tag size="small" :type="diffTagType(item.question.difficulty)">
                {{ diffLabel(item.question.difficulty) }}
              </el-tag>
              <el-tag size="small">{{ typeLabel(item.question.questionType) }}</el-tag>
            </div>
            <div class="card-stem">
              <template v-for="(seg, si) in stemSegments(item.question.stem)" :key="si">
                <span v-if="seg.hint" class="stem-hint">{{ seg.text }}</span>
                <template v-else>{{ seg.text }}</template>
              </template>
            </div>
            <div class="card-options">
              <div v-for="opt in item.question.options || []" :key="opt.optionLabel" class="opt-item">
                <span class="opt-label">{{ opt.optionLabel }}.</span>
                <span class="opt-content">{{ opt.optionContent }}</span>
              </div>
              <div v-if="!item.question.options?.length" class="no-options">
                <el-text type="info" size="small">点击查看详情获取选项</el-text>
              </div>
            </div>
            <div class="card-tags" v-if="item.question.knowledgePoints?.length">
              <el-tag v-for="tag in item.question.knowledgePoints" :key="tag" size="small" type="info">{{ tag }}</el-tag>
            </div>
            <div class="card-footer">
              <span class="answer-hint">先心算，点开后可自测并查看答案</span>
              <el-button type="primary" size="small">查看题目</el-button>
            </div>
          </el-card>
        </template>
      </div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[10, 20, 30, 50]"
          @size-change="load"
          @current-change="load"
        />
      </div>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      :title="passageDetail ? '阅读理解 · 题组详情' : '题目详情'"
      :width="passageDetail ? '880px' : '720px'"
      top="4vh"
      @open="resetTranslationToggle"
    >
      <div>
        <!-- ============ 阅读理解题组 ============ -->
        <template v-if="passageDetail">
          <div class="passage-box">
            <div class="passage-head">
              <span class="passage-badge">阅读原文</span>
              <span class="passage-title-lg">{{ passageDetail.title }}</span>
              <el-tag v-if="passageDetail.wordCount" size="small" type="info" effect="plain">
                约 {{ passageDetail.wordCount }} 词
              </el-tag>
              <el-tag size="small" type="warning" effect="plain">本组 {{ passageDetail.questions.length }} 题</el-tag>
            </div>
            <div class="passage-body">{{ passageDetail.content }}</div>

            <!-- 中文翻译（折叠） -->
            <div v-if="passageDetail.translation" class="translation-block">
              <div class="translation-toggle" @click="showTranslation = !showTranslation">
                <el-icon><ArrowDown v-if="showTranslation" /><ArrowRight v-else /></el-icon>
                中文翻译（点击{{ showTranslation ? '收起' : '展开' }}）
              </div>
              <div v-show="showTranslation" class="translation-body">
                {{ passageDetail.translation }}
              </div>
            </div>
          </div>

          <!-- 重点词汇 -->
          <template v-if="passageDetail.keyVocabulary?.length">
            <el-divider content-position="left">
              <span class="divider-title">📝 重点词汇（{{ passageDetail.keyVocabulary.length }}）</span>
            </el-divider>
            <div class="vocab-grid">
              <div v-for="(v, vi) in passageDetail.keyVocabulary" :key="vi" class="vocab-item">
                <div class="vocab-head">
                  <span class="vocab-word">{{ v.word }}</span>
                  <span v-if="v.phonetic" class="vocab-phonetic">{{ v.phonetic }}</span>
                </div>
                <div class="vocab-meaning">{{ v.meaning }}</div>
              </div>
            </div>
          </template>

          <!-- 答案标准总览 -->
          <el-divider content-position="left">
            <span class="divider-title">📋 答案标准总览</span>
            <el-button
              size="small"
              type="primary"
              plain
              style="margin-left: 12px"
              :disabled="passageDetail.questions.every((q) => isRevealed(q.id))"
              @click="revealAllInPassage"
            >
              🔓 整组查看答案
            </el-button>
          </el-divider>
          <el-table :data="passageAnswerRows" size="small" border class="answer-table">
            <el-table-column type="index" label="#" width="50" align="center" />
            <el-table-column label="子题型" width="90" align="center">
              <template #default="{ row }">
                <el-tag size="small" type="success" effect="plain">{{ row.subtype || '—' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="stem" label="题干" min-width="260" show-overflow-tooltip />
            <el-table-column label="答案" width="120" align="center">
              <template #default="{ row }">
                <span v-if="row.revealed" class="ans-cell">{{ row.answer }}</span>
                <span v-else class="ans-masked">点击单题「查看答案」</span>
              </template>
            </el-table-column>
            <el-table-column prop="score" label="分值" width="70" align="center" />
          </el-table>

          <!-- 逐题详解 -->
          <el-divider content-position="left">
            <span class="divider-title">📖 逐题详解</span>
          </el-divider>
          <div
            v-for="(q, qi) in passageDetail.questions"
            :key="q.id"
            class="sub-detail-item"
          >
            <div class="sub-detail-head">
              <span class="sub-detail-no">第 {{ qi + 1 }} 题</span>
              <el-tag v-if="q.questionSubtype" size="small" type="success" effect="plain">
                {{ readingSubtypeLabel(q.questionSubtype) }}
              </el-tag>
              <el-tag v-if="q.defaultScore" size="small" type="info" effect="plain">{{ q.defaultScore }} 分</el-tag>
              <el-tag
                v-for="kp in q.knowledgePoints || []"
                :key="kp"
                size="small"
                type="info"
                effect="plain"
              >{{ kp }}</el-tag>
            </div>
            <div class="sub-detail-stem">{{ q.stem }}</div>
            <div v-if="q.options?.length" class="q-options">
              <div
                v-for="op in q.options"
                :key="op.optionLabel"
                class="opt"
                :class="{
                  correct: isRevealed(q.id) && answerSet(q.standardAnswer).has(op.optionLabel),
                  wrong: isRevealed(q.id) && q.standardAnswer && !answerSet(q.standardAnswer).has(op.optionLabel),
                }"
              >
                <span class="opt-key">{{ op.optionLabel }}.</span>
                <span>{{ op.optionContent }}</span>
                <el-icon v-if="isRevealed(q.id) && answerSet(q.standardAnswer).has(op.optionLabel)" class="opt-icon"><Check /></el-icon>
              </div>
            </div>

            <!-- 填空型阅读小题（摘要/句子补全/简答）：自测输入 -->
            <div v-if="isBlankStyleQuestion(q)" class="practice-box">
              <div class="practice-label">
                <el-icon><EditPen /></el-icon>
                用原文中的词/短语作答，先写下你的答案再核对：
              </div>
              <el-input
                v-model="practiceInputs[q.id]"
                placeholder="输入你的答案"
                class="practice-input"
                :disabled="isRevealed(q.id)"
                @keyup.enter="revealAnswer(q)"
              >
                <template #append>
                  <el-button
                    type="primary"
                    :loading="isRevealing(q.id)"
                    :disabled="isRevealed(q.id)"
                    @click="revealAnswer(q)"
                  >
                    🔓 查看答案
                  </el-button>
                </template>
              </el-input>
              <div v-if="isRevealed(q.id)" class="practice-judge">
                <template v-if="practiceInputs[q.id]?.trim()">
                  <el-tag :type="isPracticeCorrect(q) ? 'success' : 'danger'" effect="dark">
                    {{ isPracticeCorrect(q) ? '✓ 答案正确' : '✗ 与标准答案不一致' }}
                  </el-tag>
                  <span class="practice-your">你的答案：<b>{{ practiceInputs[q.id] }}</b></span>
                </template>
                <span class="practice-std">标准答案：<b class="ok">{{ q.standardAnswer }}</b></span>
              </div>
            </div>

            <!-- 选择型小题：答案遮罩 -->
            <div v-else-if="!isRevealed(q.id)" class="answer-mask">
              <span class="mask-text">先心算你的答案，再核对</span>
              <el-button
                type="primary"
                size="small"
                :loading="isRevealing(q.id)"
                @click="revealAnswer(q)"
              >
                🔓 查看答案
              </el-button>
            </div>
            <template v-else-if="!isBlankStyleQuestion(q)">
              <div class="sub-answer-row">
                <span class="ans-label">答案：</span>
                <span class="ans-value">{{ q.standardAnswer || '—' }}</span>
                <el-button link type="primary" size="small" @click="copyAnswer(q.standardAnswer)">复制</el-button>
              </div>
              <div v-if="q.analysis" class="sub-analysis">
                <span class="ans-label">解析：</span>{{ q.analysis }}
              </div>
            </template>

            <!-- 填空型小题的解析（答案已在自测区显示） -->
            <div v-if="isBlankStyleQuestion(q) && isRevealed(q.id) && q.analysis" class="sub-analysis">
              <span class="ans-label">解析：</span>{{ q.analysis }}
            </div>
          </div>
        </template>

        <!-- ============ 普通题详情 ============ -->
        <template v-else-if="detail">
          <div class="q-title">
            <template v-for="(seg, si) in stemSegments(detail.stem)" :key="si">
              <span v-if="seg.hint" class="stem-hint">{{ seg.text }}</span>
              <template v-else>{{ seg.text }}</template>
            </template>
          </div>
          <div class="q-meta">
            <el-tag size="small">{{ typeLabel(detail.questionType) }}</el-tag>
            <el-tag size="small" :type="diffTagType(detail.difficulty)">{{ diffLabel(detail.difficulty) }}</el-tag>
            <el-tag v-if="detail.categoryName" size="small" type="info">{{ detail.categoryName }}</el-tag>
            <el-tag v-if="detail.hintText" size="small" type="warning" effect="plain">提示：{{ detail.hintText }}</el-tag>
          </div>
          <div v-if="detail.options?.length" class="q-options">
            <div
              v-for="op in detail.options"
              :key="op.optionLabel"
              class="opt"
              :class="{
                correct: isRevealed(detail.id) && answerSet(detail.standardAnswer).has(op.optionLabel),
                wrong: isRevealed(detail.id) && detail.standardAnswer && !answerSet(detail.standardAnswer).has(op.optionLabel),
              }"
            >
              <span class="opt-key">{{ op.optionLabel }}.</span>
              <span>{{ op.optionContent }}</span>
              <el-icon v-if="isRevealed(detail.id) && answerSet(detail.standardAnswer).has(op.optionLabel)" class="opt-icon"><Check /></el-icon>
            </div>
          </div>

          <!-- 填空题：先自测写下答案 -->
          <div v-if="detail.questionType === 'FILL_HINT'" class="practice-box">
            <div class="practice-label">
              <el-icon><EditPen /></el-icon>
              先写下你的答案（心算/拼写），再点「查看答案」核对：
            </div>
            <el-input
              v-model="practiceInputs[detail.id]"
              placeholder="输入你填入空格的单词"
              class="practice-input"
              :disabled="isRevealed(detail.id)"
              @keyup.enter="revealAnswer(detail)"
            >
              <template #append>
                <el-button
                  type="primary"
                  :loading="isRevealing(detail.id)"
                  :disabled="isRevealed(detail.id)"
                  @click="revealAnswer(detail)"
                >
                  🔓 查看答案
                </el-button>
              </template>
            </el-input>
            <div v-if="isRevealed(detail.id)" class="practice-judge">
              <template v-if="practiceInputs[detail.id]?.trim()">
                <el-tag :type="isPracticeCorrect(detail) ? 'success' : 'danger'" effect="dark">
                  {{ isPracticeCorrect(detail) ? '✓ 拼写正确' : '✗ 与标准答案不一致' }}
                </el-tag>
                <span class="practice-your">你的答案：<b>{{ practiceInputs[detail.id] }}</b></span>
              </template>
              <span class="practice-std">标准答案：<b class="ok">{{ detail.standardAnswer }}</b></span>
            </div>
          </div>

          <!-- 非填空题：答案遮罩 -->
          <div v-else-if="!isRevealed(detail.id)" class="answer-mask">
            <span class="mask-text">先心算你的答案，再核对</span>
            <el-button
              type="primary"
              size="small"
              :loading="isRevealing(detail.id)"
              @click="revealAnswer(detail)"
            >
              🔓 查看答案
            </el-button>
          </div>

          <!-- 答案 + 解析（揭开后才显示） -->
          <template v-if="isRevealed(detail.id)">
            <el-divider content-position="left">参考答案</el-divider>
            <div class="q-answer">
              {{ detail.standardAnswer || '—' }}
              <el-button v-if="detail.standardAnswer" link type="primary" size="small" @click="copyAnswer(detail.standardAnswer)">复制</el-button>
            </div>
            <el-divider content-position="left">解析</el-divider>
            <div class="q-analysis">{{ detail.analysis || '暂无解析' }}</div>
          </template>

          <template v-if="detail.knowledgePoints?.length">
            <el-divider content-position="left">知识点</el-divider>
            <div class="q-meta">
              <el-tag v-for="kp in detail.knowledgePoints" :key="kp" size="small" type="info">{{ kp }}</el-tag>
            </div>
          </template>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.empty-tip { padding: 24px 0; }

.question-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(440px, 1fr));
  gap: 16px;
}

.question-card {
  cursor: pointer;
  transition: all 0.2s;
  &:hover { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
}

/* 阅读组卡 */
.passage-card {
  border-left: 3px solid #409eff;
  background: linear-gradient(180deg, #f7fbff 0%, #ffffff 70%);
}
.passage-badge {
  padding: 2px 10px;
  border-radius: 999px;
  background: #409eff;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}
.passage-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2d3d;
}
.passage-preview {
  font-size: 13px;
  color: #606266;
  line-height: 1.7;
  margin: 10px 0;
  padding: 10px 12px;
  background: rgba(64, 158, 255, 0.05);
  border-radius: 6px;
  font-style: italic;
}
.sub-q-brief {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.sub-q-brief-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #303133;
  .sub-no {
    width: 20px; height: 20px;
    border-radius: 50%;
    background: #409eff;
    color: #fff;
    font-size: 12px;
    display: inline-flex;
    align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .sub-stem {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
.sub-more {
  font-size: 12px;
  color: #909399;
  padding: 4px 0 0 28px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.q-id { font-size: 12px; color: #909399; font-family: monospace; }

.card-stem {
  font-size: 14px;
  line-height: 1.7;
  color: #303133;
  margin-bottom: 12px;
  white-space: pre-wrap;
}
.stem-hint {
  background: #fef0e6;
  color: #b88230;
  padding: 0 4px;
  border-radius: 3px;
  font-weight: 600;
}

.card-options { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.opt-item {
  display: flex;
  align-items: flex-start;
  padding: 6px 10px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
}
.opt-label { font-weight: 600; color: #409eff; margin-right: 6px; flex-shrink: 0; }
.opt-content { color: #606266; }
.no-options { padding: 8px; text-align: center; }

.card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}
.answer-hint { font-size: 13px; color: #67c23a; font-weight: 500; }

/* 弹窗 */
.q-title { font-size: 15px; line-height: 1.7; margin-bottom: 12px; color: #303133; white-space: pre-wrap; }
.q-meta { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
.q-options { display: flex; flex-direction: column; gap: 8px; }
.opt {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: #f5f7fa;
  border-radius: 6px;
  border-left: 3px solid transparent;
  &.correct { background: #f0f9eb; border-left-color: #67c23a; color: #529b2e; }
  &.wrong { opacity: 0.55; }
}
.opt-key { font-weight: 600; color: #409eff; margin-right: 8px; flex-shrink: 0; }
.opt-icon { margin-left: auto; color: #67c23a; }
.q-answer { color: #67c23a; font-weight: 600; font-size: 15px; }
.q-analysis { color: #606266; line-height: 1.7; white-space: pre-wrap; }

/* 弹窗中的阅读长文 */
.passage-box {
  margin-bottom: 16px;
  padding: 16px 20px 14px;
  border: 1px solid #d9ecff;
  border-left: 4px solid #409eff;
  border-radius: 8px;
  background: linear-gradient(180deg, #f7fbff 0%, #ffffff 100%);
  max-height: 46vh;
  overflow-y: auto;
}
.passage-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #d9ecff;
}
.passage-title-lg { font-size: 16px; font-weight: 600; color: #1f2d3d; }
.passage-body {
  font-size: 15px;
  line-height: 2;
  color: #303133;
  text-align: justify;
  white-space: pre-wrap;
}
.translation-block { margin-top: 10px; border-top: 1px dashed #e4e7ed; padding-top: 8px; }
.translation-toggle {
  cursor: pointer;
  font-size: 13px;
  color: #409eff;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.translation-body {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.8;
  color: #606266;
  white-space: pre-wrap;
}

.divider-title { font-size: 14px; font-weight: 600; color: #303133; }
.answer-table { margin-bottom: 8px; }
.ans-cell { color: #67c23a; font-weight: 700; }

.sub-detail-item {
  background: #fafbfc;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 12px;
}
.sub-detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.sub-detail-no { font-weight: 700; color: #409eff; }
.sub-detail-stem { font-size: 14px; color: #303133; line-height: 1.7; margin-bottom: 10px; }
.sub-answer-row { margin-top: 10px; font-size: 14px; display: flex; align-items: center; gap: 6px; }
.ans-label { color: #909399; }
.ans-value { color: #67c23a; font-weight: 700; font-size: 15px; }
.sub-analysis {
  margin-top: 6px;
  font-size: 13px;
  color: #606266;
  line-height: 1.7;
  white-space: pre-wrap;
}

/* 重点词汇 */
.vocab-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}
.vocab-item {
  background: #fffbf2;
  border: 1px solid #f5e6c4;
  border-radius: 6px;
  padding: 8px 12px;
}
.vocab-head { display: flex; align-items: baseline; gap: 8px; }
.vocab-word { font-weight: 700; color: #b88230; font-size: 14px; }
.vocab-phonetic { color: #909399; font-size: 12px; font-style: italic; }
.vocab-meaning { color: #606266; font-size: 13px; margin-top: 2px; line-height: 1.5; }

/* 答案遮罩（未点击「查看答案」前） */
.answer-mask {
  margin-top: 14px;
  padding: 14px 16px;
  background: repeating-linear-gradient(45deg, #f5f7fa, #f5f7fa 10px, #eef1f6 10px, #eef1f6 20px);
  border: 1px dashed #c0c4cc;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  .mask-text {
    color: #909399;
    font-size: 13px;
  }
}
.ans-masked { color: #c0c4cc; font-size: 12px; letter-spacing: 2px; }

/* 填空题自测区 */
.practice-box {
  margin-top: 14px;
  padding: 14px 16px;
  background: #f0f7ff;
  border: 1px solid #d9ecff;
  border-radius: 8px;
}
.practice-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #409eff;
  margin-bottom: 8px;
}
.practice-input { max-width: 420px; }
.practice-judge {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 13px;
  color: #606266;
}
.practice-your b { color: #e6a23c; }
.practice-std .ok { color: #67c23a; font-size: 15px; }
</style>
