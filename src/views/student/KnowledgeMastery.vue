<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getStudentMastery, getStudentInsights } from '@/api/knowledgeMastery'
import type { KnowledgeMastery as KM, KnowledgeInsights } from '@/types/knowledgeMastery'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { RadarChart, PieChart, BarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, RadarComponent, GridComponent } from 'echarts/components'
import { DataAnalysis, Aim, Grid, List } from '@element-plus/icons-vue'

use([
  CanvasRenderer, RadarChart, PieChart, BarChart,
  TitleComponent, TooltipComponent, LegendComponent, RadarComponent, GridComponent,
])

const authStore = useAuthStore()
const data = ref<KM[]>([])
const insights = ref<KnowledgeInsights | null>(null)
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const uid = authStore.userInfo?.id
    if (!uid) return
    const [m, i] = await Promise.all([
      getStudentMastery(uid),
      getStudentInsights(uid).catch(() => null),
    ])
    data.value = m.data ?? []
    insights.value = i?.data ?? null
  } finally { loading.value = false }
}

onMounted(load)

/* ============================================================
 *  视图模式：分类视图（按语法专题分页签） / 拍平视图（全部平铺）
 *  数据全部来自现有表，未新增数据库列。
 * ============================================================ */
type ViewMode = 'category' | 'flat'
const viewMode = ref<ViewMode>('category')
const activeCat = ref<string>('__all__')

/* ---------------- 概览指标 ---------------- */
const overview = computed(() => {
  const rows = data.value
  const total = rows.length
  const mastered = rows.filter(d => d.masteryLevel >= 4).length
  const weak = rows.filter(d => d.masteryLevel > 0 && d.masteryLevel <= 2).length
  const avgScore = total ? rows.reduce((s, d) => s + (d.proficiencyScore ?? 0), 0) / total : 0
  const avgAccuracy = total ? rows.reduce((s, d) => s + (d.accuracy ?? 0), 0) / total : 0
  return {
    total, mastered, weak,
    avgScore: Math.round(avgScore * 10) / 10,
    avgAccuracy: Math.round(avgAccuracy * 10) / 10,
    coverage: insights.value?.coverage?.percent ?? 0,
    neverTouched: insights.value?.coverage?.neverTouched ?? 0,
  }
})

/* ---------------- 按语法专题分组（键用 categoryId，名称有重名） ---------------- */
interface CategoryGroup {
  key: string; id: number | null; name: string; count: number
  avgScore: number; avgAccuracy: number; totalAnswers: number; weakCount: number
  items: KM[]
}

const categoryGroups = computed<CategoryGroup[]>(() => {
  if (!data.value.length) return []
  const map = new Map<string, CategoryGroup>()
  data.value.forEach(d => {
    const id = d.categoryId ?? null
    const name = d.categoryName || '未分类'
    const key = id != null ? `c-${id}` : `n-${name}`
    if (!map.has(key)) {
      map.set(key, { key, id, name, count: 0, avgScore: 0, avgAccuracy: 0, totalAnswers: 0, weakCount: 0, items: [] })
    }
    const g = map.get(key)!
    g.items.push(d); g.count += 1; g.totalAnswers += d.totalAnswers
    if (d.masteryLevel > 0 && d.masteryLevel <= 2) g.weakCount += 1
  })
  return Array.from(map.values()).map(g => ({
    ...g,
    avgScore: Math.round(g.items.reduce((s, d) => s + (d.proficiencyScore ?? 0), 0) / g.count * 10) / 10,
    avgAccuracy: Math.round(g.items.reduce((s, d) => s + (d.accuracy ?? 0), 0) / g.count * 10) / 10,
    items: [...g.items].sort((a, b) => (a.proficiencyScore ?? 0) - (b.proficiencyScore ?? 0)),
  })).sort((a, b) => b.count - a.count)
})

const currentGroup = computed<CategoryGroup | null>(() =>
  activeCat.value === '__all__' ? null : categoryGroups.value.find(g => g.key === activeCat.value) ?? null
)

const ensureActiveCat = () => {
  if (activeCat.value !== '__all__' && !categoryGroups.value.some(g => g.key === activeCat.value)) {
    activeCat.value = '__all__'
  }
}

/* ---------------- 拍平视图：筛选 + 排序 ---------------- */
const flatLevel = ref<string>('all')
const flatCat = ref<string>('all')
const flatSort = ref<string>('score-asc')
const flatKeyword = ref('')

const levelFilterOptions = [
  { label: '全部等级', value: 'all' },
  { label: '未接触(0)', value: '0' },
  { label: '入门(1)', value: '1' },
  { label: '基础(2)', value: '2' },
  { label: '进阶(3)', value: '3' },
  { label: '熟练(4)', value: '4' },
  { label: '精通(5)', value: '5' },
]

const sortOptions = [
  { label: '熟练度 低→高', value: 'score-asc' },
  { label: '熟练度 高→低', value: 'score-desc' },
  { label: '正确率 低→高', value: 'acc-asc' },
  { label: '正确率 高→低', value: 'acc-desc' },
  { label: '答题量 多→少', value: 'ans-desc' },
  { label: '最近练习 新→旧', value: 'time-desc' },
]

const flatRows = computed<KM[]>(() => {
  let rows = data.value
  if (flatLevel.value !== 'all') {
    const lv = Number(flatLevel.value)
    rows = rows.filter(d => d.masteryLevel === lv)
  }
  if (flatCat.value !== 'all') {
    rows = rows.filter(d => String(d.categoryId ?? 'none') === flatCat.value)
  }
  const kw = flatKeyword.value.trim()
  if (kw) rows = rows.filter(d => (d.tagName ?? '').includes(kw))

  const sorted = [...rows]
  switch (flatSort.value) {
    case 'score-asc': sorted.sort((a, b) => (a.proficiencyScore ?? 0) - (b.proficiencyScore ?? 0)); break
    case 'score-desc': sorted.sort((a, b) => (b.proficiencyScore ?? 0) - (a.proficiencyScore ?? 0)); break
    case 'acc-asc': sorted.sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0)); break
    case 'acc-desc': sorted.sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0)); break
    case 'ans-desc': sorted.sort((a, b) => b.totalAnswers - a.totalAnswers); break
    case 'time-desc': sorted.sort((a, b) => (b.lastPracticeTime ?? '').localeCompare(a.lastPracticeTime ?? '')); break
  }
  return sorted
})

/* ---------------- 图表：雷达（最弱 8 项） ---------------- */
const radarChartOption = computed(() => {
  if (!data.value.length) return {}
  const top = [...data.value].sort((a, b) => (a.proficiencyScore ?? 0) - (b.proficiencyScore ?? 0)).slice(0, 8)
  return {
    tooltip: { trigger: 'item' as const },
    radar: {
      indicator: top.map(d => ({
        name: (d.tagName ?? '').length > 6 ? (d.tagName ?? '').substring(0, 6) + '…' : (d.tagName ?? ''),
        max: 100,
      })),
      shape: 'polygon' as const,
      splitNumber: 5,
      center: ['50%', '52%'],
      radius: '62%',
      axisName: { color: '#606266', fontSize: 11 },
      splitLine: { lineStyle: { color: ['#f56c6c', '#e6a23c', '#e6a23c', '#67c23a', '#67c23a'] } },
      splitArea: {
        areaStyle: { color: ['rgba(245,108,108,0.06)', 'rgba(230,162,60,0.06)', 'rgba(230,162,60,0.04)', 'rgba(103,194,58,0.04)', 'rgba(103,194,58,0.06)'] },
      },
      axisLine: { lineStyle: { color: '#dcdfe6' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: top.map(d => d.proficiencyScore ?? 0),
        name: '掌握度',
        areaStyle: { color: 'rgba(64,158,255,0.25)' },
        lineStyle: { color: '#409eff', width: 2 },
        itemStyle: { color: '#409eff' },
      }],
    }],
  }
})

/* ---------------- 图表：掌握等级分布（6 档饼图） ---------------- */
const levelPieOption = computed(() => {
  const rows = insights.value?.levelDistribution ?? []
  const colors = ['#909399', '#F56C6C', '#E6A23C', '#409EFF', '#67C23A', '#00D100']
  return {
    tooltip: { trigger: 'item' as const, formatter: '{b}<br/>{c} 个（{d}%）' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['42%', '66%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: true,
      label: { show: true, formatter: '{c}', fontSize: 11 },
      data: rows.map((r, i) => ({
        name: r.label, value: r.count, itemStyle: { color: colors[i] ?? '#c0c4cc' },
      })),
    }],
  }
})

/* ---------------- 图表：熟练度分档（柱状图） ---------------- */
const bandBarOption = computed(() => {
  const rows = insights.value?.scoreBands ?? []
  const colors = ['#F56C6C', '#E6A23C', '#F0C040', '#409EFF', '#67C23A']
  return {
    tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
    grid: { left: 12, right: 16, top: 20, bottom: 8, containLabel: true },
    xAxis: { type: 'category' as const, data: rows.map(r => r.label), axisLabel: { fontSize: 10, interval: 0 } },
    yAxis: { type: 'value' as const, minInterval: 1 },
    series: [{
      type: 'bar',
      barMaxWidth: 38,
      data: rows.map((r, i) => ({ value: r.count, itemStyle: { color: colors[i] ?? '#c0c4cc', borderRadius: [4, 4, 0, 0] } })),
      label: { show: true, position: 'top' as const, fontSize: 11 },
    }],
  }
})

/* ---------------- 图表：练习活跃度（环形） ---------------- */
const activityPieOption = computed(() => {
  const a = insights.value?.activity
  const rows = a
    ? [
        { name: '7 天内', value: a.within7, color: '#67C23A' },
        { name: '8-30 天', value: Math.max(0, a.within30 - a.within7), color: '#409EFF' },
        { name: '30 天前', value: a.older, color: '#E6A23C' },
        { name: '从未练习', value: a.never, color: '#C0C4CC' },
      ]
    : []
  return {
    tooltip: { trigger: 'item' as const, formatter: '{b}<br/>{c} 个（{d}%）' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['48%', '68%'],
      center: ['50%', '44%'],
      label: { show: false },
      data: rows.map(r => ({ name: r.name, value: r.value, itemStyle: { color: r.color } })),
    }],
  }
})

/* ---------------- 学习建议（study_suggestions 有值的） ---------------- */
const suggestions = computed(() =>
  data.value
    .filter(d => d.studySuggestions && d.studySuggestions.trim())
    .sort((a, b) => (a.proficiencyScore ?? 0) - (b.proficiencyScore ?? 0))
    .slice(0, 6)
)

/* ---------------- 等级字典 ---------------- */
const levelColors: Record<number, string> = { 0: '#909399', 1: '#F56C6C', 2: '#E6A23C', 3: '#409EFF', 4: '#67C23A', 5: '#00D100' }
const levelLabels: Record<number, string> = { 0: '未接触', 1: '入门', 2: '基础', 3: '进阶', 4: '熟练', 5: '精通' }
const levelCriteria: Record<number, string> = {
  0: '还未做过该知识点的题目',
  1: '正确率<50%或答题数<5道',
  2: '正确率50%~70%',
  3: '正确率70%~85%',
  4: '正确率85%~95%',
  5: '正确率≥95%（答题≥5道）',
}

const formulaTooltip = '综合评分 = 正确率×70% + 练习量×30%。不只是看正确率，还考虑练习的充分程度。'

const proficiencyColor = (score: number) => {
  if (score >= 70) return '#67C23A'
  if (score >= 40) return '#E6A23C'
  return '#F56C6C'
}

const goPractice = () => { window.location.hash = '#/student/practice' }

/** 题型正确率底色（知识点 × 题型矩阵用） */
const accBg = (acc: number) => {
  if (acc >= 80) return 'rgba(103,194,58,0.16)'
  if (acc >= 60) return 'rgba(230,162,60,0.16)'
  return 'rgba(245,108,108,0.16)'
}
</script>

<template>
  <div class="page-container" v-loading="loading">
    <!-- 说明 -->
    <el-alert type="info" :closable="false">
      <template #title>
        <span style="font-weight:600">掌握度计算逻辑</span>
        <el-tooltip :content="formulaTooltip" placement="bottom" effect="light">
          <el-icon style="margin-left:4px;cursor:help;color:#909399"><QuestionFilled /></el-icon>
        </el-tooltip>
      </template>
      系统根据你每道题的答题结果，自动计算每个知识点的掌握程度（0-5 级）。下方依次为：
      <b>学习画像</b>（分布与活跃度）→ <b>知识点明细</b>（分类 / 拍平）→ <b>行动建议</b> → <b>深度分析</b>。
    </el-alert>

    <!-- ① 概览 6 卡 -->
    <el-row :gutter="12">
      <el-col :xs="12" :sm="8" :md="4">
        <div class="ov-card">
          <div class="ov-num">{{ overview.total }}</div>
          <div class="ov-label">已统计知识点</div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <div class="ov-card">
          <div class="ov-num" style="color:#67C23A">{{ overview.mastered }}</div>
          <div class="ov-label">已掌握（≥4级）</div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <div class="ov-card">
          <div class="ov-num" style="color:#F56C6C">{{ overview.weak }}</div>
          <div class="ov-label">待加强（1-2级）</div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <div class="ov-card">
          <div class="ov-num" style="color:#409EFF">{{ overview.coverage }}%</div>
          <div class="ov-label">知识点覆盖率</div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <div class="ov-card">
          <div class="ov-num" :style="{ color: proficiencyColor(overview.avgScore) }">{{ overview.avgScore }}</div>
          <div class="ov-label">平均熟练度</div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <div class="ov-card">
          <div class="ov-num" :style="{ color: proficiencyColor(overview.avgAccuracy) }">{{ overview.avgAccuracy }}%</div>
          <div class="ov-label">平均正确率</div>
        </div>
      </el-col>
    </el-row>

    <!-- ② 学习画像：雷达 / 等级分布 / 熟练度分档 -->
    <el-row :gutter="14">
      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="section-card h-full">
          <template #header>
            <div class="card-head">
              <el-icon><DataAnalysis /></el-icon>
              <span>最弱 8 项雷达</span>
              <el-tooltip content="取熟练度最低的 8 个知识点。越靠近外圈掌握越好（满分 100）。" placement="top" effect="light">
                <el-icon class="help-ico"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
          </template>
          <VChart v-if="(radarChartOption as any).series" :option="radarChartOption" autoresize style="height:260px" />
          <el-empty v-else description="暂无数据" :image-size="60" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="section-card h-full">
          <template #header>
            <div class="card-head">
              <el-icon><Aim /></el-icon>
              <span>掌握等级分布</span>
              <span class="head-sub">6 档</span>
            </div>
          </template>
          <VChart v-if="(levelPieOption as any).series" :option="levelPieOption" autoresize style="height:260px" />
          <el-empty v-else description="暂无数据" :image-size="60" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="section-card h-full">
          <template #header>
            <div class="card-head">
              <el-icon><List /></el-icon>
              <span>熟练度分档</span>
              <span class="head-sub">5 档</span>
            </div>
          </template>
          <VChart v-if="(bandBarOption as any).series" :option="bandBarOption" autoresize style="height:260px" />
          <el-empty v-else description="暂无数据" :image-size="60" />
        </el-card>
      </el-col>
    </el-row>

    <!-- ③ 活跃度 / 覆盖率 / 薄弱 Top10 -->
    <el-row :gutter="14">
      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="section-card h-full">
          <template #header>
            <div class="card-head"><span>练习活跃度</span><span class="head-sub">按最近练习时间</span></div>
          </template>
          <VChart v-if="(activityPieOption as any).series" :option="activityPieOption" autoresize style="height:220px" />
          <el-empty v-else description="暂无数据" :image-size="60" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="section-card h-full">
          <template #header>
            <div class="card-head"><span>知识点覆盖率</span></div>
          </template>
          <div class="cover-box">
            <el-progress
              type="dashboard"
              :percentage="overview.coverage"
              :width="130"
              :color="overview.coverage >= 70 ? '#67C23A' : overview.coverage >= 40 ? '#E6A23C' : '#F56C6C'"
            />
            <div class="cover-text">
              <div>已覆盖 <b>{{ overview.total }}</b> / {{ insights?.coverage?.totalActive ?? '-' }} 个知识点</div>
              <div class="cover-warn" v-if="overview.neverTouched > 0">
                还有 <b>{{ overview.neverTouched }}</b> 个知识点从未练习
              </div>
              <el-button type="primary" link @click="goPractice">去练习 →</el-button>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="section-card h-full">
          <template #header>
            <div class="card-head"><span>薄弱标记 Top 10</span><span class="head-sub">按出错次数</span></div>
          </template>
          <div class="weak-list">
            <div v-for="(w, i) in (insights?.weakTop ?? [])" :key="w.tagId" class="weak-row">
              <span class="wr-rank">{{ i + 1 }}</span>
              <span class="wr-name" :title="w.tagName">{{ w.tagName }}</span>
              <span class="wr-cat">{{ w.categoryName }}</span>
              <span class="wr-cnt">{{ w.weakPointCount }} 次</span>
            </div>
            <el-empty v-if="!(insights?.weakTop ?? []).length" description="暂无薄弱标记" :image-size="50" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- ④ 知识点明细：分类 / 拍平 -->
    <el-card shadow="never" class="section-card">
      <template #header>
        <div class="view-head">
          <div class="vh-left">
            <el-icon><Aim /></el-icon>
            <span>知识点明细</span>
            <el-tag type="info" size="small">共 {{ categoryGroups.length }} 个语法专题</el-tag>
          </div>
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button value="category"><el-icon><Grid /></el-icon> 分类视图</el-radio-button>
            <el-radio-button value="flat"><el-icon><List /></el-icon> 拍平视图</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <!-- 分类视图 -->
      <template v-if="viewMode === 'category'">
        <el-tabs v-model="activeCat" class="cat-tabs" @tab-change="ensureActiveCat">
          <el-tab-pane name="__all__">
            <template #label>全部 <span class="tab-count">{{ overview.total }}</span></template>
          </el-tab-pane>
          <el-tab-pane v-for="g in categoryGroups" :key="g.key" :name="g.key">
            <template #label>{{ g.name }} <span class="tab-count">{{ g.count }}</span></template>
          </el-tab-pane>
        </el-tabs>

        <!-- 全部：专题概览 -->
        <div v-if="!currentGroup" class="mastery-grid">
          <div v-for="g in categoryGroups" :key="g.key" class="mg-card" @click="activeCat = g.key">
            <div class="mg-header">
              <span class="mg-name">{{ g.name }}</span>
              <span class="mg-score" :style="{ color: proficiencyColor(g.avgScore) }">{{ g.avgScore.toFixed(1) }}</span>
            </div>
            <el-progress :percentage="Math.min(100, g.avgScore)" :stroke-width="12" :color="proficiencyColor(g.avgScore)" :show-text="false" />
            <div class="mg-footer">
              <span class="mg-stat">{{ g.count }} 个</span>
              <span class="mg-stat">正确率 {{ g.avgAccuracy.toFixed(1) }}%</span>
              <span class="mg-stat">答题 {{ g.totalAnswers }}</span>
              <span class="mg-stat" :style="{ color: g.weakCount ? '#f56c6c' : '#67c23a' }">
                {{ g.weakCount ? '薄弱 ' + g.weakCount : '全部达标' }}
              </span>
            </div>
          </div>
        </div>

        <!-- 某专题：知识点卡 -->
        <div v-else>
          <div class="group-summary">
            <span class="gs-name">{{ currentGroup.name }}</span>
            <span class="gs-item">知识点 <b>{{ currentGroup.count }}</b></span>
            <span class="gs-item">平均熟练度 <b :style="{ color: proficiencyColor(currentGroup.avgScore) }">{{ currentGroup.avgScore }}</b></span>
            <span class="gs-item">平均正确率 <b>{{ currentGroup.avgAccuracy }}%</b></span>
            <span class="gs-item">累计答题 <b>{{ currentGroup.totalAnswers }}</b></span>
            <span v-if="currentGroup.weakCount" class="gs-item" style="color:#f56c6c">薄弱 <b>{{ currentGroup.weakCount }}</b></span>
          </div>
          <div class="tag-grid">
            <div v-for="t in currentGroup.items" :key="t.id" class="tag-card">
              <div class="tc-head">
                <span class="tc-name" :title="t.tagName">{{ t.tagName }}</span>
                <el-tooltip :content="levelCriteria[t.masteryLevel]" placement="top" effect="light">
                  <el-tag :color="levelColors[t.masteryLevel]" effect="dark" size="small" class="tc-level">
                    {{ levelLabels[t.masteryLevel] }}
                  </el-tag>
                </el-tooltip>
              </div>
              <el-progress
                :percentage="Math.min(100, t.proficiencyScore ?? 0)"
                :stroke-width="10"
                :color="proficiencyColor(t.proficiencyScore ?? 0)"
                :format="() => (t.proficiencyScore ?? 0).toFixed(1)"
              />
              <div class="tc-meta">
                <span>正确率 <b :style="{ color: (t.accuracy ?? 0) >= 80 ? '#67C23A' : (t.accuracy ?? 0) >= 60 ? '#E6A23C' : '#F56C6C' }">{{ (t.accuracy ?? 0).toFixed(1) }}%</b></span>
                <span>答题 <b>{{ t.totalAnswers }}</b></span>
                <span v-if="t.weakPointCount > 0" style="color:#F56C6C">薄弱 {{ t.weakPointCount }}</span>
              </div>
              <div class="tc-foot">
                <span class="tc-time">{{ t.lastPracticeTime?.substring(0, 10) ?? '未练习' }}</span>
                <el-button type="primary" link size="small" @click="goPractice">练习 →</el-button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 拍平视图（精简为 7 列） -->
      <template v-else>
        <div class="flat-filters">
          <el-input v-model="flatKeyword" placeholder="搜索知识点" clearable style="width:170px" />
          <el-select v-model="flatCat" style="width:170px">
            <el-option label="全部专题" value="all" />
            <el-option v-for="g in categoryGroups" :key="g.key" :label="`${g.name} (${g.count})`" :value="String(g.id ?? 'none')" />
          </el-select>
          <el-select v-model="flatLevel" style="width:130px">
            <el-option v-for="o in levelFilterOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <el-select v-model="flatSort" style="width:150px">
            <el-option v-for="o in sortOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <span class="flat-count">筛选出 <b>{{ flatRows.length }}</b> / {{ overview.total }}</span>
        </div>

        <el-table :data="flatRows" stripe border max-height="540">
          <el-table-column label="知识点" min-width="150">
            <template #default="{ row }">
              <div class="cell-tag">
                <span class="ct-name">{{ row.tagName }}</span>
                <span class="ct-cat">{{ row.categoryName }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="掌握等级" width="95" align="center">
            <template #default="{ row }">
              <el-tooltip :content="levelCriteria[row.masteryLevel]" placement="top" effect="light">
                <el-tag :color="levelColors[row.masteryLevel]" effect="dark" style="cursor:help;border:none">
                  {{ levelLabels[row.masteryLevel] }}
                </el-tag>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="熟练度" width="140">
            <template #default="{ row }">
              <el-progress
                :percentage="Math.min(100, row.proficiencyScore ?? 0)"
                :stroke-width="8"
                :color="proficiencyColor(row.proficiencyScore ?? 0)"
              />
            </template>
          </el-table-column>
          <el-table-column label="正确率" width="90" align="center">
            <template #default="{ row }">
              <span :style="{ color: (row.accuracy ?? 0) >= 80 ? '#67C23A' : (row.accuracy ?? 0) >= 60 ? '#E6A23C' : '#F56C6C', fontWeight: 600 }">
                {{ row.accuracy?.toFixed(1) ?? '-' }}%
              </span>
            </template>
          </el-table-column>
          <el-table-column label="答题量" width="95" align="center">
            <template #default="{ row }">
              <el-tooltip :content="`答对 ${row.correctCount} / 共 ${row.totalAnswers}；薄弱标记 ${row.weakPointCount} 次`" placement="top">
                <span style="cursor:help">{{ row.totalAnswers }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="最近练习" width="110" align="center">
            <template #default="{ row }">{{ row.lastPracticeTime?.substring(0, 10) ?? '-' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="75" align="center" fixed="right">
            <template #default>
              <el-button type="primary" link @click="goPractice">练习</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-card>

    <!-- ⑤ 行动建议：升级路径 + 学习建议 -->
    <el-row :gutter="14">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="section-card h-full">
          <template #header>
            <div class="card-head"><span>升级路径</span><span class="head-sub">距下一级还差多少分（差得最少的排前面）</span></div>
          </template>
          <div class="upgrade-list">
            <div v-for="u in (insights?.upgradePath ?? [])" :key="u.tagId" class="up-row">
              <div class="up-left">
                <span class="up-name" :title="u.tagName">{{ u.tagName }}</span>
                <span class="up-flow">
                  <el-tag size="small" :color="levelColors[u.currentLevel]" effect="dark" style="border:none">{{ u.currentLabel }}</el-tag>
                  <span class="up-arrow">→</span>
                  <el-tag size="small" :color="levelColors[u.nextLevel]" effect="dark" style="border:none">{{ u.nextLabel }}</el-tag>
                </span>
              </div>
              <div class="up-right">
                <span class="up-gap">还差 {{ u.scoreGap }} 分</span>
              </div>
            </div>
            <el-empty v-if="!(insights?.upgradePath ?? []).length" description="暂无待升级知识点" :image-size="50" />
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="section-card h-full">
          <template #header>
            <div class="card-head"><span>学习建议</span><span class="head-sub">系统按你的答题情况生成</span></div>
          </template>
          <div class="sug-list">
            <div v-for="s in suggestions" :key="s.id" class="sug-item">
              <div class="sug-head">
                <el-tag :color="levelColors[s.masteryLevel]" effect="dark" size="small" style="border:none">
                  {{ levelLabels[s.masteryLevel] }}
                </el-tag>
                <span class="sug-name">{{ s.tagName }}</span>
                <span class="sug-score" :style="{ color: proficiencyColor(s.proficiencyScore ?? 0) }">{{ (s.proficiencyScore ?? 0).toFixed(1) }}</span>
              </div>
              <div class="sug-text">{{ s.studySuggestions }}</div>
            </div>
            <el-empty v-if="!suggestions.length" description="暂无学习建议" :image-size="50" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- ⑥ 深度分析：近期 vs 历史 / 知识点 × 题型 -->
    <el-row :gutter="14">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="section-card h-full">
          <template #header>
            <div class="card-head">
              <span>近期 vs 历史正确率</span>
              <span class="head-sub">近 30 天对比全部历史，正值为进步</span>
            </div>
          </template>
          <el-table :data="(insights?.trend ?? []).slice(0, 12)" size="small" max-height="330">
            <el-table-column prop="tagName" label="知识点" min-width="110" show-overflow-tooltip />
            <el-table-column label="近期" width="90" align="center">
              <template #default="{ row }">
                <span v-if="row.recentAnswers > 0">{{ row.recentAccuracy?.toFixed(1) }}%</span>
                <span v-else class="muted">无</span>
              </template>
            </el-table-column>
            <el-table-column label="历史" width="80" align="center">
              <template #default="{ row }">{{ row.overallAccuracy?.toFixed(1) }}%</template>
            </el-table-column>
            <el-table-column label="变化" width="90" align="center">
              <template #default="{ row }">
                <span v-if="row.delta == null" class="muted">-</span>
                <span v-else :style="{ color: row.delta >= 0 ? '#67C23A' : '#F56C6C', fontWeight: 600 }">
                  {{ row.delta >= 0 ? '+' : '' }}{{ row.delta.toFixed(1) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="样本" width="70" align="center">
              <template #default="{ row }"><span class="muted">{{ row.recentAnswers }}</span></template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!(insights?.trend ?? []).length" description="暂无答题记录" :image-size="50" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="section-card h-full">
          <template #header>
            <div class="card-head"><span>知识点 × 题型表现</span><span class="head-sub">按答题量排序</span></div>
          </template>
          <div class="matrix-list">
            <div v-for="m in (insights?.typeMatrix ?? []).slice(0, 8)" :key="m.tagId" class="mx-row">
              <div class="mx-name" :title="m.tagName">{{ m.tagName }}</div>
              <div class="mx-cells">
                <el-tooltip
                  v-for="c in m.cells" :key="c.questionType"
                  :content="`${c.label}：答对 ${c.correct} / 共 ${c.total}`"
                  placement="top"
                >
                  <span class="mx-cell" :style="{ background: accBg(c.accuracy) }">
                    {{ c.label }} {{ c.accuracy.toFixed(0) }}%
                  </span>
                </el-tooltip>
              </div>
            </div>
            <el-empty v-if="!(insights?.typeMatrix ?? []).length" description="暂无答题记录" :image-size="50" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script lang="ts">
/** 题型正确率底色（供模板使用） */
export default {
  methods: {
    accBg(acc: number) {
      if (acc >= 80) return 'rgba(103,194,58,0.16)'
      if (acc >= 60) return 'rgba(230,162,60,0.16)'
      return 'rgba(245,108,108,0.16)'
    },
  },
}
</script>

<style scoped lang="scss">
.page-container { display: flex; flex-direction: column; gap: 14px; padding: 16px; }

.section-card {
  border-radius: 8px;
  :deep(.el-card__header) { padding: 10px 18px; font-weight: 600; font-size: 14px; }
  :deep(.el-card__body) { padding: 14px 18px; }
}
.h-full { height: 100%; }

.card-head {
  display: flex; align-items: center; gap: 8px;
  .help-ico { cursor: help; color: #909399; }
  .head-sub { margin-left: auto; font-size: 11px; font-weight: 400; color: #909399; }
}

/* ---------- 概览 ---------- */
.ov-card {
  background: #fff; border: 1px solid #ebeef5; border-radius: 10px;
  padding: 12px 10px; text-align: center;
  .ov-num { font-size: 22px; font-weight: 700; line-height: 1.2; color: #303133; font-variant-numeric: tabular-nums; }
  .ov-label { margin-top: 3px; font-size: 11px; color: #909399; }
}

/* ---------- 覆盖率 ---------- */
.cover-box { display: flex; align-items: center; gap: 18px; }
.cover-text { font-size: 13px; color: #606266; line-height: 1.9; b { color: #303133; font-size: 15px; } }
.cover-warn { color: #e6a23c; font-size: 12px; }

/* ---------- 薄弱 Top10 ---------- */
.weak-list { max-height: 220px; overflow-y: auto; }
.weak-row {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 0; font-size: 12px; border-bottom: 1px dashed #f2f3f5;
  &:last-child { border-bottom: none; }
  .wr-rank {
    width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; color: #fff; background: #f56c6c;
  }
  .wr-name { flex: 1; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wr-cat { color: #c0c4cc; font-size: 11px; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wr-cnt { color: #f56c6c; font-weight: 600; }
}

/* ---------- 明细卡头部 ---------- */
.view-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  .vh-left { display: flex; align-items: center; gap: 8px; }
}

/* ---------- 分类页签 ---------- */
.cat-tabs {
  :deep(.el-tabs__header) { margin-bottom: 14px; }
  :deep(.el-tabs__item) { height: 36px; line-height: 36px; font-size: 13px; }
}
.tab-count {
  display: inline-block; margin-left: 4px; padding: 0 5px;
  font-size: 11px; line-height: 16px; color: #909399;
  background: #f2f3f5; border-radius: 8px;
}

/* ---------- 专题概览网格 ---------- */
.mastery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
.mg-card {
  background: #fafbfc; border: 1px solid #ebeef5; border-radius: 10px; padding: 12px;
  cursor: pointer; transition: all 0.2s;
  &:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: #c0c4cc; }
}
.mg-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;
  .mg-name { font-size: 13px; font-weight: 600; color: #303133; }
  .mg-score { font-size: 18px; font-weight: 700; }
}
.mg-footer {
  display: flex; gap: 10px; margin-top: 7px; flex-wrap: wrap;
  .mg-stat { font-size: 11px; color: #909399; }
}

/* ---------- 专题汇总条 ---------- */
.group-summary {
  display: flex; align-items: center; flex-wrap: wrap; gap: 16px;
  padding: 9px 14px; margin-bottom: 12px;
  background: #f5f8ff; border: 1px solid #e4ecff; border-radius: 8px;
  .gs-name { font-size: 14px; font-weight: 700; color: #303133; }
  .gs-item { font-size: 12px; color: #909399; b { color: #303133; font-size: 13px; } }
}

/* ---------- 知识点卡 ---------- */
.tag-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: 10px; }
.tag-card {
  background: #fff; border: 1px solid #ebeef5; border-radius: 10px; padding: 11px;
  transition: all 0.2s;
  &:hover { box-shadow: 0 3px 10px rgba(0,0,0,0.07); border-color: #dcdfe6; }
}
.tc-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px;
  .tc-name { font-size: 13px; font-weight: 600; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tc-level { flex-shrink: 0; border: none; color: #fff; }
}
.tc-meta {
  display: flex; gap: 9px; flex-wrap: wrap; margin-top: 5px;
  font-size: 11px; color: #909399;
  b { color: #303133; font-size: 12px; }
}
.tc-foot {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 7px; padding-top: 7px; border-top: 1px dashed #f0f2f5;
  .tc-time { font-size: 11px; color: #c0c4cc; }
}

/* ---------- 拍平 ---------- */
.flat-filters {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;
  .flat-count { font-size: 12px; color: #909399; b { color: #303133; } }
}
.cell-tag {
  display: flex; flex-direction: column; line-height: 1.35;
  .ct-name { font-size: 13px; color: #303133; }
  .ct-cat { font-size: 11px; color: #c0c4cc; }
}
.muted { color: #c0c4cc; }

/* ---------- 升级路径 ---------- */
.upgrade-list { max-height: 300px; overflow-y: auto; }
.up-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 7px 0; border-bottom: 1px dashed #f2f3f5;
  &:last-child { border-bottom: none; }
}
.up-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.up-name { font-size: 13px; color: #303133; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.up-flow { display: flex; align-items: center; gap: 5px; .up-arrow { color: #c0c4cc; font-size: 12px; } }
.up-gap { font-size: 12px; color: #e6a23c; font-weight: 600; white-space: nowrap; }

/* ---------- 学习建议 ---------- */
.sug-list { max-height: 300px; overflow-y: auto; }
.sug-item {
  padding: 9px 0; border-bottom: 1px dashed #f2f3f5;
  &:last-child { border-bottom: none; }
}
.sug-head {
  display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
  .sug-name { font-size: 13px; font-weight: 600; color: #303133; }
  .sug-score { margin-left: auto; font-size: 13px; font-weight: 700; }
}
.sug-text { font-size: 12px; color: #606266; line-height: 1.55; }

/* ---------- 题型矩阵 ---------- */
.matrix-list { max-height: 330px; overflow-y: auto; }
.mx-row {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 0; border-bottom: 1px dashed #f2f3f5;
  &:last-child { border-bottom: none; }
}
.mx-name { width: 110px; flex-shrink: 0; font-size: 12px; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mx-cells { display: flex; gap: 6px; flex-wrap: wrap; }
.mx-cell {
  padding: 2px 7px; border-radius: 4px; font-size: 11px; color: #303133; cursor: help;
}
</style>
