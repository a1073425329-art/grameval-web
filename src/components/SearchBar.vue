<script setup lang="ts">
import { reactive, watch } from 'vue'

interface FieldItem {
  prop: string
  label: string
  type?: 'input' | 'select' | 'date-range'
  options?: { label: string; value: string | number }[]
  placeholder?: string
}

const props = defineProps<{
  fields: FieldItem[]
  /** 初始值 */
  modelValue?: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: Record<string, unknown>): void
  (e: 'search'): void
  (e: 'reset'): void
}>()

const form = reactive<Record<string, unknown>>({ ...(props.modelValue || {}) })

watch(
  () => form,
  (v) => emit('update:modelValue', { ...v }),
  { deep: true }
)

const onSearch = () => emit('search')
const onReset = () => {
  props.fields.forEach((f) => {
    form[f.prop] = f.type === 'date-range' ? [] : ''
  })
  emit('reset')
}
</script>

<template>
  <el-form :inline="true" :model="form" class="search-bar">
    <el-form-item v-for="f in props.fields" :key="f.prop" :label="f.label">
      <el-input
        v-if="!f.type || f.type === 'input'"
        v-model="form[f.prop] as string"
        :placeholder="f.placeholder || '请输入'"
        clearable
        style="width: 180px"
      />
      <el-select
        v-else-if="f.type === 'select'"
        v-model="form[f.prop]"
        :placeholder="f.placeholder || '请选择'"
        clearable
        style="width: 180px"
      >
        <el-option v-for="op in f.options" :key="String(op.value)" :label="op.label" :value="op.value" />
      </el-select>
      <el-date-picker
        v-else-if="f.type === 'date-range'"
        v-model="form[f.prop]"
        type="daterange"
        range-separator="→"
        start-placeholder="开始"
        end-placeholder="结束"
      />
    </el-form-item>
    <el-form-item>
      <el-button type="primary" @click="onSearch">
        <el-icon><Search /></el-icon>查询
      </el-button>
      <el-button @click="onReset">
        <el-icon><Refresh /></el-icon>重置
      </el-button>
    </el-form-item>
  </el-form>
</template>

<style scoped lang="scss">
.search-bar {
  background: #fff;
  padding: 16px 16px 0 16px;
  border-radius: 4px;
  margin-bottom: 12px;
}
</style>
