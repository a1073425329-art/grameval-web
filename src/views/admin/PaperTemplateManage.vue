<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate, generatePaperFromTemplate, checkTemplateAvailability } from '@/api/paperTemplate'
import type { PaperTemplate, PaperTemplateForm } from '@/types/paperTemplate'
import { useRouter } from 'vue-router'
// [2026-10-16 新增] 试卷满分档位字典（与后端 ALLOWED_TOTAL_SCORES 对齐）
import { paperScoreDict, getQuestionTypeLabel } from '@/utils/dict'

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
/**
 * [2026-10-16 改] 默认出题量 0 → 100，默认题型配置覆盖全部 5 种题型（每题 1 分 → 满分 100）。
 * 原默认值保留备查：questionConfig: '[]'，questionCount: 0
 */
const DEFAULT_QUESTION_CONFIG = JSON.stringify([
  { type: 'SINGLE', count: 40, score: 1, difficulty: [1, 2] },
  { type: 'MULTIPLE', count: 15, score: 1, difficulty: [2, 3] },
  { type: 'JUDGE', count: 15, score: 1, difficulty: [1, 2] },
  { type: 'FILL_HINT', count: 10, score: 1, difficulty: [2, 3] },
  { type: 'READING', count: 20, score: 1, difficulty: [2] },
])

const form = reactive<PaperTemplateForm & { id: number }>({
  id: 0, templateName: '', description: '', questionConfig: DEFAULT_QUESTION_CONFIG,
  difficultyDistribution: '', knowledgeRequirements: '', gradeLevel: '',
  // [2026-10-16 移除] 试卷模板不保存"答题时长"（论文 L702/L960/L966：时长归考试场次）。
  // 旧写法保留备查：duration: 60,
  totalScore: 100, questionCount: 100, status: 1,
})

const rules: FormRules = {
  templateName: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  questionConfig: [{ required: true, message: '请输入题型配置JSON', trigger: 'blur' }],
}

const openCreate = () => {
  dialogTitle.value = '新建模板'
  // [2026-10-16 移除] 不再写入 duration（时长归考试场次）。旧写法保留备查：duration: 60,
  Object.assign(form, { id: 0, templateName: '', description: '', questionConfig: DEFAULT_QUESTION_CONFIG, difficultyDistribution: '', knowledgeRequirements: '', gradeLevel: '', totalScore: 100, questionCount: 100, status: 1 })
  dialogVisible.value = true
}

const openEdit = async (row: PaperTemplate) => {
  dialogTitle.value = '编辑模板'
  const res = await getTemplate(row.id)
  const d = res.data
  // [2026-10-16 移除] 不再读取/回填 duration（时长归考试场次）。旧写法保留备查：duration: d.duration ?? 60,
  Object.assign(form, { id: d.id, templateName: d.templateName, description: d.description ?? '', questionConfig: d.questionConfig, difficultyDistribution: d.difficultyDistribution ?? '', knowledgeRequirements: d.knowledgeRequirements ?? '', gradeLevel: d.gradeLevel ?? '', totalScore: d.totalScore, questionCount: d.questionCount, status: d.status })
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
/**
 * [2026-10-16 补齐] 生成前先调 /{id}/availability 预检题库可抽数量：
 *   - 有缺口 → 用 warning 弹窗列明"某题型需 N 题、题库仅 M 题"，由用户决定是否继续；
 *   - 无缺口 → 与原逻辑一样，普通确认弹窗。
 *   ---- 旧实现（无预检，保留备查）----
 *   await ElMessageBox.confirm(`将根据模板「${row.templateName}」自动从题库随机抽题生成试卷，确认生成？`, '确认生成试卷', { confirmButtonText: '确认生成', type: 'info' })
 */
const handleGenerate = async (row: PaperTemplate) => {
  try {
    let shortage = ''
    try {
      const av = await checkTemplateAvailability(row.id)
      const bad = (av.data?.items ?? []).filter((i) => !i.ok)
      if (bad.length) {
        shortage = bad.map((i) => `${getQuestionTypeLabel(i.type)}需${i.requested}题/题库仅${i.available}题`).join('；')
      }
    } catch { /* 预检失败不阻断，生成时后端仍会兜底 */ }

    const baseMsg = `将根据模板「${row.templateName}」自动从题库随机抽题生成试卷，确认生成？`
    await ElMessageBox.confirm(
      shortage ? `${baseMsg}\n⚠ 题库题目不足：${shortage}。不足部分将按实际数量生成，仍要继续吗？` : baseMsg,
      shortage ? '题库题目不足' : '确认生成试卷',
      { confirmButtonText: '确认生成', type: shortage ? 'warning' : 'info' }
    )
    generating.value = true
    const res = await generatePaperFromTemplate(row.id)
    ElMessage.success(`试卷「${res.data?.paperName}」已生成！共 ${res.data?.questionCount} 题，满分 ${res.data?.totalScore} 分`)
    // [2026-10-16 补齐] 生成过程中的缺题提示（后端 warnings）
    const warns = res.data?.warnings ?? []
    if (warns.length) ElMessage.warning(warns.join('；'))
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
      <!-- [2026-09-27 新增] 造卷双入口的主从说明：本页是推荐主入口（C 项） -->
      <el-alert type="success" :closable="false" show-icon style="margin-bottom:12px">
        <template #title>
          <b>推荐入口 · 模板自动组卷</b>
        </template>
        按题型配比、难度比例、专题比例与分值约束从题库随机抽题，一键生成可复用的试卷结构；
        生成后到「试卷管理」发布为考试场次。论文 §4.3.1：模板只管「考什么」，场次管「什么时候考」。
        需要逐题精确控制时，请用「试卷管理 → 手动组卷」。
      </el-alert>
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
        <!-- [2026-10-16 移除] 试卷模板不展示"时长"（论文 L702/L960/L966：时长归考试场次）。
             旧写法保留备查：<el-table-column prop="duration" label="时长(分)" width="80" /> -->
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
          <el-col :span="12"><el-form-item label="适用年级"><el-input v-model="form.gradeLevel" /></el-form-item></el-col>
          <el-col :span="12">
            <el-form-item label="总分">
              <!-- [2026-10-16 改] 原 el-input-number(min 0 / max 500) 可填 101、110 这类非标准总分，
                   改为标准档位下拉（100/120/150/710/9），与 AI 出题、工作流出题口径一致。
                   ---- 旧实现（保留注释备查）----
                   <el-input-number v-model="form.totalScore" :min="0" :max="500" /> -->
              <el-select v-model="form.totalScore" style="width: 100%">
                <el-option v-for="d in paperScoreDict" :key="d.value" :label="d.label" :value="Number(d.value)" />
              </el-select>
            </el-form-item>
          </el-col>
          <!-- [2026-10-16 移除] 试卷模板不录入"时长"（论文 L702/L960/L966：时长由考试场次设置）。
               旧写法保留备查：
               <el-col :span="8"><el-form-item label="时长(分)"><el-input-number v-model="form.duration" :min="1" :max="300" /></el-form-item></el-col> -->
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
