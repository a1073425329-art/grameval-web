# GramEval Web — 英语语法专项在线考试系统（前端）

基于 Vue 3 + TypeScript + Vite + Element Plus 的英语语法专项在线考试系统前端，
对接后端 [`../grameval-java`](../grameval-java/README.md)（默认 `http://localhost:9001`）。

> 本仓库是**毕业设计**的工程实现，论文与全部文档在 [`../docs`](../docs/00-归档总索引.md)，
> 详细测试说明见 [`TESTING.md`](TESTING.md)。

---

## 📋 目录

- [一、相关论文与交付目标](#一相关论文与交付目标)
- [二、这个前端是做什么的](#二这个前端是做什么的)
- [三、技术栈](#三技术栈)
- [四、项目结构](#四项目结构)
- [五、快速开始](#五快速开始)
- [六、配置说明](#六配置说明)
- [七、构建门禁（6 层）](#七构建门禁6-层)
- [八、TypeScript 严格模式](#八typescript-严格模式)
- [九、路由与角色](#九路由与角色)
- [十、API 对接](#十api-对接)
- [十一、状态管理](#十一状态管理)
- [十二、关键设计决策](#十二关键设计决策)
- [十三、测试](#十三测试)
- [十四、常见操作](#十四常见操作)
- [十五、文档索引](#十五文档索引)
- [十六、待办事项](#十六待办事项)

---

## 一、相关论文与交付目标

前端与后端**同属一篇毕业论文**，验收标准以后端 README §一 与论文功能基线为准。

### 1.1 论文基本信息

| 项目 | 内容 |
|---|---|
| **论文题目** | 基于 Spring Boot 的英语语法专项考试系统的设计与实现 |
| **作者** | 李振豪（准考证号 `010423201089`） |
| **指导教师** | 张娟（副教授） |
| **学校** | 哈尔滨工程大学 高等教育自学考试 |
| **专业** | 计算机科学与技术 |
| **完成日期** | 2026 年 6 月 |

### 1.2 论文文件在哪里

| 文件 | 路径 |
|---|---|
| **论文全文（Markdown 母本）** | [`../docs/01-权威母本/论文全文.md`](../docs/01-权威母本/论文全文.md) |
| 论文原始 Word | [`../docs/02-交付物/论文文档/李振豪-毕业论文最终版-专家意见.docx`](../docs/02-交付物/论文文档/李振豪-毕业论文最终版-专家意见.docx) |
| **任务书** | [`../docs/02-交付物/论文文档/任务书.md`](../docs/02-交付物/论文文档/任务书.md) |
| **论文功能基线（可验收清单）** | [`../docs/01-权威母本/01-论文功能基线.md`](../docs/01-权威母本/01-论文功能基线.md) |
| 前后端 API 对齐 | [`../docs/01-权威母本/11-前后端API对齐检查报告.md`](../docs/01-权威母本/11-前后端API对齐检查报告.md) |
| 前端公开接口白名单 | [`../docs/01-权威母本/审计/前端公开接口白名单.md`](../docs/01-权威母本/审计/前端公开接口白名单.md) |
| 前端审计报告 | [`../docs/01-权威母本/审计/前端审计.md`](../docs/01-权威母本/审计/前端审计.md) |

### 1.3 前端要完成什么

论文声明的**前端技术口径**：Vue 3 + Element Plus + Axios，实现 B/S 架构中浏览器侧的**全部页面交互**，
覆盖学生端与管理端的 8 项核心用例（见后端 README §1.4）。

前端承担的验收要点：

- **UC01 注册登录**：登录/注册页、按角色进入对应首页、Token 持久化与 401 自动跳转。
- **UC02 题库查询**：分类/题型/难度筛选分页；**页面不得展示标准答案**（后端不返回、前端不臆造）。
- **UC03 专项练习**：选专题 → 作答 → 即时反馈正误与解析。
- **UC04/UC05 在线考试与提交**：计时、答题卡、逐题保存、断点续考、未答提醒 + 二次确认提交。
- **UC07 成绩查询**：成绩列表、逐题明细、多维度分析图表；**答案未公开时只显示总分**。
- **UC08 后台管理**：用户/分类/试题/试卷/场次/成绩管理页 + 导入导出 + 监控 + 统计。
- **非功能**：Chrome / Edge / Firefox 兼容（1366×768、1920×1080）；长题干自动换行、组件不失效。

---

## 二、这个前端是做什么的

**一句话**：它是 GramEval 系统的**浏览器端界面**，用一套代码承载"学生做练习与考试"和"管理员管题库与考试"两类场景。

**架构位置**：

```text
浏览器（本仓库，dev 端口 9000）
   │  /api 请求经 Vite 代理转发
   ▼
后端 grameval-java（9001）→ MySQL（grameval）
```

**核心场景**：题库按语法专题（时态、语态、从句、非谓语动词、主谓一致等）组织；
学生可浏览题库、做专项练习、参加限时考试并即时拿到成绩；管理员可维护题目、组卷、发考试并查看统计。

**角色与页面**：路由按角色**动态注册**——未授权角色的路由在前端根本不存在（详见 §九）。

---

## 三、技术栈

> **2026-10-18 实测口径**：前端版本均 ≥ 论文表 5.1 声明（论文写 Vue 3 / Element Plus / Node.js 20，实际 Vue 3.5.39 / Element Plus 2.14.3 / Node 26.5.0）。

| 层级 | 组件 | 版本 | 备注 |
|---|---|---|---|
| 框架 | **Vue 3** | ^3.5.39 | Composition API + `<script setup>` |
| 构建 | **Vite** | ^8.1.1 | dev 端口 **9000** |
| 语言 | **TypeScript** | ~6.0.2 | 严格模式全开（§八） |
| UI 组件库 | Element Plus | ^2.14.3 | |
| 图标 | @element-plus/icons-vue / @iconify/vue / unplugin-icons | ^2.3.2 / ^5.0.1 / ^23.0.1 | 按需引入 + tree-shake |
| HTTP | Axios | ^1.18.1 | 统一 `ApiResponse<T>` 解包 |
| 状态管理 | Pinia | ^4.0.2 | |
| 路由 | Vue Router | ^4.6.4 | hash 模式 |
| 图表 | ECharts / vue-echarts | ^6.1.0 / ^8.0.1 | 统计与维度分析 |
| 流程图 | @vue-flow/core + controls + minimap | ^1.48.2 等 | 管理端 `WorkflowPanel.vue` |
| 日期 | dayjs | ^1.11.21 | |
| 样式 | Sass (SCSS) | ^1.101.0 | |
| 单测 | Vitest + @vue/test-utils + happy-dom | ^4.1.10 / ^2.4.11 / ^20.11.1 | |
| E2E | Playwright | ^1.62.0 | 需后端 9001 启动；**当前只配 chromium**（`playwright.config.ts`） |
| 规范 | ESLint 10 + eslint-plugin-vue + typescript-eslint | ^10.8.0 / ^10.10.0 / ^8.65.0 | **0 warning 容忍** |
| 类型门禁 | vue-tsc | ^3.3.5 | `vue-tsc -b` 三工程 |
| 压缩 | vite-plugin-compression | ^0.5.1 | Gzip + Brotli |
| 包管理 | **pnpm** | — | 见 `pnpm-lock.yaml` / `pnpm-workspace.yaml` |

**浏览器覆盖（2026-10-18）**：论文表 5.12 声称 Chrome/Edge/Firefox 两分辨率通过；**三浏览器均人工测试通过**——Chrome 历史截图、Firefox 用户手动（母本 `04-证据与验证记录.md` E10）、**Edge 用户手动（2026-10-18）**；Playwright 自动化仍仅覆盖 chromium（不影响人工结论）。

**运行环境约束**（`package.json` 硬性要求）：

```json
"engines": { "node": ">=20.19.0", "npm": ">=10.0.0" },
"engineStrict": true
```

同时提供 `.nvmrc` / `.node-version` / `.npmrc` 便于对齐版本。

---

## 四、项目结构

```text
grameval-web/
├── index.html
├── vite.config.ts               # dev 端口 9000、/api 代理 9001、分包与压缩
├── vitest.config.ts             # 单测配置
├── playwright.config.ts         # E2E 配置
├── tsconfig.json                # 根（引用下面三个工程）
├── tsconfig.app.json            # 应用代码（strict 最严，见 §八）
├── tsconfig.node.json           # 构建脚本
├── tsconfig.tests.json          # 测试代码
├── eslint.config.js             # ESLint 10 flat config
├── scripts/
│   ├── check.mjs                # ★ 唯一门禁入口，编排 6 层检查
│   ├── check-env.cjs            # 环境层：依赖完整性 / Node & npm 版本
│   └── lint-vue.mjs             # 自研 Vue 静态扫描
├── tests/
│   ├── admin.test.ts            # 管理端测试
│   ├── student.test.ts          # 学生端测试
│   ├── api/frontend-urls.test.ts
│   ├── e2e/student-interactions.test.ts
│   └── unit/                    # ExamList / markdown / StudyGroups / StudyNotes 等单测
└── src/
    ├── main.ts                  # 入口：挂载 App + Pinia + Router + vue-flow 样式
    ├── App.vue                  # 根组件（仅 <router-view>）
    ├── api/                     # 按领域分文件的请求封装
    │   ├── request.ts           # Axios 实例（Token 携带 + 401 跳转）
    │   ├── auth.ts              # 登录 / 注册 / me / 改密
    │   ├── student.ts           # 学生端：分类 / 题库 / 练习 / 考试 / 成绩 / 统计
    │   ├── admin.ts             # 管理端：用户 / 分类 / 题目 / 试卷 / 场次 / 成绩 / 日志
    │   ├── user.ts              # 个人资料
    │   ├── ai.ts                # AI 出题：分析 / 预览 / 入库
    │   └── dict.ts              # 字典：题型 / 难度 / 角色 / 状态
    ├── router/
    │   ├── index.ts             # 路由实例 + 守卫（JWT 校验 + 动态路由）
    │   └── asyncRoutes.ts       # 按角色注册的动态路由
    ├── stores/                  # auth / app / permission / dict / tags
    ├── views/
    │   ├── login/ register/ layout/ error/ redirect/
    │   ├── student/             # Home QuestionBank Practice ExamList ExamRoom
    │   │                        # MyResults ResultDetail WrongBook Stats Profile
    │   └── admin/               # Dashboard UserManage MyStudents CategoryManage
    │                            # QuestionManage QuestionAnalytics PaperManage AiCompose
    │                            # ExamManage ExamMonitor ExamStatistics ResultManage
    │                            # OperationLogs WorkflowPanel Profile
    ├── components/              # AnswerSheet / Countdown / SearchBar
    ├── types/                   # 对齐后端 VO/DTO 的 TS 类型
    ├── utils/                   # request 等
    └── styles/                  # index.scss / variables.scss
```

---

## 五、快速开始

### 前置条件

- **Node.js ≥ 20.19.0**、**npm ≥ 10.0.0**（`engineStrict` 会强制校验）；包管理用 **pnpm**
- 后端已启动（默认 `http://localhost:9001`）

### 开发

```bash
cd grameval-web
pnpm install
pnpm dev
```

启动后地址：**http://localhost:9000**（`vite.config.ts` 中 `server.port: 9000`）。
所有 `/api` 请求经 Vite 代理转发到后端 9001。

### 前后端一条命令起齐

```bash
# 终端 1：后端
cd grameval-java && start.bat          # 或用 mvn spring-boot:run

# 终端 2：前端
cd grameval-web && pnpm dev
```

### 测试账号

| 账号 | 密码 | 角色 |
|---|---|---|
| `admin` | `123456` | ADMIN（系统管理员） |
| `student01` | `123456` | STUDENT（演示学生） |

---

## 六、配置说明

### 6.1 端口与代理（[`vite.config.ts`](vite.config.ts)）

```ts
server: {
  port: 9000,                          // ← 前端 dev 端口
  proxy: {
    '/api': { target: 'http://localhost:9001', changeOrigin: true },
  },
  watch: {
    ignored: ['**/node_modules/**', '**/.git/**', '**/*.tmpdir/**', '**/*.tmp'],
  },
}
```

要点：

- **前端 9000 / 后端 9001**。改后端地址只需改 `proxy.target`。
- `watch.ignored` 里有 `*.tmpdir/` 与 `*.tmp`：**这是为了绕坑**——编辑器/写入工具的原子写临时目录
  会让 chokidar 对锁定的 `.tmp` 发起 `fs.watch` 抛 `EBUSY`，把 dev server 打挂。

### 6.2 构建产物配置（同文件 `build` 段）

| 配置 | 值 | 目的 |
|---|---|---|
| `manualChunks` | `elementPlus` / `echarts` / `axios` / `dayjs` / `icons` / `vendor` | 按包拆分缓存块 |
| 分包判断顺序 | **先具体包，后 `vue` 通配** | ⚠️ 历史 bug：`vue` 判断放最前时，pnpm 路径里的 `_vue@x_` peer 后缀会把 `element-plus` 整包吞进 vendor（vendor 从 450 KB 膨胀到 2082 KB） |
| `minify` | `terser` | |
| `cssCodeSplit` | `true` | CSS 随 chunk 拆分 |
| `sourcemap` | `false` | |
| `target` | `esnext` | |
| 文件命名 | `assets/js/[name]-[hash].js` 等 | 带 hash 便于缓存 |
| `modulePreload` | 过滤 `echarts` | 减少多余 preload 提示 |

> 关于 echarts 的**如实说明**：把 echarts 排除出 preload 并**没有**省掉首屏流量——入口 chunk 第一行就静态
> `import` 了 echarts（Vite 对多懒加载页面共享模块的依赖提升）。做过对照：去掉 manualChunks 后 echarts 会并进
> vendor（817 KB），总量反而更大，所以保留手动分组。

### 6.3 压缩

`vite-plugin-compression` 同时启用 **Gzip + Brotli**（`threshold: 1024`、`minRatio: 0.8`）。

---

## 七、构建门禁（6 层）

> **本项目的"构建"不是单纯的 `vite build`。**

[`package.json`](package.json) 只有两个 script：

```json
"scripts": {
  "dev": "vite",
  "build": "node scripts/check.mjs"
}
```

**`npm run build` = 跑完 6 层检查且全部通过才算能构建**。过去挂了 20 个命令（typecheck/lint/test…），
人和 AI 都容易只挑一个跑、误以为完事，所以把编排全收进 [`scripts/check.mjs`](scripts/check.mjs)。

### 6 层（由快到慢，前面挂了立即中断）

| # | 层 | 内容 | 工具 |
|---|---|---|---|
| 1 | `env` | 依赖完整性 / Node & npm 版本 | `scripts/check-env.cjs` |
| 2 | `syntax` | 递归扫 `scripts/**/*.mjs` 语法 | `node --check` |
| 3 | `types` | 类型（app / node / tests 三工程，strict 最严） | `vue-tsc -b` |
| 4 | `lint` | 规范（自研扫描 + ESLint，**0 warning 容忍**） | `lint-vue.mjs` + `eslint --max-warnings 0` |
| 5 | `unit` | 单测（组件冒烟 + 纯函数） | `vitest run` |
| 6 | `build` | 构建 + **产物体积基线对比** | `vite build` |

### 用法

```bash
npm run build                      # 全部 6 层
npm run build -- types             # 只跑某一层（调试用）
npm run build -- types lint        # 跑指定几层
npm run build -- --with-e2e        # 额外跑 E2E（需后端 9001 已启动）
```

> E2E 属"联调"而非"代码门禁"，默认不跑，避免本地没起后端就把 build 卡死。
> 门禁失败时**不要用 `@ts-ignore` / `eslint-disable` / `any` 掩盖，要修根因**。

### 产物体积基线（防依赖无节制膨胀）

判定线 = 基线 × **1.15**：

| 分组 | 基线 (KB) |
|---|---|
| `index` | 150 |
| `vendor` | 450 |
| `elementPlus` | 1900 |
| `echarts` | 1500 |
| `other` | 不设基线 |

超出即失败，排查方向：是否有依赖被误引入 `main.ts`、是否有大 JSON 被内联进产物。

### 设计约束

`check.mjs` **零外部依赖**，只用 node 内置模块；直接调用各工具的 JS 入口
（`node_modules/xxx/bin/…`），不经 shell / npm / `.cmd`，规避 Windows 下的引号与 PATH 问题。

---

## 八、TypeScript 严格模式

**已开启，且是最严档**（[`tsconfig.app.json`](tsconfig.app.json)，自 2026-09-26 起）。

| 开关 | 状态 |
|---|---|
| `strict` | ✅ |
| `noImplicitReturns` / `noImplicitOverride` / `noFallthroughCasesInSwitch` | ✅ |
| `noUnusedLocals` / `noUnusedParameters`（未用变量/参数报错） | ✅ |
| **`noUncheckedIndexedAccess`**（下标访问必须判空） | ✅ |
| **`exactOptionalPropertyTypes`**（可选属性最严） | ✅ |

> 类型检查由门禁第 3 层 `vue-tsc -b` 执行。**任何 `any` / 忽略注释都会被第 4 层的 0-warning 策略拦下。**
> 新增代码请在提交前跑 `npm run build -- types` 确认。

---

## 九、路由与角色

### 路由守卫流程（[`router/index.ts`](src/router/index.ts)）

```text
beforeEach:
  1. 白名单（/login, /register）→ 放行
  2. 已登录 + 在白名单 → 跳到角色首页
  3. 无 Token → 重定向 /login
  4. 有 Token 但无 role → 清除状态重新登录
  5. 有 role 但未生成动态路由 → generateRoutes(role) + 注册到 Router
  6. 路径为 / → 重定向到该角色默认首页
  7. 放行
```

### 路由汇总

| 角色 | 页面 | 路径 |
|---|---|---|
| 公开 | 登录 | `/login`、`/login/:role` |
| 公开 | 注册 | `/register` |
| 学生 | 首页 | `/student/home` |
| 学生 | 语法题库 | `/student/question-bank` |
| 学生 | 专项练习 | `/student/practice` |
| 学生 | 考试列表 | `/student/exams` |
| 学生 | 在线考试 | `/student/exam-room/:examId`（**核心**） |
| 学生 | 我的成绩 | `/student/results` |
| 学生 | 成绩详情 | `/student/results/:id` |
| 学生 | 错题本 | `/student/wrong-book` |
| 学生 | 学习数据 | `/student/stats` |
| 学生 | 个人资料 | `/student/profile` |
| 管理 | 工作台 | `/dashboard` |
| 管理 | 用户管理 | `/admin/users` |
| 管理 | 我的学生 | `/admin/my-students` |
| 管理 | 语法分类 | `/admin/categories` |
| 管理 | 试题管理 | `/admin/questions` |
| 管理 | 题目分析 | `/admin/questions/analytics` |
| 管理 | 试卷管理 | `/admin/papers` |
| 管理 | 智能出题 | `/admin/ai-compose` |
| 管理 | 考试管理 | `/admin/exams` |
| 管理 | 考试监控 | `/admin/exams/:id/monitor` |
| 管理 | 场次统计 | `/admin/exams/:id/statistics` |
| 管理 | 成绩管理 | `/admin/results` |
| 管理 | 操作日志 | `/admin/operation-logs` |
| 管理 | 个人资料 | `/admin/profile` |

---

## 十、API 对接

### 学生端（[`api/student.ts`](src/api/student.ts)）

| 函数 | 方法 | 路径 |
|---|---|---|
| `listCategories` / `getCategoryTree` | GET | `/api/categories`、`/api/categories/tree` |
| `listQuestions` / `getQuestionDetail` / `getQuestionStudyMode` | GET | `/api/questions`、`/{id}`、`/{id}/study-mode` |
| `getPracticeQuestions` / `startPractice` / `answerInPractice` / `finishPractice` | GET/POST | `/api/practices/*` |
| `getAvailableExams` / `startExam` / `getExamQuestions` / `saveAnswer` / `submitExam` / `resumeExam` | GET/POST | `/api/exams/*` |
| `getMySummary` / `getMyResults` / `getResultDetail` / `getWrongBook` | GET | `/api/results/*` |
| `getStudentStatistics` | GET | `/api/students/{id}/statistics` |
| `getDimensionAnalysis` | GET | `/api/students/exams/{id}/dimension-analysis` |
| `getTrainingSchedule` / `updateTrainingSchedule` | GET/PUT | `/api/students/{id}/training-schedule` |

### 管理端（[`api/admin.ts`](src/api/admin.ts)）

| 函数 | 方法 | 路径 |
|---|---|---|
| 用户 CRUD / `resetUserPassword` | CRUD | `/api/users`、`/api/users/{id}/password/reset` |
| 分类 CRUD（树形） | CRUD | `/api/categories` |
| 题目 CRUD / 批量 / 导入导出 | CRUD | `/api/questions`、`/batch-*`、`/import/*` |
| 试卷 CRUD / 场次 CRUD | CRUD | `/api/papers`、`/api/sessions` |
| `getDashboard` | GET | `/api/admin/dashboard` |
| `listExamStudents` / `assignExamStudents` / `forceSubmit` | GET/PUT/POST | `/api/admin/exams/{id}/*` |
| `getExamMonitor` / `getSessionStatistics` / `getQuestionAnalytics` | GET | `/api/admin/exams|questions/*` |
| `listAdminResults` / `exportResults` | GET | `/api/admin/results` |
| `listOperationLogs` | GET | `/api/admin/operation-logs` |
| `listMyStudents` / `bindMyStudents` | GET/PUT | `/api/admin/my-students` |

### AI 出题（[`api/ai.ts`](src/api/ai.ts)）

| 函数 | 方法 | 路径 |
|---|---|---|
| `analyzeStudent` | POST | `/api/admin/ai/analyze-student` |
| `generatePreview` | POST | `/api/admin/ai/generate-paper/preview` |
| `confirmPaper` | POST | `/api/admin/ai/generate-paper/confirm` |
| `listGenerationLogs` / `getGenerationLog` | GET | `/api/admin/ai/generation-logs` |

### 页面 ↔ API 依赖矩阵（节选）

| 页面 | 依赖 API |
|---|---|
| `LoginView` / `RegisterView` | `POST /api/auth/login`、`/api/auth/register` |
| `Home.vue` | `GET /api/results/my-summary`、`GET /api/exams/available` |
| `QuestionBank.vue` | `GET /api/categories`、`GET /api/questions`、`/{id}/study-mode` |
| `Practice.vue` | `GET /api/practices/questions`、`POST /api/practice/submit` |
| `ExamRoom.vue` | `POST /api/exams/start`、`GET /{id}/questions`、`POST /{id}/answers`、`POST /{id}/submit` |
| `MyResults.vue` | `GET /api/results/my-summary`、`/my-list` |
| `ResultDetail.vue` | `GET /api/results/{id}/detail`、`/api/students/exams/{id}/dimension-analysis` |
| `WrongBook.vue` | `GET /api/results/wrong-book` |
| `Stats.vue` | `GET /api/students/{id}/statistics`、`/training-schedule` |
| `Dashboard` | `GET /api/admin/dashboard` |
| `UserManage` | `GET/POST/PUT/DELETE /api/users` |
| `AiCompose` | `POST /api/admin/ai/analyze-student`、`/generate-paper/*` |
| `ExamMonitor` / `ExamStatistics` | `GET /api/admin/exams/{id}/monitor`、`/statistics` |
| `ResultManage` | `GET /api/admin/results`、`/export` |

---

## 十一、状态管理（Pinia）

| Store | 字段 | 主要 action |
|---|---|---|
| `auth`（`stores/auth.ts`） | `token`, `role`, `userInfo`(id/username/displayName)；getter `isLoggedIn`, `homePath` | `login(form)`, `logout()`, `fetchUserInfo()` |
| `permission` | `routes`, `generated` | `generateRoutes(role)` — 按角色过滤 `asyncRoutes` |
| `app` | `sidebarCollapsed` | `toggleSidebar()` |
| `dict` | `dictMap` | `load()` — 调 `/api/dict` 一次性拉常量 |
| `tags` | `questionTags`, `paperTags` | `loadQuestionTags()`, `loadPaperTags()` |

---

## 十二、关键设计决策

### 1. 路由模式

`createWebHashHistory`（`#/path`），部署时无需服务端配置 fallback。

### 2. 动态路由

所有角色页面由 [`asyncRoutes.ts`](src/router/asyncRoutes.ts) 定义，守卫中按角色过滤后**动态注册**。
未匹配角色权限的路由**前端根本不可见**（配合后端 403 双重防护）。

### 3. API 层规范

- 所有调用用 `ApiResponse<T>` 包裹，拦截器自动解包。
- 分页统一 `PageQuery`（`pageNum`/`pageSize`）+ `PageResult<T>`。
- **401 自动清 Token 跳登录页**；Blob 响应（文件下载）不做业务错误拦截。

### 4. 题型（[`types/common.ts`](src/types/common.ts)）

```ts
type QuestionType = 'SINGLE' | 'MULTIPLE' | 'JUDGE' | 'FILL_HINT' | 'READING'
```

| 类型 | 前端口径 |
|---|---|
| `SINGLE` | 单选题 |
| `MULTIPLE` | 多选题（后端存 `MULTIPLE`，**不是 `MULTI`**） |
| `JUDGE` | 判断题：答案 `TRUE`/`FALSE`；**选项/结果中文一律走 [`dict.ts`](src/api/dict.ts) 字典**：选项 `对`/`错`，结果 `正确`/`答错` |
| `FILL_HINT` | 带括号提示的填空题（如 "My father ___ (get) up"）；`FILL` → `FILL_HINT` 已统一 |
| `READING` | 阅读理解单选题（绑定 `passageId`） |

### 5. 考试流程三段式

```text
startExam → 获得 examId
getExamQuestions → 渲染答题界面
答题中 saveAnswer 逐题保存（支持断点续考）
submitExam → 自动批改 → 返回成绩
```

### 6. 学生多维度统计（`Stats.vue`）

- `GET /api/students/{id}/statistics?include=basic,exam,practice,wrong,category,difficulty,tag,training`
  —— `include` 按需加载（逗号分隔），学生仅能看自己。
- `GET /api/students/exams/{examId}/dimension-analysis` —— 按考点标签 / 语法大类 / 难度 / 题型的对错分布，
  用于成绩详情页柱状图。

### 7. 考点标签与试卷标签

- 题目可关联多个考点标签（多对多）；`TagController` 提供 `/api/tags/questions`、`/api/tags/papers`。
- 试卷标签类型：`USAGE`（用途）/`SCOPE`（范围）/`LEVEL`（难度）/`OTHER`，支持自定义颜色。
- 学生统计按标签聚合薄弱考点 Top 20（前端展示 Top 15）。

### 8. 判断题数据一致性（历史教训）

判断题**不得有选项数据**（论文口径）。历史上"重复执行未修正的出题脚本"会把非法判断题数据重新写回库。
前端展示一律走字典，**不得自行拼接"对/错"**。

---

## 十三、测试

详细测试说明见 [`TESTING.md`](TESTING.md)。测试目录：

| 目录 / 文件 | 类型 |
|---|---|
| `tests/unit/*.spec.ts` | Vitest 单测（ExamList、markdown、StudyGroups、StudyNotes 等） |
| `tests/student.test.ts`、`tests/admin.test.ts` | 学生端 / 管理端测试 |
| `tests/api/frontend-urls.test.ts` | 前端 URL 契约测试 |
| `tests/e2e/student-interactions.test.ts` | Playwright E2E（需后端 9001） |

```bash
npm run build -- unit              # 只跑单测层
npm run build -- --with-e2e        # 含 E2E（需后端已启动）
npx playwright test                # 直接跑 E2E
```

---

## 十四、常见操作

### 只用前端开发（后端未启动）

大部分页面在 API 失败时不崩溃；可用浏览器 DevTools 拦截并 mock 响应。

### 修改后端地址

编辑 [`vite.config.ts`](vite.config.ts) 的 `server.proxy['/api'].target`。

### 添加新页面

1. 在 `src/views/` 下创建 Vue 组件
2. 在 [`src/router/asyncRoutes.ts`](src/router/asyncRoutes.ts) 注册路由（设 `meta.roles`）
3. 在 `src/api/` 对应文件加请求函数
4. 在 `src/types/` 加类型定义
5. **提交前跑 `npm run build`**（6 层门禁必须全绿）

---

## 十五、文档索引

> 全部文档根目录：[`../docs/00-归档总索引.md`](../docs/00-归档总索引.md)

### 权威母本

- [`../docs/01-权威母本/README.md`](../docs/01-权威母本/README.md)
- [`01-论文功能基线.md`](../docs/01-权威母本/01-论文功能基线.md) —— 验收清单
- [`11-前后端API对齐检查报告.md`](../docs/01-权威母本/11-前后端API对齐检查报告.md)
- [`审计/前端审计.md`](../docs/01-权威母本/审计/前端审计.md)
- [`审计/前端公开接口白名单.md`](../docs/01-权威母本/审计/前端公开接口白名单.md)

### 论文与交付物

- [`../docs/01-权威母本/论文全文.md`](../docs/01-权威母本/论文全文.md)
- [`../docs/02-交付物/论文文档/任务书.md`](../docs/02-交付物/论文文档/任务书.md)
- [`../docs/02-交付物/论文文档/系统功能与流程梳理-学生端与管理端.md`](../docs/02-交付物/论文文档/系统功能与流程梳理-学生端与管理端.md)

### 历史资料（2026 年 7 月，早期前端文档）

- [`../docs/07-历史资料-2026年7月/719工作日志/前端交接-给架构师-20260719.md`](../docs/07-历史资料-2026年7月/719工作日志/前端交接-给架构师-20260719.md)
- [`../docs/07-历史资料-2026年7月/719工作日志/前端交接-给后端-20260719.md`](../docs/07-历史资料-2026年7月/719工作日志/前端交接-给后端-20260719.md)
- [`../docs/07-历史资料-2026年7月/前端已完成清单.md`](../docs/07-历史资料-2026年7月/前端已完成清单.md)
- [`../docs/07-历史资料-2026年7月/前后端对齐清单.md`](../docs/07-历史资料-2026年7月/前后端对齐清单.md)

---

## 十六、待办事项

- [x] 清理残留垃圾文件 `DGramEvalgrameval-javaapp.log`（文件名是路径被错误拼接，2026-10-16 已删除）
- [x] 清理 `scripts/lint-vue.report.json`（每次运行 `lint-vue.mjs` 自动再生，2026-10-16 已删除）
- [x] **浏览器覆盖补齐**（论文表 5.12 要求 Chrome/Edge/Firefox）：Chrome 历史截图 + Firefox 人工测试通过 + **Edge 人工测试通过**（2026-10-18，母本 E10）；Playwright 自动化仅 chromium（可选补 firefox/Edge 项目）
- [ ] 前端产物目录 `dist/`、测试产物不入库（`playwright-report/`、`test-results/` 建议显式加进 `.gitignore`）
- [ ] 按需补充 E2E 场景覆盖（当前 E2E 为学生端交互为主）

---

**项目版本**：0.0.0（随论文交付版本 1.0.0）
**最后更新**：2026-10-18（技术栈实测对齐：Vue 3.5.39 / Node 26.5.0；记录浏览器覆盖与论文定稿冻结）
**开发团队**：GramEval Team
