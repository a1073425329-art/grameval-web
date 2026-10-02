# GramEval 前端测试指南

本文档回答:"点了按钮没反应"这类问题应该怎么发现,以及怎么在改完代码后一键把前端跑一遍。

## 每次改完代码, 一句话验证

```bash
cd D:/GramEval/grameval-web
npm run build                # 全套 6 层门禁 (env+syntax+types+lint+unit+build), 不依赖后端, 约 60s
npm run build -- --with-e2e  # 再追加 E2E, 需要后端 9001 已启动
```

> **为什么只有 `dev` / `build` 两个 npm script？**
> 这是刻意的。过去 `package.json` 挂了 20 个命令（`typecheck` / `lint` / `test:unit` / `test:e2e` / `verify`…），
> 人和 AI 都容易只挑一个跑、误以为完事，反而漏检。现在把编排全部收进 `scripts/check.mjs`，
> 对外只暴露 `npm run build`，语义唯一：**build = 全部检查通过才算能构建**。
> 单层调试用 `npm run build -- <层名>`，层名见下表。

绿了就代表:
- Vue 模板里没 `.sync` / `.native` / `visible=` 缺 v-model 之类 Vue 2 遗留写法
- TypeScript 类型无错
- 关键组件挂载 + 关键按钮点击的行为已被冒烟测试覆盖
- 生产构建能出 dist，且产物体积没超出基线 15%
- （加 `--with-e2e` 时）E2E 场景: 学生登录 → 打开笔记 / 小组 / 考试页 → 关键弹窗 / Tab 都能触发

## 6 层门禁的角色分工

| 层名 (`--` 后的参数) | 时间 | 覆盖的问题类型 | 例子 |
|---|---|---|---|
| `env` | ~1s | 依赖完整性 / Node & npm 版本 | `node_modules` 缺失、Node 版本不符 |
| `syntax` | ~0.5s | `scripts/**/*.mjs` 语法（防脚本自身语法错） | 改 `check.mjs` 时引入语法错误 |
| `types` | ~5s | TS 类型错误（`vue-tsc -b`，app/node/tests 三工程 strict） | 参数类型不匹配, 未导出的 API |
| `lint` | ~3s | 自研 `lint-vue` 静态扫描 + eslint（0 warning 容忍） | `:visible.sync="..."` 让 el-dialog 静默失效 |
| `unit` | ~2s | 组件挂载 + 关键状态转换（vitest） | 点新建笔记按钮 → `dialogVisible === true` |
| `build` | ~40s | vite 生产构建 + 产物体积基线对比 | 循环依赖、tree-shaking 失败、依赖膨胀 |

E2E（`--with-e2e`）不在上面 6 层里，放最后跑，因为它需要外部依赖（后端 9001）。

## 各层分别在测什么

### `lint` 层的 lint-vue — 静态扫描器 (`scripts/lint-vue.mjs`)

我自己写的扫描器,直接用 `@vue/compiler-sfc` 解析每个 `.vue` 文件,揪出:

- **`:xxx.sync=`** → Vue 3 已移除, `el-dialog` 用了会静默失效(**新建笔记按不动的元凶**)
- **`@xxx.native`** → Vue 3 已移除
- **`{{ x | filter }}`** → Vue 3 已移除
- **`<el-dialog :visible=...>` 但没有 `v-model=`** → 打不开
- **`@click="foo"` 里 `foo` 在 `<script setup>` 里没定义 / 没 import** → 按了没反应

正因为这些错误 Vue 3 都不会报编译错、runtime 也不抛异常,肉眼看不出来,所以要静态扫。

### 2. `typecheck` — vue-tsc

### `types` 层 — vue-tsc

`vue-tsc -b` 一次构建 app / node / tests 三个 TS 工程,`strict` 开到最严,不多说。

### `unit` 层 — Vitest + happy-dom + @vue/test-utils

配置在 `vitest.config.ts`,setup 在 `tests/unit/setup.ts`。当前覆盖:

- `tests/unit/StudyNotes.spec.ts`
  - 页面能挂载
  - **点击"新建笔记"按钮 → `dialogVisible` 从 false 变 true**(这是防止 `.sync` bug 回归的关键断言)
  - dialogVisible = false 时应同步复位 isAdding / isEditing / editingNote
- `tests/unit/StudyGroups.spec.ts`
  - 挂载 + 点击"创建小组"按钮 → showCreateModal=true
  - `handleCreate` 触发 createStudyGroup API

要给别的组件加类似断言,复制这两个文件就行。让被测组件 `defineExpose({...})` 内部状态,vitest 就能通过 `w.vm.xxx` 断言。

### `build` 层 — vite 生产构建 + 体积门禁

`vite build` 出 dist,然后拿 `dist/assets` 按分组（index / vendor / elementPlus / echarts）跟 `check.mjs` 里的
`BUNDLE_BASELINE` 对比,超过基线 15% 直接判失败,防止依赖或代码无节制膨胀。

### E2E 层（`--with-e2e`）— Playwright

- **api**: `tests/api/frontend-urls.test.ts` 覆盖前端 axios 里所有实际调用的 URL(不是后端 openapi 那个更完整的白名单)。**这个测试就是要杜绝"前端调 `/api/badges/my-badges`,后端只有 `/api/student/badges`"这种前后端路径不对齐的问题**。5xx 一律 FAIL。
- **e2e**: `tests/e2e/student-interactions.test.ts` 用真实浏览器登 user01/123456 → 打开 `/student/notes` → 点新建笔记 → 断言 `.el-dialog:visible` 真的出现 → 关闭 → 断言消失。类似地覆盖学习小组、在线考试 Tab 切换。

### 前置条件

- **env / syntax / types / lint / unit / build 不需要任何后端服务**,可离线跑;
- **E2E（`--with-e2e`）需要后端 9001 已启动 + admin/user01 密码是 123456**。

## 单独跑某一层

```bash
npm run build -- env        # 只跑环境层
npm run build -- syntax     # 只跑脚本语法层
npm run build -- types      # 只跑类型层
npm run build -- lint       # 只跑规范层
npm run build -- unit       # 只跑单测层
npm run build -- build      # 只跑构建层
npm run build -- types lint # 跑指定几层
npm run build -- --with-e2e # 全套 + E2E

npm run dev                 # 起开发服务器 (9000)
```

需要 Playwright 的 UI / headed / 报告时,直接调它的 CLI:

```bash
npx playwright test                     # 全部 playwright 用例
npx playwright test tests/api           # 只跑接口白名单
npx playwright test tests/e2e           # 只跑 E2E
npx playwright test --ui                # UI 模式
npx playwright test --headed            # 显示浏览器
npx playwright show-report              # 打开最近一次报告
npx vitest                              # vitest 单跑
npx vitest --watch                      # 边写边跑
```

## 常见问题排查

### `npm run build -- unit` 失败,提示 ResizeObserver undefined

已经在 `tests/unit/setup.ts` 里 stub 了。如果新版 element-plus 用到其它浏览器 API,补进 setup 即可。

### E2E 出现 401 / 403

- 401: 后端 admin 或 user01 密码不是 123456。回到 `D:/GramEval` 目录跑一次:
  ```bash
  java -cp ".;C:/dev/.m2/repository/com/mysql/mysql-connector-j/8.3.0/mysql-connector-j-8.3.0.jar" ResetAdminPassword
  ```
- 403: token 拿到但用户角色不匹配,检查 login 返回的 user.role。
- 403 且提示「账户已被禁用」: 该账号 `sys_user.status` 被改成非 1。注意**用 Postman/newman 跑全量接口回归时,写操作会把占位符数据写进真实库**,务必先做只读过滤（见下节）。

### E2E 提示端口 9000 被占用

Playwright 的 `webServer` 会自动跑 `npm run dev` 起 9000。如果 9000 已经有前端在跑,它会复用;如果那个前端进程崩了但端口还在 TIME_WAIT,等 30 秒或换端口。

### 静态扫描给出误报

`scripts/lint-vue.mjs` 是正则驱动的启发式扫描器,不追求 100% 精确。如果它给出的 warn 明显是误报(比如把某个 TS 类型名当变量),在文件里加白名单或直接忽略即可。**error 级别一定要修复**,因为它抓的是 Vue 3 已经不支持的语法。

## 后端接口全量测试(独立体系)

如果要测的是"后端 300+ 接口有没有 5xx",那是另一套脚本,在 `D:/GramEval/` 根目录:

```bash
cd /d/GramEval
node api-test.js          # 遍历后端 openapi 里全部 307 个 endpoint
node build-final-report.js
cat grameval-api-test-report.txt | head -30
```

那套脚本走的是**后端注册的**所有 URL,和这里的 `test:api` 走的**前端使用的** URL 是两个维度,互补。
