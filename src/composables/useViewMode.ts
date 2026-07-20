import { ref, watch } from 'vue'

type ViewMode = 'table' | 'card'

const STORAGE_KEY_PREFIX = 'grameval_view_mode_'

export function useViewMode(pageKey: string) {
  const storageKey = STORAGE_KEY_PREFIX + pageKey
  
  const viewMode = ref<ViewMode>(
    (localStorage.getItem(storageKey) as ViewMode) || 'table'
  )

  watch(viewMode, (val) => {
    localStorage.setItem(storageKey, val)
  })

  const toggleViewMode = () => {
    viewMode.value = viewMode.value === 'table' ? 'card' : 'table'
  }

  return {
    viewMode,
    toggleViewMode,
    isTable: () => viewMode.value === 'table',
    isCard: () => viewMode.value === 'card',
  }
}