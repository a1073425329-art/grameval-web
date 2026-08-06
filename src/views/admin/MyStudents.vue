<script setup lang="ts">
import { computed, onMounted, ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, UserFilled, Plus, Close, DataAnalysis, Clock, Warning, InfoFilled, List, Grid, Cpu } from '@element-plus/icons-vue'
import { listMyStudents, listUnassignedStudents, bindMyStudents } from '@/api/admin'
import type { AdminStudent } from '@/types/admin'
import type { UserDetail } from '@/types/user'
import { useViewMode } from '@/composables/useViewMode'

/* ---------------- 数据 ---------------- */
const { viewMode, toggleViewMode } = useViewMode('my_students')

const list = ref<AdminStudent[]>([])
const unassigned = ref<UserDetail[]>([])
const loading = ref(false)

const query = reactive({
  keyword: '',
  gender: undefined as number | undefined,
  scoreFilter: '',
  status: undefined as number | undefined,
  hasExam: undefined as boolean | undefined,
})

const load = async () => {
  loading.value = true
  try {
    const [my, un] = await Promise.allSettled([
      listMyStudents(),
      listUnassignedStudents(),
    ])
    if (my.status === 'fulfilled') list.value = my.value.data ?? []
    if (un.status === 'fulfilled') unassigned.value = un.value.data ?? []
  } catch { /* handled by interceptor */ }
  finally { loading.value = false }
}

/* ---------------- 统计卡片 ---------------- */
const stats = computed(() => {
  const total = list.value.length
  const active = list.value.filter(s => s.status !== 0).length
  const disabled = total - active
  const withScore = list.value.filter(s => s.averageScore != null)
  const avgAll = withScore.length
    ? withScore.reduce((sum, s) => sum + (s.averageScore ?? 0), 0) / withScore.length
    : null
  // 薄弱学生：平均分 < 60
  const weakCount = withScore.filter(s => (s.averageScore ?? 0) < 60).length
  // 未登录过的
  const neverLogin = list.value.filter(s => !s.lastLoginTime).length
  return { total, active, disabled, avgAll, weakCount, neverLogin }
})

/* ---------------- 排序后的列表 ---------------- */
const sortedList = computed(() => {
  let data = [...list.value]

  // 搜索过滤
  if (query.keyword.trim()) {
    const kw = query.keyword.trim().toLowerCase()
    data = data.filter(s =>
      (s.realName || s.displayName || s.username)?.toLowerCase().includes(kw) ||
      s.email?.toLowerCase().includes(kw) ||
      s.phone?.includes(kw)
    )
  }

  // 性别过滤
  if (query.gender != null) {
    data = data.filter(s => s.gender === query.gender)
  }

  // 状态过滤
  if (query.status != null) {
    data = data.filter(s => s.status === query.status)
  }

  // 有无考试记录过滤
  if (query.hasExam != null) {
    if (query.hasExam) {
      data = data.filter(s => (s.examCount ?? 0) > 0)
    } else {
      data = data.filter(s => (s.examCount ?? 0) === 0)
    }
  }

  // 分数段过滤
  if (query.scoreFilter === 'low') {
    data = data.filter(s => (s.averageScore ?? 100) < 60)
  } else if (query.scoreFilter === 'mid') {
    data = data.filter(s => (s.averageScore ?? 0) >= 60 && (s.averageScore ?? 0) < 80)
  } else if (query.scoreFilter === 'high') {
    data = data.filter(s => (s.averageScore ?? 0) >= 80)
  }

  // 按平均分降序，无成绩排末尾
  return data.sort((a, b) => {
    if (a.averageScore != null && b.averageScore != null) return b.averageScore - a.averageScore
    if (a.averageScore != null) return -1
    if (b.averageScore != null) return 1
    return (b.examCount ?? 0) - (a.examCount ?? 0)
  })
})

/* ---------------- 绑定弹窗 ---------------- */
const bindVisible = ref(false)
const selected = ref<number[]>([])
const submitting = ref(false)

const pool = computed<UserDetail[]>(() => {
  const already: UserDetail[] = list.value.map((r) => ({
    id: r.studentId,
    username: r.username,
    realName: r.realName || r.displayName || '',
    email: r.email,
    phone: r.phone,
    avatar: r.avatar,
    role: 'STUDENT',
    status: (r.status ?? 1) as 0 | 1,
    createTime: '',
  }))
  const alreadyIds = new Set(already.map((s) => s.id))
  const rest = unassigned.value.filter((u) => !alreadyIds.has(u.id))
  return [...already, ...rest]
})

const openBind = () => {
  selected.value = list.value.map((r) => r.studentId)
  bindVisible.value = true
}

const doBind = async () => {
  submitting.value = true
  try {
    await bindMyStudents(selected.value)
    bindVisible.value = false
    ElMessage.success('绑定关系已更新')
    await load()
  } catch { /* handled */ }
  finally { submitting.value = false }
}

const unbindOne = async (row: AdminStudent) => {
  try {
    await ElMessageBox.confirm(
      `确认取消绑定学生「${row.realName || row.displayName || row.username}」？`,
      '取消绑定',
      { type: 'warning' }
    )
    const remain = list.value
      .filter((r) => r.studentId !== row.studentId)
      .map((r) => r.studentId)
    await bindMyStudents(remain)
    ElMessage.success('已取消绑定')
    await load()
  } catch { /* cancelled */ }
}

/* ---------------- 工具函数 ---------------- */
const genderLabel = (g?: number) => g === 1 ? '男' : g === 2 ? '女' : ''
const genderColor = (g?: number) => g === 1 ? '#409eff' : g === 2 ? '#f56c6c' : '#909399'
const statusLabel = (s?: number) => s === 0 ? '已禁用' : '正常'
const scoreClass = (v?: number) => {
  if (v == null) return 'score-na'
  if (v >= 80) return 'score-high'
  if (v >= 60) return 'score-mid'
  return 'score-low'
}
const formatDate = (s?: string) => {
  if (!s) return '-'
  return s.split('T')[0] ?? s.substring(0, 10)
}
const formatDateTime = (s?: string) => {
  if (!s) return '-'
  return s.substring(0, 16).replace('T', ' ')
}
const trainingDaysLabel = (d?: string) => {
  if (!d) return '-'
  const map: Record<string, string> = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '日' }
  return d.split(',').map(n => map[n.trim()] ?? n).join(' ') || '-'
}

/* ---------------- CSV 导出 ---------------- */
const exporting = ref(false)
const escapeCsv = (val: unknown): string => {
  if (val == null) return ''
  const s = String(val)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
const exportCsv = () => {
  if (!sortedList.value.length) {
    ElMessage.warning('当前列表无数据')
    return
  }
  exporting.value = true
  try {
    const headers = ['学生ID', '用户名', '姓名', '英文名', '邮箱', '手机号', '性别', '考试次数', '平均分', '最近成绩', '错题数', '状态', '最后登录']
    const rows = sortedList.value.map((s) => [
      s.studentId,
      s.username,
      s.realName ?? s.displayName ?? '',
      s.englishName ?? '',
      s.email ?? '',
      s.phone ?? '',
      s.gender === 1 ? '男' : s.gender === 2 ? '女' : '未知',
      s.examCount ?? 0,
      s.averageScore != null ? s.averageScore.toFixed(1) : '',
      s.recentScore != null ? s.recentScore.toFixed(1) : '',
      s.wrongCount ?? 0,
      (s.status ?? 1) === 0 ? '禁用' : '正常',
      s.lastLoginTime ?? '',
    ].map(escapeCsv).join(','))
    const csv = '\ufeff' + headers.join(',') + '\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=UTF-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `我的学生-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${sortedList.value.length} 条数据`)
  } finally {
    exporting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <!-- ============ 统计卡片 ============ -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon" style="background: #ecf5ff;color: #409eff;">
          <el-icon :size="24"><UserFilled /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ stats.total }}<span class="stat-unit">人</span></div>
          <div class="stat-label">已绑定学生</div>
          <div class="stat-sub">
            正常 {{ stats.active }} · 禁用 {{ stats.disabled }}
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: #f0f9eb;color: #67c23a;">
          <el-icon :size="24"><DataAnalysis /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">
            {{ stats.avgAll != null ? stats.avgAll.toFixed(1) : '-' }}
            <span class="stat-unit">分</span>
          </div>
          <div class="stat-label">平均成绩</div>
          <div class="stat-sub">百分制</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: #fdf6ec;color: #e6a23c;">
          <el-icon :size="24"><Warning /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ stats.weakCount }}<span class="stat-unit">人</span></div>
          <div class="stat-label">薄弱学生</div>
          <div class="stat-sub">平均分 &lt; 60</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: #fef0f0;color: #f56c6c;">
          <el-icon :size="24"><Clock /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ stats.neverLogin }}<span class="stat-unit">人</span></div>
          <div class="stat-label">从未登录</div>
          <div class="stat-sub">待激活</div>
        </div>
      </div>
    </div>

    <!-- ============ 主表格 ============ -->
    <el-card shadow="never">
      <!-- 头部工具栏 -->
      <div class="card-head">
        <div>
          <h3 class="title">学生档案</h3>
        </div>
        <div class="head-actions">
          <el-input
            v-model="query.keyword"
            placeholder="搜索姓名 / 邮箱 / 手机号……"
            :prefix-icon="Search"
            clearable
            style="width: 200px;"
          />
          <el-select v-model="query.gender" placeholder="性别" clearable style="width: 100px;">
            <el-option label="男" :value="1" />
            <el-option label="女" :value="2" />
          </el-select>
          <el-select v-model="query.status" placeholder="状态" clearable style="width: 100px;">
            <el-option label="正常" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
          <el-select v-model="query.hasExam" placeholder="考试记录" clearable style="width: 120px;">
            <el-option label="有考试" :value="true" />
            <el-option label="无考试" :value="false" />
          </el-select>
          <el-select v-model="query.scoreFilter" placeholder="成绩筛选" clearable style="width: 130px;">
            <el-option label="全部" value="" />
            <el-option label="薄弱 (&lt;60)" value="low" />
            <el-option label="中等 (60-80)" value="mid" />
            <el-option label="优秀 (≥80)" value="high" />
          </el-select>
          <el-button :icon="Refresh" @click="load" :loading="loading">刷新</el-button>
          <el-button type="primary" :icon="Plus" @click="openBind">管理绑定</el-button>
          <el-button :loading="exporting" @click="exportCsv">
            <el-icon><Download /></el-icon>导出 CSV
          </el-button>
          <el-button type="primary" size="small" @click="$router.push('/admin/ai-assistant')">
            <el-icon><Cpu /></el-icon>AI学生分析
          </el-button>
          <el-button @click="toggleViewMode" :type="viewMode === 'card' ? 'primary' : 'default'" size="small">
            <el-icon><List v-if="viewMode === 'card'" /><Grid v-else /></el-icon>
            {{ viewMode === 'card' ? '表格' : '卡片' }}
          </el-button>
        </div>
      </div>

      <el-empty v-if="!loading && !sortedList.length" description="暂无学生数据" />

      <!-- 表格布局 -->
      <el-table v-if="!loading && sortedList.length && viewMode === 'table'" :data="sortedList" style="width:100%">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column label="学生" min-width="160">
          <template #default="{ row }">
            <el-avatar :size="32" :src="row.avatar || '/avatars/student.jpg'" style="margin-right:8px">
              <el-icon><UserFilled /></el-icon>
            </el-avatar>
            <div>
              <div>{{ row.realName || row.displayName || row.username }}</div>
              <div style="font-size:12px;color:#909399">@{{ row.username }} <span v-if="row.englishName">{{ row.englishName }}</span></div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="性别" width="80" align="center">
          <template #default="{ row }">
            <span :style="{ color: genderColor(row.gender) }">{{ genderLabel(row.gender) || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" width="180" show-overflow-tooltip />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column label="考试次数" width="100" align="center">
          <template #default="{ row }">{{ row.examCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="平均分" width="100" align="center">
          <template #default="{ row }">
            <span :class="['score-badge', scoreClass(row.averageScore)]">
              {{ row.averageScore != null ? row.averageScore.toFixed(0) : '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="最近成绩" width="100" align="center">
          <template #default="{ row }">
            <span :class="['score-badge', scoreClass(row.recentScore)]">
              {{ row.recentScore != null ? row.recentScore.toFixed(0) : '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="错题数" width="100" align="center">
          <template #default="{ row }">
            <span :class="{ 'wrong-num': (row.wrongCount ?? 0) > 0 }">{{ row.wrongCount ?? 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="(row.status ?? 1) === 0 ? 'danger' : 'success'" size="small" effect="light">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastLoginTime" label="最后登录" width="160" />
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-popconfirm
              :title="`确认解绑「${row.realName || row.displayName || row.username}」？`"
              confirm-button-text="解绑"
              cancel-button-text="取消"
              @confirm="unbindOne(row)"
            >
              <template #reference>
                <el-button link type="danger" size="small">解绑</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <!-- 卡片网格布局 -->
      <div v-else-if="sortedList.length" class="student-grid" v-loading="loading">
        <el-card
          v-for="item in sortedList"
          :key="item.studentId"
          class="student-card"
          hover
        >
          <div class="card-header">
            <el-avatar :size="44" :src="item.avatar || '/avatars/student.jpg'">
              <el-icon><UserFilled /></el-icon>
            </el-avatar>
            <div class="stu-info">
              <div class="stu-name">
                {{ item.realName || item.displayName || item.username }}
                <el-tag :type="(item.status ?? 1) === 0 ? 'danger' : 'success'" size="small" effect="light">
                  {{ statusLabel(item.status) }}
                </el-tag>
              </div>
              <div class="stu-meta">
                <span class="stu-username">@{{ item.username }}</span>
                <span v-if="item.englishName" class="stu-english" style="color: #909399;font-size:12px;">
                  {{ item.englishName }}
                </span>
                <span v-if="genderLabel(item.gender)" class="stu-gender" :style="{ color: genderColor(item.gender) }">
                  {{ genderLabel(item.gender) }}
                </span>
              </div>
            </div>
          </div>
          <div class="card-body">
            <div class="info-row">
              <span class="info-label">邮箱</span>
              <span class="info-value">{{ item.email || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">手机号</span>
              <span class="info-value">{{ item.phone || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">训练开始</span>
              <span class="info-value">{{ formatDate(item.trainingStartDate) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">训练日</span>
              <span class="info-value">{{ trainingDaysLabel(item.trainingDays) }}</span>
            </div>
          </div>
          <div class="card-stats">
            <div class="stat-item">
              <span class="stat-num">{{ item.examCount ?? 0 }}</span>
              <span class="stat-label">考试</span>
            </div>
            <div class="stat-item">
              <span class="stat-num" :class="['score-badge', scoreClass(item.averageScore)]">
                {{ item.averageScore != null ? item.averageScore.toFixed(0) : '-' }}
              </span>
              <span class="stat-label">平均分</span>
            </div>
            <div class="stat-item">
              <span class="stat-num" :class="['score-badge', scoreClass(item.recentScore)]">
                {{ item.recentScore != null ? item.recentScore.toFixed(0) : '-' }}
              </span>
              <span class="stat-label">最近</span>
            </div>
            <div class="stat-item">
              <span class="stat-num" :class="{ 'wrong-num': (item.wrongCount ?? 0) > 0 }">{{ item.wrongCount ?? 0 }}</span>
              <span class="stat-label">错题</span>
            </div>
          </div>
          <div class="card-footer">
            <span class="last-login">{{ formatDateTime(item.lastLoginTime) }}</span>
            <el-popconfirm
              :title="`确认解绑「${item.realName || item.displayName || item.username}」？`"
              confirm-button-text="解绑"
              cancel-button-text="取消"
              @confirm="unbindOne(item)"
            >
              <template #reference>
                <el-button link type="danger" size="small">解绑</el-button>
              </template>
            </el-popconfirm>
          </div>
        </el-card>
      </div>

      <!-- 底部汇总 -->
      <div v-if="sortedList.length" class="table-summary">
        共 <b>{{ sortedList.length }}</b> 名学生
        <template v-if="query.keyword || query.scoreFilter || query.gender != null || query.status != null || query.hasExam != null">（筛选自 {{ list.length }} 人）</template>
      </div>
    </el-card>

    <!-- ============ 绑定管理弹窗 ============ -->
    <el-dialog v-model="bindVisible" title="管理学生绑定关系" width="680px" top="4vh">
      <div class="dialog-hint">
        <el-icon style="vertical-align: -2px;"><InfoFilled /></el-icon>
        选中即绑定，取消勾选即解绑。保存时对当前列表进行<b>全量替换</b>。
      </div>

      <div class="pool-stats">
        可选 <b>{{ pool.length }}</b> 人 · 已选 <b style="color: #409eff;">{{ selected.length }}</b> 人
      </div>

      <el-checkbox-group v-model="selected" class="pool">
        <div
          v-for="s in pool"
          :key="s.id"
          class="pool-item"
          :class="{ 'is-checked': selected.includes(s.id) }"
        >
          <el-checkbox :value="s.id">
            <div class="cell">
              <el-avatar :size="28" :src="s.avatar || '/avatars/student.jpg'" style="flex-shrink:0;">
                <el-icon><UserFilled /></el-icon>
              </el-avatar>
              <span class="pn">{{ s.realName || s.username }}</span>
              <span class="pu">@{{ s.username }}</span>
              <span v-if="s.email" class="pe">{{ s.email }}</span>
            </div>
          </el-checkbox>
        </div>
      </el-checkbox-group>

      <template #footer>
        <el-button @click="bindVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="doBind">
          保存（已选 {{ selected.length }} 人）
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
/* ---------------- 页面 ---------------- */
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---------------- 统计卡片 ---------------- */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: box-shadow 0.2s;
  &:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
}
.stat-icon {
  width: 48px; height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-body { flex: 1; min-width: 0; }
.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}
.stat-unit {
  font-size: 13px;
  font-weight: 400;
  color: #909399;
  margin-left: 2px;
}
.stat-label {
  font-size: 13px;
  color: #606266;
  margin-top: 2px;
}
.stat-sub {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 1px;
}

/* ---------------- 卡片头部 ---------------- */
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
  .title { margin: 0; font-size: 16px; font-weight: 600; color: #303133; }
}
.head-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

/* ---------------- 表格 ---------------- */
.student-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.stu-info { min-width: 0; }
.stu-name {
  font-weight: 500;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-tag { font-size: 11px; line-height: 18px; height: 20px; padding: 0 6px; }
.stu-meta { display: flex; gap: 8px; font-size: 12px; color: #909399; margin-top: 2px; }
.stu-username { color: #909399; }
.stu-gender { font-weight: 500; }
.na-text { color: #c0c4cc; }

.score-badge {
  display: inline-block;
  min-width: 32px;
  text-align: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 13px;
}
.score-high { color: #67c23a; background: #f0f9eb; }
.score-mid  { color: #e6a23c; background: #fdf6ec; }
.score-low  { color: #f56c6c; background: #fef0f0; }
.score-na   { color: #c0c4cc; }
.count-num  { font-weight: 500; color: #606266; }
.wrong-num  { color: #f56c6c; font-weight: 600; }

.table-summary {
  margin-top: 12px;
  font-size: 13px;
  color: #909399;
  b { color: #303133; }
}

/* ---------------- 卡片网格 ---------------- */
.student-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}

.student-card {
  transition: all 0.2s;
  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 12px;
}

.card-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 11px;
  color: #909399;
}

.info-value {
  font-size: 13px;
  color: #606266;
}

.card-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}

.stat-label {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.last-login {
  font-size: 12px;
  color: #909399;
}

/* ---------------- 绑定弹窗 ---------------- */
.dialog-hint {
  color: #909399;
  font-size: 13px;
  margin-bottom: 10px;
  line-height: 1.6;
}
.pool-stats {
  font-size: 13px;
  color: #606266;
  margin-bottom: 10px;
}
.pool {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  max-height: 420px;
  overflow-y: auto;
  padding: 8px 4px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafafa;
}
.pool-item {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: all 0.15s;
  &:hover { background: #fff; border-color: #d9ecff; }
  &.is-checked { background: #ecf5ff; border-color: #b3d8ff; }
}
.cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pn { font-weight: 500; color: #303133; }
.pu { font-size: 12px; color: #909399; }
.pe { font-size: 12px; color: #c0c4cc; margin-left: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; }

/* ---------------- 响应式 ---------------- */
@media (max-width: 1200px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .pool { grid-template-columns: 1fr; }
}
</style>
