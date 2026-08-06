<script setup lang="ts">
// 全局根组件，承载路由出口，并维护全局通知 WebSocket 连接。
import { onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationWebSocket } from '@/composables/useNotificationWebSocket'

const authStore = useAuthStore()
const notifWs = useNotificationWebSocket()

// 登录态变化时连接 / 断开通知 WebSocket
watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) notifWs.connect()
    else notifWs.disconnect()
  },
)

// token 变化（例如重新登录换取新 token）时重连
watch(
  () => authStore.token,
  (token) => {
    if (token) notifWs.connect()
    else notifWs.disconnect()
  },
)

onMounted(() => {
  // 已登录则立即建立通知通道；新消息会以 ElNotification 弹出
  if (authStore.isLoggedIn) notifWs.connect()
})
</script>

<template>
  <router-view />
</template>
