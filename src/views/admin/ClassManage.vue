<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { listClassGroups, getClassGroup, createClassGroup, updateClassGroup, deleteClassGroup, getClassStudents, assignClassStudents, removeClassStudent } from '@/api/classGroup'
import { listUsers as listUsersApi } from '@/api/admin'
import type { ClassGroup, ClassGroupForm, ClassStudent } from '@/types/classGroup'
import { FormLimits } from '@/utils/formLimits'

const classes = ref<ClassGroup[]>([])
const loading = ref(false)
const total = ref(0)
const query = reactive({ pageNum: 1, pageSize: 20 })

const load = async () => {
  loading.value = true
  try {
    const res = await listClassGroups(query)
    classes.value = res.data?.records ?? []
    total.value = res.data?.total ?? 0
  } finally { loading.value = false }
}

onMounted(load)

/* ---- Group Dialog ---- */
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<ClassGroupForm & { id: number }>({ id: 0, className: '', schoolName: '', grade: '', description: '', status: 1 })
const rules: FormRules = { className: [{ required: true, message: '请输入班级名称', trigger: 'blur' }] }

const openCreate = () => {
  Object.assign(form, { id: 0, className: '', schoolName: '', grade: '', description: '', status: 1 })
  dialogVisible.value = true
}
const openEdit = async (row: ClassGroup) => {
  const res = await getClassGroup(row.id)
  const d = res.data
  Object.assign(form, { id: d.id, className: d.className, schoolName: d.schoolName ?? '', grade: d.grade ?? '', description: d.description ?? '', status: d.status })
  dialogVisible.value = true
}
const submit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    try {
      if (form.id) { await updateClassGroup(form.id, { ...form }); ElMessage.success('更新成功') }
      else { await createClassGroup({ ...form }); ElMessage.success('创建成功') }
      dialogVisible.value = false; load()
    } catch { /* handled */ }
  })
}
const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' })
  await deleteClassGroup(id); ElMessage.success('已删除'); load()
}

/* ---- Students Dialog ---- */
const studentDialogVisible = ref(false)
const currentClass = ref<ClassGroup | null>(null)
const classStudents = ref<ClassStudent[]>([])
const allStudents = ref<{ id: number; username: string; realName?: string }[]>([])
const selectedStudentIds = ref<number[]>([])

const openStudents = async (row: ClassGroup) => {
  currentClass.value = row
  try {
    const [stuRes, allRes] = await Promise.all([
      getClassStudents(row.id), listUsersApi({ pageNum: 1, pageSize: 500, role: 'STUDENT' })
    ])
    classStudents.value = stuRes.data ?? []
    allStudents.value = allRes.data?.records ?? []
    selectedStudentIds.value = classStudents.value.map(s => s.studentId)
  } catch { /* ignore */ }
  studentDialogVisible.value = true
}

const saveStudents = async () => {
  if (!currentClass.value) return
  await assignClassStudents(currentClass.value.id, selectedStudentIds.value)
  ElMessage.success('已保存')
  studentDialogVisible.value = false
}

const removeStudent = async (classId: number, studentId: number) => {
  await removeClassStudent(classId, studentId)
  ElMessage.success('已移除')
  classStudents.value = classStudents.value.filter(s => s.studentId !== studentId)
}
</script>

<template>
  <div class="page-container">
    <el-card>
      <div style="margin-bottom:16px"><el-button type="success" @click="openCreate">+ 新建班级</el-button></div>
      <el-table :data="classes" v-loading="loading" stripe border>
        <el-table-column prop="className" label="班级名称" min-width="140" />
        <el-table-column prop="schoolName" label="学校" width="120" />
        <el-table-column prop="grade" label="年级" width="80" />
        <el-table-column prop="teacherName" label="负责老师" width="100" />
        <el-table-column prop="studentCount" label="学生数" width="80" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }"><el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '停用' }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="warning" @click="openStudents(row)">学生</el-button>
            <el-button size="small" type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="query.pageNum" v-model:page-size="query.pageSize"
        :total="total" :page-sizes="[20, 50]" layout="total, sizes, prev, pager, next"
        @change="load" style="margin-top:16px;justify-content:flex-end"
      />
    </el-card>

    <!-- 班级 Dialog -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑班级' : '新建班级'" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="名称" prop="className"><el-input v-model="form.className" :maxlength="FormLimits.className.max" show-word-limit /></el-form-item>
        <el-form-item label="学校"><el-input v-model="form.schoolName" :maxlength="FormLimits.shortText.max" /></el-form-item>
        <el-form-item label="年级"><el-input v-model="form.grade" :maxlength="20" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" :maxlength="FormLimits.mediumText.max" show-word-limit /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="submit">保存</el-button></template>
    </el-dialog>

    <!-- 学生管理 Dialog -->
    <el-dialog v-model="studentDialogVisible" :title="`学生管理 - ${currentClass?.className}`" width="700px" destroy-on-close>
      <div style="margin-bottom:12px;font-size:13px;color:#666">已选 {{ selectedStudentIds.length }} 名学生</div>
      <el-checkbox-group v-model="selectedStudentIds">
        <el-checkbox v-for="s in allStudents" :key="s.id" :value="s.id" :label="`${s.realName || s.username} (${s.username})`" style="display:block;margin-bottom:4px" />
      </el-checkbox-group>
      <template #footer><el-button @click="studentDialogVisible = false">取消</el-button><el-button type="primary" @click="saveStudents">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { padding: 16px; }
</style>
