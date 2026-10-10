<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Edit, Delete, List, Grid, Document, Files, Star, Setting, MagicStick, Check, DocumentCopy } from '@element-plus/icons-vue'
import { pageAnswerCards, getAnswerCardStats, createAnswerCard, updateAnswerCard, deleteAnswerCard } from '@/api/answerCard'
import type { AnswerCard, AnswerCardForm } from '@/types/answerCard'
import { listPapers } from '@/api/admin'
import { useViewMode } from '@/composables/useViewMode'
import { FormLimits } from '@/utils/formLimits'

/* ---------------- 表单占位示例 ---------------- */
const QUESTION_ORDER_HINT = '{"order":"sequential","columns":1,"typeOrder":["SINGLE","MULTIPLE","FILL_HINT","READING"]}'
const STYLE_CONFIG_HINT = '{"fontSize":14,"lineHeight":1.6,"bgColor":"#FFFFFF","showCardNumber":true,"showScore":true}'

/* ---------------- 视图模式 ---------------- */
const { viewMode, toggleViewMode } = useViewMode('answer_cards')

/* ---------------- 数据 ---------------- */
const list = ref<AnswerCard[]>([])
const total = ref(0)
const loading = ref(false)
const stats = ref<Record<string, number>>({})
const papers = ref<{ id: number; paperName: string }[]>([])

const query = reactive({
  pageNum: 1,
  pageSize: 20,
  paperId: undefined as number | undefined,
  cardName: '',
  isDefault: undefined as boolean | undefined,
})

const load = async () => {
  loading.value = true
  try {
    const res = await pageAnswerCards({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      paperId: query.paperId,
      cardName: query.cardName || undefined,
      isDefault: query.isDefault,
    })
    list.value = res.data?.records ?? []
    total.value = res.data?.total ?? 0
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    const res = await getAnswerCardStats()
    stats.value = res.data ?? {}
  } catch { /* ignore */ }
}

const loadPapers = async () => {
  try {
    const res = await listPapers({ pageNum: 1, pageSize: 200 })
    papers.value = res.data?.records ?? []
  } catch { /* ignore */ }
}

const search = () => { query.pageNum = 1; load() }
const reset = () => {
  query.paperId = undefined
  query.cardName = ''
  query.isDefault = undefined
  query.pageNum = 1
  load()
}

onMounted(() => {
  load()
  loadStats()
  loadPapers()
})

/* ---------------- 统计 ---------------- */
const statsList = computed(() => {
  const total = stats.value.total ?? 0
  const defaults = stats.value.defaults ?? 0
  const globals = stats.value.globals ?? 0
  const paperScoped = stats.value.paperScoped ?? 0
  return [
    { label: '配置总数', value: total, color: '#409EFF', icon: Files, desc: '全部答题卡配置' },
    { label: '默认配置', value: defaults, color: '#E6A23C', icon: Star, desc: '系统默认使用' },
    { label: '全局配置', value: globals, color: '#67C23A', icon: Document, desc: '不关联试卷' },
    { label: '试卷专属', value: paperScoped, color: '#9B59B6', icon: Setting, desc: '关联具体试卷' },
  ]
})

/* ---------------- 工具 ---------------- */
const paperName = (row: AnswerCard) =>
  row.paperId ? (row.paperName || papers.value.find(p => p.id === row.paperId)?.paperName || `试卷 #${row.paperId}`) : '全局通用'

const paperTagType = (row: AnswerCard): 'success' | 'warning' => row.paperId ? 'warning' : 'success'

/* 解析 JSON 配置 → 友好标签 */
interface OrderCfg { order?: string; columns?: number; typeOrder?: string[] }
interface StyleCfg { fontSize?: number; lineHeight?: number; bgColor?: string; showCardNumber?: boolean; showScore?: boolean }

const parseOrder = (str?: string): OrderCfg => {
  if (!str) return {}
  try { return JSON.parse(str) } catch { return {} }
}
const parseStyle = (str?: string): StyleCfg => {
  if (!str) return {}
  try { return JSON.parse(str) } catch { return {} }
}

const orderLabel = (str?: string) => {
  const o = parseOrder(str)
  if (!o.order) return '默认'
  const map: Record<string, string> = { sequential: '顺序', shuffle: '乱序', byType: '按题型' }
  return map[o.order] ?? o.order
}
const orderColor = (str?: string): 'primary' | 'success' | 'warning' | 'info' => {
  const o = parseOrder(str)
  if (o.order === 'shuffle') return 'warning'
  if (o.order === 'byType') return 'success'
  if (o.order === 'sequential') return 'primary'
  return 'info'
}

const columnsLabel = (str?: string) => {
  const o = parseOrder(str)
  return o.columns ? `${o.columns} 列` : '1 列'
}

const typeOrderLabels = (str?: string) => {
  const o = parseOrder(str)
  if (!o.typeOrder || o.typeOrder.length === 0) return []
  const map: Record<string, string> = {
    SINGLE: '单选', MULTIPLE: '多选', FILL_HINT: '填空', READING: '阅读', JUDGE: '判断',
  }
  return o.typeOrder.map(t => map[t] ?? t)
}

const styleChips = (str?: string) => {
  const s = parseStyle(str)
  const chips: string[] = []
  if (s.fontSize) chips.push(`${s.fontSize}px`)
  if (s.lineHeight) chips.push(`行高 ${s.lineHeight}`)
  if (s.bgColor) chips.push(`背景 ${s.bgColor}`)
  if (s.showCardNumber) chips.push('显示卡号')
  if (s.showScore !== undefined) chips.push(s.showScore ? '显示分值' : '隐藏分值')
  return chips
}

/* ---------------- 表格排序 ---------------- */
const sortByPaper = (a: AnswerCard, b: AnswerCard) =>
  String(paperName(a)).localeCompare(String(paperName(b)))
const sortByDefault = (a: AnswerCard, b: AnswerCard) =>
  Number(a.isDefault ? 1 : 0) - Number(b.isDefault ? 1 : 0)

/* ---------------- Dialog ---------------- */
const defaultOrderConfig = '{"order":"sequential","columns":1,"typeOrder":["SINGLE","MULTIPLE","FILL_HINT","READING"]}'
const defaultStyleConfig = '{"fontSize":14,"lineHeight":1.6,"bgColor":"#FFFFFF","showCardNumber":true,"showScore":true}'

const dialogVisible = ref(false)
const form = reactive<AnswerCardForm & { id: number }>({
  id: 0,
  paperId: undefined,
  cardName: '',
  questionOrderConfig: defaultOrderConfig,
  styleConfig: defaultStyleConfig,
  isDefault: false,
})

const openCreate = () => {
  Object.assign(form, {
    id: 0,
    paperId: undefined,
    cardName: '',
    questionOrderConfig: defaultOrderConfig,
    styleConfig: defaultStyleConfig,
    isDefault: false,
  })
  dialogVisible.value = true
}

const openEdit = (row: AnswerCard) => {
  Object.assign(form, {
    id: row.id,
    paperId: row.paperId,
    cardName: row.cardName ?? '',
    questionOrderConfig: row.questionOrderConfig ?? defaultOrderConfig,
    styleConfig: row.styleConfig ?? defaultStyleConfig,
    isDefault: row.isDefault,
  })
  dialogVisible.value = true
}

const submit = async () => {
  if (!form.cardName?.trim()) {
    ElMessage.warning('请填写答题卡名称')
    return
  }
  try {
    if (form.id) {
      await updateAnswerCard(form.id, { ...form })
      ElMessage.success('更新成功')
    } else {
      await createAnswerCard({ ...form })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
    loadStats()
  } catch { /* handled */ }
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该答题卡配置？', '提示', { type: 'warning' })
  await deleteAnswerCard(id)
  ElMessage.success('已删除')
  load()
  loadStats()
}

/* 复制配置（快速创建） */
const handleCopy = (row: AnswerCard) => {
  Object.assign(form, {
    id: 0,
    paperId: row.paperId,
    cardName: (row.cardName ?? '') + ' - 副本',
    questionOrderConfig: row.questionOrderConfig ?? defaultOrderConfig,
    styleConfig: row.styleConfig ?? defaultStyleConfig,
    isDefault: false,
  })
  dialogVisible.value = true
}

/* 设为默认 */
const handleSetDefault = async (row: AnswerCard) => {
  await ElMessageBox.confirm(`确定将「${row.cardName}」设为默认答题卡？`, '提示', { type: 'warning' })
  await updateAnswerCard(row.id, {
    paperId: row.paperId,
    cardName: row.cardName ?? '',
    questionOrderConfig: row.questionOrderConfig ?? '',
    styleConfig: row.styleConfig ?? '',
    isDefault: true,
  })
  ElMessage.success('已设为默认')
  load()
  loadStats()
}

const handlePageChange = () => load()

/* 行样式：默认配置高亮 */
const rowClassName = ({ row }: { row: AnswerCard }) => row.isDefault ? 'default-row' : ''
</script>

<template>
  <div class="page-container">
    <!-- 顶部统计卡片 -->
    <el-row :gutter="12" class="stats-row">
      <el-col v-for="s in statsList" :key="s.label" :xs="12" :sm="12" :md="6" :lg="6">
        <el-card shadow="hover" class="stat-card" :style="{ '--accent': s.color }">
          <div class="stat-card-inner">
            <div class="stat-icon-wrap" :style="{ background: s.color + '15' }">
              <el-icon :size="22" :color="s.color"><component :is="s.icon" /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value" :style="{ color: s.color }">{{ s.value }}</div>
              <div class="stat-label">{{ s.label }}</div>
              <div class="stat-desc">{{ s.desc }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 查询条件 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query" class="filter-form">
        <el-form-item label="名称">
          <el-input v-model="query.cardName" placeholder="答题卡名称" clearable style="width:180px" @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="关联试卷">
          <el-select v-model="query.paperId" placeholder="全部试卷" clearable filterable style="width:220px">
            <el-option v-for="p in papers" :key="p.id" :label="p.paperName" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="是否默认">
          <el-select v-model="query.isDefault" placeholder="全部" clearable style="width:120px">
            <el-option label="默认" :value="true" />
            <el-option label="非默认" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
          <el-button @click="toggleViewMode" :type="viewMode === 'card' ? 'primary' : 'default'">
            <el-icon><List v-if="viewMode === 'card'" /><Grid v-else /></el-icon>
            {{ viewMode === 'card' ? '表格' : '卡片' }}
          </el-button>
          <el-button type="success" @click="openCreate"><el-icon><Plus /></el-icon>新建答题卡</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格视图 -->
    <el-card shadow="never" v-loading="loading" v-if="viewMode === 'table'">
      <el-table :data="list" stripe border style="width:100%" :row-class-name="rowClassName" :default-sort="{ prop: 'createTime', order: 'descending' }">
        <el-table-column type="index" label="#" width="55" align="center" />
        <el-table-column label="名称" min-width="200" prop="cardName" sortable>
          <template #default="{ row }">
            <div class="name-cell">
              <el-icon v-if="row.isDefault" color="#E6A23C" :size="16"><Star /></el-icon>
              <el-icon v-else color="#409EFF" :size="16"><Document /></el-icon>
              <span class="name-text">{{ row.cardName || '-' }}</span>
              <el-tag v-if="row.isDefault" type="warning" effect="dark">默认</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="关联试卷" width="200" show-overflow-tooltip prop="paperId" sortable :sort-method="sortByPaper">
          <template #default="{ row }">
            <el-tag :type="paperTagType(row)" effect="plain">
              {{ paperName(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="默认" width="80" align="center" prop="isDefault" sortable :sort-method="sortByDefault">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" type="warning">默认</el-tag>
            <el-tag v-else type="info" effect="plain">-</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="排序方式" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="orderColor(row.questionOrderConfig)">{{ orderLabel(row.questionOrderConfig) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="列数" width="80" align="center">
          <template #default="{ row }">{{ columnsLabel(row.questionOrderConfig) }}</template>
        </el-table-column>
        <el-table-column label="题型顺序" min-width="180">
          <template #default="{ row }">
            <div class="type-chips">
              <el-tag v-for="t in typeOrderLabels(row.questionOrderConfig)" :key="t" type="info" effect="plain">{{ t }}</el-tag>
              <span v-if="typeOrderLabels(row.questionOrderConfig).length === 0" class="text-muted">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="样式配置" min-width="200">
          <template #default="{ row }">
            <div class="style-chips">
              <el-tag v-for="c in styleChips(row.styleConfig)" :key="c" type="success" effect="plain">{{ c }}</el-tag>
              <span v-if="styleChips(row.styleConfig).length === 0" class="text-muted">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="170" sortable />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEdit(row)"><el-icon><Edit /></el-icon>编辑</el-button>
            <el-button type="info" link @click="handleCopy(row)"><el-icon><DocumentCopy /></el-icon>复制</el-button>
            <el-button v-if="!row.isDefault" type="warning" link @click="handleSetDefault(row)"><el-icon><Star /></el-icon>设默认</el-button>
            <el-button type="danger" link @click="handleDelete(row.id)"><el-icon><Delete /></el-icon>删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @change="handlePageChange"
        style="margin-top:16px;justify-content:flex-end"
      />
    </el-card>

    <!-- 卡片视图 -->
    <div v-else v-loading="loading" class="card-grid">
      <el-card v-for="c in list" :key="c.id" shadow="hover" :class="['answer-card', { 'is-default': c.isDefault }]">
        <!-- 顶部色带 -->
        <div class="card-stripe" :style="{ background: c.isDefault ? 'linear-gradient(90deg, #E6A23C, #F7BA2A)' : 'linear-gradient(90deg, #409EFF, #67C23A)' }"></div>

        <div class="card-body">
          <!-- 头部 -->
          <div class="card-head">
            <div class="head-left">
              <el-icon :size="20" :color="c.isDefault ? '#E6A23C' : '#409EFF'">
                <Star v-if="c.isDefault" /><Document v-else />
              </el-icon>
              <span class="card-title">{{ c.cardName || '未命名' }}</span>
            </div>
            <el-tag v-if="c.isDefault" type="warning" effect="dark">默认</el-tag>
          </div>

          <!-- 关联试卷 -->
          <div class="card-paper">
            <el-icon><Files /></el-icon>
            <el-tag :type="paperTagType(c)" effect="plain">{{ paperName(c) }}</el-tag>
          </div>

          <!-- 题序配置 -->
          <div class="card-section">
            <div class="section-title">
              <el-icon><MagicStick /></el-icon>
              <span>题序配置</span>
            </div>
            <div class="section-body">
              <el-tag :type="orderColor(c.questionOrderConfig)">{{ orderLabel(c.questionOrderConfig) }}</el-tag>
              <el-tag type="info" effect="plain">{{ columnsLabel(c.questionOrderConfig) }}</el-tag>
              <el-tag v-for="t in typeOrderLabels(c.questionOrderConfig)" :key="t" type="info" effect="plain">{{ t }}</el-tag>
            </div>
          </div>

          <!-- 样式配置 -->
          <div class="card-section">
            <div class="section-title">
              <el-icon><Setting /></el-icon>
              <span>样式配置</span>
            </div>
            <div class="section-body">
              <el-tag v-for="chip in styleChips(c.styleConfig)" :key="chip" type="success" effect="plain">{{ chip }}</el-tag>
              <span v-if="styleChips(c.styleConfig).length === 0" class="text-muted">默认样式</span>
            </div>
          </div>

          <!-- 底部 -->
          <div class="card-footer">
            <span class="footer-time">{{ c.createTime }}</span>
            <div class="footer-actions">
              <el-button type="primary" link @click="openEdit(c)"><el-icon><Edit /></el-icon></el-button>
              <el-button type="info" link @click="handleCopy(c)"><el-icon><DocumentCopy /></el-icon></el-button>
              <el-button v-if="!c.isDefault" type="warning" link @click="handleSetDefault(c)"><el-icon><Star /></el-icon></el-button>
              <el-button type="danger" link @click="handleDelete(c.id)"><el-icon><Delete /></el-icon></el-button>
            </div>
          </div>
        </div>
      </el-card>

      <el-empty v-if="!loading && list.length === 0" description="暂无答题卡配置，点击右上角『新建答题卡』开始创建" class="empty-state" />
    </div>

    <!-- 新增/编辑 Dialog -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑答题卡配置' : '新建答题卡配置'" width="720px" destroy-on-close>
      <el-form :model="form" label-width="110px">
        <el-form-item label="名称" required>
          <el-input v-model="form.cardName" placeholder="例如：通用理科答题卡" :maxlength="FormLimits.shortText.max" show-word-limit />
        </el-form-item>
        <el-form-item label="关联试卷">
          <el-select v-model="form.paperId" placeholder="不选则为全局通用" clearable filterable style="width:100%">
            <el-option v-for="p in papers" :key="p.id" :label="p.paperName" :value="p.id" />
          </el-select>
          <div class="form-hint">不关联试卷时，作为全局默认答题卡使用</div>
        </el-form-item>
        <el-form-item label="题序配置">
          <el-input v-model="form.questionOrderConfig" type="textarea" :rows="4" :placeholder="QUESTION_ORDER_HINT" />
          <div class="form-hint">order: sequential 顺序 / shuffle 乱序 / byType 按题型；columns: 列数；typeOrder: 题型排序</div>
        </el-form-item>
        <el-form-item label="样式配置">
          <el-input v-model="form.styleConfig" type="textarea" :rows="4" :placeholder="STYLE_CONFIG_HINT" />
          <div class="form-hint">fontSize 字号 / lineHeight 行高 / bgColor 背景色 / showCardNumber 显示卡号 / showScore 显示分值</div>
        </el-form-item>
        <el-form-item label="设为默认">
          <el-switch v-model="form.isDefault" active-text="默认使用" inactive-text="非默认" />
          <div class="form-hint">默认答题卡在系统未指定具体配置时自动使用</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit"><el-icon><Check /></el-icon>保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { padding: 16px; }

/* ============ 统计卡片 ============ */
.stats-row { margin-bottom: 12px; }
.stat-card {
  border: none;
  border-left: 4px solid var(--accent, #409EFF);
  transition: all 0.25s ease;
  margin-bottom: 8px;
  overflow: hidden;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(64, 158, 255, 0.18);
}
.stat-card-inner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 4px 0;
}
.stat-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-content { flex: 1; min-width: 0; }
.stat-value { font-size: 26px; font-weight: 700; line-height: 1.2; }
.stat-label { font-size: 13px; color: #303133; margin-top: 2px; font-weight: 500; }
.stat-desc { font-size: 11px; color: #909399; margin-top: 2px; }

/* ============ 筛选 ============ */
.filter-card { margin-bottom: 12px; }
.filter-form { display: flex; flex-wrap: wrap; gap: 0; }

/* ============ 表格 ============ */
.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.name-text {
  font-weight: 500;
  color: #303133;
}
.type-chips, .style-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.text-muted { color: #c0c4cc; font-size: 12px; }

:deep(.default-row) {
  background: linear-gradient(90deg, #fdf6ec 0%, #ffffff 100%) !important;
}
:deep(.default-row:hover > td) {
  background: #fdf6ec !important;
}

/* ============ 卡片网格 ============ */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}
.answer-card {
  transition: all 0.25s ease;
  border: 1px solid #ebeef5;
  overflow: hidden;
  position: relative;
}
.answer-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(64, 158, 255, 0.18);
  border-color: #409EFF66;
}
.answer-card.is-default {
  border-color: #E6A23C66;
}
.answer-card.is-default:hover {
  box-shadow: 0 12px 32px rgba(230, 162, 60, 0.22);
  border-color: #E6A23C;
}
.card-stripe {
  height: 4px;
  width: 100%;
}
.card-body {
  padding: 14px 16px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.head-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-paper {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #606266;
}
.card-section {
  background: #f7f9fc;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
  font-weight: 500;
}
.section-body {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #ebeef5;
}
.footer-time {
  font-size: 12px;
  color: #909399;
}
.footer-actions {
  display: flex;
  gap: 4px;
}
.empty-state { grid-column: 1 / -1; padding: 60px 0; }

/* ============ Dialog ============ */
.form-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}
</style>

<!-- 原始版本保留为注释（已迁移到上方扩展版）
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listAnswerCards, createAnswerCard, updateAnswerCard, deleteAnswerCard } from '@/api/answerCard'
import type { AnswerCard, AnswerCardForm } from '@/types/answerCard'
import { listPapers } from '@/api/admin'

const cards = ref<AnswerCard[]>([])
const loading = ref(false)
const papers = ref<{ id: number; paperName: string }[]>([])

const load = async () => {
  loading.value = true
  try {
    const [cardRes, paperRes] = await Promise.all([
      listAnswerCards(), listPapers({ pageNum: 1, pageSize: 100 })
    ])
    cards.value = cardRes.data ?? []
    papers.value = paperRes.data?.records ?? []
  } finally { loading.value = false }
}

onMounted(load)

const dialogVisible = ref(false)
const form = reactive<AnswerCardForm & { id: number }>({
  id: 0, paperId: undefined, cardName: '',
  questionOrderConfig: '{"orderBy":"TYPE","typeOrder":["SINGLE","MULTIPLE","FILL_HINT","READING"]}',
  styleConfig: '{"bgColor":"#F5F7FA","fontSize":14,"optionLayout":"HORIZONTAL","showCardNumber":true}',
  isDefault: false,
})

const openCreate = () => {
  Object.assign(form, { id: 0, paperId: undefined, cardName: '', questionOrderConfig: '{"orderBy":"TYPE","typeOrder":["SINGLE","MULTIPLE","FILL_HINT","READING"]}', styleConfig: '{"bgColor":"#F5F7FA","fontSize":14,"optionLayout":"HORIZONTAL","showCardNumber":true}', isDefault: false })
  dialogVisible.value = true
}

const openEdit = (row: AnswerCard) => {
  Object.assign(form, { id: row.id, paperId: row.paperId, cardName: row.cardName ?? '', questionOrderConfig: row.questionOrderConfig ?? '', styleConfig: row.styleConfig ?? '', isDefault: row.isDefault })
  dialogVisible.value = true
}

const submit = async () => {
  try {
    if (form.id) { await updateAnswerCard(form.id, { ...form }); ElMessage.success('更新成功') }
    else { await createAnswerCard({ ...form }); ElMessage.success('创建成功') }
    dialogVisible.value = false
    load()
  } catch { }
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' })
  await deleteAnswerCard(id)
  ElMessage.success('已删除')
  load()
}
</script>

<template>
  <div class="page-container">
    <el-card>
      <div style="margin-bottom:16px"><el-button type="success" @click="openCreate">+ 新建答题卡</el-button></div>
      <el-table :data="cards" v-loading="loading" stripe border>
        <el-table-column prop="cardName" label="名称" min-width="150" />
        <el-table-column label="试卷" width="200">
          <template #default="{ row }">{{ row.paperId ? (papers.find(p => p.id === row.paperId)?.paperName ?? row.paperId) : '全局默认' }}</template>
        </el-table-column>
        <el-table-column label="默认" width="80">
          <template #default="{ row }"><el-tag v-if="row.isDefault" type="success">默认</el-tag></template>
        </el-table-column>
        <el-table-column label="题序配置" min-width="200">
          <template #default="{ row }"><code style="font-size:12px">{{ row.questionOrderConfig?.substring(0, 50) }}...</code></template>
        </el-table-column>
        <el-table-column label="样式配置" min-width="200">
          <template #default="{ row }"><code style="font-size:12px">{{ row.styleConfig?.substring(0, 50) }}...</code></template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="答题卡配置" width="600px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="关联试卷">
          <el-select v-model="form.paperId" placeholder="不选则为全局默认" clearable style="width:100%">
            <el-option v-for="p in papers" :key="p.id" :label="p.paperName" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="form.cardName" placeholder="答题卡名称" /></el-form-item>
        <el-form-item label="题序配置">
          <el-input v-model="form.questionOrderConfig" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="样式配置">
          <el-input v-model="form.styleConfig" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="设为默认"><el-switch v-model="form.isDefault" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="submit">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { padding: 16px; }
</style>
-->
