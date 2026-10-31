/**
 * [2026-10-31 新增] SSE 流式接收工具
 *
 * 用 fetch + ReadableStream 读取后端 SSE 端点（POST），
 * 逐段调用 onChunk 实现渐进渲染，不用干等 AI 返回完整结果。
 */

// [2026-10-31 修] token 必须走 authStorage（铁律：严禁直接碰 localStorage/sessionStorage）
//   原实现用 localStorage.getItem('token') 读了不存在的 key，导致 401
import { getToken } from '@/utils/authStorage'

interface StreamOptions {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (err: Error) => void
  /** [2026-11-01] 可选请求体（POST JSON），原有调用不传即无 body */
  body?: unknown
}

/**
 * 发起 SSE 流式 POST 请求
 * 后端约定事件格式：
 *   event: chunk / data: <文本片段>
 *   event: done  / data: [DONE]
 *   event: error / data: <错误信息>
 */
export async function streamPost(url: string, options: StreamOptions): Promise<void> {
  const { onChunk, onDone, onError } = options
  try {
    const token = getToken() || ''
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'text/event-stream',
    }
    const fetchInit: RequestInit = { method: 'POST', headers }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      fetchInit.body = JSON.stringify(options.body)
    }
    const resp = await fetch(url, fetchInit)
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`)
    }
    const reader = resp.body?.getReader()
    if (!reader) throw new Error('No response body')
    const decoder = new TextDecoder()
    let buffer = ''
    // [2026-10-31 修复] 原实现有三个缺陷：
    //   ① eventType 每次 read() 都重置 → 事件跨两次读取时类型丢失；
    //   ② 一条 data 单独成块，多行文本被 Spring 拆成多条 data: 行后没有按 SSE 规范用 \n 拼回
    //      → AI 输出的换行全部丢失（.ai-content 是 white-space: pre-wrap，换行丢了就成一大坨）；
    //   ③ data 用了 trim()，把 AI 输出的行首空格/空行吃掉。
    //   现按 SSE 规范解析：同一事件的多条 data 用 \n 连接，只在冒号后去掉一个前导空格。
    let eventType = ''
    let dataBuf = ''
    let hasData = false

    /** 派发一个完整事件；返回 false 表示流已结束（done/error） */
    const dispatch = (): boolean => {
      const type = eventType
      const payload = dataBuf
      eventType = ''
      dataBuf = ''
      hasData = false
      if (type === 'chunk') {
        onChunk(payload)
        return true
      }
      if (type === 'done') {
        onDone()
        return false
      }
      if (type === 'error') {
        onError(new Error(payload || 'AI 分析请求失败'))
        return false
      }
      return true
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl = buffer.indexOf('\n')
      while (nl >= 0) {
        let line = buffer.slice(0, nl)
        buffer = buffer.slice(nl + 1)
        if (line.endsWith('\r')) line = line.slice(0, -1)
        if (line === '') {
          // 空行 = 事件边界
          if (!dispatch()) return
        } else if (!line.startsWith(':')) {
          // 以 : 开头是注释/心跳，忽略
          const colon = line.indexOf(':')
          const field = colon < 0 ? line : line.slice(0, colon)
          let val = colon < 0 ? '' : line.slice(colon + 1)
          if (val.startsWith(' ')) val = val.slice(1)
          if (field === 'event') {
            eventType = val.trim()
          } else if (field === 'data') {
            dataBuf = hasData ? `${dataBuf}\n${val}` : val
            hasData = true
          }
        }
        nl = buffer.indexOf('\n')
      }
    }
    // 流结束时若有未派发的残留事件，一并处理
    if (hasData || eventType) {
      if (!dispatch()) return
    }
    onDone()
  } catch (e: any) {
    onError(e instanceof Error ? e : new Error(String(e)))
  }
}
