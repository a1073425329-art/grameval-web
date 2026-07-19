<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  /** 结束时间戳（ms） */
  deadline: number
  /** 预警阈值（秒），进入后闪烁 */
  warnSeconds?: number
}>()

const emit = defineEmits<{
  (e: 'timeout'): void
  (e: 'tick', remainMs: number): void
}>()

const now = ref(Date.now())
let timer: number | null = null

const start = () => {
  stop()
  timer = window.setInterval(() => {
    now.value = Date.now()
    const remain = props.deadline - now.value
    emit('tick', remain)
    if (remain <= 0) {
      stop()
      emit('timeout')
    }
  }, 1000)
}

const stop = () => {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

watch(
  () => props.deadline,
  () => start(),
  { immediate: true }
)

onBeforeUnmount(stop)

const remainMs = computed(() => Math.max(0, props.deadline - now.value))
const hh = computed(() => pad(Math.floor(remainMs.value / 3600_000)))
const mm = computed(() => pad(Math.floor((remainMs.value % 3600_000) / 60_000)))
const ss = computed(() => pad(Math.floor((remainMs.value % 60_000) / 1000)))

const warning = computed(() => {
  const w = (props.warnSeconds ?? 60) * 1000
  return remainMs.value > 0 && remainMs.value <= w
})

function pad(n: number) {
  return n.toString().padStart(2, '0')
}
</script>

<template>
  <span class="countdown" :class="{ 'is-warning': warning }">
    <el-icon><Clock /></el-icon>
    <span class="time">{{ hh }}:{{ mm }}:{{ ss }}</span>
  </span>
</template>

<style scoped lang="scss">
.countdown {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  font-variant-numeric: tabular-nums;
}

.is-warning {
  color: #f56c6c;
  animation: blink 1s steps(2, start) infinite;
}

@keyframes blink {
  50% {
    opacity: 0.4;
  }
}
</style>
