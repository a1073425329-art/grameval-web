<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore, HOME_BY_ROLE } from '@/stores/auth'
import { usePermissionStore } from '@/stores/permission'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import type { LoginForm } from '@/types/user'
import type { Role } from '@/types/common'
import { FormLimits } from '@/utils/formLimits'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const permissionStore = usePermissionStore()

/**
 * 登录页的"角色入口"：
 *   /login              → tab = '' （通用，不锁定，允许任意角色登录）
 *   /login/student      → tab = 'STUDENT'  （预选并锁定）
 *   /login/admin        → tab = 'ADMIN'    （预选并锁定）
 *   /login?role=student → 兼容 query 写法
 *
 * 锁定态：URL 里明确指定了角色，页面上禁止切换（避免误操作），
 * 提交时把 role 一并给后端做身份校验。
 */
function normalizeRole(v: unknown): Role | '' {
  if (!v) return ''
  const s = String(v).toUpperCase()
  if (s === 'STUDENT' || s === 'ADMIN') return s
  return ''
}

const initialRole = computed<Role | ''>(() => {
  const fromPath = normalizeRole(route.params.role)
  if (fromPath) return fromPath
  return normalizeRole(route.query.role)
})

/** 是否为锁定入口（URL 已指定角色） */
const locked = computed(() => Boolean(initialRole.value))

const loading = ref(false)
const activeRole = ref<Role>(initialRole.value || 'STUDENT')

/**
 * 默认快捷账号
 *
 * [2026-10-16 修复] 原 STUDENT 快捷账号里的 `student01` / `student03` 在库中并不存在
 * （库里真实学生账号是 user01~user05 与 student001/002/008/009），
 * 点按钮后提交会得到「用户名或密码错误」。
 * 现改成 4 个可用账号，label 一律用库里的真实姓名（不出现测试用例术语），
 * 密码统一 123456：
 *   系统管理员 admin / 王老师 teacher01 / 张小明 user01 / 李小红 user02
 * 说明：user01~user05 是库中真实学生（张小明/李小红/王小刚/赵小丽/孙小华），
 * user01 数据最丰富（12 次考试 + 176 次练习），首页演示效果最好。
 *
 * 原始实现保留备查：
 *   STUDENT: [
 *     { username: 'user01',    password: '123456', label: '演示学生' },
 *     { username: 'student01', password: '123456', label: '李小红' },
 *     { username: 'student03', password: '123456', label: '王小刚' },
 *   ],
 */
const PRESET_ACCOUNTS: Record<Role, { username: string; password: string; label: string }[]> = {
  ADMIN: [
    { username: 'admin', password: '123456', label: '系统管理员' },
    { username: 'teacher01', password: '123456', label: '王老师' },
  ],
  STUDENT: [
    { username: 'user01', password: '123456', label: '张小明' },
    { username: 'user02', password: '123456', label: '李小红' },
  ],
}

const currentPresets = computed(() => PRESET_ACCOUNTS[activeRole.value])

const loginForm = reactive<LoginForm>({
  username: '',
  password: '',
  role: undefined,
})

// URL 变了（比如从 /login 切到 /login/admin），tab 也跟着变
watch(
  () => route.fullPath,
  () => {
    if (initialRole.value) {
      activeRole.value = initialRole.value
    }
  },
)

const handleRoleChange = (r: string | number) => {
  if (locked.value) return
  activeRole.value = r as Role
}

/**
 * [2026-09-27 新增] 目标路径的归属角色与当前登录角色不符？
 *   /admin/* 与 /dashboard 属 ADMIN，/student/* 属 STUDENT。
 *
 * 为什么在登录页做这道静态判断：未登录时地址栏里的目标会被守卫存进 `?redirect=`，
 * 换个账号登录后原样回放，很可能属于另一个角色 —— 学生回跳 /admin/* 必然 404。
 * 这里刻意**不用** `router.resolve()`：此刻 `permissionStore.reset()` 刚执行、
 * 动态路由尚未注册，resolve 对任何业务路径都会返回 NotFound，会把合法回跳也误杀。
 * superOnly / disabled 这类细粒度权限仍由全局守卫兜底（两道防线）。
 */
function isOtherRolePath(path: string, role: Role): boolean {
  if (path.startsWith('/admin') || path === '/dashboard') return role !== 'ADMIN'
  if (path.startsWith('/student')) return role !== 'STUDENT'
  return false
}

const handleLogin = async () => {
  if (!loginForm.username || !loginForm.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }

  loading.value = true
  try {
    // 只有锁定入口才把 role 发给后端做严格校验；
    // 通用入口(/login) 不带 role，后端会按账号实际角色返回。
    const payload: LoginForm = {
      username: loginForm.username,
      password: loginForm.password,
      role: locked.value ? activeRole.value : undefined,
    }
    const user = await authStore.login(payload)

    // 登录切换了角色，清掉之前生成的动态路由，让守卫重新生成
    permissionStore.reset()

    ElMessage.success('登录成功')

    // 跳转优先级：显式 redirect → 角色首页
    // [2026-09-27 修复] redirect 归属角色不符时回落角色首页，避免登录成功却落到 404
    const redirectRaw = route.query.redirect as string | undefined
    const redirect =
      redirectRaw && !isOtherRolePath(redirectRaw, user.role)
        ? redirectRaw
        : HOME_BY_ROLE[user.role]
    router.push(redirect)
  } catch {
    // 拦截器已经弹过错误
  } finally {
    loading.value = false
  }
}

const goRegister = () => {
  router.push({ path: '/register', query: { role: activeRole.value } })
}

/** 已登录状态下访问登录页 → 直接送到角色首页（备份守卫的逻辑，避免闪一下） */
onMounted(() => {
  if (authStore.token && authStore.role) {
    router.replace(authStore.homePath)
  }
})

const roleLabel = computed(() => (activeRole.value === 'ADMIN' ? '管理员' : '学生'))
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">GramEval</h1>
      <p class="login-subtitle">英语语法专项在线考试系统</p>

      <!-- 角色切换：URL 已锁定角色时禁用切换 -->
      <el-radio-group
        v-model="activeRole"
        class="role-tabs"
        size="large"
        :disabled="locked"
        @change="handleRoleChange"
      >
        <el-radio-button label="STUDENT" value="STUDENT">学生登录</el-radio-button>
        <el-radio-button label="ADMIN" value="ADMIN">管理员登录</el-radio-button>
      </el-radio-group>

      <p v-if="locked" class="locked-hint">
        当前为「{{ roleLabel }}」专用入口
      </p>

      <el-form
        :model="loginForm"
        label-width="0"
        @keyup.enter="handleLogin"
        size="large"
      >
        <el-form-item>
          <el-input
            v-model="loginForm.username"
            :placeholder="`输入${roleLabel}账号`"
            :prefix-icon="User"
            :maxlength="FormLimits.username.max"
            autocomplete="username"
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            :prefix-icon="Lock"
            :maxlength="FormLimits.password.max"
            show-password
            autocomplete="current-password"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :loading="loading"
            style="width: 100%"
            @click="handleLogin"
          >
            {{ loading ? '登录中...' : `${roleLabel}登录` }}
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 快捷选择账号 -->
      <div class="quick-accounts">
        <div class="quick-label">快捷登录</div>
        <div class="quick-btns">
          <el-button
            v-for="acct in currentPresets"
            :key="acct.username"
           
            plain
            @click="loginForm.username = acct.username; loginForm.password = acct.password"
          >
            {{ acct.label }}
          </el-button>
        </div>
      </div>

      <div class="login-footer">
        <el-text type="info">
          还没有账号？
          <el-link type="primary" @click="goRegister">立即注册</el-link>
        </el-text>
        <!-- [2026-10-16 取消] 管理员默认账号提示行：论文已按此版截图，隐藏该行但不改布局；旧代码注释保留
        <el-text v-if="activeRole === 'ADMIN'" type="info" class="hint">
          管理员默认账号：admin / 123456
        </el-text>
        -->
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 420px;
  padding: 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.login-title {
  text-align: center;
  margin-bottom: 4px;
  font-size: 28px;
  font-weight: 700;
  color: #333;
}

.login-subtitle {
  text-align: center;
  margin-bottom: 20px;
  font-size: 14px;
  color: #999;
}

.role-tabs {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;

  :deep(.el-radio-button__inner) {
    width: 140px;
    text-align: center;
  }
}

.locked-hint {
  text-align: center;
  font-size: 12px;
  color: #67c23a;
  margin: 0 0 16px;
}

.role-tabs + .el-form,
.locked-hint + .el-form {
  margin-top: 16px;
}

.quick-accounts {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #ebeef5;
}
.quick-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}
.quick-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.login-footer {
  text-align: center;
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  .hint {
    opacity: 0.75;
  }
}

.login-credential-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  text-align: left;
  width: 100%;
}
</style>
