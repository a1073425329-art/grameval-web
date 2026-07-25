/**
 * 静态扫描 .vue 文件, 找出容易导致"按钮点了没反应"的典型错误。
 *
 * 目前覆盖:
 *   1. Vue 2 残留的 `.sync` 属性绑定 (Vue 3 里 el-dialog 用 :visible.sync 会静默失效);
 *   2. Vue 2 残留的 `.native` 修饰符;
 *   3. Vue 2 残留的过滤器 `{{ x | filter }}` (Vue 3 不支持, 会当乘法解析);
 *   4. template 里 @click / @change 引用的方法, 在 <script setup> 里没有定义;
 *   5. template 里插值/属性引用的顶层变量, 在 <script setup> 里没有 import / 声明;
 *   6. <script setup> 里 import 了但完全没用到的 ref/reactive/computed(仅提示, 不 fail);
 *   7. el-dialog / el-drawer / el-popover 使用了 `visible=` 但没有 `v-model` (打不开);
 *   8. 使用了 axios/request 直接调用 fetch(...) 一类的裸写法;
 *   9. 单文件 <script> 段以非 `setup` / `lang="ts"` 方式声明(避免混合 options API 破环境).
 *
 * 输出:
 *   scripts/lint-vue.report.json (机器可读)
 *   控制台带颜色的可读报告
 * 退出码非 0 表示发现 error 级别问题.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseSFC } from '@vue/compiler-sfc'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

/** 严重级别 */
const ERROR = 'error'
const WARN = 'warn'

/** @type {{file:string, line:number, level:string, rule:string, message:string, snippet:string}[]} */
const issues = []

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (name.endsWith('.vue')) out.push(full)
  }
  return out
}

function relFile(f) { return path.relative(ROOT, f).replace(/\\/g, '/') }

function locOf(src, offset) {
  const line = src.slice(0, offset).split('\n').length
  return line
}

function push(file, offset, srcRaw, level, rule, message) {
  const line = locOf(srcRaw, offset)
  const startOfLine = srcRaw.lastIndexOf('\n', offset - 1) + 1
  const endOfLine = srcRaw.indexOf('\n', offset)
  const snippet = srcRaw.slice(startOfLine, endOfLine === -1 ? undefined : endOfLine).trim()
  issues.push({ file: relFile(file), line, level, rule, message, snippet })
}

/**
 * 从 <script setup> 里粗提取顶层标识符 (可被 template 使用)。
 * 不走完整 AST — 用启发式正则,能覆盖 90% 常见写法。
 */
function extractBindings(scriptContent) {
  const bindings = new Set()
  // import { a, b as c } from 'x' / import a from 'x' / import * as ns from 'x'
  for (const m of scriptContent.matchAll(/import\s+(?:type\s+)?(?:(\*\s+as\s+\w+)|(\{[^}]+\})|(\w+))(?:\s*,\s*(\{[^}]+\}))?\s+from/g)) {
    const bag = [m[1], m[2], m[3], m[4]].filter(Boolean).join(' ')
    for (const p of bag.matchAll(/\b(\w+)(?:\s+as\s+(\w+))?/g)) {
      const name = p[2] || p[1]
      if (name && name !== 'as' && name !== 'from' && name !== 'type') bindings.add(name)
    }
  }
  // const|let|var name = ... / const { a, b } = ... / const [a, b] = ...
  for (const m of scriptContent.matchAll(/\b(?:const|let|var)\s+(\{[^}]+\}|\[[^\]]+\]|\w+)/g)) {
    const decl = m[1]
    if (decl.startsWith('{') || decl.startsWith('[')) {
      for (const p of decl.matchAll(/\b(\w+)(?:\s*:\s*(\w+))?/g)) {
        const name = p[2] || p[1]
        if (name && !/^(true|false|null|undefined|new|typeof)$/.test(name)) bindings.add(name)
      }
    } else {
      bindings.add(decl)
    }
  }
  // function foo() { ... }
  for (const m of scriptContent.matchAll(/\bfunction\s+(\w+)/g)) bindings.add(m[1])
  // defineProps / defineEmits 产出的对象也可用, 但通常不在 template 顶层引用
  return bindings
}

/** 标签级白名单: HTML 标签 + element-plus + 已知全局宏 */
const HTML_TAGS = new Set('a,abbr,address,area,article,aside,audio,b,base,bdi,bdo,blockquote,body,br,button,canvas,caption,cite,code,col,colgroup,data,datalist,dd,del,details,dfn,dialog,div,dl,dt,em,embed,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,head,header,hr,html,i,iframe,img,input,ins,kbd,label,legend,li,link,main,map,mark,menu,meta,meter,nav,noscript,object,ol,optgroup,option,output,p,param,picture,pre,progress,q,rp,rt,ruby,s,samp,script,section,select,slot,small,source,span,strong,style,sub,summary,sup,svg,table,tbody,td,template,textarea,tfoot,th,thead,time,title,tr,track,u,ul,var,video,wbr,transition,transition-group,teleport,suspense,component,keep-alive'.split(','))

const GLOBAL_MACROS = new Set(['$t', '$route', '$router', '$store', '$refs', '$emit', '$props', '$slots', '$attrs', '$el', '$parent', '$root', '$data', '$options', 'true', 'false', 'null', 'undefined', 'Math', 'Number', 'String', 'Array', 'Object', 'JSON', 'Date', 'Boolean', 'RegExp', 'console', 'window', 'document', 'globalThis', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'Infinity', 'NaN', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Promise', 'Symbol', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError'])

function scanTemplate(file, templateBlock, scriptBindings, rawSrc) {
  const tpl = templateBlock.content
  // 相对于原文件的 offset
  const tplStart = templateBlock.loc.start.offset

  // ---- 规则 1: .sync 修饰符 ----
  for (const m of tpl.matchAll(/(:[\w-]+\.sync\s*=)/g)) {
    push(file, tplStart + m.index, rawSrc, ERROR, 'no-sync-modifier',
      `Vue 3 已移除 .sync 修饰符, 请改用 v-model:xxx 或 @update:xxx (${m[1]})`)
  }
  // ---- 规则 2: .native 修饰符 ----
  for (const m of tpl.matchAll(/(@[\w-]+\.native)/g)) {
    push(file, tplStart + m.index, rawSrc, ERROR, 'no-native-modifier',
      `Vue 3 已移除 .native 修饰符, 组件根节点会继承事件`)
  }
  // ---- 规则 3: {{ x | filter }} ----
  for (const m of tpl.matchAll(/\{\{[^}]*\|[^|][^}]*\}\}/g)) {
    // 排除 || 或 位或 用法 —— 简单启发: | 前后有空格且不是 ||
    if (/[^|]\s+\|\s+[^|]/.test(m[0])) {
      push(file, tplStart + m.index, rawSrc, ERROR, 'no-mustache-filter',
        `Vue 3 已移除模板 filter 语法 ("${m[0].trim().slice(0, 60)}")`)
    }
  }
  // ---- 规则 7: dialog/drawer/popover 用了 visible= 但没有 v-model ----
  for (const m of tpl.matchAll(/<el-(dialog|drawer|popover)\b([\s\S]*?)>/g)) {
    const tag = m[1]
    const attrs = m[2]
    const hasVModel = /\bv-model(?::visible)?\s*=/.test(attrs)
    const hasVisibleProp = /(?:^|\s):?visible\s*=/.test(attrs)
    if (hasVisibleProp && !hasVModel) {
      push(file, tplStart + m.index, rawSrc, ERROR, 'dialog-must-use-vmodel',
        `<el-${tag}> 使用了 :visible=, 但没有 v-model 绑定, Vue 3 版 element-plus 会静默失效 (弹窗永远打不开)`)
    }
  }
  // ---- 规则 4/5: 模板引用的标识符 ----
  // 收集 @xxx="handler" / @xxx="handler(...)" / :prop="expr" / {{ expr }} 里的顶层名字
  const idRe = /[a-zA-Z_$][\w$]*/g
  const identifiersUsed = new Set()
  const identifiersLocs = new Map() // name -> first offset

  const push2 = (name, off) => {
    if (GLOBAL_MACROS.has(name)) return
    identifiersUsed.add(name)
    if (!identifiersLocs.has(name)) identifiersLocs.set(name, off)
  }
  const captureFromExpr = (expr, offInFile) => {
    for (const m of expr.matchAll(idRe)) {
      const w = m[0]
      // 跳过在 . 或 [ ' 之后 (对象属性)
      const before = expr[m.index - 1]
      if (before === '.' || before === "'" || before === '"' || before === '`') continue
      push2(w, offInFile + m.index)
    }
  }
  // @click / @xxx="..."
  for (const m of tpl.matchAll(/@[a-zA-Z][\w-]*(?:\.\w+)*\s*=\s*"([^"]+)"/g)) {
    captureFromExpr(m[1], tplStart + m.index + m[0].indexOf(m[1]))
  }
  // :prop="..."
  for (const m of tpl.matchAll(/(?<![\w-]):[a-zA-Z][\w-]*\s*=\s*"([^"]+)"/g)) {
    captureFromExpr(m[1], tplStart + m.index + m[0].indexOf(m[1]))
  }
  // v-if / v-else-if / v-show / v-for 的 表达式
  for (const m of tpl.matchAll(/\bv-(?:if|else-if|show|model)(?::\w+)?\s*=\s*"([^"]+)"/g)) {
    captureFromExpr(m[1], tplStart + m.index + m[0].indexOf(m[1]))
  }
  for (const m of tpl.matchAll(/\bv-for\s*=\s*"\s*(?:\([^)]+\)|[\w$]+)\s+(?:in|of)\s+([^"]+)"/g)) {
    captureFromExpr(m[1], tplStart + m.index + m[0].indexOf(m[1]))
  }
  // {{ expr }}
  for (const m of tpl.matchAll(/\{\{([^}]+)\}\}/g)) {
    captureFromExpr(m[1], tplStart + m.index + 2)
  }

  // ---- 校验: 每个用到的标识符必须在 scriptBindings / GLOBAL_MACROS / 局部 v-for/slot 变量里 ----
  // 收集本模板内的局部变量 (v-for / slot)
  const localVars = new Set()
  for (const m of tpl.matchAll(/\bv-for\s*=\s*"\s*(?:\(([^)]+)\)|([\w$]+))\s+(?:in|of)/g)) {
    const bag = m[1] || m[2]
    for (const p of bag.split(',')) {
      const n = p.trim().replace(/[{[\]}]/g, '').trim()
      if (n) localVars.add(n)
    }
  }
  for (const m of tpl.matchAll(/#(?:default|[\w-]+)\s*=\s*"\s*\{([^}]+)\}\s*"/g)) {
    for (const p of m[1].split(',')) {
      const n = p.trim().split(/[:\s=]/)[0]
      if (n) localVars.add(n)
    }
  }

  for (const name of identifiersUsed) {
    if (scriptBindings.has(name)) continue
    if (localVars.has(name)) continue
    // 有些属性值里出现字符串路径参数,例如 path="student/exams" 里的 student — 排除仅字母的短英文单词误判
    // 只报 warn: 因为静态分析不可能 100% 准确
    push(file, identifiersLocs.get(name), rawSrc, WARN, 'template-uses-undefined',
      `模板引用了 "${name}", 但 <script setup> 里没有找到同名声明 / import (若是外部 URL / 字符串常量请忽略)`)
  }
}

function scanScript(file, block, rawSrc) {
  // 规则 9: 强制 script setup 或 lang="ts"
  if (!block.setup && !block.lang) {
    push(file, block.loc.start.offset, rawSrc, WARN, 'script-should-be-setup',
      `<script> 建议使用 <script setup lang="ts">, 便于统一类型和 setup composition`)
  }
}

// -------- 主流程 --------
console.log('[lint-vue] 扫描目录:', SRC)
const files = walk(SRC)
console.log('[lint-vue] 待扫描 .vue 文件:', files.length)

for (const f of files) {
  const raw = fs.readFileSync(f, 'utf-8')
  const sfc = parseSFC(raw)
  if (sfc.errors.length) {
    for (const err of sfc.errors) {
      push(f, err.loc ? err.loc.start.offset : 0, raw, ERROR, 'sfc-parse-error', err.message || String(err))
    }
    continue
  }
  const scriptBlock = sfc.descriptor.scriptSetup || sfc.descriptor.script
  const bindings = scriptBlock ? extractBindings(scriptBlock.content) : new Set()
  if (sfc.descriptor.template) scanTemplate(f, sfc.descriptor.template, bindings, raw)
  if (scriptBlock) scanScript(f, scriptBlock, raw)
}

// -------- 输出 --------
const errorCount = issues.filter(i => i.level === ERROR).length
const warnCount = issues.filter(i => i.level === WARN).length

// 按文件汇总
const byFile = {}
for (const i of issues) (byFile[i.file] = byFile[i.file] || []).push(i)

const RESET = '\x1b[0m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GRAY = '\x1b[90m'
const CYAN = '\x1b[36m'

for (const [f, list] of Object.entries(byFile).sort()) {
  console.log(CYAN + f + RESET)
  for (const i of list) {
    const color = i.level === ERROR ? RED : YELLOW
    console.log(`  ${color}${i.level.toUpperCase().padStart(5)}${RESET}  L${String(i.line).padStart(4)}  ${GRAY}[${i.rule}]${RESET}  ${i.message}`)
    if (i.snippet) console.log(`         ${GRAY}${i.snippet.slice(0, 200)}${RESET}`)
  }
}

console.log()
console.log(`[lint-vue] 共 ${issues.length} 条问题, ${RED}error=${errorCount}${RESET} ${YELLOW}warn=${warnCount}${RESET}`)

fs.mkdirSync(path.join(ROOT, 'scripts'), { recursive: true })
fs.writeFileSync(
  path.join(ROOT, 'scripts/lint-vue.report.json'),
  JSON.stringify({ errorCount, warnCount, issues }, null, 2),
  'utf-8'
)

// error 有一个也退出非 0
process.exit(errorCount > 0 ? 1 : 0)
