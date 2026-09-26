<script setup lang="ts">import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Calendar, ArrowUp, Aim, CircleClose, Refresh } from '@element-plus/icons-vue';
import { getWeeklyReport, listWeeklyReports } from '@/api/student';
import type { StudyWeeklyReport } from '@/api/student';
const loading = ref(false);
const currentReport = ref<StudyWeeklyReport | null>(null);
const historyReports = ref<StudyWeeklyReport[]>([]);
const generating = ref(false);
const loadData = async () => {
 loading.value = true;
 try {
 const [currentRes, historyRes] = await Promise.all([
 getWeeklyReport(),
 listWeeklyReports({ pageNum: 1, pageSize: 10 }),
 ]);
 if (currentRes.data) {
 currentReport.value = currentRes.data;
 }
 if (historyRes.data) {
 historyReports.value = historyRes.data.records || [];
 }
 }
 catch {
 ElMessage.error('加载周报数据失败');
 }
 finally {
 loading.value = false;
 }
};
onMounted(loadData);
const generateReport = async () => {
 generating.value = true;
 try {
 const res = await getWeeklyReport();
 if (res.data) {
 currentReport.value = res.data;
 ElMessage.success('周报已生成');
 loadData();
 }
 }
 catch {
 ElMessage.error('生成周报失败');
 }
 finally {
 generating.value = false;
 }
};
const accuracyColor = (v?: number) => {
 if (v == null)
 return '#909399';
 if (v >= 80)
 return '#67c23a';
 if (v >= 60)
 return '#e6a23c';
 return '#f56c6c';
};
const formatDateRange = (start: string, end: string) => {
 return `${start} ~ ${end}`;
};
const getWeekLabel = (report: StudyWeeklyReport) => {
 const start = report.weekStart;
 const end = report.weekEnd;
 return `${start.slice(5)} ~ ${end.slice(5)}`;
};
</script>

<template>
  <div class="weekly-report-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div>
        <h2>📊 学习周报</h2>
        <p class="page-desc">每周学习数据分析与建议</p>
      </div>
      <el-button type="primary" :loading="generating" @click="generateReport">
        <el-icon><Refresh /></el-icon>刷新周报
      </el-button>
    </div>

    <!-- 当前周报 -->
    <div v-if="currentReport" class="current-report">
      <el-card shadow="never" class="report-header-card">
        <div class="report-header">
          <div class="report-date">
            <el-icon><Calendar /></el-icon>
            {{ formatDateRange(currentReport.weekStart, currentReport.weekEnd) }}
          </div>
          <div class="report-status" :style="{ color: accuracyColor(currentReport.accuracyRate) }">
            <el-icon><ArrowUp /></el-icon>
            综合正确率 {{ currentReport.accuracyRate }}%
          </div>
        </div>
      </el-card>

      <!-- 核心指标 -->
      <el-row :gutter="16" class="stats-row">
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-icon" style="background: #409eff18; color: #409eff;">
              <el-icon><Calendar /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ currentReport.totalStudyDays }}</div>
              <div class="stat-label">学习天数</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-icon" style="background: #67c23a18; color: #67c23a;">
              <el-icon><Aim /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ currentReport.totalQuestionsDone }}</div>
              <div class="stat-label">做题数</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-icon" style="background: #e6a23c18; color: #e6a23c;">
              <el-icon><ArrowUp /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ currentReport.totalCorrectCount }}</div>
              <div class="stat-label">正确数</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-icon" :style="{ background: accuracyColor(currentReport.accuracyRate) + '18', color: accuracyColor(currentReport.accuracyRate) }">
              <el-icon><ArrowUp /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ currentReport.accuracyRate }}%</div>
              <div class="stat-label">正确率</div>
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 分类统计 -->
      <el-card shadow="never" class="section-card" v-if="currentReport.categoryStats?.length">
        <template #header>
          <div class="card-head">
            <span class="card-title">📚 各分类学习情况</span>
          </div>
        </template>
        <div class="category-list">
          <div
            v-for="stat in currentReport.categoryStats"
            :key="stat.categoryId"
            class="category-item"
          >
            <div class="category-header">
              <span class="category-name">{{ stat.categoryName }}</span>
              <span class="category-accuracy" :style="{ color: accuracyColor(stat.accuracy) }">
                正确率 {{ stat.accuracy }}%
              </span>
            </div>
            <el-progress
              :percentage="stat.accuracy"
              :stroke-width="8"
              :color="accuracyColor(stat.accuracy)"
              :text-inside="true"
            />
            <div class="category-meta">完成 {{ stat.questionsDone }} 题</div>
          </div>
        </div>
      </el-card>

      <!-- 学习建议 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="card-head">
            <span class="card-title">💡 学习建议</span>
          </div>
        </template>
        <div class="suggestions-content">
          <div class="suggestion-item" v-for="(line, index) in currentReport.suggestions.split('\n').filter(l => l.trim())" :key="index">
            <el-icon v-if="line.includes('重点') || line.includes('注意')" color="#f56c6c"><CircleClose /></el-icon>
            <el-icon v-else color="#409eff"><ArrowUp /></el-icon>
            <span>{{ line }}</span>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 暂无周报 -->
    <div v-else class="empty-report">
      <el-empty description="暂无周报数据" :image-size="120" />
      <el-button type="primary" :loading="generating" @click="generateReport" class="generate-btn">
        生成本周周报
      </el-button>
    </div>

    <!-- 历史周报 -->
    <div class="section" v-if="historyReports.length">
      <h3 class="section-title">📋 历史周报</h3>
      <el-table :data="historyReports" size="small">
        <el-table-column label="周次" width="120">
          <template #default="{ row }">{{ getWeekLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="学习天数" width="100">
          <template #default="{ row }">{{ row.totalStudyDays }}天</template>
        </el-table-column>
        <el-table-column label="做题数" width="100">
          <template #default="{ row }">{{ row.totalQuestionsDone }}</template>
        </el-table-column>
        <el-table-column label="正确率" width="100">
          <template #default="{ row }">
            <span :style="{ color: accuracyColor(row.accuracyRate) }">{{ row.accuracyRate }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="生成时间" width="160">
          <template #default="{ row }">{{ row.generatedAt?.slice(0, 16) }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped lang="scss">
.weekly-report-page { padding: 4px; }

.page-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
  h2 { margin: 0; font-size: 20px; font-weight: 600; }
  .page-desc { margin: 4px 0 0; color: #909399; font-size: 13px; }
}

.current-report { margin-bottom: 24px; }

.report-header-card { margin-bottom: 16px; }

.report-header {
  display: flex; justify-content: space-between; align-items: center;
  .report-date {
    display: flex; align-items: center; gap: 8px;
    font-size: 16px; font-weight: 600; color: #303133;
  }
  .report-status {
    display: flex; align-items: center; gap: 8px;
    font-size: 16px; font-weight: 600;
  }
}

.stats-row { margin-bottom: 16px; }

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  display: flex; align-items: center; gap: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.stat-icon {
  width: 40px; height: 40px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}

.stat-info { flex: 1; }

.stat-value { font-size: 20px; font-weight: 600; color: #303133; }

.stat-label { font-size: 12px; color: #909399; }

.section-card { margin-bottom: 16px; }

.card-head { display: flex; align-items: center; justify-content: space-between; }

.card-title { font-size: 14px; font-weight: 600; color: #303133; }

.category-list { display: flex; flex-direction: column; gap: 12px; }

.category-item { padding: 12px; background: #fafafa; border-radius: 6px; }

.category-header {
  display: flex; justify-content: space-between;
  margin-bottom: 8px;
}

.category-name { font-size: 14px; font-weight: 500; color: #303133; }

.category-accuracy { font-size: 14px; font-weight: 600; }

.category-meta { font-size: 12px; color: #909399; margin-top: 4px; }

.suggestions-content { display: flex; flex-direction: column; gap: 8px; }

.suggestion-item {
  display: flex; align-items: flex-start; gap: 8px;
  font-size: 14px; color: #606266;
  line-height: 1.6;
}

.empty-report {
  text-align: center;
  padding: 40px 0;
  .generate-btn { margin-top: 16px; }
}

.section { margin-top: 24px; }

.section-title {
  font-size: 16px; font-weight: 600; color: #303133;
  margin-bottom: 12px;
}
</style>
