#!/usr/bin/env node
/**
 * GramEval 前端唯一门禁入口 —— 一条命令跑完 6 层检查
 *
 * 【为什么只留 dev / build 两个 script】
 *   过去 package.json 挂了 20 个命令（typecheck / lint / test:unit / test:e2e / verify…），
 *   人和 AI 都容易只挑一个跑、误以为完事，反而漏检。这里把编排全部收进本文件，
 *   对外只暴露 `npm run build`，语义唯一：**build = 全部检查通过才算能构建**。
 *
 * 【用法】
 *   npm run build                        # 跑全部 6 层（任一层失败立即中断）
 *   npm run build -- types               # 只跑某一层，调试用
 *   npm run build -- types lint          # 跑指定几层
 *   npm run build -- --with-e2e          # 额外跑 E2E（需后端 9001 已启动）
 *
 * 【6 层（由快到慢，前面挂了不浪费时间）】
 *   1 env     环境 —— 依赖完整性 / Node & npm 版本
 *   2 syntax  语法 —— node --check 递归扫 scripts 下的 .mjs（防脚本自身语法错）
 *   3 types   类型 —— vue-tsc -b（app / node / tests 三个工程，strict 最严）
 *   4 lint    规范 —— 自研 lint-vue 静态扫描 + eslint（0 warning 容忍）
 *   5 unit    单测 —— vitest run（组件冒烟 + 纯函数单测）
 *   6 build   构建 —— vite build + 产物体积基线对比
 *
 * 【设计约束】
 *   零外部依赖，只用 node 内置模块；直接调用各工具的 JS 入口（node_modules/xxx/bin/…），
 *   不经 shell / npm / .cmd，规避 Windows 下的引号与 PATH 问题。
 *
 * 【E2E 说明】
 *   Playwright 需要后端 9001 在跑，属于"联调"而非"代码门禁"，默认不跑，
 *   避免本地没起后端就把 build 卡死。确认要跑时加 --with-e2e。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const NODE = process.execPath
const bin = (p) => path.join(ROOT, 'node_modules', p)
const script = (p) => path.join(ROOT, 'scripts', p)

/**
 * 产物体积基线（KB，取 2026-09-26 实测值，上浮留余量）。
 * 判定线 = 基线 × 1.15，防止依赖或代码无节制膨胀。
 * 实测：index 37 / vendor 357 / elementPlus 1812 / echarts 1443 / other 1127
 */
const BUNDLE_BASELINE = {
  index: 150,
  vendor: 450,
  elementPlus: 1900,
  echarts: 1500,
}

/** 递归收集 .mjs（用于语法层） */
function collectMjs(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) collectMjs(full, out)
    else if (name.endsWith('.mjs')) out.push(full)
  }
  return out
}

const LAYERS = [
  {
    key: 'env',
    title: '环境层 —— 依赖完整性 / Node & npm 版本',
    steps: [
      { label: '依赖与环境校验', args: [script('check-env.cjs')] },
    ],
  },
  {
    key: 'syntax',
    title: '语法层 —— node --check（scripts/**/*.mjs）',
    steps: [
      {
        label: '脚本语法校验',
        custom: () => {
          const files = collectMjs(path.join(ROOT, 'scripts'))
          if (!files.length) {
            console.log('  （scripts/ 下没有 .mjs，跳过）')
            return 0
          }
          for (const f of files) {
            const r = spawnSync(NODE, ['--check', f], { cwd: ROOT, encoding: 'utf8' })
            if (r.status !== 0) {
              console.error(`\n  ❌ 语法错误：${path.relative(ROOT, f)}`)
              console.error(r.stderr ?? '')
              return 1
            }
          }
          console.log(`  ✔ ${files.length} 个 .mjs 语法均正确`)
          return 0
        },
      },
    ],
  },
  {
    key: 'types',
    title: '类型层 —— vue-tsc -b（app / node / tests 三工程，strict 最严）',
    steps: [
      { label: 'vue-tsc -b', args: [bin('vue-tsc/bin/vue-tsc.js'), '-b'] },
    ],
  },
  {
    key: 'lint',
    title: '规范层 —— lint-vue 静态扫描 + eslint（0 warning 容忍）',
    steps: [
      { label: 'lint-vue 自研扫描', args: [script('lint-vue.mjs')] },
      {
        label: 'eslint --max-warnings 0',
        args: [bin('eslint/bin/eslint.js'), 'src', '--ext', '.ts,.vue', '--max-warnings', '0'],
      },
    ],
  },
  {
    key: 'unit',
    title: '单测层 —— vitest run',
    steps: [
      { label: 'vitest run', args: [bin('vitest/vitest.mjs'), 'run'] },
    ],
  },
  {
    key: 'build',
    title: '构建层 —— vite build + 产物体积门禁',
    steps: [
      { label: 'vite build', args: [bin('vite/bin/vite.js'), 'build'] },
      { label: '产物体积对比基线', custom: () => checkBundleSize() },
    ],
  },
]

/* ------------------------------------------------------------------ *
 * 产物体积门禁
 * ------------------------------------------------------------------ */
function checkBundleSize() {
  const assetsDir = path.join(ROOT, 'dist', 'assets')
  if (!existsSync(assetsDir)) {
    console.error('  ❌ 未找到 dist/assets，构建产物缺失')
    return 1
  }
  // 把所有产物按体积归到几类
  const buckets = { index: 0, vendor: 0, elementPlus: 0, echarts: 0, other: 0 }
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) { walk(full); continue }
      const kb = statSync(full).size / 1024
      if (/elementPlus/i.test(name)) buckets.elementPlus += kb
      else if (/echarts/i.test(name)) buckets.echarts += kb
      else if (/vendor/i.test(name)) buckets.vendor += kb
      else if (/index|main|app/i.test(name)) buckets.index += kb
      else buckets.other += kb
    }
  }
  walk(assetsDir)

  let failed = 0
  const pad = (s) => String(s).padEnd(14)
  console.log(`  ${pad('产物分组')}${pad('实际(KB)')}${pad('基线(KB)')}判定`)
  for (const [k, base] of Object.entries(BUNDLE_BASELINE)) {
    const actual = buckets[k]
    const ok = actual <= base * 1.15
    if (!ok) failed++
    console.log(`  ${pad(k)}${pad(actual.toFixed(0))}${pad(base)}${ok ? '✅' : '❌ 超基线 15%'}`)
  }
  if (buckets.other > 0) {
    console.log(`  ${pad('other')}${pad(buckets.other.toFixed(0))}${pad('-')}（不设基线）`)
  }
  if (failed) {
    console.error(`\n  ❌ ${failed} 个产物分组超出体积基线 +15%`)
    console.error('     排查：是否有依赖被误引入 main.ts / 是否有大 JSON 被内联进产物')
    return 1
  }
  return 0
}

/* ------------------------------------------------------------------ *
 * 编排
 * ------------------------------------------------------------------ */
const argv = process.argv.slice(2)
const wantE2E = argv.includes('--with-e2e')
const requested = argv.filter((a) => !a.startsWith('--'))
const selected = requested.length
  ? LAYERS.filter((l) => requested.includes(l.key))
  : LAYERS

if (requested.length && selected.length !== requested.length) {
  const known = LAYERS.map((l) => l.key)
  const bad = requested.filter((r) => !known.includes(r))
  console.error(`\n未知的层：${bad.join(', ')}。可选：${known.join(' / ')}`)
  process.exit(2)
}

const bar = '='.repeat(76)
console.log(`\n${bar}`)
console.log(' GramEval 前端门禁' + (requested.length ? `（仅 ${requested.join(' → ')}）` : `（${LAYERS.length} 层全跑）`))
console.log(` 项目：${ROOT}`)
console.log(` 用法：npm run build${requested.length ? '' : ` ｜ 单层调试：npm run build -- <${LAYERS.map((l) => l.key).join('|')}>`}`)
if (!wantE2E) console.log(' 提示：E2E 需后端 9001 已启动，加 --with-e2e 才跑')
console.log(bar)

const started = Date.now()
const passed = []

for (let i = 0; i < selected.length; i++) {
  const layer = selected[i]
  const idx = requested.length ? '' : `[${i + 1}/${selected.length}] `

  console.log(`\n${'-'.repeat(76)}`)
  console.log(` ${idx}${layer.title}`)
  console.log('-'.repeat(76))

  for (const step of layer.steps) {
    let status
    if (step.custom) {
      status = step.custom()
    } else {
      const r = spawnSync(NODE, step.args, { cwd: ROOT, stdio: 'inherit' })
      if (r.error) {
        console.error(`\n❌ 第 ${layer.key} 层无法执行（${step.label}）：${r.error.message}\n`)
        process.exit(1)
      }
      status = r.status ?? 1
    }
    if (status !== 0) {
      console.error(`\n${'!'.repeat(76)}`)
      console.error(` ❌ 门禁失败：${layer.key} 层 —— ${step.label}（退出码 ${status}）`)
      console.error(` 单独调试本层：npm run build -- ${layer.key}`)
      console.error(' 不要用 @ts-ignore / eslint-disable / any 掩盖问题，要修根因。')
      console.error('!'.repeat(76) + '\n')
      process.exit(status)
    }
  }

  passed.push(layer.key)
  console.log(` ✅ ${layer.key} 层通过`)
}

/* E2E 放最后：需要外部依赖（后端 9001），失败不掩盖前面结论 */
if (wantE2E) {
  console.log(`\n${'-'.repeat(76)}`)
  console.log(' e2e 层 —— playwright（需后端 9001 已启动）')
  console.log('-'.repeat(76))
  const r = spawnSync(NODE, [bin('@playwright/test/cli.js'), 'test'], { cwd: ROOT, stdio: 'inherit' })
  if (r.status !== 0) {
    console.error(`\n❌ E2E 失败（退出码 ${r.status}）—— 确认后端 9001 已启动\n`)
    process.exit(r.status ?? 1)
  }
  passed.push('e2e')
  console.log(' ✅ e2e 层通过')
}

const secs = ((Date.now() - started) / 1000).toFixed(1)
console.log(`\n${bar}`)
console.log(` ✅ 全部通过：${passed.join(' → ')}    用时 ${secs}s`)
console.log(bar + '\n')
