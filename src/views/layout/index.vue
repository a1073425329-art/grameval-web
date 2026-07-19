<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import Sidebar from './components/Sidebar.vue'
import Header from './components/Header.vue'

const authStore = useAuthStore()

onMounted(async () => {
  if (authStore.token && !authStore.userInfo) {
    try {
      await authStore.fetchUserInfo()
    } catch {
      authStore.logout()
    }
  }
})
</script>

<template>
  <div class="layout-container">
    <Header />
    <div class="layout-body">
      <aside class="layout-sidebar">
        <Sidebar />
      </aside>
      <main class="layout-main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.layout-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.layout-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.layout-sidebar {
  width: 220px;
  background: #304156;
  overflow-y: auto;
  flex-shrink: 0;
}

.layout-main {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f0f2f5;
}
</style>