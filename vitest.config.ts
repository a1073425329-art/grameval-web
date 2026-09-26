import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

/**
 * 单元/组件测试配置。
 * happy-dom 提供轻量 DOM, 比 jsdom 快, mount element-plus 组件够用。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/unit/**/*.spec.ts', 'src/**/__tests__/*.spec.ts'],
    setupFiles: ['tests/unit/setup.ts'],
    // element-plus 有的 dialog 底层依赖 transition, happy-dom 不完整, 允许失败但捕获
    testTimeout: 15_000,
    // Unit tests do not need Node's persistent SQLite-backed localStorage.
    execArgv: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.d.ts', 'src/main.ts', 'src/vite-env.d.ts'],
    },
  },
})
