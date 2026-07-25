/* eslint-disable no-console */
/**
 * 安装前环境检查:阻止在过旧的 Node / npm 上安装依赖。
 * 该脚本以 CommonJS 形式编写,便于 Node10 这种极旧版本也能被 require 成功、
 * 从而给出明确的中文提示,而不是抛出一堆语法错误吓到同事。
 */
var REQUIRED_NODE_MAJOR = 20
var REQUIRED_NODE_MINOR = 19
var REQUIRED_NPM_MAJOR = 10

function fail(msg) {
  console.error('\n==================== 环境检查未通过 ====================')
  console.error(msg)
  console.error('请安装 Node.js >= ' + REQUIRED_NODE_MAJOR + '.' + REQUIRED_NODE_MINOR + '.0 (推荐通过 nvm 使用项目根目录 .nvmrc 指定的版本)')
  console.error('推荐: 使用 nvm-windows / nvm 安装,然后执行  nvm use')
  console.error('=======================================================\n')
  process.exit(1)
}

// Node 版本
var nodeVer = process.versions.node.split('.')
var nodeMajor = parseInt(nodeVer[0], 10)
var nodeMinor = parseInt(nodeVer[1], 10)
if (
  nodeMajor < REQUIRED_NODE_MAJOR ||
  (nodeMajor === REQUIRED_NODE_MAJOR && nodeMinor < REQUIRED_NODE_MINOR)
) {
  fail('当前 Node 版本: ' + process.versions.node + ',项目要求 >= ' + REQUIRED_NODE_MAJOR + '.' + REQUIRED_NODE_MINOR + '.0')
}

// npm 版本
try {
  var cp = require('child_process')
  var npmVer = cp.execSync('npm -v', { encoding: 'utf8' }).trim()
  var npmMajor = parseInt(npmVer.split('.')[0], 10)
  if (npmMajor < REQUIRED_NPM_MAJOR) {
    fail('当前 npm 版本: ' + npmVer + ',项目要求 >= ' + REQUIRED_NPM_MAJOR + '.0.0')
  }
} catch (e) {
  // 拿不到 npm 版本就跳过,不阻塞安装
}

console.log('[env-check] Node ' + process.versions.node + ' 通过 ✅')
