<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** 试题数量 */
  total: number
  /** 当前题号（1-based） */
  current: number
  /** 已作答题号集合（1-based） */
  answered: number[] | Set<number>
  /** 已标记题号集合（1-based） */
  marked?: number[] | Set<number>
  /** 题型筛选（空表示全部） */
  filterType?: string
  /** 各题题型列表（1-based） */
  questionTypes?: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'jump', index: number): void
  (e: 'filter', type: string): void
}>()

const filterTypes = [
  { value: 'SINGLE', label: '单选' },
  { value: 'MULTIPLE', label: '多选' },
  { value: 'JUDGE', label: '判断' },
  { value: 'FILL_HINT', label: '填空' },
  { value: 'READING', label: '阅读' },
]

const answeredSet = computed<Set<number>>(() =>
  props.answered instanceof Set ? props.answered : new Set(props.answered)
)

const markedSet = computed<Set<number>>(() =>
  props.marked instanceof Set ? props.marked : new Set(props.marked ?? [])
)

/** [2026-10-16 对齐] FILL（无提示填空）与 FILL_HINT（带括号提示填空）同属「填空」，
 *  答题卡按题型筛选时统一归口到 FILL_HINT，避免手写 FILL 题筛不出来。
 *  旧实现：filteredOut = props.filterType && type !== props.filterType
 */
const normType = (t: string) => (t === 'FILL' ? 'FILL_HINT' : t)

const items = computed(() => {
  return Array.from({ length: props.total }, (_v, i) => {
    const idx = i + 1
    const type = props.questionTypes?.[i] || ''
    const filteredOut = props.filterType && normType(type) !== props.filterType
    return {
      index: idx,
      active: idx === props.current,
      answered: answeredSet.value.has(idx),
      marked: markedSet.value.has(idx),
      filteredOut,
      type,
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
    <div class="type-filter">
      <el-button-group size="small">
        <el-button 
          :type="!filterType ? 'primary' : 'default'" 
          @click="$emit('filter', '')"
        >全部</el-button>
        <el-button 
          v-for="ft in filterTypes" 
          :key="ft.value"
          :type="filterType === ft.value ? 'primary' : 'default'"
          @click="$emit('filter', ft.value)"
        >{{ ft.label }}</el-button>
      </el-button-group>
    </div>
    <div class="grid">
      <button
        v-for="it in items"
        :key="it.index"
        class="cell"
        :class="{ active: it.active, answered: it.answered, marked: it.marked, filtered: it.filteredOut }"
        @click="jump(it.index)"
      >
        <span class="num">{{ it.index }}</span>
        <span v-if="it.marked" class="flag">*</span>
      </button>
    </div>
    <div class="legend">
      <span><i class="dot dot-active" />当前</span>
      <span><i class="dot dot-answered" />已答</span>
      <span><i class="dot dot-marked" />标记</span>
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

.type-filter {
  margin-bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.cell {
  height: 40px;
  border-radius: 6px;
  border: 1.5px solid #e4e7ed;
  background: #fff;
  color: #606266;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    border-color: #409eff;
    color: #409eff;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
  }
}

.cell.answered {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
}

.cell.active {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  border-color: #409eff;
  color: #fff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.4);
}

.cell.marked {
  border-color: #f5a623;
  & .num { color: #f5a623; }
  & .flag {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 14px;
    height: 14px;
    background: #f5a623;
    color: #fff;
    border-radius: 50%;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }
}

.cell.active.marked {
  & .flag { background: #fff; color: #409eff; }
}

.cell.filtered {
  opacity: 0.3;
  pointer-events: none;
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
  border-radius: 3px;
  border: 1.5px solid #dcdfe6;
}
.dot-empty {
  background: #fff;
}
.dot-answered {
  background: #ecf5ff;
  border-color: #409eff;
}
.dot-active {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  border-color: #409eff;
}
.dot-marked {
  background: #fff;
  border-color: #f5a623;
  position: relative;
  &::after {
    content: '';
    position: absolute;
    top: -3px;
    right: -3px;
    width: 6px;
    height: 6px;
    background: #f5a623;
    border-radius: 50%;
  }
}
</style>
