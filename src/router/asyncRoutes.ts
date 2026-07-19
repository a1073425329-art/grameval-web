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
    meta: { title: '语法题库', icon: 'Notebook', roles: ['STUDENT'] },
  },
  {
    path: 'student/practice',
    name: 'Practice',
    component: () => import('@/views/student/Practice.vue'),
    meta: { title: '专项练习', icon: 'EditPen', roles: ['STUDENT'] },
  },
  {
    path: 'student/exams',
    name: 'ExamList',
    component: () => import('@/views/student/ExamList.vue'),
    meta: { title: '在线考试', icon: 'Document', roles: ['STUDENT'] },
  },
  {
    path: 'student/exam-room/:examId',
    name: 'ExamRoom',
    component: () => import('@/views/student/ExamRoom.vue'),
    meta: { title: '考试中', roles: ['STUDENT'], hidden: true },
  },
  {
    path: 'student/results',
    name: 'MyResults',
    component: () => import('@/views/student/MyResults.vue'),
    meta: { title: '我的成绩', icon: 'Trophy', roles: ['STUDENT'] },
  },
  {
    path: 'student/results/:id',
    name: 'ResultDetail',
    component: () => import('@/views/student/ResultDetail.vue'),
    meta: { title: '成绩详情', roles: ['STUDENT'], hidden: true },
  },
  {
    path: 'student/wrong-book',
    name: 'WrongBook',
    component: () => import('@/views/student/WrongBook.vue'),
    meta: { title: '错题本', icon: 'CircleClose', roles: ['STUDENT'] },
  },
  {
    path: 'student/stats',
    name: 'StudentStats',
    component: () => import('@/views/student/Stats.vue'),
    meta: { title: '学习数据', icon: 'TrendCharts', roles: ['STUDENT'] },
  },
  {
    path: 'student/profile',
    name: 'StudentProfile',
    component: () => import('@/views/student/Profile.vue'),
    meta: { title: '个人资料', icon: 'User', roles: ['STUDENT'] },
  },

  /* ============================================================
   *  管理端
   * ============================================================ */
  {
    path: 'dashboard',
    name: 'Dashboard',
    component: () => import('@/views/dashboard/index.vue'),
    meta: { title: '工作台', icon: 'HomeFilled', roles: ['ADMIN'] },
  },
  {
    path: 'admin/users',
    name: 'AdminUsers',
    component: () => import('@/views/admin/UserManage.vue'),
    meta: { title: '用户管理', icon: 'UserFilled', roles: ['ADMIN'] },
  },
  {
    path: 'admin/my-students',
    name: 'AdminMyStudents',
    component: () => import('@/views/admin/MyStudents.vue'),
    meta: { title: '我的学生', icon: 'Avatar', roles: ['ADMIN'] },
  },
  {
    path: 'admin/categories',
    name: 'AdminCategories',
    component: () => import('@/views/admin/CategoryManage.vue'),
    meta: { title: '语法分类', icon: 'Menu', roles: ['ADMIN'] },
  },
  {
    path: 'admin/questions',
    name: 'AdminQuestions',
    component: () => import('@/views/admin/QuestionManage.vue'),
    meta: { title: '试题管理', icon: 'Notebook', roles: ['ADMIN'] },
  },
  {
    path: 'admin/questions/analytics',
    name: 'AdminQuestionAnalytics',
    component: () => import('@/views/admin/QuestionAnalytics.vue'),
    meta: { title: '题目分析', icon: 'TrendCharts', roles: ['ADMIN'] },
  },
  {
    path: 'admin/papers',
    name: 'AdminPapers',
    component: () => import('@/views/admin/PaperManage.vue'),
    meta: { title: '试卷管理', icon: 'Files', roles: ['ADMIN'] },
  },
  {
    path: 'admin/ai-compose',
    name: 'AdminAiCompose',
    component: () => import('@/views/admin/AiCompose.vue'),
    meta: { title: '智能出题', icon: 'MagicStick', roles: ['ADMIN'] },
  },
  {
    path: 'admin/exams',
    name: 'AdminExams',
    component: () => import('@/views/admin/ExamManage.vue'),
    meta: { title: '考试管理', icon: 'Calendar', roles: ['ADMIN'] },
  },
  {
    path: 'admin/exams/:sessionId/monitor',
    name: 'AdminExamMonitor',
    component: () => import('@/views/admin/ExamMonitor.vue'),
    meta: { title: '考试监控', roles: ['ADMIN'], hidden: true },
  },
  {
    path: 'admin/exams/:sessionId/statistics',
    name: 'AdminExamStatistics',
    component: () => import('@/views/admin/ExamStatistics.vue'),
    meta: { title: '场次统计', roles: ['ADMIN'], hidden: true },
  },
  {
    path: 'admin/results',
    name: 'AdminResults',
    component: () => import('@/views/admin/ResultManage.vue'),
    meta: { title: '成绩管理', icon: 'DataAnalysis', roles: ['ADMIN'] },
  },
  {
    path: 'admin/operation-logs',
    name: 'AdminOperationLogs',
    component: () => import('@/views/admin/OperationLogs.vue'),
    meta: { title: '操作日志', icon: 'Document', roles: ['ADMIN'] },
  },
  {
    path: 'admin/profile',
    name: 'AdminProfile',
    component: () => import('@/views/admin/Profile.vue'),
    meta: { title: '个人资料', icon: 'User', roles: ['ADMIN'] },
  },
]
