<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

/**
 * [2026-09-27 新增] 已禁用模块（DISABLED_PATHS）会重定向到 /404?disabled=1。
 * 它和「真的输错地址」是两回事，文案必须区分开 —— 否则用户/评委会以为系统坏了。
 */
const isDisabledModule = route.query.disabled === '1'
</script>

<template>
  <div class="not-found">
    <h1 class="error-code">404</h1>
    <p class="error-desc">{{ isDisabledModule ? '该功能已下线' : '页面不存在' }}</p>
    <p v-if="isDisabledModule" class="error-hint">
      该模块不属于本次设计的主流程，已停用入口；后端接口与数据仍保留。
    </p>
    <el-button type="primary" @click="router.push('/')">返回首页</el-button>
  </div>
</template>

<style scoped lang="scss">
.not-found {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
}

.error-code {
  font-size: 120px;
  font-weight: 700;
  color: #409eff;
  margin: 0;
  line-height: 1;
}

.error-desc {
  font-size: 20px;
  color: #909399;
  margin: 16px 0 8px;
}

.error-hint {
  font-size: 14px;
  color: #a8abb2;
  margin: 0 0 24px;
  max-width: 420px;
  line-height: 1.6;
  text-align: center;
}
</style>