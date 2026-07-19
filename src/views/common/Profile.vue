<script setup lang="ts">
/**
 * 个人资料页 —— 学生/管理员共用
 * 展示：头像 + 用户名 + 角色 + 完整资料
 * 编辑：realName / gender / email / phone / idCard / avatar
 * 修改密码：oldPassword + newPassword
 */
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { getMyProfile, updateMyProfile, changeMyPassword } from '@/api/user'
import { useAuthStore } from '@/stores/auth'
import type { UserDetail, UserUpdateForm, PasswordChangeForm } from '@/types/user'

const authStore = useAuthStore()

const detail = ref<UserDetail | null>(null)
const loading = ref(false)
const submitting = ref(false)

/** 编辑表单 */
const editing = ref(false)
const form = reactive<UserUpdateForm>({
  realName: '',
  gender: 0,
  email: '',
  phone: '',
  idCard: '',
  avatar: '',
})

/** 密码修改 */
const pwdVisible = ref(false)
const pwdRef = ref<FormInstance>()
const pwdForm = reactive<PasswordChangeForm & { confirm: string }>({
  oldPassword: '',
  newPassword: '',
  confirm: '',
})
const pwdRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 100, message: '6-100 个字符', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_r, v, cb) => {
        if (v !== pwdForm.newPassword) cb(new Error('两次输入的密码不一致'))
        else cb()
      },
      trigger: 'blur',
    },
  ],
}

const load = async () => {
  loading.value = true
  try {
    const res = await getMyProfile()
    detail.value = res.data
    Object.assign(form, {
      realName: res.data.realName || '',
      gender: res.data.gender ?? 0,
      email: res.data.email || '',
      phone: res.data.phone || '',
      idCard: res.data.idCard || '',
      avatar: res.data.avatar || '',
    })
  } catch { /* handled */ } finally { loading.value = false }
}

const startEdit = () => { editing.value = true }
const cancelEdit = () => {
  editing.value = false
  if (detail.value) {
    Object.assign(form, {
      realName: detail.value.realName || '',
      gender: detail.value.gender ?? 0,
      email: detail.value.email || '',
      phone: detail.value.phone || '',
      idCard: detail.value.idCard || '',
      avatar: detail.value.avatar || '',
    })
  }
}

const saveEdit = async () => {
  submitting.value = true
  try {
    const res = await updateMyProfile(form)
    detail.value = res.data
    // 同步刷新 auth store 让 header 显示新姓名
    await authStore.fetchMe().catch(() => null)
    editing.value = false
    ElMessage.success('保存成功')
  } catch { /* handled */ } finally { submitting.value = false }
}

const openPwd = () => {
  Object.assign(pwdForm, { oldPassword: '', newPassword: '', confirm: '' })
  pwdVisible.value = true
}

const doChangePwd = async () => {
  if (!pwdRef.value || !detail.value) return
  await pwdRef.value.validate(async (valid) => {
    if (!valid) return
    try {
      await changeMyPassword(detail.value!.id, {
        oldPassword: pwdForm.oldPassword,
        newPassword: pwdForm.newPassword,
      })
      pwdVisible.value = false
      ElMessage.success('密码修改成功，下次登录生效')
    } catch { /* handled */ }
  })
}

const genderText = (g?: number) => (g === 1 ? '男' : g === 2 ? '女' : '未知')
const roleText = (r?: string) => (r === 'ADMIN' ? '管理员' : r === 'STUDENT' ? '学生' : '-')

const avatarUrl = (u: UserDetail | null) => {
  if (!u) return ''
  if (u.avatar) return u.avatar
  if (u.username === 'admin')     return '/avatars/admin.jpeg'
  if (u.username === 'teacher01') return '/avatars/teacher01.jpeg'
  if (u.username === 'student01') return '/avatars/student01.jpg'
  return u.role === 'ADMIN' ? '/avatars/admin.jpeg' : '/avatars/student.jpg'
}

onMounted(load)
</script>

<template>
  <div class="profile-page" v-loading="loading">
    <el-card shadow="never" class="profile-card">
      <div class="profile-header">
        <el-avatar :size="88" :src="avatarUrl(detail)">
          <el-icon size="40"><UserFilled /></el-icon>
        </el-avatar>
        <div class="header-info">
          <h2 class="username">{{ detail?.realName || detail?.username || '-' }}</h2>
          <div class="tags">
            <el-tag :type="detail?.role === 'ADMIN' ? 'danger' : 'success'" size="small">
              {{ roleText(detail?.role) }}
            </el-tag>
            <el-tag v-if="detail?.status === 1" type="success" size="small" effect="plain">
              账号已启用
            </el-tag>
            <el-tag v-else-if="detail?.status === 0" type="danger" size="small" effect="plain">
              账号已禁用
            </el-tag>
          </div>
          <div class="sub">用户名：{{ detail?.username }} · ID：{{ detail?.id }}</div>
        </div>
        <div class="header-actions">
          <el-button v-if="!editing" type="primary" @click="startEdit">
            <el-icon><Edit /></el-icon>编辑资料
          </el-button>
          <el-button v-else :loading="submitting" type="success" @click="saveEdit">
            <el-icon><Check /></el-icon>保存
          </el-button>
          <el-button v-if="editing" @click="cancelEdit">取消</el-button>
          <el-button @click="openPwd">
            <el-icon><Lock /></el-icon>修改密码
          </el-button>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="detail-card">
      <template #header>
        <div class="card-head">
          <el-icon><InfoFilled /></el-icon>
          <span>基本信息</span>
        </div>
      </template>

      <!-- 查看模式 -->
      <el-descriptions v-if="!editing" :column="2" border>
        <el-descriptions-item label="真实姓名">{{ detail?.realName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ genderText(detail?.gender) }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ detail?.email || '-' }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ detail?.phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="身份证号">{{ detail?.idCard || '-' }}</el-descriptions-item>
        <el-descriptions-item label="头像 URL">
          <span class="mono">{{ detail?.avatar || '-' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="上次登录">{{ detail?.lastLoginTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="上次 IP">{{ detail?.lastLoginIp || '-' }}</el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ detail?.createTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="最近更新">{{ detail?.updateTime || '-' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 编辑模式 -->
      <el-form v-else :model="form" label-width="100px" style="max-width:640px">
        <el-form-item label="真实姓名">
          <el-input v-model="form.realName" />
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="form.gender">
            <el-radio :value="0">未知</el-radio>
            <el-radio :value="1">男</el-radio>
            <el-radio :value="2">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="身份证号">
          <el-input v-model="form.idCard" placeholder="选填，学生可用于登录" />
        </el-form-item>
        <el-form-item label="头像 URL">
          <el-input v-model="form.avatar" placeholder="选填，图片链接" />
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 密码修改弹窗 -->
    <el-dialog v-model="pwdVisible" title="修改密码" width="440px">
      <el-form ref="pwdRef" :model="pwdForm" :rules="pwdRules" label-width="90px">
        <el-form-item label="当前密码" prop="oldPassword">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="pwdForm.newPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirm">
          <el-input v-model="pwdForm.confirm" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" @click="doChangePwd">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.profile-page { display: flex; flex-direction: column; gap: 16px; }

.profile-card {
  .profile-header {
    display: flex; align-items: center; gap: 20px;
    .header-info { flex: 1; }
    .username { margin: 0; font-size: 22px; font-weight: 600; color: #303133; }
    .tags { display: flex; gap: 6px; margin: 8px 0; }
    .sub { color: #909399; font-size: 13px; }
    .header-actions { display: flex; gap: 8px; }
  }
}

.card-head {
  display: flex; align-items: center; gap: 6px;
  font-weight: 600;
}

.mono { font-family: Consolas, Menlo, monospace; font-size: 12px; color: #606266; word-break: break-all; }
</style>
