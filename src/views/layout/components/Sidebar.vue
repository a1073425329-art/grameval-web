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

interface MenuItem {
  path: string
  title: string
  icon?: string
}

interface MenuGroup {
  title: string
  items: MenuItem[]
}

/** 从路由 meta.group 中聚合出分组菜单 */
const menuGroups = computed<{ standalone: MenuItem[]; groups: MenuGroup[] }>(() => {
  const visible = permissionStore.routes.filter((r: RouteRecordRaw) => !r.meta?.hidden)
  const standalone: MenuItem[] = []
  const groupMap = new Map<string, MenuItem[]>()

  visible.forEach((r: RouteRecordRaw) => {
    const item: MenuItem = {
      path: '/' + r.path,
      title: (r.meta?.title as string) ?? r.path,
      icon: r.meta?.icon as string | undefined,
    }
    const group = r.meta?.group as string | undefined
    if (group) {
      if (!groupMap.has(group)) groupMap.set(group, [])
      groupMap.get(group)!.push(item)
    } else {
      standalone.push(item)
    }
  })

  const groups: MenuGroup[] = Array.from(groupMap.entries()).map(([title, items]) => ({ title, items }))
  return { standalone, groups }
})

const activeMenu = computed(() => route.path)
const collapsed = computed(() => appStore.sidebarCollapsed)

const handleClick = (path: string) => router.push(path)
</script>

<template>
  <div class="sidebar" :class="{ 'is-collapsed': collapsed }">
    <!-- Logo -->
    <div class="sidebar-logo">
      <div class="logo-icon"><el-icon size="20"><EditPen /></el-icon></div>
      <transition name="logo-fade">
        <span v-show="!collapsed" class="logo-text">GramEval</span>
      </transition>
    </div>

    <!-- Menu -->
    <el-scrollbar class="sidebar-scroll">
      <el-menu
        :default-active="activeMenu"
        :default-openeds="['__group__题库管理', '__group__考试管理', '__group__系统管理管理']"
        :collapse="collapsed"
        :collapse-transition="false"
        background-color="transparent"
        text-color="#bfcbd9"
        active-text-color="#ffffff"
        class="sidebar-menu"
      >
        <!-- 独立项 -->
        <el-menu-item
          v-for="item in menuGroups.standalone"
          :key="item.path"
          :index="item.path"
          @click="handleClick(item.path)"
        >
          <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>

        <!-- 分组 -->
        <el-sub-menu
          v-for="group in menuGroups.groups"
          :key="group.title"
          :index="'__group__' + group.title"
        >
          <template #title>
            <span>{{ group.title }}</span>
          </template>
          <el-menu-item
            v-for="item in group.items"
            :key="item.path"
            :index="item.path"
            @click="handleClick(item.path)"
          >
            <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
            <template #title>{{ item.title }}</template>
          </el-menu-item>
        </el-sub-menu>
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
  display: flex; align-items: center;
  padding: 0 16px; gap: 10px; overflow: hidden;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  flex-shrink: 0;

  .logo-icon {
    width: 32px; height: 32px; border-radius: $radius-sm;
    background: linear-gradient(135deg, $primary-color 0%, #79bbff 100%);
    color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .logo-text {
    color: #fff; font-size: 17px; font-weight: 700; letter-spacing: 1px; white-space: nowrap;
  }
}

.logo-fade-enter-active, .logo-fade-leave-active { transition: opacity 0.28s; }
.logo-fade-enter-from, .logo-fade-leave-to { opacity: 0; }

.sidebar-scroll { flex: 1; }

.sidebar-menu {
  border-right: none !important;

  // 菜单项
  :deep(.el-menu-item) {
    height: 44px; line-height: 44px;
    color: $sidebar-text !important;
    transition: $trans-fast; margin: 1px 0;
    &:hover { background: $sidebar-hover-bg !important; color: #fff !important; }
    &.is-active {
      background: $sidebar-active-bg !important; color: #fff !important;
      &::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: $primary-color; }
    }
  }

  :deep(.el-menu-item [class^='el-icon']) { color: $sidebar-text; }
  :deep(.el-menu-item.is-active [class^='el-icon']) { color: #fff; }

  // 子菜单标题
  :deep(.el-sub-menu__title) {
    height: 44px; line-height: 44px;
    color: $sidebar-text !important;
    font-size: 13px; font-weight: 600; letter-spacing: 0.5px;
    &:hover { background: $sidebar-hover-bg !important; color: #fff !important; }
    .el-icon { color: $sidebar-text; }
  }

  // 子菜单展开时标题高亮
  :deep(.el-sub-menu.is-opened .el-sub-menu__title) {
    color: #fff !important;
    .el-icon { color: #fff; }
  }

  &:not(.el-menu--collapse) {
    :deep(.el-menu-item) { padding-left: 20px !important; }
    // 子菜单内的项目多缩进一点
    :deep(.el-sub-menu .el-menu-item) { padding-left: 48px !important; }
  }
}

.sidebar.is-collapsed {
  .sidebar-logo { padding: 0; justify-content: center; }
}
</style>
