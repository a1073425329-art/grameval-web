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
  { value: 'FILL_HINT', label: '填空题' },
  { value: 'READING', label: '阅读理解' },
]

/**
 * 阅读子题型。值与后端 question.question_subtype 一致
 * （实体 Question.java 声明的 DETAIL/MAIN_IDEA/INFERENCE/VOCABULARY/ATTITUDE；
 * 库里的 READING_* 旧值已在 2026-10-02 归一，见 sql/fix_reading_orphans_20261002.sql）。
 */
export const readingSubtypeDict: DictOption[] = [
  { value: 'DETAIL', label: '细节题' },
  { value: 'MAIN_IDEA', label: '主旨题' },
  { value: 'INFERENCE', label: '推断题' },
  { value: 'VOCABULARY', label: '词义题' },
  { value: 'ATTITUDE', label: '态度题' },
]

export const readingSubtypeLabel = (v?: string | undefined): string =>
  readingSubtypeDict.find(d => d.value === v)?.label || ''

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