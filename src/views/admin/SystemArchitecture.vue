<script setup lang="ts">
/**
 * 系统架构举证页 —— 答辩现场用来回答「用了多少张表 / 什么字段 / 什么技术」。
 *
 * 设计原则：
 *  1. 所有数字都是后端从 information_schema 实时查出来的，页面不做任何硬编码；
 *  2. 技术栈版本来自 pom.xml / package.json 实测，不是论文里抄的；
 *  3. 三层信息密度：概览指标卡 → 模块分组 → 逐表逐字段明细（可搜索可展开）。
 */
import { computed, onMounted, ref, watch } from 'vue'
import {
  Coin, Grid, Connection, Cpu, Search, Refresh, Download, Document,
  Reading, Histogram, Key, Link, Files, Box, Monitor, DataAnalysis, QuestionFilled,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getSystemArchitecture } from '@/api/architecture'
import type { ArchTable, ArchColumn, ArchModule, SystemArchitecture } from '@/api/architecture'

// ==================== 状态 ====================

const loading = ref(false)
const data = ref<SystemArchitecture | null>(null)
const activeTab = ref<'tech' | 'tables' | 'er' | 'algo'>('tech')
const includeRows = ref(false)

/** 表清单搜索关键字 */
const keyword = ref('')
/** 只看有数据的表 */
const onlyWithData = ref(false)
/** 当前选中的表（用于右侧字段详情） */
const selectedTable = ref<string>('')
/** 已展开的表名集合（表格内行展开） */
const expandedTables = ref<string[]>([])
/** 模块筛选 */
const moduleFilter = ref('')

/**
 * 数据表视图口径（2026-10-17 用户要求）。
 *
 * 答辩时存在两个都要能讲清楚的口径，用切换器让两个数字都真实呈现：
 *   · paper ：论文 3.3.2 节逐字段设计的 12 张核心业务表（对应论文表 3.1–3.12）
 *   · all   ：真实数据库全部 49 张表（含 37 张支撑表）
 * 默认进入「论文口径」，因为老师通常先问"你论文里设计了几张表"。
 */
const tableView = ref<'paper' | 'all'>('paper')

/**
 * [2026-10-31] 非 AI 主流程算法举证（答辩用）。
 * 四项来自《四算法实施总纲》（教育测量 / 模拟退火组卷 / BKT / CAT）；
 * 第五项 StudentListStatistics 是 D36 统计实时化配套，不是教育测量算法。
 */
const algorithmCards = [
  {
    id: 'quality',
    name: '教育测量 · 题目质量分析',
    kind: '教育测量学',
    paper: '扩展（论文未展开公式，答辩可引「区分度 / 难度」概念）',
    goal: '从正式考试作答明细动态计算 P 值（难度）、D 值（区分度）、选项分布与信度，标记低质量题；不落统计表。',
    formula: [
      'P（难度）= 该题答对人数 / 有效作答人数，P∈[0,1]；P≥0.70 易、≥0.40 中、否则难',
      'D（区分度）= 高分组正确率 − 低分组正确率（按总分上下 27% 分组）',
      '信度：考试整体内部一致性（基于方差比）',
      '缺样本标 INCOMPLETE_DATA，不拿练习数据冒充正式考试',
    ],
    data: 'answer_record + exam_record + question（只读正式考试明细）',
    api: 'GET /api/admin/questions/quality',
    ui: '管理端 · 题库质量分析',
    impl: 'QuestionQualityCalculator / QuestionQualityService',
  },
  {
    id: 'sa',
    name: '模拟退火 · 多约束组卷',
    kind: '组合优化',
    paper: '扩展（对齐论文「智能组卷策略」改进点）',
    goal: '在题型数、目标总分、题目不重复、阅读整组等硬约束下，优化难度分布、区分度、知识点覆盖与近期复用率。',
    formula: [
      '目标函数权重 (2.0, 1.5, 1.0, 0.6, 0.8)：难度 L1 偏差、平均 D 损失、知识点覆盖缺口、近 30 天复用率、未标定题占比',
      '退火：20000 次迭代，T0=1，Tmin=1e-4，α=(Tmin/T0)^(1/iterations)',
      '最大余数法分配难度档位初始配额；邻域 = 可行题目替换',
      '硬约束不可行必须失败并返回 warnings，禁止静默违约出卷',
    ],
    data: 'question + question_tag_relation + paper_question（历史复用）',
    api: 'POST /api/paper-templates/{id}/generate?strategy=OPTIMIZED',
    ui: '组卷模板 · 生成试卷 · 组卷策略「多约束优化」',
    impl: 'PaperTemplateOptimizer（挂接 PaperTemplateService）',
  },
  {
    id: 'bkt',
    name: 'BKT · 贝叶斯知识追踪',
    kind: '知识追踪',
    paper: '扩展（学生掌握度估计）',
    goal: '按知识点标签估计学生掌握概率；与旧「掌握度」并列展示，不覆盖旧字段。',
    formula: [
      '先验 pL0=0.25；迁移 pT=0.18；猜对 pG=0.20；疏忽 pS=0.10；遗忘 λ=0.02/日',
      '样本充足（≥20 条序列且每条 ≥4 次观测）时有界 MLE 拟合 pT/pG/pS，否则用版本化默认参数',
      '掌握更新按相邻观测间隔施加指数遗忘',
      '观测来源仅 practice_answer 最终作答行；不足 3 条标 INSUFFICIENT_SAMPLE，零观测 NO_DATA',
    ],
    data: 'practice_answer + question_tag_relation（不读 knowledge_mastery 汇总）',
    api: 'GET /api/knowledge-mastery/student/{id}/bkt · GET /api/knowledge-mastery/bkt',
    ui: '学生 · 知识点掌握度 · 「BKT 模型估计」页签',
    impl: 'BktService / BktCalculator',
  },
  {
    id: 'cat',
    name: 'CAT · 自适应测验练习',
    kind: '项目反应理论 IRT',
    paper: '扩展（个性化练习路径）',
    goal: '按当前能力动态选题，用更少题目达到目标测量精度；能力/SE 每次从本练习作答重算，不持久化。',
    formula: [
      'Rasch 1PL；能力 θ 用 N(0,1) 先验 MAP；Newton 更新，步长裁剪 ±1',
      '选题 = 最大 Fisher 信息，并做题型均衡与主知识点覆盖',
      'SE = 1/√(测验信息)；SE≤0.50 或 30 题停止',
      '历史校准优先正式考试 P≥20；未标定题按人工难度映射并乘 0.6 信息折扣',
    ],
    data: 'practice_answer + answer_record + question（动态重算）',
    api: 'POST /api/practices/adaptive/start/{categoryId} · GET /api/practices/{id}/adaptive/next',
    ui: '学生 · 专项练习 · 练习模式「CAT 自适应」',
    impl: 'AdaptivePracticeService',
  },
  {
    id: 'list',
    name: '学生名单统计（实时聚合）',
    kind: 'D36 统计口径 · 非教育测量算法',
    paper: '对齐 D36：统计值查询时从业务明细聚合，不读存量汇总列',
    goal: '学生列表页批量计算考试次数、练习量、正确率、连续学习天数、能力分等，供教师/管理端名单展示。',
    formula: [
      '能力分 = 平均考试分 × 60% + 练习正确率 × 40%',
      '全部指标从 exam_record / exam_score / practice_answer / answer_record 实时聚合',
      '禁止把 question_count、correct_rate 等存量列当权威结果（D31/D36）',
      '这不是题目质量/BKT/CAT 类「算法」，是列表统计服务',
    ],
    data: 'exam_record + exam_score + practice_answer + answer_record + class_student',
    api: 'GET /api/admin/users（列表 VO 内嵌统计）',
    ui: '管理端 · 我的学生 / 用户管理列表',
    impl: 'StudentListStatisticsService',
  },
]

// ==================== 加载 ====================

const load = async () => {
  loading.value = true
  try {
    const res = await getSystemArchitecture(includeRows.value)
    data.value = res.data
    if (!selectedTable.value && data.value?.tables?.length) {
      selectedTable.value = data.value.tables[0]!.tableName
    }
  } catch (e) {
    ElMessage.error('架构数据加载失败，请确认后端服务已启动')
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ==================== 计算属性 ====================

const overview = computed(() => data.value?.overview)
const database = computed(() => data.value?.database)
const modules = computed(() => data.value?.modules ?? [])
const techLayers = computed(() => data.value?.techStack ?? [])
const relations = computed(() => data.value?.relations ?? [])

/** 技术栈论文证据链统计：论文提及项 / 技术项总数 */
const techItemCount = computed(() => techLayers.value.reduce((n, l) => n + l.items.length, 0))
const paperTechCount = computed(
  () => techLayers.value.reduce((n, l) => n + l.items.filter((i) => i.paperMentioned).length, 0),
)

/** 论文证据链简写：首个出处 + 总处数（完整出处放 title 提示） */
const shortPaperRef = (ref: string | null | undefined): string => {
  if (!ref) return ''
  const parts = ref.split('、').map((s) => s.trim()).filter(Boolean)
  return parts.length > 1 ? `${parts[0]} 等 ${parts.length} 处` : parts[0]!
}

/** 过滤后的表清单（受「论文/全部」口径 + 搜索 + 模块 + 有无数据共同约束） */
const filteredTables = computed<ArchTable[]>(() => {
  let list = data.value?.tables ?? []
  // 1) 口径筛选
  if (tableView.value === 'paper') {
    // 论文口径下按论文表号（表 3.1 → 3.12）排序，与论文正文顺序一致，便于对照查找。
    // 不排序时会按后端返回的"模块顺序"排，出现表 3.9 排在表 3.8 前面的情况。
    list = list
      .filter((t) => t.paperCore)
      .sort((a, b) => tableNoValue(a) - tableNoValue(b))
  }
  // 2) 关键字
  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(
      (t) =>
        t.tableName.toLowerCase().includes(kw) ||
        (t.tableComment ?? '').toLowerCase().includes(kw) ||
        (t.purpose ?? '').toLowerCase().includes(kw) ||
        t.columns?.some((c) => c.name.toLowerCase().includes(kw)),
    )
  }
  // 3) 模块
  if (moduleFilter.value) {
    list = list.filter((t) => t.module === moduleFilter.value)
  }
  // 4) 有无数据
  if (onlyWithData.value) {
    list = list.filter((t) => t.tableRows > 0)
  }
  return list
})

/** 从「表 3.8」里取出 8，用于按论文表号排序；无表号时排到最后 */
const tableNoValue = (t: ArchTable): number => {
  if (!t.paperTableNo) return 999
  const m = /表\s*3\.(\d+)/.exec(t.paperTableNo)
  return m ? Number(m[1]) : 999
}

/** 论文口径下的 12 张核心表（不受搜索过滤影响，用于切换器上的数字） */
const paperCoreTables = computed(() =>
  (data.value?.tables ?? []).filter((t) => t.paperCore),
)

/**
 * 某个业务模块在当前口径下有几张表。
 * 论文口径下必须重算 —— 直接用后端返回的 m.tableCount 会把支撑表也计进去，
 * 出现"论文口径只有 12 张，但模块条加起来 49"的矛盾。
 *
 * 注意：本函数必须定义在 visibleModules / watch 之前。
 * 它是 const 箭头函数，若在使用之后定义会触发 TDZ（暂时性死区）报错。
 */
const moduleCountInView = (m: ArchModule): number => {
  if (tableView.value === 'all') return m.tableCount
  return (data.value?.tables ?? []).filter((t) => t.paperCore && t.module === m.name).length
}

/**
 * 当前口径下要显示的模块列表。
 *
 * 论文口径下去掉"该模块在本口径下没有表"的项 ——
 * 否则会出现「学情分析 0」「班级管理 0」这类可点击但点了是空列表的筛选项，
 * 答辩现场演示时很尴尬。全量口径下保持全部模块。
 */
const visibleModules = computed(() => {
  if (tableView.value === 'all') return modules.value
  return modules.value.filter((m) => moduleCountInView(m) > 0)
})

/**
 * 切换口径时，若当前已选模块在新口径下不可见，则自动重置为「全部」。
 * 否则会出现：在"全部"口径选中「学情分析」，切到论文口径后该筛选项消失，
 * 但表格仍是空列表且用户看不到自己在筛什么。
 */
watch(tableView, () => {
  if (moduleFilter.value && !visibleModules.value.some((m) => m.name === moduleFilter.value)) {
    moduleFilter.value = ''
  }
})

/** 当前口径下表数量（切换器标签用） */
const currentViewCount = computed(() =>
  tableView.value === 'paper' ? paperCoreTables.value.length : (data.value?.tables?.length ?? 0),
)

/**
 * 顶部指标卡是否按「论文口径」显示。
 *
 * 仅当用户处在「数据表」页签且选了论文口径时才切换 ——
 * 否则停留在技术栈页签时指标卡也跟着变成 12 张表，会让人误以为系统只有 12 张。
 */
const usePaperScope = computed(() => activeTab.value === 'tables' && tableView.value === 'paper')

/** 有真实外键的表（参与 ER 图） */
const tablesWithFk = computed(() =>
  (data.value?.tables ?? []).filter((t) => (t.foreignKeys?.length ?? 0) > 0),
)

// ==================== 工具方法 ====================

/**
 * 数字千分位。
 * 注意：不用 toLocaleString —— 某些容器 locale 缺失时行为不一致。
 */
const fmt = (n: number | null | undefined): string => {
  if (n == null) return '0'
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 字段类型着色 */
const typeColor = (baseType?: string): string => {
  const t = (baseType ?? '').toLowerCase()
  if (['bigint', 'int', 'smallint', 'tinyint', 'decimal', 'float', 'double'].includes(t)) return '#409eff'
  if (['varchar', 'char', 'text', 'longtext', 'mediumtext'].includes(t)) return '#67c23a'
  if (['datetime', 'timestamp', 'date', 'time'].includes(t)) return '#e6a23c'
  if (['json'].includes(t)) return '#9b59b6'
  return '#909399'
}

/** 字段角色标签 */
const columnTags = (c: ArchColumn): Array<{ text: string; type: 'primary' | 'success' | 'warning' | 'info' }> => {
  const tags: Array<{ text: string; type: 'primary' | 'success' | 'warning' | 'info' }> = []
  if (c.primaryKey) tags.push({ text: 'PK', type: 'primary' })
  if (c.foreignKey) tags.push({ text: 'FK', type: 'success' })
  if (c.uniqueKey) tags.push({ text: 'UK', type: 'warning' })
  if (c.autoIncrement) tags.push({ text: 'AI', type: 'info' })
  return tags
}

/** 导出当前表清单为 CSV（答辩时可直接贴进论文附录） */
const exportCsv = () => {
  const rows: string[] = ['模块,表名,表注释,业务说明,字段数,估算行数,实体类']
  filteredTables.value.forEach((t) => {
    rows.push(
      [t.module, t.tableName, t.tableComment, t.purpose, t.columnCount, t.tableRows, t.entityClass ?? '-']
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
  })
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `GramEval-数据表清单-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出 ${filteredTables.value.length} 张表`)
}

/** 切换业务模块筛选（'' 表示全部） */
const focusModule = (name: string) => {
  moduleFilter.value = name
  activeTab.value = 'tables'
}

/** 点击表名查看字段 */
const focusTable = (name: string) => {
  selectedTable.value = name
  if (!expandedTables.value.includes(name)) expandedTables.value.push(name)
  activeTab.value = 'tables'
}
</script>

<template>
  <div v-loading="loading" class="arch-page">
    <!-- ==================== 顶部：标题 + 操作 ==================== -->
    <div class="page-head">
      <div class="head-left">
        <h2><el-icon><Coin /></el-icon> 系统架构与技术举证</h2>
        <p class="sub">
          答辩速查：数据库共
          <b class="hl">{{ overview?.tableCount ?? 0 }}</b> 张表 ·
          <b class="hl">{{ fmt(overview?.columnCount) }}</b> 个字段 ·
          <b class="hl">{{ fmt(overview?.totalRows) }}</b> 条数据 ·
          <b class="hl">{{ overview?.apiCount ?? 0 }}</b> 个后端接口
        </p>
      </div>
      <div class="head-right">
        <el-switch v-model="includeRows" active-text="精确行数" @change="load" />
        <el-button :icon="Download" @click="exportCsv">导出表清单</el-button>
        <el-button :icon="Refresh" @click="load">刷新</el-button>
      </div>
    </div>

    <!-- ==================== 概览指标卡（随口径联动） ==================== -->
    <div class="metric-grid">
      <div class="metric-card primary">
        <div class="m-icon"><el-icon><Grid /></el-icon></div>
        <div class="m-body">
          <div class="m-value">{{ usePaperScope ? (overview?.paperCoreTableCount ?? '-') : (overview?.tableCount ?? '-') }}</div>
          <div class="m-label">{{ usePaperScope ? '核心数据表' : '数据表' }}</div>
        </div>
      </div>
      <div class="metric-card success">
        <div class="m-icon"><el-icon><Files /></el-icon></div>
        <div class="m-body">
          <div class="m-value">{{ fmt(usePaperScope ? overview?.paperCoreColumnCount : overview?.columnCount) }}</div>
          <div class="m-label">{{ usePaperScope ? '核心字段' : '字段总数' }}</div>
        </div>
      </div>
      <div class="metric-card warning">
        <div class="m-icon"><el-icon><Link /></el-icon></div>
        <div class="m-body">
          <div class="m-value">{{ overview?.foreignKeyCount ?? 0 }}</div>
          <div class="m-label">外键关系</div>
        </div>
      </div>
      <div class="metric-card info">
        <div class="m-icon"><el-icon><Histogram /></el-icon></div>
        <div class="m-body">
          <div class="m-value">{{ fmt(usePaperScope ? overview?.paperCoreRows : overview?.totalRows) }}</div>
          <div class="m-label">{{ usePaperScope ? '核心表行数' : '数据行数' }}</div>
        </div>
      </div>
      <div class="metric-card purple">
        <div class="m-icon"><el-icon><Cpu /></el-icon></div>
        <div class="m-body">
          <div class="m-value">{{ overview?.apiCount ?? 0 }}</div>
          <div class="m-label">REST 接口</div>
        </div>
      </div>
      <div class="metric-card cyan">
        <div class="m-icon"><el-icon><Box /></el-icon></div>
        <div class="m-body">
          <div class="m-value">{{ overview?.moduleCount ?? 0 }}</div>
          <div class="m-label">业务模块</div>
        </div>
      </div>
    </div>

    <!-- ==================== 数据库信息条 ==================== -->
    <el-card shadow="never" class="db-bar">
      <div class="db-inner">
        <span class="db-chip">
          <el-icon><Monitor /></el-icon>
          {{ database?.productName }} {{ database?.productVersion }}
        </span>
        <span class="db-chip">库名 <b>{{ database?.schemaName }}</b></span>
        <span class="db-chip">存储引擎 <b>{{ database?.engine }}</b></span>
        <span class="db-chip">字符集 <b>{{ database?.charset }}</b></span>
        <span class="db-chip">
          字段语义已说明 <b>{{ overview?.columnMeaningRate ?? 0 }}%</b>
          <el-tooltip
            placement="top"
            content="数据库 COLUMN_COMMENT 覆盖较低（JPA ddl-auto 建表不带注释），本页已为每个字段补充中文含义推断。该指标 = 有 DB 注释或可推断出含义的字段占比"
          >
            <el-icon class="help-icon"><QuestionFilled /></el-icon>
          </el-tooltip>
        </span>
        <span class="db-chip">
          DB 原生注释 表 <b>{{ overview?.tableCommentRate }}%</b> / 字段 <b>{{ overview?.columnCommentRate }}%</b>
        </span>
      </div>
    </el-card>

    <!-- ==================== 主内容标签页 ==================== -->
    <el-tabs v-model="activeTab" class="arch-tabs">
      <!-- ========== 技术栈 ========== -->
      <el-tab-pane name="tech">
        <template #label>
          <span class="tab-label"><el-icon><Cpu /></el-icon> 技术栈</span>
        </template>
        <!-- 论文证据链说明：标注论文提到的技术要求，版本差异忽略 -->
        <div class="tech-paper-note">
          <el-icon><Document /></el-icon>
          <span>
            论文证据链：<b>{{ paperTechCount }} / {{ techItemCount }}</b> 项技术在论文中有对应章节或表号（带
            <el-tag type="success" effect="plain" class="note-tag">📘 章节</el-tag>
            标注）；其余为工程实现补充，论文未展开。版本按实际运行环境显示，论文版本差异可忽略。
          </span>
        </div>
        <div class="tech-grid">
          <el-card v-for="layer in techLayers" :key="layer.layer" shadow="hover" class="tech-card">
            <template #header>
              <div class="tech-head">
                <span class="tech-layer">{{ layer.layer }}</span>
                <span class="tech-count">{{ layer.items.length }} 项</span>
              </div>
              <div class="tech-desc">{{ layer.description }}</div>
            </template>
            <div class="tech-items">
              <div v-for="it in layer.items" :key="it.name" class="tech-item">
                <div class="ti-main">
                  <span class="ti-name">{{ it.name }}</span>
                  <el-tag v-if="it.version && it.version !== '-'" effect="plain" class="ti-ver">
                    {{ it.version }}
                  </el-tag>
                  <el-tag
                    v-if="it.paperMentioned"
                   
                    type="success"
                    effect="plain"
                    class="ti-paper"
                    :title="'论文出处：' + (it.paperRef || '')"
                  >
                    📘 {{ shortPaperRef(it.paperRef) }}
                  </el-tag>
                </div>
                <div class="ti-usage">{{ it.usage }}</div>
                <div class="ti-evidence" :title="it.evidence">
                  <el-icon><Document /></el-icon> {{ it.evidence }}
                </div>
              </div>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- ========== 算法举证 ========== -->
      <el-tab-pane name="algo">
        <template #label>
          <span class="tab-label"><el-icon><DataAnalysis /></el-icon> 算法举证（{{ algorithmCards.length }}）</span>
        </template>
        <el-alert type="info" :closable="false" class="er-tip">
          <template #title>
            <b>非 AI 主流程算法</b>：前 4 项为教育算法（题目质量 / 模拟退火组卷 / BKT / CAT），第 5 项是 D36 统计实时化配套服务。
            全部查询时从明细聚合，不新增统计表或统计结果列。
          </template>
        </el-alert>
        <div class="algo-grid">
          <el-card v-for="a in algorithmCards" :key="a.id" shadow="hover" class="algo-card">
            <template #header>
              <div class="algo-head">
                <span class="algo-name">{{ a.name }}</span>
                <el-tag size="small" effect="plain">{{ a.kind }}</el-tag>
              </div>
              <div class="algo-goal">{{ a.goal }}</div>
            </template>
            <div class="algo-block">
              <div class="algo-label">与论文关系</div>
              <div class="algo-text">{{ a.paper }}</div>
            </div>
            <div class="algo-block">
              <div class="algo-label">公式 / 规则</div>
              <ul class="algo-list">
                <li v-for="(f, i) in a.formula" :key="i">{{ f }}</li>
              </ul>
            </div>
            <div class="algo-block">
              <div class="algo-label">数据来源</div>
              <div class="algo-text"><code>{{ a.data }}</code></div>
            </div>
            <div class="algo-block">
              <div class="algo-label">接口</div>
              <div class="algo-text"><code>{{ a.api }}</code></div>
            </div>
            <div class="algo-block">
              <div class="algo-label">前端入口</div>
              <div class="algo-text">{{ a.ui }}</div>
            </div>
            <div class="algo-block">
              <div class="algo-label">实现类</div>
              <div class="algo-text"><code>{{ a.impl }}</code></div>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- ========== 数据表 ========== -->
      <el-tab-pane name="tables">
        <template #label>
          <span class="tab-label"><el-icon><Grid /></el-icon> 数据表（{{ filteredTables.length }}）</span>
        </template>

        <!-- 口径切换：论文要求 vs 系统全部 -->
        <div class="scope-switch">
          <el-radio-group v-model="tableView" size="large" class="scope-radio">
            <el-radio-button value="paper">
              📘 论文口径 · {{ paperCoreTables.length }} 张核心表
            </el-radio-button>
            <el-radio-button value="all">
              🗄 系统全部 · {{ data?.tables?.length ?? 0 }} 张表
            </el-radio-button>
          </el-radio-group>

          <div v-if="tableView === 'paper'" class="scope-hint paper">
            论文 3.3.2 节逐字段设计的 <b>{{ overview?.paperCoreTableCount ?? 0 }}</b> 张核心业务表
            （论文表 3.1 – 表 3.12），共 <b>{{ fmt(overview?.paperCoreColumnCount) }}</b> 个字段。
            其余 <b>{{ overview?.supportTableCount ?? 0 }}</b> 张支撑表见「系统全部」。
          </div>
          <div v-else class="scope-hint all">
            数据库真实全部 <b>{{ overview?.tableCount ?? 0 }}</b> 张表（核心
            <b>{{ overview?.paperCoreTableCount ?? 0 }}</b> + 支撑
            <b>{{ overview?.supportTableCount ?? 0 }}</b>），共
            <b>{{ fmt(overview?.columnCount) }}</b> 个字段。
            标有 <el-tag type="primary" effect="plain">表 3.x</el-tag> 的即论文中详述的核心表。
          </div>
        </div>

        <!-- 模块快捷筛选 -->
        <div class="module-strip">
          <div
            class="module-pill"
            :class="{ active: moduleFilter === '' }"
            @click="focusModule('')"
          >
            全部 <b>{{ currentViewCount }}</b>
          </div>
          <div
            v-for="m in visibleModules"
            :key="m.name"
            class="module-pill"
            :class="{ active: moduleFilter === m.name }"
            @click="focusModule(m.name)"
          >
            {{ m.name }} <b>{{ moduleCountInView(m) }}</b>
          </div>
        </div>

        <div class="table-toolbar">
          <el-input
            v-model="keyword"
            placeholder="搜索表名 / 表注释 / 字段名"
            :prefix-icon="Search"
            clearable
            class="kw-input"
          />
          <el-checkbox v-model="onlyWithData">只看有数据的表</el-checkbox>
          <span class="toolbar-hint">
            当前显示 <b>{{ filteredTables.length }}</b> 张表
            <template v-if="tableView === 'paper'"> / 论文 {{ paperCoreTables.length }} 张</template>
            <template v-else> / 全部 {{ data?.tables?.length ?? 0 }} 张</template>
          </span>
        </div>

        <!-- 表清单（行展开显示字段） -->
        <el-table
          :data="filteredTables"
          row-key="tableName"
          border
          stripe
         
          :expand-row-keys="expandedTables"
          class="table-list"
          @row-click="(row: ArchTable) => focusTable(row.tableName)"
          @expand-change="(_row: ArchTable, rows: ArchTable[]) => (expandedTables = rows.map(r => r.tableName))"
        >
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="col-detail">
                <div class="cd-head">
                  <el-icon><Reading /></el-icon>
                  <b>{{ row.tableName }}</b> 的字段结构（{{ row.columnCount }} 个字段）
                  <span v-if="row.entityClass" class="cd-entity">实体：{{ row.entityClass }}</span>
                </div>
                <el-table :data="row.columns" border class="col-table">
                  <el-table-column prop="ordinal" label="#" width="50" align="center" />
                  <el-table-column prop="name" label="字段名" width="190">
                    <template #default="{ row: c }">
                      <code class="col-name">{{ c.name }}</code>
                    </template>
                  </el-table-column>
                  <el-table-column label="口径" width="72" align="center">
                    <template #default="{ row: c }">
                      <el-tag v-if="c.paperCore" type="success" effect="light">论文</el-tag>
                      <el-tag v-else type="info" effect="plain">扩展</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="类型" width="150">
                    <template #default="{ row: c }">
                      <span class="col-type" :style="{ color: typeColor(c.baseType) }">{{ c.dataType }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="约束" width="130">
                    <template #default="{ row: c }">
                      <el-tag
                        v-for="t in columnTags(c)"
                        :key="t.text"
                       
                        :type="t.type"
                        effect="plain"
                        class="col-tag"
                      >{{ t.text }}</el-tag>
                      <span v-if="c.nullable === 'NO'" class="not-null">NOT NULL</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="中文含义" min-width="200">
                    <template #default="{ row: c }">
                      <span v-if="c.meaning">{{ c.meaning }}</span>
                      <span v-else class="no-comment">—</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="defaultValue" label="默认值" width="110">
                    <template #default="{ row: c }">
                      <span class="default-val">{{ c.defaultValue ?? '-' }}</span>
                    </template>
                  </el-table-column>
                </el-table>

                <!-- 索引与外键 -->
                <div class="cd-extra">
                  <div class="cd-box">
                    <div class="cd-box-title"><el-icon><Key /></el-icon> 索引（{{ row.indexes?.length ?? 0 }}）</div>
                    <div class="idx-list">
                      <span
                        v-for="idx in row.indexes"
                        :key="idx.name"
                        class="idx-chip"
                        :class="idx.type.toLowerCase()"
                      >
                        {{ idx.type === 'PRIMARY' ? '主键' : idx.unique ? '唯一' : '普通' }}：{{ idx.columns }}
                      </span>
                      <span v-if="!row.indexes?.length" class="no-comment">无索引</span>
                    </div>
                  </div>
                  <div class="cd-box">
                    <div class="cd-box-title">
                      <el-icon><Link /></el-icon> 关系（{{ row.foreignKeys?.length ?? 0 }}）
                      <el-tag v-if="row.foreignKeys?.[0]?.inferred" type="warning" effect="plain" class="ml6">
                        推断
                      </el-tag>
                    </div>
                    <div class="fk-list">
                      <span v-for="fk in row.foreignKeys" :key="fk.name" class="fk-chip">
                        {{ fk.column }} → <b>{{ fk.refTable }}</b>.{{ fk.refColumn }}
                      </span>
                      <span v-if="!row.foreignKeys?.length" class="no-comment">无关联</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="tableName" label="表名" width="200" fixed>
            <template #default="{ row }">
              <code class="tbl-name">{{ row.tableName }}</code>
            </template>
          </el-table-column>
          <el-table-column label="论文" width="86" align="center">
            <template #default="{ row }">
              <el-tooltip
                v-if="row.paperTableNo"
                :content="`论文 3.3.2 节 ${row.paperTableNo} 有完整字段设计`"
                placement="top"
              >
                <el-tag type="success" effect="plain">{{ row.paperTableNo }}</el-tag>
              </el-tooltip>
              <span v-else class="no-comment">支撑表</span>
            </template>
          </el-table-column>
          <el-table-column prop="module" label="模块" width="110">
            <template #default="{ row }">
              <el-tag effect="plain">{{ row.module }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="purpose" label="业务职责" min-width="300" show-overflow-tooltip />
          <el-table-column prop="columnCount" label="字段" width="70" align="center" />
          <el-table-column label="数据量" width="110" align="right">
            <template #default="{ row }">
              <span :class="{ 'has-data': row.tableRows > 0 }">{{ fmt(row.exactRows ?? row.tableRows) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="关系" width="90" align="center">
            <template #default="{ row }">
              <el-tag
                v-if="row.foreignKeys?.length"
               
                :type="row.foreignKeys[0].inferred ? 'warning' : 'success'"
                effect="plain"
              >
                {{ row.foreignKeys.length }}{{ row.foreignKeys[0].inferred ? ' 关联' : ' FK' }}
              </el-tag>
              <span v-else class="no-comment">—</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ========== ER 关系 ========== -->
      <el-tab-pane name="er">
        <template #label>
          <span class="tab-label"><el-icon><Connection /></el-icon> 表关系（{{ relations.length }}）</span>
        </template>
        <el-alert
          v-if="overview?.foreignKeyInferred"
          type="warning"
          :closable="false"
          show-icon
          class="er-tip"
          title="数据库未定义真实外键约束（JPA ddl-auto 建表不带 FK），以下关系按命名约定 + 人工核对的语义映射推断得出"
        />
        <div v-if="overview?.foreignKeyInferred" class="er-tip-sub">
          推断规则：① 显式语义映射（student_id / teacher_id / admin_id → sys_user；
          class_id → class_group；tag_id → question_tag …）② 精确同名表（question_id → question）
          ③ 全库唯一后缀命中。任一步无法唯一确定即不连线 —— <b>宁缺毋滥，避免画错关系</b>。
        </div>
        <el-alert
          v-else
          type="success"
          :closable="false"
          show-icon
          class="er-tip"
          title="以下关系全部来自数据库真实外键约束（JDBC DatabaseMetaData.getImportedKeys）"
        />

        <div class="er-grid">
          <el-card v-for="t in tablesWithFk" :key="t.tableName" shadow="hover" class="er-card">
            <template #header>
              <div class="er-head">
                <code class="tbl-name">{{ t.tableName }}</code>
                <el-tag effect="plain">{{ t.module }}</el-tag>
              </div>
              <div class="er-purpose">{{ t.purpose }}</div>
            </template>
            <div class="er-rels">
              <div v-for="fk in t.foreignKeys" :key="fk.name" class="er-rel">
                <span class="er-col">{{ fk.column }}</span>
                <span class="er-arrow">→</span>
                <span class="er-target" @click="focusTable(fk.refTable)">{{ fk.refTable }}</span>
                <span class="er-ref-col">.{{ fk.refColumn }}</span>
              </div>
            </div>
          </el-card>
        </div>

        <el-empty v-if="!tablesWithFk.length" description="当前库未定义外键约束" />
      </el-tab-pane>
    </el-tabs>

    <!-- ==================== 底部口径说明 ==================== -->
    <div class="foot-note">
      <el-icon><DataAnalysis /></el-icon>
      {{ data?.note }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.arch-page {
  padding: 16px 20px 28px;
  min-height: 100%;
  background: #f5f7fa;
}

/* ---------- 算法举证 ---------- */
.algo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
  margin-top: 12px;
}
.algo-card {
  :deep(.el-card__header) {
    padding: 12px 16px;
    background: #fafbfc;
  }
}
.algo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.algo-name {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}
.algo-goal {
  margin-top: 6px;
  font-size: 12px;
  color: #606266;
  line-height: 1.55;
}
.algo-block {
  margin-bottom: 10px;
}
.algo-label {
  font-size: 11px;
  color: #909399;
  margin-bottom: 3px;
}
.algo-text {
  font-size: 12px;
  color: #303133;
  line-height: 1.55;
  code {
    font-size: 11px;
    background: #f0f2f5;
    padding: 1px 5px;
    border-radius: 3px;
  }
}
.algo-list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  color: #303133;
  line-height: 1.65;
}

/* ---------- 页头 ---------- */
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;

  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: 700;
    color: #1f2d3d;
  }

  .sub {
    margin: 0;
    font-size: 13px;
    color: #606266;

    .hl {
      color: #409eff;
      font-size: 15px;
      font-variant-numeric: tabular-nums;
    }
  }

  .head-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
}

/* ---------- 口径切换 ---------- */
.scope-switch {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.scope-radio {
  flex-shrink: 0;

  :deep(.el-radio-button__inner) {
    font-weight: 600;
    letter-spacing: 0.2px;
  }
}

.scope-hint {
  flex: 1;
  min-width: 280px;
  font-size: 12.5px;
  line-height: 1.7;
  padding: 8px 12px;
  border-radius: 8px;

  b {
    font-variant-numeric: tabular-nums;
  }

  &.paper {
    color: #2f6b3a;
    background: #f0f9eb;
    border: 1px solid #e1f3d8;

    b {
      color: #529b2e;
    }
  }

  &.all {
    color: #1d5b8f;
    background: #f0f7ff;
    border: 1px solid #d4e6ff;

    b {
      color: #2b7cc4;
    }
  }
}

/* ---------- 指标卡 ---------- */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  background: #fff;
  border-left: 4px solid #409eff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  transition: transform 0.15s;

  &:hover {
    transform: translateY(-2px);
  }

  .m-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    color: #fff;
    background: #409eff;
    flex-shrink: 0;
  }

  .m-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    color: #1f2d3d;
  }

  .m-label {
    font-size: 12px;
    color: #909399;
    margin-top: 2px;
  }

  &.primary { border-left-color: #409eff; .m-icon { background: #409eff; } }
  &.success { border-left-color: #67c23a; .m-icon { background: #67c23a; } }
  &.warning { border-left-color: #e6a23c; .m-icon { background: #e6a23c; } }
  &.info { border-left-color: #909399; .m-icon { background: #909399; } }
  &.purple { border-left-color: #9b59b6; .m-icon { background: #9b59b6; } }
  &.cyan { border-left-color: #17a2b8; .m-icon { background: #17a2b8; } }
}

/* ---------- 数据库信息条 ---------- */
.db-bar {
  margin-bottom: 14px;
  border-radius: 8px;

  :deep(.el-card__body) {
    padding: 10px 16px;
  }

  .db-inner {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    font-size: 13px;
    color: #606266;
  }

  .db-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;

    b {
      color: #303133;
    }
  }

  .help-icon {
    color: #c0c4cc;
    cursor: help;
    font-size: 14px;

    &:hover {
      color: #409eff;
    }
  }
}

/* ---------- 标签页 ---------- */
.arch-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 14px;
  }
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

/* ---------- 技术栈 ---------- */
/* 论文证据链说明条 */
.tech-paper-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 12px;
  padding: 9px 12px;
  border-radius: 8px;
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
  font-size: 12.5px;
  color: #529b2e;
  line-height: 1.6;

  .note-tag {
    margin: 0 2px;
    vertical-align: 1px;
  }

  b {
    color: #3d7a1f;
  }
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 14px;
}

.tech-card {
  border-radius: 10px;

  .tech-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .tech-layer {
    font-size: 15px;
    font-weight: 700;
    color: #1f2d3d;
  }

  .tech-count {
    font-size: 12px;
    color: #909399;
  }

  .tech-desc {
    margin-top: 4px;
    font-size: 12px;
    color: #909399;
  }

  .tech-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tech-item {
    padding: 8px 10px;
    border-radius: 8px;
    background: #fafbfc;
    border: 1px solid #ebeef5;
  }

  .ti-main {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ti-name {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  .ti-ver {
    font-variant-numeric: tabular-nums;
  }

  /* 论文证据链标注（论文提到的技术要求） */
  .ti-paper {
    cursor: help;
    font-size: 11px;
  }

  .ti-usage {
    margin-top: 4px;
    font-size: 12.5px;
    color: #606266;
    line-height: 1.5;
  }

  .ti-evidence {
    margin-top: 4px;
    font-size: 11px;
    color: #b0b3b8;
    display: flex;
    align-items: center;
    gap: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

/* ---------- 模块快捷条 ---------- */
.module-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.module-pill {
  padding: 5px 12px;
  border-radius: 14px;
  font-size: 12.5px;
  color: #606266;
  background: #fff;
  border: 1px solid #dcdfe6;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;

  b {
    margin-left: 4px;
    color: #409eff;
    font-variant-numeric: tabular-nums;
  }

  &:hover {
    border-color: #409eff;
    color: #409eff;
  }

  &.active {
    background: #409eff;
    border-color: #409eff;
    color: #fff;

    b {
      color: #fff;
    }
  }
}

/* ---------- 表清单 ---------- */
.table-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 10px;

  .kw-input {
    width: 320px;
  }

  .toolbar-hint {
    font-size: 12.5px;
    color: #909399;

    b {
      color: #409eff;
    }
  }
}

.table-list {
  border-radius: 8px;

  :deep(.el-table__row) {
    cursor: pointer;
  }
}

.tbl-name {
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
  font-size: 12.5px;
  color: #409eff;
  background: #f0f7ff;
  padding: 1px 6px;
  border-radius: 4px;
}

.has-data {
  color: #303133;
  font-weight: 600;
}

.no-comment {
  color: #c0c4cc;
}

/* ---------- 行展开：字段明细 ---------- */
.col-detail {
  padding: 12px 16px 16px 48px;
  background: #fcfcfd;
}

.cd-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  color: #303133;

  b {
    font-family: 'JetBrains Mono', Consolas, monospace;
    color: #409eff;
  }

  .cd-entity {
    margin-left: auto;
    font-size: 11.5px;
    color: #909399;
  }
}

.col-table {
  border-radius: 6px;
  overflow: hidden;
}

.col-name {
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
  font-size: 12px;
  color: #303133;
}

.col-type {
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
  font-size: 12px;
}

.col-tag {
  margin-right: 10px;
}

.not-null {
  font-size: 10.5px;
  color: #f56c6c;
  font-weight: 600;
}

.default-val {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11.5px;
  color: #909399;
}

.cd-extra {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}

.cd-box {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px 12px;
}

.cd-box-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 8px;
}

.idx-list,
.fk-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.idx-chip,
.fk-chip {
  font-size: 11.5px;
  font-family: 'JetBrains Mono', Consolas, monospace;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f4f4f5;
  color: #606266;

  &.primary {
    background: #ecf5ff;
    color: #409eff;
    font-weight: 600;
  }

  &.unique {
    background: #fdf6ec;
    color: #e6a23c;
  }
}

.fk-chip {
  background: #f0f9eb;
  color: #529b2e;

  b {
    color: #67c23a;
  }
}

/* ---------- ER ---------- */
.er-tip {
  margin-bottom: 14px;
  border-radius: 8px;
}

.er-tip-sub {
  margin: -6px 0 14px;
  padding: 10px 14px;
  font-size: 12px;
  line-height: 1.7;
  color: #7a5a00;
  background: #fdf6ec;
  border: 1px solid #faecd8;
  border-radius: 8px;

  b {
    color: #b88230;
  }
}

.ml6 {
  margin-left: 6px;
}

.er-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.er-card {
  border-radius: 10px;

  .er-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .er-purpose {
    margin-top: 4px;
    font-size: 12px;
    color: #909399;
    line-height: 1.4;
  }

  .er-rels {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .er-rel {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-family: 'JetBrains Mono', Consolas, monospace;
    padding: 5px 8px;
    background: #fafbfc;
    border-radius: 6px;
  }

  .er-col {
    color: #e6a23c;
    font-weight: 600;
  }

  .er-arrow {
    color: #c0c4cc;
  }

  .er-target {
    color: #409eff;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  .er-ref-col {
    color: #909399;
  }
}

/* ---------- 底部说明 ---------- */
.foot-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 18px;
  padding: 10px 14px;
  font-size: 12px;
  color: #909399;
  background: #fff;
  border-radius: 8px;
  border: 1px dashed #dcdfe6;
}

/* ---------- 响应式 ---------- */
@media (max-width: 1400px) {
  .metric-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 900px) {
  .metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .page-head {
    flex-direction: column;
  }

  .cd-extra {
    grid-template-columns: 1fr;
  }
}
</style>
