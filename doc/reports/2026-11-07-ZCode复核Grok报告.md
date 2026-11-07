# ZCode 复核报告：Grok Bot《Zadig-EE-前端-1对1对齐审计》逐项裁决

| 项目 | 内容 |
| --- | --- |
| 复核日期 | 2026-11-07 |
| 复核执行 | ZCode（对账执行员） |
| 复核对象 | `doc/review/2026-11-07-grok-bot/Zadig-EE-前端-1对1对齐审计-REA-Evidence.md` + `inventory/`（apis.csv、routes.csv、components.csv、summary.json、react-source-http-calls.json） |
| Grok 审计基线 | HEAD `82ec35eed`（feat/zadig-portal-next） |
| 复核时当前 HEAD | **`72715c580`** — 注意：Grok 审计落盘后，仓库已合入修复提交 `72715c580`（"resolve defects and contract gaps identified by ZCode reverse audit"，17:23 落库），本复核全部以当前 HEAD 源码为准，并逐项标注基线漂移 |
| 裁决标准 | 【A】真实代码缺陷/危险逻辑（必须立即修复）·【B】边界差异/企业版闭源依赖（需澄清，非代码 Bug）·【C】误报或已在新版本修复 |

---

## 1. 总体裁决

| 项 | 裁决 | 一句话结论 |
| --- | --- | --- |
| P0-01 Plutus | **B** | Grok 证据逐行属实；本质为企业版闭源后端依赖 + 有意占位，非前端代码 Bug |
| P0-02 SAE | **A（部分修复）** | 深链壳已在 `72715c580` 补注册，但 `EnvironmentsPage` 0 处 changeOrder 处理，专属 UI 仍缺；后端开源已就绪 |
| P0-03 移动端深链 | **A（未修复）** | `router/index.tsx:301` 仍将 `:projectName` 当字面量重定向，react-router Navigate 不插值参数 |
| P0-04 动态插件 | **B（含可社区落地项）** | 占位文案属实；插件运行时为企业版能力，但插件管理/仓库 API 开源后端已备，管理页可先落地 |
| P0-05 构建回退 | **A（未修复，最高危）** | `Builds.tsx:313` `|| workflows[0]` 危险回退仍在，匹配失败会静默触发任意第一条工作流真实执行 |
| P1-01 项目向导 | **B** | 跳步为带注释的有意裁剪；与官方 helm/pm 分步向导的客观差异成立，需产品决策补齐 |
| P1-02 模板 | **A（功能缺口）** | 后端 chart/build/scanning 模板 CRUD 全就绪，前端模板中心只读+引导跳转，与官方写能力真实差距 |
| P1-03 License | **A** | 真实拉取 license 却固定渲染"已激活/Active/v5.0.0"，无授权/过期也显示激活，状态未由数据驱动 |
| P1-04 退出登录 | **A** | UI 登出仅清本地 Zustand；调用后端 `GET /api/v1/logout` 的 `authApi.logout` 全 UI 零调用方 |
| P1-05 请求错误 | **A（模式性）** | `api/template.ts:71-154` 七个列表方法与 Plutus 页 catch→空数组，故障与真空态混淆 |
| P1-06 系统集成 | **C** | 12 类别均配真实专属 apiEndpoint 与厂商表单，"只有泛化路径"与事实不符；残余风险降级为 P2 验证项 |

**对 Grok 报告的总体评价**：证据质量高 —— 11 项中 10 项的源码引用在基线版本可复现，行号级命中率高（P0-05、P1-04、P1-05 与当前文件完全吻合；P1-03 存在约 20 行漂移但论点成立）；1 项（P1-06）表述过度保守构成事实性偏差。其 inventory 的方法学声明（"不宣称完整 1:1"、"未知不代替缺失"）严谨可信。

---

## 2. 逐项复核明细

### P0-01 · Plutus 客户交付 — 裁决【B：企业版闭源依赖】

| 维度 | 复核结论 |
| --- | --- |
| Grok 论点 | 17 条目标屏幕 16 条被单页通配承接；`GET /api/plutus/products`、`setProducts([])`、`setActiveTab(k)`、新建按钮无 `onClick`、四 Tab 共用同一表 |
| 源码核查 | **全部属实，行号精确命中**：`frontend/src/pages/Plutus/index.tsx:25`（`http.get('/api/plutus/products')`）、`:27-28`（`catch { setProducts([]) }`）、`:36-69`（customer/version/board/auditlog 四个 tabItem 定义）、`:93-98`（「新建客户」「新建交付项目」两按钮确无 onClick）、`:103`（`onChange={(k) => setActiveTab(k)}`）、`:116`（唯一 Table 渲染 products） |
| 后端边界 | `/api/plutus/*` 业务接口（customer/customerGroup/version/renderSet/env/operation 等约 32 条）在开源仓库 `pkg/microservice/plutus_vendor`、`plutus_enterprise` 中**仅有 health/license/organization**（`plutus_vendor/core/handler/router.go:29-38`），业务实现位于闭源企业镜像 — 与本 ZCode 早间审计（`doc/reports/2026-11-07-ZCode逆向审计报告.md` §5.3）结论一致 |
| 处置建议 | 维持现有承接策略即可（社区部署下这些页面必然空态）；若要对齐官方 17 屏，需在企业版环境做垂直切片，每屏接 `/api/plutus/*` 真实契约。**不建议在社区分支伪造交互** |

### P0-02 · SAE — 裁决【A：功能缺失（部分修复）】

| 维度 | 复核结论 |
| --- | --- |
| Grok 论点 | 9 条 SAE 路径，React 仅 3 入口交向导/环境页，6 条 detail/changeOrder 由通用 `:serviceName/*` 承接 |
| 基线核查 | 对 `82ec35eed` 论点准确（当时 router 仅 `envs/sae/create|production/create|config` 三条） |
| **当前 HEAD 变化** | `72715c580` 已新增 `envs/sae/changeOrder`、`envs/sae/changeOrder/:orderId/detail`、`envs/sae/changeOrder/*` 三条路由（`frontend/src/router/index.tsx:129-131`）→ **深链不再落兜底**；但三者的 element 均为通用 `EnvironmentsPage`，且该页面源码 **0 处** changeOrder/SAE 处理逻辑（grep 验证），路径承接为"空壳" |
| 后端证据 | SAE 为**社区版完整能力，非闭源**：`pkg/microservice/aslan/core/environment/handler/router.go:242-245` 已注册 `GET sae/:name/app/:appID/changeOrder`（ListSAEChangeOrder）、`GET .../changeOrder/:orderID`（GetSAEChangeOrder）、`POST .../abort`、`POST .../rollback` |
| 处置建议 | **需补专属 UI**：SAE 应用详情与变更单列表/详情/中止/回滚页面，接上述 4 条后端契约与 `/api/aslan/environment/environments/sae*` 系列（官方 Bundle 证据：`69.6a53d2a5d9790ffe2388.js`、`74.7b70548dd7233dbe7621.js`）；仅注册路由不算完成 |

### P0-03 · 移动端深链 — 裁决【A：真实代码缺陷，未修复】

| 维度 | 复核结论 |
| --- | --- |
| Grok 论点 | 移动端全为 Navigate 回桌面页；281 行 `to=/v1/projects/detail/:projectName/detail` 把参数当字面量 |
| 源码核查 | **当前 HEAD 仍未修复**（行号因新路由漂移至 301）：`frontend/src/router/index.tsx:301` `<Route path="/mobile/projects/detail/:projectName" element={<Navigate to="/v1/projects/detail/:projectName/detail" replace />} />` — react-router v6 的 `<Navigate to>` 为字符串路径，**不会插值**当前匹配的 route params，访问 `/mobile/projects/detail/foo` 将被重定向到字面量 URL `/v1/projects/detail/:projectName/detail`，`:projectName` 成为参数值 → 目标页按名为 `":projectName"` 的项目查询，必然 Not Found |
| 附带确认 | 其余移动深链（任务/测试/环境/服务）落入 `:301` 行旁的 `/mobile/*` → dashboard，上下文丢失，Grok 论点同样成立（`router/index.tsx:296-302`） |
| 处置建议 | 用包装组件修复：`const MobileProjectRedirect = () => { const { projectName } = useParams(); return <Navigate to={\`/v1/projects/detail/\${projectName}/detail\`} replace />; }`；或对每条移动深链补对应移动视图。**这是 11 项中最"便宜"的必修项** |

### P0-04 · 动态插件 — 裁决【B：企业版运行时依赖（含可社区落地子项）】

| 维度 | 复核结论 |
| --- | --- |
| Grok 论点 | 固定说明文字未变成注册/加载/挂载运行时 |
| 源码核查 | 属实：`frontend/src/router/index.tsx:275-283`（基线 254-263，漂移 +20）`plugin/*` 仍渲染静态 div「第三方扩展插件…已启用插件容器与协议代理」 |
| 后端边界 | 完整动态插件运行时（`$pluginManager`、manifest 加载、动态菜单/路由注册）属企业版门户行为；**但开源后端已具备两类插件 API**：① idp 插件管理 CRUD + 文件下载 `/api/system/plugin(/:id/file)`（`pkg/microservice/aslan/core/system/handler/router.go:568-577`），② 工作流插件仓库 CRUD `/api/workflow/plugin(/template|/enterprise)`（`pkg/microservice/aslan/core/workflow/handler/router.go:169-177`） |
| 前端现状 | `system/plugins` 路由已挂 `SystemConfigPage` 且插件列表真实调 `/api/aslan/system/plugin`（`pages/Settings/Config/index.tsx:282-283`）— 与 Grok inventory "系统插件列表仅部分"一致 |
| 处置建议 | 运行时挂载归入企业版边界（B）；社区侧可落地：完善 system/plugins 管理 CRUD 界面 + 插件容器按 `:id/file` 加载 idp 插件资源。列入 P1 补齐，不作为立即修复项 |

### P0-05 · 构建执行回退 — 裁决【A：危险逻辑，未修复，建议最优先处理】

| 维度 | 复核结论 |
| --- | --- |
| Grok 论点 | `find` 后 `|| workflows[0]`，目标找不到仍可能触发第一条工作流 |
| 源码核查 | **逐行属实，行号与当前文件完全一致**：`frontend/src/pages/Projects/Builds.tsx:298-341` `handleConfirmExecute`，`:304-313` `workflows.find(...) || workflows[0]`，`:317` 拉取该工作流 preset，`:321-324` `workflowApi.triggerWorkflow({...preset, params})` **真实发起执行**，`:325-326` 成功提示。匹配谓词为 `j.name === executingBuild?.name || j.spec?.service_name === executingBuild?.targets?.[0]?.service_name` — 当项目内所有工作流都与该构建无关联时，`workflows[0]` 被静默选中并执行（构建分支参数还可能被改写进无关工作流的 repo 参数） |
| 风险评估 | 这是 11 项中唯一具有**真实执行副作用**的逻辑缺陷：用户意图"执行构建 A"可能触发生产工作流 B。`72715c580` 未触及 Builds.tsx |
| 处置建议 | 立即删除 `|| workflows[0]` 回退；`!matchingWorkflow` 时走既有 warning 分支（`:329-334`）阻止执行；进一步建议校验选中工作流中存在构建类 Job（`zadig-build`）再放行 |

---

### P1-01 · 项目向导 — 裁决【B：有意裁剪 + 客观差异】

| 维度 | 复核结论 |
| --- | --- |
| Grok 论点 | Helm/PM 创建跳步；edit/initialize 复用总览页 |
| 源码核查 | 属实：`frontend/src/pages/Projects/Wizard.tsx:302-312` — 非 k8s 项目在基础工程创建后直接 `navigate(/v1/projects/detail/:projectName/detail)`（`:310`），跳过向导后续步骤；且 `:302-303` 有明确注释说明裁剪原因（"后端仅对 K8s 原生支持在此向导步骤生成默认 Deployment YAML 服务与环境"）；`router/index.tsx:95-96` edit/initialize → `ProjectOverviewPage` 复用 |
| 对照 | 官方 EE 具备 helm/pm 分步向导（官方路由 `projects/create/:project_name/helm/{info,service,runtime,delivery}`、`pm/{info,deploy,config,delivery}`，见官方 Bundle 94 主路由表） |
| 处置建议 | 非 Bug，属功能裁剪决策。若产品要求对齐：按官方四步拆分 helm/pm 向导并接对应创建契约；建议保留当前注释风格，先补 Helm/PM 服务配置抽屉的完整度 |

### P1-02 · 模板 — 裁决【A：功能缺口（后端就绪，前端只读）】

| 维度 | 复核结论 |
| --- | --- |
| Grok 论点 | YAML/Dockerfile 已有较完整 CRUD；其他类提示到功能模块创建 |
| 源码核查 | 属实：`frontend/src/pages/Templates/index.tsx:65-73` `openCreateTemplate` 仅 yaml/dockerfile 打开编辑器，其余 tab 弹 `message.info('该类模板由对应功能模块内创建…')`（`:68`）；`api/template.ts` chart/build/scanning/release_plan 仅 GET（`:111-154`） |
| 后端证据 | **开源后端模板中心写能力完整**：`pkg/microservice/aslan/core/templatestore/handler/router.go` — chart `POST/PUT/:name/DELETE/:name`（:44-49）、build `POST/PUT/:id/DELETE/:id`（:81-86）、scanning `POST/PUT/:id/DELETE/:id`（:102-106）、yaml/dockerfile 全套 |
| 处置建议 | 模板中心补 chart/build/scanning/workflow 模板的新建/编辑/删除表单（可复用现有 yaml/dockerfile 编辑抽屉骨架）；列表 API 已接好，增量成本低 |

### P1-03 · License — 裁决【A：状态未由真实数据驱动】

| 维度 | 复核结论 |
| --- | --- |
| Grok 论点 | 固定激活成功、固定 Active、固定版本展示、更新仅提示联系商务 |
| 源码核查 | 论点属实，**行号有约 20 行漂移**（Grok 引 185-194/211/216/245-250，实为）：`frontend/src/pages/Enterprise/index.tsx:212-219` 无条件渲染 `<Alert title="当前环境已成功激活企业级功能授权" type="success">`；`:236` 固定 `<Tag color="success">有效授权 (Active)</Tag>`；`:241` 固定 `Zadig Enterprise Edition v5.0.0`；`:272` 更新按钮仅 `message.info('请联系 KodeRover 官方商务…')` |
| 关键矛盾 | 页面**确实真实拉取** license：`useEffect` 调 `enterpriseApi.getLicense()` → `GET /api/plutus-enterprise/license`（`api/enterprise.ts:35-37`，后端 `plutus_enterprise/core/handler/router.go:32` 存在），`license.company/user_limit/cluster_limit` 已被消费（`:231,246,251`）；且 TS 类型已建模 `status`/`expire_time` 字段（`api/enterprise.ts:3-11`）— **唯独激活状态/版本/过期未消费真实字段**。社区部署下该接口失败时 `license` 为 `{}`，页面仍显示"已成功激活" |
| 处置建议 | 以 `license.status === 'Active'`（及 `expire_time` 未过期）驱动 Alert/Tag 的类型与文案；无授权/过期/请求失败显示失效态与引导；版本显示改读 `license.license_type` 或接口返回字段 |

### P1-04 · 退出登录 — 裁决【A：服务端会话未注销】

| 维度 | 复核结论 |
| --- | --- |
| Grok 论点 | BasicLayout 直接调 Zustand logout 清本地；authApi.logout 存在但未证明退出流程实际发送请求 |
| 源码核查 | **完全证实**：`frontend/src/layouts/BasicLayout.tsx:72` `const { userInfo, logout } = useAuthStore()` → `:190-201` `handleLogout` 的 `onOk` 仅执行 `logout()`（store 动作）+ `navigate('/signin')`；`stores/auth.ts:105-112` `logout: () => set({ token: null, ... })` 纯本地清态；而 `api/auth.ts:79-80` `authApi.logout` 确实封装了 `await http.get('/api/v1/logout')`，但全 UI **零调用方**（仅 `api/client.ts:75` 的 401 拦截器调 `useAuthStore.getState().logout()`，同样不触服务端） |
| 后端证据 | 服务端注销端点存在且有效：`pkg/microservice/user/core/handler/router.go:93` `general.GET("/logout", login.LocalLogout)`（挂载 `/api/v1`） |
| 处置建议 | `handleLogout.onOk` 改为：`try { await authApi.logout(); } finally { logout(); navigate('/signin'); }` — 服务端失败也应继续本地清理（容忍网络异常），对齐 EE 行为 |

### P1-05 · 请求错误静默转空 — 裁决【A：模式性缺陷】

| 维度 | 复核结论 |
| --- | --- |
| Grok 论点 | 失败被转成空列表，混淆真实空态与故障 |
| 源码核查 | 属实且为**全文件模式**：`frontend/src/api/template.ts:71-154` 七个列表方法（workflow/yaml/dockerfile/charts/build/scanning/release_plan）全部 `catch { return 空对象/空数组 }`（`:79-81,91-93,103-105,115-117,127-129,139-141,151-153`）；Plutus 页 `pages/Plutus/index.tsx:27-28` `catch { setProducts([]) }` |
| 处置建议 | 引入统一错误通道：至少 `console.error` + 页面级 `error` 状态 + 重试按钮；建议在 `api/client.ts` 拦截器层提供 `skipErrorHandler` 之外的"静默但可观测"约定（当前 `skipErrorHandler: true` 与 catch-空 的组合使故障完全不可见）。存量改造可先覆盖 template/Plutus/dashboard 三处高频列表 |

### P1-06 · 系统集成 — 裁决【C：表述与事实不符，降级为验证项】

| 维度 | 复核结论 |
| --- | --- |
| Grok 论点 | "只有 integration/:category 泛化路径"，厂商字段/测试连接/凭证联动需逐类验证 |
| 源码核查 | **前半句不成立**：`frontend/src/pages/Settings/Integration/index.tsx:73-184` 为 12 个类别逐一配置了**真实专属** `apiEndpoint`（account→`/api/v1/connectors`、git→`/api/v1/codehosts`、project→`/api/aslan/system/project_management`、im→`/api/aslan/system/im_app`、ai→`/api/aslan/system/llm/integration`、ci→`/api/aslan/system/cicdTools`、scanner→`/api/aslan/system/sonar/integration`、config→`/api/aslan/system/configuration`、gateway→`/api/aslan/system/api_gateways`、monitor→`/api/aslan/system/observability`、cloudService→`/api/aslan/system/cloud_service`、external→`/api/aslan/system/external`）— 12 条端点全部在开源后端真实注册（与本 ZCode 早间审计三方比对吻合）；页面并含厂商专属表单逻辑（如 Jira 字段映射 `:253-264,335-346`、Jenkins 连接测试 `:306`） |
| 残余风险 | "逐字段一致性需验收"作为方法论保留意见成立；且 im 类别下 lark/dingtalk/workwx/dms 独立管理路由（官方 Bundle 调用）前端未单独接入（早间审计 P1-A3），属 P2 |
| 处置建议 | 不作为缺陷修复；将"12 类逐字段验收"并入四道验收门禁的交互门禁清单 |

---

## 3. 与 ZCode 早间逆向审计的交叉印证

| 交叉点 | 结论 |
| --- | --- |
| Grok P0-02（SAE）⇄ ZCode 审计 P1-R3 | 同源发现，互相印证；ZCode 报告给出后端 4 条变更单契约的精确行号，可直接作为修复输入 |
| Grok P1-05（错误静默）⇄ ZCode 审计 P0-1/P0-2 修复模式 | `72715c580` 对 Dashboard 的修复改接了 `stat/v2/quality/*`，新代码保留了 `skipErrorHandler` 模式 — 建议本轮一并纳入 P1-05 的统一错误通道改造 |
| `72715c580` 已修复项 | workflows/tests 深链别名（router:110-118,147-153）、`insight/board`（:230）、SAE changeOrder 路由壳（:129-131）、Dashboard 两条 P0 坏调用 — 均为 ZCode 审计所列，Grok 报告基线（82ec35eed）中尚不存在 |
| 分母差异说明 | Grok inventory `apis=762`（含重复 observation 归并前计数）vs ZCode 审计 `441` 唯一 URL 模板 — 统计口径不同（observation vs unique template），不构成矛盾 |

---

## 4. 建议修复顺序（供主控排期）

1. **P0-05 构建回退**（Builds.tsx 删 `|| workflows[0]`）— 唯一有真实执行副作用的缺陷，改动 1 行 + 分支判断。
2. **P0-03 移动端参数**（router:301 useParams 包装）— 改动约 6 行。
3. **P1-04 服务端登出**（BasicLayout + authApi.logout）— 改动约 5 行。
4. **P1-03 License 状态驱动**（Enterprise 4 处渲染改读 `license.status/expire_time/license_type`）— 改动约 15 行。
5. **P1-05 错误通道**（template.ts + Plutus，模式性改造可分批）。
6. **P0-02 SAE 变更单 UI**（新页面 + 4 条后端契约，属功能开发）。
7. **P1-02 模板中心写能力**（复用编辑抽屉，chart/build/scanning 三类）。
8. **P0-04 插件**（社区侧先做 system/plugins 完整管理页；运行时挂载留企业版边界）。

> 本复核所有结论均基于当前 HEAD `72715c580` 源码逐行取证；请主控 Antigravity 确认裁决分类与修复排期后执行代码修复。
