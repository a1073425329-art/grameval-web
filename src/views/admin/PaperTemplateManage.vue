<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate, generatePaperFromTemplate } from '@/api/paperTemplate'
import type { PaperTemplate, PaperTemplateForm } from '@/types/paperTemplate'
import { useRouter } from 'vue-router'

const router = useRouter()
const tableData = ref<PaperTemplate[]>([])
const loading = ref(false)
const total = ref(0)
const query = reactive({ pageNum: 1, pageSize: 10, templateName: '', status: undefined as number | undefined })

const load = async () => {
  loading.value = true
  try {
    const res = await listTemplates(query)
    tableData.value = res.data?.records ?? []
    total.value = res.data?.total ?? 0
  } finally { loading.value = false }
}

onMounted(load)

/* ---- Dialog ---- */
const dialogVisible = ref(false)
const dialogTitle = ref('')
const formRef = ref<FormInstance>()
const form = reactive<PaperTemplateForm & { id: number }>({
  id: 0, templateName: '', description: '', questionConfig: '[]',
  difficultyDistribution: '', knowledgeRequirements: '', gradeLevel: '',
  totalScore: 100, duration: 60, questionCount: 0, status: 1,
})

const rules: FormRules = {
  templateName: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  questionConfig: [{ required: true, message: '请输入题型配置JSON', trigger: 'blur' }],
}

const openCreate = () => {
  dialogTitle.value = '新建模板'
  Object.assign(form, { id: 0, templateName: '', description: '', questionConfig: '[]', difficultyDistribution: '', knowledgeRequirements: '', gradeLevel: '', totalScore: 100, duration: 60, questionCount: 0, status: 1 })
  dialogVisible.value = true
}

const openEdit = async (row: PaperTemplate) => {
  dialogTitle.value = '编辑模板'
  const res = await getTemplate(row.id)
  const d = res.data
  Object.assign(form, { id: d.id, templateName: d.templateName, description: d.description ?? '', questionConfig: d.questionConfig, difficultyDistribution: d.difficultyDistribution ?? '', knowledgeRequirements: d.knowledgeRequirements ?? '', gradeLevel: d.gradeLevel ?? '', totalScore: d.totalScore, duration: d.duration ?? 60, questionCount: d.questionCount, status: d.status })
  dialogVisible.value = true
}

const submit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    try {
      if (form.id) { await updateTemplate(form.id, { ...form }); ElMessage.success('更新成功') }
      else { await createTemplate({ ...form }); ElMessage.success('创建成功') }
      dialogVisible.value = false
      load()
    } catch { /* handled */ }
  })
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除此模板？', '提示', { type: 'warning' })
  await deleteTemplate(id)
  ElMessage.success('已删除')
  load()
}

const generating = ref(false)
const handleGenerate = async (row: PaperTemplate) => {
  try {
    await ElMessageBox.confirm(
      `将根据模板「${row.templateName}」自动从题库随机抽题生成试卷，确认生成？`,
      '确认生成试卷',
      { confirmButtonText: '确认生成', type: 'info' }
    )
    generating.value = true
    const res = await generatePaperFromTemplate(row.id)
    ElMessage.success(`试卷「${res.data?.paperName}」已生成！共 ${res.data?.questionCount} 题，满分 ${res.data?.totalScore} 分`)
    router.push('/admin/papers')
  } catch { /* canceled or failed */ }
  finally { generating.value = false }
}

const copyConfig = (config: string) => {
  navigator.clipboard.writeText(config)
  ElMessage.success('已复制到剪贴板')
}

const statusMap: Record<number, string> = { 0: '停用', 1: '启用' }
</script>

<template>
  <div class="page-container">
    <el-card>
      <div class="search-bar">
        <el-input v-model="query.templateName" placeholder="模板名称" clearable style="width:200px" @keyup.enter="load" />
        <el-select v-model="query.status" placeholder="状态" clearable style="width:120px">
          <el-option label="启用" :value="1" /><el-option label="停用" :value="0" />
        </el-select>
        <el-button type="primary" @click="load">搜索</el-button>
        <el-button type="success" @click="openCreate">+ 新建模板</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe border>
        <el-table-column prop="templateName" label="模板名称" min-width="150" />
        <el-table-column prop="gradeLevel" label="适用年级" width="100" />
        <el-table-column prop="totalScore" label="总分" width="80" />
        <el-table-column prop="questionCount" label="题目数" width="80" />
        <el-table-column prop="duration" label="时长(分)" width="80" />
        <el-table-column prop="usageCount" label="使用次数" width="80" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">{{ statusMap[row.status] }}</template>
        </el-table-column>
        <el-table-column prop="creatorName" label="创建者" width="100" />
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="success" @click="handleGenerate(row)" :loading="generating">生成试卷</el-button>
            <el-button size="small" @click="copyConfig(row.questionConfig)">复制配置</el-button>
            <el-button size="small" type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="query.pageNum" v-model:page-size="query.pageSize"
        :total="total" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next"
        @change="load" style="margin-top:16px;justify-content:flex-end"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="650px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="模板名称" prop="templateName">
          <el-input v-model="form.templateName" placeholder="如：期中考试标准模板" />
        </el-form-item>
        <el-form-item label="模板描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="题型配置" prop="questionConfig">
          <template #label>
            题型配置
            <el-tooltip content="JSON数组格式。每项定义一种题型：type=SINGLE/MULTIPLE/JUDGE/FILL_HINT/READING，count=数量，score=每题分值，difficulty=难度范围[1,2,3]。生成试卷时系统从题库随机抽题。" placement="right" effect="light">
              <el-icon style="cursor:help;color:#909399;margin-left:4px"><QuestionFilled /></el-icon>
            </el-tooltip>
          </template>
          <el-input v-model="form.questionConfig" type="textarea" :rows="4" placeholder="[{&quot;type&quot;:&quot;SINGLE&quot;,&quot;count&quot;:20,&quot;score&quot;:2,&quot;difficulty&quot;:[1,2]}]" />
        </el-form-item>
        <el-form-item label="难度分布"><el-input v-model="form.difficultyDistribution" placeholder="{&quot;easy&quot;:30,&quot;medium&quot;:50,&quot;hard&quot;:20}" /></el-form-item>
        <el-form-item label="知识点要求"><el-input v-model="form.knowledgeRequirements" type="textarea" :rows="2" placeholder="[{&quot;tagId&quot;:1,&quot;tagName&quot;:&quot;一般现在时&quot;,&quot;count&quot;:3}]" /></el-form-item>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="适用年级"><el-input v-model="form.gradeLevel" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="总分"><el-input-number v-model="form.totalScore" :min="0" :max="500" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="时长(分)"><el-input-number v-model="form.duration" :min="1" :max="300" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="题目总数"><el-input-number v-model="form.questionCount" :min="0" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="状态"><el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" /></el-form-item></el-col>
        </el-row>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="submit">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
</style>
