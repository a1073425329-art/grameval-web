<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePermissionStore } from '@/stores/permission'
import { ElMessageBox } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()
const permissionStore = usePermissionStore()

/** 头像来源优先级：login 返回的 avatar(base64/URL) > 用户名映射静态文件 > 角色默认 */
const avatarUrl = computed(() => {
  // 1. 优先使用后端返回的真实头像（可能是 base64 或 URL）
  const realAvatar = authStore.userInfo?.avatar
  if (realAvatar) return realAvatar

  // 2. 预置演示账号 → 静态文件
  const username = authStore.userInfo?.username
  if (username === 'admin')      return '/avatars/admin.jpeg'
  if (username === 'teacher01')  return '/avatars/teacher01.jpeg'
  if (username === 'student01')  return '/avatars/student01.jpg'

  // 3. 按角色兜底
  if (!username) return ''
  return authStore.role === 'ADMIN'
    ? '/avatars/admin.jpeg'
    : '/avatars/student.jpg'
})

/** 个人资料页路径按角色区分 */
const profilePath = computed(() =>
  authStore.role === 'ADMIN' ? '/admin/profile' : '/student/profile'
)

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    authStore.logout()
    permissionStore.reset()
    router.push('/login')
    // 动态路由无法卸载，简单起见 reload 一次
    setTimeout(() => location.reload(), 50)
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div class="layout-header">
    <div class="header-left">
      <span class="header-title">英语语法专项在线考试系统</span>
    </div>
    <div class="header-right">
      <el-dropdown trigger="click">
        <span class="header-user">
          <el-avatar :size="32" :src="avatarUrl">
            <el-icon><UserFilled /></el-icon>
          </el-avatar>
          <span class="username">{{ authStore.userInfo?.displayName || authStore.userInfo?.username || '未登录' }}</span>
          <el-tag v-if="authStore.role" size="small" :type="authStore.role === 'ADMIN' ? 'danger' : 'success'">
            {{ authStore.role === 'ADMIN' ? '管理员' : '学生' }}
          </el-tag>
          <el-icon><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="router.push(profilePath)">
              <el-icon><User /></el-icon>个人资料
            </el-dropdown-item>
            <el-dropdown-item divided @click="handleLogout">
              <el-icon><SwitchButton /></el-icon>退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<style scoped lang="scss">
.layout-header {
  height: 60px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 100;
  position: relative;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.header-right {
  display: flex;
  align-items: center;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;

  &:hover {
    background: #f5f7fa;
  }
}

.username {
  font-size: 14px;
  color: #333;
}
</style>