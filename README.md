# GramEval Web — 英语语法专项在线考试系统（前端）

基于 Vue 3 + TypeScript + Vite + Element-Plus 构建的英语语法专项考试系统前端。

## 技术栈

| 层级 | 组件 | 版本 |
|---|---|---|
| 框架 | Vue 3 (Composition API + `<script setup>`) | ^3.5 |
| 构建 | Vite | ^8.1 |
| 语言 | TypeScript | ~6.0 |
| UI 组件库 | Element-Plus | ^2.14 |
| 图标 | @element-plus/icons-vue | ^2.3 |
| HTTP | Axios | ^1.18 |
| 状态管理 | Pinia | ^4.0 |
| 路由 | Vue Router | ^4.6 |
| 图表 | ECharts + vue-echarts | ^6.1 / ^8.0 |
| 日期 | dayjs | ^1.11 |
| CSS | SCSS (Sass) | ^1.101 |

## 启动

### 前置条件

- Node.js 18+
- 后端服务已启动（默认 `http://localhost:9001`）

### 开发

```bash
cd grameval-web
npm install
npm run dev
```

Vite 默认启动在 `http://localhost:5173`，API 代理配置在 `vite.config.js` 中，将所有 `/api` 请求代理到后端。

### 构建

```bash
npm run build
# 产物在 dist/
```

## 项目目录结构

```
grameval-web/
├── index.html
├── vite.config.js
├── package.json
├── tsconfig.json
├── src/
│   ├── main.ts                      # 入口：挂载 App + Pinia + Router
│   ├── App.vue                      # 根组件（仅含 <router-view>）
│   ├── api/                         # API 请求封装（按领域分文件）
│   │   ├── request.ts               # Axios 实例（拦截器：Token 携带 + 401 跳转）
│   │   ├── auth.ts                  # 登录 / 注册 / me / 改密
│   │   ├── student.ts               # 学生端：分类 / 题库 / 练习 / 考试 / 成绩 / 统计
│   │   ├── admin.ts                 # 管理端：用户 / 分类 / 题目 / 试卷 / 场次 / 成绩 / 日志
│   │   ├── user.ts                  # 用户公共：个人资料修改
│   │   ├── ai.ts                    # AI 出题：学生分析 / 生成预览 / 确认入库
│   │   └── dict.ts                  # 字典：题型 / 难度 / 角色 / 状态等常量
│   ├── router/
│   │   ├── index.ts                 # 路由实例 + 守卫（JWT 校验 + 动态路由生成）
│   │   └── asyncRoutes.ts           # 按角色注册的动态路由
│   ├── stores/
│   │   ├── auth.ts                  # 认证 Store：token / role / userInfo / login / logout
│   │   ├── app.ts                   # 全局 UI Store：sidebar 折叠
│   │   ├── permission.ts            # 权限 Store：按角色 generateRoutes
│   │   ├── dict.ts                  # 字典 Store：一次性拉取下拉框常量
│   │   └── tags.ts                  # 标签 Store：考点标签 + 试卷标签缓存
│   ├── views/
│   │   ├── login/index.vue          # 登录页（/login, /login/student, /login/admin）
│   │   ├── register/index.vue       # 注册页
│   │   ├── layout/                  # 主布局
│   │   │   ├── index.vue            # 侧边栏 + 顶栏 + <router-view>
│   │   │   └── components/
│   │   │       ├── Sidebar.vue      # 侧边导航（从权限路由自动生成）
│   │   │       └── Header.vue       # 顶栏（用户信息 + 退出）
│   │   ├── student/                 # 学生端
│   │   │   ├── Home.vue             # 首页（汇总卡片 + 快捷入口 + 可用考试）
│   │   │   ├── QuestionBank.vue     # 语法题库（分类筛选 + 分页浏览 + 学习模式）
│   │   │   ├── Practice.vue         # 专项练习（选分类 + 随机 10 题 + 即时反馈）
│   │   │   ├── ExamList.vue         # 考试列表（可参加的考试场次）
│   │   │   ├── ExamRoom.vue         # 在线考试（计时 + 答题 + 题号导航 + 交卷）
│   │   │   ├── MyResults.vue        # 我的成绩（汇总卡 + 分页列表）
│   │   │   ├── ResultDetail.vue     # 成绩详情（逐题明细 + 多维度分析图表）
│   │   │   ├── WrongBook.vue        # 错题本（分类筛选 + 分页 + 标记已掌握）
│   │   │   ├── Stats.vue            # 学习数据（多维度统计 + 雷达/柱状图）
│   │   │   └── Profile.vue          # 个人资料（查看 + 修改密码）
│   │   ├── admin/                   # 管理端（教师/管理员）
│   │   │   ├── Dashboard/index.vue  # 工作台（统计卡片 + 近 7 日趋势图）
│   │   │   ├── UserManage.vue       # 用户管理（CRUD + 角色过滤 + 密码重置）
│   │   │   ├── MyStudents.vue       # 我的学生（绑定/解绑学生）
│   │   │   ├── CategoryManage.vue   # 语法分类（树形 CRUD）
│   │   │   ├── QuestionManage.vue   # 试题管理（CRUD + CSV导入导出 + 批量操作）
│   │   │   ├── QuestionAnalytics.vue # 题目质量分析
│   │   │   ├── PaperManage.vue      # 试卷管理（CRUD + 组卷）
│   │   │   ├── AiCompose.vue        # AI 智能出题（学生分析 → 参数 → 预览 → 入库）
│   │   │   ├── ExamManage.vue       # 考试场次管理（CRUD + 学生指派）
│   │   │   ├── ExamMonitor.vue      # 考试实时监控（15s 轮询）
│   │   │   ├── ExamStatistics.vue   # 场次统计（成绩分布 + 题目正确率）
│   │   │   ├── ResultManage.vue     # 成绩管理（多条件查询 + CSV 导出）
│   │   │   ├── OperationLogs.vue    # 操作日志
│   │   │   └── Profile.vue          # 个人资料
│   │   ├── error/404.vue            # 404 页面
│   │   └── redirect/index.vue       # 重定向中转页
│   ├── components/                  # 通用组件
│   │   ├── AnswerSheet.vue          # 答题卡组件（题号导航面板）
│   │   ├── Countdown.vue            # 倒计时组件（考试计时器 HH:MM:SS）
│   │   └── SearchBar.vue            # 搜索栏组件
│   ├── types/                       # TypeScript 类型（对齐后端 VO/DTO）
│   │   ├── common.ts                # ApiResponse / PageResult / QuestionType / Role
│   │   ├── category.ts              # Category / CategoryForm
│   │   ├── question.ts              # Question / PracticeRecord / etc.
│   │   ├── exam.ts                  # ExamSession / ExamRecord / AnswerDetail / etc.
│   │   ├── result.ts                # ResultSummary / ResultDetail / WrongBookItem
│   │   ├── paper.ts                 # Paper / PaperForm
│   │   ├── stats.ts                 # StudentStatistics / DimensionAnalysis（新增）
│   │   ├── ai.ts                    # StudentAnalysis / GeneratePaperPreview / etc.
│   │   ├── admin.ts                 # AdminDashboardData / ExamMonitor / etc.
│   │   ├── user.ts                  # UserDetail / UserCreateForm
│   │   └── axios.d.ts               # Axios 类型声明
│   ├── utils/
│   │   └── request.ts               # Axios 封装（见 api/request.ts）
│   └── styles/
│       ├── index.scss               # 全局样式入口
│       └── variables.scss           # SCSS 变量（主色 / 侧边栏 / 边框等）
```

## 路由设计

### 路由守卫流程

```
beforeEach:
  1. 白名单路径（/login, /register）→ 直接放行
  2. 已登录 + 在白名单 → 跳到角色首页
  3. 无 Token → 重定向 /login
  4. 有 Token 但无 role → 清除状态重新登录
  5. 有 role 但未生成动态路由 → generateRoutes(role) + 注册到 Router
  6. 路径为 / → 重定向到该角色默认首页
  7. 正常放行
```

### 路由汇总

| 角色 | 页面 | 路径 | 说明 |
|---|---|---|---|
| 公开 | 登录 | `/login` `/login/:role` | 支持预选角色入口 |
| 公开 | 注册 | `/register` | 学生注册 |
| 学生 | 首页 | `/student/home` | 汇总 + 快捷入口 |
| 学生 | 语法题库 | `/student/question-bank` | 分类浏览 + 学习模式 |
| 学生 | 专项练习 | `/student/practice` | 随机 10 题训练 |
| 学生 | 考试列表 | `/student/exams` | 可参加的考试 |
| 学生 | 在线考试 | `/student/exam-room/:examId` | **核心** 答题界面 |
| 学生 | 我的成绩 | `/student/results` | 成绩列表 |
| 学生 | 成绩详情 | `/student/results/:id` | 逐题明细 + 维度分析 |
| 学生 | 错题本 | `/student/wrong-book` | 错题复习 |
| 学生 | 学习数据 | `/student/stats` | **新增** 多维度统计 |
| 学生 | 个人资料 | `/student/profile` | 查看 + 改密 |
| 管理 | 工作台 | `/dashboard` | 统计概览 |
| 管理 | 用户管理 | `/admin/users` | CRUD |
| 管理 | 我的学生 | `/admin/my-students` | 学生绑定 |
| 管理 | 语法分类 | `/admin/categories` | 树形管理 |
| 管理 | 试题管理 | `/admin/questions` | CRUD + 导入导出 |
| 管理 | 题目分析 | `/admin/questions/analytics` | 质量分析图表 |
| 管理 | 试卷管理 | `/admin/papers` | CRUD + 组卷 |
| 管理 | 智能出题 | `/admin/ai-compose` | AI 分析 + 出题 |
| 管理 | 考试管理 | `/admin/exams` | 场次 CRUD |
| 管理 | 考试监控 | `/admin/exams/:id/monitor` | 实时监控 |
| 管理 | 场次统计 | `/admin/exams/:id/statistics` | 统计报告 |
| 管理 | 成绩管理 | `/admin/results` | 查询 + CSV 导出 |
| 管理 | 操作日志 | `/admin/operation-logs` | 审计日志 |
| 管理 | 个人资料 | `/admin/profile` | 查看 + 改密 |

## API 对接一览

### 学生端 API（`api/student.ts`）

| 函数 | 方法 | 路径 | 说明 |
|---|---|---|---|
| `listCategories` | GET | `/api/categories` | 语法分类列表 |
| `getCategoryTree` | GET | `/api/categories/tree` | 分类树（含题目数量） |
| `listQuestions` | GET | `/api/questions` | 题库分页 |
| `getQuestionDetail` | GET | `/api/questions/{id}` | 题目详情 |
| `getQuestionStudyMode` | GET | `/api/questions/{id}/study-mode` | 学习模式（含解析） |
| `getPracticeQuestions` | GET | `/api/practices/questions` | 随机取题 |
| `startPractice` | POST | `/api/practices/start/{id}` | 开始练习 |
| `answerInPractice` | POST | `/api/practices/{id}/answers` | 提交练习答案 |
| `finishPractice` | POST | `/api/practices/{id}/finish` | 结束练习 |
| `getAvailableExams` | GET | `/api/exams/available` | 可参加的考试 |
| `startExam` | POST | `/api/exams/start/{id}` | 开始考试（幂等） |
| `getExamQuestions` | GET | `/api/exams/{id}/questions` | 加载试卷题目 |
| `saveAnswer` | POST | `/api/exams/{id}/answers` | 保存单题答案 |
| `submitExam` | POST | `/api/exams/{id}/submit` | 提交考试（幂等） |
| `resumeExam` | POST | `/api/exams/{id}/resume` | 断点续考 |
| `getMySummary` | GET | `/api/results/my-summary` | 成绩汇总 |
| `getMyResults` | GET | `/api/results/my-list` | 成绩分页 |
| `getResultDetail` | GET | `/api/results/{id}/detail` | 成绩明细 |
| `getWrongBook` | GET | `/api/results/wrong-book` | 错题本分页 |
| `getStudentStatistics` | GET | `/api/students/{id}/statistics` | **新增** 个人多维度统计 |
| `getDimensionAnalysis` | GET | `/api/students/exams/{id}/dimension-analysis` | **新增** 单场考试维度分析 |
| `getTrainingSchedule` | GET | `/api/students/{id}/training-schedule` | **新增** 训练时间查询 |
| `updateTrainingSchedule` | PUT | `/api/students/{id}/training-schedule` | **新增** 训练时间修改 |

### 管理端 API（`api/admin.ts`）

| 函数 | 方法 | 路径 | 说明 |
|---|---|---|---|
| `listUsers` / `createUser` / `updateUser` / `deleteUser` | CRUD | `/api/users` | 用户管理 |
| `resetUserPassword` | PUT | `/api/users/{id}/password/reset` | 密码重置 |
| `listCategoryTree` / `createCategory` / `updateCategory` / `deleteCategory` | CRUD | `/api/categories` | 分类管理 |
| `listAdminQuestions` / `createQuestion` / `updateQuestion` / `deleteQuestion` | CRUD | `/api/questions` | 题目管理 |
| `batchStatusQuestions` / `batchDeleteQuestions` | POST | `/api/questions/batch-*` | 批量操作 |
| `downloadImportTemplate` / `importQuestions` | GET/POST | `/api/questions/import/*` | CSV 导入导出 |
| `listPapers` / `createPaper` / `updatePaper` / `deletePaper` | CRUD | `/api/papers` | 试卷管理 |
| `listSessions` / `createSession` / `updateSession` / `deleteSession` | CRUD | `/api/sessions` | 场次管理 |
| `getDashboard` | GET | `/api/admin/dashboard` | 管理台数据 |
| `listExamStudents` / `assignExamStudents` | GET/PUT | `/api/admin/exams/{id}/students` | 学生指派 |
| `forceSubmit` | POST | `/api/admin/exams/{id}/force-submit` | 强制收卷 |
| `getExamMonitor` | GET | `/api/admin/exams/{id}/monitor` | 实时监控 |
| `getSessionStatistics` | GET | `/api/admin/exams/{id}/statistics` | 场次统计 |
| `getQuestionAnalytics` | GET | `/api/admin/questions/analytics` | 题目分析 |
| `listAdminResults` / `exportResults` | GET | `/api/admin/results` | 成绩查询/导出 |
| `listOperationLogs` | GET | `/api/admin/operation-logs` | 操作日志 |
| `listMyStudents` / `bindMyStudents` | GET/PUT | `/api/admin/my-students` | 我的学生 |

### AI 出题 API（`api/ai.ts`）

| 函数 | 方法 | 路径 | 说明 |
|---|---|---|---|
| `analyzeStudent` | POST | `/api/admin/ai/analyze-student` | 分析学生历史 |
| `generatePreview` | POST | `/api/admin/ai/generate-paper/preview` | 生成预览 |
| `confirmPaper` | POST | `/api/admin/ai/generate-paper/confirm` | 确认入库 |
| `listGenerationLogs` / `getGenerationLog` | GET | `/api/admin/ai/generation-logs` | 出题日志 |

## 状态管理（Pinia）

### authStore (`stores/auth.ts`)
- **字段**：`token`, `role`, `userInfo`（id / username / displayName）
- **getter**：`isLoggedIn`, `homePath`（按角色映射首页路径）
- **action**：`login(form)`, `logout()`, `fetchUserInfo()`

### permissionStore (`stores/permission.ts`)
- **字段**：`routes`, `generated`
- **action**：`generateRoutes(role)` — 根据角色过滤 `asyncRoutes`，返回可访问路由列表

### appStore (`stores/app.ts`)
- **字段**：`sidebarCollapsed`
- **action**：`toggleSidebar()`

### dictStore (`stores/dict.ts`)
- **字段**：`dictMap`
- **action**：`load()` — 调用 `/api/dict` 一次性拉取所有下拉框常量

### tagsStore (`stores/tags.ts`)
- **字段**：`questionTags`, `paperTags`
- **action**：`loadQuestionTags()`, `loadPaperTags()` — 缓存标签数据

## 关键设计决策

### 1. 路由模式
使用 `createWebHashHistory`（`#/path`），避免部署时需要服务端配置 fallback。

### 2. 动态路由
所有角色对应页面通过 `asyncRoutes` 定义，路由守卫中按角色过滤后动态注册。未匹配角色权限的路由完全不可见。

### 3. API 层规范
- 所有 API 调用使用 `ApiResponse<T>` 包裹，拦截器自动解包。
- 分页统一使用 `PageQuery`（`pageNum` / `pageSize`）和 `PageResult<T>`。
- 401 错误自动清除 Token 并跳转登录页。
- Blob 响应（文件下载）不做业务错误拦截。

### 4. 试题类型
```typescript
type QuestionType = 'SINGLE' | 'MULTIPLE' | 'JUDGE' | 'FILL_HINT' | 'READING'
```
- `SINGLE`: 单选题
- `MULTIPLE`: 多选题（后端存储为 `MULTIPLE`，不是 `MULTI`）
- `JUDGE`: 判断题（答案 TRUE / FALSE）
- `FILL_HINT`: 带括号提示的填空题（如 "My father ___ (get) up"）
- `READING`: 阅读理解单选题（绑定 `passageId`）

### 5. 考试流程三段式
1. `startExam` 开始 → 获得 `examId`
2. `getExamQuestions` 加载试卷 → 渲染答题界面
3. 答题中 `saveAnswer` 逐题保存（断点续答支持）
4. `submitExam` 提交 → 自动批改 → 返回成绩

### 6. 学生统计（新增）
- **个人多维度统计**：`GET /api/students/{id}/statistics?include=basic,exam,practice,wrong,category,difficulty,tag,training`
  - `include` 参数按需加载，逗号分隔模块
  - 学生仅能查看自己的数据
- **单场考试维度分析**：`GET /api/students/exams/{examId}/dimension-analysis`
  - 返回按考点标签 / 语法大类 / 难度 / 题型的对错分布
  - 用于成绩详情页的柱状图

### 7. 考点标签系统（新增）
- 每道题可关联多个考点标签（`question_tag_relation` 多对多）
- `TagController` 提供标签 CRUD（`/api/tags/questions` 和 `/api/tags/papers`）
- 学生统计中按标签聚合展示薄弱考点 Top 20

### 8. 试卷标签系统（新增）
- 试卷标签支持三种类型：`USAGE`（用途）、`SCOPE`（范围）、`LEVEL`（难度）、`OTHER`（其他）
- 标签支持自定义颜色

## 页面与后端 API 依赖矩阵

| 页面 | 依赖的 API |
|---|---|
| `LoginView` | `POST /api/auth/login` |
| `RegisterView` | `POST /api/auth/register` |
| `Home.vue` | `GET /api/results/my-summary`, `GET /api/exams/available` |
| `QuestionBank.vue` | `GET /api/categories`, `GET /api/questions`, `GET /api/questions/{id}/study-mode` |
| `Practice.vue` | `GET /api/practices/questions`, `POST /api/practice/submit` |
| `ExamList.vue` | `GET /api/exams/available` |
| `ExamRoom.vue` | `POST /api/exams/start`, `GET /api/exams/{id}/questions`, `POST /api/exams/{id}/answers`, `POST /api/exams/{id}/submit` |
| `MyResults.vue` | `GET /api/results/my-summary`, `GET /api/results/my-list` |
| `ResultDetail.vue` | `GET /api/results/{id}/detail`, `GET /api/students/exams/{id}/dimension-analysis` |
| `WrongBook.vue` | `GET /api/results/wrong-book` |
| `Stats.vue` | `GET /api/students/{id}/statistics`, `GET /api/students/{id}/training-schedule` |
| `Profile.vue` | `GET/PUT /api/users/{id}` |
| `Dashboard` | `GET /api/admin/dashboard` |
| `UserManage` | `GET/POST/PUT/DELETE /api/users` |
| `CategoryManage` | `GET/POST/PUT/DELETE /api/categories` |
| `QuestionManage` | `GET/POST/PUT/DELETE /api/questions`, `GET/POST /api/questions/import/*` |
| `AiCompose` | `POST /api/admin/ai/analyze-student`, `POST /api/admin/ai/generate-paper/*` |
| `PaperManage` | `GET/POST/PUT/DELETE /api/papers` |
| `ExamManage` | `GET/POST/PUT/DELETE /api/sessions` |
| `ExamMonitor` | `GET /api/admin/exams/{id}/monitor` |
| `ExamStatistics` | `GET /api/admin/exams/{id}/statistics` |
| `ResultManage` | `GET /api/admin/results`, `GET /api/admin/results/export` |

## 后端配置

前端通过 Vite 代理转发 API 请求到后端（`vite.config.js`）：

```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:9001',
      changeOrigin: true,
    },
  },
},
```

后端默认端口：`9005`（`application.yml` 中 `server.port: 9005`）。

## 新增功能（最近更新）

### 1. 学生个人多维度统计 (`Stats.vue`)
- 基本信息卡片（姓名、头像、性别、邮箱、上次登录）
- 考试统计卡片（次数、正确率、平均/最高/最低分、对错题数）
- 专项练习统计卡片（次数、累计题数、对错数、正确率）
- 去重错题总数
- 按语法大类正确率柱状图（薄弱分类在左侧）
- 按难度正确率柱状图
- 按考点标签弱点排行（Top 15 水平柱状图 + 详细表格）
- 训练计划信息（训练日、时段、每日题数、已训练/剩余天数）
- 支持模块切换（全部 / 考试+练习 / 考点弱点 / 语法大类 / 难度）

### 2. 成绩详情页维度分析增强 (`ResultDetail.vue`)
- 逐题明细下方新增多维度分析区域
- 按语法大类正确率柱状图
- 按难度正确率柱状图
- 按考点标签正确率柱状图
- 按题型对错统计表格（含进度条）

### 3. 题型完善
- `FILL` → `FILL_HINT`：填空题类型名统一，支持题干中的括号提示写法
- 后端 Dict 接口新增 `FILL_HINT` 和 `READING` 题型条目

### 4. 考点标签系统
- 题目支持多考点标签关联
- 统计接口可按考点标签维度聚合错题分布

### 5. 试卷标签系统
- 试卷支持用途/范围/难度等分类标签
- 标签支持自定义颜色

## 测试账号

| 账号 | 密码 | 角色 |
|---|---|---|
| `admin` | `123456` | ADMIN（系统管理员） |
| `student01` | `123456` | STUDENT（演示学生） |

## 常见操作

### 快速启动完整环境
```bash
# 终端 1：后端
cd grameval-java && mvn spring-boot:run

# 终端 2：前端
cd grameval-web && npm run dev
```

### 仅前端开发（无需后端）
- 大部分页面在 API 调用失败时不会崩溃
- 可使用浏览器 DevTools 拦截并 mock 响应

### 修改后端地址
编辑 `vite.config.js`，修改 proxy target。

### 添加新页面
1. 在 `src/views/` 下创建 Vue 组件
2. 在 `src/router/asyncRoutes.ts` 中注册路由（设置 `meta.roles`）
3. 如需 API 调用，在 `src/api/` 对应文件中添加函数
4. 如需类型定义，在 `src/types/` 中添加接口
