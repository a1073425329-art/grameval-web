import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

export interface Tag {
  name: string        // route name
  path: string        // route.fullPath
  title: string
  affix?: boolean     // 固定不可关闭
}

/** 多页签管理，参考 vue-element-admin */
export const useTagsStore = defineStore('tags', () => {
  const tags = ref<Tag[]>([])

  const addTag = (route: RouteLocationNormalizedLoaded) => {
    // 无 name 或明确 hidden 的路由不入栈
    if (!route.name) return
    if (route.meta?.hideTag) return

    const exists = tags.value.find((t) => t.path === route.fullPath)
    if (exists) return

    tags.value.push({
      name: String(route.name),
      path: route.fullPath,
      title: (route.meta?.title as string) || String(route.name),
      affix: Boolean(route.meta?.affix),
    })
  }

  const removeTag = (path: string) => {
    const idx = tags.value.findIndex((t) => t.path === path)
    if (idx === -1) return
    if (tags.value[idx].affix) return
    tags.value.splice(idx, 1)
  }

  const removeOthers = (path: string) => {
    tags.value = tags.value.filter((t) => t.path === path || t.affix)
  }

  const removeAll = () => {
    tags.value = tags.value.filter((t) => t.affix)
  }

  return {
    tags,
    addTag,
    removeTag,
    removeOthers,
    removeAll,
  }
})
