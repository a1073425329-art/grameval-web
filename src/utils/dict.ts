export interface DictOption {
  value: string | number
  label: string
}

// ========== 判断题相关 ==========

export const judgeOptionDict: DictOption[] = [
  { value: 'TRUE', label: '对' },
  { value: 'FALSE', label: '错' },
]

export const judgeResultDict: DictOption[] = [
  { value: 'TRUE', label: '正确' },
  { value: 'FALSE', label: '答错' },
]

// ========== 布尔值相关 ==========

export const boolDict: DictOption[] = [
  { value: 'true', label: '是' },
  { value: 'false', label: '否' },
]

export const boolNumberDict: DictOption[] = [
  { value: 1, label: '是' },
  { value: 0, label: '否' },
]

// ========== 题型相关 ==========

export const questionTypeDict: DictOption[] = [
  { value: 'SINGLE', label: '单选题' },
  { value: 'MULTIPLE', label: '多选题' },
  { value: 'JUDGE', label: '判断题' },
  { value: 'FILL', label: '填空题' },
  { value: 'FILL_HINT', label: '填空题' },
  { value: 'READING', label: '阅读理解题' },
]

/**
 * 阅读子题型。值与后端 question.question_subtype 一致
 * （实体 Question.java 声明的取值；READING_* 旧值已在 2026-10-02 归一，
 * 见 sql/fix_reading_orphans_20261002.sql。2026-10-03 扩展至 16 种，
 * 对齐中考/高考/CET-4/6/雅思/托福的真实阅读题型）。
 */
export const readingSubtypeDict: DictOption[] = [
  { value: 'DETAIL', label: '细节题' },
  { value: 'MAIN_IDEA', label: '主旨题' },
  { value: 'INFERENCE', label: '推断题' },
  { value: 'VOCABULARY', label: '词义题' },
  { value: 'ATTITUDE', label: '态度题' },
  { value: 'REFERENCE', label: '指代题' },
  { value: 'ORGANIZATION', label: '篇章结构' },
  { value: 'SENTENCE_SIMPLIFICATION', label: '句子简化' },
  { value: 'TRUE_FALSE_NG', label: '判断正误' },
  { value: 'GAP_FILL', label: '语篇补文' },
  { value: 'MATCHING_HEADINGS', label: '标题匹配' },
  { value: 'MATCHING_FEATURES', label: '信息匹配' },
  { value: 'SENTENCE_COMPLETION', label: '句子补全' },
  { value: 'SUMMARY_CLOZE', label: '摘要填空' },
  { value: 'SHORT_ANSWER', label: '简答题' },
  { value: 'TABLE_COMPLETION', label: '表格填空' },
]

export const readingSubtypeLabel = (v?: string | undefined): string => {
  const normalized = v?.trim().toUpperCase()
  return readingSubtypeDict.find(d => d.value === normalized)?.label || ''
}

export const readingKnowledgePointLabel = (value?: string | null): string => {
  if (!value) return ''
  return readingSubtypeLabel(value) || value
}

export const questionAnalysisDisplayText = (analysis?: string | null): string => {
  if (!analysis?.trim()) return ''
  return analysis === 'Grammar rule explanation.' ? '暂无有效解析' : analysis
}

// ========== 用户角色相关 ==========

export const userRoleDict: DictOption[] = [
  { value: 'STUDENT', label: '学生' },
  { value: 'ADMIN', label: '管理员' },
]

// ========== 难度等级相关 ==========

export const difficultyDict: DictOption[] = [
  { value: 1, label: '简单' },
  { value: 2, label: '中等' },
  { value: 3, label: '困难' },
]

// ========== 状态相关 ==========

export const statusDict: DictOption[] = [
  { value: 1, label: '启用' },
  { value: 0, label: '禁用' },
]

export const examSessionStatusDict: DictOption[] = [
  { value: 0, label: '草稿' },
  { value: 1, label: '已发布' },
  { value: 2, label: '已结束' },
]

export const examRecordStatusDict: DictOption[] = [
  { value: 0, label: '进行中' },
  { value: 1, label: '已提交' },
  { value: 2, label: '超时提交' },
]

export const practiceStatusDict: DictOption[] = [
  { value: 0, label: '进行中' },
  { value: 1, label: '已完成' },
]

export const paperStatusDict: DictOption[] = [
  { value: 0, label: '草稿' },
  { value: 1, label: '启用' },
  { value: 2, label: '停用' },
]

// ========== 通知类型相关 ==========

export const notificationTypeDict: DictOption[] = [
  { value: 'EXAM_PUBLISHED', label: '考试发布' },
  { value: 'EXAM_REMIND', label: '考试提醒' },
  { value: 'SCORE_RELEASE', label: '成绩发布' },
  { value: 'SYSTEM', label: '系统通知' },
]

// ========== 操作类型相关 ==========

export const operationTypeDict: DictOption[] = [
  { value: 'API_CALL', label: '接口调用' },
  { value: 'LOGIN', label: '登录' },
  { value: 'LOGOUT', label: '登出' },
  { value: 'REGISTER', label: '注册' },
  { value: 'CREATE', label: '创建' },
  { value: 'UPDATE', label: '修改' },
  { value: 'DELETE', label: '删除' },
  { value: 'EXAM_START', label: '开始考试' },
  { value: 'EXAM_SUBMIT', label: '提交考试' },
  { value: 'EXAM_TIMEOUT', label: '考试超时' },
  { value: 'FORCE_SUBMIT', label: '强制收卷' },
  { value: 'PRACTICE_START', label: '开始练习' },
  { value: 'PRACTICE_FINISH', label: '结束练习' },
  { value: 'AI_ANALYZE', label: 'AI分析' },
  { value: 'AI_PREVIEW', label: 'AI预览' },
  { value: 'AI_CONFIRM', label: 'AI入库' },
  { value: 'IMPORT', label: '导入' },
  { value: 'EXPORT', label: '导出' },
  { value: 'BATCH', label: '批量操作' },
  { value: 'CHANGE_PASSWORD', label: '修改密码' },
  { value: 'RESET_PASSWORD', label: '重置密码' },
  { value: 'ASSIGN_STUDENT', label: '指派学生' },
  { value: 'BIND_STUDENT', label: '绑定学生' },
  { value: 'STATUS_CHANGE', label: '状态变更' },
  { value: 'CLEAR_LOG', label: '清空日志' },
  { value: 'ERROR', label: '异常' },
]

// ========== 目标类型相关 ==========

export const targetTypeDict: DictOption[] = [
  { value: 'USER', label: '用户' },
  { value: 'QUESTION', label: '题目' },
  { value: 'CATEGORY', label: '分类' },
  { value: 'PAPER', label: '试卷' },
  { value: 'SESSION', label: '考试场次' },
  { value: 'EXAM', label: '考试记录' },
  { value: 'PRACTICE', label: '练习' },
  { value: 'SCORE', label: '成绩' },
  { value: 'STUDENT', label: '学生' },
  { value: 'TAG', label: '标签' },
  { value: 'LOG', label: '日志' },
  { value: 'SYSTEM', label: '系统' },
]

// ========== 性别相关 ==========

export const genderDict: DictOption[] = [
  { value: 0, label: '未知' },
  { value: 1, label: '男' },
  { value: 2, label: '女' },
]

// ========== 是否正确相关 ==========

export const isCorrectDict: DictOption[] = [
  { value: 1, label: '正确' },
  { value: 0, label: '错误' },
]

// ========== 试卷满分档位相关 ==========
// [2026-10-16 新增] 出题卷面满分必须是标准档位，对齐小初高 / 中考 / 高考 /
// 大学英语四六级 / 托福 / 雅思，避免出现 101、110 这类非标准总分。
// 与后端 AiGenerateParams.ALLOWED_TOTAL_SCORES 保持一致。
export const paperScoreDict: DictOption[] = [
  { value: 100, label: '100 分（100 题 · 每题 1 分）' },
  { value: 150, label: '150 分（150 题 · 每题 1 分）' },
]

/** 合法档位值列表（下拉 value 直接取该数组，避免与后端校验漂移） */
export const paperScoreValues: number[] = paperScoreDict.map((d) => Number(d.value))

// ========== 考试类型预设（快速组卷） ==========

/** 考试类型预设项：一键带出总分档位 + 难度分布 + 建议题量 */
export interface ExamTypePreset {
  value: string
  label: string
  /** 卷面总分：100 或 150，1 题 1 分（题数 = 总分） */
  totalScore: number
  /** 三档难度百分比，合计 100 */
  easyPct: number
  mediumPct: number
  hardPct: number
  /** 建议总题量 */
  questionCount: number
  /** 建议考试时长（分钟）——仅作为创建场次时的默认值，模板本身不存时长 */
  suggestDuration?: number
}

/**
 * 考试类型 → 出卷预设。学段/考试难度梯度：小学 → 初中/中考 → 高中/高考 → 大学 CET → 考研/专四专八 → 托福/雅思。
 * 值存入 exam_paper_template.grade_level，便于列表筛选与答辩口径统一。
 */
export const examTypePresets: ExamTypePreset[] = [
  { value: "PRIMARY", label: "小学英语", totalScore: 100, easyPct: 70, mediumPct: 25, hardPct: 5, questionCount: 100, suggestDuration: 60 },
  { value: "JUNIOR", label: "初中英语", totalScore: 100, easyPct: 55, mediumPct: 35, hardPct: 10, questionCount: 100, suggestDuration: 90 },
  { value: "ZHONGKAO", label: "中考英语", totalScore: 150, easyPct: 50, mediumPct: 40, hardPct: 10, questionCount: 150, suggestDuration: 90 },
  { value: "SENIOR", label: "高中英语", totalScore: 150, easyPct: 35, mediumPct: 45, hardPct: 20, questionCount: 150, suggestDuration: 120 },
  { value: "GAOKAO", label: "高考英语", totalScore: 150, easyPct: 30, mediumPct: 50, hardPct: 20, questionCount: 150, suggestDuration: 120 },
  { value: "CET4", label: "大学英语四级", totalScore: 100, easyPct: 30, mediumPct: 50, hardPct: 20, questionCount: 100, suggestDuration: 125 },
  { value: "CET6", label: "大学英语六级", totalScore: 100, easyPct: 20, mediumPct: 50, hardPct: 30, questionCount: 100, suggestDuration: 130 },
  { value: "POSTGRAD", label: "考研英语", totalScore: 100, easyPct: 20, mediumPct: 50, hardPct: 30, questionCount: 100, suggestDuration: 180 },
  { value: "TEM4", label: "专四", totalScore: 100, easyPct: 25, mediumPct: 50, hardPct: 25, questionCount: 100, suggestDuration: 130 },
  { value: "TOEFL", label: "托福", totalScore: 150, easyPct: 10, mediumPct: 40, hardPct: 50, questionCount: 150, suggestDuration: 180 },
  { value: "IELTS", label: "雅思", totalScore: 150, easyPct: 10, mediumPct: 40, hardPct: 50, questionCount: 150, suggestDuration: 160 },
  { value: "CUSTOM", label: "自定义", totalScore: 100, easyPct: 30, mediumPct: 50, hardPct: 20, questionCount: 100 },
]

export const examTypeDict: DictOption[] = examTypePresets.map((p) => ({ value: p.value, label: p.label }))

export const getExamTypePreset = (value?: string): ExamTypePreset | undefined =>
  examTypePresets.find((p) => p.value === value)

export const getExamTypeLabel = (value: string | number): string => {
  const item = examTypeDict.find((d) => String(d.value) === String(value))
  return item?.label ?? String(value)
}

// ========== 工具函数 ==========

export const getLabel = (dict: DictOption[], value: string | number): string => {
  const item = dict.find((d) => String(d.value) === String(value))
  return item?.label ?? String(value)
}

export const getJudgeOptionLabel = (value: string | number): string => getLabel(judgeOptionDict, value)
export const getJudgeResultLabel = (value: string | number): string => getLabel(judgeResultDict, value)
export const getBoolLabel = (value: string | number): string => getLabel(boolDict, value)
export const getBoolNumberLabel = (value: string | number): string => getLabel(boolNumberDict, value)
export const getQuestionTypeLabel = (value: string | number): string => getLabel(questionTypeDict, value)
export const getUserRoleLabel = (value: string | number): string => getLabel(userRoleDict, value)
export const getDifficultyLabel = (value: string | number): string => getLabel(difficultyDict, value)
export const getStatusLabel = (value: string | number): string => getLabel(statusDict, value)
export const getExamSessionStatusLabel = (value: string | number): string => getLabel(examSessionStatusDict, value)
export const getExamRecordStatusLabel = (value: string | number): string => getLabel(examRecordStatusDict, value)
export const getPracticeStatusLabel = (value: string | number): string => getLabel(practiceStatusDict, value)
export const getPaperStatusLabel = (value: string | number): string => getLabel(paperStatusDict, value)
export const getNotificationTypeLabel = (value: string | number): string => getLabel(notificationTypeDict, value)
export const getOperationTypeLabel = (value: string | number): string => getLabel(operationTypeDict, value)
export const getTargetTypeLabel = (value: string | number): string => getLabel(targetTypeDict, value)
export const getGenderLabel = (value: string | number): string => getLabel(genderDict, value)
export const getIsCorrectLabel = (value: string | number): string => getLabel(isCorrectDict, value)
export const getPaperScoreLabel = (value: string | number): string => getLabel(paperScoreDict, value)
