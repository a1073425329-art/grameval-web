import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const request = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// Request interceptor
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
request.interceptors.response.use(
  (response) => {
    // blob（文件流）不走业务错误判断
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
        localStorage.removeItem('token')
        localStorage.removeItem('role')
        router.push('/login')
      }
      return Promise.reject(new Error(res.message || 'Request failed'))
    }
    return res
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      router.push('/login')
    }
    ElMessage.error(error.response?.data?.message || error.message || 'Network error')
    return Promise.reject(error)
  }
)

export default request
