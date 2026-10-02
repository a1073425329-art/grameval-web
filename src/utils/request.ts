import axios, { type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { getToken, clearAuth } from '@/utils/authStorage'

/**
 * 401 统一收口：清登录态 → 跳登录页。
 * [2026-09-27 修复] 原来只清 localStorage 的 token/role，
 * 而登录态实际写在 sessionStorage（决策 D12），导致"清了个寂寞"、
 * 路由守卫仍认为已登录 → 登录页与首页无限横跳。
 * 现改为走 authStorage.clearAuth()（sessionStorage 三把 key 一次清干净），
 * 并动态 import auth store 同步其内存态（避免 request ↔ auth 静态循环依赖）。
 */
async function forceLogout(message?: string) {
  clearAuth()
  try {
    const { useAuthStore } = await import('@/stores/auth')
    useAuthStore().logout()
  } catch { /* store 不可用时至少存储已清 */ }
  if (message) ElMessage.error(message)
  await router.push('/login').catch(() => { /* 同路由重复跳转 */ })
}

/** 请求体最大字节数(3 MB),超过就本地拦截,不占带宽 */
const MAX_REQUEST_BYTES = 3 * 1024 * 1024

/** GET query string 最大长度(URL 太长后端 tomcat 会报 400) */
const MAX_QUERY_LEN = 8000

/**
 * 全局 GET 查询字符串参数上限(单字段值)。
 * 前端应通过 formLimits.ts + el-input 的 maxlength 提前把关,
 * 但如果绕过表单直接构造调用,这里再兜一层。
 */
const MAX_STRING_PARAM_LEN = 2000

const request = axios.create({
  baseURL: '/api',
  timeout: 20000,
})

/**
 * 计算大致的请求体字节数。
 * 只是估算,不追求精确 —— 只要能拦住 "上传了一个 10MB base64 图" 就够了。
 */
function estimateBytes(data: unknown): number {
  if (data == null) return 0
  if (typeof data === 'string') return data.length * 2 // UTF-16
  if (data instanceof FormData || data instanceof Blob) {
    return data instanceof Blob ? data.size : 0 // FormData 内 Blob 由浏览器估算
  }
  try {
    return JSON.stringify(data).length * 2
  } catch {
    return 0
  }
}

/** 检查 GET 参数,截断超长字符串并给出提示(避免直接 400) */
function sanitizeParams(params: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!params) return params
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string' && v.length > MAX_STRING_PARAM_LEN) {
      ElMessage.warning(`参数 ${k} 过长,已截断到 ${MAX_STRING_PARAM_LEN} 字符`)
      out[k] = v.slice(0, MAX_STRING_PARAM_LEN)
    } else {
      out[k] = v
    }
  }
  return out
}

// Request interceptor
request.interceptors.request.use(
  (config) => {
    // [2026-09-27 修复] 登录态读 sessionStorage（authStorage 统一出口），原为 localStorage 读不到
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // 前置校验:请求体大小
    const bytes = estimateBytes(config.data)
    if (bytes > MAX_REQUEST_BYTES) {
      ElMessage.error(`请求内容过大 (${(bytes / 1024 / 1024).toFixed(1)}MB),请精简后重试`)
      return Promise.reject(new Error('request body too large'))
    }

    // GET 参数清理
    if (config.params && typeof config.params === 'object') {
      config.params = sanitizeParams(config.params as Record<string, unknown>)
    }

    // URL 长度兜底
    if (config.url && config.url.length > MAX_QUERY_LEN) {
      ElMessage.error('请求 URL 过长')
      return Promise.reject(new Error('url too long'))
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
request.interceptors.response.use(
  (response) => {
    // blob(文件流)不走业务错误判断
    if (
      response.request?.responseType === 'blob' ||
      response.config?.responseType === 'blob'
    ) {
      return response
    }
    const res = response.data
    if (res && res.code !== undefined && res.code !== 200) {
      ElMessage.error(res.message || 'Request failed')
      if (res.code === 401) {
        void forceLogout()
      }
      return Promise.reject(new Error(res.message || 'Request failed'))
    }
    return res
  },
  (error) => {
    const status = error.response?.status
    const backendMsg = error.response?.data?.message

    if (status === 401) {
      void forceLogout(backendMsg || '登录已过期,请重新登录')
    } else if (status === 403) {
      ElMessage.error(backendMsg || '没有权限访问此资源')
    } else if (status === 404) {
      ElMessage.error(backendMsg || '资源不存在')
    } else if (status === 413) {
      ElMessage.error('请求内容过大,已被服务器拒绝')
    } else if (status === 422 || status === 400) {
      ElMessage.error(backendMsg || '请求参数校验失败')
    } else if (status && status >= 500) {
      ElMessage.error(backendMsg || '服务器内部错误')
    } else if (error.code === 'ECONNABORTED') {
      ElMessage.error('请求超时,请检查网络')
    } else {
      ElMessage.error(backendMsg || error.message || 'Network error')
    }
    return Promise.reject(error)
  }
)

/**
 * 兼容:允许调用方传自定义 AxiosRequestConfig。
 * 项目里现有代码 request({ url, method, params }) 的形式继续可用。
 */
export type Config = AxiosRequestConfig

export default request
