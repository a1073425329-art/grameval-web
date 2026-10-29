<script setup lang="ts">
/**
 * 个人资料页 —— 学生/管理员共用。
 * 展示：头像 + 角色 + 完整基本信息 + 学生专属（所属老师）
 * 编辑：realName / gender / email / phone / idCard / avatar
 * 修改密码
 */
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { getMyProfile, updateMyProfile, changeMyPassword } from '@/api/user'
import { useAuthStore } from '@/stores/auth'
import type { UserDetail, UserUpdateForm, PasswordChangeForm } from '@/types/user'
import { FormLimits } from '@/utils/formLimits'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_WIDTH = 512
const MAX_HEIGHT = 512

const authStore = useAuthStore()

const avatarInputRef = ref<HTMLInputElement | null>(null)
const detail = ref<UserDetail | null>(null)
const loading = ref(false)
const submitting = ref(false)

/** 编辑资料 */
const editing = ref(false)
const form = reactive<UserUpdateForm>({
  realName: '', gender: 0, email: '', phone: '', idCard: '', avatar: '',
})

/** 密码修改 */
const pwdVisible = ref(false)
const pwdRef = ref<FormInstance>()
const pwdForm = reactive<PasswordChangeForm & { confirm: string }>({
  oldPassword: '', newPassword: '', confirm: '',
})
const pwdRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 100, message: '6-100 个字符', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: (_r, v, cb) => v !== pwdForm.newPassword ? cb(new Error('两次输入的密码不一致')) : cb(), trigger: 'blur' },
  ],
}


/* ============================================================ *
 *  Load
 * ============================================================ */
const load = async () => {
  loading.value = true
  try {
    const res = await getMyProfile()
    const user = res.data
    if (!user) return
    detail.value = user
    Object.assign(form, {
      realName: user.realName || '', gender: user.gender ?? 0,
      email: user.email || '', phone: user.phone || '',
      idCard: user.idCard || '', avatar: user.avatar || '',
    })
  } finally { loading.value = false }
}

/* ============================================================ *
 *  编辑资料
 * ============================================================ */
const startEdit = () => { editing.value = true }
const cancelEdit = () => {
  editing.value = false
  if (detail.value) {
    Object.assign(form, { realName: detail.value.realName || '', gender: detail.value.gender ?? 0, email: detail.value.email || '', phone: detail.value.phone || '', idCard: detail.value.idCard || '', avatar: detail.value.avatar || '' })
  }
}
const saveEdit = async () => {
  submitting.value = true
  try {
    const res = await updateMyProfile(form)
    detail.value = res.data
    await authStore.fetchMe().catch(() => null)
    editing.value = false
    ElMessage.success('保存成功')
  } finally { submitting.value = false }
}

/* ============================================================ *
 *  修改密码
 * ============================================================ */
const openPwd = () => { Object.assign(pwdForm, { oldPassword: '', newPassword: '', confirm: '' }); pwdVisible.value = true }
const doChangePwd = async () => {
  if (!pwdRef.value || !detail.value) return
  await pwdRef.value.validate(async valid => {
    if (!valid) return
    try { await changeMyPassword(detail.value!.id, { oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword }); pwdVisible.value = false; ElMessage.success('密码修改成功') } catch { /* handled */ }
  })
}

/* ============================================================ *
 *  头像上传与压缩
 * ============================================================ */
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('无法创建画布')); return }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('压缩失败')); return }
          const blobReader = new FileReader()
          blobReader.onload = (ev) => {
            resolve(ev.target?.result as string)
          }
          blobReader.readAsDataURL(blob)
        }, file.type || 'image/jpeg', 0.8)
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

const handleAvatarUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return
  }

  if (file.size > MAX_FILE_SIZE) {
    ElMessage.error(`图片大小不能超过 ${(MAX_FILE_SIZE / 1024).toFixed(0)}KB`)
    return
  }

  try {
    form.avatar = await compressImage(file)
    ElMessage.success('头像上传成功')
  } catch (e) {
    ElMessage.error('头像上传失败：' + (e as Error).message)
  }
}

/* ============================================================ *
 *  Helpers
 * ============================================================ */
const genderText = (g?: number) => (g === 1 ? '男' : g === 2 ? '女' : '未知')
const roleText = (r?: string) => (r === 'ADMIN' ? '管理员' : '学生')
const statusText = (s?: number) => (s === 1 ? '已启用' : s === 0 ? '已禁用' : '-')
const statusType = (s?: number) => (s === 1 ? 'success' : 'danger')
const avatarUrl = (u: UserDetail | null) => {
  if (!u) return ''
  if (u.avatar) return u.avatar
  if (u.username === 'admin') return '/avatars/admin.jpeg'
  if (u.username === 'teacher01') return '/avatars/teacher01.jpeg'
  if (u.username === 'student01') return '/avatars/student01.jpg'
  return u.role === 'ADMIN' ? '/avatars/admin.jpeg' : '/avatars/student.jpg'
}

onMounted(load)
</script>

<template>
  <div class="profile-page" v-loading="loading">
    <!-- ==================== 头像 + 身份 ==================== -->
    <el-card shadow="never">
      <div class="profile-header">
        <el-avatar :size="88" :src="avatarUrl(detail)">
          <el-icon size="40"><UserFilled /></el-icon>
        </el-avatar>
        <div class="header-info">
          <h2 class="username">{{ detail?.realName || detail?.username || '-' }}</h2>
          <div class="tags">
            <el-tag :type="detail?.role === 'ADMIN' ? 'danger' : 'success'">{{ roleText(detail?.role) }}</el-tag>
            <el-tag :type="statusType(detail?.status)" effect="plain">{{ statusText(detail?.status) }}</el-tag>
          </div>
          <div class="sub">用户名：{{ detail?.username }} · ID：{{ detail?.id }}</div>
        </div>
        <div class="header-actions">
          <el-button v-if="!editing" type="primary" @click="startEdit"><el-icon><Edit /></el-icon>编辑资料</el-button>
          <el-button v-else :loading="submitting" type="success" @click="saveEdit"><el-icon><Check /></el-icon>保存</el-button>
          <el-button v-if="editing" @click="cancelEdit">取消</el-button>
          <el-button @click="openPwd"><el-icon><Lock /></el-icon>修改密码</el-button>
        </div>
      </div>
    </el-card>

    <!-- ==================== 基本信息 ==================== -->
    <el-card shadow="never">
      <template #header><div class="card-head"><el-icon><InfoFilled /></el-icon><span>基本信息</span></div></template>

      <el-descriptions v-if="!editing" :column="2" border>
        <el-descriptions-item label="真实姓名">{{ detail?.realName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ genderText(detail?.gender) }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ detail?.email || '-' }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ detail?.phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="身份证号">{{ detail?.idCard || '-' }}</el-descriptions-item>
        <el-descriptions-item label="头像">
          <el-avatar v-if="detail?.avatar" :size="40" :src="detail.avatar" shape="square" />
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="上次登录">{{ detail?.lastLoginTime?.slice(0, 16) || '-' }}</el-descriptions-item>
        <el-descriptions-item label="上次 IP">{{ detail?.lastLoginIp || '-' }}</el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ detail?.createTime?.slice(0, 16) || '-' }}</el-descriptions-item>
        <el-descriptions-item label="最近更新">{{ detail?.updateTime?.slice(0, 16) || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-form v-else :model="form" label-width="100px" style="max-width:640px">
        <el-form-item label="真实姓名"><el-input v-model="form.realName" :maxlength="FormLimits.realName.max" show-word-limit /></el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="form.gender">
            <el-radio :value="0">未知</el-radio>
            <el-radio :value="1">男</el-radio>
            <el-radio :value="2">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="邮箱"><el-input v-model="form.email" :maxlength="FormLimits.email.max" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="form.phone" :maxlength="FormLimits.phone.max" /></el-form-item>
        <el-form-item label="身份证号"><el-input v-model="form.idCard" :maxlength="FormLimits.idCard.max" placeholder="选填，学生可用于登录" /></el-form-item>
        <el-form-item label="头像">
          <div style="display:flex;align-items:center;gap:12px">
            <el-avatar v-if="form.avatar" :size="48" :src="form.avatar" shape="square" />
            <div style="flex:1;display:flex;gap:8px">
              <el-button type="primary" @click="avatarInputRef?.click()">
                <el-icon><Upload /></el-icon>上传头像
              </el-button>
              <el-button v-if="form.avatar" @click="form.avatar = ''">移除</el-button>
              <span style="font-size:12px;color:#909399">支持 jpg/png，最大 5MB</span>
              <input ref="avatarInputRef" type="file" accept="image/jpeg,image/png,image/gif" style="display:none" @change="handleAvatarUpload" />
            </div>
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- ==================== 学生专属：所属老师 ==================== -->
    <el-card v-if="detail?.teacher" shadow="never">
      <template #header><div class="card-head"><el-icon><User /></el-icon><span>所属老师</span></div></template>
      <div class="teacher-card">
        <el-avatar :size="56" :src="detail.teacher.avatar || ''">
          <el-icon size="28"><UserFilled /></el-icon>
        </el-avatar>
        <div class="teacher-info">
          <div class="teacher-name">{{ detail.teacher.realName || detail.teacher.username }}</div>
          <div class="teacher-meta">
            <span v-if="detail.teacher.phone"><el-icon><Phone /></el-icon> {{ detail.teacher.phone }}</span>
            <span v-if="detail.teacher.email"><el-icon><Message /></el-icon> {{ detail.teacher.email }}</span>
            <el-tag type="warning">老师</el-tag>
          </div>
        </div>
      </div>
    </el-card>

    <!-- ==================== 修改密码弹窗 ==================== -->
    <el-dialog v-model="pwdVisible" title="修改密码" width="440px">
      <el-form ref="pwdRef" :model="pwdForm" :rules="pwdRules" label-width="90px">
        <el-form-item label="当前密码" prop="oldPassword"><el-input v-model="pwdForm.oldPassword" type="password" :maxlength="FormLimits.password.max" show-password /></el-form-item>
        <el-form-item label="新密码" prop="newPassword"><el-input v-model="pwdForm.newPassword" type="password" :maxlength="FormLimits.password.max" show-password /></el-form-item>
        <el-form-item label="确认密码" prop="confirm"><el-input v-model="pwdForm.confirm" type="password" :maxlength="FormLimits.password.max" show-password /></el-form-item>
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

.profile-header {
  display: flex; align-items: center; gap: 20px;
  .header-info { flex: 1; }
  .username { margin: 0; font-size: 22px; font-weight: 600; color: #303133; }
  .tags { display: flex; gap: 6px; margin: 8px 0; }
  .sub { color: #909399; font-size: 13px; }
  .header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
}

.card-head { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.card-head-between { display: flex; align-items: center; justify-content: space-between; }

.teacher-card {
  display: flex; align-items: center; gap: 16px;
  .teacher-name { font-size: 16px; font-weight: 600; color: #303133; margin-bottom: 4px; }
  .teacher-meta { display: flex; align-items: center; gap: 12px; font-size: 13px; color: #606266; flex-wrap: wrap; }
}
</style>
