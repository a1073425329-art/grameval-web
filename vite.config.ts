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
    watch: {
      // 忽略编辑器/写入工具的原子写临时目录（形如 .foo.ts.12345.<uuid>.tmpdir/foo.ts.tmp），
      // 避免 chokidar 对被锁定的 .tmp 发起 fs.watch 抛 EBUSY 把 dev server 打挂
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/*.tmpdir/**',           // DSH/edit 工具的原子写临时目录
        '**/*.tmp',                 // 任何 .tmp 文件
      ],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // [2026-10-16 修复] 判断顺序：**先具体包，后 vue 通配**。
            // 原实现把 `id.includes('vue')` 放在最前，而 pnpm 的路径会带 peer 依赖后缀，
            // 例如 element-plus 的实际路径是
            //   .pnpm/element-plus@2.14.3_vue@3.5.40_typescript@6.0.3_/node_modules/element-plus/…
            // 其中的 `_vue@3.5.40_` 让 element-plus 命中了 'vue' 分支 → 整包被吞进 vendor，
            // 导致 elementPlus 分组恒为 0、vendor 膨胀到 2082 KB（基线 450）。
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
            if (id.includes('vue') || id.includes('vue-router') || id.includes('pinia')) {
              return 'vendor'
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
    // [2026-10-16 性能记录] echarts 不在 index.html 的预加载列表里了。
    // 但**必须如实说明**：这并没有真正省掉首屏的 echarts 流量 ——
    // 实测入口 chunk（index-*.js）第一行就静态 `import {...} from "./echarts-*.js"`，
    // 这是 Vite 对「多个懒加载页面共享的模块」做的依赖提升（避免每个图表页各自瀑布请求），
    // 属于预期行为。做过对照实验：去掉 echarts 的 manualChunks 后，它会并进 vendor（817 KB），
    // 入口照样加载，总量反而更大 —— 所以保留手动分组。
    // 这行配置的价值在于：不再产生多余的 preload 提示；将来若 echarts 不再被入口引用，它会立即生效。
    modulePreload: {
      resolveDependencies: (_filename, deps) => deps.filter((d) => !d.includes('echarts')),
    },
  },
})
