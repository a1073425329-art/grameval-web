<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getCategoryTree, getPracticeQuestions, submitPractice, listPractices, startPractice as openPracticeSession, answerInPractice, finishPractice } from '@/api/student'
import type { Category } from '@/types/category'
import type { Question, QuickPracticeResult, PracticeRecord } from '@/types/question'
import type { QuestionType, Difficulty } from '@/types/common'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

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

/* ============================================================ *
 *  练习会话（落库）：startPractice / answerInPractice / finishPractice
 * ============================================================ */
const activePracticeId = ref<number | null>(null)
/** 记录本次会话中已通过 /practices/{id}/answers 落库的题目，避免重复入库 */
const persistedAnswerIds = ref<Set<number>>(new Set())
/** 本次会话落库结束后的汇总（结束练习按钮提示用） */
const finishedSummary = ref<{ correct: number; total: number } | null>(null)

/** 结束当前练习会话（落库收尾 + 刷新侧栏） */
const finishCurrentPractice = async () => {
  const pid = activePracticeId.value
  if (pid == null) return
  activePracticeId.value = null
  try {
    const res = await finishPractice(pid)
    const rec = res.data
    if (rec && rec.questionCount > 0) {
      finishedSummary.value = { correct: rec.correctCount, total: rec.questionCount }
    }
    loadPracticeRecords()
  } catch { /* 失败不阻塞页面，record 由后端事务保证 */ }
}

const onBeforeUnload = () => {
  // 浏览器刷新/关闭时尽力收尾（同步场景下 sendBeacon 更可靠，此处保持简单）
  if (activePracticeId.value != null) finishCurrentPractice()
}


/* ============================================================ *
 *  新增：收藏题目功能（localStorage 持久化）
 * ============================================================ */
const BOOKMARK_KEY = 'grameval_practice_bookmarks'
const bookmarkedIds = ref<Set<number>>(new Set(loadBookmarks()))

function loadBookmarks(): number[] {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY)
    return raw ? (JSON.parse(raw) as number[]) : []
  } catch { return [] }
}
function saveBookmarks() {
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(Array.from(bookmarkedIds.value)))
}
const isBookmarked = (qid: number) => bookmarkedIds.value.has(qid)
const toggleBookmark = (qid: number) => {
  const next = new Set(bookmarkedIds.value)
  if (next.has(qid)) {
    next.delete(qid)
    ElMessage.info('已取消收藏')
  } else {
    next.add(qid)
    ElMessage.success('已收藏该题，可在收藏列表中复习')
  }
  bookmarkedIds.value = next
  saveBookmarks()
}

/* ============================================================ *
 *  新增：难度标识（1 简单 / 2 中等 / 3 困难）
 * ============================================================ */
const difficultyMeta = (d?: Difficulty) => {
  if (d === 1) return { text: '简单', color: '#67c23a', bg: '#f0f9eb', border: '#c2e7b0' }
  if (d === 2) return { text: '中等', color: '#e6a23c', bg: '#fdf6ec', border: '#f5dab1' }
  if (d === 3) return { text: '困难', color: '#f56c6c', bg: '#fef0f0', border: '#fab6b6' }
  return { text: '未知', color: '#909399', bg: '#f4f4f5', border: '#dcdfe6' }
}

/* ============================================================ *
 *  新增：练习记录侧栏 + 练习进度统计
 * ============================================================ */
const practiceRecords = ref<PracticeRecord[]>([])
const recordsCollapsed = ref(false)
const recordsLoading = ref(false)

const loadPracticeRecords = async () => {
  recordsLoading.value = true
  try {
    const res = await listPractices({ pageNum: 1, pageSize: 20 })
    practiceRecords.value = res.data?.records ?? []
  } catch { /* silent */ } finally { recordsLoading.value = false }
}

const recordScoreValue = (r: PracticeRecord) => {
  if (r.accuracy != null) return r.accuracy
  if (r.questionCount > 0) return (r.correctCount / r.questionCount) * 100
  return 0
}
const recordScore = (r: PracticeRecord) => recordScoreValue(r).toFixed(0) + '%'
const recordScoreColor = (r: PracticeRecord) => {
  const v = recordScoreValue(r)
  if (v >= 80) return '#67c23a'
  if (v >= 60) return '#e6a23c'
  return '#f56c6c'
}
const recordDuration = (r: PracticeRecord) => {
  if (!r.startTime) return '-'
  const start = Date.parse(r.startTime)
  const end = r.finishTime ? Date.parse(r.finishTime) : Date.now()
  if (isNaN(start)) return '-'
  const mins = Math.max(0, Math.round((end - start) / 60000))
  return mins + ' 分钟'
}
const recordDate = (r: PracticeRecord) => (r.startTime || '').slice(0, 10)

/** 练习进度看板统计：累计练习题数 / 综合正确率 / 连续天数 / 专题覆盖 */
const practiceStats = computed(() => {
  const records = practiceRecords.value
  const totalPracticed = records.reduce((s, r) => s + (r.questionCount || 0), 0)
  const totalCorrect = records.reduce((s, r) => s + (r.correctCount || 0), 0)
  const correctRate = totalPracticed > 0 ? (totalCorrect / totalPracticed) * 100 : 0
  const categorySet = new Set(records.map(r => r.categoryId))
  return {
    totalPracticed,
    correctRate,
    streakDays: computeStreakDays(records),
    categoryCoverage: categorySet.size,
  }
})

/** 根据练习记录的开始/完成时间计算连续打卡天数 */
function computeStreakDays(records: PracticeRecord[]): number {
  const days = new Set<string>()
  records.forEach(r => {
    const d = (r.finishTime || r.startTime || '').slice(0, 10)
    if (d) days.add(d)
  })
  const sorted = Array.from(days).sort().reverse()
  if (!sorted.length) return 0
  let streak = 1
  let prev = new Date(sorted[0])
  for (let i = 1; i < sorted.length; i++) {
    const cur = new Date(sorted[i])
    const diff = Math.round((prev.getTime() - cur.getTime()) / 86400000)
    if (diff === 1) { streak++; prev = cur } else break
  }
  return streak
}

const loadCategories = async () => {
  try {
    const res = await getCategoryTree()
    categories.value = Array.isArray(res.data) ? res.data : []
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
  // 切换专题前先把上一个练习会话收尾落库
  await finishCurrentPractice()
  try {
    const res = await getPracticeQuestions(catId, 10)
    questions.value = Array.isArray(res.data) ? res.data : []
    currentIndex.value = 0
    userAnswers.value = {}
    feedbacks.value = {}
    persistedAnswerIds.value = new Set()
    finishedSummary.value = null
    if (!questions.value.length) {
      activePracticeId.value = null
      ElMessage.info('该专题下暂无可练习的题目')
    } else {
      // 开启落库会话；失败则降级为无状态练习（仍可答题，只是不生成记录）
      try {
        const practiceRes = await openPracticeSession(catId)
        activePracticeId.value = practiceRes.data?.id ?? null
      } catch { activePracticeId.value = null }
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
    // 落库：练习会话中把本题答案写入 practice_answer 表（失败不影响答题体验）
    const pid = activePracticeId.value
    if (pid != null && !persistedAnswerIds.value.has(current.value.id)) {
      try {
        await answerInPractice(pid, { questionId: current.value.id, userAnswer: ans })
        persistedAnswerIds.value.add(current.value.id)
      } catch { /* 静默降级：判题反馈仍正常展示 */ }
    }
    // 提交后刷新练习记录侧栏与看板
    loadPracticeRecords()
  } finally {
    submitting.value = false
  }
}

/** 手动结束练习：收尾落库并给出本次汇总 */
const finishPracticeSession = async () => {
  if (activePracticeId.value == null) {
    ElMessage.info('当前没有进行中的练习')
    return
  }
  await finishCurrentPractice()
  const s = finishedSummary.value
  if (s) {
    ElMessage.success(`练习已完成：共 ${s.total} 题，答对 ${s.correct} 题`)
  } else {
    ElMessage.info('练习已完成')
  }
}

const next = () => { if (currentIndex.value < questions.value.length - 1) currentIndex.value++ }
const prev = () => { if (currentIndex.value > 0) currentIndex.value-- }

const answerText = (a: string | string[] | undefined) => {
  if (a === undefined) return '-'
  return Array.isArray(a) ? a.join(', ') : String(a)
}

onMounted(() => {
  loadCategories()
  loadPracticeRecords()
})

onBeforeUnmount(() => {
  // 离开页面时把进行中的练习收尾落库
  if (activePracticeId.value != null) finishCurrentPractice()
  window.removeEventListener('beforeunload', onBeforeUnload)
})
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', onBeforeUnload)
}
</script>

<template>
  <!--
    [原结构保留说明]
    原 .practice-page 为横向 flex（左专题列表 + 右练习区）：
      <div class="practice-page">
        <div class="left-panel">…</div>
        <div class="right-panel">…</div>
      </div>
    现改为纵向 flex：顶部新增进度看板，下方 .practice-main 横向排布
    左侧专题、中间练习区、右侧可收起的练习记录侧栏。
  -->
  <div class="practice-page">
    <!-- ===== 新增：练习进度统计看板 ===== -->
    <div class="progress-dashboard">
      <div class="dashboard-header">
        <div class="dh-left">
          <el-avatar :size="44" :src="authStore.userInfo?.avatar || '/avatars/student.jpg'">
            <el-icon><UserFilled /></el-icon>
          </el-avatar>
          <div class="dh-info">
            <div class="dh-title">练习进度看板</div>
            <div class="dh-sub">
              {{ authStore.userInfo?.displayName || authStore.userInfo?.username || '同学' }}，坚持练习，每天进步一点点！
            </div>
          </div>
        </div>
        <div class="dh-right">
          <el-button size="small" @click="recordsCollapsed = !recordsCollapsed">
            <el-icon><Fold v-if="!recordsCollapsed" /><Expand v-else /></el-icon>
            <span style="margin-left:4px">{{ recordsCollapsed ? '展开记录' : '收起记录' }}</span>
          </el-button>
        </div>
      </div>
      <div class="dashboard-stats">
        <div class="stat-block">
          <div class="stat-icon" style="background:linear-gradient(135deg,#409eff,#66b1ff)">
            <el-icon><EditPen /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-num">{{ practiceStats.totalPracticed }}</div>
            <div class="stat-name">累计练习题数</div>
          </div>
        </div>
        <div class="stat-block">
          <div class="stat-icon" style="background:linear-gradient(135deg,#67c23a,#95d475)">
            <el-icon><CircleCheck /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-num">{{ practiceStats.correctRate.toFixed(1) }}%</div>
            <div class="stat-name">综合正确率</div>
          </div>
        </div>
        <div class="stat-block">
          <div class="stat-icon" style="background:linear-gradient(135deg,#e6a23c,#f3d19e)">
            <el-icon><Calendar /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-num">{{ practiceStats.streakDays }}</div>
            <div class="stat-name">连续练习天数</div>
          </div>
        </div>
        <div class="stat-block">
          <div class="stat-icon" style="background:linear-gradient(135deg,#f56c6c,#fab6b6)">
            <el-icon><Files /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-num">{{ practiceStats.categoryCoverage }}</div>
            <div class="stat-name">已覆盖专题数</div>
          </div>
        </div>
      </div>
    </div>

    <div class="practice-main">
      <!-- 左侧：专题列表 -->
      <div class="left-panel">
        <div class="panel-title">选择语法专题</div>
        <el-scrollbar height="calc(100vh - 300px)">
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
            <!-- 新增：难度标识 -->
            <span
              class="difficulty-tag"
              :style="{
                color: difficultyMeta(current.difficulty).color,
                background: difficultyMeta(current.difficulty).bg,
                borderColor: difficultyMeta(current.difficulty).border,
              }"
            >
              <span class="diff-dots">
                <i v-for="n in 3" :key="n" :class="{ on: n <= (current.difficulty || 0) }"></i>
              </span>
              {{ difficultyMeta(current.difficulty).text }}
            </span>
            <!-- 新增：收藏题目按钮 -->
            <el-tooltip :content="isBookmarked(current.id) ? '取消收藏' : '收藏本题'" placement="top">
              <el-button
                class="bookmark-btn"
                :type="isBookmarked(current.id) ? 'warning' : 'default'"
                size="small"
                circle
                @click="toggleBookmark(current.id)"
              >
                <el-icon><StarFilled v-if="isBookmarked(current.id)" /><Star v-else /></el-icon>
              </el-button>
            </el-tooltip>
          </div>

          <div class="q-content">
            <div class="q-stem">{{ currentIndex + 1 }}. {{ current.stem }}</div>

            <!-- 新增：知识点关联标签 -->
            <div v-if="current.knowledgePoints?.length" class="knowledge-points">
              <el-icon class="kp-icon"><PriceTag /></el-icon>
              <span class="kp-label">知识点：</span>
              <el-tag
                v-for="kp in current.knowledgePoints"
                :key="kp"
                size="small"
                effect="plain"
                round
                class="kp-tag"
              >{{ kp }}</el-tag>
            </div>

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
              <el-radio value="TRUE" class="opt-row">对</el-radio>
              <el-radio value="FALSE" class="opt-row">错</el-radio>
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
            <div class="footer-mid">
              <el-button
                v-if="activePracticeId != null"
                type="warning"
                plain
                :disabled="!Object.keys(feedbacks).length"
                @click="finishPracticeSession"
              >结束练习</el-button>
            </div>
            <div class="footer-right">
              <el-button v-if="!currentFeedback" type="primary" :loading="submitting" @click="submit">确认回答</el-button>
              <el-button
                type="primary"
                :disabled="currentIndex === questions.length - 1"
                @click="next"
              >下一题<el-icon><ArrowRight /></el-icon></el-button>
            </div>
          </div>
        </template>
      </div>

      <!-- 新增：练习记录侧栏（可收起） -->
      <transition name="slide-fade">
        <div v-show="!recordsCollapsed" class="records-panel">
          <div class="panel-title records-title">
            <span><el-icon><Clock /></el-icon> 最近练习记录</span>
          </div>
          <el-scrollbar height="calc(100vh - 300px)" v-loading="recordsLoading">
            <div v-for="r in practiceRecords" :key="r.id" class="record-item">
              <div class="ri-top">
                <span class="ri-cat">{{ r.categoryName || '专题练习' }}</span>
                <span class="ri-score" :style="{ color: recordScoreColor(r) }">{{ recordScore(r) }}</span>
              </div>
              <div class="ri-meta">
                <span><el-icon><Calendar /></el-icon>{{ recordDate(r) }}</span>
                <span><el-icon><Timer /></el-icon>{{ recordDuration(r) }}</span>
                <span><el-icon><EditPen /></el-icon>{{ r.questionCount }}题</span>
              </div>
              <div class="ri-bar">
                <div
                  class="ri-bar-correct"
                  :style="{ width: recordScoreValue(r) + '%', background: recordScoreColor(r) }"
                ></div>
              </div>
            </div>
            <el-empty v-if="!practiceRecords.length && !recordsLoading" description="暂无练习记录" :image-size="60" />
          </el-scrollbar>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* [原样式保留] .practice-page 原为横向 flex，现改为纵向 flex：
   .practice-page { display: flex; gap: 12px; height: calc(100vh - 100px); }
*/
.practice-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 100px);
}

/* 新增：进度看板 */
.progress-dashboard {
  background: linear-gradient(135deg, #ffffff 0%, #f5faff 100%);
  border-radius: 10px;
  padding: 16px 20px;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.08);
  flex-shrink: 0;
}
.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.dh-left { display: flex; align-items: center; gap: 12px; }
.dh-title { font-size: 16px; font-weight: 700; color: #303133; }
.dh-sub { font-size: 12px; color: #909399; margin-top: 2px; }
.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.stat-block {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: all 0.25s;
  &:hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08); }
}
.stat-icon {
  width: 42px; height: 42px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 20px; flex-shrink: 0;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
}
.stat-num { font-size: 22px; font-weight: 700; color: #303133; line-height: 1.2; }
.stat-name { font-size: 12px; color: #909399; margin-top: 2px; }

/* 新增：主区域横向布局 */
.practice-main {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
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
  display: flex;
  align-items: center;
  gap: 6px;
}
.records-title { color: #409eff; }
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
  gap: 8px;
}
.q-index { font-weight: 600; color: #303133; }
.answered-count { color: #909399; font-size: 13px; }

/* 新增：难度标识 */
.difficulty-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid;
}
.diff-dots { display: inline-flex; gap: 2px; }
.diff-dots i {
  width: 5px; height: 5px; border-radius: 50%;
  background: currentColor; opacity: 0.25;
  &.on { opacity: 1; }
}

/* 新增：收藏按钮 */
.bookmark-btn { transition: all 0.2s; }
.bookmark-btn:hover { transform: scale(1.1); }

/* 新增：知识点标签 */
.knowledge-points {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 18px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
  border-left: 3px solid #409eff;
}
.kp-icon { color: #409eff; font-size: 14px; }
.kp-label { font-size: 12px; color: #909399; }
.kp-tag { font-size: 12px; }

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
  align-items: center;
  gap: 12px;
}
.footer-mid { display: flex; gap: 12px; }
.footer-right { display: flex; gap: 12px; }

/* 新增：练习记录侧栏 */
.records-panel {
  width: 240px;
  background: #fff;
  border-radius: 6px;
  padding: 12px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.record-item {
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #fafcff 0%, #f5f7fa 100%);
  border: 1px solid #f0f2f5;
  transition: all 0.2s;
  &:hover { box-shadow: 0 2px 10px rgba(64, 158, 255, 0.12); transform: translateX(-2px); }
}
.ri-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.ri-cat { font-size: 13px; font-weight: 600; color: #303133; }
.ri-score { font-size: 15px; font-weight: 700; }
.ri-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: #909399;
  margin-bottom: 6px;
  span { display: inline-flex; align-items: center; gap: 3px; }
}
.ri-bar {
  height: 4px;
  background: #ebeef5;
  border-radius: 2px;
  overflow: hidden;
}
.ri-bar-correct { height: 100%; border-radius: 2px; transition: width 0.4s; }

/* 侧栏收起过渡 */
.slide-fade-enter-active, .slide-fade-leave-active {
  transition: all 0.28s ease;
}
.slide-fade-enter-from, .slide-fade-leave-to {
  opacity: 0;
  transform: translateX(20px);
  width: 0;
  padding: 0;
  margin: 0;
}

/* 响应式 */
@media (max-width: 1100px) {
  .dashboard-stats { grid-template-columns: repeat(2, 1fr); }
  .records-panel { display: none; }
}
@media (max-width: 768px) {
  .practice-main { flex-direction: column; }
  .left-panel { width: 100%; }
  .dashboard-stats { grid-template-columns: repeat(2, 1fr); }
}
</style>
