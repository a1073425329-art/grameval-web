export interface LeaderboardItem {
  rank: number
  userId: number
  username: string
  realName?: string
  englishName?: string
  avatar?: string
  examCount: number
  avgScore: number
  maxScore: number
  accuracy: number
  practiceCount: number
  wrongCount: number
  completedQuestions: number
}

export interface MyRank {
  rank: number | null
  userId: number
}
