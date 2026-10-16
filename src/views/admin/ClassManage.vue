<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Search, Refresh, Plus, Edit, Delete, List, Grid, View, User, School, Reading, Check, Close, UserFilled } from '@element-plus/icons-vue'
import { listClassGroups, getClassGroupStats, getClassGroup, createClassGroup, updateClassGroup, deleteClassGroup, getClassStudents, assignClassStudents, removeClassStudent } from '@/api/classGroup'
import { listUsers as listUsersApi } from '@/api/admin'
import type { ClassGroup, ClassGroupForm, ClassStudent } from '@/types/classGroup'
import { useViewMode } from '@/composables/useViewMode'
import { FormLimits } from '@/utils/formLimits'

/* ---------------- 视图模式 ---------------- */
const { viewMode, toggleViewMode } = useViewMode('classes')

/* ---------------- 数据 ---------------- */
const classes = ref<ClassGroup[]>([])
const loading = ref(false)
const total = ref(0)
const stats = ref<Record<string, number>>({})

const query = reactive({
  pageNum: 1,
  pageSize: 50,
  className: '',
  schoolName: '',
  grade: '',
  status: undefined as number | undefined,
})

const load = async () => {
  loading.value = true
  try {
    const res = await listClassGroups({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      className: query.className || undefined,
      schoolName: query.schoolName || undefined,
      grade: query.grade || undefined,
      status: query.status,
    })
    classes.value = res.data?.records ?? []
    total.value = res.data?.total ?? 0
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    const res = await getClassGroupStats()
    stats.value = res.data ?? {}
  } catch { /* ignore */ }
}

const search = () => { query.pageNum = 1; load() }
const reset = () => {
  query.className = ''
  query.schoolName = ''
  query.grade = ''
  query.status = undefined
  query.pageNum = 1
  load()
}

onMounted(() => {
  load()
  loadStats()
})

/* ---------------- 统计 ---------------- */
const statsList = computed(() => [
  { label: '班级总数', value: stats.value.total ?? 0, color: '#409EFF', icon: School },
  { label: '启用班级', value: stats.value.active ?? 0, color: '#67C23A', icon: Check },
  { label: '停用班级', value: stats.value.inactive ?? 0, color: '#909399', icon: Close },
  { label: '负责老师', value: stats.value.teachers ?? 0, color: '#E6A23C', icon: User },
  { label: '学生总数', value: stats.value.totalStudents ?? 0, color: '#F56C6C', icon: UserFilled },
])

/* ---- Group Dialog ---- */
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<ClassGroupForm & { id: number }>({ id: 0, className: '', schoolName: '', grade: '', description: '', status: 1 })
const rules: FormRules = { className: [{ required: true, message: '请输入班级名称', trigger: 'blur' }] }

const openCreate = () => {
  Object.assign(form, { id: 0, className: '', schoolName: '', grade: '', description: '', status: 1 })
  dialogVisible.value = true
}
const openEdit = async (row: ClassGroup) => {
  const res = await getClassGroup(row.id)
  const d = res.data
  Object.assign(form, { id: d.id, className: d.className, schoolName: d.schoolName ?? '', grade: d.grade ?? '', description: d.description ?? '', status: d.status })
  dialogVisible.value = true
}
const submit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    try {
      if (form.id) { await updateClassGroup(form.id, { ...form }); ElMessage.success('更新成功') }
      else { await createClassGroup({ ...form }); ElMessage.success('创建成功') }
      dialogVisible.value = false
      load()
      loadStats()
    } catch { /* handled */ }
  })
}
const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该班级？', '提示', { type: 'warning' })
  await deleteClassGroup(id)
  ElMessage.success('已删除')
  load()
  loadStats()
}

/* ---- Students Dialog ---- */
const studentDialogVisible = ref(false)
const currentClass = ref<ClassGroup | null>(null)
const classStudents = ref<ClassStudent[]>([])
const allStudents = ref<{ id: number; username: string; realName?: string | undefined; avatar?: string | undefined }[]>([])
const selectedStudentIds = ref<number[]>([])
const studentLoading = ref(false)

const openStudents = async (row: ClassGroup) => {
  currentClass.value = row
  studentLoading.value = true
  try {
    const [stuRes, allRes] = await Promise.all([
      getClassStudents(row.id), listUsersApi({ pageNum: 1, pageSize: 500, role: 'STUDENT' })
    ])
    classStudents.value = stuRes.data ?? []
    allStudents.value = allRes.data?.records ?? []
    selectedStudentIds.value = classStudents.value.map(s => s.studentId)
  } catch { /* ignore */ } finally {
    studentLoading.value = false
  }
  studentDialogVisible.value = true
}

const saveStudents = async () => {
  if (!currentClass.value) return
  await assignClassStudents(currentClass.value.id, selectedStudentIds.value)
  ElMessage.success('已保存')
  studentDialogVisible.value = false
  load()
  loadStats()
}

const removeStudent = async (classId: number, studentId: number) => {
  await ElMessageBox.confirm('确定从该班级移除此学生？', '提示', { type: 'warning' })
  await removeClassStudent(classId, studentId)
  ElMessage.success('已移除')
  classStudents.value = classStudents.value.filter(s => s.studentId !== studentId)
  loadStats()
}


/* ---------------- 表格排序 ---------------- */
const sortByStatus = (a: ClassGroup, b: ClassGroup) =>
  Number(a.status ?? 0) - Number(b.status ?? 0)

const handlePageChange = () => load()
</script>

<template>
  <div class="page-container">
    <!-- 顶部统计卡片 -->
    <el-row :gutter="12" class="stats-row">
      <el-col v-for="s in statsList" :key="s.label" :xs="12" :sm="8" :md="6" :lg="4" :xl="4">
        <el-card shadow="hover" class="stat-card" :style="{ '--accent': s.color }">
          <div class="stat-head">
            <el-icon :size="20" :color="s.color"><component :is="s.icon" /></el-icon>
            <div class="stat-value" :style="{ color: s.color }">{{ s.value }}</div>
          </div>
          <div class="stat-label">{{ s.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 查询条件 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query" class="filter-form">
        <el-form-item label="班级名称">
          <el-input v-model="query.className" placeholder="班级名称" clearable style="width:160px" @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="学校">
          <el-input v-model="query.schoolName" placeholder="学校名称" clearable style="width:160px" @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="年级">
          <el-input v-model="query.grade" placeholder="例如：高三" clearable style="width:120px" @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width:120px">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
          <el-button @click="toggleViewMode" :type="viewMode === 'card' ? 'primary' : 'default'" size="small">
            <el-icon><List v-if="viewMode === 'card'" /><Grid v-else /></el-icon>
            {{ viewMode === 'card' ? '表格' : '卡片' }}
          </el-button>
          <el-button type="success" @click="openCreate"><el-icon><Plus /></el-icon>新建班级</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格视图 -->
    <el-card shadow="never" v-loading="loading" v-if="viewMode === 'table'">
      <el-table :data="classes" stripe border style="width:100%" :default-sort="{ prop: 'createTime', order: 'descending' }">
        <el-table-column type="index" label="#" width="55" align="center" />
        <el-table-column label="班级名称" min-width="160" prop="className" sortable>
          <template #default="{ row }">
            <div style="display:flex;align-items:center;gap:6px">
              <el-icon color="#409EFF"><School /></el-icon>
              <span style="font-weight:600">{{ row.className }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="schoolName" label="学校" width="140" show-overflow-tooltip sortable />
        <el-table-column prop="grade" label="年级" width="80" align="center" sortable>
          <template #default="{ row }">
            <el-tag v-if="row.grade" type="info" size="small" effect="plain">{{ row.grade }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="负责老师" width="120" prop="teacherName" sortable>
          <template #default="{ row }">
            <div style="display:flex;align-items:center;gap:4px">
              <el-icon><User /></el-icon>
              <span>{{ row.teacherName || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="学生数" width="90" align="center" prop="studentCount" sortable>
          <template #default="{ row }">
            <el-tag type="primary" size="small">{{ row.studentCount ?? 0 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center" prop="status" sortable :sort-method="sortByStatus">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="170" sortable />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="warning" link @click="openStudents(row)"><el-icon><User /></el-icon>学生</el-button>
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
      <el-card v-for="c in classes" :key="c.id" shadow="hover" class="class-card">
        <div class="card-head">
          <el-icon :size="22" color="#409EFF"><School /></el-icon>
          <span class="card-title">{{ c.className }}</span>
          <el-tag :type="c.status === 1 ? 'success' : 'info'" size="small">{{ c.status === 1 ? '启用' : '停用' }}</el-tag>
        </div>
        <div class="card-info">
          <div class="info-item">
            <el-icon><Reading /></el-icon>
            <span>{{ c.schoolName || '未填写学校' }}</span>
          </div>
          <div class="info-item">
            <el-icon><User /></el-icon>
            <span>{{ c.teacherName || '未指派老师' }}</span>
          </div>
          <div class="info-item" v-if="c.grade">
            <el-icon><View /></el-icon>
            <span>{{ c.grade }}</span>
          </div>
        </div>
        <div class="card-students" v-if="c.students && c.students.length > 0">
          <div class="students-title">学生（{{ c.studentCount }}）</div>
          <div class="students-avatars">
            <el-avatar v-for="s in c.students.slice(0, 8)" :key="s.id" :size="28" :src="s.avatar || ''">
              <el-icon><UserFilled /></el-icon>
            </el-avatar>
            <span v-if="c.studentCount > 8" class="more-count">+{{ c.studentCount - 8 }}</span>
          </div>
        </div>
        <div class="card-time">{{ c.createTime }}</div>
        <div class="card-actions">
          <el-button size="small" type="warning" @click="openStudents(c)"><el-icon><User /></el-icon>学生</el-button>
          <el-button size="small" type="primary" @click="openEdit(c)"><el-icon><Edit /></el-icon>编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(c.id)"><el-icon><Delete /></el-icon>删除</el-button>
        </div>
      </el-card>

      <el-empty v-if="!loading && classes.length === 0" description="暂无班级数据" class="empty-state" />
    </div>

    <!-- 班级 Dialog -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑班级' : '新建班级'" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="名称" prop="className">
          <el-input v-model="form.className" :maxlength="FormLimits.className.max" show-word-limit placeholder="班级名称" />
        </el-form-item>
        <el-form-item label="学校">
          <el-input v-model="form.schoolName" :maxlength="FormLimits.shortText.max" placeholder="学校名称" />
        </el-form-item>
        <el-form-item label="年级">
          <el-input v-model="form.grade" :maxlength="20" placeholder="例如：高三/高一" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" :maxlength="FormLimits.mediumText.max" show-word-limit placeholder="班级描述（选填）" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 学生管理 Dialog -->
    <el-dialog v-model="studentDialogVisible" :title="`学生管理 - ${currentClass?.className}`" width="760px" destroy-on-close>
      <div v-loading="studentLoading">
        <div class="student-header">
          <span class="student-summary">已选 <b>{{ selectedStudentIds.length }}</b> 名学生 / 当前班级共 <b>{{ classStudents.length }}</b> 名</span>
        </div>
        <!-- 已分配学生头像列表 -->
        <div class="assigned-list" v-if="classStudents.length > 0">
          <div class="assigned-title">当前班级学生：</div>
          <div class="assigned-avatars">
            <div v-for="s in classStudents" :key="s.id" class="assigned-item">
              <el-avatar :size="32" :src="s.avatar || ''">
                <el-icon><UserFilled /></el-icon>
              </el-avatar>
              <div class="assigned-info">
                <div class="assigned-name">{{ s.studentName || s.username }}</div>
                <div class="assigned-meta">{{ s.username }}</div>
              </div>
              <el-button type="danger" size="small" link @click="removeStudent(currentClass!.id, s.studentId)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
        <el-divider />
        <div class="select-title">从所有学生中选择：</div>
        <el-checkbox-group v-model="selectedStudentIds" class="student-checkbox-grid">
          <el-checkbox v-for="s in allStudents" :key="s.id" :value="s.id" class="student-checkbox-item">
            <div class="student-pick">
              <el-avatar :size="24" :src="s.avatar || ''">
                <el-icon><UserFilled /></el-icon>
              </el-avatar>
              <span>{{ s.realName || s.username }} ({{ s.username }})</span>
            </div>
          </el-checkbox>
        </el-checkbox-group>
      </div>
      <template #footer>
        <el-button @click="studentDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveStudents">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { padding: 16px; }

/* 统计卡片 */
.stats-row { margin-bottom: 12px; }
.stat-card {
  border-left: 4px solid var(--accent, #409EFF);
  transition: all 0.25s ease;
  margin-bottom: 8px;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(64, 158, 255, 0.18);
}
.stat-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.stat-value { font-size: 26px; font-weight: 700; line-height: 1.2; }
.stat-label { font-size: 13px; color: #909399; margin-top: 6px; }

/* 筛选 */
.filter-card { margin-bottom: 12px; }
.filter-form { display: flex; flex-wrap: wrap; gap: 0; }

/* 卡片网格 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}
.class-card {
  transition: all 0.25s ease;
  border: 1px solid #ebeef5;
}
.class-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(64, 158, 255, 0.16);
  border-color: #409EFF55;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  flex: 1;
}
.card-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}
.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #606266;
}
.card-students {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 8px 10px;
  margin: 8px 0;
}
.students-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.students-avatars {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.more-count {
  font-size: 12px;
  color: #606266;
  margin-left: 4px;
}
.card-time {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}
.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #ebeef5;
}
.empty-state { grid-column: 1 / -1; padding: 60px 0; }

/* 学生 Dialog */
.student-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.student-summary {
  font-size: 13px;
  color: #606266;
}
.student-summary b {
  color: #409EFF;
  font-weight: 700;
}
.assigned-list {
  background: #fafafa;
  border-radius: 6px;
  padding: 10px;
}
.assigned-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}
.assigned-avatars {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
.assigned-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 6px 8px;
}
.assigned-info {
  flex: 1;
  min-width: 0;
}
.assigned-name {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.assigned-meta {
  font-size: 11px;
  color: #909399;
}
.select-title {
  font-size: 13px;
  color: #606266;
  margin-bottom: 10px;
}
.student-checkbox-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 6px;
  max-height: 360px;
  overflow-y: auto;
  padding: 4px;
}
.student-checkbox-item {
  margin-right: 0 !important;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 6px 10px;
  transition: all 0.2s;
}
.student-checkbox-item:hover {
  border-color: #409EFF;
  background: #ecf5ff;
}
.student-pick {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
</style>

<!-- 原始版本保留为注释（已迁移到上方扩展版）
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { listClassGroups, getClassGroup, createClassGroup, updateClassGroup, deleteClassGroup, getClassStudents, assignClassStudents, removeClassStudent } from '@/api/classGroup'
import { listUsers as listUsersApi } from '@/api/admin'
import type { ClassGroup, ClassGroupForm, ClassStudent } from '@/types/classGroup'
import { FormLimits } from '@/utils/formLimits'

const classes = ref<ClassGroup[]>([])
const loading = ref(false)
const total = ref(0)
const query = reactive({ pageNum: 1, pageSize: 50 })

const load = async () => {
  loading.value = true
  try {
    const res = await listClassGroups(query)
    classes.value = res.data?.records ?? []
    total.value = res.data?.total ?? 0
  } finally { loading.value = false }
}

onMounted(load)

const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<ClassGroupForm & { id: number }>({ id: 0, className: '', schoolName: '', grade: '', description: '', status: 1 })
const rules: FormRules = { className: [{ required: true, message: '请输入班级名称', trigger: 'blur' }] }

const openCreate = () => {
  Object.assign(form, { id: 0, className: '', schoolName: '', grade: '', description: '', status: 1 })
  dialogVisible.value = true
}
const openEdit = async (row: ClassGroup) => {
  const res = await getClassGroup(row.id)
  const d = res.data
  Object.assign(form, { id: d.id, className: d.className, schoolName: d.schoolName ?? '', grade: d.grade ?? '', description: d.description ?? '', status: d.status })
  dialogVisible.value = true
}
const submit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    try {
      if (form.id) { await updateClassGroup(form.id, { ...form }); ElMessage.success('更新成功') }
      else { await createClassGroup({ ...form }); ElMessage.success('创建成功') }
      dialogVisible.value = false; load()
    } catch { }
  })
}
const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' })
  await deleteClassGroup(id); ElMessage.success('已删除'); load()
}

const studentDialogVisible = ref(false)
const currentClass = ref<ClassGroup | null>(null)
const classStudents = ref<ClassStudent[]>([])
const allStudents = ref<{ id: number; username: string; realName?: string }[]>([])
const selectedStudentIds = ref<number[]>([])

const openStudents = async (row: ClassGroup) => {
  currentClass.value = row
  try {
    const [stuRes, allRes] = await Promise.all([
      getClassStudents(row.id), listUsersApi({ pageNum: 1, pageSize: 500, role: 'STUDENT' })
    ])
    classStudents.value = stuRes.data ?? []
    allStudents.value = allRes.data?.records ?? []
    selectedStudentIds.value = classStudents.value.map(s => s.studentId)
  } catch { }
  studentDialogVisible.value = true
}

const saveStudents = async () => {
  if (!currentClass.value) return
  await assignClassStudents(currentClass.value.id, selectedStudentIds.value)
  ElMessage.success('已保存')
  studentDialogVisible.value = false
}

const removeStudent = async (classId: number, studentId: number) => {
  await removeClassStudent(classId, studentId)
  ElMessage.success('已移除')
  classStudents.value = classStudents.value.filter(s => s.studentId !== studentId)
}
</script>

<template>
  <div class="page-container">
    <el-card>
      <div style="margin-bottom:16px"><el-button type="success" @click="openCreate">+ 新建班级</el-button></div>
      <el-table :data="classes" v-loading="loading" stripe border>
        <el-table-column prop="className" label="班级名称" min-width="140" />
        <el-table-column prop="schoolName" label="学校" width="120" />
        <el-table-column prop="grade" label="年级" width="80" />
        <el-table-column prop="teacherName" label="负责老师" width="100" />
        <el-table-column prop="studentCount" label="学生数" width="80" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }"><el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '停用' }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="warning" @click="openStudents(row)">学生</el-button>
            <el-button size="small" type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="query.pageNum" v-model:page-size="query.pageSize"
        :total="total" :page-sizes="[10, 20, 50, 100, 200, 500, 1000]" layout="total, sizes, prev, pager, next"
        @change="load" style="margin-top:16px;justify-content:flex-end"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑班级' : '新建班级'" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="名称" prop="className"><el-input v-model="form.className" :maxlength="FormLimits.className.max" show-word-limit /></el-form-item>
        <el-form-item label="学校"><el-input v-model="form.schoolName" :maxlength="FormLimits.shortText.max" /></el-form-item>
        <el-form-item label="年级"><el-input v-model="form.grade" :maxlength="20" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" :maxlength="FormLimits.mediumText.max" show-word-limit /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="submit">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="studentDialogVisible" :title="`学生管理 - ${currentClass?.className}`" width="700px" destroy-on-close>
      <div style="margin-bottom:12px;font-size:13px;color:#666">已选 {{ selectedStudentIds.length }} 名学生</div>
      <el-checkbox-group v-model="selectedStudentIds">
        <el-checkbox v-for="s in allStudents" :key="s.id" :value="s.id" :label="`${s.realName || s.username} (${s.username})`" style="display:block;margin-bottom:4px" />
      </el-checkbox-group>
      <template #footer><el-button @click="studentDialogVisible = false">取消</el-button><el-button type="primary" @click="saveStudents">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { padding: 16px; }
</style>
-->
