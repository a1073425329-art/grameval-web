// 全局类型：调整 axios，让拦截器返回的 Promise 直接是后端 ApiResponse<T>
// 而不是默认的 AxiosResponse<T>。这样 request.get<ApiResponse<X>>() 就直接拿到
// ApiResponse<X>，业务层无需 `.data.data` 或 as unknown as 断言。

import 'axios'

declare module 'axios' {
  export interface AxiosInstance {
    request<T = unknown>(config: import('axios').AxiosRequestConfig): Promise<T>
    get<T = unknown>(url: string, config?: import('axios').AxiosRequestConfig): Promise<T>
    delete<T = unknown>(url: string, config?: import('axios').AxiosRequestConfig): Promise<T>
    head<T = unknown>(url: string, config?: import('axios').AxiosRequestConfig): Promise<T>
    options<T = unknown>(url: string, config?: import('axios').AxiosRequestConfig): Promise<T>
    post<T = unknown>(url: string, data?: unknown, config?: import('axios').AxiosRequestConfig): Promise<T>
    put<T = unknown>(url: string, data?: unknown, config?: import('axios').AxiosRequestConfig): Promise<T>
    patch<T = unknown>(url: string, data?: unknown, config?: import('axios').AxiosRequestConfig): Promise<T>
  }
}
