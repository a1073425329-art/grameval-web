<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listAnswerCards, createAnswerCard, updateAnswerCard, deleteAnswerCard } from '@/api/answerCard'
import type { AnswerCard, AnswerCardForm } from '@/types/answerCard'
import { listPapers } from '@/api/admin'

const cards = ref<AnswerCard[]>([])
const loading = ref(false)
const papers = ref<{ id: number; paperName: string }[]>([])

const load = async () => {
  loading.value = true
  try {
    const [cardRes, paperRes] = await Promise.all([
      listAnswerCards(), listPapers({ pageNum: 1, pageSize: 100 })
    ])
    cards.value = cardRes.data ?? []
    papers.value = paperRes.data?.records ?? []
  } finally { loading.value = false }
}

onMounted(load)

/* Dialog */
const dialogVisible = ref(false)
const form = reactive<AnswerCardForm & { id: number }>({
  id: 0, paperId: undefined, cardName: '',
  questionOrderConfig: '{"orderBy":"TYPE","typeOrder":["SINGLE","MULTIPLE","FILL_HINT","READING"]}',
  styleConfig: '{"bgColor":"#F5F7FA","fontSize":14,"optionLayout":"HORIZONTAL","showCardNumber":true}',
  isDefault: false,
})

const openCreate = () => {
  Object.assign(form, { id: 0, paperId: undefined, cardName: '', questionOrderConfig: '{"orderBy":"TYPE","typeOrder":["SINGLE","MULTIPLE","FILL_HINT","READING"]}', styleConfig: '{"bgColor":"#F5F7FA","fontSize":14,"optionLayout":"HORIZONTAL","showCardNumber":true}', isDefault: false })
  dialogVisible.value = true
}

const openEdit = (row: AnswerCard) => {
  Object.assign(form, { id: row.id, paperId: row.paperId, cardName: row.cardName ?? '', questionOrderConfig: row.questionOrderConfig ?? '', styleConfig: row.styleConfig ?? '', isDefault: row.isDefault })
  dialogVisible.value = true
}

const submit = async () => {
  try {
    if (form.id) { await updateAnswerCard(form.id, { ...form }); ElMessage.success('更新成功') }
    else { await createAnswerCard({ ...form }); ElMessage.success('创建成功') }
    dialogVisible.value = false
    load()
  } catch { /* handled */ }
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' })
  await deleteAnswerCard(id)
  ElMessage.success('已删除')
  load()
}
</script>

<template>
  <div class="page-container">
    <el-card>
      <div style="margin-bottom:16px">
        <el-button type="success" @click="openCreate">+ 新建答题卡</el-button>
      </div>
      <el-table :data="cards" v-loading="loading" stripe border>
        <el-table-column prop="cardName" label="名称" min-width="150" />
        <el-table-column label="试卷" width="200">
          <template #default="{ row }">{{ row.paperId ? (papers.find(p => p.id === row.paperId)?.paperName ?? row.paperId) : '全局默认' }}</template>
        </el-table-column>
        <el-table-column label="默认" width="80">
          <template #default="{ row }"><el-tag v-if="row.isDefault" type="success" size="small">默认</el-tag></template>
        </el-table-column>
        <el-table-column label="题序配置" min-width="200">
          <template #default="{ row }"><code style="font-size:12px">{{ row.questionOrderConfig?.substring(0, 50) }}...</code></template>
        </el-table-column>
        <el-table-column label="样式配置" min-width="200">
          <template #default="{ row }"><code style="font-size:12px">{{ row.styleConfig?.substring(0, 50) }}...</code></template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="答题卡配置" width="600px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="关联试卷">
          <el-select v-model="form.paperId" placeholder="不选则为全局默认" clearable style="width:100%">
            <el-option v-for="p in papers" :key="p.id" :label="p.paperName" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="form.cardName" placeholder="答题卡名称" /></el-form-item>
        <el-form-item label="题序配置">
          <el-input v-model="form.questionOrderConfig" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="样式配置">
          <el-input v-model="form.styleConfig" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="设为默认"><el-switch v-model="form.isDefault" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="submit">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { padding: 16px; }
</style>
