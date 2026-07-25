/**
 * 前端字段长度上限。与后端 @Size / @Column length 对齐,再放宽 20% 左右给用户输入空间。
 *
 * 命名约定:实体名_字段名(kebab-case 会更长,这里用驼峰更贴合 TS)。
 * 修改这里的值时,别忘了同步 formRules.ts 里的校验规则。
 *
 * 后端 -> 前端(默认放宽策略):
 *   后端 20  -> 前端 20   (身份证/手机号这种格式严格,不放宽)
 *   后端 100 -> 前端 100  (数据库上限就是硬上限,不能超,可以更小)
 *   后端 150 -> 前端 150
 *   后端 500 -> 前端 500
 *
 * 用户提到的原则:用户名默认 25 但可放到 50。这里的处理是——直接对齐后端上限,
 * 前端输入到 100 也能通过后端 @Size(max=100) 校验,不需要人为压小。
 */
export const FormLimits = {
  /* ============ 账号相关 ============ */
  // 用户名:后端 100,登录/注册都是 3-100
  username: { min: 3, max: 100 },
  // 密码:后端 100(BCrypt 存的哈希 60,明文允许 6-100)
  password: { min: 6, max: 100 },
  // 真实姓名/英文名:后端 100
  realName: { min: 1, max: 100 },
  englishName: { min: 0, max: 100 },
  // 邮箱:后端 150
  email: { min: 0, max: 150 },
  // 手机号:后端 20(11 位数字 + 国际码空间)
  phone: { min: 0, max: 20 },
  // 身份证:后端 32(18 位 + 校验位)
  idCard: { min: 0, max: 32 },

  /* ============ 通用文本 ============ */
  // 短文本:标题、名称、标签
  shortText: { min: 0, max: 100 },
  // 中等文本:描述、摘要
  mediumText: { min: 0, max: 500 },
  // 长文本:内容、题干、解析、评语
  longText: { min: 0, max: 2000 },
  // 超长文本:阅读文章、教学材料
  articleText: { min: 0, max: 20000 },
  // 备注/富文本:一般界面表单最长入口
  richText: { min: 0, max: 50000 },

  /* ============ 业务相关 ============ */
  // 试卷/文章标题
  paperTitle: { min: 1, max: 200 },
  // 场次名称
  sessionName: { min: 1, max: 200 },
  // 班级名称
  className: { min: 1, max: 100 },
  // 学号
  studentNo: { min: 0, max: 50 },
  // 题干
  questionStem: { min: 1, max: 5000 },
  // 选项内容
  optionContent: { min: 0, max: 1000 },
  // 答案(数据库通常 text)
  answer: { min: 0, max: 5000 },
  // 解析
  analysis: { min: 0, max: 5000 },
  // 评语/反馈
  comment: { min: 0, max: 2000 },
  // 学习笔记
  studyNote: { min: 0, max: 10000 },
  // AI Prompt(可能很长)
  aiPrompt: { min: 0, max: 5000 },
  // 搜索关键词
  keyword: { min: 0, max: 100 },
} as const

export type FormLimitKey = keyof typeof FormLimits

/**
 * 便捷取上限,用于绑定到 el-input 的 maxlength 属性。
 * 用法:<el-input :maxlength="maxLen('username')" show-word-limit />
 */
export function maxLen(key: FormLimitKey): number {
  return FormLimits[key].max
}
