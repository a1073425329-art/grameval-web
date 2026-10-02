<script setup lang="ts">
import { computed } from 'vue'

/**
 * 阅读理解文章卡。
 *
 * 一篇文章挂多道题，因此这张卡只在**同组第一题**上方出现一次（由父组件决定何时渲染），
 * 组内还有几题共用这篇，用 groupTotal 说明。
 */
const props = defineProps<{
  content: string
  /** 可选字段显式放宽 undefined —— 项目开了 exactOptionalPropertyTypes */
  title?: string | undefined
  wordCount?: number | undefined
  /** 共用这篇文章的题目数，大于 1 时提示组规模 */
  groupTotal?: number | undefined
}>()

const showGroupTag = computed(() => (props.groupTotal ?? 0) > 1)
</script>

<template>
  <div class="passage-box">
    <div class="passage-head">
      <span class="passage-badge">阅读理解</span>
      <span class="passage-title">{{ title || '短文' }}</span>
      <el-tag v-if="wordCount" size="small" type="info" effect="plain">约 {{ wordCount }} 词</el-tag>
      <el-tag v-if="showGroupTag" size="small" type="warning" effect="plain">
        本组共 {{ groupTotal }} 题
      </el-tag>
    </div>
    <div class="passage-body">{{ content }}</div>
    <div class="passage-tip">请先阅读短文，再结合短文内容完成下方题目</div>
  </div>
</template>

<style scoped>
/**
 * 字号与最大高度开放给使用方：考试页有字号设置（小/中/大）且长文要能滚动，
 * 它在自己容器上设 --passage-font-size / --passage-max-height 即可，这里给默认值。
 */
.passage-box {
  margin-bottom: 20px;
  padding: 16px 20px 14px;
  border: 1px solid #d9ecff;
  border-left: 4px solid #409eff;
  border-radius: 8px;
  background: linear-gradient(180deg, #f7fbff 0%, #ffffff 100%);
  max-height: var(--passage-max-height, none);
  overflow-y: auto;
}
.passage-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #d9ecff;
}
.passage-badge {
  padding: 2px 10px;
  border-radius: 999px;
  background: #409eff;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.passage-title {
  font-size: var(--passage-font-size, 15px);
  font-weight: 600;
  color: #1f2d3d;
}
.passage-body {
  font-size: var(--passage-font-size, 15px);
  line-height: 2;
  color: #303133;
  text-align: justify;
  white-space: pre-wrap;
}
.passage-tip {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #d9ecff;
  font-size: 12px;
  color: #909399;
}
</style>
