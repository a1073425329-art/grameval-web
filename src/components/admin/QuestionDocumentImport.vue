<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { commitQuestionDocumentImport, previewQuestionDocumentImport, validateQuestionDocumentImportItems } from '@/api/questionImport'
import type { QuestionDocumentImportItem } from '@/types/question'
import type { Category } from '@/types/category'
import type { QuestionTag } from '@/api/tag'

const props = defineProps<{
  modelValue: boolean
  categories: Category[]
  tags: QuestionTag[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  completed: []
}>()

const selectedFile = ref<File | null>(null)
const categoryId = ref<number | undefined>()
const preview = ref<{ fileName: string; items: QuestionDocumentImportItem[]; warnings: string[] } | null>(null)
const previewLoading = ref(false)
const commitLoading = ref(false)
const validationErrors = ref<string[]>([])
const commitResult = ref<{ createdCount: number; skippedCount: number; passageCount: number; warnings: string[] } | null>(null)
const enabledTagIds = computed(() => props.tags.filter((tag) => tag.status === 1).map((tag) => tag.id))
const categoryOptions = computed(() => {
  const result: Array<{ id: number; label: string; disabled: boolean }> = []
  const visit = (nodes: Category[], parentLabel = '') => {
    nodes.forEach((node) => {
      const label = parentLabel ? `${parentLabel} / ${node.categoryName}` : node.categoryName
      result.push({ id: node.id, label, disabled: node.status !== 1 })
      if (node.children?.length) visit(node.children, label)
    })
  }
  visit(props.categories)
  return result
})
const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) reset()
})

const reset = () => {
  selectedFile.value = null
  categoryId.value = undefined
  preview.value = null
  validationErrors.value = []
  commitResult.value = null
}

const handleFileChange = (file: UploadFile) => {
  selectedFile.value = file.raw ?? null
  preview.value = null
  commitResult.value = null
  validationErrors.value = []
}

const handleFileRemove = () => {
  selectedFile.value = null
  preview.value = null
}

const isReadingGroup = (item: QuestionDocumentImportItem) => Boolean(item.passageGroupKey)
const questionItems = (item: QuestionDocumentImportItem) =>
  isReadingGroup(item) ? item.childItems : [item]
const needsTagCorrection = (item: QuestionDocumentImportItem) => {
  const enabled = new Set(enabledTagIds.value)
  return !item.tagIds.some((id) => enabled.has(id)) ||
    item.primaryTagId == null ||
    !item.tagIds.includes(item.primaryTagId) ||
    !enabled.has(item.primaryTagId)
}

const runPreview = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请选择 Markdown、DOCX 或文本型 PDF 文件')
    return
  }
  if (categoryId.value == null) {
    ElMessage.warning('请选择入库分类')
    return
  }
  previewLoading.value = true
  validationErrors.value = []
  commitResult.value = null
  try {
    const response = await previewQuestionDocumentImport(selectedFile.value, categoryId.value)
    preview.value = response.data
  } catch {
    ElMessage.error('解析预览失败，请检查文件内容后重试')
  } finally {
    previewLoading.value = false
  }
}

const runCommit = async () => {
  if (!preview.value || categoryId.value == null) return
  validationErrors.value = validateQuestionDocumentImportItems(preview.value.items, enabledTagIds.value)
  if (validationErrors.value.length) return
  try {
    await ElMessageBox.confirm('确认将校正后的题目提交到题库？', '确认入库', { type: 'warning' })
  } catch {
    return
  }
  commitLoading.value = true
  try {
    const response = await commitQuestionDocumentImport(categoryId.value, preview.value.items)
    commitResult.value = response.data
    ElMessage.success(`已导入 ${response.data.createdCount} 道题，跳过 ${response.data.skippedCount} 道重复题`)
    emit('completed')
  } catch {
    ElMessage.error('提交失败，题目未确认入库；请检查字段和考点后重试')
  } finally {
    commitLoading.value = false
  }
}

const addOption = (item: QuestionDocumentImportItem) => {
  const used = new Set(item.options.map((option) => option.optionLabel))
  let label = 'A'
  for (let index = 0; index < 26; index += 1) {
    const candidate = String.fromCharCode(65 + index)
    if (!used.has(candidate)) {
      label = candidate
      break
    }
  }
  item.options.push({ optionLabel: label, optionContent: '', sortNo: item.options.length + 1 })
}

const removeOption = (item: QuestionDocumentImportItem, index: number) => {
  item.options.splice(index, 1)
  item.options.forEach((option, order) => { option.sortNo = order + 1 })
}
</script>

<template>
  <el-dialog v-model="visible" title="旧试卷导入" width="min(1080px, 94vw)" top="4vh" destroy-on-close>
    <div class="import-controls">
      <el-select v-model="categoryId" placeholder="选择入库分类" clearable filterable>
        <el-option
          v-for="category in categoryOptions"
          :key="category.id"
          :label="category.label"
          :value="category.id"
          :disabled="category.disabled"
        />
      </el-select>
      <el-upload
        :auto-upload="false"
        :limit="1"
        accept=".md,.markdown,.txt,.docx,.pdf"
        :on-change="handleFileChange"
        :on-remove="handleFileRemove"
      >
        <el-button>选择文件</el-button>
        <template #tip>
          <span class="upload-tip">{{ selectedFile?.name || 'Markdown、DOCX、文本型 PDF' }}</span>
        </template>
      </el-upload>
      <el-button type="primary" :loading="previewLoading" @click="runPreview">解析并预览</el-button>
    </div>

    <el-alert
      v-if="preview?.warnings.length"
      class="import-alert"
      type="warning"
      title="文件解析提示"
      :description="preview.warnings.join('；')"
      show-icon
    />
    <el-alert
      v-if="preview && !preview.items.length"
      class="import-alert"
      type="warning"
      title="未解析出可导入题目，请检查文件结构。"
      show-icon
    />
    <el-alert
      v-if="validationErrors.length"
      class="import-alert"
      type="error"
      title="提交前仍有必填项需要校正"
      :description="validationErrors.join('；')"
      show-icon
    />
    <el-alert
      v-if="commitResult?.warnings.length"
      class="import-alert"
      type="warning"
      title="导入完成提示"
      :description="commitResult.warnings.join('；')"
      show-icon
    />
    <div v-if="commitResult" class="commit-summary">
      已创建 {{ commitResult.createdCount }} 题 · 跳过重复 {{ commitResult.skippedCount }} 题 · 阅读文章 {{ commitResult.passageCount }} 篇
    </div>

    <div v-if="preview" class="preview-list">
      <article v-for="(item, itemIndex) in preview.items" :key="`${item.index}-${item.passageGroupKey || 'question'}`" class="preview-item">
        <header class="preview-heading">
          <strong>{{ isReadingGroup(item) ? `阅读组 ${itemIndex + 1}` : `第 ${item.index} 题` }}</strong>
          <el-tag v-if="isReadingGroup(item)" type="warning" size="small">{{ item.childItems.length }} 道子题</el-tag>
          <el-tag v-else size="small">{{ item.questionType }}</el-tag>
        </header>

        <el-alert
          v-if="isReadingGroup(item) && (item.errors.length || item.warnings.length)"
          class="item-diagnostics"
          :type="item.errors.length ? 'error' : 'warning'"
          :title="item.errors.length ? '解析错误，提交前请修正题目字段' : '解析提示'"
          :description="[...item.errors, ...item.warnings].join('；')"
          show-icon
        />

        <div v-if="isReadingGroup(item)" class="passage-fields">
          <el-form-item label="文章标题">
            <el-input v-model="item.passageTitle" />
          </el-form-item>
          <el-form-item label="文章正文">
            <el-input v-model="item.passageContent" type="textarea" :rows="5" />
          </el-form-item>
          <el-form-item label="文章知识点">
            <el-select v-model="item.passageKnowledgePoints" multiple filterable allow-create default-first-option style="width: 100%" />
          </el-form-item>
        </div>

        <section v-for="(question, childIndex) in questionItems(item)" :key="`${question.index}-${childIndex}`" class="question-fields">
          <h3 v-if="isReadingGroup(item)">子题 {{ childIndex + 1 }}</h3>
          <el-alert
            v-if="question.errors.length || question.warnings.length"
            class="item-diagnostics"
            :type="question.errors.length ? 'error' : 'warning'"
            :title="question.errors.length ? '解析错误，提交前请修正题目字段' : '解析提示'"
            :description="[...question.errors, ...question.warnings].join('；')"
            show-icon
          />
          <el-alert
            v-if="!question.knowledgePoints.length || needsTagCorrection(question)"
            class="item-diagnostics"
            type="warning"
            :title="[
              !question.knowledgePoints.length ? 'AI 未提供可用知识点，请人工补充。' : '',
              needsTagCorrection(question) ? 'AI 未匹配到完整的现有考点标签，请人工选择标签并指定主考点。' : '',
            ].filter(Boolean).join(' ')"
            show-icon
          />
          <div class="question-grid">
            <el-form-item label="题型">
              <el-select v-model="question.questionType">
                <el-option label="单选" value="SINGLE" />
                <el-option label="多选" value="MULTIPLE" />
                <el-option label="判断" value="JUDGE" />
                <el-option label="填空" value="FILL_HINT" />
              </el-select>
            </el-form-item>
            <el-form-item label="难度">
              <el-select v-model="question.difficulty">
                <el-option label="简单" :value="1" />
                <el-option label="中等" :value="2" />
                <el-option label="困难" :value="3" />
              </el-select>
            </el-form-item>
            <el-form-item label="分值">
              <el-input-number v-model="question.defaultScore" :min="0.5" :max="100" :step="0.5" />
            </el-form-item>
          </div>
          <el-form-item label="题干">
            <el-input v-model="question.stem" type="textarea" :rows="3" />
          </el-form-item>
          <el-form-item label="标准答案">
            <el-input v-model="question.standardAnswer" />
          </el-form-item>
          <div v-if="['SINGLE', 'MULTIPLE'].includes(question.questionType)" class="options-editor">
            <div class="options-heading">
              <span>选项</span>
              <el-button text @click="addOption(question)">添加选项</el-button>
            </div>
            <div v-for="(option, optionIndex) in question.options" :key="optionIndex" class="option-row">
              <el-input v-model="option.optionLabel" aria-label="选项标记" />
              <el-input v-model="option.optionContent" aria-label="选项内容" />
              <el-button text type="danger" :disabled="question.options.length <= 2" @click="removeOption(question, optionIndex)">移除</el-button>
            </div>
          </div>
          <el-form-item label="知识点">
            <el-select v-model="question.knowledgePoints" multiple filterable allow-create default-first-option style="width: 100%" />
          </el-form-item>
          <el-form-item label="现有考点标签">
            <el-select v-model="question.tagIds" multiple filterable style="width: 100%">
              <el-option v-for="tag in tags" :key="tag.id" :label="tag.tagName" :value="tag.id" :disabled="tag.status !== 1" />
            </el-select>
          </el-form-item>
          <el-form-item label="主考点">
            <el-select v-model="question.primaryTagId" clearable style="width: 100%">
              <el-option
                v-for="tag in tags"
                :key="tag.id"
                :label="tag.tagName"
                :value="tag.id"
                :disabled="tag.status !== 1 || !question.tagIds.includes(tag.id)"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="解析">
            <el-input v-model="question.analysis" type="textarea" :rows="2" />
          </el-form-item>
        </section>
      </article>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button v-if="preview" type="primary" :loading="commitLoading" :disabled="!preview.items.length" @click="runCommit">确认入库</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.import-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.upload-tip {
  display: inline-block;
  max-width: 260px;
  margin-left: 10px;
  overflow: hidden;
  color: #606266;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}
.import-alert,
.item-diagnostics {
  margin: 10px 0;
}
.preview-list {
  display: grid;
  gap: 12px;
  max-height: 58vh;
  overflow: auto;
}
.preview-item {
  padding: 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}
.preview-heading,
.options-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.passage-fields,
.question-fields {
  padding: 10px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}
.question-fields + .question-fields {
  margin-top: 10px;
}
.question-fields h3 {
  margin: 0 0 10px;
  font-size: 14px;
}
.question-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 12px;
}
.option-row {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) auto;
  gap: 8px;
  margin-bottom: 8px;
}
.commit-summary {
  margin: 12px 0;
  color: #303133;
  font-weight: 600;
}
@media (max-width: 720px) {
  .question-grid {
    grid-template-columns: 1fr;
  }
  .option-row {
    grid-template-columns: 64px minmax(0, 1fr) auto;
  }
}
</style>
