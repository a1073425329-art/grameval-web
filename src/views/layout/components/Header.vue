<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePermissionStore } from '@/stores/permission'
import { ElMessageBox } from 'element-plus'
import { getMyNotifications, getUnreadCount, markNotificationRead, markAllRead as markAllReadApi, calculateMessages } from '@/api/student'
import type { MessageNotification } from '@/types/notification'

const router = useRouter()
const authStore = useAuthStore()
const permissionStore = usePermissionStore()

/** 头像下拉快捷入口 */
const dropdownLinks = computed(() => {
  if (authStore.role === 'ADMIN') return [
    { path: '/dashboard', icon: 'HomeFilled', label: '工作台' },
    { path: '/admin/profile', icon: 'User', label: '个人资料' },
    { path: '/admin/messages', icon: 'Bell', label: '消息中心' },
    { path: '/admin/operation-logs', icon: 'Document', label: '操作日志' },
  ]
  return [
    { path: '/student/home', icon: 'HomeFilled', label: '首页' },
    { path: '/student/messages', icon: 'Bell', label: '消息中心' },
    { path: '/student/stats', icon: 'TrendCharts', label: '学习数据' },
    { path: '/student/profile', icon: 'User', label: '个人资料' },
  ]
})

/** 头像来源 */
const avatarUrl = computed(() => {
  const realAvatar = authStore.userInfo?.avatar
  if (realAvatar) return realAvatar
  const username = authStore.userInfo?.username
  if (username === 'admin') return '/avatars/admin.jpeg'
  if (username === 'teacher01') return '/avatars/teacher01.jpeg'
  if (username === 'student01') return '/avatars/student01.jpg'
  if (!username) return ''
  return authStore.role === 'ADMIN' ? '/avatars/admin.jpeg' : '/avatars/student.jpg'
})

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
    authStore.logout(); permissionStore.reset(); router.push('/login')
    setTimeout(() => location.reload(), 50)
  } catch { /* cancelled */ }
}

// ===== 通知 Bell Dropdown =====
const unreadCount = ref(0)
const unreadUrgent = ref(0)
const recentMessages = ref<MessageNotification[]>([])
const bellVisible = ref(false)

const loadBellData = async () => {
  try {
    const [countRes, msgRes] = await Promise.all([
      getUnreadCount(),
      getMyNotifications({ pageNum: 1, pageSize: 5, unreadOnly: true }),
    ])
    unreadCount.value = countRes.data?.total ?? 0
    unreadUrgent.value = countRes.data?.urgent ?? 0
    recentMessages.value = msgRes.data?.records ?? []
  } catch { /* ignore */ }
}

const handleMsgClick = async (msg: MessageNotification) => {
  try { await markNotificationRead(msg.id); unreadCount.value = Math.max(0, unreadCount.value - 1); msg.isRead = true } catch { /* */ }
  if (msg.actionUrl) router.push(msg.actionUrl)
  bellVisible.value = false
}

const handleMarkAllRead = async () => {
  try { await markAllReadApi(); unreadCount.value = 0; unreadUrgent.value = 0; recentMessages.value = []; bellVisible.value = false } catch { /* */ }
}

const goToMessageCenter = () => {
  bellVisible.value = false
  router.push(authStore.role === 'ADMIN' ? '/admin/messages' : '/student/messages')
}

const formatTime = (t: string) => {
  const d = new Date(t); const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 60_000) return '刚刚'
  if (diffMs < 3_600_000) return Math.floor(diffMs / 60_000) + '分钟前'
  if (diffMs < 86_400_000) return Math.floor(diffMs / 3_600_000) + '小时前'
  return Math.floor(diffMs / 86_400_000) + '天前'
}

// 登录后触发消息计算
onMounted(async () => {
  try {
    await calculateMessages()
    await loadBellData()
  } catch { loadBellData() }
})
</script>

<template>
  <div class="layout-header">
    <div class="header-left">
      <span class="header-title">英语语法专项在线考试系统</span>
    </div>
    <div class="header-right">
      <!-- 通知铃铛 + Dropdown -->
      <el-popover
        v-model:visible="bellVisible"
        trigger="click"
        placement="bottom-end"
        :width="400"
        :offset="4"
        popper-class="bell-popover"
        @show="loadBellData"
      >
        <template #reference>
          <span class="notification-icon" :class="{ 'has-urgent': unreadUrgent > 0 }">
            <el-icon :size="20"><Bell /></el-icon>
            <el-badge
              v-if="unreadCount > 0"
              :value="unreadCount > 99 ? '99+' : unreadCount"
              :max="99"
              :class="unreadUrgent > 0 ? 'badge-urgent' : 'badge-normal'"
            />
          </span>
        </template>
        <!-- Dropdown content -->
        <div class="bell-dropdown">
          <div class="bell-header">
            <span>消息通知</span>
            <div>
              <el-button size="small" text @click="goToMessageCenter">查看全部</el-button>
              <el-button v-if="unreadCount > 0" size="small" text type="primary" @click="handleMarkAllRead">全部已读</el-button>
            </div>
          </div>
          <div class="bell-body">
            <div v-if="recentMessages.length === 0" style="text-align:center;padding:24px 0;color:#999">
              <el-empty description="暂无未读消息" :image-size="60" />
            </div>
            <div
              v-for="msg in recentMessages" :key="msg.id"
              class="bell-item"
              @click="handleMsgClick(msg)"
            >
              <div class="bell-item-icon" :style="{ background: (msg.color || '#409EFF') + '14', color: msg.color || '#409EFF' }">
                <el-icon :size="16"><component :is="msg.icon || 'Bell'" /></el-icon>
              </div>
              <div class="bell-item-body">
                <div class="bell-item-title">
                  <span v-if="msg.priority === 2" style="color:#F56C6C;margin-right:2px">🔴</span>
                  {{ msg.title }}
                </div>
                <div class="bell-item-summary">{{ msg.summary || msg.content?.substring(0, 60) }}</div>
                <div class="bell-item-time">{{ formatTime(msg.createTime) }} · {{ msg.typeLabel }}</div>
              </div>
            </div>
          </div>
        </div>
      </el-popover>

      <!-- 用户头像 + 下拉 -->
      <el-dropdown trigger="click">
        <span class="header-user">
          <el-avatar :size="32" :src="avatarUrl"><el-icon><UserFilled /></el-icon></el-avatar>
          <span class="username">{{ authStore.userInfo?.displayName || authStore.userInfo?.username || '未登录' }}</span>
          <el-tag v-if="authStore.role" size="small" :type="authStore.role === 'ADMIN' ? 'danger' : 'success'">{{ authStore.role === 'ADMIN' ? '管理员' : '学生' }}</el-tag>
          <el-icon><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="link in dropdownLinks" :key="link.path" @click="router.push(link.path)">
              <el-icon><component :is="link.icon" /></el-icon>{{ link.label }}
            </el-dropdown-item>
            <el-dropdown-item divided @click="handleLogout"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<style scoped lang="scss">
.layout-header {
  height: 60px; background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; z-index: 100; position: relative;
}
.header-left { display: flex; align-items: center; }
.header-title { font-size: 16px; font-weight: 600; color: #333; }
.header-right { display: flex; align-items: center; gap: 16px; }

.notification-icon {
  position: relative; cursor: pointer; padding: 6px; border-radius: 8px;
  transition: all 0.2s; color: #606266; display: flex; align-items: center;
  &:hover { background: #f5f7fa; color: #409eff; }
  &.has-urgent { animation: pulse-urgent 2s infinite; }
}
@keyframes pulse-urgent {
  0%, 100% { color: #606266; }
  50% { color: #F56C6C; }
}
.badge-normal { position: absolute; top: -2px; right: -6px; }
.badge-urgent { position: absolute; top: -2px; right: -6px; }

.header-user {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 4px 8px; border-radius: 4px; transition: background 0.2s;
  &:hover { background: #f5f7fa; }
}
.username { font-size: 14px; color: #333; }
</style>

<!-- 全局样式，需要 unscoped 才能渗透到 popover 内 -->
<style lang="scss">
.bell-popover { padding: 0 !important; border-radius: 12px !important; overflow: hidden; }
.bell-dropdown { max-height: 440px; display: flex; flex-direction: column; }
.bell-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid #f0f0f0; font-weight: 600; font-size: 14px;
}
.bell-body {
  flex: 1; overflow-y: auto; max-height: 360px;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #dcdfe6; border-radius: 2px; }
}
.bell-item {
  display: flex; align-items: flex-start; padding: 10px 16px; cursor: pointer;
  transition: background 0.15s; border-bottom: 1px solid #fafafa;
  &:hover { background: #f5f7fa; }
}
.bell-item-icon {
  width: 32px; height: 32px; border-radius: 8px; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0; margin-right: 10px;
}
.bell-item-body { flex: 1; min-width: 0; }
.bell-item-title { font-size: 13px; font-weight: 500; color: #303133; margin-bottom: 2px; }
.bell-item-summary { font-size: 12px; color: #909399; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bell-item-time { font-size: 11px; color: #c0c4cc; margin-top: 2px; }
</style>
