<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { List, Grid } from '@element-plus/icons-vue'
import { Search, Refresh, Plus, User, Download } from '@element-plus/icons-vue'
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
} from '@/api/admin'
import type { UserDetail, UserCreateForm } from '@/types/user'
import type { Role } from '@/types/common'
import { useViewMode } from '@/composables/useViewMode'
import { FormLimits } from '@/utils/formLimits'
import { commonRules } from '@/utils/formRules'

const { viewMode, toggleViewMode } = useViewMode('user_manage')

const query = reactive({
  username: '',
  realName: '',
  email: '',
  phone: '',
  gender: undefined as number | undefined,
  role: '' as Role | '',
  status: undefined as number | undefined,
  pageNum: 1,
  pageSize: 50,
})

const list = ref<UserDetail[]>([])
const total = ref(0)
const loading = ref(false)

/**
 * [2026-10-31 用户拍板] 列表排序：演示主角最前，正式学生/老师次之，测试数据沉底。
 * 张小明（user01）为演示主角；test、student0、demo_、loadtest、aligntest、perf 前缀账号视为测试数据。
 */
const isTestAccount = (u: UserDetail) => {
  const name = (u.username || '').toLowerCase()
  return /^(test|student0|demo_|loadtest|aligntest|perf)/.test(name)
    || (u.realName || '').includes('测试')
    || (u.realName || '').includes('演示')
    || (u.realName || '').includes('压测')
}
const sortRank = (u: UserDetail) => {
  if (u.username === 'user01') return 0 // 演示主角 张小明
  if (/^user0\d$/.test(u.username || '')) return 1 // 演示学生 user02-05
  if (u.username === 'teacher01' || u.username === 'admin') return 2
  if (isTestAccount(u)) return 9
  return 5
}
const sortedList = computed(() =>
  [...list.value].sort((a, b) => {
    const ra = sortRank(a)
    const rb = sortRank(b)
    if (ra !== rb) return ra - rb
    return (a.id ?? 0) - (b.id ?? 0)
  }),
)

/** [2026-10-31] 学生管理 / 老师管理 分开 */
const roleTab = ref<'STUDENT' | 'ADMIN'>('STUDENT')
const applyRoleTab = () => {
  query.role = roleTab.value
  query.pageNum = 1
  load()
}

const load = async () => {
  loading.value = true
  try {
    // [2026-10-31] 一次拉全量再排序：分页会让「张小明第一 / 测试号沉底」只在当前页内生效
    const res = await listUsers({
      pageNum: 1,
      pageSize: 1000,
      username: query.username || undefined,
      realName: query.realName || undefined,
      email: query.email || undefined,
      phone: query.phone || undefined,
      gender: query.gender,
      role: query.role || undefined,
      status: query.status,
    })
    list.value = res.data.records ?? []
    total.value = res.data.total ?? 0
  } finally {
    loading.value = false
  }
}
const search = () => { query.pageNum = 1; load() }
const reset = () => {
  query.username = ''
  query.realName = ''
  query.email = ''
  query.phone = ''
  query.gender = undefined
  query.role = roleTab.value
  query.status = undefined
  query.pageNum = 1
  load()
}

/* ---------------- 编辑弹窗 ---------------- */
const dialogVisible = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const formRef = ref<FormInstance>()

const form = reactive<UserCreateForm & { id: number; status?: number }>({
  id: 0,
  username: '',
  password: '',
  realName: '',
  gender: 0,
  role: 'STUDENT',
  email: '',
  phone: '',
  status: 1,
  studentNumber: '',
  teacherId: '',
})

const rules: FormRules = {
  username: commonRules.username,
  password: commonRules.password,
  realName: commonRules.realNameRequired,
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  email: commonRules.email,
  phone: commonRules.phone,
}

const openCreate = () => {
  editMode.value = 'create'
  Object.assign(form, {
    id: 0, username: '', password: '', realName: '',
    gender: 0, role: 'STUDENT', email: '', phone: '', status: 1,
    studentNumber: '', teacherId: '',
  })
  dialogVisible.value = true
}

const openEdit = (row: UserDetail) => {
  editMode.value = 'edit'
  Object.assign(form, {
    id: row.id,
    username: row.username,
    password: '',
    realName: row.realName || '',
    gender: row.gender ?? 0,
    role: row.role,
    email: row.email || '',
    phone: row.phone || '',
    status: row.status,
    studentNumber: row.studentNumber || '',
    teacherId: row.teacherId || '',
  })
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    try {
      if (editMode.value === 'create') {
        await createUser({
          username: form.username,
          password: form.password,
          realName: form.realName,
          gender: form.gender,
          role: form.role,
          email: form.email,
          phone: form.phone,
          studentNumber: form.studentNumber || undefined,
          teacherId: form.teacherId || undefined,
        })
        ElMessage.success('创建成功')
      } else {
        await updateUser(form.id, {
          realName: form.realName,
          gender: form.gender as 0 | 1 | 2,
          role: form.role,
          email: form.email,
          phone: form.phone,
          status: form.status as 0 | 1,
          studentNumber: form.studentNumber || undefined,
          teacherId: form.teacherId || undefined,
        })
        ElMessage.success('更新成功')
      }
      dialogVisible.value = false
      load()
    } catch { /* handled */ }
  })
}

/* ---------------- 行操作 ---------------- */
const confirmDelete = async (row: UserDetail) => {
  try {
    await ElMessageBox.confirm(`确认禁用用户「${row.username}」？`, '禁用确认', {
      type: 'warning',
    })
    await deleteUser(row.id)
    ElMessage.success('已禁用')
    load()
  } catch { /* cancelled */ }
}

const confirmResetPwd = async (row: UserDetail) => {
  try {
    await ElMessageBox.confirm(`将「${row.username}」的密码重置为默认值 123456？`, '重置密码', {
      type: 'warning',
    })
    await resetUserPassword(row.id)
    ElMessage.success('已重置为 123456')
  } catch { /* cancelled */ }
}

const onStatusChange = async (row: UserDetail, val: number) => {
  try {
    await updateUser(row.id, { status: val as 0 | 1 })
    ElMessage.success(val === 1 ? '已启用' : '已禁用')
  } catch {
    row.status = val === 1 ? 0 : 1 // 回滚
  }
}

const genderText = (g?: number) => (g === 1 ? '男' : g === 2 ? '女' : '-')

/** [2026-10-31] 学生默认头像 student.jpg；管理员/老师用 admin.jpeg，避免空头像 */
const avatarSrc = (u: { avatar?: string | null | undefined; role?: string | undefined }) => {
  if (u.avatar) return u.avatar
  return u.role === 'ADMIN' ? '/avatars/admin.jpeg' : '/avatars/student.jpg'
}

/* ---------------- CSV 导出 ---------------- */
const exporting = ref(false)
const escapeCsv = (val: unknown): string => {
  if (val == null) return ''
  const s = String(val)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
const exportCsv = () => {
  if (!list.value.length) {
    ElMessage.warning('当前列表无数据')
    return
  }
  exporting.value = true
  try {
    const headers = ['ID', '用户名', '姓名', '英文名', '邮箱', '手机号', '性别', '角色', '状态', '最后登录']
    const rows = list.value.map((u) => [
      u.id,
      u.username,
      u.realName ?? '',
      u.englishName ?? '',
      u.email ?? '',
      u.phone ?? '',
      u.gender === 1 ? '男' : u.gender === 2 ? '女' : '未知',
      u.role,
      u.status === 1 ? '启用' : '禁用',
      u.lastLoginTime ?? '',
    ].map(escapeCsv).join(','))
    const csv = '\ufeff' + headers.join(',') + '\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=UTF-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `用户数据-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${list.value.length} 条数据`)
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  // [2026-10-31] 默认进入「学生管理」
  query.role = 'STUDENT'
  load()
})
</script>

<template>
  <div class="page">
    <!-- [2026-10-31] 学生 / 老师 分开管理 -->
    <el-tabs v-model="roleTab" class="role-tabs" @tab-change="applyRoleTab">
      <el-tab-pane label="学生管理" name="STUDENT" />
      <el-tab-pane label="老师管理" name="ADMIN" />
    </el-tabs>

    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-row :gutter="8">
          <el-form-item label="用户名">
            <el-input v-model="query.username" placeholder="用户名" :maxlength="FormLimits.keyword.max" clearable style="width:180px" />
          </el-form-item>
          <el-form-item label="姓名">
            <el-input v-model="query.realName" placeholder="姓名" :maxlength="FormLimits.keyword.max" clearable style="width:180px" />
          </el-form-item>
          <el-form-item label="邮箱">
            <el-input v-model="query.email" placeholder="邮箱" :maxlength="FormLimits.email.max" clearable style="width:180px" />
          </el-form-item>
          <el-form-item label="手机号">
            <el-input v-model="query.phone" placeholder="手机号" :maxlength="FormLimits.phone.max" clearable style="width:160px" />
          </el-form-item>
        </el-row>
        <el-row :gutter="8" style="margin-top: 8px;">
          <el-form-item label="性别">
            <el-select v-model="query.gender" clearable placeholder="全部" style="width:120px">
              <el-option label="男" :value="1" />
              <el-option label="女" :value="2" />
              <el-option label="未知" :value="0" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="query.status" clearable placeholder="全部" style="width:120px">
              <el-option label="启用" :value="1" />
              <el-option label="禁用" :value="0" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
            <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
            <el-button @click="toggleViewMode" :type="viewMode === 'card' ? 'primary' : 'default'">
              <el-icon><List v-if="viewMode === 'card'" /><Grid v-else /></el-icon>
              {{ viewMode === 'card' ? '表格' : '卡片' }}
            </el-button>
          </el-form-item>
        </el-row>
      </el-form>
    </el-card>

    <el-card shadow="never" v-loading="loading">
      <div class="toolbar">
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>新增用户
        </el-button>
        <el-button :loading="exporting" @click="exportCsv">
          <el-icon><Download /></el-icon>导出 CSV
        </el-button>
      </div>

      <!-- 表格布局 -->
      <el-table v-if="viewMode === 'table'" :data="sortedList" style="width:100%">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column label="头像" width="64" align="center">
          <template #default="{ row }">
            <!-- [2026-10-31] 基本信息收进头像悬浮，节省表格列宽 -->
            <el-tooltip placement="right" effect="light" width="260">
              <template #content>
                <div class="avatar-tip">
                  <div><b>{{ row.realName || row.username }}</b>（{{ row.username }}）</div>
                  <div v-if="row.englishName">英文名：{{ row.englishName }}</div>
                  <div>邮箱：{{ row.email || '—' }}</div>
                  <div>手机：{{ row.phone || '—' }}</div>
                  <div>{{ row.role === 'STUDENT' ? '学号' : '师号' }}：{{ row.role === 'STUDENT' ? (row.studentNumber || '—') : (row.teacherId || '—') }}</div>
                  <div>性别：{{ genderText(row.gender) }} · 最后登录：{{ row.lastLoginTime || '—' }}</div>
                </div>
              </template>
              <el-avatar :size="32" :src="avatarSrc(row)" style="cursor: help">
                <el-icon><User /></el-icon>
              </el-avatar>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" width="110" show-overflow-tooltip />
        <el-table-column prop="realName" label="姓名" width="90" show-overflow-tooltip />
        <!-- [2026-10-31] 学号/师号仅展示，不做流程引用 -->
        <el-table-column label="学号/师号" width="95">
          <template #default="{ row }">
            <span v-if="row.role === 'STUDENT'">{{ row.studentNumber || '—' }}</span>
            <span v-else>{{ row.teacherId || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="性别" width="56" align="center">
          <template #default="{ row }">{{ genderText(row.gender) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="72" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="1"
              :inactive-value="0"
              @change="(v: unknown) => onStatusChange(row, v as number)"
            />
          </template>
        </el-table-column>
        <!-- [2026-10-31] 学生名单统计（StudentListStatisticsService 实时聚合） -->
        <el-table-column v-if="roleTab === 'STUDENT'" label="考试" width="62" align="right">
          <template #default="{ row }">{{ row.examCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column v-if="roleTab === 'STUDENT'" label="练习" width="62" align="right">
          <template #default="{ row }">{{ row.practiceCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column v-if="roleTab === 'STUDENT'" label="平均分" width="72" align="right">
          <template #default="{ row }">{{ row.averageScore != null ? Number(row.averageScore).toFixed(1) : '—' }}</template>
        </el-table-column>
        <el-table-column v-if="roleTab === 'STUDENT'" label="能力分" width="72" align="right">
          <template #default="{ row }">{{ row.abilityScore != null ? Number(row.abilityScore).toFixed(1) : '—' }}</template>
        </el-table-column>
        <el-table-column prop="lastLoginTime" label="最后登录" min-width="130" show-overflow-tooltip />
        <el-table-column label="操作" width="150" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="warning" @click="confirmResetPwd(row)">重置</el-button>
            <el-button link type="danger" @click="confirmDelete(row)">禁用</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 卡片网格布局 -->
      <div v-else class="user-grid">
        <el-card
          v-for="item in sortedList"
          :key="item.id"
          class="user-card"
          hover
        >
          <div class="card-header">
            <div class="avatar-wrap">
              <el-avatar :size="44" :src="avatarSrc(item)">
                <el-icon><User /></el-icon>
              </el-avatar>
            </div>
            <div class="user-info">
              <div class="user-name">{{ item.realName || item.username }}</div>
              <div class="user-meta">
                <span class="username">@{{ item.username }}</span>
                <el-tag :type="item.role === 'ADMIN' ? 'danger' : 'success'">{{ item.role === 'ADMIN' ? '管理员' : '学生' }}</el-tag>
              </div>
            </div>
            <el-switch
              v-model="item.status"
              :active-value="1"
              :inactive-value="0"
              @change="(v: unknown) => onStatusChange(item, v as number)"
            />
          </div>
          <div class="card-body">
            <div class="info-row">
              <span class="info-label">英文名</span>
              <span class="info-value">{{ item.englishName || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">邮箱</span>
              <span class="info-value">{{ item.email || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">手机号</span>
              <span class="info-value">{{ item.phone || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">性别</span>
              <span class="info-value">{{ genderText(item.gender) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">最后登录</span>
              <span class="info-value">{{ item.lastLoginTime || '-' }}</span>
            </div>
          </div>
          <div class="card-footer">
            <el-button link type="primary" @click="openEdit(item)">编辑</el-button>
            <el-button link type="warning" @click="confirmResetPwd(item)">重置密码</el-button>
            <el-button link type="danger" @click="confirmDelete(item)">禁用</el-button>
          </div>
        </el-card>
      </div>

      <!-- [2026-10-31] 一次拉全量排序，不再分页（保证张小明第一、测试号沉底是全局序） -->
      <div class="pagination">
        <span class="total-text">共 {{ sortedList.length }} 人（已按：演示主角 → 正式用户 → 测试号排序）</span>
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editMode === 'create' ? '新增用户' : '编辑用户'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :maxlength="FormLimits.username.max" :disabled="editMode === 'edit'" show-word-limit />
        </el-form-item>
        <el-form-item v-if="editMode === 'create'" label="初始密码" prop="password">
          <el-input v-model="form.password" type="password" :maxlength="FormLimits.password.max" show-password />
        </el-form-item>
        <el-form-item label="姓名" prop="realName">
          <el-input v-model="form.realName" :maxlength="FormLimits.realName.max" show-word-limit />
        </el-form-item>
        <el-form-item label="英文名">
          <el-input v-model="form.englishName" :maxlength="FormLimits.englishName.max" placeholder="如：Zhang Xiaoming" />
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="form.gender">
            <el-radio :value="0">未知</el-radio>
            <el-radio :value="1">男</el-radio>
            <el-radio :value="2">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width:100%">
            <el-option label="学生" value="STUDENT" />
            <el-option label="管理员" value="ADMIN" />
          </el-select>
        </el-form-item>
        <!-- [2026-10-31] 学号/师号仅展示编辑，不进业务流程 -->
        <el-form-item v-if="form.role === 'STUDENT'" label="学号">
          <el-input v-model="form.studentNumber" :maxlength="50" placeholder="选填，仅展示" />
        </el-form-item>
        <el-form-item v-else label="师号">
          <el-input v-model="form.teacherId" :maxlength="50" placeholder="选填，仅展示" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" :maxlength="FormLimits.email.max" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" :maxlength="FormLimits.phone.max" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.role-tabs {
  :deep(.el-tabs__header) { margin-bottom: 0; }
}
.avatar-tip {
  line-height: 1.8;
  font-size: 12px;
  color: #303133;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.total-text {
  font-size: 12px;
  color: #909399;
}
.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.toolbar { margin-bottom: 12px; }


.user-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}

.user-card {
  transition: all 0.2s;
  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 12px;
}

.avatar-wrap {
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.username {
  font-size: 12px;
  color: #909399;
}

.card-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 11px;
  color: #909399;
}

.info-value {
  font-size: 13px;
  color: #606266;
}

.card-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
  margin-top: 12px;
}
</style>
