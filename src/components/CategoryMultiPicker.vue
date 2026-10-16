<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Search } from '@element-plus/icons-vue'
import type { Category } from '@/types/category'

/**
 * 语法专题多选器（AI 出题用）。
 *
 * 102 个分类平铺成一组长 checkbox 时，选一次专题要滚半屏、也看不出选了什么，
 * 所以按一级分类折叠成组：组内可整组勾选，顶部可搜索，底部用 chips 回显已选。
 * 提交值仍是「一级 + 二级」混合的分类 id 列表，与后端 categoryIds 契约不变。
 */
const props = defineProps<{
  modelValue: number[]
  /** 分类树；调用方加载失败时传 undefined 也不能炸 */
  categories?: Category[] | undefined
}>()

const emit = defineEmits<{ 'update:modelValue': [number[]] }>()

const keyword = ref('')
/** 收起的一级分类 id（默认全展开，17 个组不至于太长） */
const collapsed = ref<number[]>([])

const nameById = computed(() => {
  const map = new Map<number, string>()
  const walk = (list: Category[]) => {
    list.forEach((c) => {
      map.set(c.id, c.categoryName)
      if (c.children?.length) walk(c.children)
    })
  }
  walk(props.categories ?? [])
  return map
})

/** 一个组 = 一级分类 + 它的全部子分类；整组勾选要连一级本身一起选（一级也挂题） */
const groups = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return (props.categories ?? [])
    .map((top) => {
      const children = top.children ?? []
      const topHit = !kw || top.categoryName.toLowerCase().includes(kw)
      const kids = kw && !topHit ? children.filter((c) => c.categoryName.toLowerCase().includes(kw)) : children
      if (kw && !topHit && !kids.length) return null
      const allIds = [top.id, ...children.map((c) => c.id)]
      // [2026-10-16 口径修正] 组题量 = 一级直接挂载 + 全部子类。后端 questionCount 只算直接挂载，
      // 直接显示会让「时态」只显示 629（实际 629 + 2569 = 3192），与练习页 topQuestionCount 保持一致。
      const totalQ = (top.questionCount ?? 0) + children.reduce((s, c) => s + (c.questionCount ?? 0), 0)
      return { top, children: kids, allIds, totalQ }
    })
    .filter((g): g is NonNullable<typeof g> => g !== null)
})

const allIds = computed(() => groups.value.flatMap((g) => g.allIds))
const selected = computed(() => new Set(props.modelValue))
const selectedCount = computed(() => props.modelValue.length)

const isGroupAll = (ids: number[]) => ids.every((id) => selected.value.has(id))
const isGroupSome = (ids: number[]) => ids.some((id) => selected.value.has(id)) && !isGroupAll(ids)

const writeOut = (ids: number[]) => {
  emit('update:modelValue', [...new Set(ids)].sort((a, b) => a - b))
}

const toggleOne = (id: number, on: boolean) => {
  const next = new Set(props.modelValue)
  if (on) next.add(id)
  else {
    next.delete(id)
    // 取消一级时连带取消其子分类，否则会出现"父不选、子全选"的怪状态
    const top = (props.categories ?? []).find((c) => c.id === id)
    top?.children?.forEach((c) => next.delete(c.id))
  }
  writeOut([...next])
}

const toggleGroup = (ids: number[], on: boolean) => {
  const next = new Set(props.modelValue)
  ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
  writeOut([...next])
}

const toggleAll = (on: boolean) => writeOut(on ? allIds.value : [])
const clearAll = () => writeOut([])
const removeOne = (id: number) => toggleOne(id, false)

const toggleCollapse = (id: number) => {
  collapsed.value = collapsed.value.includes(id)
    ? collapsed.value.filter((x) => x !== id)
    : [...collapsed.value, id]
}

const labelOf = (id: number) => nameById.value.get(id) ?? `#${id}`
/** chips 里给二级分类带上前缀，一眼看出层级 */
const pathLabel = (id: number) => {
  const parent = (props.categories ?? []).find((t) => t.children?.some((c) => c.id === id))
  return parent ? `${parent.categoryName} › ${labelOf(id)}` : labelOf(id)
}
const isOpen = (id: number) => !!keyword.value.trim() || !collapsed.value.includes(id)
</script>

<template>
  <div class="cat-picker">
    <div class="picker-toolbar">
      <el-input
        v-model="keyword"
        size="small"
        placeholder="搜索语法专题"
        :prefix-icon="Search"
        clearable
        class="picker-search"
      />
      <div class="picker-tools">
        <span class="picker-count">
          已选 <b>{{ selectedCount }}</b> / {{ allIds.length }}
        </span>
        <el-checkbox
          :model-value="allIds.length > 0 && isGroupAll(allIds)"
          :indeterminate="selectedCount > 0 && !isGroupAll(allIds)"
          @change="(v: unknown) => toggleAll(v as boolean)"
        >
          全选
        </el-checkbox>
        <el-button size="small" link :disabled="!selectedCount" @click="clearAll">清空</el-button>
      </div>
    </div>

    <div class="picker-groups">
      <div v-for="g in groups" :key="g.top.id" class="cat-group-block">
        <div class="group-head">
          <button class="group-toggle" type="button" @click="toggleCollapse(g.top.id)">
            <el-icon :class="{ open: isOpen(g.top.id) }"><ArrowRight /></el-icon>
          </button>
          <el-checkbox
            class="group-check"
            :model-value="isGroupAll(g.allIds)"
            :indeterminate="isGroupSome(g.allIds)"
            @change="(v: unknown) => toggleGroup(g.allIds, v as boolean)"
          >
            <span class="group-name">{{ g.top.categoryName }}</span>
          </el-checkbox>
          <span class="group-meta">
            {{ g.allIds.filter((i) => selected.has(i)).length }}/{{ g.allIds.length }}
            <em v-if="g.totalQ">· {{ g.totalQ }} 题</em>
          </span>
        </div>
        <div v-show="isOpen(g.top.id)" class="group-body">
          <el-checkbox
            v-for="c in g.children"
            :key="c.id"
            :model-value="selected.has(c.id)"
            class="leaf-check"
            @change="(v: unknown) => toggleOne(c.id, v as boolean)"
          >
            {{ c.categoryName }}
          </el-checkbox>
          <span v-if="!g.children.length" class="no-leaf">（无子分类）</span>
        </div>
      </div>
      <el-empty v-if="!groups.length" description="没有匹配的语法专题" :image-size="48" />
    </div>

    <div v-if="selectedCount" class="picker-chips">
      <span class="chips-label">已选专题</span>
      <el-tag
        v-for="id in props.modelValue"
        :key="id"
        size="small"
        closable
        type="primary"
        effect="light"
        @close="removeOne(id)"
      >
        {{ pathLabel(id) }}
      </el-tag>
    </div>
  </div>
</template>

<style scoped>
.cat-picker {
  width: 100%;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
}
.picker-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #f0f2f5;
  flex-wrap: wrap;
}
.picker-search { width: 200px; }
.picker-tools {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}
.picker-count { font-size: 12px; color: #909399; }
.picker-count b { color: #409eff; font-size: 13px; }
.picker-groups {
  max-height: 320px;
  overflow-y: auto;
  padding: 4px 12px 10px;
}
.cat-group-block { border-bottom: 1px dashed #f0f2f5; padding: 6px 0; }
.cat-group-block:last-child { border-bottom: none; }
.group-head { display: flex; align-items: center; gap: 6px; }
.group-toggle {
  border: none;
  background: none;
  padding: 2px;
  cursor: pointer;
  color: #a8abb2;
  display: inline-flex;
}
.group-toggle .el-icon { transition: transform 0.2s; }
.group-toggle .el-icon.open { transform: rotate(90deg); }
.group-check :deep(.el-checkbox__label) { font-weight: 600; color: #303133; }
.group-name { font-size: 13px; }
.group-meta { margin-left: auto; font-size: 12px; color: #909399; }
.group-meta em { font-style: normal; color: #c0c4cc; }
.group-body {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding: 4px 0 4px 26px;
}
.leaf-check { margin-right: 0; }
.leaf-check :deep(.el-checkbox__label) { font-size: 13px; color: #606266; }
.no-leaf { font-size: 12px; color: #c0c4cc; }
.picker-chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid #f0f2f5;
  background: #fafbfc;
  border-radius: 0 0 8px 8px;
}
.chips-label { font-size: 12px; color: #909399; }
</style>
