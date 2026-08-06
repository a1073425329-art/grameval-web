/**
 * 通用 WebSocket 管理器
 *
 * 设计目标：
 * - 自动鉴权：连接时自动把 localStorage 中的 JWT 作为 query 拼到 URL（?token=xxx）
 * - 多通道复用：一个类实例代表一条连接，exam / notification 各自实例化即可
 * - 自动重连：断线后按指数退避重连（1s, 2s, 4s ... 上限 30s）
 * - 心跳保活：默认每 30s 发送一次 { type: 'ping' }，pong 超时则判定连接死亡并重连
 * - 事件总线：基于消息体的 type 字段分发，同时暴露 open/close/error/message 等生命周期事件
 * - 干净退出：disconnect() 会停止心跳、取消重连、关闭 socket，供组件 onBeforeUnmount 调用
 *
 * 后端协议见 README；本类只负责传输层，业务语义由各 composable 解释。
 */

/** 事件回调：payload 取决于事件类型 */
export type WsEventHandler = (payload: any) => void

export interface WSOptions {
  /** 连接路径，例如 /ws/exam/123 或 /ws/notifications */
  path: string
  /** JWT token；未传则从 localStorage.token 读取 */
  token?: string
  /** 是否启用自动重连，默认 true */
  autoReconnect?: boolean
  /** 最大重连次数，默认 Infinity */
  maxReconnects?: number
  /** 心跳间隔（ms），默认 30000 */
  heartbeatInterval?: number
  /** 发出 ping 后等待 pong 的超时（ms），超时则强制重连，默认 10000 */
  pongTimeout?: number
  /** 心跳消息体，默认 { type: 'ping' } */
  heartbeatMessage?: object
  /** WebSocket 子协议 */
  protocols?: string | string[]
}

/** 内部归一化后的配置 */
interface NormalizedOptions {
  path: string
  token: string
  autoReconnect: boolean
  maxReconnects: number
  heartbeatInterval: number
  pongTimeout: number
  heartbeatMessage: object
  protocols?: string | string[]
}

/** 生命周期 / 业务事件类型 */
export type WsEventType =
  | 'open'
  | 'close'
  | 'error'
  | 'message'
  | 'reconnect'
  | 'reconnecting'
  | string

/**
 * 从 Vite 环境变量或默认值推导 WebSocket 基地址。
 * 优先级：VITE_WS_BASE_URL > 生产环境按当前页面推导 > ws://localhost:9001
 */
export function getWsBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_WS_BASE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  // 生产环境按当前页面协议/host 推导 wss/ws
  if (import.meta.env.PROD && typeof window !== 'undefined' && window.location) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}`
  }
  return 'ws://localhost:9001'
}

export class WebSocketManager {
  private ws: WebSocket | null = null
  private readonly opts: NormalizedOptions
  private readonly handlers = new Map<string, Set<WsEventHandler>>()

  private reconnectAttempts = 0
  private reconnectTimer: number | null = null
  private heartbeatTimer: number | null = null
  private pongTimer: number | null = null
  private waitingPong = false
  private manualClose = false

  constructor(options: WSOptions) {
    const token = options.token ?? localStorage.getItem('token') ?? ''
    this.opts = {
      path: options.path,
      token,
      autoReconnect: options.autoReconnect ?? true,
      maxReconnects: options.maxReconnects ?? Infinity,
      heartbeatInterval: options.heartbeatInterval ?? 30_000,
      pongTimeout: options.pongTimeout ?? 10_000,
      heartbeatMessage: options.heartbeatMessage ?? { type: 'ping' },
      protocols: options.protocols,
    }
  }

  /** 当前连接路径（只读） */
  get path(): string {
    return this.opts.path
  }

  /** 底层 readyState；未创建时返回 CLOSED(3) */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED
  }

  /** 是否处于 OPEN 状态 */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  /** 是否处于 OPEN 状态（语义化别名） */
  get isOpen(): boolean {
    return this.isConnected
  }

  /**
   * 建立连接。若当前已连接或正在连接则直接返回。
   * 失败会触发 error 事件，并在启用自动重连时按指数退避重试。
   */
  connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return
    }
    this.manualClose = false

    const base = getWsBaseUrl()
    const rawPath = this.opts.path
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
    const token = this.opts.token || localStorage.getItem('token') || ''

    const query: string[] = []
    if (token) query.push(`token=${encodeURIComponent(token)}`)
    const qs = query.length ? `${path.includes('?') ? '&' : '?'}${query.join('&')}` : ''
    const url = `${base}${path}${qs}`

    try {
      this.ws = this.opts.protocols
        ? new WebSocket(url, this.opts.protocols)
        : new WebSocket(url)
    } catch (e) {
      this.emit('error', e)
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      this.startHeartbeat()
      this.emit('open', { url })
    }

    this.ws.onmessage = (ev: MessageEvent) => {
      let data: any = ev.data
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data)
        } catch {
          /* 非 JSON 文本，原样下发 */
        }
      }
      this.emit('message', data)
      if (data && typeof data === 'object' && typeof data.type === 'string') {
        if (data.type === 'pong') {
          this.handlePong()
        }
        this.emit(data.type, data)
      }
    }

    this.ws.onerror = (ev: Event) => {
      this.emit('error', ev)
    }

    this.ws.onclose = (ev: CloseEvent) => {
      this.stopHeartbeat()
      this.ws = null
      this.emit('close', ev)
      this.scheduleReconnect()
    }
  }

  /**
   * 主动断开。停止心跳、取消重连、关闭 socket。
   * 调用后不会再自动重连。
   */
  disconnect(code: number = 1000, reason?: string): void {
    this.manualClose = true
    this.stopHeartbeat()
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = 0
    if (this.ws) {
      try {
        this.ws.close(code, reason)
      } catch {
        /* ignore */
      }
      this.ws = null
    }
    this.emit('close', { code, reason, manual: true })
  }

  /**
   * 发送消息。非字符串会自动 JSON.stringify。
   * @returns 是否成功投递（仅当处于 OPEN 状态时为 true）
   */
  send(data: unknown): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    try {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data))
      return true
    } catch (e) {
      this.emit('error', e)
      return false
    }
  }

  /* ---------------- 事件总线 ---------------- */

  /** 注册事件回调，返回取消注册函数 */
  on(type: WsEventType, handler: WsEventHandler): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler)
    return () => this.off(type, handler)
  }

  /** 注册一次性事件回调 */
  once(type: WsEventType, handler: WsEventHandler): () => void {
    const wrap: WsEventHandler = (payload) => {
      this.off(type, wrap)
      handler(payload)
    }
    return this.on(type, wrap)
  }

  /** 取消注册；不传 handler 则清空该事件全部回调 */
  off(type: WsEventType, handler?: WsEventHandler): void {
    if (!handler) {
      this.handlers.delete(type)
      return
    }
    this.handlers.get(type)?.delete(handler)
  }

  /** 移除所有事件回调（一般仅用于销毁） */
  removeAllListeners(): void {
    this.handlers.clear()
  }

  private emit(type: string, payload?: any): void {
    const set = this.handlers.get(type)
    if (!set || set.size === 0) return
    set.forEach((h) => {
      try {
        h(payload)
      } catch (e) {
        // 不让单个回调异常打断其他回调
        console.error('[WebSocketManager] handler error:', e)
      }
    })
  }

  /* ---------------- 心跳 ---------------- */

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = window.setInterval(() => {
      // 发送 ping；若上一轮 pong 还没回来且已超时，则由 pongTimer 兜底重连
      this.send(this.opts.heartbeatMessage)
      this.waitingPong = true
      if (this.pongTimer !== null) clearTimeout(this.pongTimer)
      this.pongTimer = window.setTimeout(() => {
        if (this.waitingPong) {
          this.forceReconnect('pong timeout')
        }
      }, this.opts.pongTimeout)
    }, this.opts.heartbeatInterval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.pongTimer !== null) {
      clearTimeout(this.pongTimer)
      this.pongTimer = null
    }
    this.waitingPong = false
  }

  private handlePong(): void {
    this.waitingPong = false
    if (this.pongTimer !== null) {
      clearTimeout(this.pongTimer)
      this.pongTimer = null
    }
  }

  /* ---------------- 重连 ---------------- */

  /** 主动触发一次重连（关闭当前 socket，由 onclose 接力 scheduleReconnect） */
  private forceReconnect(reason: string): void {
    this.emit('reconnect', { reason })
    try {
      this.ws?.close()
    } catch {
      /* ignore */
    }
  }

  private scheduleReconnect(): void {
    if (!this.opts.autoReconnect || this.manualClose) return
    if (this.reconnectAttempts >= this.opts.maxReconnects) {
      this.emit('error', { message: 'max reconnects reached' })
      return
    }
    const attempt = this.reconnectAttempts++
    // 指数退避：1s, 2s, 4s, 8s, 16s, 30s, 30s ...
    const delay = Math.min(1000 * 2 ** attempt, 30_000)
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = window.setTimeout(() => {
      this.emit('reconnecting', { attempt: attempt + 1, delay })
      this.connect()
    }, delay)
  }
}

/* ============================================================ *
 *  多通道注册表
 *  exam / notification 等各自一条连接，按 name 复用单例。
 * ============================================================ */

const channels = new Map<string, WebSocketManager>()

/**
 * 获取（或创建）具名通道。
 * 若同名通道已存在但 path 变了，会先关闭旧通道再新建，避免连到错误地址。
 */
export function getChannel(name: string, options: WSOptions): WebSocketManager {
  const existing = channels.get(name)
  if (existing) {
    if (existing.path !== options.path) {
      existing.disconnect()
      const mgr = new WebSocketManager(options)
      channels.set(name, mgr)
      return mgr
    }
    return existing
  }
  const mgr = new WebSocketManager(options)
  channels.set(name, mgr)
  return mgr
}

/** 关闭并移除具名通道 */
export function closeChannel(name: string): void {
  const ch = channels.get(name)
  if (ch) {
    ch.disconnect()
    ch.removeAllListeners()
    channels.delete(name)
  }
}

/** 关闭全部通道（一般在全局登出时调用） */
export function closeAllChannels(): void {
  channels.forEach((ch) => {
    ch.disconnect()
    ch.removeAllListeners()
  })
  channels.clear()
}

export default WebSocketManager
