/**
 * 通知 WebSocket composable
 *
 * 负责与后端 /ws/notifications?token=xxx（该端点后端将补充）的交互：
 * - 监听实时消息推送，新消息到达时弹出 ElNotification
 * - 响应式维护未读数 unreadCount
 * - 断线自动重连（由 WebSocketManager 负责）
 *
 * 状态采用模块级单例：多处调用 useNotificationWebSocket() 共享同一连接与
 * 同一份未读数，便于在 App.vue 连接、在 Header.vue 消费。
 */
import { ref } from 'vue'
import { ElNotification } from 'element-plus'
import { WebSocketManager } from '@/utils/websocket'
import { getToken } from '@/utils/authStorage'
import type { MessageNotification } from '@/types/notification'

/* ---------------- 模块级单例状态 ---------------- */

const connected = ref(false)
const unreadCount = ref(0)
const lastMessage = ref<MessageNotification | null>(null)
const lastError = ref('')

let ws: WebSocketManager | null = null
const cleanups: Array<() => void> = []
const messageHandlers = new Set<(m: MessageNotification) => void>()

/** 后端可能使用的推送 type 集合，命中任一即按消息处理 */
const MESSAGE_TYPES = ['notification', 'new-message', 'message', 'notify'] as const

/* ---------------- 工具方法 ---------------- */

/**
 * 从任意结构的推送体里提取消息对象。
 * 兼容 { type, payload } / { type, data } / { type, message } / 裸消息等形态。
 */
function extractNotification(raw: any): MessageNotification | null {
  if (!raw || typeof raw !== 'object') return null
  const candidates = [raw.payload, raw.data, raw.message, raw.notification]
  for (const c of candidates) {
    if (c && typeof c === 'object' && (c.title !== undefined || c.id !== undefined)) {
      return c as MessageNotification
    }
  }
  // 本身就是消息体
  if (raw.title !== undefined || raw.id !== undefined) {
    return raw as MessageNotification
  }
  return null
}

/** 按优先级 / 分类决定 ElNotification 的 type */
function resolveNotificationType(msg: MessageNotification): 'success' | 'warning' | 'error' | 'info' {
  if (msg.priority === 2) return 'error'
  if (msg.category === 'ALERT') return 'warning'
  if (msg.category === 'ACHIEVEMENT') return 'success'
  return 'info'
}

/* ---------------- 弹出队列（修复批量推送时的通知堆叠错位） ---------------- */
/**
 * 后端在一次批量生成中会连续推送多条通知（例如登录后同时下发
 * "考试已自动提交 / 解析已开放 / 错题待复习"）。这些消息在同一帧内到达，
 * 若同步调用 ElNotification，Element Plus 计算 verticalOffset 时元素尚未完成
 * 布局，offsetHeight 读不到高度，导致每条通知只叠加默认 offset(16px)，
 * 多条通知重叠在一起（表现为"提示错位 / 挤成一团"）。
 *
 * 解决：把弹窗改成串行队列，每条之间留出一帧以上的间隔，保证前一条已布局、
 * 后一条能正确累加高度；同时对短时间内的同内容消息去重，避免重复轰炸。
 */
const POP_INTERVAL = 240 // 相邻两条弹窗的间隔（ms），留足布局与入场动画时间
const DEDUPE_WINDOW = 8000 // 同内容去重窗口（ms）
const MAX_PER_BURST = 5 // 单批最多弹出条数，超出部分只计入未读数

const popQueue: MessageNotification[] = []
const recentKeys = new Map<string, number>()
let draining = false

function notificationKey(msg: MessageNotification): string {
  return `${msg.title ?? ''}|${msg.summary ?? msg.content ?? ''}`
}

/** 弹出单条通知 */
function showNotification(msg: MessageNotification) {
  ElNotification({
    title: msg.title || msg.typeLabel || '新消息',
    message: msg.summary || (msg.content ? msg.content.substring(0, 80) : ''),
    type: resolveNotificationType(msg),
    duration: 5000,
    position: 'top-right',
  })
}

/** 串行出队：保证每条通知弹出时前一条已完成布局 */
function drainQueue() {
  if (draining) return
  draining = true
  const step = () => {
    const next = popQueue.shift()
    if (!next) {
      draining = false
      return
    }
    showNotification(next)
    window.setTimeout(step, POP_INTERVAL)
  }
  step()
}

/** 入队（含去重与限流） */
function enqueueNotification(msg: MessageNotification) {
  const now = Date.now()
  const key = notificationKey(msg)

  // 清理过期去重记录
  for (const [k, t] of recentKeys) {
    if (now - t > DEDUPE_WINDOW) recentKeys.delete(k)
  }
  // 同内容在窗口期内只弹一次
  if (recentKeys.has(key)) return
  recentKeys.set(key, now)

  // 已达单批上限则不再弹窗（未读数仍已在 handleIncoming 中累加）
  if (popQueue.length >= MAX_PER_BURST) return

  popQueue.push(msg)
  drainQueue()
}

/** 处理一条入站消息 */
function handleIncoming(raw: any) {
  const msg = extractNotification(raw)
  if (!msg) return
  lastMessage.value = msg
  unreadCount.value += 1
  messageHandlers.forEach((h) => {
    try {
      h(msg)
    } catch {
      /* ignore */
    }
  })
  enqueueNotification(msg)
}

/* ---------------- composable ---------------- */

export function useNotificationWebSocket() {
  const connect = () => {
    const token = getToken()
    if (!token) return
    // 已连接或正在连接则不重复建链。
    // 注意：只看 isConnected(OPEN) 会漏掉 CONNECTING 状态——App.vue 里
    // isLoggedIn / token / onMounted 三个入口可能连续触发，导致反复
    // "断开旧连接 + 新建连接"，出现多条并存连接与后端会话抖动。
    if (ws && (ws.isConnected || ws.readyState === WebSocket.CONNECTING)) return

    // 清理可能存在的旧实例（保留 unreadCount / lastMessage 业务态）
    if (ws) {
      ws.disconnect()
      cleanups.splice(0).forEach((fn) => fn())
      ws = null
    }
    connected.value = false

    ws = new WebSocketManager({
      path: '/ws/notifications',
      autoReconnect: true,
      heartbeatInterval: 30_000,
    })

    cleanups.push(
      ws.on('open', () => {
        connected.value = true
        lastError.value = ''
      }),
    )

    cleanups.push(
      ws.on('close', () => {
        connected.value = false
      }),
    )

    cleanups.push(
      ws.on('error', (e: any) => {
        const msg =
          (e && typeof e === 'object' && (e.message || e.reason)) ||
          (typeof e === 'string' && e) ||
          'websocket error'
        lastError.value = String(msg)
      }),
    )

    // 兼容多种推送 type
    MESSAGE_TYPES.forEach((t) => {
      cleanups.push(
        ws!.on(t, (data: any) => handleIncoming(data)),
      )
    })

    // 未读数同步（后端可能下发 { type: 'unread-count', total } ）
    cleanups.push(
      ws.on('unread-count', (data: any) => {
        if (data && typeof data.total === 'number') unreadCount.value = data.total
        else if (data && typeof data.count === 'number') unreadCount.value = data.count
      }),
    )

    ws.connect()
  }

  const disconnect = () => {
    cleanups.splice(0).forEach((fn) => fn())
    if (ws) {
      ws.disconnect()
      ws = null
    }
    connected.value = false
  }

  /** 订阅新消息，返回取消函数 */
  const onMessage = (cb: (m: MessageNotification) => void): (() => void) => {
    messageHandlers.add(cb)
    return () => messageHandlers.delete(cb)
  }

  /** 本地标记全部已读 */
  const markAllRead = () => {
    unreadCount.value = 0
  }

  /** 未读数减 n（点击单条后调用） */
  const decrementUnread = (n: number = 1) => {
    unreadCount.value = Math.max(0, unreadCount.value - n)
  }

  /** 用 HTTP 拉取的真实值校准未读数 */
  const setUnreadCount = (n: number) => {
    unreadCount.value = Math.max(0, Math.floor(n))
  }

  return {
    // 响应式状态
    connected,
    unreadCount,
    lastMessage,
    lastError,
    // 连接管理
    connect,
    disconnect,
    // 订阅 / 状态维护
    onMessage,
    markAllRead,
    decrementUnread,
    setUnreadCount,
  }
}

export type UseNotificationWebSocketReturn = ReturnType<typeof useNotificationWebSocket>
