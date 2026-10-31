/** 班级/小组 */
export interface ClassGroup {
  id: number
  className: string
  schoolName?: string
  teacherId?: number
  teacherName?: string
  grade?: string
  studentCount: number
  description?: string
  status: 0 | 1
  createBy?: number
  creatorName?: string
  createTime: string
  updateTime?: string
  students?: ClassStudent[]
}

export interface ClassGroupForm {
  className: string
  schoolName?: string
  grade?: string
  description?: string
  status?: 0 | 1
}

/** 班级学生 */
export interface ClassStudent {
  id: number
  classId: number
  studentId: number
  studentName?: string
  username?: string
  studentNo?: string
  avatar?: string
  joinTime: string
  remark?: string
  /** 与后端 ClassStudentVO 对齐：列表展示用统计/基本信息 */
  classNames?: string[]
  gender?: number | undefined
  email?: string | undefined
  phone?: string | undefined
  status?: number | undefined
  lastLoginTime?: string | undefined
  examCount?: number | undefined
  recentScore?: number | undefined
  averageScore?: number | undefined
  wrongCount?: number | undefined
  practiceCount?: number | undefined
  abilityScore?: number | undefined
}
