<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getExamComments, createExamComment, updateExamComment, deleteExamComment } from '@/api/examComment'
import type { ExamComment, ExamCommentForm } from '@/types/examComment'

const comments = ref<ExamComment[]>([])
const loading = ref(false)
const examId = ref<number>()

const load = async () => {
  if (!examId.value) return
  loading.value = true
  try {
    const res = await getExamComments(examId.value)
    comments.value = res.data ?? []
  } finally { loading.value = false }
}

const commentTypeOptions = [
  { value: 'OVERALL', label: '总体评价' },
  { value: 'STRENGTHS', label: '优点' },
  { value: 'IMPROVEMENT', label: '改进建议' },
  { value: 'TARGET', label: '下次目标' },
  { value: 'ENCOURAGEMENT', label: '鼓励' },
]

/* Dialog */
const dialogVisible = ref(false)
const form = reactive<ExamCommentForm & { id: number }>({
  id: 0, examId: 0, commentType: 'OVERALL', content: '', ratingLevel: 3, parentCommentId: undefined,
})

const openCreate = (parentId?: number) => {
  Object.assign(form, { id: 0, examId: examId.value ?? 0, commentType: 'OVERALL', content: '', ratingLevel: 3, parentCommentId: parentId })
  dialogVisible.value = true
}

const openEdit = (row: ExamComment) => {
  Object.assign(form, { id: row.id, examId: row.examId, commentType: row.commentType, content: row.content, ratingLevel: row.ratingLevel, parentCommentId: row.parentCommentId })
  dialogVisible.value = true
}

const submit = async () => {
  try {
    if (form.id) { await updateExamComment(form.id, { ...form }); ElMessage.success('更新成功') }
    else { await createExamComment({ ...form }); ElMessage.success('创建成功') }
    dialogVisible.value = false
    load()
  } catch { /* handled */ }
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' })
  await deleteExamComment(id); ElMessage.success('已删除'); load()
}

const getTypeLabel = (type: string) => commentTypeOptions.find(o => o.value === type)?.label ?? type

onMounted(load)
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>考试评语</span>
          <div>
            <el-input v-model="examId" placeholder="输入考试记录ID" style="width:160px;margin-right:8px" @keyup.enter="load" />
            <el-button type="primary" @click="load">查询</el-button>
            <el-button type="success" @click="openCreate()" :disabled="!examId">+ 发表评语</el-button>
          </div>
        </div>
      </template>

      <div v-if="comments.length === 0 && !loading"><el-empty description="请先输入考试记录ID查询" /></div>

      <div v-for="c in comments.filter(c => !c.parentCommentId)" :key="c.id" style="margin-bottom:16px;border-bottom:1px solid #eee;padding-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <el-tag size="small" type="primary">{{ getTypeLabel(c.commentType) }}</el-tag>
          <el-rate v-model="c.ratingLevel" :max="5" disabled size="small" show-score />
          <span style="font-size:12px;color:#999">{{ c.teacherName }} · {{ c.createTime }}</span>
        </div>
        <div style="margin-left:8px;white-space:pre-wrap">{{ c.content }}</div>
        <div style="margin-top:6px">
          <el-button size="small" text @click="openCreate(c.id)">回复</el-button>
          <el-button size="small" text type="primary" @click="openEdit(c)">编辑</el-button>
          <el-button size="small" text type="danger" @click="handleDelete(c.id)">删除</el-button>
        </div>
        <!-- 回复列表 -->
        <div v-if="c.replies?.length" style="margin-left:24px;margin-top:8px">
          <div v-for="r in c.replies" :key="r.id" style="background:#f5f7fa;padding:8px 12px;margin-bottom:4px;border-radius:4px">
            <div style="font-size:12px;color:#999;margin-bottom:4px">{{ r.teacherName }} · {{ r.createTime }}</div>
            <div>{{ r.content }}</div>
            <el-button size="small" text type="danger" @click="handleDelete(r.id)">删除</el-button>
          </div>
        </div>
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑评语' : (form.parentCommentId ? '回复评语' : '发表评语')" width="550px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="类型"><el-select v-model="form.commentType" style="width:100%"><el-option v-for="o in commentTypeOptions" :key="o.value" :label="o.label" :value="o.value" /></el-select></el-form-item>
        <el-form-item label="评分"><el-rate v-model="form.ratingLevel" :max="5" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="4" placeholder="请输入评语内容" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="submit">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { padding: 16px; }
</style>
