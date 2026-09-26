import { resolve } from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import compression from 'vite-plugin-compression'
import Icons from 'unplugin-icons/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // 图标:按需自动引入,支持 <i-mdi-home /> / <i-ep-search /> 等写法
    // 组件内直接以 kebab-case 使用,Vite 会按需按图标级别 tree-shake
    Icons({
      compiler: 'vue3',
      autoInstall: false,
      // 兼容 Element Plus 的 <el-icon><Search /></el-icon> 图标风格
      defaultClass: 'icon',
    }),
    // Gzip 压缩
    (compression as any)({
      algorithm: 'gzip',
      threshold: 1024,
      minRatio: 0.8,
      verbose: true,
    }),
    // Brotli 压缩
    (compression as any)({
      algorithm: 'brotliCompress',
      threshold: 1024,
      minRatio: 0.8,
      verbose: true,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 9000,
    proxy: {
      '/api': {
        target: 'http://localhost:9001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('vue-router') || id.includes('pinia')) {
              return 'vendor'
            }
            if (id.includes('element-plus')) {
              return 'elementPlus'
            }
            if (id.includes('echarts')) {
              return 'echarts'
            }
            if (id.includes('axios')) {
              return 'axios'
            }
            if (id.includes('dayjs')) {
              return 'dayjs'
            }
            // 图标相关单独一块,避免和 vendor 混在一起
            if (
              id.includes('@iconify') ||
              id.includes('unplugin-icons') ||
              id.includes('@fuxishi/svg-icon') ||
              id.includes('@yh-ui/icons')
            ) {
              return 'icons'
            }
            return 'vendor'
          }
          // 非 node_modules 的模块不参与手动分包 (返回 undefined = 交给 rollup 默认行为)
          return undefined
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    cssCodeSplit: true,
    target: 'esnext',
    minify: 'terser',
    sourcemap: false,
    emptyOutDir: true,
  },
})
