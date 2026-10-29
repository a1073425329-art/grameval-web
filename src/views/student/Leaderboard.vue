<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getLeaderboard, getMyRank } from '@/api/student'
import type { LeaderboardItem, MyRank } from '@/types/leaderboard'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const list = ref<LeaderboardItem[]>([])
const myRank = ref<MyRank | null>(null)
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const [boardRes, rankRes] = await Promise.all([
      getLeaderboard(20),
      getMyRank(),
    ])
    list.value = boardRes.data ?? []
    myRank.value = rankRes.data ?? null
  } finally {
    loading.value = false
  }
}

const rankClass = (rank: number) => {
  if (rank === 1) return 'rank-1'
  if (rank === 2) return 'rank-2'
  if (rank === 3) return 'rank-3'
  return 'rank-other'
}

const rankLabel = (rank: number) => {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `第${rank}名`
}

const isMe = (item: LeaderboardItem) => item.userId === authStore.userInfo?.id

onMounted(load)
</script>

<template>
  <div class="leaderboard-page">
    <!-- 我的排名 -->
    <div v-if="myRank" class="my-rank-card">
      <div class="mrc-header">
        <span class="mrc-title">🏆 我的排名</span>
        <span v-if="myRank.rank" class="mrc-rank" :class="rankClass(myRank.rank)">
          {{ rankLabel(myRank.rank) }}
        </span>
        <span v-else class="mrc-rank">暂未上榜</span>
      </div>
      <div class="mrc-content">
        <el-avatar :size="50" :src="authStore.userInfo?.avatar || '/avatars/student.jpg'">
          <el-icon><UserFilled /></el-icon>
        </el-avatar>
        <div class="mrc-info">
          <div class="mrc-name">{{ authStore.userInfo?.displayName || authStore.userInfo?.username }}</div>
          <div class="mrc-stats">
            <span class="stat-item">平均分 <b>{{ list.find(i => isMe(i))?.avgScore || 0 }}</b></span>
            <span class="stat-item">正确率 <b>{{ list.find(i => isMe(i))?.accuracy || 0 }}%</b></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 排行榜列表 -->
    <el-card shadow="never" class="leaderboard-card">
      <template #header>
        <span class="card-title">📊 学生排行榜</span>
      </template>

      <div v-loading="loading" class="leaderboard-list">
        <el-empty v-if="!loading && !list.length" description="暂无排名数据" />

        <div
          v-for="item in list"
          :key="item.userId"
          class="leaderboard-item"
          :class="{ 'is-me': isMe(item) }"
        >
          <div class="li-rank" :class="rankClass(item.rank)">
            {{ item.rank <= 3 ? '' : item.rank }}
          </div>
          <div class="li-avatar">
            <el-avatar :size="40" :src="item.avatar || '/avatars/student.jpg'">
              <el-icon><UserFilled /></el-icon>
            </el-avatar>
          </div>
          <div class="li-info">
            <div class="li-name">
              {{ item.realName || item.username }}
              <span v-if="item.englishName" class="li-en-name">({{ item.englishName }})</span>
              <el-tag v-if="isMe(item)" type="primary">我</el-tag>
            </div>
            <div class="li-desc">考试 {{ item.examCount }}次 · 练习 {{ item.practiceCount }}次 · 错题 {{ item.wrongCount }}道</div>
          </div>
          <div class="li-score">
            <div class="li-avg">平均分</div>
            <div class="li-avg-value">{{ item.avgScore }}</div>
          </div>
          <div class="li-accuracy">
            <div class="li-acc-label">正确率</div>
            <div class="li-acc-value">{{ item.accuracy }}%</div>
          </div>
          <div class="li-max">
            <div class="li-max-label">最高分</div>
            <div class="li-max-value">{{ item.maxScore }}</div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.leaderboard-page { display: flex; flex-direction: column; gap: 16px; }

.my-rank-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  color: #fff;
  .mrc-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px;
  }
  .mrc-title { font-size: 16px; font-weight: 600; }
  .mrc-rank {
    font-size: 18px; font-weight: 700;
    &.rank-1 { color: #ffd700; }
    &.rank-2 { color: #c0c0c0; }
    &.rank-3 { color: #cd7f32; }
  }
  .mrc-content {
    display: flex; align-items: center; gap: 16px;
    .mrc-info {
      .mrc-name { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
      .mrc-stats {
        display: flex; gap: 20px;
        .stat-item { font-size: 13px; opacity: 0.9; b { font-size: 16px; color: #ffd700; } }
      }
    }
  }
}

.leaderboard-card {
  .card-title { font-size: 16px; font-weight: 600; }
}

.leaderboard-list {
  display: flex; flex-direction: column; gap: 10px;
}

.leaderboard-item {
  display: flex; align-items: center; gap: 16px;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 8px;
  transition: all 0.2s;
  &:hover { background: #f0f0f0; }
  &.is-me {
    background: #ecf5ff;
    border: 1px solid #409eff;
  }
}

.li-rank {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  font-size: 14px; font-weight: 700;
  color: #606266;
  &.rank-1 {
    background: linear-gradient(135deg, #ffd700, #ffb700);
    color: #fff;
  }
  &.rank-2 {
    background: linear-gradient(135deg, #c0c0c0, #a0a0a0);
    color: #fff;
  }
  &.rank-3 {
    background: linear-gradient(135deg, #cd7f32, #b06020);
    color: #fff;
  }
}

.li-avatar { flex-shrink: 0; }

.li-info {
  flex: 1; min-width: 0;
  .li-name { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 4px; }
  .li-en-name { font-size: 12px; color: #909399; }
  .li-desc { font-size: 12px; color: #909399; }
}

.li-score, .li-accuracy, .li-max {
  text-align: center; min-width: 60px;
  .li-avg, .li-acc-label, .li-max-label { font-size: 11px; color: #909399; }
  .li-avg-value, .li-acc-value, .li-max-value { font-size: 14px; font-weight: 600; color: #303133; }
  .li-avg-value { color: #409eff; }
  .li-acc-value { color: #67c23a; }
  .li-max-value { color: #e6a23c; }
}
</style>
