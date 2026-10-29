<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { listCategoryTree, createCategory, updateCategory, deleteCategory } from '@/api/admin'
import type { Category, CategoryForm } from '@/types/category'
import { FormLimits } from '@/utils/formLimits'

const tree = ref<Category[]>([])
const loading = ref(false)

/** 搜索关键字（对一级与二级同时生效） */
const keyword = ref('')
// [2026-10-16 改造] 原 `showDisabled = ref(false)` 勾选框改为状态 tabs：
// 停用分类不再与启用分类混排，而是单独一个视图，避免日常维护时被 13 个空壳分类干扰。
const statusTab = ref<'enabled' | 'disabled'>('enabled')

/* ---------------- 分组卡片墙数据 ---------------- */

/** 一级分组：根分类 + 过滤后的子分类 */
interface Group {
  root: Category
  children: Category[]   // 过滤后展示的子分类（根无子级时为空）
  total: number          // 本组题目合计（根自身 + 所有子级）
  color: string          // 分组主色
}

/** 固定调色板：按一级顺序循环取色，保证同组颜色稳定 */
const PALETTE = [
  '#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#9a6ee0',
  '#13c2c2', '#eb2f96', '#2f54eb', '#52c41a', '#fa8c16', '#722ed1',
]

const match = (c: Category, kw: string) =>
  !kw || c.categoryName.toLowerCase().includes(kw) || (c.description ?? '').toLowerCase().includes(kw)

const groups = computed<Group[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  // [2026-10-16 改造] 原为「显示已停用分类」勾选框：勾选后停用项混在启用项里一起展示，
  // 30 个分类（17 启用 + 13 停用）平铺，分不清哪些还在用。现改为 tabs 按状态分离视图 ——
  // 「启用中」只看在用分类（日常维护），「已停用」单独一屏（便于恢复或清理）。
  const wantDisabled = statusTab.value === 'disabled'
  return tree.value
    .filter((root) => (wantDisabled ? root.status === 0 : root.status !== 0))
    .map((root, i) => {
      const kids = (root.children ?? []).filter((child) =>
        wantDisabled ? child.status === 0 : child.status !== 0
      )
      // 根命中 → 展示全部可见子级；根不命中 → 只展示命中的子级；都没有则整组过滤掉
      const rootHit = match(root, kw)
      const children = rootHit ? kids : kids.filter((child) => match(child, kw))
      if (kw && !rootHit && !children.length) return null
      const total = (root.questionCount ?? 0) + kids.reduce((sum, child) => sum + (child.questionCount ?? 0), 0)
      return { root, children, total, color: PALETTE[i % PALETTE.length] } as Group
    })
    .filter((group): group is Group => group !== null)
})

/** 统计概览 */
const stats = computed(() => {
  const allRoots = tree.value
  const all = allRoots.flatMap((root) => [root, ...(root.children ?? [])])
  const isVisible = (category: Category) =>
    statusTab.value === 'disabled' ? category.status === 0 : category.status !== 0
  const roots = allRoots.filter(isVisible)
  const kids = roots.flatMap((root) => (root.children ?? []).filter(isVisible))
  const visible = [...roots, ...kids]
  return {
    total: visible.length,
    roots: roots.length,
    seconds: kids.length,
    totalQuestions: visible.reduce((sum, category) => sum + (category.questionCount ?? 0), 0),
    enabled: all.filter((category) => category.status === 1).length,
    disabled: all.filter((category) => category.status === 0).length,
  }
})

/** 题目数最多的分类（用于进度条归一化） */
const maxQuestions = computed(() => {
  const all = tree.value.flatMap((r) => [r, ...(r.children ?? [])])
  return Math.max(1, ...all.map((c) => c.questionCount ?? 0))
})
const qPercent = (c?: Category) => Math.round((((c?.questionCount ?? 0) / maxQuestions.value) * 100))

const load = async () => {
  loading.value = true
  try {
    const res = await listCategoryTree(true)
    tree.value = Array.isArray(res.data) ? res.data : []
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
        <div class="toolbar-right">
          <el-input
            v-model="keyword"
            placeholder="搜索分类名称"
            clearable
            size="default"
            style="width: 200px"
            :prefix-icon="Search"
          />
          <el-button type="primary" @click="openCreateRoot">
            <el-icon><Plus /></el-icon>新增一级分类
          </el-button>
        </div>
      </div>

      <!-- [2026-10-16 改造] 状态 tabs：启用中 / 已停用 分开视图（原为勾选框，停用项会混排） -->
      <el-tabs v-model="statusTab" class="status-tabs">
        <el-tab-pane name="enabled">
          <template #label>
            <span class="tab-label">
              启用中
              <el-tag type="success" effect="plain">{{ stats.enabled }}</el-tag>
            </span>
          </template>
        </el-tab-pane>
        <el-tab-pane name="disabled">
          <template #label>
            <span class="tab-label">
              已停用
              <el-tag type="danger" effect="plain">{{ stats.disabled }}</el-tag>
            </span>
          </template>
        </el-tab-pane>
      </el-tabs>

      <!-- 统计概览 -->
      <div class="stat-row" v-loading="loading">
        <div class="stat-card">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">分类总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.roots }}<span class="stat-sub">/{{ stats.seconds }}</span></div>
          <div class="stat-label">一级 / 二级分类</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalQuestions }}</div>
          <div class="stat-label">题目总量</div>
        </div>
        <div class="stat-card" :class="{ warn: stats.disabled > 0 }">
          <div class="stat-value">{{ stats.disabled }}</div>
          <div class="stat-label">已停用</div>
        </div>
      </div>

      <!-- 分组卡片墙：一级做分组头，二级平铺卡片，全部常驻展开、无折叠 -->
      <div v-loading="loading" class="group-wall">
        <section
          v-for="g in groups"
          :key="g.root.id"
          class="group"
          :class="{ disabled: g.root.status === 0 }"
          :style="{ '--accent': g.color }"
        >
          <header class="group-head">
            <span class="group-bar"></span>
            <div class="group-main">
              <div class="group-title-row">
                <span class="group-name">
                  <el-icon><Folder /></el-icon>{{ g.root.categoryName }}
                </span>
                <el-tag effect="plain" class="group-chip" :style="{ color: g.color, borderColor: g.color + '55' }">
                  {{ (g.root.children ?? []).length }} 个二级
                </el-tag>
                <el-tag v-if="g.root.status === 0" type="danger">已停用</el-tag>
              </div>
              <div class="group-desc">{{ g.root.description || '暂无描述' }}</div>
            </div>

            <div class="group-side">
              <template v-if="(g.root.children ?? []).length">
                <div class="group-total">
                  <b>{{ g.total }}</b><span>题</span>
                  <em>含本级 {{ g.root.questionCount ?? 0 }} 题</em>
                </div>
              </template>
              <template v-else>
                <div class="group-total">
                  <b>{{ g.root.questionCount ?? 0 }}</b><span>题</span>
                </div>
                <div class="group-progress">
                  <el-progress
                    :percentage="qPercent(g.root)"
                    :stroke-width="6"
                    :show-text="false"
                    :color="g.color"
                  />
                </div>
              </template>
              <div class="group-actions">
                <el-button link type="primary" @click="openCreateChild(g.root)">
                  <el-icon><Plus /></el-icon>二级分类
                </el-button>
                <el-button link type="warning" @click="openEdit(g.root)">编辑</el-button>
                <el-button link type="danger" @click="confirmDelete(g.root)">删除</el-button>
              </div>
            </div>
          </header>

          <!-- 有二级：平铺子分类卡片 -->
          <div v-if="g.children.length" class="child-grid">
            <div
              v-for="c in g.children"
              :key="c.id"
              class="child-card"
              :class="{ disabled: c.status === 0 }"
            >
              <div class="child-top">
                <span class="child-name" :title="c.categoryName">{{ c.categoryName }}</span>
                <span class="child-count" :style="{ background: g.color + '14', color: g.color }">
                  {{ c.questionCount ?? 0 }} 题
                </span>
              </div>
              <div class="child-desc" :title="c.description">{{ c.description || '暂无描述' }}</div>
              <div class="child-actions">
                <el-button link type="warning" @click="openEdit(c)">编辑</el-button>
                <el-button link type="danger" @click="confirmDelete(c)">删除</el-button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <el-empty v-if="!loading && !groups.length" description="暂无分类，点击右上角新增" />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editMode === 'edit' ? '编辑分类' : editMode === 'create-child' ? '新增二级分类' : '新增一级分类'"
      width="480px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="名称" prop="categoryName">
          <el-input v-model="form.categoryName" :maxlength="FormLimits.shortText.max" show-word-limit placeholder="如：时态 / 从句" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" :maxlength="FormLimits.mediumText.max" show-word-limit />
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
.toolbar-right { display: flex; align-items: center; gap: 12px; }
.title { margin: 0; font-size: 16px; font-weight: 600; }

/* [2026-10-16] 状态 tabs：启用中 / 已停用 分离视图 */
.status-tabs {
  margin-bottom: 4px;
  :deep(.el-tabs__header) { margin-bottom: 12px; }
}
.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* 统计条 */
.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.stat-card {
  padding: 14px 16px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: linear-gradient(135deg, #fafcff 0%, #f5f7fa 100%);
  transition: all 0.2s;
  &:hover { box-shadow: 0 2px 10px rgba(64, 158, 255, 0.12); transform: translateY(-2px); }
  &.warn { border-color: #fde2e2; background: linear-gradient(135deg, #fef6f6 0%, #fdf0f0 100%); }
}
.stat-value { font-size: 24px; font-weight: 700; color: #303133; line-height: 1.2; }
.stat-sub { font-size: 14px; font-weight: 500; color: #909399; }
.stat-card.warn .stat-value { color: #f56c6c; }
.stat-label { margin-top: 4px; font-size: 12px; color: #909399; }

/* ===== 分组卡片墙 ===== */
.group-wall { display: flex; flex-direction: column; gap: 16px; }

.group {
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  transition: box-shadow 0.2s;
  &:hover { box-shadow: 0 4px 18px rgba(0, 0, 0, 0.06); }
  &.disabled { opacity: 0.7; }
}

/* 分组头：左侧色条 + 信息 + 右侧统计与操作 */
.group-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 7%, #fff) 0%, #fff 55%);
}
.group-bar {
  width: 4px; height: 40px; flex-shrink: 0;
  border-radius: 3px; background: var(--accent);
}
.group-main { flex: 1; min-width: 0; }
.group-title-row { display: flex; align-items: center; gap: 8px; }
.group-name {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 15px; font-weight: 700; color: #303133;
  .el-icon { color: var(--accent); }
}
.group-chip { font-variant-numeric: tabular-nums; }
.group-desc {
  margin-top: 4px;
  font-size: 12px; line-height: 1.6; color: #909399;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.group-side { display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
.group-total {
  text-align: right;
  b { font-size: 22px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
  span { margin-left: 3px; font-size: 12px; color: #909399; }
  em { display: block; font-style: normal; font-size: 11px; color: #c0c4cc; }
}
.group-progress { width: 120px; }
.group-actions {
  display: flex; gap: 2px;
  padding-left: 12px;
  border-left: 1px solid #ebeef5;
}

/* 二级卡片网格 */
.child-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
  gap: 12px;
  padding: 0 16px 16px;
}
.child-card {
  display: flex; flex-direction: column; gap: 8px;
  padding: 12px 14px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fafcff;
  transition: all 0.18s ease;
  &:hover {
    border-color: color-mix(in srgb, var(--accent) 45%, #fff);
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.07);
    transform: translateY(-2px);
    .child-actions { opacity: 1; }
  }
  &.disabled { background: #fafafa; opacity: 0.7; }
}
.child-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.child-name {
  flex: 1; min-width: 0;
  font-size: 13.5px; font-weight: 600; color: #303133;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.child-count {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11.5px; font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.child-desc {
  font-size: 12px; line-height: 1.5; color: #909399;
  min-height: 18px;
  display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;
  overflow: hidden;
}
.child-actions {
  display: flex; justify-content: flex-end; gap: 2px;
  opacity: 0; transition: opacity 0.18s;
}

@media (max-width: 900px) {
  .group-head { flex-wrap: wrap; }
  .group-side { width: 100%; justify-content: space-between; }
  .group-actions { border-left: none; padding-left: 0; }
}
</style>
