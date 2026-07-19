<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { usePermissionStore } from '@/stores/permission'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const permissionStore = usePermissionStore()

interface DisplayRoute {
  path: string
  title: string
  icon?: string
}

const menuList = computed<DisplayRoute[]>(() =>
  permissionStore.routes
    .filter((r: RouteRecordRaw) => !r.meta?.hidden)
    .map((r: RouteRecordRaw) => ({
      path: '/' + r.path,
      title: (r.meta?.title as string) ?? r.path,
      icon: r.meta?.icon as string | undefined,
    }))
)

const activeMenu = computed(() => route.path)
const collapsed = computed(() => appStore.sidebarCollapsed)

const handleMenuClick = (item: DisplayRoute) => {
  router.push(item.path)
}
</script>

<template>
  <div class="sidebar" :class="{ 'is-collapsed': collapsed }">
    <!-- Logo -->
    <div class="sidebar-logo">
      <div class="logo-icon">
        <el-icon size="20"><EditPen /></el-icon>
      </div>
      <transition name="logo-fade">
        <span v-show="!collapsed" class="logo-text">GramEval</span>
      </transition>
    </div>

    <!-- Menu -->
    <el-scrollbar class="sidebar-scroll">
      <el-menu
        :default-active="activeMenu"
        :collapse="collapsed"
        :collapse-transition="false"
        background-color="transparent"
        text-color="#bfcbd9"
        active-text-color="#ffffff"
        class="sidebar-menu"
      >
        <el-menu-item
          v-for="item in menuList"
          :key="item.path"
          :index="item.path"
          @click="handleMenuClick(item)"
        >
          <el-icon v-if="item.icon">
            <component :is="item.icon" />
          </el-icon>
          <template #title>
            <span>{{ item.title }}</span>
          </template>
        </el-menu-item>
      </el-menu>
    </el-scrollbar>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.sidebar {
  height: 100%;
  background: $sidebar-bg;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width $trans-base;
}

.sidebar-logo {
  height: 50px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 10px;
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;

  .logo-icon {
    width: 32px;
    height: 32px;
    border-radius: $radius-sm;
    background: linear-gradient(135deg, $primary-color 0%, $primary-hover 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .logo-text {
    color: #fff;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 1px;
    white-space: nowrap;
  }
}

.logo-fade-enter-active,
.logo-fade-leave-active { transition: opacity 0.28s; }
.logo-fade-enter-from,
.logo-fade-leave-to { opacity: 0; }

.sidebar-scroll {
  flex: 1;
}

// ---- Menu 样式 ----
.sidebar-menu {
  border-right: none !important;

  :deep(.el-menu-item) {
    height: 46px;
    line-height: 46px;
    color: $sidebar-text !important;
    transition: $trans-fast;
    margin: 2px 0;

    &:hover {
      background: $sidebar-hover-bg !important;
      color: #fff !important;
    }
    &.is-active {
      background: $sidebar-active-bg !important;
      color: #fff !important;
      position: relative;

      // 左侧激活色条
      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: $primary-color;
      }
    }
  }

  :deep(.el-menu-item [class^='el-icon']) {
    color: $sidebar-text;
    margin-right: 8px;
  }
  :deep(.el-menu-item.is-active [class^='el-icon']) {
    color: #fff;
  }

  &:not(.el-menu--collapse) {
    :deep(.el-menu-item) {
      padding-left: 20px !important;
    }
  }
}

// ---- 折叠模式适配 ----
.sidebar.is-collapsed {
  .sidebar-logo {
    padding: 0;
    justify-content: center;
  }
}
</style>
