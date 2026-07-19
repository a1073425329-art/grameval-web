<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

interface MenuItem {
  path: string
  title: string
  icon: string
  roles?: string[]
}

const menuList: MenuItem[] = [
  { path: '/dashboard', title: '首页', icon: 'HomeFilled' },
  { path: '/exam', title: '考试管理', icon: 'EditPen' },
  { path: '/question', title: '题库管理', icon: 'Notebook' },
  { path: '/record', title: '考试记录', icon: 'Tickets' },
  { path: '/user', title: '用户管理', icon: 'UserFilled' },
]

const activeMenu = computed(() => route.path)

const handleMenuClick = (item: MenuItem) => {
  router.push(item.path)
}
</script>

<template>
  <div class="sidebar-wrapper">
    <div class="sidebar-logo">
      <span class="logo-text">GramEval</span>
    </div>
    <el-menu
      :default-active="activeMenu"
      :background-color="'#304156'"
      :text-color="'#bfcbd9'"
      :active-text-color="'#409eff'"
      :router="false"
      class="sidebar-menu"
    >
      <el-menu-item
        v-for="item in menuList"
        :key="item.path"
        :index="item.path"
        @click="handleMenuClick(item)"
      >
        <el-icon>
          <component :is="item.icon" />
        </el-icon>
        <span>{{ item.title }}</span>
      </el-menu-item>
    </el-menu>
  </div>
</template>

<style scoped lang="scss">
.sidebar-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.sidebar-logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo-text {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 2px;
}

.sidebar-menu {
  border-right: none;
  flex: 1;
}
</style>