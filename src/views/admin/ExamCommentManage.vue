<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Edit, Delete, List, Grid, View, Check } from '@element-plus/icons-vue'
import {
  pageExamComments,
  getExamCommentStats,
  createExamComment,
  updateExamComment,
  deleteExamComment,
  markCommentRead,
} from '@/api/examComment'
import { listExamRecords, listTeachers } from '@/api/admin'
import type { ExamComment, ExamCommentForm } from '@/types/examComment'
import type { ExamRecord } from '@/types/exam'
import type { UserDetail } from '@/types/user'
import { useViewMode } from '@/composables/useViewMode'

/* ---------------- 视图模式 ---------------- */
const { viewMode, toggleViewMode } = useViewMode('exam_comments')

/* ---------------- 数据 ---------------- */
const list = ref<ExamComment[]>([])
const total = ref(0)
const loading = ref(false)
const stats = ref<Record<string, number>>({})

/* 考试记录 / 老师列表（用于选择器） */
const examRecords = ref<ExamRecord[]>([])
const teachers = ref<UserDetail[]>([])

const query = reactive({
  pageNum: 1,
  pageSize: 50,
  commentType: '' as string,
  isRead: undefined as boolean | undefined,
  examId: undefined as number | undefined,
  teacherId: undefined as number | undefined,
})

const load = async () => {
  loading.value = true
  try {
    const res = await pageExamComments({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      commentType: query.commentType || undefined,
      isRead: query.isRead,
      examId: query.examId,
      teacherId: query.teacherId,
    })
    list.value = res.data?.records ?? []
    total.value = res.data?.total ?? 0
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    const res = await getExamCommentStats()
    stats.value = res.data ?? {}
  } catch { /* ignore */ }
}

const loadExamRecords = async () => {
  try {
    const res = await listExamRecords({ pageNum: 1, pageSize: 200 })
    examRecords.value = res.data?.records ?? []
  } catch { /* ignore */ }
}

const loadTeachers = async () => {
  try {
    const res = await listTeachers()
    teachers.value = res.data?.records ?? []
  } catch { /* ignore */ }
}

const search = () => {
  query.pageNum = 1
  load()
}

const reset = () => {
  query.commentType = ''
  query.isRead = undefined
  query.examId = undefined
  query.teacherId = undefined
  query.pageNum = 1
  load()
}

onMounted(() => {
  load()
  loadStats()
  loadExamRecords()
  loadTeachers()
})

/* ---------------- 考试记录 / 老师 formatter ---------------- */
const examLabel = (id?: number) => {
  if (!id) return ''
  const r = examRecords.value.find(e => e.id === id)
  if (!r) return `#${id}`
  const who = r.realName || r.username || ''
  const paper = r.paperName || ''
  return `#${id} ${who}${paper ? ' · ' + paper : ''}`
}

/* ---------------- 考试记录选择器搜索 ---------------- */
const examFilter = ref('')
const filteredExams = computed(() => {
  if (!examFilter.value) return examRecords.value
  const kw = examFilter.value.toLowerCase()
  return examRecords.value.filter(e => {
    const label = examLabel(e.id).toLowerCase()
    return label.includes(kw)
  })
})
const filterExam = (val: string) => { examFilter.value = val }

/* ---------------- 表格排序方法 ---------------- */
const sortByType = (a: ExamComment, b: ExamComment) =>
  String(a.commentType || '').localeCompare(String(b.commentType || ''))
const sortByRead = (a: ExamComment, b: ExamComment) =>
  Number(a.isRead ? 1 : 0) - Number(b.isRead ? 1 : 0)

/* ---------------- 类型字典 ---------------- */
const commentTypeOptions = [
  { value: 'OVERALL', label: '总体评价', color: 'primary' },
  { value: 'STRENGTHS', label: '优点', color: 'success' },
  { value: 'IMPROVEMENT', label: '改进建议', color: 'warning' },
  { value: 'TARGET', label: '下次目标', color: 'info' },
  { value: 'ENCOURAGEMENT', label: '鼓励', color: 'success' },
] as const

const getTypeLabel = (type: string) => commentTypeOptions.find(o => o.value === type)?.label ?? type
const getTypeColor = (type: string) => commentTypeOptions.find(o => o.value === type)?.color ?? 'info'

/* ---------------- 统计 ---------------- */
const statsList = computed(() => [
  { label: '评语总数', value: stats.value.total ?? 0, color: '#409EFF' },
  { label: '未读评语', value: stats.value.unread ?? 0, color: '#E6A23C' },
  { label: '总体评价', value: stats.value.overall ?? 0, color: '#67C23A' },
  { label: '优点记录', value: stats.value.strengths ?? 0, color: '#909399' },
  { label: '改进建议', value: stats.value.improvement ?? 0, color: '#F56C6C' },
])

/* ---------------- Dialog ---------------- */
const dialogVisible = ref(false)
const form = reactive<ExamCommentForm & { id: number }>({
  id: 0,
  examId: 0,
  commentType: 'OVERALL',
  content: '',
  ratingLevel: 3,
  parentCommentId: undefined,
})

const openCreate = (parentId?: number) => {
  Object.assign(form, {
    id: 0,
    examId: query.examId ?? 0,
    commentType: 'OVERALL',
    content: '',
    ratingLevel: 3,
    parentCommentId: parentId,
  })
  dialogVisible.value = true
}

const openEdit = (row: ExamComment) => {
  Object.assign(form, {
    id: row.id,
    examId: row.examId,
    commentType: row.commentType,
    content: row.content,
    ratingLevel: row.ratingLevel,
    parentCommentId: row.parentCommentId,
  })
  dialogVisible.value = true
}

const submit = async () => {
  if (!form.content.trim()) {
    ElMessage.warning('请输入评语内容')
    return
  }
  if (!form.examId) {
    ElMessage.warning('请填写考试记录ID')
    return
  }
  try {
    if (form.id) {
      await updateExamComment(form.id, { ...form })
      ElMessage.success('更新成功')
    } else {
      await createExamComment({ ...form })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
    loadStats()
  } catch { /* handled */ }
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该评语？', '提示', { type: 'warning' })
  await deleteExamComment(id)
  ElMessage.success('已删除')
  load()
  loadStats()
}

const handleMarkRead = async (id: number) => {
  await markCommentRead(id)
  ElMessage.success('已标记已读')
  load()
  loadStats()
}

const handlePageChange = () => load()
</script>

<template>
  <div class="page-container">
    <!-- 顶部统计卡片 -->
    <el-row :gutter="12" class="stats-row">
      <el-col v-for="s in statsList" :key="s.label" :xs="12" :sm="8" :md="4" :lg="4">
        <el-card shadow="hover" class="stat-card" :style="{ '--accent': s.color }">
          <div class="stat-value" :style="{ color: s.color }">{{ s.value }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 查询条件 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query" class="filter-form">
        <el-form-item label="考试记录">
          <el-select v-model="query.examId" placeholder="选择考试记录" clearable filterable style="width:280px" :filter-method="filterExam">
            <el-option v-for="e in filteredExams" :key="e.id" :label="examLabel(e.id)" :value="e.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="老师">
          <el-select v-model="query.teacherId" placeholder="选择老师" clearable filterable style="width:200px">
            <el-option v-for="t in teachers" :key="t.id" :label="`${t.realName || t.username} (#${t.id})`" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="query.commentType" placeholder="全部" clearable style="width:140px">
            <el-option v-for="o in commentTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="阅读状态">
          <el-select v-model="query.isRead" placeholder="全部" clearable style="width:120px">
            <el-option label="未读" :value="false" />
            <el-option label="已读" :value="true" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
          <el-button @click="toggleViewMode" :type="viewMode === 'card' ? 'primary' : 'default'" size="small">
            <el-icon><List v-if="viewMode === 'card'" /><Grid v-else /></el-icon>
            {{ viewMode === 'card' ? '表格' : '卡片' }}
          </el-button>
          <el-button type="success" @click="openCreate()"><el-icon><Plus /></el-icon>发表评语</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格视图 -->
    <el-card shadow="never" v-loading="loading" v-if="viewMode === 'table'">
      <el-table :data="list" stripe border style="width:100%" :default-sort="{ prop: 'createTime', order: 'descending' }">
        <el-table-column type="index" label="#" width="55" align="center" />
        <el-table-column prop="examId" label="考试ID" width="90" align="center" sortable />
        <el-table-column label="学生" width="130" prop="studentName" sortable>
          <template #default="{ row }">
            <div style="display:flex;align-items:center;gap:6px">
              <el-avatar :size="28"><el-icon><View /></el-icon></el-avatar>
              <span>{{ row.studentName || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="老师" width="120" prop="teacherName" sortable />
        <el-table-column label="类型" width="110" align="center" prop="commentType" sortable :sort-method="sortByType">
          <template #default="{ row }">
            <el-tag :type="getTypeColor(row.commentType)" size="small">{{ getTypeLabel(row.commentType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="评分" width="160" prop="ratingLevel" sortable>
          <template #default="{ row }">
            <el-rate v-model="row.ratingLevel" :max="5" disabled size="small" show-score />
          </template>
        </el-table-column>
        <el-table-column prop="content" label="评语内容" min-width="280" show-overflow-tooltip />
        <el-table-column label="阅读" width="80" align="center" prop="isRead" sortable :sort-method="sortByRead">
          <template #default="{ row }">
            <el-tag :type="row.isRead ? 'success' : 'danger'" size="small">{{ row.isRead ? '已读' : '未读' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="170" sortable />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button v-if="!row.isRead" size="small" type="success" link @click="handleMarkRead(row.id)">
              <el-icon><Check /></el-icon>已读
            </el-button>
            <el-button size="small" type="primary" link @click="openEdit(row)"><el-icon><Edit /></el-icon>编辑</el-button>
            <el-button size="small" type="danger" link @click="handleDelete(row.id)"><el-icon><Delete /></el-icon>删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100, 200, 500, 1000]"
        layout="total, sizes, prev, pager, next, jumper"
        @change="handlePageChange"
        style="margin-top:16px;justify-content:flex-end"
      />
    </el-card>

    <!-- 卡片视图 -->
    <div v-else v-loading="loading" class="card-grid">
      <el-card
        v-for="c in list"
        :key="c.id"
        shadow="hover"
        class="comment-card"
      >
        <div class="card-head">
          <el-tag :type="getTypeColor(c.commentType)" size="small">{{ getTypeLabel(c.commentType) }}</el-tag>
          <el-rate v-model="c.ratingLevel" :max="5" disabled size="small" show-score />
          <el-tag :type="c.isRead ? 'success' : 'danger'" size="small" effect="plain">
            {{ c.isRead ? '已读' : '未读' }}
          </el-tag>
        </div>
        <div class="card-content">{{ c.content }}</div>
        <div class="card-meta">
          <el-avatar :size="24"><el-icon><View /></el-icon></el-avatar>
          <span class="meta-name">{{ c.studentName || '学生' }}</span>
          <span class="meta-sep">·</span>
          <span>{{ c.teacherName || '老师' }}</span>
          <span class="meta-sep">·</span>
          <span>考试#{{ c.examId }}</span>
        </div>
        <div class="card-time">{{ c.createTime }}</div>
        <div class="card-actions">
          <el-button v-if="!c.isRead" size="small" type="success" @click="handleMarkRead(c.id)">
            <el-icon><Check /></el-icon>标记已读
          </el-button>
          <el-button size="small" type="primary" @click="openEdit(c)"><el-icon><Edit /></el-icon>编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(c.id)"><el-icon><Delete /></el-icon>删除</el-button>
        </div>
      </el-card>

      <el-empty v-if="!loading && list.length === 0" description="暂无评语数据" class="empty-state" />
    </div>

    <!-- 新增/编辑 Dialog -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑评语' : (form.parentCommentId ? '回复评语' : '发表评语')" width="600px" destroy-on-close>
      <el-form :model="form" label-width="90px">
        <el-form-item label="考试记录" required>
          <el-select v-model="form.examId" placeholder="选择考试记录" filterable style="width:100%">
            <el-option v-for="e in examRecords" :key="e.id" :label="examLabel(e.id)" :value="e.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="评语类型">
          <el-select v-model="form.commentType" style="width:100%">
            <el-option v-for="o in commentTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="评分等级">
          <el-rate v-model="form.ratingLevel" :max="5" show-score />
        </el-form-item>
        <el-form-item label="评语内容" required>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="5"
            maxlength="1000"
            show-word-limit
            placeholder="请输入评语内容，建议针对本次考试表现给出具体反馈"
          />
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

/* 统计卡片 */
.stats-row { margin-bottom: 12px; }
.stat-card {
  text-align: center;
  border-left: 4px solid var(--accent, #409EFF);
  transition: all 0.25s ease;
  margin-bottom: 8px;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(64, 158, 255, 0.18);
}
.stat-value { font-size: 28px; font-weight: 700; line-height: 1.2; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }

/* 筛选 */
.filter-card { margin-bottom: 12px; }
.filter-form { display: flex; flex-wrap: wrap; gap: 0; }

/* 卡片网格 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 14px;
}
.comment-card {
  transition: all 0.25s ease;
  border: 1px solid #ebeef5;
}
.comment-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(64, 158, 255, 0.16);
  border-color: #409EFF55;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.card-content {
  font-size: 14px;
  line-height: 1.6;
  color: #303133;
  margin: 8px 0;
  white-space: pre-wrap;
  max-height: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
}
.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #606266;
  margin-top: 8px;
}
.meta-name { font-weight: 600; color: #303133; }
.meta-sep { color: #c0c4cc; }
.card-time {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #ebeef5;
}
.empty-state { grid-column: 1 / -1; padding: 60px 0; }
</style>

<!-- 原始版本保留为注释（已迁移到上方扩展版）
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getExamComments, createExamComment, updateExamComment, deleteExamComment } from '@/api/examComment'
import type { ExamComment, ExamCommentForm } from '@/types/examComment'

const comments = ref<ExamComment[]>([])
const loading = ref(false)
const examId = ref<number>()

const load = async () => {
  if (!examId.value) return
  loading.value = true
  try {
    const res = await getExamComments(examId.value)
    comments.value = res.data ?? []
  } finally { loading.value = false }
}

const commentTypeOptions = [
  { value: 'OVERALL', label: '总体评价' },
  { value: 'STRENGTHS', label: '优点' },
  { value: 'IMPROVEMENT', label: '改进建议' },
  { value: 'TARGET', label: '下次目标' },
  { value: 'ENCOURAGEMENT', label: '鼓励' },
]

const dialogVisible = ref(false)
const form = reactive<ExamCommentForm & { id: number }>({
  id: 0, examId: 0, commentType: 'OVERALL', content: '', ratingLevel: 3, parentCommentId: undefined,
})

const openCreate = (parentId?: number) => {
  Object.assign(form, { id: 0, examId: examId.value ?? 0, commentType: 'OVERALL', content: '', ratingLevel: 3, parentCommentId: parentId })
  dialogVisible.value = true
}

const openEdit = (row: ExamComment) => {
  Object.assign(form, { id: row.id, examId: row.examId, commentType: row.commentType, content: row.content, ratingLevel: row.ratingLevel, parentCommentId: row.parentCommentId })
  dialogVisible.value = true
}

const submit = async () => {
  try {
    if (form.id) { await updateExamComment(form.id, { ...form }); ElMessage.success('更新成功') }
    else { await createExamComment({ ...form }); ElMessage.success('创建成功') }
    dialogVisible.value = false
    load()
  } catch { }
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' })
  await deleteExamComment(id); ElMessage.success('已删除'); load()
}

const getTypeLabel = (type: string) => commentTypeOptions.find(o => o.value === type)?.label ?? type

onMounted(load)
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>考试评语</span>
          <div>
            <el-input v-model="examId" placeholder="输入考试记录ID" style="width:160px;margin-right:8px" @keyup.enter="load" />
            <el-button type="primary" @click="load">查询</el-button>
            <el-button type="success" @click="openCreate()" :disabled="!examId">+ 发表评语</el-button>
          </div>
        </div>
      </template>

      <div v-if="comments.length === 0 && !loading"><el-empty description="请先输入考试记录ID查询" /></div>

      <div v-for="c in comments.filter(c => !c.parentCommentId)" :key="c.id" style="margin-bottom:16px;border-bottom:1px solid #eee;padding-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <el-tag size="small" type="primary">{{ getTypeLabel(c.commentType) }}</el-tag>
          <el-rate v-model="c.ratingLevel" :max="5" disabled size="small" show-score />
          <span style="font-size:12px;color:#999">{{ c.teacherName }} · {{ c.createTime }}</span>
        </div>
        <div style="margin-left:8px;white-space:pre-wrap">{{ c.content }}</div>
        <div style="margin-top:6px">
          <el-button size="small" text @click="openCreate(c.id)">回复</el-button>
          <el-button size="small" text type="primary" @click="openEdit(c)">编辑</el-button>
          <el-button size="small" text type="danger" @click="handleDelete(c.id)">删除</el-button>
        </div>
        <div v-if="c.replies?.length" style="margin-left:24px;margin-top:8px">
          <div v-for="r in c.replies" :key="r.id" style="background:#f5f7fa;padding:8px 12px;margin-bottom:4px;border-radius:4px">
            <div style="font-size:12px;color:#999;margin-bottom:4px">{{ r.teacherName }} · {{ r.createTime }}</div>
            <div>{{ r.content }}</div>
            <el-button size="small" text type="danger" @click="handleDelete(r.id)">删除</el-button>
          </div>
        </div>
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑评语' : (form.parentCommentId ? '回复评语' : '发表评语')" width="550px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="类型"><el-select v-model="form.commentType" style="width:100%"><el-option v-for="o in commentTypeOptions" :key="o.value" :label="o.label" :value="o.value" /></el-select></el-form-item>
        <el-form-item label="评分"><el-rate v-model="form.ratingLevel" :max="5" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="4" placeholder="请输入评语内容" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="submit">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { padding: 16px; }
</style>
-->
