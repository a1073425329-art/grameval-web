<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getMySummary, getAvailableExams } from '@/api/student'
import type { ResultSummary } from '@/types/result'
import type { AvailableExam } from '@/types/exam'

const router = useRouter()
const authStore = useAuthStore()

const summary = ref<ResultSummary>({
  totalCount: 0,
  averageScore: 0,
  highestScore: 0,
  lowestScore: 0,
  totalAccuracy: 0,
})
const availableExams = ref<AvailableExam[]>([])
const loading = ref(false)

const shortcuts = [
  { title: '语法题库', desc: '按专题浏览题目 + 学习模式看解析', path: '/student/question-bank', icon: 'Notebook', color: '#409eff' },
  { title: '专项练习', desc: '选专题刷 10 题，即时反馈', path: '/student/practice', icon: 'EditPen', color: '#67c23a' },
  { title: '在线考试', desc: '查看可参加考试并进入答题', path: '/student/exams', icon: 'Document', color: '#e6a23c' },
  { title: '错题本', desc: '合并考试+练习错题，按题目去重', path: '/student/wrong-book', icon: 'CircleClose', color: '#f56c6c' },
  { title: '学习数据', desc: '多维度掌握分析 + 考点弱点', path: '/student/stats', icon: 'TrendCharts', color: '#409eff' },
]

const load = async () => {
  loading.value = true
  try {
    const [s, e] = await Promise.allSettled([getMySummary(), getAvailableExams()])
    if (s.status === 'fulfilled') summary.value = s.value.data
    if (e.status === 'fulfilled') availableExams.value = e.value.data ?? []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="student-home">
    <div class="hero">
      <h2>你好，{{ authStore.userInfo?.displayName || authStore.userInfo?.username || '同学' }} 👋</h2>
      <p class="hero-sub">今天也要保持学习节奏，加油！</p>
    </div>

    <el-row :gutter="16" class="stat-row">
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-label">考试次数</div>
          <div class="stat-value">{{ summary.totalCount }}</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-label">平均分</div>
          <div class="stat-value">{{ typeof summary.averageScore === 'number' ? summary.averageScore.toFixed(1) : summary.averageScore }}</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-label">最高分</div>
          <div class="stat-value" style="color:#67c23a">{{ summary.highestScore }}</div>
        </div>
      </el-col>
    </el-row>

    <h3 class="section-title">快捷入口</h3>
    <el-row :gutter="16">
      <el-col v-for="s in shortcuts" :key="s.path" :xs="12" :sm="8" :md="6" :lg="4">
        <div class="shortcut" @click="router.push(s.path)">
          <div class="icon-wrap" :style="{ background: s.color + '22', color: s.color }">
            <el-icon :size="24"><component :is="s.icon" /></el-icon>
          </div>
          <div class="shortcut-body">
            <div class="shortcut-title">{{ s.title }}</div>
            <div class="shortcut-desc">{{ s.desc }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <h3 class="section-title">
      <span>正在进行的考试</span>
      <el-link type="primary" :underline="false" @click="router.push('/student/exams')">查看全部 →</el-link>
    </h3>
    <el-card v-loading="loading" shadow="never">
      <el-empty v-if="!availableExams.length" description="暂无可参加的考试" :image-size="80" />
      <el-table v-else :data="availableExams.slice(0, 5)" size="default">
        <el-table-column prop="sessionName" label="考试名称" />
        <el-table-column prop="startTime" label="开始时间" width="180" />
        <el-table-column prop="endTime" label="结束时间" width="180" />
        <el-table-column label="时长" width="90">
          <template #default="{ row }">{{ row.duration }} 分钟</template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="router.push(`/student/exam-room/${row.id}`)">进入</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.student-home { padding: 4px; }

.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 24px 28px;
  border-radius: 8px;
  margin-bottom: 16px;

  h2 { margin: 0; font-size: 22px; font-weight: 600; }
  .hero-sub { margin: 6px 0 0; opacity: 0.85; font-size: 13px; }
}

.stat-row { margin-bottom: 20px; }
.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 18px 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.stat-label { color: #909399; font-size: 13px; margin-bottom: 6px; }
.stat-value { font-size: 26px; font-weight: 600; color: #303133; }

.section-title {
  margin: 8px 4px 12px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.shortcut {
  background: #fff;
  border-radius: 8px;
  padding: 18px;
  display: flex;
  gap: 14px;
  align-items: center;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: transform 0.15s, box-shadow 0.15s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
}
.icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.shortcut-title { font-size: 15px; font-weight: 600; color: #303133; }
.shortcut-desc { font-size: 12px; color: #909399; margin-top: 4px; }
</style>
