<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Trophy, Lock, Star, Check, Medal } from '@element-plus/icons-vue'
import { getMyBadges, getAllBadges } from '@/api/student'
import type { UserBadge } from '@/api/student'

const loading = ref(false)
const myBadges = ref<UserBadge[]>([])
const allBadges = ref<any[]>([])

// 徽章类型分组
const badgeTypeGroups = [
  { key: 'STREAK', label: '连续学习', color: '#e6a23c' },
  { key: 'ACCURACY', label: '正确率', color: '#67c23a' },
  { key: 'QUESTION', label: '题目数量', color: '#409eff' },
  { key: 'EXAM', label: '考试成绩', color: '#f56c6c' },
  { key: 'PRACTICE', label: '练习', color: '#9c27b0' },
  { key: 'SPECIAL', label: '特殊', color: '#10b981' },
]

const loadData = async () => {
  loading.value = true
  try {
    const [myRes, allRes] = await Promise.all([
      getMyBadges(),
      getAllBadges(),
    ])
    if (myRes.data) {
      myBadges.value = myRes.data
    }
    if (allRes.data) {
      allBadges.value = allRes.data
    }
  } catch {
    ElMessage.error('加载徽章数据失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

// 判断徽章是否已获得
const isEarned = (badgeCode: string) => {
  return myBadges.value.some(b => b.badgeCode === badgeCode)
}

// 获取已获得的徽章数据
const getEarnedBadge = (badgeCode: string) => {
  return myBadges.value.find(b => b.badgeCode === badgeCode)
}

// 按类型分组徽章
const badgesByType = computed(() => {
  const groups: Record<string, any[]> = {}
  allBadges.value.forEach(badge => {
    const type = badge.badgeType || 'SPECIAL'
    if (!groups[type]) {
      groups[type] = []
    }
    groups[type].push(badge)
  })
  return groups
})

// 计算获得进度
const getProgress = () => {
  return {
    earned: myBadges.value.length,
    total: allBadges.value.length,
    percentage: allBadges.value.length > 0 
      ? Math.round((myBadges.value.length / allBadges.value.length) * 100) 
      : 0,
  }
}

// 获取类型标签信息
const getTypeInfo = (type: string) => {
  return badgeTypeGroups.find(g => g.key === type) || { key: type, label: type, color: '#909399' }
}
</script>

<template>
  <div class="badges-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <h2>🏆 徽章系统</h2>
      <p class="page-desc">收集徽章，记录你的学习成就</p>
    </div>

    <!-- 进度卡片 -->
    <el-card shadow="never" class="progress-card">
      <div class="progress-content">
        <div class="progress-icon">
          <el-icon size="48"><Medal /></el-icon>
        </div>
        <div class="progress-info">
          <div class="progress-title">徽章收集进度</div>
          <div class="progress-stats">
            <span class="earned-count">{{ getProgress().earned }}</span>
            <span class="divider">/</span>
            <span class="total-count">{{ getProgress().total }}</span>
            <span class="percentage">已收集 {{ getProgress().percentage }}%</span>
          </div>
          <el-progress 
            :percentage="getProgress().percentage" 
            :stroke-width="12"
            :color="getProgress().percentage >= 50 ? '#67c23a' : '#e6a23c'"
          />
        </div>
      </div>
    </el-card>

    <!-- 已获得徽章 -->
    <div class="section">
      <h3 class="section-title">
        <el-icon><Star /></el-icon>
        已获得徽章（{{ myBadges.length }}）
      </h3>
      <div class="badges-grid" v-if="myBadges.length">
        <div
          v-for="badge in myBadges"
          :key="badge.badgeCode"
          class="badge-card earned"
        >
          <div class="badge-icon">{{ badge.icon }}</div>
          <div class="badge-name">{{ badge.badgeName }}</div>
          <div class="badge-desc">{{ badge.earnedDescription }}</div>
          <div class="badge-earned-time">获得于 {{ badge.earnedTime?.slice(0, 10) }}</div>
          <div class="badge-badge">
            <el-icon color="#67c23a"><Check /></el-icon>
          </div>
        </div>
      </div>
      <el-empty v-else description="还没有获得任何徽章，开始学习吧！" :image-size="80" />
    </div>

    <!-- 所有徽章分类 -->
    <div class="section" v-for="(badges, type) in badgesByType" :key="type">
      <h3 class="section-title" :style="{ color: getTypeInfo(type).color }">
        <el-icon><Trophy /></el-icon>
        {{ getTypeInfo(type).label }}
      </h3>
      <div class="badges-grid">
        <div
          v-for="badge in badges"
          :key="badge.badgeCode"
          :class="['badge-card', isEarned(badge.badgeCode) ? 'earned' : 'locked']"
        >
          <div class="badge-icon">{{ isEarned(badge.badgeCode) ? badge.icon : '🔒' }}</div>
          <div class="badge-name">{{ badge.badgeName }}</div>
          <div class="badge-desc">{{ badge.description }}</div>
          <div v-if="isEarned(badge.badgeCode)" class="badge-earned-time">
            获得于 {{ getEarnedBadge(badge.badgeCode)?.earnedTime?.slice(0, 10) }}
          </div>
          <div v-else class="badge-condition">
            <el-icon><Lock /></el-icon>
            尚未解锁
          </div>
          <div v-if="isEarned(badge.badgeCode)" class="badge-badge">
            <el-icon color="#67c23a"><Check /></el-icon>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.badges-page { padding: 4px; }

.page-header {
  margin-bottom: 16px;
  h2 { margin: 0; font-size: 20px; font-weight: 600; }
  .page-desc { margin: 4px 0 0; color: #909399; font-size: 13px; }
}

.progress-card {
  margin-bottom: 24px;
  .progress-content {
    display: flex; align-items: center; gap: 24px;
  }
  .progress-icon {
    width: 80px; height: 80px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #fff;
  }
  .progress-info { flex: 1; }
  .progress-title { font-size: 16px; font-weight: 600; color: #303133; margin-bottom: 8px; }
  .progress-stats {
    display: flex; align-items: baseline; gap: 4px; margin-bottom: 12px;
    .earned-count { font-size: 32px; font-weight: 700; color: #667eea; }
    .divider { font-size: 20px; color: #909399; }
    .total-count { font-size: 20px; color: #909399; }
    .percentage { margin-left: 12px; font-size: 14px; color: #909399; }
  }
}

.section {
  margin-bottom: 24px;
  .section-title {
    display: flex; align-items: center; gap: 8px;
    font-size: 16px; font-weight: 600; color: #303133;
    margin-bottom: 12px;
  }
}

.badges-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.badge-card {
  position: relative;
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: transform 0.15s, box-shadow 0.15s;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  &.earned {
    border: 2px solid rgba(103, 194, 58, 0.3);
    background: linear-gradient(180deg, #f0fdf4 0%, #fff 100%);
  }
  &.locked {
    opacity: 0.6;
    .badge-icon { filter: grayscale(1); }
  }
}

.badge-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.badge-name {
  font-size: 16px; font-weight: 600; color: #303133;
  margin-bottom: 6px;
}

.badge-desc {
  font-size: 12px; color: #909399;
  margin-bottom: 8px;
  line-height: 1.4;
}

.badge-earned-time {
  font-size: 11px; color: #67c23a;
}

.badge-condition {
  font-size: 11px; color: #909399;
  display: flex; align-items: center; justify-content: center; gap: 4px;
}

.badge-badge {
  position: absolute;
  top: 8px; right: 8px;
  width: 24px; height: 24px;
  background: #67c23a;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
</style>
