import type { RouteRecordRaw } from 'vue-router'

/**
 * 动态路由 —— 按 meta.roles 过滤后挂到 Layout 下。
 * hidden: true 的路由不会出现在侧边栏。
 */
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
    path: 'student/stats',
    name: 'StudentStats',
    component: () => import('@/views/student/Stats.vue'),
    meta: { title: '学习数据', icon: 'TrendCharts', roles: ['STUDENT'] },
  },
  {
    path: 'student/leaderboard',
    name: 'Leaderboard',
    component: () => import('@/views/student/Leaderboard.vue'),
    meta: { title: '学生排行榜', icon: 'Trophy', roles: ['STUDENT'] },
  },
  // hidden routes
  { path: 'student/exam-room/:examId', name: 'ExamRoom', component: () => import('@/views/student/ExamRoom.vue'), meta: { title: '考试中', roles: ['STUDENT'], hidden: true } },
  { path: 'student/results/:id', name: 'ResultDetail', component: () => import('@/views/student/ResultDetail.vue'), meta: { title: '成绩详情', roles: ['STUDENT'], hidden: true } },
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

  // 题库管理（出题流程第一步：智能出题→试题管理→语法分类→题目分析）
  {
    path: 'admin/ai-compose',
    name: 'AdminAiCompose',
    component: () => import('@/views/admin/AiCompose.vue'),
    meta: { title: '智能出题', icon: 'MagicStick', roles: ['ADMIN'], group: '题库管理' },
  },
  {
    path: 'admin/questions',
    name: 'AdminQuestions',
    component: () => import('@/views/admin/QuestionManage.vue'),
    meta: { title: '试题管理', icon: 'Notebook', roles: ['ADMIN'], group: '题库管理' },
  },
  {
    path: 'admin/categories',
    name: 'AdminCategories',
    component: () => import('@/views/admin/CategoryManage.vue'),
    meta: { title: '语法分类', icon: 'Menu', roles: ['ADMIN'], group: '题库管理' },
  },
  {
    path: 'admin/questions/analytics',
    name: 'AdminQuestionAnalytics',
    component: () => import('@/views/admin/QuestionAnalytics.vue'),
    meta: { title: '题目分析', icon: 'TrendCharts', roles: ['ADMIN'], group: '题库管理' },
  },
  {
    path: 'admin/reading-passages',
    name: 'AdminReadingPassages',
    component: () => import('@/views/admin/ReadingPassageManage.vue'),
    meta: { title: '阅读文章库', icon: 'Reading', roles: ['ADMIN'], group: '题库管理' },
  },
  // 考试管理（出题流程第二步：试卷管理→考试管理→成绩管理）
  {
    path: 'admin/papers',
    name: 'AdminPapers',
    component: () => import('@/views/admin/PaperManage.vue'),
    meta: { title: '试卷管理', icon: 'Files', roles: ['ADMIN'], group: '考试管理' },
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
    // 用户权限
  {
    path: 'admin/users',
    name: 'AdminUsers',
    component: () => import('@/views/admin/UserManage.vue'),
    meta: { title: '用户管理', icon: 'UserFilled', roles: ['ADMIN'], group: '系统管理' },
  },
  {
    path: 'admin/my-students',
    name: 'AdminMyStudents',
    component: () => import('@/views/admin/MyStudents.vue'),
    meta: { title: '我的学生', icon: 'Avatar', roles: ['ADMIN'], group: '系统管理' },
  },
  // 系统管理
  {
    path: 'admin/workflow',
    name: 'AdminWorkflow',
    component: () => import('@/views/admin/WorkflowPanel.vue'),
    meta: { title: '工作流编排', icon: 'Reading', roles: ['ADMIN'], group: '系统管理' },
  },
  {
    path: 'admin/operation-logs',
    name: 'AdminOperationLogs',
    component: () => import('@/views/admin/OperationLogs.vue'),
    meta: { title: '操作日志', icon: 'Document', roles: ['ADMIN'], group: '系统管理' },
  },
  {
    path: 'admin/system-settings',
    name: 'AdminSystemSettings',
    component: () => import('@/views/admin/SystemSettings.vue'),
    meta: { title: '系统设置', icon: 'Setting', roles: ['ADMIN'], group: '系统管理' },
  },
  // hidden routes
  { path: 'admin/exams/:sessionId/monitor', name: 'AdminExamMonitor', component: () => import('@/views/admin/ExamMonitor.vue'), meta: { title: '考试监控', roles: ['ADMIN'], hidden: true } },
  { path: 'admin/exams/:sessionId/statistics', name: 'AdminExamStatistics', component: () => import('@/views/admin/ExamStatistics.vue'), meta: { title: '场次统计', roles: ['ADMIN'], hidden: true } },
  // 个人资料从侧边栏移除，从顶部头像下拉进入
  { path: 'admin/profile', name: 'AdminProfile', component: () => import('@/views/admin/Profile.vue'), meta: { title: '个人资料', roles: ['ADMIN'], hidden: true } },
]
