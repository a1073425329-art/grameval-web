/**
 * 通用 Element Plus 表单校验规则集合。
 * 与 formLimits.ts 里的长度约束保持一致。
 *
 * 用法:
 *   import { commonRules } from '@/utils/formRules'
 *   const rules = { username: commonRules.username, password: commonRules.password }
 */
import type { FormItemRule } from 'element-plus'
import { FormLimits } from './formLimits'

type Rule = FormItemRule | FormItemRule[]

const required = (message: string): FormItemRule => ({
  required: true,
  message,
  trigger: 'blur',
})

const rangeLen = (min: number, max: number, message?: string): FormItemRule => ({
  min,
  max,
  message: message || `长度需要在 ${min}~${max} 个字符之间`,
  trigger: 'blur',
})

const pattern = (regex: RegExp, message: string): FormItemRule => ({
  pattern: regex,
  message,
  trigger: 'blur',
})

// ============ 常用正则 ============
export const REGEX = {
  // 用户名:字母 / 数字 / 下划线 / 中文,3-100 位
  username: /^[a-zA-Z0-9_一-龥]{3,100}$/,
  // 邮箱
  email: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
  // 中国大陆手机号(可以加国际码)
  phone: /^(\+?\d{1,4})?1[3-9]\d{9}$/,
  // 18 位身份证(含末位 X)
  idCard: /^\d{15}$|^\d{17}[\dXx]$/,
  // 数字
  number: /^\d+$/,
} as const

// ============ 单字段规则 ============
export const commonRules = {
  username: [
    required('请输入用户名'),
    rangeLen(FormLimits.username.min, FormLimits.username.max),
    pattern(REGEX.username, '用户名只能包含字母/数字/下划线/中文'),
  ] as Rule,

  password: [
    required('请输入密码'),
    rangeLen(FormLimits.password.min, FormLimits.password.max),
  ] as Rule,

  realName: [
    rangeLen(FormLimits.realName.min, FormLimits.realName.max),
  ] as Rule,

  realNameRequired: [
    required('请输入真实姓名'),
    rangeLen(FormLimits.realName.min, FormLimits.realName.max),
  ] as Rule,

  email: [
    { max: FormLimits.email.max, message: `邮箱最长 ${FormLimits.email.max} 位`, trigger: 'blur' },
    pattern(REGEX.email, '邮箱格式不正确'),
  ] as Rule,

  emailRequired: [
    required('请输入邮箱'),
    { max: FormLimits.email.max, message: `邮箱最长 ${FormLimits.email.max} 位`, trigger: 'blur' },
    pattern(REGEX.email, '邮箱格式不正确'),
  ] as Rule,

  phone: [
    { max: FormLimits.phone.max, message: `手机号最长 ${FormLimits.phone.max} 位`, trigger: 'blur' },
    pattern(REGEX.phone, '手机号格式不正确'),
  ] as Rule,

  phoneRequired: [
    required('请输入手机号'),
    pattern(REGEX.phone, '手机号格式不正确'),
  ] as Rule,

  idCard: [
    { max: FormLimits.idCard.max, message: `身份证最长 ${FormLimits.idCard.max} 位`, trigger: 'blur' },
    pattern(REGEX.idCard, '身份证格式不正确'),
  ] as Rule,

  paperTitle: [
    required('请输入标题'),
    rangeLen(FormLimits.paperTitle.min, FormLimits.paperTitle.max),
  ] as Rule,

  sessionName: [
    required('请输入场次名称'),
    rangeLen(FormLimits.sessionName.min, FormLimits.sessionName.max),
  ] as Rule,

  className: [
    required('请输入班级名称'),
    rangeLen(FormLimits.className.min, FormLimits.className.max),
  ] as Rule,

  questionStem: [
    required('请输入题干'),
    rangeLen(FormLimits.questionStem.min, FormLimits.questionStem.max),
  ] as Rule,
}

/**
 * 构造 "两次输入必须一致" 校验(通常用在确认密码)。
 * 用法:{ validator: sameAs(() => form.newPassword), trigger: 'blur' }
 */
export function sameAs(getter: () => string, message = '两次输入不一致') {
  return (_rule: unknown, value: string, cb: (err?: Error) => void) => {
    if (value !== getter()) cb(new Error(message))
    else cb()
  }
}
