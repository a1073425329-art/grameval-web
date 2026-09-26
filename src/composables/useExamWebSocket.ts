/**
 * 考试 WebSocket composable
 *
 * 负责与后端 /ws/exam/{examId}?token=xxx 的全部业务交互：
 * - 连接建立后每 30s 发送 heartbeat（携带剩余秒数）
 * - 处理 time-sync（服务器时间 / 剩余秒数同步）
 * - 处理 heartbeat-ack（服务器时间回写）
 * - 处理 save-ack（答案保存确认）
 * - 处理 submit-result（交卷结果）
 * - 处理 force-submit（考试时间到，强制交卷）
 *
 * 提供响应式状态：connected / status / serverTime / remainingSeconds / lastResult / lastError
 * 暴露方法：connect(examId) / disconnect() / sendHeartbeat(remaining) /
 *           sendAnswer(questionId, answer, remaining) / submit(remaining)
 *
 * 说明：传输层保活 ping 由 WebSocketManager 内部每 30s 发送，与本 composable
 *      的业务 heartbeat 互不干扰——前者是连接探活，后者携带剩余时长上报。
 */
import { onBeforeUnmount, ref } from 'vue'
import { WebSocketManager } from '@/utils/websocket'

/** 交卷结果（对应后端 submit-result 消息） */
export interface ExamSubmitResult {
  examId: number
  totalScore: number
  scorePercentage: number
  correctCount: number
  wrongCount: number
}

/** 连接状态机 */
export type ExamWsStatus = 'closed' | 'connecting' | 'open'

type ForceSubmitHandler = (reason: string) => void
type SubmitResultHandler = (result: ExamSubmitResult) => void
type SaveAckHandler = (questionId: number) => void

/** 业务心跳间隔（ms），与后端约定 30s */
const HEARTBEAT_INTERVAL = 30_000
/** submit 后等待 submit-result 的超时（ms） */
const SUBMIT_TIMEOUT = 15_000

interface PendingSubmit {
  resolve: (r: ExamSubmitResult) => void
  reject: (e: Error) => void
  timer: number | null
}

export function useExamWebSocket() {
  /** 是否已连接（OPEN） */
  const connected = ref(false)
  /** 三态连接状态，便于 UI 展示「连接中」 */
  const status = ref<ExamWsStatus>('closed')
  /** 服务器时间（ISO 字符串），由 time-sync / heartbeat-ack 更新 */
  const serverTime = ref('')
  /** 剩余秒数：由组件 onTick 写入（客户端倒计时口径），time-sync 也会回写校准 */
  const remainingSeconds = ref(0)
  /** 最近一次交卷结果 */
  const lastResult = ref<ExamSubmitResult | null>(null)
  /** 最近一次错误信息（传输错误或后端 error 消息） */
  const lastError = ref('')

  let ws: WebSocketManager | null = null
  let heartbeatTimer: number | null = null
  /** 事件取消注册函数集合，disconnect 时统一清理 */
  const cleanups: Array<() => void> = []

  const forceSubmitHandlers = new Set<ForceSubmitHandler>()
  const submitResultHandlers = new Set<SubmitResultHandler>()
  const saveAckHandlers = new Set<SaveAckHandler>()

  /** 待 resolve 的 submit Promise；同一时刻只允许一个 */
  let pendingSubmit: PendingSubmit | null = null

  /* ---------------- 业务心跳 ---------------- */

  const startHeartbeat = () => {
    stopHeartbeat()
    heartbeatTimer = window.setInterval(() => {
      sendHeartbeat(remainingSeconds.value)
    }, HEARTBEAT_INTERVAL)
  }

  const stopHeartbeat = () => {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  /* ---------------- 连接 ---------------- */

  const connect = (examId: number | string) => {
    // 已存在则先彻底断开（含清理事件），避免重复绑定
    disconnect()

    const token = localStorage.getItem('token')
    if (!token) {
      lastError.value = '未登录，无法建立考试 WebSocket'
      status.value = 'closed'
      connected.value = false
      return
    }

    status.value = 'connecting'
    ws = new WebSocketManager({
      path: `/ws/exam/${examId}`,
      autoReconnect: true,
      heartbeatInterval: HEARTBEAT_INTERVAL,
    })

    cleanups.push(
      ws.on('open', () => {
        connected.value = true
        status.value = 'open'
        lastError.value = ''
        startHeartbeat()
      }),
    )

    cleanups.push(
      ws.on('close', () => {
        connected.value = false
        status.value = 'closed'
        stopHeartbeat()
      }),
    )

    cleanups.push(
      ws.on('error', (e: any) => {
        // 传输错误与后端 { type: 'error', message } 都走这里
        const msg =
          (e && typeof e === 'object' && (e.message || e.reason)) ||
          (typeof e === 'string' && e) ||
          'websocket error'
        lastError.value = String(msg)
      }),
    )

    // 服务器时间 / 剩余秒数同步
    cleanups.push(
      ws.on('time-sync', (data: any) => {
        if (data?.serverTime) serverTime.value = data.serverTime
        if (typeof data?.remainingSeconds === 'number') {
          remainingSeconds.value = data.remainingSeconds
        }
      }),
    )

    // 心跳确认：回写服务器时间
    cleanups.push(
      ws.on('heartbeat-ack', (data: any) => {
        if (data?.serverTime) serverTime.value = data.serverTime
      }),
    )

    // 答案保存确认
    cleanups.push(
      ws.on('save-ack', (data: any) => {
        if (typeof data?.questionId === 'number') {
          saveAckHandlers.forEach((h) => {
            try {
              h(data.questionId)
            } catch {
              /* ignore */
            }
          })
        }
      }),
    )

    // 交卷结果
    cleanups.push(
      ws.on('submit-result', (data: any) => {
        const result = data as ExamSubmitResult
        lastResult.value = result
        submitResultHandlers.forEach((h) => {
          try {
            h(result)
          } catch {
            /* ignore */
          }
        })
        if (pendingSubmit) {
          if (pendingSubmit.timer !== null) clearTimeout(pendingSubmit.timer)
          pendingSubmit.resolve(result)
          pendingSubmit = null
        }
      }),
    )

    // 强制交卷
    cleanups.push(
      ws.on('force-submit', (data: any) => {
        const reason = (data?.reason as string) || '考试时间已到'
        forceSubmitHandlers.forEach((h) => {
          try {
            h(reason)
          } catch {
            /* ignore */
          }
        })
      }),
    )

    ws.connect()
  }

  const disconnect = () => {
    stopHeartbeat()
    // 放弃尚未回包的 submit
    if (pendingSubmit) {
      if (pendingSubmit.timer !== null) clearTimeout(pendingSubmit.timer)
      pendingSubmit.reject(new Error('websocket closed before submit-result'))
      pendingSubmit = null
    }
    // 清理所有事件绑定
    cleanups.splice(0).forEach((fn) => fn())
    if (ws) {
      ws.disconnect()
      ws = null
    }
    connected.value = false
    status.value = 'closed'
  }

  /* ---------------- 主动发送 ---------------- */

  /** 发送业务心跳（携带剩余秒数） */
  const sendHeartbeat = (remaining: number) => {
    ws?.send({
      type: 'heartbeat',
      remainingSeconds: Math.max(0, Math.floor(remaining)),
    })
  }

  /**
   * 发送单题答案。
   * @returns 是否成功投递；保存确认通过 onSaveAck 回调或 save-ack 事件获取
   */
  const sendAnswer = (
    questionId: number,
    userAnswer: string,
    remaining: number,
  ): boolean => {
    if (!ws) return false
    return ws.send({
      type: 'save-answer',
      questionId,
      userAnswer,
      remainingSeconds: Math.max(0, Math.floor(remaining)),
    })
  }

  /**
   * 发起交卷。返回一个 Promise：
   * - 收到 submit-result 时 resolve(result)
   * - 收到 error / 超时 / 连接断开 时 reject
   * 仅在已连接时可用；未连接请走 HTTP 兜底。
   */
  const submit = (remaining: number = 0): Promise<ExamSubmitResult> => {
    return new Promise<ExamSubmitResult>((resolve, reject) => {
      if (!ws || !ws.isConnected) {
        reject(new Error('websocket not connected'))
        return
      }
      // 取代上一个未完成的 submit
      if (pendingSubmit) {
        if (pendingSubmit.timer !== null) clearTimeout(pendingSubmit.timer)
        pendingSubmit.reject(new Error('superseded by a new submit'))
        pendingSubmit = null
      }
      pendingSubmit = {
        resolve,
        reject,
        timer: window.setTimeout(() => {
          if (pendingSubmit) {
            pendingSubmit.reject(new Error('submit-result timeout'))
            pendingSubmit = null
          }
        }, SUBMIT_TIMEOUT),
      }
      ws.send({
        type: 'submit',
        remainingSeconds: Math.max(0, Math.floor(remaining)),
      })
    })
  }

  /* ---------------- 事件订阅 ---------------- */

  /** 注册强制交卷回调，返回取消函数 */
  const onForceSubmit = (cb: ForceSubmitHandler): (() => void) => {
    forceSubmitHandlers.add(cb)
    return () => forceSubmitHandlers.delete(cb)
  }

  /** 注册交卷结果回调，返回取消函数 */
  const onSubmitResult = (cb: SubmitResultHandler): (() => void) => {
    submitResultHandlers.add(cb)
    return () => submitResultHandlers.delete(cb)
  }

  /** 注册答案保存确认回调，返回取消函数 */
  const onSaveAck = (cb: SaveAckHandler): (() => void) => {
    saveAckHandlers.add(cb)
    return () => saveAckHandlers.delete(cb)
  }

  // 组件卸载时自动断开（幂等）
  onBeforeUnmount(() => disconnect())

  return {
    // 响应式状态
    connected,
    status,
    serverTime,
    remainingSeconds,
    lastResult,
    lastError,
    // 连接管理
    connect,
    disconnect,
    // 主动发送
    sendHeartbeat,
    sendAnswer,
    submit,
    // 事件订阅
    onForceSubmit,
    onSubmitResult,
    onSaveAck,
  }
}

export type UseExamWebSocketReturn = ReturnType<typeof useExamWebSocket>
