<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listMyStudents, listUnassignedStudents, bindMyStudents } from '@/api/admin'
import type { AdminStudent } from '@/types/admin'
import type { UserDetail } from '@/types/user'

const list = ref<AdminStudent[]>([])
const unassigned = ref<UserDetail[]>([])
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const [my, un] = await Promise.allSettled([
      listMyStudents(),
      listUnassignedStudents(),
    ])
    if (my.status === 'fulfilled') list.value = my.value.data ?? []
    if (un.status === 'fulfilled') unassigned.value = un.value.data ?? []
  } finally { loading.value = false }
}

/* ---------------- 绑定弹窗 ---------------- */
const bindVisible = ref(false)
const selected = ref<number[]>([])
const submitting = ref(false)

/** 打开弹窗时把当前已绑定 + 未绑定合并成"可选池"，选中态标记为已绑定 */
const pool = computed<UserDetail[]>(() => {
  const already: UserDetail[] = list.value.map((r) => ({
    id: r.student.id,
    username: r.student.username,
    realName: r.student.realName || '',
    email: r.student.email,
    phone: r.student.phone,
    avatar: r.student.avatar,
    role: 'STUDENT',
    status: 1,
    createTime: '',
  }))
  const alreadyIds = new Set(already.map((s) => s.id))
  const rest = unassigned.value.filter((u) => !alreadyIds.has(u.id))
  return [...already, ...rest]
})

const openBind = () => {
  selected.value = list.value.map((r) => r.student.id)
  bindVisible.value = true
}

const doBind = async () => {
  submitting.value = true
  try {
    await bindMyStudents(selected.value)
    bindVisible.value = false
    ElMessage.success('绑定关系已更新')
    load()
  } catch { /* handled */ } finally { submitting.value = false }
}

const unbindOne = async (row: AdminStudent) => {
  try {
    await ElMessageBox.confirm(
      `确认取消绑定学生「${row.student.realName || row.student.username}」？`,
      '取消绑定',
      { type: 'warning' }
    )
    const remain = list.value.filter((r) => r.id !== row.id).map((r) => r.student.id)
    await bindMyStudents(remain)
    ElMessage.success('已取消绑定')
    load()
  } catch { /* cancelled */ }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <el-card shadow="never">
      <div class="head">
        <div>
          <h3 class="title">我的学生</h3>
          <p class="sub">当前已绑定 <b>{{ list.length }}</b> 名学生 · 未绑定则可见系统全部学生</p>
        </div>
        <el-button type="primary" @click="openBind">
          <el-icon><Plus /></el-icon>管理绑定关系
        </el-button>
      </div>

      <el-empty v-if="!loading && !list.length" description="未绑定学生，当前可见系统全部学生" />

      <el-table v-else :data="list" v-loading="loading" style="width:100%">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column label="学生" min-width="180">
          <template #default="{ row }">
            <div class="student-cell">
              <el-avatar :size="32" :src="row?.student?.avatar || '/avatars/student.jpg'">
                <el-icon><UserFilled /></el-icon>
              </el-avatar>
              <div>
                <div class="name">{{ row.student?.realName || row.student?.username }}</div>
                <div class="uname">{{ row.student?.username }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="student.email" label="邮箱" min-width="180" />
        <el-table-column prop="student.phone" label="手机号" width="140" />
        <el-table-column prop="createdAt" label="绑定时间" width="180" />
        <el-table-column prop="remark" label="备注" min-width="120" />
        <el-table-column label="操作" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="danger" size="small" @click="unbindOne(row)">解绑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 绑定管理弹窗 -->
    <el-dialog v-model="bindVisible" title="管理学生绑定关系" width="620px" top="6vh">
      <div class="dialog-hint">
        选中即绑定，取消勾选即解绑。保存时对当前列表进行全量替换。
      </div>
      <el-checkbox-group v-model="selected" class="pool">
        <div v-for="s in pool" :key="s.id" class="pool-item">
          <el-checkbox :value="s.id">
            <div class="cell">
              <span class="pn">{{ s.realName || s.username }}</span>
              <span class="pu">{{ s.username }}</span>
              <span v-if="s.email" class="pe">{{ s.email }}</span>
            </div>
          </el-checkbox>
        </div>
      </el-checkbox-group>

      <template #footer>
        <span style="margin-right:12px; color:#909399">已选 {{ selected.length }} 人</span>
        <el-button @click="bindVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="doBind">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
  .title { margin: 0; font-size: 18px; font-weight: 600; }
  .sub { margin: 4px 0 0; color: #909399; font-size: 13px; }
}

.student-cell { display: flex; align-items: center; gap: 10px; }
.name { font-weight: 500; color: #303133; }
.uname { font-size: 12px; color: #909399; }

.dialog-hint { color: #909399; font-size: 13px; margin-bottom: 12px; }
.pool {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
  padding: 8px 4px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}
.pool-item { padding: 6px 10px; border-radius: 4px; transition: background 0.15s; }
.pool-item:hover { background: #f5f7fa; }
.cell { display: flex; align-items: baseline; gap: 6px; }
.pn { font-weight: 500; color: #303133; }
.pu { font-size: 12px; color: #909399; }
.pe { font-size: 12px; color: #c0c4cc; margin-left: auto; }
</style>
