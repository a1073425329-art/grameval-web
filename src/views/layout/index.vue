<script setup lang="ts">
// 用户信息在 login 时由后端一次性下发到 authStore，
// 这里不再需要单独拉取。permissionStore 由 router 守卫按 role 生成动态路由。
import Sidebar from './components/Sidebar.vue'
import Header from './components/Header.vue'
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