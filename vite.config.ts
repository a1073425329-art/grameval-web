import { resolve } from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import compression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
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
            return 'vendor'
          }
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