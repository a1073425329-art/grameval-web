/**
 * [2026-10-31 新增] SSE 流式接收工具
 *
 * 用 fetch + ReadableStream 读取后端 SSE 端点（POST），
 * 逐段调用 onChunk 实现渐进渲染，不用干等 AI 返回完整结果。
 */

interface StreamOptions {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (err: Error) => void
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
    const token = localStorage.getItem('token') || ''
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
    })
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`)
    }
    const reader = resp.body?.getReader()
    if (!reader) throw new Error('No response body')
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // 按 SSE 格式解析：event: xxx\ndata: yyy\n\n
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''  // 保留不完整的行
      let eventType = ''
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          const data = line.slice(5).trim()
          if (eventType === 'chunk') {
            onChunk(data)
          } else if (eventType === 'done') {
            onDone()
            return
          } else if (eventType === 'error') {
            onError(new Error(data))
            return
          }
        }
      }
    }
    onDone()
  } catch (e: any) {
    onError(e instanceof Error ? e : new Error(String(e)))
  }
}
