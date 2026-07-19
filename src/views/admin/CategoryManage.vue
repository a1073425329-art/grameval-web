<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { listCategoryTree, createCategory, updateCategory, deleteCategory } from '@/api/admin'
import type { Category, CategoryForm } from '@/types/category'

const tree = ref<Category[]>([])
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const res = await listCategoryTree()
    tree.value = res.data ?? []
  } finally {
    loading.value = false
  }
}

/* ---------------- 弹窗 ---------------- */
const dialogVisible = ref(false)
const editMode = ref<'create-root' | 'create-child' | 'edit'>('create-root')
const formRef = ref<FormInstance>()
const form = reactive<CategoryForm & { id: number }>({
  id: 0,
  categoryName: '',
  parentId: null,
  description: '',
  sortNo: 0,
  status: 1,
})

const rules: FormRules = {
  categoryName: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
}

const openCreateRoot = () => {
  editMode.value = 'create-root'
  Object.assign(form, { id: 0, categoryName: '', parentId: null, description: '', sortNo: 0, status: 1 })
  dialogVisible.value = true
}
const openCreateChild = (parent: Category) => {
  editMode.value = 'create-child'
  Object.assign(form, { id: 0, categoryName: '', parentId: parent.id, description: '', sortNo: 0, status: 1 })
  dialogVisible.value = true
}
const openEdit = (node: Category) => {
  editMode.value = 'edit'
  Object.assign(form, {
    id: node.id,
    categoryName: node.categoryName,
    parentId: node.parentId,
    description: node.description || '',
    sortNo: node.sortNo || 0,
    status: node.status,
  })
  dialogVisible.value = true
}

const submit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    try {
      if (editMode.value === 'edit') {
        await updateCategory(form.id, {
          categoryName: form.categoryName,
          description: form.description,
          sortNo: form.sortNo,
          status: form.status,
        })
        ElMessage.success('更新成功')
      } else {
        await createCategory({
          categoryName: form.categoryName,
          parentId: form.parentId,
          description: form.description,
          sortNo: form.sortNo,
          status: form.status,
        })
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      load()
    } catch { /* handled */ }
  })
}

const confirmDelete = async (node: Category) => {
  try {
    await ElMessageBox.confirm(
      `确认删除分类「${node.categoryName}」？如已被子分类或题目引用，将改为软停用。`,
      '删除确认',
      { type: 'warning' }
    )
    await deleteCategory(node.id)
    ElMessage.success('已删除')
    load()
  } catch { /* cancelled */ }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <el-card shadow="never">
      <div class="toolbar">
        <h3 class="title">语法分类</h3>
        <el-button type="primary" @click="openCreateRoot">
          <el-icon><Plus /></el-icon>新增根分类
        </el-button>
      </div>

      <el-tree
        v-loading="loading"
        :data="tree"
        :props="{ label: 'categoryName', children: 'children' }"
        node-key="id"
        default-expand-all
        :expand-on-click-node="false"
      >
        <template #default="{ data }">
          <div class="tree-node">
            <span class="node-label">
              <el-icon><Folder /></el-icon>
              <span>{{ data.categoryName }}</span>
              <el-tag v-if="data.questionCount" size="small" type="info" class="q-count">
                {{ data.questionCount }} 题
              </el-tag>
              <el-tag v-if="data.status === 0" size="small" type="danger">已停用</el-tag>
            </span>
            <span class="node-actions">
              <el-button link type="primary" size="small" @click.stop="openCreateChild(data)">
                <el-icon><Plus /></el-icon>子分类
              </el-button>
              <el-button link type="warning" size="small" @click.stop="openEdit(data)">编辑</el-button>
              <el-button link type="danger" size="small" @click.stop="confirmDelete(data)">删除</el-button>
            </span>
          </div>
        </template>
      </el-tree>

      <el-empty v-if="!loading && !tree.length" description="暂无分类，点击右上角新增" />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editMode === 'edit' ? '编辑分类' : editMode === 'create-child' ? '新增子分类' : '新增根分类'"
      width="480px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="名称" prop="categoryName">
          <el-input v-model="form.categoryName" placeholder="如：时态 / 从句" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortNo" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
}
.title { margin: 0; font-size: 16px; font-weight: 600; }

.tree-node {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-right: 8px;
}
.node-label { display: inline-flex; align-items: center; gap: 6px; }
.q-count { margin-left: 4px; }
.node-actions { display: inline-flex; gap: 4px; opacity: 0; transition: opacity 0.15s; }
.tree-node:hover .node-actions { opacity: 1; }

:deep(.el-tree-node__content) { height: 36px; }
</style>
