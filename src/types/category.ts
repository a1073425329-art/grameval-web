/**
 * 语法分类 —— 对齐后端 CategoryVO（GET /categories/tree 返回）
 */
export interface Category {
  id: number
  categoryName: string
  parentId: number | null
  description?: string
  sortNo: number
  status: 0 | 1
  createTime?: string
  updateTime?: string
  questionCount?: number
  children?: Category[]
}

/** 分类新增/编辑请求体 —— 对齐后端 CategoryRequest */
export interface CategoryForm {
  categoryName: string
  parentId?: number | null
  description?: string
  sortNo?: number
  status?: 0 | 1
}
