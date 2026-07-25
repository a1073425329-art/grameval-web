#!/usr/bin/env node
/**
 * 一次性把前端全部检查跑一遍, 严格模式: 任何一步失败退出非 0.
 *
 * 顺序:
 *   1. lint:vue      —— 静态扫描 (捕获 .sync/.native/未定义变量/dialog 未 v-model 等)
 *   2. typecheck     —— vue-tsc --noEmit
 *   3. unit          —— vitest (组件冒烟, 校验按钮真的能触发状态变化)
 *   4. build         —— vite build (确保生产构建不出错)
 *   5. e2e (可选)    —— playwright, 需要后端 9001 已启动. 传 --skip-e2e 跳过
 *
 * 用法:
 *   node scripts/verify.mjs             # 全套
 *   node scripts/verify.mjs --skip-e2e  # 只跑 lint/tsc/unit/build (无需后端)
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const args = new Set(process.argv.slice(2))
const skipE2E = args.has('--skip-e2e')
const skipBuild = args.has('--skip-build')

const RESET = '\x1b[0m', BOLD = '\x1b[1m', RED = '\x1b[31m', GREEN = '\x1b[32m', CYAN = '\x1b[36m', YELLOW = '\x1b[33m'

function run(name, cmd, cmdArgs) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    console.log(`\n${CYAN}${BOLD}▶ ${name}${RESET}  ${cmd} ${cmdArgs.join(' ')}`)
    // Node 26+ DEP0190: passing args array with shell:true is deprecated.
    // On Windows we need shell:true to resolve npx/node, so pass the full
    // command as the first argument and an empty args array.
    const fullCmd = [cmd, ...cmdArgs].join(' ')
    const p = spawn(fullCmd, [], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, FORCE_COLOR: '1' },
    })
    p.on('close', (code) => {
      const dur = ((Date.now() - t0) / 1000).toFixed(1)
      if (code === 0) {
        console.log(`${GREEN}✔ ${name} 通过${RESET} (${dur}s)`)
        resolve()
      } else {
        console.log(`${RED}✘ ${name} 失败 exit=${code}${RESET} (${dur}s)`)
        reject(new Error(`${name} failed with code ${code}`))
      }
    })
    p.on('error', reject)
  })
}

async function main() {
  const t0 = Date.now()
  try {
    await run('1) 静态扫描 Vue 模板', 'node', ['scripts/lint-vue.mjs'])
    await run('2) ESLint (含 vue3-recommended + typescript)', 'npx', ['eslint', 'src/**/*.{ts,vue}', '--max-warnings=0'])
    await run('3) TypeScript 类型检查', 'npx', ['vue-tsc', '--noEmit', '-p', 'tsconfig.app.json'])
    await run('4) 组件单元测试', 'npx', ['vitest', 'run'])
    if (!skipBuild) {
      await run('5) 生产构建', 'npx', ['vite', 'build'])
    } else {
      console.log(`${YELLOW}⏭  跳过 build (--skip-build)${RESET}`)
    }
    if (!skipE2E) {
      await run('6) E2E + 接口测试 (Playwright)', 'npx', ['playwright', 'test'])
    } else {
      console.log(`${YELLOW}⏭  跳过 E2E (--skip-e2e)${RESET}`)
    }
    const dur = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`\n${GREEN}${BOLD}✅ 全部检查通过 (${dur}s)${RESET}\n`)
  } catch (e) {
    const dur = ((Date.now() - t0) / 1000).toFixed(1)
    console.error(`\n${RED}${BOLD}❌ 检查失败 (${dur}s): ${e.message}${RESET}\n`)
    process.exit(1)
  }
}

main()
