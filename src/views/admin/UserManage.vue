<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
} from '@/api/admin'
import type { UserDetail, UserCreateForm } from '@/types/user'
import type { Role } from '@/types/common'

const query = reactive({
  username: '',
  realName: '',
  role: '' as Role | '',
  status: undefined as number | undefined,
  pageNum: 1,
  pageSize: 50,
})

const list = ref<UserDetail[]>([])
const total = ref(0)
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const res = await listUsers({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      username: query.username || undefined,
      realName: query.realName || undefined,
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
  query.role = ''
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
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入初始密码', trigger: 'blur' }],
  realName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
}

const openCreate = () => {
  editMode.value = 'create'
  Object.assign(form, {
    id: 0, username: '', password: '', realName: '',
    gender: 0, role: 'STUDENT', email: '', phone: '', status: 1,
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

onMounted(load)
</script>

<template>
  <div class="page">
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-form-item label="用户名">
          <el-input v-model="query.username" placeholder="用户名" clearable style="width:180px" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="query.realName" placeholder="姓名" clearable style="width:180px" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="query.role" clearable placeholder="全部" style="width:140px">
            <el-option label="管理员" value="ADMIN" />
            <el-option label="学生" value="STUDENT" />
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
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" v-loading="loading">
      <div class="toolbar">
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>新增用户
        </el-button>
      </div>

      <!-- 卡片网格布局 -->
      <div class="user-grid">
        <el-card
          v-for="item in list"
          :key="item.id"
          class="user-card"
          hover
        >
          <div class="card-header">
            <div class="avatar-wrap">
              <el-avatar :size="44" :src="item.avatar || ''">
                <el-icon><User /></el-icon>
              </el-avatar>
            </div>
            <div class="user-info">
              <div class="user-name">{{ item.realName || item.username }}</div>
              <div class="user-meta">
                <span class="username">@{{ item.username }}</span>
                <el-tag :type="item.role === 'ADMIN' ? 'danger' : 'success'" size="small">{{ item.role === 'ADMIN' ? '管理员' : '学生' }}</el-tag>
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
            <el-button link type="primary" size="small" @click="openEdit(item)">编辑</el-button>
            <el-button link type="warning" size="small" @click="confirmResetPwd(item)">重置密码</el-button>
            <el-button link type="danger" size="small" @click="confirmDelete(item)">禁用</el-button>
          </div>
        </el-card>
      </div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[20, 50, 100]"
          @size-change="load"
          @current-change="load"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editMode === 'create' ? '新增用户' : '编辑用户'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="editMode === 'edit'" />
        </el-form-item>
        <el-form-item v-if="editMode === 'create'" label="初始密码" prop="password">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="姓名" prop="realName">
          <el-input v-model="form.realName" />
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
        <el-form-item label="邮箱">
          <el-input v-model="form.email" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" />
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
.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.toolbar { margin-bottom: 12px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }

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
