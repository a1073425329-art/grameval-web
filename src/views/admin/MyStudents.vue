<script setup lang="ts">
import { computed, onMounted, ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, UserFilled, DataAnalysis, Clock, Warning, Cpu, Close, Download } from '@element-plus/icons-vue'
import { listMyClasses, listMyClassStudents, removeClassStudent } from '@/api/admin'
import type { ClassGroup, ClassStudent } from '@/api/admin'

/* ---------------- 数据 ---------------- */
/** 班级维度：一个老师可带多个班（班主任 + 任课老师合并） */
const myClasses = ref<ClassGroup[]>([])
/** 跨班级去重后的学生（含其所属班级名集合） */
const classStudents = ref<ClassStudent[]>([])
/** 班级筛选：null = 全部班级 */
const activeClassId = ref<number | null>(null)
const loading = ref(false)

const query = reactive({
  keyword: '',
  scoreFilter: '',
})

const load = async () => {
  loading.value = true
  try {
    const [classes, clsStudents] = await Promise.allSettled([
      listMyClasses(),
      listMyClassStudents(),
    ])
    if (classes.status === 'fulfilled') myClasses.value = classes.value.data ?? []
    if (clsStudents.status === 'fulfilled') classStudents.value = clsStudents.value.data ?? []
  } catch { /* handled by interceptor */ }
  finally { loading.value = false }
}

/* ---------------- 班级维度统计 ---------------- */
const classStats = computed(() => ({
  classCount: myClasses.value.length,
  /** 跨班级去重后的学生数（一个学生上多个班只算一个人） */
  uniqueStudents: classStudents.value.length,
  /** 上多个班的学生数 */
  multiClassStudents: classStudents.value.filter((s) => (s.classNames?.length ?? 0) > 1).length,
}))

/** 按班级筛选后的学生（activeClassId 为 null 时返回全部） */
const studentsInScope = computed<ClassStudent[]>(() => {
  if (activeClassId.value == null) return classStudents.value
  return classStudents.value.filter((s) => s.classNames?.includes(
    myClasses.value.find((c) => c.id === activeClassId.value)?.className ?? '',
  ))
})

/** 「按班级」的最终列表：在 studentsInScope 基础上做搜索与成绩段筛选 */
const filteredClassStudents = computed<ClassStudent[]>(() => {
  let data = [...studentsInScope.value]

  if (query.keyword.trim()) {
    const kw = query.keyword.trim().toLowerCase()
    data = data.filter((s) =>
      (s.studentName || s.username)?.toLowerCase().includes(kw) ||
      s.email?.toLowerCase().includes(kw) ||
      s.phone?.includes(kw) ||
      // 也支持按班级名搜索
      s.classNames?.some((c) => c.toLowerCase().includes(kw)),
    )
  }

  if (query.scoreFilter === 'low') {
    data = data.filter((s) => s.averageScore != null && s.averageScore < 60)
  } else if (query.scoreFilter === 'mid') {
    data = data.filter((s) => s.averageScore != null && s.averageScore >= 60 && s.averageScore < 80)
  } else if (query.scoreFilter === 'high') {
    data = data.filter((s) => s.averageScore != null && s.averageScore >= 80)
  }

  // 按平均分降序，无成绩排末尾
  return data.sort((a, b) => {
    const av = a.averageScore != null ? Number(a.averageScore) : null
    const bv = b.averageScore != null ? Number(b.averageScore) : null
    if (av != null && bv != null) return bv - av
    if (av != null) return -1
    if (bv != null) return 1
    return (b.examCount ?? 0) - (a.examCount ?? 0)
  })
})

/* ---------------- 统计卡片（班级学生维度） ---------------- */
const stats = computed(() => {
  const total = classStudents.value.length
  const active = classStudents.value.filter(s => s.status !== 0).length
  const disabled = total - active
  const withScore = classStudents.value.filter(s => s.averageScore != null)
  const avgAll = withScore.length
    ? withScore.reduce((sum, s) => sum + Number(s.averageScore), 0) / withScore.length
    : null
  // 薄弱学生：平均分 < 60
  const weakCount = withScore.filter(s => Number(s.averageScore) < 60).length
  // 未登录过的
  const neverLogin = classStudents.value.filter(s => !s.lastLoginTime).length
  return { total, active, disabled, avgAll, weakCount, neverLogin }
})

/** 从当前班级移除某个学生（只解绑该班，其所在其他班级不受影响） */
const removeFromClass = async (s: ClassStudent) => {
  const classId = activeClassId.value
  if (classId == null) return
  const cname = myClasses.value.find((c) => c.id === classId)?.className ?? '该班级'
  try {
    await ElMessageBox.confirm(
      `确认将学生「${s.studentName || s.username}」移出「${cname}」？\n` +
      `若该生还在其他班级，其班级关系不受影响。`,
      '移出班级',
      { type: 'warning' },
    )
    await removeClassStudent(classId, s.studentId)
    ElMessage.success('已移出该班级')
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

/* ---------------- CSV 导出（按班级当前列表） ---------------- */
const exporting = ref(false)
const escapeCsv = (val: unknown): string => {
  if (val == null) return ''
  const s = String(val)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
const exportCsv = () => {
  if (!filteredClassStudents.value.length) {
    ElMessage.warning('当前列表无数据')
    return
  }
  exporting.value = true
  try {
    const headers = ['学生ID', '用户名', '姓名', '班级', '邮箱', '手机号', '性别', '考试次数', '平均分', '最近成绩', '错题数', '状态', '最后登录']
    const rows = filteredClassStudents.value.map((s) => [
      s.studentId,
      s.username,
      s.studentName ?? '',
      (s.classNames ?? []).join('、'),
      s.email ?? '',
      s.phone ?? '',
      s.gender === 1 ? '男' : s.gender === 2 ? '女' : '未知',
      s.examCount ?? 0,
      s.averageScore != null ? Number(s.averageScore).toFixed(1) : '',
      s.recentScore != null ? Number(s.recentScore).toFixed(1) : '',
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
    ElMessage.success(`已导出 ${filteredClassStudents.value.length} 条数据`)
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
          <div class="stat-label">学生总数</div>
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

    <!-- ============ 按班级（多对多主视图） ============ -->
    <el-card shadow="never">
      <div class="class-head">
        <div>
          <h3 class="title">我带的班级</h3>
          <p class="title-sub">
            班级仅用于快速筛选学生；一个学生可加入多个班级，一个班级可有多位任课老师。
            题目、试卷与考试数据不与班级绑定。
          </p>
        </div>
        <div class="class-stats">
          <span class="mini-stat"><b>{{ classStats.classCount }}</b> 个班级</span>
          <el-divider direction="vertical" />
          <span class="mini-stat"><b>{{ classStats.uniqueStudents }}</b> 名学生</span>
          <el-divider direction="vertical" />
          <span class="mini-stat"><b>{{ classStats.multiClassStudents }}</b> 人跨班</span>
        </div>
      </div>

      <div class="class-chips">
        <div class="class-chip all" :class="{ active: activeClassId === null }" @click="activeClassId = null">
          <span class="chip-name">全部班级</span>
          <span class="chip-count">{{ classStudents.length }}</span>
        </div>
        <div
          v-for="c in myClasses"
          :key="c.id"
          class="class-chip"
          :class="{ active: activeClassId === c.id }"
          :title="`${c.className}${c.grade ? ' · ' + c.grade : ''} · 任课老师：${(c.teacherNames ?? []).join('、') || '未设置'}`"
          @click="activeClassId = c.id"
        >
          <span class="chip-name">{{ c.className }}</span>
          <el-tag v-if="(c.teacherNames?.length ?? 0) > 1" size="small" type="warning" effect="plain">
            {{ c.teacherNames?.length }} 位老师
          </el-tag>
          <span class="chip-count">{{ c.studentCount ?? 0 }}</span>
        </div>
        <el-empty v-if="!myClasses.length && !loading" description="暂未分配班级" :image-size="60" />
      </div>

      <div class="cls-toolbar">
        <el-input
          v-model="query.keyword"
          placeholder="搜索姓名 / 邮箱 / 手机号……"
          :prefix-icon="Search"
          clearable
          style="width: 200px;"
        />
        <el-select v-model="query.scoreFilter" placeholder="成绩筛选" clearable style="width: 130px;">
          <el-option label="全部" value="" />
          <el-option label="薄弱 (&lt;60)" value="low" />
          <el-option label="中等 (60-80)" value="mid" />
          <el-option label="优秀 (≥80)" value="high" />
        </el-select>
        <el-button :icon="Refresh" @click="load" :loading="loading">刷新</el-button>
        <el-button :loading="exporting" @click="exportCsv">
          <el-icon><Download /></el-icon>导出 CSV
        </el-button>
        <el-button type="primary" size="small" @click="$router.push('/admin/ai-compose')">
          <el-icon><Cpu /></el-icon>AI学生分析
        </el-button>
      </div>

      <el-empty
        v-if="!loading && !filteredClassStudents.length"
        :description="activeClassId === null ? '所带班级暂无学生' : '该班暂无学生'"
      />

      <el-table
        v-else-if="!loading && filteredClassStudents.length"
        v-loading="loading"
        :data="filteredClassStudents"
        style="width:100%"
        stripe
      >
        <el-table-column type="index" label="#" width="55" />
        <el-table-column label="学生" min-width="150">
          <template #default="{ row }">
            <el-avatar :size="30" :src="row.avatar || '/avatars/student.jpg'" style="margin-right:8px">
              <el-icon><UserFilled /></el-icon>
            </el-avatar>
            <div>
              <div>{{ row.studentName || row.username }}</div>
              <div style="font-size:12px;color:#909399">@{{ row.username }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="所属班级" min-width="180">
          <template #default="{ row }">
            <el-tag
              v-for="(cn, i) in row.classNames"
              :key="i"
              size="small"
              effect="plain"
              :type="i === 0 ? 'primary' : 'success'"
              class="cls-tag"
            >{{ cn }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="性别" width="70" align="center">
          <template #default="{ row }">
            <span :style="{ color: genderColor(row.gender) }">{{ genderLabel(row.gender) || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="考试次数" width="90" align="center">
          <template #default="{ row }">{{ row.examCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="平均分" width="90" align="center">
          <template #default="{ row }">
            <span :class="['score-badge', scoreClass(row.averageScore)]">
              {{ row.averageScore != null ? Number(row.averageScore).toFixed(0) : '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="最近成绩" width="90" align="center">
          <template #default="{ row }">
            <span :class="['score-badge', scoreClass(row.recentScore)]">
              {{ row.recentScore != null ? Number(row.recentScore).toFixed(0) : '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="错题数" width="85" align="center">
          <template #default="{ row }">
            <span :class="{ 'wrong-num': (row.wrongCount ?? 0) > 0 }">{{ row.wrongCount ?? 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="85">
          <template #default="{ row }">
            <el-tag :type="(row.status ?? 1) === 0 ? 'danger' : 'success'" size="small" effect="light">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <el-tooltip content="从当前班级移除" placement="top">
              <el-button link type="danger" size="small" @click="removeFromClass(row)">
                <el-icon><Close /></el-icon>
              </el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
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

/* ---------------- 班级面板（快速选人） ---------------- */
.class-panel { margin-bottom: 2px; }
.class-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; margin-bottom: 14px;
}
.title { margin: 0; font-size: 16px; font-weight: 600; color: #303133; }
.title-sub {
  margin: 4px 0 0; font-size: 12px; color: #909399; line-height: 1.6; max-width: 720px;
}
.class-stats { display: flex; align-items: center; flex-shrink: 0; }
.mini-stat { font-size: 12px; color: #909399; white-space: nowrap; }
.mini-stat b { font-size: 16px; color: #303133; margin: 0 2px; }

.class-chips { display: flex; flex-wrap: wrap; gap: 10px; }
.class-chip {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  border: 1px solid #e4e7ed; border-radius: 999px;
  background: #fff; cursor: pointer;
  transition: all 0.18s ease;
  &:hover { border-color: #a3cfff; background: #f5f9ff; }
  &.active {
    border-color: #409eff; background: #ecf5ff; color: #1a73e8;
    .chip-count { background: #409eff; color: #fff; }
  }
  &.all { border-style: dashed; }
}
.chip-name { font-size: 13px; font-weight: 500; }
.chip-count {
  min-width: 20px; padding: 0 6px;
  border-radius: 999px; background: #f0f2f5; color: #606266;
  font-size: 12px; font-weight: 600; text-align: center;
  font-variant-numeric: tabular-nums;
}

.class-detail {
  margin-top: 14px; padding: 12px 16px;
  border: 1px dashed #d9ecff; border-radius: 10px;
  background: #f7fbff;
}
.detail-head { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
.detail-title { font-size: 14px; font-weight: 600; color: #1f2d3d; }
.detail-teachers { font-size: 12px; color: #909399; display: inline-flex; align-items: center; gap: 6px; }
.teacher-tag { margin-right: 2px; }
.detail-body { display: flex; flex-wrap: wrap; gap: 8px; }
.stu-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px; border: 1px solid #ebeef5; border-radius: 8px;
  background: #fff; font-size: 12px;
}
.muted { font-size: 12px; color: #c0c4cc; }

/* ---------------- 工具栏 ---------------- */
.cls-toolbar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 10px;
  margin: 14px 0 12px;
}
.cls-tag { margin-right: 4px; }

/* ---------------- 表格 ---------------- */
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
.wrong-num  { color: #f56c6c; font-weight: 600; }

/* ---------------- 响应式 ---------------- */
@media (max-width: 1200px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
