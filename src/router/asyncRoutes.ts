import type { RouteRecordRaw } from 'vue-router'

/**
 * 动态路由 —— 按 meta.roles 过滤后挂到 Layout 下。
 * hidden: true 的路由不会出现在侧边栏。
 * disabled: true 的路由不注册、不进菜单、直达 URL 也被守卫拦截（见 router/index.ts）。
 */

/**
 * 已禁用模块（2026-09-26 用户拍板）
 *
 * 这些模块的菜单与路由全部下线，直接输入 URL 也进不去；后端接口保留不删（可随时恢复）。
 * 禁用原因：不属于学生端/管理端主流程，答辩演示不涉及。
 *   · 学生端主流程：语法题库 → 专项练习 → 在线考试 → 查看考试 → 查看成绩
 *   · 管理端主流程：出题 → 生成试卷 → 下发班级组织考试 → 系统配置
 *
 * 恢复方式：删掉对应路由的 `disabled: true`，并从 DISABLED_PATHS 中移除该路径。
 */
export const DISABLED_PATHS = [
  '/student/leaderboard',
  '/student/weekly-report',
  // [2026-09-26 恢复] 试卷模板：论文 L1262 点名「组卷模块可加入随机抽题、专题比例、难度比例和分值约束，
  //   提高组卷效率」→ 恢复入口（06 清单 §8.3 O 档）。原禁用行保留备查：
  //   '/admin/paper-templates',
  '/admin/answer-cards',
  '/admin/exam-monitor-log',
  '/admin/exam-comments',
  '/admin/workflow',
]

export const asyncRoutes: RouteRecordRaw[] = [
  /* ============================================================
   *  学生端
   * ============================================================ */
  {
    path: 'student/home',
    name: 'StudentHome',
    component: () => import('@/views/student/Home.vue'),
    meta: { title: '首页', icon: 'HomeFilled', roles: ['STUDENT'] },
  },
  {
    path: 'student/question-bank',
    name: 'QuestionBank',
    component: () => import('@/views/student/QuestionBank.vue'),
    meta: { title: '语法题库', icon: 'Notebook', roles: ['STUDENT'], group: '学习中心' },
  },
  {
    path: 'student/practice',
    name: 'Practice',
    component: () => import('@/views/student/Practice.vue'),
    meta: { title: '专项练习', icon: 'EditPen', roles: ['STUDENT'], group: '学习中心' },
  },
  {
    path: 'student/wrong-book',
    name: 'WrongBook',
    component: () => import('@/views/student/WrongBook.vue'),
    meta: { title: '错题本', icon: 'CircleClose', roles: ['STUDENT'], group: '学习中心' },
  },
  {
    path: 'student/exams',
    name: 'ExamList',
    component: () => import('@/views/student/ExamList.vue'),
    meta: { title: '在线考试', icon: 'Document', roles: ['STUDENT'], group: '考试中心' },
  },
  {
    path: 'student/results',
    name: 'MyResults',
    component: () => import('@/views/student/MyResults.vue'),
    meta: { title: '我的成绩', icon: 'Trophy', roles: ['STUDENT'], group: '考试中心' },
  },
  {
    path: 'student/knowledge-mastery',
    name: 'KnowledgeMastery',
    component: () => import('@/views/student/KnowledgeMastery.vue'),
    meta: { title: '知识点掌握度', icon: 'TrendCharts', roles: ['STUDENT'], group: '学习中心' },
  },
  {
    path: 'student/stats',
    name: 'StudentStats',
    component: () => import('@/views/student/Stats.vue'),
    meta: { title: '学习分析', icon: 'TrendCharts', roles: ['STUDENT'] },
  },
  {
    path: 'student/score-curve',
    name: 'ScoreCurve',
    component: () => import('@/views/student/ScoreCurve.vue'),
    meta: { title: '成绩趋势', icon: 'TrendCharts', roles: ['STUDENT'], group: '考试中心' },
  },
  {
    // 【已禁用】学生排行榜 —— 非主流程
    path: 'student/leaderboard',
    name: 'Leaderboard',
    component: () => import('@/views/student/Leaderboard.vue'),
    meta: { title: '学生排行榜', icon: 'Trophy', roles: ['STUDENT'], disabled: true },
  },
  {
    // 【已禁用】学习周报 —— 非主流程
    path: 'student/weekly-report',
    name: 'WeeklyReport',
    component: () => import('@/views/student/WeeklyReport.vue'),
    meta: { title: '学习周报', icon: 'Calendar', roles: ['STUDENT'], disabled: true },
  },
  // hidden routes
  { path: 'student/exam-room/:examId', name: 'ExamRoom', component: () => import('@/views/student/ExamRoom.vue'), meta: { title: '考试中', roles: ['STUDENT'], hidden: true } },
  { path: 'student/results/:id', name: 'ResultDetail', component: () => import('@/views/student/ResultDetail.vue'), meta: { title: '成绩详情', roles: ['STUDENT'], hidden: true } },
  { path: 'student/messages', name: 'StudentMessages', component: () => import('@/views/common/MessageCenter.vue'), meta: { title: '消息中心', roles: ['STUDENT'], hidden: true } },
  // 个人资料从侧边栏移除，从顶部头像下拉进入
  { path: 'student/profile', name: 'StudentProfile', component: () => import('@/views/student/Profile.vue'), meta: { title: '个人资料', roles: ['STUDENT'], hidden: true } },

  /* ============================================================
   *  管理端
   * ============================================================ */
  {
    path: 'dashboard',
    name: 'Dashboard',
    component: () => import('@/views/dashboard/index.vue'),
    meta: { title: '工作台', icon: 'HomeFilled', roles: ['ADMIN'] },
  },

  // 题库管理（2026-10-30 重排：语法分类 → 试题管理 → 题目分析 → 智能出题）
  //   顺序依据用户要求：先建分类，再管题目，然后看分析，最后才是 AI 出题。
  {
    path: 'admin/categories',
    name: 'AdminCategories',
    component: () => import('@/views/admin/CategoryManage.vue'),
    meta: { title: '语法分类', icon: 'Menu', roles: ['ADMIN'], group: '题库管理' },
  },
  {
    path: 'admin/questions',
    name: 'AdminQuestions',
    component: () => import('@/views/admin/QuestionManage.vue'),
    meta: { title: '试题管理', icon: 'Notebook', roles: ['ADMIN'], group: '题库管理' },
  },
  {
    path: 'admin/questions/analytics',
    name: 'AdminQuestionAnalytics',
    component: () => import('@/views/admin/QuestionAnalytics.vue'),
    meta: { title: '题目分析', icon: 'TrendCharts', roles: ['ADMIN'], group: '题库管理' },
  },
  {
    path: 'admin/ai-compose',
    name: 'AdminAiCompose',
    component: () => import('@/views/admin/AiCompose.vue'),
    meta: { title: '智能出题', icon: 'MagicStick', roles: ['ADMIN'], group: '题库管理' },
  },
  {
    // [2026-10-30 合入试题管理] 阅读文章库不再是独立菜单项：
    //   入口改为「试题管理 → 阅读文章」页签（QuestionManage 内嵌 ReadingPassageManage）。
    //   路由保留并 hidden，保证书签 / 直达 URL 仍可用，也避免旧链接 404。
    path: 'admin/reading-passages',
    name: 'AdminReadingPassages',
    component: () => import('@/views/admin/ReadingPassageManage.vue'),
    meta: { title: '阅读文章库', icon: 'Reading', roles: ['ADMIN'], group: '题库管理', hidden: true },
  },
  // 考试管理（出题流程第二步：试卷管理→考试管理→成绩管理）
  {
    // [2026-09-26 恢复] 试卷模板 —— 论文 L1262 点名「组卷模块可加入随机抽题、专题比例、难度比例和分值约束」
    //   原状态（保留备查）：meta 中曾含 disabled: true
    path: 'admin/paper-templates',
    name: 'AdminPaperTemplates',
    component: () => import('@/views/admin/PaperTemplateManage.vue'),
    meta: { title: '试卷模板', icon: 'Tickets', roles: ['ADMIN'], group: '考试管理' },
  },
  {
    path: 'admin/papers',
    name: 'AdminPapers',
    component: () => import('@/views/admin/PaperManage.vue'),
    meta: { title: '试卷管理', icon: 'Files', roles: ['ADMIN'], group: '考试管理' },
  },
  {
    // 【已禁用】答题卡配置 —— 非主流程
    path: 'admin/answer-cards',
    name: 'AdminAnswerCards',
    component: () => import('@/views/admin/AnswerCardConfig.vue'),
    meta: { title: '答题卡配置', icon: 'Postcard', roles: ['ADMIN'], group: '考试管理', disabled: true },
  },
  {
    path: 'admin/exams',
    name: 'AdminExams',
    component: () => import('@/views/admin/ExamManage.vue'),
    meta: { title: '考试管理', icon: 'Calendar', roles: ['ADMIN'], group: '考试管理' },
  },
  {
    path: 'admin/results',
    name: 'AdminResults',
    component: () => import('@/views/admin/ResultManage.vue'),
    meta: { title: '成绩管理', icon: 'DataAnalysis', roles: ['ADMIN'], group: '考试管理' },
  },
  {
    // 【已禁用】考试监控日志 —— 非主流程
    path: 'admin/exam-monitor-log',
    name: 'AdminExamMonitorLog',
    component: () => import('@/views/admin/ExamMonitorLog.vue'),
    meta: { title: '考试监控日志', icon: 'VideoCamera', roles: ['ADMIN'], group: '考试管理', disabled: true },
  },
  {
    // 【已禁用】考试评语 —— 非主流程
    path: 'admin/exam-comments',
    name: 'AdminExamComments',
    component: () => import('@/views/admin/ExamCommentManage.vue'),
    meta: { title: '考试评语', icon: 'ChatDotRound', roles: ['ADMIN'], group: '考试管理', disabled: true },
  },
    // 用户权限
  {
    path: 'admin/users',
    name: 'AdminUsers',
    component: () => import('@/views/admin/UserManage.vue'),
    meta: { title: '用户管理', icon: 'UserFilled', roles: ['ADMIN'], group: '系统管理', superOnly: true },
  },
  {
    // [2026-10-28 调整] 入口收进头像下拉，故 meta 加 hidden —— 侧边栏不渲染，路由仍注册、直达 /admin/my-students 可用
    path: 'admin/my-students',
    name: 'AdminMyStudents',
    component: () => import('@/views/admin/MyStudents.vue'),
    meta: { title: '我的学生', icon: 'Avatar', roles: ['ADMIN'], group: '系统管理', hidden: true },
  },
  // 系统管理
  {
    // [2026-10-28 调整] 入口收进头像下拉，故 meta 加 hidden —— 侧边栏不渲染，路由仍注册、直达 /admin/classes 可用
    path: 'admin/classes',
    name: 'AdminClasses',
    component: () => import('@/views/admin/ClassManage.vue'),
    meta: { title: '班级管理', icon: 'School', roles: ['ADMIN'], group: '系统管理', superOnly: true, hidden: true },
  },
  {
    // 【已禁用】工作流编排 —— 非主流程
    path: 'admin/workflow',
    name: 'AdminWorkflow',
    component: () => import('@/views/admin/WorkflowPanel.vue'),
    meta: { title: '工作流编排', icon: 'Connection', roles: ['ADMIN'], group: '题库管理', disabled: true },
  },
  {
    // [2026-10-28 调整] 入口收进头像下拉，故 meta 加 hidden —— 侧边栏不渲染，路由仍注册、直达 /admin/operation-logs 可用
    path: 'admin/operation-logs',
    name: 'AdminOperationLogs',
    component: () => import('@/views/admin/OperationLogs.vue'),
    meta: { title: '操作日志', icon: 'Document', roles: ['ADMIN'], group: '系统管理', superOnly: true, hidden: true },
  },
  {
    path: 'admin/system-settings',
    name: 'AdminSystemSettings',
    component: () => import('@/views/admin/SystemSettings.vue'),
    meta: { title: '系统设置', icon: 'Setting', roles: ['ADMIN'], group: '系统管理', superOnly: true },
  },
  {
    // [2026-10-17 调整] 系统架构举证页 —— 答辩时回答「用了多少张表 / 什么字段 / 什么技术」。
    //   数据实时来自 information_schema 与 pom.xml/package.json，非硬编码文档。
    //
    //   【唯一入口】按用户要求，入口只保留在「头像下拉 → 退出登录正上方」
    //   （见 layout/components/Header.vue 的 showArchitecture 分支）。
    //   故此处加 hidden: true —— 不在侧边栏渲染菜单，但路由仍注册，
    //   直接访问 /admin/architecture 依然可用（便于收藏与演示）。
    path: 'admin/architecture',
    name: 'AdminArchitecture',
    component: () => import('@/views/admin/SystemArchitecture.vue'),
    meta: { title: '系统架构', icon: 'Coin', roles: ['ADMIN'], hidden: true },
  },
  // hidden routes
  { path: 'admin/exams/:sessionId/monitor', name: 'AdminExamMonitor', component: () => import('@/views/admin/ExamMonitor.vue'), meta: { title: '考试监控', roles: ['ADMIN'], hidden: true } },
  { path: 'admin/exams/:sessionId/statistics', name: 'AdminExamStatistics', component: () => import('@/views/admin/ExamStatistics.vue'), meta: { title: '场次统计', roles: ['ADMIN'], hidden: true } },
  { path: 'admin/messages', name: 'AdminMessages', component: () => import('@/views/common/MessageCenter.vue'), meta: { title: '消息中心', roles: ['ADMIN'], hidden: true } },
  // 个人资料从侧边栏移除，从顶部头像下拉进入
  { path: 'admin/profile', name: 'AdminProfile', component: () => import('@/views/admin/Profile.vue'), meta: { title: '个人资料', roles: ['ADMIN'], hidden: true } },
]
