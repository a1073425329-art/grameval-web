<script setup lang="ts">
/**
 * 个人资料页 —— 学生/管理员共用。
 * 展示：头像 + 角色 + 完整基本信息 + 学生专属（训练计划 + 所属老师）
 * 编辑：realName / gender / email / phone / idCard / avatar
 * 修改密码 + 修改训练计划（学生）
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { getMyProfile, updateMyProfile, changeMyPassword } from '@/api/user'
import { getTrainingSchedule, updateTrainingSchedule } from '@/api/student'
import { useAuthStore } from '@/stores/auth'
import type { UserDetail, UserUpdateForm, PasswordChangeForm } from '@/types/user'
import type { TrainingSchedule } from '@/types/stats'

const authStore = useAuthStore()

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

/** 训练计划 */
const training = ref<TrainingSchedule | null>(null)
const editingTraining = ref(false)
const trainingForm = reactive<TrainingSchedule>({
  actualStartDate: '', trainingDays: '', trainingTimeFrom: '', trainingTimeTo: '', trainingTargetHours: undefined,
})

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
    // 学生拉训练计划
    if (user.role === 'STUDENT') {
      try {
        const t = await getTrainingSchedule(user.id)
        training.value = t.data
      } catch { /* 可能未设置训练计划 */ }
    }
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
 *  编辑训练计划
 * ============================================================ */
const startEditTraining = () => {
  if (training.value) {
    Object.assign(trainingForm, {
      actualStartDate: training.value.actualStartDate || '',
      trainingDays: training.value.trainingDays || '',
      trainingTimeFrom: training.value.trainingTimeFrom || '',
      trainingTimeTo: training.value.trainingTimeTo || '',
      trainingTargetHours: training.value.trainingTargetHours,
    })
  }
  editingTraining.value = true
}
const cancelEditTraining = () => { editingTraining.value = false }
const saveTraining = async () => {
  if (!detail.value) return
  submitting.value = true
  try {
    const res = await updateTrainingSchedule(detail.value.id, trainingForm)
    training.value = res.data
    editingTraining.value = false
    ElMessage.success('训练计划已更新')
  } finally { submitting.value = false }
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
const weekDayNames: Record<string, string> = { '1': '周一', '2': '周二', '3': '周三', '4': '周四', '5': '周五', '6': '周六', '7': '周日' }
const trainingDaysLabel = (td?: string) => {
  if (!td) return '未设置'
  return td.split(',').map(d => weekDayNames[d.trim()] || d).join('、')
}
/** 训练日字符串 ↔ 数组互转 */
const trainingDaysArr = computed({
  get: () => trainingForm.trainingDays ? trainingForm.trainingDays.split(',').map(s => s.trim()).filter(Boolean) : [],
  set: (arr: string[]) => { trainingForm.trainingDays = arr.join(',') },
})

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
            <el-tag :type="detail?.role === 'ADMIN' ? 'danger' : 'success'" size="small">{{ roleText(detail?.role) }}</el-tag>
            <el-tag :type="statusType(detail?.status)" size="small" effect="plain">{{ statusText(detail?.status) }}</el-tag>
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
        <el-form-item label="真实姓名"><el-input v-model="form.realName" /></el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="form.gender">
            <el-radio :value="0">未知</el-radio>
            <el-radio :value="1">男</el-radio>
            <el-radio :value="2">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="身份证号"><el-input v-model="form.idCard" placeholder="选填，学生可用于登录" /></el-form-item>
        <el-form-item label="头像">
          <div style="display:flex;align-items:center;gap:12px">
            <el-avatar v-if="form.avatar" :size="48" :src="form.avatar" shape="square" />
            <el-input v-model="form.avatar" placeholder="图片 URL 或 base64" style="flex:1" />
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- ==================== 学生专属：训练计划 ==================== -->
    <el-card v-if="detail?.role === 'STUDENT'" shadow="never">
      <template #header>
        <div class="card-head-between">
          <div class="card-head"><el-icon><Calendar /></el-icon><span>训练计划</span></div>
          <el-button v-if="!editingTraining" size="small" type="primary" link @click="startEditTraining">编辑</el-button>
          <template v-else>
            <div style="display:flex;gap:8px">
              <el-button size="small" type="success" :loading="submitting" @click="saveTraining">保存</el-button>
              <el-button size="small" @click="cancelEditTraining">取消</el-button>
            </div>
          </template>
        </div>
      </template>

      <!-- 查看模式 -->
      <el-descriptions v-if="!editingTraining" :column="3" border>
        <el-descriptions-item label="计划开始">{{ detail?.trainingStartDate || '-' }}</el-descriptions-item>
        <el-descriptions-item label="实际开始">{{ detail?.actualStartDate || '-' }}</el-descriptions-item>
        <el-descriptions-item label="计划结束">{{ detail?.trainingEndDate || '-' }}</el-descriptions-item>
        <el-descriptions-item label="可训练日">{{ trainingDaysLabel(detail?.trainingDays) }}</el-descriptions-item>
        <el-descriptions-item label="每日时段">{{ training?.trainingTimeFrom || '--' }} ~ {{ training?.trainingTimeTo || '--' }}</el-descriptions-item>
        <el-descriptions-item label="目标时长">{{ training?.trainingTargetHours ? training.trainingTargetHours + ' 小时' : '-' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 编辑模式 -->
      <el-form v-else :model="trainingForm" label-width="100px" style="max-width:640px">
        <el-form-item label="实际开始日期">
          <el-date-picker v-model="trainingForm.actualStartDate" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="可训练星期">
          <el-select v-model="trainingDaysArr" multiple placeholder="不选 = 每天" style="width:100%">
            <el-option v-for="(name, key) in weekDayNames" :key="key" :label="name" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="时段-起"><el-time-picker v-model="trainingForm.trainingTimeFrom" format="HH:mm" value-format="HH:mm" placeholder="开始时间" style="width:100%" /></el-form-item>
        <el-form-item label="时段-止"><el-time-picker v-model="trainingForm.trainingTimeTo" format="HH:mm" value-format="HH:mm" placeholder="结束时间" style="width:100%" /></el-form-item>
        <el-form-item label="目标时长"><el-input-number v-model="trainingForm.trainingTargetHours" :min="1" :max="999" /> 小时</el-form-item>
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
            <el-tag size="small" type="warning">老师</el-tag>
          </div>
        </div>
      </div>
    </el-card>

    <!-- ==================== 修改密码弹窗 ==================== -->
    <el-dialog v-model="pwdVisible" title="修改密码" width="440px">
      <el-form ref="pwdRef" :model="pwdForm" :rules="pwdRules" label-width="90px">
        <el-form-item label="当前密码" prop="oldPassword"><el-input v-model="pwdForm.oldPassword" type="password" show-password /></el-form-item>
        <el-form-item label="新密码" prop="newPassword"><el-input v-model="pwdForm.newPassword" type="password" show-password /></el-form-item>
        <el-form-item label="确认密码" prop="confirm"><el-input v-model="pwdForm.confirm" type="password" show-password /></el-form-item>
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
