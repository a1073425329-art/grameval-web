export interface DictOption {
  value: string | number
  label: string
}

export const judgeOptionDict: DictOption[] = [
  { value: 'TRUE', label: '对' },
  { value: 'FALSE', label: '错' },
]

export const judgeResultDict: DictOption[] = [
  { value: 'TRUE', label: '正确' },
  { value: 'FALSE', label: '答错' },
]

export const boolDict: DictOption[] = [
  { value: 'true', label: '是' },
  { value: 'false', label: '否' },
]

export const boolNumberDict: DictOption[] = [
  { value: 1, label: '是' },
  { value: 0, label: '否' },
]

export const getLabel = (dict: DictOption[], value: string | number): string => {
  const item = dict.find((d) => String(d.value) === String(value))
  return item?.label ?? String(value)
}

export const getJudgeOptionLabel = (value: string | number): string => getLabel(judgeOptionDict, value)
export const getJudgeResultLabel = (value: string | number): string => getLabel(judgeResultDict, value)
export const getBoolLabel = (value: string | number): string => getLabel(boolDict, value)
export const getBoolNumberLabel = (value: string | number): string => getLabel(boolNumberDict, value)