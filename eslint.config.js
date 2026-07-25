// ESLint 9+ flat config
// 静态代码检查, 与 scripts/lint-vue.mjs 互补:
//   - lint-vue.mjs 抓 Vue 2 遗留 (:visible.sync 等) 和模板里引用不存在的变量
//   - 本配置抓 TS / JS 通用问题: unused vars / no-undef / vue 3 官方规则 (v-model, key, etc.)
//
// 分层:
//   1. 基础 JS/TS 规则 (@typescript-eslint recommended)
//   2. Vue 3 推荐规则 (eslint-plugin-vue "vue3-recommended")
//   3. 项目自定义: 明确禁 .sync/.native, 禁 filter, 允许非空断言
import js from '@eslint/js'
import globals from 'globals'
import tseslintPlugin from '@typescript-eslint/eslint-plugin'
import tseslintParser from '@typescript-eslint/parser'
import vuePlugin from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'scripts/lint-vue.report.json',
      'coverage/**',
      '*.min.js',
    ],
  },

  // JS 基础
  js.configs.recommended,

  // TS / TSX
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2023,
      },
    },
    plugins: {
      '@typescript-eslint': tseslintPlugin,
    },
    rules: {
      ...tseslintPlugin.configs.recommended.rules,
      // 项目里大量地方用了 any 做兼容(前端 axios 返回结构不确定), 关闭
      '@typescript-eslint/no-explicit-any': 'off',
      // 项目大量使用非空断言 (!.), 例如 el-dialog 拿到的引用, 允许
      '@typescript-eslint/no-non-null-assertion': 'off',
      // 未使用变量: 与 tsconfig.app.json 的 noUnusedLocals=false 保持一致
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      // ts-ignore 允许 (老代码有些第三方类型问题)
      '@typescript-eslint/ban-ts-comment': 'off',
      // console.log 允许(前端调试很常见)
      'no-console': 'off',
      // 空对象类型允许
      '@typescript-eslint/no-empty-object-type': 'off',
      // 允许 require 风格 (少量 cjs 脚本)
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Vue
  ...vuePlugin.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslintParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslintPlugin,
    },
    rules: {
      // 与 TS 段共享的宽松规则
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',

      // -------- 关键: Vue 3 迁移相关强制规则 --------
      // .sync 修饰符在 Vue 3 已被移除 (对应刚才 dialog 打不开的 bug)
      'vue/no-deprecated-v-bind-sync': 'error',
      // .native 已被移除
      'vue/no-deprecated-v-on-native-modifier': 'error',
      // slot="xxx" 已被移除
      'vue/no-deprecated-slot-attribute': 'error',
      'vue/no-deprecated-slot-scope-attribute': 'error',
      // filter | 已被移除
      'vue/no-deprecated-filter': 'error',
      // v-is 已被移除
      'vue/no-deprecated-v-is': 'error',
      // events API $on/$off/$once 已被移除
      'vue/no-deprecated-events-api': 'error',
      // inline template 已被移除
      'vue/no-deprecated-inline-template': 'error',
      // scope 属性已改名
      'vue/no-deprecated-scope-attribute': 'error',
      // 组件应该有多单词名 (App.vue 之类除外)
      'vue/multi-word-component-names': 'off',

      // 模板里的一些琐碎风格 —— 降噪, 项目历史一堆缩进 1
      'vue/html-indent': 'off',
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/attributes-order': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/mustache-interpolation-spacing': 'off',
      'vue/attribute-hyphenation': 'off',
      'vue/v-on-event-hyphenation': 'off',
      'vue/require-default-prop': 'off',
      'vue/require-explicit-emits': 'off',
      // v-html 是 XSS 高危, 但项目里少量确实需要, 降级
      'vue/no-v-html': 'warn',
      // component name 大小写规则 —— element-plus 都是 kebab, 关闭
      'vue/component-name-in-template-casing': 'off',

      // 常规必要:
      'vue/no-mutating-props': 'warn',
      'vue/no-unused-components': 'warn',
      // Vue slot 里的 destructured 参数, 允许 _ 前缀跳过
      'vue/no-unused-vars': ['warn', { ignorePattern: '^_' }],
      'vue/valid-v-slot': 'warn',
    },
  },

  // 全局 rule 微调
  {
    rules: {
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-constant-binary-expression': 'warn',
      'no-prototype-builtins': 'warn',
      'no-async-promise-executor': 'warn',
      // 前端项目里 undef 通过 TS 类型来管, no-undef 会误报
      'no-undef': 'off',
    },
  },
]
