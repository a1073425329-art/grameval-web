<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getMyNotifications, getUnreadCountByCategory, calculateMessages,
  markNotificationRead, markAllRead, toggleStar, togglePin,
  deleteNotification, batchMarkRead, batchDeleteNotifications, archiveNotification,
  getNotificationPreferences, updateNotificationPreferences,
} from '@/api/student'
import type { MessageNotification, MessageQuery, NotificationPreference } from '@/types/notification'
import { CATEGORY_OPTIONS } from '@/types/notification'

const router = useRouter()

// === State ===
const messages = ref<MessageNotification[]>([])
const loading = ref(false)
const total = ref(0)
const query = reactive<MessageQuery>({ pageNum: 1, pageSize: 30 })
const activeFolder = ref<'all' | 'unread' | 'starred' | 'archived'>('all')
const activeCategory = ref<string>('')
const selectedMsg = ref<MessageNotification | null>(null)
const selectedIds = ref<Set<number>>(new Set())
const selectionMode = ref(false)
const categoryCounts = reactive<Record<string, number>>({ INFO: 0, ALERT: 0, REMIND: 0, ACHIEVEMENT: 0, INTERACTION: 0, SYSTEM: 0 })
const searchKeyword = ref('')
const unreadTotal = ref(0)
const showPrefs = ref(false)
const prefs = ref<NotificationPreference | null>(null)

// === Folders ===
const folders = computed(() => [
  { key: 'all', label: '全部消息', icon: 'Message', count: total.value },
  { key: 'unread', label: '未读', icon: 'ChatLineSquare', count: unreadTotal.value, highlight: true },
  { key: 'starred', label: '收藏', icon: 'Star', count: null },
  { key: 'archived', label: '归档', icon: 'Box', count: null },
])

const categoryFolders = computed(() =>
  CATEGORY_OPTIONS.map(c => ({
    ...c,
    key: c.value,
    count: categoryCounts[c.value] ?? 0,
  }))
)

// === Load ===
const load = async () => {
  loading.value = true
  try {
    const p: MessageQuery = { ...query, pageNum: query.pageNum, pageSize: query.pageSize }
    if (activeFolder.value === 'unread') p.unreadOnly = true
    else if (activeFolder.value === 'starred') p.starredOnly = true
    else if (activeFolder.value === 'archived') p.archivedOnly = true
    if (activeCategory.value) p.category = activeCategory.value
    if (searchKeyword.value) p.keyword = searchKeyword.value
    const res = await getMyNotifications(p)
    messages.value = res.data?.records ?? []
    total.value = res.data?.total ?? 0
  } finally { loading.value = false }
}

const loadCounts = async () => {
  try {
    const res = await getUnreadCountByCategory()
    if (res.data) { Object.keys(categoryCounts).forEach(k => categoryCounts[k] = (res.data as any)[k] ?? 0) }
    unreadTotal.value = Object.values(categoryCounts).reduce((a: number, b: number) => a + b, 0)
  } catch { /* */ }
}

const loadPrefs = async () => {
  try { const r = await getNotificationPreferences(); prefs.value = r.data } catch { /* */ }
}

onMounted(() => { calculateMessages(); load(); loadCounts(); loadPrefs() })

watch([activeFolder, activeCategory], () => { query.pageNum = 1; load() })
watch(searchKeyword, () => { query.pageNum = 1; load() })

// === Actions ===
const selectMsg = (msg: MessageNotification) => {
  if (selectionMode.value) { toggleSelect(msg.id); return }
  selectedMsg.value = msg
  if (!msg.isRead) {
    markNotificationRead(msg.id)
    msg.isRead = true
    loadCounts()
  }
}

const toggleSelect = (id: number) => {
  const s = new Set(selectedIds.value); s.has(id) ? s.delete(id) : s.add(id); selectedIds.value = s
}

const selectAll = () => {
  if (selectedIds.value.size === messages.value.length) selectedIds.value = new Set()
  else selectedIds.value = new Set(messages.value.map(m => m.id))
}

const handleStar = async (msg: MessageNotification) => { await toggleStar(msg.id); msg.isStarred = !msg.isStarred }

const handlePin = async (msg: MessageNotification) => { await togglePin(msg.id); msg.isPinned = !msg.isPinned }

const handleArchive = async (msg: MessageNotification) => {
  await archiveNotification(msg.id); messages.value = messages.value.filter(m => m.id !== msg.id)
  if (selectedMsg.value?.id === msg.id) selectedMsg.value = null; ElMessage.success('已归档')
}

const handleDelete = async (msg: MessageNotification) => {
  await deleteNotification(msg.id); messages.value = messages.value.filter(m => m.id !== msg.id)
  if (selectedMsg.value?.id === msg.id) selectedMsg.value = null
}

const handleBatchRead = async () => {
  if (selectedIds.value.size === 0) return
  await batchMarkRead([...selectedIds.value])
  messages.value.forEach(m => { if (selectedIds.value.has(m.id)) m.isRead = true })
  selectedIds.value = new Set(); selectionMode.value = false; loadCounts()
}

const handleBatchDelete = async () => {
  if (selectedIds.value.size === 0) return
  await ElMessageBox.confirm(`确定删除 ${selectedIds.value.size} 条消息？`, '确认', { type: 'warning' })
  await batchDeleteNotifications([...selectedIds.value])
  messages.value = messages.value.filter(m => !selectedIds.value.has(m.id))
  selectedIds.value = new Set(); selectionMode.value = false
}

const handleMarkAllRead = async () => { await markAllRead(); messages.value.forEach(m => m.isRead = true); loadCounts(); ElMessage.success('全部已读') }

const handleClickAction = (msg: MessageNotification) => {
  if (msg.actionUrl) router.push(msg.actionUrl)
}

const savePrefs = async () => {
  if (!prefs.value) return
  try {
    await updateNotificationPreferences(prefs.value)
    ElMessage.success('偏好已保存'); showPrefs.value = false
  } catch { /* */ }
}

const formatTime = (t: string) => {
  const d = new Date(t); const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return Math.floor(diff / 60_000) + '分钟前'
  if (diff < 86400_000) return Math.floor(diff / 3600_000) + '小时前'
  if (diff < 604800_000) return Math.floor(diff / 86400_000) + '天前'
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

// Keyboard shortcuts
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') { selectedMsg.value = null; selectionMode.value = false; selectedIds.value = new Set() }
  if (e.key === 'j' && !e.ctrlKey && !e.metaKey && messages.value.length > 0) {
    const idx = messages.value.findIndex(m => m.id === selectedMsg.value?.id)
    // noUncheckedIndexedAccess 下取出的元素可能为 undefined，取到再跳转
    const next = messages.value[idx + 1]
    if (idx < messages.value.length - 1 && next) selectMsg(next)
  }
  if (e.key === 'k' && !e.ctrlKey && !e.metaKey && messages.value.length > 0) {
    const idx = messages.value.findIndex(m => m.id === selectedMsg.value?.id)
    // 同上：先取出并判空，避免索引访问产生的 undefined
    const prev = messages.value[idx - 1]
    if (idx > 0 && prev) selectMsg(prev)
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="msg-app">
    <!-- Left Sidebar -->
    <aside class="msg-sidebar">
      <div class="sidebar-header">
        <el-button type="primary" size="small" @click="router.back()" style="width:100%">
          <el-icon><ArrowLeft /></el-icon>返回
        </el-button>
      </div>

      <nav class="sidebar-nav">
        <div
          v-for="f in folders" :key="f.key"
          :class="['nav-item', { active: activeFolder === f.key && !activeCategory }]"
          @click="activeFolder = f.key as any; activeCategory = ''"
        >
          <el-icon><component :is="f.icon" /></el-icon>
          <span class="nav-label">{{ f.label }}</span>
          <el-badge v-if="f.count !== null && f.count > 0"
            :value="f.count > 999 ? '999+' : f.count" :type="f.highlight ? 'danger' : 'info'" class="nav-badge" />
        </div>
      </nav>

      <div class="sidebar-divider" />

      <nav class="sidebar-nav">
        <div
          v-for="c in categoryFolders" :key="c.key"
          :class="['nav-item', { active: activeCategory === c.key }]"
          @click="activeCategory = c.key; activeFolder = 'all'"
        >
          <span class="nav-dot" :style="{ background: c.color }" />
          <span class="nav-label">{{ c.label }}</span>
          <el-badge v-if="c.count > 0" :value="c.count > 999 ? '999+' : c.count" class="nav-badge-cat" />
        </div>
      </nav>

      <div class="sidebar-divider" />

      <div class="sidebar-footer">
        <el-button text size="small" @click="showPrefs = true" style="width:100%">
          <el-icon><Setting /></el-icon>通知偏好
        </el-button>
      </div>
    </aside>

    <!-- Middle: Message List -->
    <section class="msg-list-panel">
      <el-alert type="info" :closable="false" style="margin:0 0 1px 0;border-radius:0;font-size:12px">
        消息分类：🔵信息=通知 · 🔴告警=需关注 · 🟡提醒=时效性 · 🟢成就=正面反馈 · 🟣互动=师生交流。置顶消息始终排最前，紧急消息红色高亮。
        <el-tooltip content="登录时自动计算消息：系统扫描你的考试、成绩、错题、知识点等25种条件，生成对应消息。已生成过的消息24小时内不重复。紧急消息(priority=2)在铃铛上触发红色脉冲动画。" placement="bottom" effect="light">
          <el-icon style="cursor:help;color:#409EFF;vertical-align:middle"><QuestionFilled /></el-icon>
        </el-tooltip>
      </el-alert>
      <div class="list-toolbar">
        <div class="toolbar-left">
          <el-button size="small" :type="selectionMode ? 'primary' : 'default'" @click="selectionMode = !selectionMode; selectedIds = new Set()">
            {{ selectionMode ? '取消' : '多选' }}
          </el-button>
          <template v-if="selectionMode">
            <el-button size="small" :disabled="selectedIds.size === 0" @click="selectAll">
              {{ selectedIds.size === messages.length ? '取消全选' : '全选' }}
            </el-button>
            <el-button size="small" type="warning" :disabled="selectedIds.size === 0" @click="handleBatchRead">已读</el-button>
            <el-button size="small" type="danger" :disabled="selectedIds.size === 0" @click="handleBatchDelete">删除</el-button>
            <span style="font-size:12px;color:#909399">{{ selectedIds.size }} 条选中</span>
          </template>
          <template v-else>
            <el-button size="small" text @click="handleMarkAllRead" :disabled="unreadTotal === 0">全部已读</el-button>
          </template>
        </div>
        <div class="toolbar-right">
          <el-input v-model="searchKeyword" placeholder="搜索消息…" size="small" clearable style="width:220px" prefix-icon="Search" />
        </div>
      </div>

      <div class="list-scroll" v-loading="loading">
        <TransitionGroup name="msg-list" v-if="messages.length > 0">
          <div
            v-for="msg in messages" :key="msg.id"
            :class="['msg-item', {
              unread: !msg.isRead,
              active: selectedMsg?.id === msg.id,
              selected: selectedIds.has(msg.id),
              pinned: msg.isPinned,
              urgent: msg.priority >= 2
            }]"
            @click="selectMsg(msg)"
          >
            <el-checkbox v-if="selectionMode" :model-value="selectedIds.has(msg.id)" @click.stop="toggleSelect(msg.id)" class="msg-check" />
            <div class="msg-item-icon" :style="{ background: (msg.color || '#409EFF') + '12', color: msg.color || '#409EFF' }">
              <el-icon :size="18"><component :is="msg.icon || 'Bell'" /></el-icon>
            </div>
            <div class="msg-item-body">
              <div class="msg-item-top">
                <span class="msg-item-title">
                  <span v-if="msg.isPinned" class="pin-icon">📌</span>
                  <span v-if="!msg.isRead" class="unread-dot" />
                  {{ msg.title }}
                </span>
                <span class="msg-item-time">{{ formatTime(msg.createTime) }}</span>
              </div>
              <div class="msg-item-preview">{{ msg.summary || msg.content?.replace(/<[^>]*>/g, '').substring(0, 80) }}</div>
              <div class="msg-item-meta">
                <el-tag size="small" :color="msg.color" effect="dark" style="--el-tag-bg-color:transparent;color:inherit;border-color:transparent;font-size:11px;padding:0 2px">
                  {{ msg.typeLabel || msg.type }}
                </el-tag>
                <span v-if="msg.senderName" style="font-size:11px;color:#c0c4cc">{{ msg.senderName }}</span>
                <span v-if="msg.isStarred" style="color:#E6A23C">⭐</span>
              </div>
            </div>
          </div>
        </TransitionGroup>
        <el-empty v-else description="暂无消息" :image-size="80" style="margin-top:60px" />
      </div>

      <el-pagination
        v-if="total > (query.pageSize || 10)"
        v-model:current-page="query.pageNum" :page-size="query.pageSize || 10"
        :total="total" layout="prev, pager, next" small
        @change="load" class="list-pagination"
      />
    </section>

    <!-- Right: Detail Panel -->
    <aside class="msg-detail-panel" v-if="selectedMsg">
      <div class="detail-header">
        <h3>{{ selectedMsg.title }}</h3>
        <el-button text circle @click="selectedMsg = null"><el-icon><Close /></el-icon></el-button>
      </div>
      <div class="detail-meta">
        <el-tag :color="selectedMsg.color" effect="dark" size="small">{{ selectedMsg.typeLabel || selectedMsg.type }}</el-tag>
        <span>{{ formatTime(selectedMsg.createTime) }}</span>
        <span v-if="selectedMsg.senderName">来自 {{ selectedMsg.senderName }}</span>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html —— 通知内容是可信后端下发的 HTML, 展示需要 -->
      <div class="detail-content" v-html="selectedMsg.content || selectedMsg.summary" />
      <div class="detail-actions" v-if="selectedMsg.actionUrl">
        <el-button type="primary" @click="handleClickAction(selectedMsg)">{{ selectedMsg.actionText || '查看详情' }}</el-button>
        <el-button v-if="selectedMsg.secondaryActionUrl" @click="router.push(selectedMsg.secondaryActionUrl!)">{{ selectedMsg.secondaryActionText || '操作' }}</el-button>
      </div>
      <div class="detail-bar">
        <el-button text :type="selectedMsg.isStarred ? 'warning' : 'default'" @click="handleStar(selectedMsg)" :icon="selectedMsg.isStarred ? 'StarFilled' : 'Star'" title="收藏" />
        <el-button text @click="handlePin(selectedMsg)" :title="selectedMsg.isPinned ? '取消置顶' : '置顶'">
          <el-icon><Top /></el-icon>
        </el-button>
        <el-button text @click="handleArchive(selectedMsg)" title="归档"><el-icon><Box /></el-icon></el-button>
        <el-button text @click="handleDelete(selectedMsg)" title="删除" style="color:#F56C6C"><el-icon><Delete /></el-icon></el-button>
      </div>
    </aside>

    <!-- Preferences Dialog -->
    <el-dialog v-model="showPrefs" title="通知偏好设置" width="520px">
      <div v-if="prefs" class="prefs-form">
        <el-form label-width="100px" label-position="left" size="small">
          <el-form-item label="通知总开关"><el-switch v-model="prefs.notificationEnabled" /></el-form-item>
          <el-form-item label="免打扰"><el-switch v-model="prefs.quietHoursEnabled" /></el-form-item>
          <el-form-item v-if="prefs.quietHoursEnabled" label="免打扰时段">
            <el-time-select v-model="prefs.quietStartTime" placeholder="开始" start="00:00" step="00:30" end="23:30" style="width:120px" />
            <span style="margin:0 8px">至</span>
            <el-time-select v-model="prefs.quietEndTime" placeholder="结束" start="00:00" step="00:30" end="23:30" style="width:120px" />
          </el-form-item>
          <el-divider />
          <el-form-item label="站内信"><el-switch v-model="prefs.inAppEnabled" /></el-form-item>
          <el-form-item label="App推送"><el-switch v-model="prefs.pushEnabled" /></el-form-item>
          <el-form-item label="邮件通知"><el-switch v-model="prefs.emailEnabled" /></el-form-item>
          <el-form-item v-if="prefs.emailEnabled" label="邮箱地址"><el-input v-model="prefs.emailAddress" placeholder="your@email.com" /></el-form-item>
          <el-form-item label="短信通知"><el-switch v-model="prefs.smsEnabled" /></el-form-item>
          <el-form-item v-if="prefs.smsEnabled" label="手机号"><el-input v-model="prefs.phoneNumber" placeholder="手机号" /></el-form-item>
          <el-divider />
          <el-form-item label="声音提醒"><el-switch v-model="prefs.soundEnabled" /></el-form-item>
          <el-form-item label="桌面通知"><el-switch v-model="prefs.desktopNotificationEnabled" /></el-form-item>
        </el-form>
      </div>
      <template #footer><el-button @click="showPrefs = false">取消</el-button><el-button type="primary" @click="savePrefs">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.msg-app {
  display: flex; height: calc(100vh - 60px); background: #f5f7fa;

  // === Sidebar ===
  .msg-sidebar { width: 200px; background: #fff; border-right: 1px solid #ebeef5; display: flex; flex-direction: column; flex-shrink: 0; padding: 12px 8px; }
  .sidebar-header { margin-bottom: 8px; }
  .sidebar-nav { display: flex; flex-direction: column; gap: 2px; }
  .nav-item {
    display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px;
    cursor: pointer; font-size: 13px; color: #606266; transition: all 0.15s; position: relative;
    &:hover { background: #f5f7fa; }
    &.active { background: #ecf5ff; color: #409EFF; font-weight: 600; }
    .nav-label { flex: 1; }
    .nav-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .nav-badge, .nav-badge-cat { flex-shrink: 0; }
  }
  .sidebar-divider { height: 1px; background: #ebeef5; margin: 8px 0; }
  .sidebar-footer { margin-top: auto; }

  // === List Panel ===
  .msg-list-panel { flex: 1; display: flex; flex-direction: column; min-width: 0; background: #fff; border-right: 1px solid #ebeef5; }
  .list-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f0f0f0; flex-shrink: 0; }
  .toolbar-left { display: flex; align-items: center; gap: 6px; }
  .toolbar-right { display: flex; gap: 8px; }

  .list-scroll { flex: 1; overflow-y: auto; }
  .msg-item {
    display: flex; align-items: flex-start; padding: 10px 14px; border-bottom: 1px solid #fafafa;
    cursor: pointer; transition: background 0.1s; position: relative;
    &:hover { background: #f9fafb; }
    &.active { background: #ecf5ff; box-shadow: inset 3px 0 0 #409EFF; }
    &.unread { background: #f5f8ff; }
    &.pinned { background: #fffdf5; }
    &.urgent { border-left: 3px solid #F56C6C; }
    &.selected { background: #e6f0ff; }
    .msg-check { margin-right: 10px; align-self: center; flex-shrink: 0; }
    .msg-item-icon {
      width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center;
      justify-content: center; flex-shrink: 0; margin-right: 10px;
    }
    .msg-item-body { flex: 1; min-width: 0; }
    .msg-item-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px; }
    .msg-item-title { font-size: 13px; font-weight: 500; color: #303133; display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pin-icon { font-size: 11px; }
    .unread-dot { width: 7px; height: 7px; border-radius: 50%; background: #409EFF; flex-shrink: 0; }
    .msg-item-time { font-size: 11px; color: #c0c4cc; flex-shrink: 0; margin-left: 8px; }
    .msg-item-preview { font-size: 12px; color: #909399; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 2px; }
    .msg-item-meta { display: flex; align-items: center; gap: 6px; }
  }
  .list-pagination { padding: 8px 12px; display: flex; justify-content: center; border-top: 1px solid #f0f0f0; flex-shrink: 0; }

  // === Detail Panel ===
  .msg-detail-panel { width: 380px; background: #fff; display: flex; flex-direction: column; flex-shrink: 0; padding: 20px; overflow-y: auto; }
  .detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; h3 { font-size: 16px; margin: 0; flex: 1; } }
  .detail-meta { display: flex; gap: 10px; align-items: center; font-size: 12px; color: #909399; margin-bottom: 16px; }
  .detail-content { font-size: 14px; line-height: 1.8; color: #303133; flex: 1; }
  .detail-actions { margin-top: 20px; display: flex; gap: 8px; }
  .detail-bar { display: flex; gap: 4px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #f0f0f0; }

  // === Animations ===
  .msg-list-enter-active { transition: all 0.3s ease; }
  .msg-list-leave-active { transition: all 0.2s ease; }
  .msg-list-enter-from { opacity: 0; transform: translateX(-20px); }
  .msg-list-leave-to { opacity: 0; transform: translateX(20px); }
}
.prefs-form { max-height: 60vh; overflow-y: auto; }
</style>
