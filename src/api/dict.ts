import request from '@/utils/request'
import type { ApiResponse, DictItem } from '@/types/common'

/**
 * 字典类型（后端 GET /dict/{type} 支持的 type 集合）
 */
export type DictType =
  | 'questionType'   // SINGLE/MULTIPLE/JUDGE/FILL_HINT/READING
  | 'difficulty'     // 1/2/3
  | 'role'           // STUDENT/ADMIN
  | 'userStatus'     // 1/0
  | 'paperStatus'    // 0/1/2
  | 'sessionStatus'  // 0/1/2
  | 'submitStatus'   // 0/1/2
  | 'practiceStatus' // 0/1
  | 'gender'         // 0/1/2

/** 获取所有字典 */
export const getAllDict = () =>
  request.get<ApiResponse<Record<DictType, DictItem[]>>>('/dict')

/** 获取指定字典 */
export const getDict = (type: DictType) =>
  request.get<ApiResponse<DictItem[]>>(`/dict/${type}`)
