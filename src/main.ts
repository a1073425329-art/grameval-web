import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import './styles/index.scss'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import { useDictStore } from './stores/dict'
import { setupIcons } from './plugins/icons'

const app = createApp(App)

// 全局注册 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 全局注册 Iconify / @fuxishi/svg-icon / @yh-ui/icons
setupIcons(app)

const pinia = createPinia()

app.use(pinia)
// Element Plus 2.14 的 locale prop 类型未被 ExtractPropTypes 正确展开:
// 其自带的 zhCn 无法赋值给它自己声明的 Language prop, 属于上游类型缺陷。
// 这里做一次受控断言, 运行时行为完全不变; 升级 element-plus 后可移除。
app.use(ElementPlus, { locale: zhCn } as never)
app.use(router)

// 启动后异步拉字典（失败不阻塞）
const dictStore = useDictStore(pinia)
dictStore.load().catch(() => null)

app.mount('#app')
