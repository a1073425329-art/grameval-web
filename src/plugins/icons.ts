/**
 * 统一图标系统
 * ------------------------------------------------------------------
 * 项目使用四套图标能力,以下四种写法都可以在模板中直接用:
 *
 * 1. unplugin-icons 按需引入 (推荐,构建期 tree-shake,零运行时开销)
 *    <i-mdi-home />
 *    <i-ep-search />        // Element Plus 官方图标集
 *    <i-carbon-user />
 *
 * 2. @iconify/vue 运行时:全量图标名字符串,适合图标名来自后端/字典
 *    <IconifyIcon icon="mdi:home" />
 *
 * 3. @fuxishi/svg-icon 的 <FxIcon /> (含图标选择器 FxIconSelect)
 *    <FxIcon icon="mdi:home" />
 *    <FxIconSelect v-model="iconName" />
 *
 * 4. @yh-ui/icons 的 <YhIcon />,兼容 element-plus 图标短名
 *    <YhIcon name="Search" />      // 内置预注册短名
 *    <YhIcon name="mdi:home" />
 *
 * 三方 Iconify 图标数据可放在 iconify-icon 的 CDN 中按需拉取,也可以
 * 通过 @iconify/json 在构建期以 unplugin-icons 的形式打包进产物。
 */
import type { App } from 'vue'
import { Icon as IconifyIcon } from '@iconify/vue'
import { FxIcon, FxIconSelect } from '@fuxishi/svg-icon'
import '@fuxishi/svg-icon/dist/style.css'
import { YhIcon } from '@yh-ui/icons'

export function setupIcons(app: App) {
  app.component('IconifyIcon', IconifyIcon)
  app.component('FxIcon', FxIcon)
  app.component('FxIconSelect', FxIconSelect)
  app.component('YhIcon', YhIcon)
}

export { IconifyIcon, FxIcon, FxIconSelect, YhIcon }
