<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { User, Lock, Message, Avatar, Phone } from '@element-plus/icons-vue'
import type { RegisterForm } from '@/types/user'
import type { Role } from '@/types/common'
import { commonRules, sameAs } from '@/utils/formRules'
import { FormLimits } from '@/utils/formLimits'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive<RegisterForm & { confirmPassword: string }>({
  username: '',
  password: '',
  confirmPassword: '',
  realName: '',
  role: 'STUDENT',
  email: '',
  phone: '',
})

// 支持 /register?role=admin 预选角色
onMounted(() => {
  const q = String(route.query.role || '').toUpperCase()
  if (q === 'STUDENT' || q === 'ADMIN') {
    form.role = q as Role
  }
})

const rules: FormRules = {
  username: commonRules.username,
  password: commonRules.password,
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: sameAs(() => form.password, '两次输入的密码不一致'), trigger: 'blur' },
  ],
  realName: commonRules.realNameRequired,
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  email: commonRules.email,
  phone: commonRules.phone,
}

const handleRegister = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      // 去掉 confirmPassword，剩下的字段名与后端 RegisterRequest 完全对齐
      const { confirmPassword: _c, ...payload } = form
      await authStore.register(payload)
      ElMessage.success('注册成功，请登录')
      // 注册的是哪种角色，就跳到对应登录入口
      const loginPath = form.role === 'ADMIN' ? '/login/admin' : '/login/student'
      router.push(loginPath)
    } catch {
      // handled
    } finally {
      loading.value = false
    }
  })
}
</script>

<template>
  <div class="register-container">
    <div class="register-card">
      <h1 class="register-title">GramEval</h1>
      <p class="register-subtitle">创建新账号</p>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="0" size="large">
        <el-form-item prop="role">
          <el-radio-group v-model="form.role" class="role-tabs">
            <el-radio-button label="STUDENT" value="STUDENT">学生</el-radio-button>
            <el-radio-button label="ADMIN" value="ADMIN">管理员</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item prop="username">
          <el-input v-model="form.username" :maxlength="FormLimits.username.max" placeholder="用户名 (3-100 字符)" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="realName">
          <el-input v-model="form.realName" :maxlength="FormLimits.realName.max" placeholder="真实姓名" :prefix-icon="Avatar" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" :maxlength="FormLimits.password.max" placeholder="密码 (6-100 字符)" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" :maxlength="FormLimits.password.max" placeholder="确认密码" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item prop="email">
          <el-input v-model="form.email" :maxlength="FormLimits.email.max" placeholder="邮箱（可选）" :prefix-icon="Message" />
        </el-form-item>
        <el-form-item prop="phone">
          <el-input v-model="form.phone" :maxlength="FormLimits.phone.max" placeholder="手机号（可选）" :prefix-icon="Phone" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" style="width: 100%" @click="handleRegister">
            {{ loading ? '注册中...' : '注 册' }}
          </el-button>
        </el-form-item>
      </el-form>

      <div style="text-align: center; margin-top: 8px">
        <el-text type="info" size="small">
          已有账号？
          <el-link type="primary" @click="router.push('/login')">去登录</el-link>
        </el-text>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.register-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.register-card {
  width: 420px;
  padding: 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.register-title {
  text-align: center;
  margin-bottom: 4px;
  font-size: 28px;
  font-weight: 700;
  color: #333;
}

.register-subtitle {
  text-align: center;
  margin-bottom: 24px;
  font-size: 14px;
  color: #999;
}

.role-tabs {
  display: flex;
  justify-content: center;
  width: 100%;

  :deep(.el-radio-button__inner) {
    width: 140px;
    text-align: center;
  }
}
</style>
