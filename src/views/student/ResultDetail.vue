<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getResultDetail, getDimensionAnalysis } from '@/api/student'
import type { ResultDetail as ResultDetailType } from '@/types/result'
import { flattenAnswerUnits, type AnswerReviewItem } from '@/utils/questionUnits'
import type { DimensionAnalysis } from '@/types/stats'
import type { QuestionType, Difficulty } from '@/types/common'
import { getJudgeOptionLabel } from '@/utils/dict'
import PassageCard from '@/components/PassageCard.vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { ArrowLeft, CircleCheck, CircleClose, Clock, PriceTag, Bell, Trophy, Aim } from '@element-plus/icons-vue'
// [2026-10-28] 本行原还导入 EditPen 图标，随「修改 N 次」徽标一并移出（types 层 noUnusedLocals 会拦未使用导入）
// [2026-10-28] 本行原还导入 Flag 图标，随「已标记」标签一并移出（同上）
// [2026-10-28] 原「标记」相关展示整套下线：后端 answer_record.marked_flag 无写入点，恒为 0，
//   该分支与控件永远不可能显示，属答辩现场会被点开的假功能。

use([CanvasRenderer, BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

const route = useRoute()
const router = useRouter()

const resultId = Number(route.params.id)
const detail = ref<ResultDetailType | null>(null)
const answerItems = computed(() => flattenAnswerUnits(detail.value?.answers ?? []))
const dim = ref<DimensionAnalysis | null>(null)
const loading = ref(false)
const dimLoading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const res = await getResultDetail(resultId)
    detail.value = res.data
  } finally {
    loading.value = false
  }
}

const loadDimension = async () => {
  if (!detail.value?.id && !resultId) return
  dimLoading.value = true
  try {
    const res = await getDimensionAnalysis(detail.value?.id || resultId)
    dim.value = res.data
  } catch {
    // 维度分析加载失败不影响主页面
  } finally {
    dimLoading.value = false
  }
}

onMounted(async () => {
  await load()
  loadDimension()
})

const rate = computed(() => {
  const pct = detail.value?.scorePercentage
  if (pct != null) return pct / 100
  const paper = detail.value?.paperTotalScore
  if (paper && detail.value?.totalScore != null) return detail.value.totalScore / paper
  return 0
})
const rateColor = computed(() => rate.value >= 0.8 ? '#67c23a' : rate.value >= 0.6 ? '#e6a23c' : '#f56c6c')
const rateFmt = computed(() =>
  detail.value?.scorePercentage != null
    ? `${detail.value.scorePercentage.toFixed(1)}%`
    : `${(rate.value * 100).toFixed(0)}%`
)

const correctCount = computed(() => detail.value?.correctCount ?? 0)
const wrongCount = computed(() => detail.value?.wrongCount ?? 0)
const totalCount = computed(() => correctCount.value + wrongCount.value)
const accuracy = computed(() => totalCount.value > 0 ? (correctCount.value / totalCount.value * 100).toFixed(1) : '0.0')

const typeLabel = (t: QuestionType) => ({ SINGLE: '单选', MULTIPLE: '多选', JUDGE: '判断', FILL: '填空', FILL_HINT: '填空', READING: '阅读理解' } as Record<QuestionType, string>)[t] || t

/* ============================================================
 *  成绩概览增强
 *  下面这些字段接口本来就返回，只是原页面没有展示：
 *  classRank / totalCount（班级排名）、remainingSeconds（提前交卷）、
 *  断点续考次数（后端已清除该列，不再展示）、paperTotalScore / 题量（每题分值）。
 * ============================================================ */

/** 班级排名：第 N 名 / 共 M 人 */
const rankText = computed(() => {
  const r = detail.value?.classRank
  const t = detail.value?.totalCount
  if (r == null || !t) return '-'
  return `${r} / ${t}`
})

/** 超过班级多少比例的同学（1/4 → 100%） */
const rankBeatPercent = computed(() => {
  const r = detail.value?.classRank
  const t = detail.value?.totalCount
  if (r == null || !t || t <= 1) return null
  return Math.round(((t - r) / (t - 1)) * 100)
})

/** 提前交卷时长（交卷时剩余时间），未提前则为 null */
const earlySubmitText = computed(() => {
  const rest = detail.value?.remainingSeconds
  if (rest == null || rest <= 0) return null
  const m = Math.floor(rest / 60)
  const s = rest % 60
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`
})

/** 平均每题分值，用来解释"错一题大概丢多少分" */
const avgScorePerQuestion = computed(() => {
  const n = totalCount.value
  const total = detail.value?.paperTotalScore
  if (!n || !total) return '-'
  return (total / n).toFixed(1)
})

/** 答题速览：每题一个色块，一眼看出错在第几题 */
const overviewCells = computed(() =>
  answerItems.value.map((a, i) => ({
    no: i + 1,
    questionId: a.questionId,
    ok: a.isCorrect === 1,
    // [2026-10-28] 原 marked 取 answer_record.marked_flag（恒 0），随「标记题」整套下线
  })),
)

const jumpToQuestion = (questionId: number) => {
  const el = document.querySelector<HTMLElement>(`[data-qid="${questionId}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('flash')
  window.setTimeout(() => el.classList.remove('flash'), 1400)
}

/** 明细筛选：全部 / 仅错题 */
const answerFilter = ref<'ALL' | 'WRONG'>('ALL')
// [2026-10-28] 原「标记题数」统计项（依赖 answer_record.marked_flag，该列恒 0）随筛选档位一并下线
const visibleAnswers = computed(() => {
  if (answerFilter.value === 'WRONG') return answerItems.value.filter((a) => a.isCorrect === 0)
  return answerItems.value
})

/** 题号始终取原始序号：筛选后不重新编号，避免"第 1 题"指代错乱 */
const numberOf = (a: AnswerReviewItem) =>
  answerItems.value.findIndex((x) => x.questionId === a.questionId) + 1

/** 语法大类正确率：把维度分析提到首屏，不用滚到页尾才看得到 */
const categoryBars = computed(() =>
  [...(dim.value?.byCategory ?? [])].sort((a, b) => a.accuracy - b.accuracy),
)

/** 同一篇短文只在组首那题上方显示一次，回顾页不必把文章重复贴三遍。
 *  这里按题目对象而非列表下标判断——明细加了筛选后下标会变，用下标会误判组首。 */
const isPassageHead = (answer: AnswerReviewItem) => {
  if (!answer?.passageId) return false
  const list = answerItems.value
  const idx = list.findIndex((x) => x.questionId === answer.questionId)
  return list[idx - 1]?.passageId !== answer.passageId
}

const passageGroupSize = (answer: AnswerReviewItem) => answer.readingGroupSize ?? 0

const difficultyLabel = (d: Difficulty) => {
  if (d === 1) return { text: '简单', color: '#67c23a' }
  if (d === 2) return { text: '中等', color: '#e6a23c' }
  if (d === 3) return { text: '困难', color: '#f56c6c' }
  return { text: '-', color: '#909399' }
}

const answerText = (a: string | undefined | null, type?: QuestionType) => {
  if (a === undefined || a === null || a === '') return '（未作答）'
  if (type === 'JUDGE') return getJudgeOptionLabel(a)
  return a
}

const durationText = computed(() =>
  detail.value?.durationSeconds
    ? `${Math.round(detail.value.durationSeconds / 60)} 分钟 ${detail.value.durationSeconds % 60} 秒`
    : '-'
)

const submitStatusLabel = computed(() => {
  const status = detail.value?.submitStatus
  const scoreReady = detail.value?.totalScore != null
  if (status === 1) {
    // [2026-09-26 新增] 论文 L497「尚未完成阅卷时显示处理中」：
    //   已提交但成绩尚未生成（如阅卷异常暂停后待管理员重新阅卷）→ 处理中
    if (!scoreReady) return { text: '处理中', color: '#e6a23c' }
    return { text: '正常提交', color: '#67c23a' }
  }
  if (status === 2) return { text: '超时提交', color: '#f56c6c' }
  return { text: '未提交', color: '#909399' }
})

// [2026-10-28] 原「逐题用时」格式化函数已删除（它渲染 answer_record.spent_time_seconds，该列无写入点恒 NULL）：
//   本文件内确认无其它调用者后随「答题用时」整块下线。

// 判断选项是否是用户选择的
const isUserSelected = (optionLabel: string, userAnswer?: string, questionType?: QuestionType) => {
  if (!userAnswer || !optionLabel) return false
  if (questionType === 'MULTIPLE') {
    return userAnswer.split(',').includes(optionLabel)
  }
  return userAnswer === optionLabel
}

// 判断选项是否是正确答案
const isCorrectOption = (optionLabel: string, standardAnswer?: string, questionType?: QuestionType) => {
  if (!standardAnswer || !optionLabel) return false
  if (questionType === 'MULTIPLE') {
    return standardAnswer.split(',').includes(optionLabel)
  }
  return standardAnswer === optionLabel
}

// ===== 维度分析图表 =====

const dimTagChartOption = computed(() => {
  const list = dim.value?.byTag ?? []
  if (!list.length) return {}
  const sorted = [...list].sort((a, b) => a.accuracy - b.accuracy)
  return {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (p: any) => {
        const d = p[0]; const item = sorted[d.dataIndex]
        if (!item) return ''
        return `${item.tagName}<br/>正确率：${item.accuracy.toFixed(1)}%（${item.correct}/${item.total}）`
      },
    },
    grid: { left: 120, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category' as const, data: sorted.map(t => t.tagName), axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar', data: sorted.map(t => t.accuracy),
      itemStyle: { color: (p: any) => (p.value ?? 0) >= 60 ? '#67c23a' : '#f56c6c' },
      barMaxWidth: 24,
    }],
  }
})

const dimCategoryChartOption = computed(() => {
  const list = dim.value?.byCategory ?? []
  if (!list.length) return {}
  const sorted = [...list].sort((a, b) => a.accuracy - b.accuracy)
  return {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (p: any) => {
        const d = p[0]; const item = sorted[d.dataIndex]
        if (!item) return ''
        return `${item.categoryName}<br/>正确率：${item.accuracy.toFixed(1)}%（${item.correct}/${item.total}）`
      },
    },
    grid: { left: 100, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category' as const, data: sorted.map(c => c.categoryName), axisLabel: { fontSize: 12 } },
    series: [{
      type: 'bar', data: sorted.map(c => c.accuracy),
      itemStyle: { color: (p: any) => (p.value ?? 0) >= 60 ? '#67c23a' : '#f56c6c' },
      barMaxWidth: 28,
    }],
  }
})

const dimDifficultyChartOption = computed(() => {
  const list = dim.value?.byDifficulty ?? []
  if (!list.length) return {}
  const sorted = [...list].sort((a, b) => a.difficulty - b.difficulty)
  return {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (p: any) => {
        const d = p[0]; const item = sorted[d.dataIndex]
        if (!item) return ''
        return `${item.difficultyLabel}<br/>正确率：${item.accuracy.toFixed(1)}%（${item.correct}/${item.total}）`
      },
    },
    grid: { left: 50, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'category' as const, data: sorted.map(d => d.difficultyLabel) },
    yAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{
      type: 'bar', data: sorted.map(d => d.accuracy),
      itemStyle: { color: (p: any) => (p.value ?? 0) >= 60 ? '#67c23a' : '#f56c6c' },
      barMaxWidth: 48,
    }],
  }
})
</script>

<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <el-button link @click="router.back()"><el-icon :size="20"><ArrowLeft /></el-icon>返回</el-button>
      <div class="title-block">
        <h3 class="page-title">{{ detail?.sessionName || '成绩详情' }}</h3>
        <div class="title-sub" v-if="detail">
          <span>{{ detail.paperName || '—' }}</span>
          <span class="dot">·</span>
          <span>共 {{ totalCount }} 题</span>
          <span class="dot">·</span>
          <span>满分 {{ detail.paperTotalScore ?? '-' }}</span>
          <span class="dot">·</span>
          <span>每题均 {{ avgScorePerQuestion }} 分</span>
        </div>
      </div>
    </div>

    <!-- 状态横幅提示（对齐论文 UC05/UC07 异常处理与答案安全公布） -->
    <div v-if="detail" style="margin-bottom: 16px">
      <el-alert
        v-if="detail.submitStatus === 2 && (detail.totalScore === 0 || detail.wrongCount === totalCount)"
        type="warning"
        show-icon
        :closable="false"
        title="缺考 / 超时未提交"
        description="本场考试已超时截止，系统已按超时提交（缺考）自动完成结算，未作答题目计 0 分。"
        style="margin-bottom: 10px"
      />
      <el-alert
        v-if="detail.isAnswerPublished === false"
        type="info"
        show-icon
        :closable="false"
        title="标准答案与逐题解析未到公开时间"
        :description="`本场考试标准答案与逐题解析将于 ${detail.answerPublishTime || '场次公布时间'} 公开。依据论文 UC07 §4.1.5 安全规范，公开时间前仅展示得分与状态，不公开试卷题目与解析，防止试题泄露。`"
        style="margin-bottom: 10px"
      />
    </div>

    <!-- 汇总卡片 -->
    <div class="summary-section" v-if="detail">
      <div class="score-card">
        <div class="score-main">
          <div class="score-value" :style="{ color: rateColor }">{{ detail.totalScore }}</div>
          <div class="score-divider">/</div>
          <div class="score-total">{{ detail.paperTotalScore ?? '-' }}</div>
        </div>
        <div class="score-badge" :style="{ backgroundColor: rateColor + '20', color: rateColor }">
          <span class="score-percent">{{ rateFmt }}</span>
          <span class="score-label">百分制</span>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-icon correct"><el-icon><CircleCheck /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value correct">{{ correctCount }}</div>
            <div class="stat-label">答对</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon wrong"><el-icon><CircleClose /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value wrong">{{ wrongCount }}</div>
            <div class="stat-label">答错</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon accuracy"><el-icon><Aim /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ accuracy }}%</div>
            <div class="stat-label">正确率</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon duration"><el-icon><Clock /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ durationText }}</div>
            <div class="stat-label">考试用时</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon rank"><el-icon><Trophy /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ rankText }}</div>
            <div class="stat-label">班级排名</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon status"><el-icon><Bell /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value" :style="{ color: submitStatusLabel.color }">{{ submitStatusLabel.text }}</div>
            <div class="stat-label">提交状态</div>
          </div>
        </div>
      </div>

      <div class="meta-row">
        <span class="meta-item">
          <span class="meta-icon"><Clock /></span>
          <span class="meta-label">开始时间：</span>
          <span class="meta-value">{{ detail.startTime || '-' }}</span>
        </span>
        <span class="meta-item">
          <span class="meta-icon"><Clock /></span>
          <span class="meta-label">提交时间：</span>
          <span class="meta-value">{{ detail.submitTime || '-' }}</span>
        </span>
        <span class="meta-item" v-if="earlySubmitText">
          <span class="meta-icon"><Clock /></span>
          <span class="meta-label">提前交卷：</span>
          <span class="meta-value early">{{ earlySubmitText }}</span>
        </span>
        <!-- [2026-10-28] 后端 exam_record.resume_count 列已清除，原「断点续考：N 次」元信息整块删除
             （该块带 v-if，字段消失后本就恒不渲染，删除属行为等价）。 -->
        <span class="meta-item" v-if="rankBeatPercent !== null">
          <span class="meta-icon"><Trophy /></span>
          <span class="meta-label">排名位置：</span>
          <span class="meta-value">超过班级 {{ rankBeatPercent }}% 的同学</span>
        </span>
      </div>
    </div>

    <!-- ===== 答题概览：速览网格 + 语法大类正确率 ===== -->
    <div class="overview-section" v-if="detail?.answers?.length">
      <div class="ov-head">
        <h4 class="ov-title">🎯 答题概览</h4>
        <div class="ov-legend">
          <span class="lg ok">正确 {{ correctCount }}</span>
          <span class="lg ng">错误 {{ wrongCount }}</span>
          <!-- [2026-10-28] 原「标记 N」图例带 v-if="标记数"，而 answer_record.marked_flag 恒 0 ⇒ 该块永不渲染，整行删除 -->
        </div>
      </div>

      <div class="ov-body">
        <div class="ov-grid-wrap">
          <div class="ov-grid">
            <div
              v-for="c in overviewCells"
              :key="c.questionId"
              class="ov-cell"
              :class="{ ok: c.ok, ng: !c.ok }"
              :title="`第 ${c.no} 题 · ${c.ok ? '正确' : '错误'}（点击定位）`"
              @click="jumpToQuestion(c.questionId)"
            >
              {{ c.no }}
            </div>
          </div>
          <div class="ov-hint">点击题号定位到下方题目</div>
        </div>

        <div class="ov-cats" v-if="categoryBars.length">
          <div class="ov-cats-title">语法大类正确率</div>
          <div v-for="c in categoryBars" :key="c.categoryId" class="cat-row">
            <span class="cat-name">{{ c.categoryName }}</span>
            <div class="cat-bar">
              <div
                class="cat-bar-fill"
                :style="{
                  width: Math.min(c.accuracy, 100) + '%',
                  background: c.accuracy >= 80 ? '#67c23a' : c.accuracy >= 60 ? '#e6a23c' : '#f56c6c',
                }"
              ></div>
            </div>
            <span class="cat-val">{{ c.correct }}/{{ c.total }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 逐题明细 -->
    <div class="answers" v-if="detail?.answers?.length">
      <div class="answers-header">
        <h4 class="answers-title">📝 答题明细</h4>
        <div class="answers-tools">
          <el-radio-group v-model="answerFilter">
            <el-radio-button value="ALL">全部 {{ answerItems.length }}</el-radio-button>
            <el-radio-button value="WRONG">仅错题 {{ wrongCount }}</el-radio-button>
            <!-- [2026-10-28] 原「仅标记」档位 :disabled 依赖恒 0 的 marked_flag 计数，按钮恒灰且永不生效，删除 -->
          </el-radio-group>
        </div>
      </div>

      <el-empty
        v-if="!visibleAnswers.length"
        description="本场考试没有错题 🎉"
        :image-size="90"
      />
      <!-- [2026-10-28] 本行原为三元文案：筛选值为标记档时显示「本卷没有标记的题目」，随该档位删除 -->

      <div
        v-for="a in visibleAnswers"
        :key="a.questionId"
        class="answer-card"
        :data-qid="a.questionId"
        :class="{ ok: a.isCorrect === 1, ng: a.isCorrect === 0 }"
      >
        <!-- 题目头部 -->
        <div class="q-head">
          <div class="q-left">
            <span class="q-idx" :class="{ ok: a.isCorrect === 1, ng: a.isCorrect === 0 }">
              <el-icon><CircleCheck v-if="a.isCorrect === 1" /><CircleClose v-else /></el-icon>
              第 {{ numberOf(a) }} 题
            </span>
            <el-tag class="q-type">{{ typeLabel(a.questionType) }}</el-tag>
            <el-tag class="q-difficulty" :style="{ backgroundColor: difficultyLabel(a.difficulty || 2).color + '15', color: difficultyLabel(a.difficulty || 2).color, borderColor: difficultyLabel(a.difficulty || 2).color + '30' }">
              {{ difficultyLabel(a.difficulty || 2).text }}
            </el-tag>
            <!-- [2026-10-28] 原此处渲染「已标记」warning 标签（v-if 判 answer_record.marked_flag === 1），
                 该列后端无写入点恒 0 ⇒ 标签永不出现，整块删除 -->
          </div>
          <div class="q-right">
            <span class="q-loss" v-if="a.isCorrect === 0">失 {{ a.questionScore ?? 0 }} 分</span>
            <span class="q-score">
              <span :class="a.isCorrect === 1 ? 'ok-text' : 'ng-text'">{{ a.obtainedScore ?? 0 }}</span>
              <span class="score-separator">/</span>
              <span class="score-total">{{ a.questionScore ?? 0 }}</span>
              <span class="score-unit">分</span>
            </span>
          </div>
        </div>

        <!-- 阅读理解：回顾要带上当时的文章 -->
        <PassageCard
          v-if="a.passageContent && isPassageHead(a)"
          :content="a.passageContent"
          :title="a.passageTitle"
          :word-count="a.passageWordCount"
          :group-total="passageGroupSize(a)"
          :group-score="a.readingGroupScore"
        />

        <!-- 题干 -->
        <div class="q-stem">{{ a.stem }}</div>

        <!-- 选项列表 -->
        <div v-if="a.options?.length" class="opts">
          <div
            v-for="op in a.options"
            :key="op.optionLabel"
            class="opt"
            :class="{
              correct: isCorrectOption(op.optionLabel, a.standardAnswer, a.questionType),
              user: isUserSelected(op.optionLabel, a.userAnswer, a.questionType),
              wrong: isUserSelected(op.optionLabel, a.userAnswer, a.questionType) && !isCorrectOption(op.optionLabel, a.standardAnswer, a.questionType)
            }"
          >
            <span class="opt-key">{{ op.optionLabel }}.</span>
            <span class="opt-content">{{ op.optionContent }}</span>
            <el-icon v-if="isCorrectOption(op.optionLabel, a.standardAnswer, a.questionType)" class="opt-icon correct"><CircleCheck /></el-icon>
            <el-icon v-else-if="isUserSelected(op.optionLabel, a.userAnswer, a.questionType)" class="opt-icon wrong"><CircleClose /></el-icon>
          </div>
        </div>

        <!-- 答案对比 -->
        <div class="answer-compare">
          <div class="compare-item">
            <span class="compare-label">你的答案：</span>
            <span :class="a.isCorrect === 1 ? 'ok-text' : 'ng-text'">{{ answerText(a.userAnswer, a.questionType) }}</span>
            <!-- [2026-10-28] 后端 answer_record.modify_count 列已清除且无替代来源（决策 D-C：删展示），
                 原「修改 N 次」徽标整块删除。该块带 v-if>0 判据，字段消失后本就恒不渲染，属行为等价。
                 对应样式 .modify-badge 按契约「不改样式」条款保留未删。 -->
          </div>
          <div class="compare-item">
            <span class="compare-label">正确答案：</span>
            <span class="ok-text">{{ answerText(a.standardAnswer, a.questionType) }}</span>
          </div>
          <!-- [2026-10-28] 原此处另有「答题用时」compare-item（v-if 判 answer_record.spent_time_seconds，
               随 spent_time_text 格式化函数一并删除）：该列后端无写入点恒 NULL ⇒ 整块永不渲染 -->
        </div>

        <!-- 解析 -->
        <div class="analysis-box" v-if="a.analysis">
          <div class="analysis-header">
            <el-icon><PriceTag /></el-icon>
            <span>答案解析</span>
          </div>
          <div class="analysis-content">{{ a.analysis }}</div>
        </div>
      </div>
    </div>

    <!-- 多维度分析 -->
    <div class="dim-section" v-if="dim && (dim.byTag?.length || dim.byCategory?.length || dim.byDifficulty?.length)" v-loading="dimLoading">
      <h4 class="dim-title">📊 多维度分析</h4>

      <el-row :gutter="16">
        <el-col :span="12" v-if="dim.byCategory?.length">
          <el-card shadow="never" class="dim-card">
            <template #header>按语法大类</template>
            <VChart :option="dimCategoryChartOption" autoresize style="height: 260px" />
          </el-card>
        </el-col>
        <el-col :span="12" v-if="dim.byDifficulty?.length">
          <el-card shadow="never" class="dim-card">
            <template #header>按难度</template>
            <VChart :option="dimDifficultyChartOption" autoresize style="height: 240px" />
          </el-card>
        </el-col>
      </el-row>

      <el-card shadow="never" class="dim-card" v-if="dim.byTag?.length" style="margin-top:14px">
        <template #header>按考点标签</template>
        <VChart :option="dimTagChartOption" autoresize style="height: 300px" />
      </el-card>

      <el-card shadow="never" class="dim-card" v-if="dim.byQuestionType?.length" style="margin-top:14px">
        <template #header>按题型</template>
        <el-table :data="dim.byQuestionType">
          <el-table-column prop="questionTypeLabel" label="题型" width="140" />
          <el-table-column prop="total" label="总题数" width="100" align="center" />
          <el-table-column prop="correct" label="答对" width="80" align="center">
            <template #default="{ row }"><span style="color:#67c23a;font-weight:600">{{ row.correct }}</span></template>
          </el-table-column>
          <el-table-column prop="wrong" label="答错" width="80" align="center">
            <template #default="{ row }"><span style="color:#f56c6c;font-weight:600">{{ row.wrong }}</span></template>
          </el-table-column>
          <el-table-column label="正确率" min-width="150">
            <template #default="{ row }">
              <el-progress
                :percentage="Math.min(row.accuracy, 100)"
                :color="row.accuracy >= 80 ? '#67c23a' : row.accuracy >= 60 ? '#e6a23c' : '#f56c6c'"
                :stroke-width="14"
              />
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 阅读子题型：看清「细节找得到但主旨推不出」这类结构性弱点（只统计带子题型的阅读题） -->
      <el-card shadow="never" class="dim-card" v-if="dim.bySubtype?.length" style="margin-top:14px">
        <template #header>阅读子题型</template>
        <el-table :data="dim.bySubtype">
          <el-table-column prop="subtypeLabel" label="子题型" width="140" />
          <el-table-column prop="total" label="总题数" width="100" align="center" />
          <el-table-column prop="correct" label="答对" width="80" align="center">
            <template #default="{ row }"><span style="color:#67c23a;font-weight:600">{{ row.correct }}</span></template>
          </el-table-column>
          <el-table-column prop="wrong" label="答错" width="80" align="center">
            <template #default="{ row }"><span style="color:#f56c6c;font-weight:600">{{ row.wrong }}</span></template>
          </el-table-column>
          <el-table-column label="正确率" min-width="150">
            <template #default="{ row }">
              <el-progress
                :percentage="Math.min(row.accuracy, 100)"
                :color="row.accuracy >= 80 ? '#67c23a' : row.accuracy >= 60 ? '#e6a23c' : '#f56c6c'"
                :stroke-width="14"
              />
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <el-empty v-else-if="!loading" description="暂无答题明细" />
  </div>
</template>

<style scoped lang="scss">
.page-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 20px; font-weight: 600; color: #303133; }

.title-block { display: flex; flex-direction: column; gap: 4px; }
.title-sub {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
  font-size: 13px; color: #909399;
  .dot { color: #dcdfe6; }
}

// ===== 汇总区域 =====
.summary-section {
  background: #fff; border-radius: 12px; padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  margin-bottom: 20px;
}

.score-card {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 20px; border-bottom: 1px solid #f0f0f0;
  margin-bottom: 20px;
}

.score-main {
  display: flex; align-items: baseline; gap: 8px;
}

.score-value { font-size: 56px; font-weight: 700; line-height: 1; }
.score-divider { font-size: 24px; color: #dcdfe6; }
.score-total { font-size: 24px; color: #909399; }

.score-badge {
  display: flex; flex-direction: column; align-items: center;
  padding: 12px 24px; border-radius: 12px;
}

.score-percent { font-size: 28px; font-weight: 700; }
.score-label { font-size: 12px; opacity: 0.8; }

.stats-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px; margin-bottom: 16px;
}

.stat-item {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; background: #fafafa; border-radius: 8px;
}

.stat-icon {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  &.correct { background: #f0f9eb; color: #67c23a; }
  &.wrong { background: #fef0f0; color: #f56c6c; }
  &.accuracy { background: #ecf5ff; color: #409eff; }
  &.duration { background: #fdf6ec; color: #e6a23c; }
  &.paper { background: #f0f9eb; color: #67c23a; }
  &.rank { background: #fdf6ec; color: #e6a23c; }
  &.status { background: #fafafa; color: #909399; }
}

.stat-info { display: flex; flex-direction: column; gap: 2px; }
.stat-value { font-size: 18px; font-weight: 600; color: #303133; }
.stat-value.correct { color: #67c23a; }
.stat-value.wrong { color: #f56c6c; }
.stat-label { font-size: 12px; color: #909399; }

.meta-row {
  display: flex; flex-wrap: wrap; gap: 24px; padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.meta-item {
  display: flex; align-items: center; gap: 4px; font-size: 13px;
}

.meta-icon { font-size: 14px; color: #909399; }
.meta-label { color: #909399; }
.meta-value { color: #303133; }
.meta-value.early { color: #67c23a; font-weight: 600; }

// ===== 答题概览 =====
.overview-section {
  background: #fff; border-radius: 12px; padding: 20px 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-bottom: 20px;
}

.ov-head {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 10px; margin-bottom: 16px;
}

.ov-title { margin: 0; font-size: 16px; font-weight: 600; color: #303133; }

.ov-legend { display: flex; gap: 8px; }
.lg {
  padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500;
  &.ok { background: #f0f9eb; color: #67c23a; }
  &.ng { background: #fef0f0; color: #f56c6c; }
  &.mk { background: #fdf6ec; color: #e6a23c; }
}

.ov-body { display: flex; gap: 28px; flex-wrap: wrap; }

.ov-grid-wrap { flex: 1 1 380px; min-width: 300px; }

.ov-grid { display: flex; flex-wrap: wrap; gap: 8px; }

.ov-cell {
  width: 38px; height: 38px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600; cursor: pointer;
  border: 1px solid transparent; transition: all 0.15s;
  &.ok { background: #f0f9eb; color: #529b2e; border-color: #c2e7b0; }
  &.ng { background: #fef0f0; color: #c45656; border-color: #fab6b6; }
  /* [2026-10-28] 原 &.marked 橙色虚线描边规则随标记题整套下线（对应类名不再产生） */
  &:hover { transform: translateY(-2px); box-shadow: 0 3px 8px rgba(0,0,0,0.12); }
}

.ov-hint { margin-top: 10px; font-size: 12px; color: #b1b3b8; }

.ov-cats { flex: 1 1 300px; min-width: 260px; }

.ov-cats-title { font-size: 13px; font-weight: 600; color: #606266; margin-bottom: 10px; }

.cat-row {
  display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 13px;
}

.cat-name { width: 88px; flex: none; color: #606266; text-align: right; }

.cat-bar {
  flex: 1; height: 10px; background: #f0f2f5; border-radius: 5px; overflow: hidden;
}

.cat-bar-fill { height: 100%; border-radius: 5px; transition: width 0.4s ease; }

.cat-val { width: 44px; flex: none; color: #909399; font-size: 12px; }

// ===== 答题明细 =====
.answers-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}

.answers-title { margin: 0; font-size: 18px; font-weight: 600; color: #303133; }

.answers-tools { display: flex; gap: 8px; }

.answers { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }

.answer-card {
  background: #fff; border-radius: 12px; padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  border-left: 4px solid #dcdfe6;
  transition: box-shadow 0.2s, background-color 0.6s;
  &:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
  &.flash { background-color: #fdf6ec; }
}

.answer-card.ok { border-left-color: #67c23a; }
.answer-card.ng { border-left-color: #f56c6c; }

.q-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}

.q-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.q-idx {
  display: inline-flex; align-items: center; gap: 4px;
  font-weight: 600; font-size: 15px;
  &.ok { color: #67c23a; }
  &.ng { color: #f56c6c; }
}

.q-type { background: #ecf5ff; color: #409eff; border: none; }
.q-difficulty { border: none; }

.q-right { display: flex; align-items: center; gap: 10px; }

.q-loss {
  padding: 2px 8px; border-radius: 10px;
  background: #fef0f0; color: #f56c6c;
  font-size: 12px; font-weight: 600;
}

.q-score {
  display: flex; align-items: baseline; gap: 4px; font-size: 16px;
}

.score-separator { color: #dcdfe6; }
.score-total { color: #909399; }
.score-unit { font-size: 12px; color: #909399; margin-left: 2px; }

.q-stem {
  font-size: 15px; line-height: 1.8; color: #303133;
  margin-bottom: 16px; white-space: pre-wrap;
}

.opts {
  display: flex; flex-direction: column; gap: 8px;
  margin-bottom: 16px; padding: 12px; background: #fafafa; border-radius: 8px;
}

.opt {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; background: #fff; border-radius: 6px;
  font-size: 14px; color: #606266;
  border: 1px solid transparent;
  transition: all 0.2s;

  &.correct {
    background: #f0f9eb; border-color: #67c23a;
    .opt-key { color: #67c23a; font-weight: 700; }
  }

  &.wrong {
    background: #fef0f0; border-color: #f56c6c;
    .opt-key { color: #f56c6c; font-weight: 700; }
  }

  &.user:not(.wrong) {
    background: #ecf5ff; border-color: #409eff;
    .opt-key { color: #409eff; font-weight: 700; }
  }
}

.opt-key { font-weight: 600; color: #409eff; }
.opt-content { flex: 1; }

.opt-icon {
  font-size: 16px;
  &.correct { color: #67c23a; }
  &.wrong { color: #f56c6c; }
}

.answer-compare {
  display: flex; flex-wrap: wrap; gap: 16px;
  padding: 12px 16px; background: #fafafa; border-radius: 8px;
  margin-bottom: 12px;
}

.compare-item {
  display: flex; align-items: center; gap: 4px; font-size: 14px;
}

.compare-label { color: #909399; }
.time-text { color: #409eff; }

.modify-badge {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 2px 8px; background: #fdf6ec; color: #e6a23c;
  border-radius: 10px; font-size: 12px; margin-left: 8px;
}

.ok-text { color: #67c23a; font-weight: 600; }
.ng-text { color: #f56c6c; font-weight: 600; }

.analysis-box {
  background: #f0f9eb; border-radius: 8px; padding: 12px 16px;
  border-left: 3px solid #67c23a;
}

.analysis-header {
  display: flex; align-items: center; gap: 6px;
  font-size: 14px; font-weight: 600; color: #67c23a;
  margin-bottom: 8px;
}

.analysis-content {
  font-size: 14px; line-height: 1.8; color: #606266;
  white-space: pre-wrap;
}

// ===== 多维度分析 =====
.dim-section { margin-top: 20px; }
.dim-title { margin: 0 0 14px; font-size: 16px; font-weight: 600; color: #303133; }

.dim-card {
  border-radius: 8px;
  :deep(.el-card__header) { font-weight: 600; font-size: 14px; padding: 12px 16px; }
  :deep(.el-card__body) { padding: 12px; }
}
</style>
