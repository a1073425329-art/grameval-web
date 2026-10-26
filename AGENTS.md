# grameval-web 项目规则（AGENTS）

> 前端（Vue 3.5 + Vite 8 + TypeScript，独立 git 仓库）的**操作契约**。
> 工作区级规则（目录禁区、落盘与命名、红线、部署契约、唯一来源）在上一级 [`../AGENTS.md`](../AGENTS.md)，本文件不重复。
> 系统介绍、页面清单、接口表见 [`README.md`](README.md)；本文件每条事实标出处，标「实测」的是逐行打开文件核对过的。

## 0. 最容易违反的一条先说

**`npm run build` 不是构建，是六层门禁编排器**（`package.json:11-14` 实测：scripts 只有 `dev` 和 `build` 两条；`build` = `node scripts/check.mjs`，真正执行 `vite build` 的位置在 `scripts/check.mjs:129`，是第 6 层）。

```powershell
npm run build                      # 六层全跑：env → syntax → types → lint → unit → build
npm run build -- types             # 只跑单层（层名见 check.mjs:183-202，写错退出码 2）
npm run build -- --with-e2e        # 追加 E2E：需要后端 9001 已起（check.mjs:202,245）
npm run dev                        # Vite dev server，端口 9000
```

**没有** `test` / `lint` / `typecheck` / `preview` 这些脚本 —— 想单独跑 lint 或类型检查，走上面的单层用法，别去 `npx eslint` 造第二套口径。

## 1. 技术栈与版本口径（实测，含三处需要小心的地方）

| 项 | 声明（`package.json`） | 实装（`node_modules`） |
|---|---|---|
| Vue | `^3.5.39` `:29` | **3.5.40** |
| Vite | `^8.1.1` `:52` | **8.1.5** |
| TypeScript | `~6.0.2` `:50` | 6.0.3 |
| Element Plus / vue-router / pinia / axios / echarts | `:26,31,27,23,25` | 2.14.3 / 4.6.4 / 4.0.2 / 1.18.1 / 6.1.0 |
| vue-tsc / vitest / ESLint | `:55,54,44` | 3.3.7 / 4.1.10 / 10.8.0（flat config） |

1. **Vite 8 底层是 Rolldown，不是 Rollup**：`node_modules/.pnpm/rolldown@1.1.5/`，产物里能看到 `assets/js/rolldown-runtime-*.js`；而 `vite.config.ts:59` 仍写 `rollupOptions`（兼容别名）。按 Rollup 语义调分包前先小样验证。
2. **「必须用 pnpm」只是文档说法，没有被机制强制**：无 `packageManager` 字段（实测），只有 `pnpm-lock.yaml` 与 `pnpm-workspace.yaml`（`allowBuilds` / `onlyBuiltDependencies: @parcel/watcher, vue-demi`），`.npmrc` 三行是 `engine-strict=true`、`save-exact=false`、`package-lock=true`（第 3 行与仓库只有 pnpm lock 自相矛盾，属噪声）。而门禁 `check.mjs:38-40` 用 `process.execPath` + `node_modules/<pkg>/bin` 直调，**绕开 shell/npm/pnpm**，所以门禁本身与包管理器无关。
3. **Node 版本三处口径不一致**：`package.json:6-10` `engines: node>=20.19.0, npm>=10, engineStrict:true`；`.nvmrc`/`.node-version` 都是 `20.19.0`；`scripts/check-env.cjs:7-9` 硬编码同样的阈值**且只校验 npm、不校验 pnpm**；本机实测 `node -v` = **v26.5.0**（npm 11.17.0、pnpm 11.27.1）。别把「必须 20.19」当硬性事实去改别人环境。

## 2. 门禁真相：哪层真拦、哪层名不副实

| 层 | 做什么 | 实测细节 |
|---|---|---|
| `env` | 版本校验 | 走 `check-env.cjs`，`execSync('npm -v')`，npm 不在 PATH 时靠 catch 跳过（`:34-41`） |
| `syntax` | 自研 `scripts/lint-vue.mjs`（9 类启发式规则，`:4-14`） | 每次运行重写 `scripts/lint-vue.report.json`（`:330`） |
| `types` | `vue-tsc -b` 三工程（`tsconfig.json:3-7` → app/node/tests） | **真正的强闸门**：`tsconfig.app.json:14-26` 开了 `strict`、`noUnusedLocals`、`noUnusedParameters`、`noImplicitReturns`、`noImplicitOverride`、`noFallthroughCasesInSwitch`、`erasableSyntaxOnly`、**`noUncheckedIndexedAccess`**、**`exactOptionalPropertyTypes`**（2026-09-26 起最严档） |
| `lint` | ESLint，`--max-warnings 0`（`check.mjs:114`） | ⚠ **0-warning 只对「实际启用的规则」生效**：`eslint.config.js:55,62` 实测把 `@typescript-eslint/no-explicit-any` 与 `ban-ts-comment` 设为 `off`，`no-unused-vars` 也 `off`（`:59-60,96-97`）。所以 **`any` 和 `@ts-ignore` 能通过门禁** —— `README.md:342` 的说法与代码不符，以代码为准。Vue 侧硬拦的是 9 条 Vue 2 遗存规则（`:101-118`）；`vue/no-v-html` 只是 warn（`:135`） |
| `unit` | Vitest（`vitest.config.ts:19-20`：`tests/unit/**/*.spec.ts` + `src/**/__tests__/*.spec.ts`，`happy-dom`） | **实测只有 3 个单测**：`tests/unit/ExamList.spec.ts`、`markdown.spec.ts`、`questionUnits.spec.ts`；`src/**/__tests__/` 目录不存在。`README.md:533` 与 `TESTING.md:63-71` 描述的 `StudyNotes.spec.ts`、`StudyGroups.spec.ts` 已在提交 `45c6287`「项目精简清理」中随页面一起删除 —— **这是当前最严重的文档漂移** |
| `build` | `vite build` + 体积基线 | `check.mjs:47-52` `BUNDLE_BASELINE = {index:150, vendor:450, elementPlus:1900, echarts:1500}`，判定线 = 基线 × 1.15（`:165`），`other` 不设基线（`:169-171`） |

- **没有 Prettier**（无配置文件、无依赖、无 format 脚本）、**没有 CI**（无 `.github/`、无 husky/lint-staged/pre-commit）。唯一「CI」就是人自觉跑 `npm run build`。
- **Playwright 不在默认门禁内**：`playwright.config.ts` 的 `testMatch` 只收 `e2e|api` 目录加 `tests/admin.test.ts`、`tests/student.test.ts`（`:6`），`baseURL: 9000`，`webServer.command: 'npm run dev'`，projects **只有 chromium**（`:20-25`）。`tests/admin.test.ts`、`tests/student.test.ts` 是 Playwright 用例（**需要后端**），不是 vitest 单测，别混进 `unit` 层理解。

## 3. 端口、代理与产物（`vite.config.ts` 实测）

- dev 端口 **9000**（`:40`）；代理 `'/api' → http://localhost:9001`（`:41-46`），**无 rewrite**，所以后端路径同样带 `/api`。改后端地址只改 `proxy.target`（`README.md:243`）。
- **`base` 键不存在**（实测全文件 0 命中），取默认 `/`；`dist/index.html` 产出的是 `/assets/js/index-*.js` 绝对根路径。
- `build` 段：`outDir` 未设（默认 `dist`，已被 `.gitignore:11` 忽略）、`emptyOutDir: true`、`sourcemap: false`、`minify: 'terser'`、`target: 'esnext'`、`cssCodeSplit: true`；产物命名 `assets/js/[name]-[hash].js`、`assets/[ext]/[name]-[hash].[ext]`（`:98-100`）；`modulePreload.resolveDependencies` 过滤掉含 `echarts` 的依赖（`:115-117`）。
- 压缩：插件层 gzip（`:20-25`）+ brotli（`:27-32`）双实例，`threshold: 1024, minRatio: 0.8`，产物确有 `index.html.gz`。
- 别名 `@ → src` 在 `vite.config.ts:36` 与 `vitest.config.ts:13` **各声明一次**，改一处必须改两处。
- `server.watch.ignored`（`:50-55`）排除 `node_modules`/`.git`/`*.tmpdir`/`*.tmp`，是为规避 chokidar 对锁定 `.tmp` 抛 `EBUSY` 打挂 dev server（`:48-49` 注释）——**别把它当冗余配置删掉**。
- 路由是 hash 模式（`src/router/index.ts:67` `createWebHashHistory()`），线上地址形如 `/#/admin/...`。

## 4. 本项目最脆弱的一条红线：`vue-eslint-parser` 靠手工软链续命

pnpm 默认不把间接依赖提升到顶层 `node_modules`，而有两个包是「脚本直接 import、却只是别人的间接依赖」：

| 包 | 谁在 import | 现状（实测） |
|---|---|---|
| `@vue/compiler-sfc` | `scripts/lint-vue.mjs` | **已修进代码**：`lint-vue.mjs:28` 改为 `import { parse as parseSFC } from 'vue/compiler-sfc'`，走 `vue` 自己导出的子路径（`node_modules/vue/package.json:46` 有 `./compiler-sfc`）。顶层 `node_modules/@vue/` 里确实**没有** `compiler-sfc` |
| `vue-eslint-parser` | `eslint.config.js:15` | **只靠一个手工建的 symlink**：`node_modules/vue-eslint-parser` → `.pnpm/vue-eslint-parser@10.4.1_eslint@10.8.0/node_modules/vue-eslint-parser`（实测创建时间 10-16）；`package.json` 里**没有**这个依赖 |

后果：**任何 `pnpm install` 或删 `node_modules` 都会让 `lint` 层 `ERR_MODULE_NOT_FOUND`**。自检与恢复：

```powershell
# 自检：这个链接还在不在
Test-Path grameval-web\node_modules\vue-eslint-parser
```

1. 重建 Junction（不动依赖清单，推荐）：见 [`../AGENTS.md` §8 第 1 条](../AGENTS.md) 与 `_根目录整理-20261021\README-瘦身前原文.md` §5.1 的 PowerShell 原文；
2. 或正式声明依赖 `pnpm add -D vue-eslint-parser` —— 会改 `package.json` + lock，**属依赖契约变更，动手前需确认**。

遇到 lint 层报 `ERR_MODULE_NOT_FOUND` 时，先按上面判定，别去改业务码，也别直接宣布「门禁挂了」。

## 5. 代码级唯一来源与红线（都在源码里写着，改之前读注释）

| 语义 | 唯一来源 | 后果 |
|---|---|---|
| **登录态读写**（3 个 storage key） | `src/utils/authStorage.ts:1-16`，文件顶部有「【铁律】任何模块只能走本文件，严禁直接碰 localStorage/sessionStorage」 | 2026-09-27 因绕过它导致**全站 401 死循环**；配套收口在 `src/utils/request.ts:6-22`（401 必须走 `clearAuth()` + 动态 import auth store 避免循环依赖）、`src/stores/auth.ts:8-15`（`:13-15` 明确「勿再引入三个 KEY 别名」） |
| HTTP baseURL | `src/utils/request.ts:37-40`，**硬编码 `'/api'`**，不读环境变量 | 前端代码里不该出现后端主机地址；请求上限同文件三处硬编码（3MB / 查询 8000 / 字符串参数 2000） |
| WS 地址 | `src/utils/websocket.ts:65-74`：`VITE_WS_BASE_URL` > PROD 按 `location` 推导 > 兜底 `ws://localhost:9001` | 这是**全仓唯一声明过的环境变量**（类型在 `src/vite-env.d.ts:11-17`），且**没有任何 `.env` 文件**（实测 `.env*` 0 命中） |
| 路由守卫四处不可动 | `src/router/index.ts:44-53`（`/404` 必须显式注册）、`:58-62`（catch-all **不能**加 `noAuth`，否则刷新 `/dashboard` 永久卡 404）、`:151-155`（动态路由后**必须** `return to.fullPath`）、`:161-165`（`DISABLED_PATHS` 分支必须排在 NotFound 兜底之前） | 每处都自带解释性注释，属代码级红线 |
| 越权收口 | `src/router/index.ts:71-83,129-142`：`registeredNames` 只能由本文件维护（`:79-81` 注释说明为何不放 `stores/permission.ts` —— 循环依赖） | 切账号后残留上一账号的可见路由 |
| 禁用模块 | `src/router/asyncRoutes.ts:19-27` `DISABLED_PATHS`（**实测 6 条**：leaderboard、weekly-report、answer-cards、exam-monitor-log、exam-comments、workflow）+ 对应 `meta.disabled`（`:94,101,171,190,197,224`），过滤器三关在 `src/stores/permission.ts:12-27`（`disabled`/`superOnly`/`roles`） | 恢复方式写在 `asyncRoutes.ts:17` |
| 分包顺序不可回退 | `vite.config.ts:63-68` 注释 + `:69-92` 代码顺序：`element-plus` 分支必须在 `id.includes('vue')` **之前** | 历史事故：vendor 从 357 KB 涨到 2082 KB（`:67` 注释记着） |
| 模型密钥「回传即不改」 | `src/api/system.ts:51`（脱敏 key，提交时原样回传表示不修改）+ `src/views/admin/SystemSettings.vue` 六处 `!includes('***')` 判据（`:1584,1669,1694,1755,1881` 等） | 把 `***` 当新 key 提交会覆盖成真值 `***` |
| 自助注册恒定为学生 | `src/views/register/index.vue:89`（`[2026-10-16 安全对齐]`，旧选项注释保留） | 恢复 ADMIN 选项 = 越权入口 |
| 判断题中文术语 | `src/utils/dict.ts:9-15` 两份独立映射（选项 `对/错`、结果 `正确/答错`）；实测全仓 `'对'`/`'错'` 字面量**只出现在 dict.ts** | 自行拼接文案会与学生答案判定错配 |
| AI 出题超时 | `src/api/ai.ts:124,257`：实测 20 题 209 s，原 180 s 不够且必须覆盖 | 超时导致出题整批失败 |
| 新增角色后的首页 | `src/stores/auth.ts:28-31` `HOME_BY_ROLE`（ADMIN→`/dashboard`，STUDENT→`/student/home`） | 新角色登录后落错页 |

## 6. 新增一个页面必须同时动的文件（用真实提交反推的共变集合）

拿 HEAD 之前那次「新增系统架构页」的提交 `45c6287` 实测出的改动面：

| 必改 | 作用 |
|---|---|
| `src/views/<role>/Xxx.vue` | 页面本体（`src/views/` 实际分层：`admin/` 22 个 .vue、`student/` 14、`common/`、`dashboard/`、`layout/`、`login/`、`register/`、`error/`、`redirect/`） |
| `src/router/asyncRoutes.ts` | 注册路由 + `meta.roles` / `group` / `hidden` / `superOnly`（结构见 `:117-254`） |
| `src/api/<域>.ts` + `src/types/<域>.ts` | 请求函数与类型（`src/api/` 19 个文件，每个第一行都是 `import request from '@/utils/request'`） |
| `tests/api/frontend-urls.test.ts` | **URL 契约白名单**（`README.md:556-562` 的「添加新页面 5 步」漏了这一条） |
| 视情况：`src/utils/formLimits.ts`、`src/styles/index.scss`、`src/views/layout/components/Header.vue` | 表单上限、全局样式、顶栏入口 |

**侧边栏不用改**：`src/views/layout/components/Sidebar.vue:25-26` 的菜单由 `permissionStore.routes` 派生（按 `meta.hidden` 过滤、按 `meta.group` 分组）。要「进侧边栏」就配 `meta.group`，要「只留路由不显示菜单」就配 `meta.hidden`（架构页正是这么处理的）。

## 7. 部署（本仓没有部署章节，契约只有一份）

- 部署流程、备份留档位置、验收清单、回滚、铁律 → **唯一正本在 [`../AGENTS.md` §10](../AGENTS.md)**（工作区 `tools/deploy_grameval_cloud.ps1` / `.sh`）。`grameval-web/README.md` 历史上完全没有部署章节，别在这里另写一份。
- **上线前置条件是 `npm run build` 全绿**：部署脚本会先检查 `grameval-web/dist/index.html`（`tools/deploy_grameval_cloud.ps1:12-15`、`.sh:34-37`，缺失就报「请先执行 npm run build」）。
- 本仓的 `Dockerfile`（473 B，两阶段）里 `RUN pnpm run build || npm run build` —— 因为它跑的就是六层门禁，**任何一层红都导致镜像构建失败**；它还允许 `pnpm install || npm install` 回退（所以镜像里也没强制 pnpm）。运行阶段 `nginx:alpine`、`EXPOSE 8080`、用 `sed` 把 listen 80 改 8080，**没有 nginx 配置文件、没有子目录处理**。
- ⚠ **待核（我不下结论）**：本仓无 `base` 配置、产物用绝对根路径 `/assets/...`，而线上 dist 部署在 nginx 子目录 `/usr/share/nginx/html/grameval`（见 `../AGENTS.md` §10 与母本 17）。这两者是否冲突，取决于线上 nginx `location` 怎么配（配置副本在 `tools/nginx-grameval.conf`、`tools/nginx-grameval-perf.conf`）；**要动线上路径规则前先看那两个 conf，别凭本文件推断。**
- 未跟踪垃圾（`git status` 实测为 `??`，且没进 `.gitignore`）：`playwright-report/`、`test-results/`、8 个 `debug-*.cjs` / `debug-*.png`、`tests/e2e/student-interactions.test.ts.bak-20261016-210423`。要不要清，属删除操作，需你点名授权。

## 8. 快照（截至 2026-10-21，**动手前重查**）

git 有未跟踪文件若干（同上）；`dist/` 存在且已 gitignore；本机 Node 26.5.0 / pnpm 11.27.1；`scripts/lint-vue.report.json` 当前内容 `{"errorCount":0,"warnCount":0,"issues":[]}`（是上次运行的产物，不代表本次结果）。

## 9. 已确认的文档漂移（引用 `README.md` 前先对照这份）

| 文档说法 | 实测 | 出处 |
|---|---|---|
| 「任何 `any`/忽略注释都会被第 4 层拦下」 | **不成立**，两条规则 `off` | `README.md:342` vs `eslint.config.js:55,62` |
| 单测清单含 `StudyNotes.spec.ts`、`StudyGroups.spec.ts` | 文件**已不存在**（随页面一起删） | `README.md:533`、`TESTING.md:63-71` vs `tests/unit/` 实测 3 个 |
| 「`scripts/lint-vue.report.json` 2026-10-16 已删除」 | **仍存在**，且每次运行自动再生 | `README.md:596` vs 实测文件 55 B |
| 目录树把 `request.ts` 画在 `api/` 下 | 实际在 `src/utils/request.ts`，`src/api/` 里没有它 | `README.md:161` |
| 「`FILL` → `FILL_HINT` 已统一」 | `src/types/common.ts:31` 的联合类型**仍含 `'FILL'`** | `README.md:495` |
| 路由 `/admin/exams/:id/monitor` | 实为 `admin/exams/:sessionId/{monitor,statistics}` | `README.md:387-388` vs `asyncRoutes.ts:252-253` |
| §四 项目结构 / §九 路由汇总 | **过期**：代码里存在但文档未列的页面 ≥ 8 个（SystemSettings、SystemArchitecture、ClassManage、ReadingPassageManage、PaperTemplateManage、KnowledgeMastery、ScoreCurve、common/MessageCenter） | `README.md:134-184,362-391` |
| 死依赖 `ts-type-cleaner` | 全仓除 `package.json` 自身外零引用 | `package.json:49` |

要修这些文档吗？**上表 9 条没修**（改法牵动「以代码为准还是以实现历史为准」的判断，且属批量改结论，需你点名）；但**演示账号那一处已按 2026-10-21 实时库查询更正**——原表写的 `student01` 在 `sys_user` 里 0 命中，照它登录必失败，属现场故障级错误，不能等。
