# GramEval 前端测试指南

本文档回答:"点了按钮没反应"这类问题应该怎么发现,以及怎么在改完代码后一键把前端跑一遍。

## 每次改完代码, 一句话验证

```bash
cd D:/GramEval/grameval-web
npm run verify           # 全套 (lint + typecheck + unit + build + e2e), 需要后端 9001 已启动
# 或
npm run verify:no-e2e    # 只跑前四步, 不依赖后端, 大约 30 秒
```

绿了就代表:
- Vue 模板里没 `.sync` / `.native` / `visible=` 缺 v-model 之类 Vue 2 遗留写法
- TypeScript 类型无错
- 关键组件挂载 + 关键按钮点击的行为已被冒烟测试覆盖
- 生产构建能出 dist
- E2E 场景: 学生登录 → 打开笔记 / 小组 / 考试页 → 关键弹窗 / Tab 都能触发

## 5 层测试的角色分工

| 命令 | 时间 | 覆盖的问题类型 | 例子 |
|---|---|---|---|
| `npm run lint:vue` | ~0.3s | Vue 3 语法/绑定错误, template 引用不存在的方法 | `:visible.sync="..."` 让 el-dialog 静默失效 |
| `npm run typecheck` | ~5s | TS 类型错误 | 参数类型不匹配, 未导出的 API |
| `npm run test:unit` | ~2s | 组件挂载 + 关键状态转换 | 点新建笔记按钮 → `dialogVisible === true` |
| `npm run build` | ~40s | 生产构建能否出 dist | 循环依赖、tree-shaking 失败 |
| `npm run test:e2e` | ~60s | 真实浏览器的用户流 | 登录后点按钮弹窗真的可见 |
| `npm run test:api` | ~30s | 前端 axios 用的所有 URL 后端都返 2xx/业务 4xx | `/api/badges/my-badges` 404 |

## 五个层次分别在测什么

### 1. `lint:vue` — 静态扫描器 (`scripts/lint-vue.mjs`)

我自己写的扫描器,直接用 `@vue/compiler-sfc` 解析每个 `.vue` 文件,揪出:

- **`:xxx.sync=`** → Vue 3 已移除, `el-dialog` 用了会静默失效(**新建笔记按不动的元凶**)
- **`@xxx.native`** → Vue 3 已移除
- **`{{ x | filter }}`** → Vue 3 已移除
- **`<el-dialog :visible=...>` 但没有 `v-model=`** → 打不开
- **`@click="foo"` 里 `foo` 在 `<script setup>` 里没定义 / 没 import** → 按了没反应

正因为这些错误 Vue 3 都不会报编译错、runtime 也不抛异常,肉眼看不出来,所以要静态扫。

### 2. `typecheck` — vue-tsc

标准 TS 类型检查,不多说。

### 3. `test:unit` — Vitest + happy-dom + @vue/test-utils

配置在 `vitest.config.ts`,setup 在 `tests/unit/setup.ts`。当前覆盖:

- `tests/unit/StudyNotes.spec.ts`
  - 页面能挂载
  - **点击"新建笔记"按钮 → `dialogVisible` 从 false 变 true**(这是防止 `.sync` bug 回归的关键断言)
  - dialogVisible = false 时应同步复位 isAdding / isEditing / editingNote
- `tests/unit/StudyGroups.spec.ts`
  - 挂载 + 点击"创建小组"按钮 → showCreateModal=true
  - `handleCreate` 触发 createStudyGroup API

要给别的组件加类似断言,复制这两个文件就行。让被测组件 `defineExpose({...})` 内部状态,vitest 就能通过 `w.vm.xxx` 断言。

### 4. `build` — vite 生产构建

真正走一遍 `vue-tsc -b && vite build`,如果模块循环、tree-shaking 失败、按需引入配错,build 会挂。

### 5. `test:e2e` + `test:api` — Playwright

- **api**: `tests/api/frontend-urls.test.ts` 覆盖前端 axios 里所有实际调用的 URL(不是后端 openapi 那个更完整的白名单)。**这个测试就是要杜绝"前端调 `/api/badges/my-badges`,后端只有 `/api/student/badges`"这种前后端路径不对齐的问题**。5xx 一律 FAIL。
- **e2e**: `tests/e2e/student-interactions.test.ts` 用真实浏览器登 user01/123456 → 打开 `/student/notes` → 点新建笔记 → 断言 `.el-dialog:visible` 真的出现 → 关闭 → 断言消失。类似地覆盖学习小组、在线考试 Tab 切换。

### 前置条件

- **lint / typecheck / unit / build 不需要任何后端服务**,可离线跑;
- **api / e2e 需要后端 9001 已启动 + admin/user01 密码是 123456**。

## 单独跑某一层

```bash
npm run lint:vue         # 静态扫
npm run typecheck        # TS
npm run test:unit        # vitest 单跑
npm run test:unit:watch  # 边写边跑
npm run test:unit:ui     # 有 UI 的
npm run build            # 构建
npm run test:api         # 只跑接口白名单
npm run test:e2e         # 只跑 E2E
npm run test             # 全部 playwright(相当于 test:api + test:e2e + 原来的 admin/student.test.ts)
npm run test:ui          # playwright 的 UI 模式
npm run test:headed      # 显示浏览器
npm run test:report      # 打开最近一次 playwright 报告
```

## 常见问题排查

### `npm run test:unit` 失败,提示 ResizeObserver undefined

已经在 `tests/unit/setup.ts` 里 stub 了。如果新版 element-plus 用到其它浏览器 API,补进 setup 即可。

### `npm run test:api` 出现 401 / 403

- 401: 后端 admin 或 user01 密码不是 123456。回到 `D:/GramEval` 目录跑一次:
  ```bash
  java -cp ".;C:/dev/.m2/repository/com/mysql/mysql-connector-j/8.3.0/mysql-connector-j-8.3.0.jar" ResetAdminPassword
  ```
- 403: token 拿到但用户角色不匹配,检查 login 返回的 user.role。

### `npm run test:e2e` 提示端口 9000 被占用

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
