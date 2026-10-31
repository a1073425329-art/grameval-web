import request from '@/utils/request'
import { answerInPractice, submitPractice } from '@/api/student'
import type { QuickPracticeForm } from '@/types/question'
import type { ApiResponse } from '@/types/common'
import type {
  AlgorithmAdaptivePracticeResult,
  AlgorithmBktBatchResult,
  AlgorithmBktStudentQuery,
  AlgorithmBktStudentResult,
  AlgorithmQuestionQualityQuery,
  AlgorithmQuestionQualityResult,
} from '@/types/algorithms'

const serializeAlgorithmParams = (params: Record<string, unknown>) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => search.append(key, String(item)))
    else if (value !== undefined && value !== null) search.append(key, String(value))
  })
  return search.toString()
}

/** 正式考试题目测量质量；studentIds 编码为重复查询参数。 */
export const getAlgorithmQuestionQuality = (query: AlgorithmQuestionQualityQuery) =>
  request.get<ApiResponse<AlgorithmQuestionQualityResult>>('/admin/questions/quality', {
    params: query,
    paramsSerializer: { serialize: serializeAlgorithmParams },
  })

/** 当前学生本人的 BKT 知识追踪估计。 */
export const getMyAlgorithmBkt = (userId: number, query?: Omit<AlgorithmBktStudentQuery, 'studentIds'>) =>
  request.get<ApiResponse<AlgorithmBktStudentResult>>(
    `/knowledge-mastery/student/${userId}/bkt`,
    query ? { params: query } : undefined,
  )

/** 管理员/教师的授权范围 BKT 查询；省略 studentIds 表示当前授权整体范围。 */
export const getAlgorithmBktForStudents = (query: AlgorithmBktStudentQuery) =>
  request.get<ApiResponse<AlgorithmBktBatchResult>>('/knowledge-mastery/bkt', {
    params: query,
    paramsSerializer: { serialize: serializeAlgorithmParams },
  })

/** 开始一个 CAT 专项练习会话。 */
export const startAlgorithmAdaptivePractice = (categoryId: number) =>
  request.post<ApiResponse<AlgorithmAdaptivePracticeResult>>(
    `/practices/adaptive/start/${categoryId}`,
  )

/** 获取该 CAT 会话当前稳定推荐的下一题。 */
export const getAlgorithmAdaptiveNext = (practiceId: number) =>
  request.get<ApiResponse<AlgorithmAdaptivePracticeResult>>(
    `/practices/${practiceId}/adaptive/next`,
  )

/** 先取得判题反馈，再写入 CAT 会话；落库失败时不向页面返回成功反馈。 */
export const submitAlgorithmAdaptiveAnswer = async (practiceId: number, answer: QuickPracticeForm) => {
  const judgement = await submitPractice(answer)
  await answerInPractice(practiceId, answer)
  return judgement
}
