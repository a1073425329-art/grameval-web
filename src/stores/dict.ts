import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DictItem } from '@/types/common'
import { getAllDict, type DictType } from '@/api/dict'

/**
 * 字典 store —— 应用启动时拉取一次，全局缓存
 * 各页面下拉框、状态标签直接从这里读
 */
export const useDictStore = defineStore('dict', () => {
  const loaded = ref(false)
  const loading = ref(false)
  const dict = ref<Partial<Record<DictType, DictItem[]>>>({})

  const load = async (force = false) => {
    if (loaded.value && !force) return
    if (loading.value) return
    loading.value = true
    try {
      const res = await getAllDict()
      dict.value = res.data as Partial<Record<DictType, DictItem[]>>
      loaded.value = true
    } catch {
      // 静默失败，避免影响页面加载
    } finally {
      loading.value = false
    }
  }

  /** 拿指定字典（未加载则返回空数组） */
  const getItems = (type: DictType): DictItem[] => dict.value[type] || []

  /** value → label */
  const getLabel = (type: DictType, value: string | number): string => {
    const item = getItems(type).find((d) => String(d.value) === String(value))
    return item?.label ?? String(value)
  }

  return { loaded, loading, dict, load, getItems, getLabel }
})
