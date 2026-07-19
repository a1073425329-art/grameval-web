<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** 试题数量 */
  total: number
  /** 当前题号（1-based） */
  current: number
  /** 已作答题号集合（1-based） */
  answered: number[] | Set<number>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'jump', index: number): void
}>()

const answeredSet = computed<Set<number>>(() =>
  props.answered instanceof Set ? props.answered : new Set(props.answered)
)

const items = computed(() => {
  return Array.from({ length: props.total }, (_v, i) => {
    const idx = i + 1
    return {
      index: idx,
      active: idx === props.current,
      answered: answeredSet.value.has(idx),
    }
  })
})

const answeredCount = computed(() => answeredSet.value.size)

const jump = (idx: number) => emit('jump', idx)
</script>

<template>
  <div class="answer-sheet">
    <div class="sheet-header">
      <span>答题卡</span>
      <span class="progress">{{ answeredCount }} / {{ total }}</span>
    </div>
    <div class="grid">
      <button
        v-for="it in items"
        :key="it.index"
        class="cell"
        :class="{ active: it.active, answered: it.answered }"
        @click="jump(it.index)"
      >
        {{ it.index }}
      </button>
    </div>
    <div class="legend">
      <span><i class="dot dot-active" />当前</span>
      <span><i class="dot dot-answered" />已答</span>
      <span><i class="dot dot-empty" />未答</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.answer-sheet {
  background: #fff;
  border-radius: 6px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.progress {
  color: #409eff;
  font-size: 13px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.cell {
  height: 36px;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;

  &:hover {
    border-color: #409eff;
    color: #409eff;
  }
}

.cell.answered {
  background: #ecf5ff;
  border-color: #a0cfff;
  color: #409eff;
}

.cell.active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}

.legend {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  font-size: 12px;
  color: #909399;

  span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
}

.dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid #dcdfe6;
}
.dot-empty {
  background: #fff;
}
.dot-answered {
  background: #ecf5ff;
  border-color: #a0cfff;
}
.dot-active {
  background: #409eff;
  border-color: #409eff;
}
</style>
