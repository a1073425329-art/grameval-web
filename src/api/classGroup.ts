import request from '@/utils/request'
import type { ApiResponse, PageQuery, PageResult } from '@/types/common'
import type { ClassGroup, ClassGroupForm, ClassStudent } from '@/types/classGroup'

export interface ClassGroupQuery extends PageQuery {
  className?: string
  schoolName?: string
  grade?: string
  status?: number
  teacherId?: number
}

export const listClassGroups = (params: ClassGroupQuery) =>
  request.get<ApiResponse<PageResult<ClassGroup>>>('/classes', { params })

export const getClassGroupStats = () =>
  request.get<ApiResponse<Record<string, number>>>('/classes/stats')

export const getMyClasses = () =>
  request.get<ApiResponse<ClassGroup[]>>('/classes/my')

export const getClassGroup = (id: number) =>
  request.get<ApiResponse<ClassGroup>>(`/classes/${id}`)

export const createClassGroup = (data: ClassGroupForm) =>
  request.post<ApiResponse<ClassGroup>>('/classes', data)

export const updateClassGroup = (id: number, data: ClassGroupForm) =>
  request.put<ApiResponse<ClassGroup>>(`/classes/${id}`, data)

export const deleteClassGroup = (id: number) =>
  request.delete<ApiResponse<void>>(`/classes/${id}`)

export const getClassStudents = (classId: number) =>
  request.get<ApiResponse<ClassStudent[]>>(`/classes/${classId}/students`)

export const assignClassStudents = (classId: number, studentIds: number[]) =>
  request.put<ApiResponse<void>>(`/classes/${classId}/students`, { classId, studentIds })

export const addClassStudent = (classId: number, studentId: number, studentNo?: string) =>
  request.post<ApiResponse<void>>(`/classes/${classId}/students/${studentId}`, null, { params: { studentNo } })

export const removeClassStudent = (classId: number, studentId: number) =>
  request.delete<ApiResponse<void>>(`/classes/${classId}/students/${studentId}`)
