# Zadig EE 前端 1:1 对齐审计 · REA Evidence

> 导出自 Canvas：[Zadig EE 前端 1:1 对齐审计 · REA Evidence](https://cursor.com/canvas/store-2b796794-5cf3-4997-8835-58fa5175acb5/9393de51-68f3-4024-8196-7b20b58ee108)  
> 审计日期：2026-11-06（CST，UTC+8）  
> 仓库：`/workspace/zadig-my` · HEAD `82ec35eed` · 分支 `feat/zadig-portal-next`  
> 对照：`zadig-ee-portal/`（官方镜像静态真理源）· 后端 `http://192.168.31.174:8380`  
> **结论：部分对齐。** 本文件是证据下限，**不宣称完整 1:1**。未改应用源码。

---

## 目录

1. [结论与本轮新增证据](#1-结论与本轮新增证据)
2. [全量清单入口（补完）](#2-全量清单入口补完)
3. [路由覆盖：路径命中并非完成率](#3-路由覆盖路径命中并非完成率)
4. [优先缺口 P0](#4-优先缺口-p0)
5. [优先缺口 P1](#5-优先缺口-p1)
6. [接口覆盖与比较边界](#6-接口覆盖与比较边界)
7. [已有主体与验收门槛](#7-已有主体与验收门槛)
8. [Evidence 索引与置信度](#8-evidence-索引与置信度)
9. [按清单验证时怎么用](#9-按清单验证时怎么用)

---

## 1. 结论与本轮新增证据

> **仍是部分对齐；更扎实的是证据，不是本次观察到功能增加。**  
> 用 REA 复看 EE 与 React 后，Plutus、SAE、移动深链、插件、构建回退五个 P0 仍在。静态路径与源码事实能确认差异，但不能据此宣布域级全对齐，亦不能推出全站完成率。

| 指标 | 值 | 说明 |
|---|---:|---|
| EE REA 路由候选 | 207 | 1,483 次出现 · 112 个来源；路由总集仍未知 |
| 上轮屏幕路径获得 REA 定位 | 187 / 187 | 参数名归一匹配；**不是** 187 个已复刻页面 |
| 同模式 React 路由 | 109 / 187 | 仅 URL shape；78 个通配/重定向或别处 |
| 五个 P0 缺口 | 5 | 均有 REA ID 与已分析源码定位 |

| 项 | 值 |
|---|---|
| EE parent | `ev_ca5e6e88…ecbce61f92` |
| React parent | `ev_7712106e…4553615aaa6e` |
| EE source parsing | 112 JS · 0 parse failures · 4,678,787 AST nodes |
| React source parsing | 129 JS · 0 parse failures · 282,709 AST nodes |

**本轮新确认：**

- **可回看的路由基准**：17 条 Plutus、9 条 SAE、11 条移动屏幕，都能对上带源区间的 REA route id。
- **React 真实目的地**：辅助 JSX AST 投影 167 个 Route 声明、166 个不同路径；标出通配接盘、共享组件和桌面 Navigate。
- **请求是候选对齐**：EE 主 chunk 与 React 均有具体 request observation；匹配只能推进候选合流，不是 payload / 视觉 / 行为一致。

两边 `analyze-javascript-application` 均为 `detail=summary`，完整父记录保存在 Evidence bundle。

---

## 2. 全量清单入口（补完）

清单是证据可追溯的下限，**不是**视觉、交互或请求契约的完整覆盖率。

原落盘路径（审计当时）：

| 文件 | 路径 |
|---|---|
| 路由明细 | `/workspace/rea-audit/inventory/routes.json` · `routes.csv` |
| 组件明细 | `/workspace/rea-audit/inventory/components.json` · `components.csv` |
| 请求明细 | `/workspace/rea-audit/inventory/apis.json` · `apis.csv` |
| 计数与证据边界 | `/workspace/rea-audit/inventory/summary.json` |
| 补充请求源投影 | `/workspace/rea-audit/inventory/react-source-http-calls.json` |

> **注意（导出时）：** 当前 box 工作区已清空，上述 `inventory/` 机器可读文件**暂不在磁盘上**。下方计数来自 Canvas 定稿；若要逐行核对 CSV/JSON，需重新生成清单或从备份恢复。

### 2.1 状态汇总

| 清单 | 行数 / 分母 | 已有 | 部分 | 缺失 | 未知 |
|---|---:|---:|---:|---:|---:|
| EE 路由候选（主计数） | 207 | 6 | 156 | 37 | 8 |
| React 补充 JSX 路径（另列） | 30 | 0 | 0 | 0 | 30 |
| 路由 JSON 全行（207 + 30） | 237 | 6 | 156 | 37 | 38 |
| React 组件文件（实现状态） | 94 | 81 | 13 | 0 | 0 |
| API 候选（method + path） | 725 | 0 | 373 | 40 | 312 |

### 2.2 状态规则（验证时务必遵守）

| 状态 | 含义 |
|---|---|
| **已有** | 对应位置存在非空实现证据；**未宣称完整 1:1** |
| **部分** | 已知不完整，或仅有路径 / 请求候选，未做步骤验收 |
| **缺失** | 已恢复的 EE 能力对应到未实现、无关目的地或已知占位 |
| **未知** | EE 语义、组件、动态 URL 或保留证据不足；**未知绝不代替缺失** |

补充说明：

- API 没有「已有」≠ 全部无用，而是没有足够证明**完整请求契约**一致的条目。
- 40 条 API「缺失」只来自专属 Plutus / SAE 页面的保守静态检查。
- 组件表里「已有」多半表示 React 源码实现存在，不等于交互/契约已对齐。
- EE 模块级映射 94 项在组件清单中均标为**未知**（计数描述的是 React 文件实现状态）。

### 2.3 P0 在清单中的落地（验证入口）

| 域 | 清单落点 |
|---|---|
| Plutus | 20 条 EE 候选 = 部分 1、缺失 18、未知 1 |
| SAE | 部分 3、缺失 6 |
| 移动端 | 12 条相关路由全部缺失 |
| 插件 | 运行时缺失；系统插件列表仅部分 |
| 构建 | 相关路由均部分，保留 `workflows[0]` 风险 |

### 2.4 各清单内容范围

- **路由**：207 条 EE 保留路由一条不漏；列 `ee_path`、`react_path(s)`、状态、注释、证据 reference。另列 30 条 EE 保留集未恢复的 React JSX 声明（均为未知）。JSON 内保留全部 167 条 JSX 原始声明。
- **组件**：94 个 React TSX（28 page / 51 feature / 13 shared / 2 layout）；保留路径、业务域、路由/import 关系与已知 P0/P1 注释。
- **接口**：旧扫描 1,097 个 EE 调用归一成 725 个 method+path；REA 保留视窗覆盖 200 个调用 / 196 形状。请求匹配**不证明** query/body/header/response、错误和权限等价。
- 复核额外枚举了 React 中 544 个直接 http 调用（辅助缩小漏配，**不是**运行时抓包）。

---

## 3. 路由覆盖：路径命中并非完成率

| 业务域 | EE REA 基准 | React 实际目的地 | 判定 |
|---|---|---|---|
| Plutus | 17 个目标屏幕；20 个相关 REA 路径 | 1 个同形入口；其余单一页面 | P0 |
| SAE | 9 个 REA 路径 | 3 个入口共用普通页面，6 个走通用详情 | P0 |
| 移动端 | 12 个相关 REA 路径，含 11 个目标屏幕 | 全部为桌面 Navigate；上下文丢失 | P0 |
| 插件 | 2 个相关 REA 路径 | 静态容器文案，未见注册挂载 | P0 |
| 构建 | build/targets 等待恢复全契约 | 目标找不到仍可能执行 `workflows[0]` | P0 |
| 普通环境 | 环境、资源、Pod、日志等 | 真实抽屉、日志、终端等已见 | 需逐交互 |
| 工作流 | job、审批、执行、调试、流式 | 已有广泛真实实现；按类型验收 | 需逐流程 |
| 项目 / 模板 | 分步项目、不同模板写操作 | 有真实页面，但跳步和只读差异 | P1 |
| 授权 / 退出 | 真实授权和服务端退出 | Active 固定；退出只清本地 | P1 |
| 系统设置 | 大量厂商配置、RBAC、公告 | 页面铺开，等价仍需逐字段 | 待验证 |

**不要误读的数字：**

- 207 是 EE 的嵌套路由、导航、常量等恢复**候选**；React REA 51 个候选以导航/字符串为主。两边发现机制不同，**不能拿 51/207 当覆盖率**。
- 187/187 表示上一轮目标屏幕都拿到了 REA 位置；109/187 表示 React 同模式路径——**仍不证明**页面、表单、权限或接口相同。
- REA：`application_routes=unknown`、`candidate_enumeration=partial`；即使 207 页走完，也不能说整个 EE 路由全发现。
- 明确「缺失」只对能直接看到源码的目的地作判断；未恢复的异步块、受限制语义和未显式恢复请求均保留 **unknown**。

---

## 4. 优先缺口 P0

### P0-01 · Plutus 客户交付

- **标题：** 17 条目标屏幕路径都有 REA 基准，16 条仍被一个 Plutus 单表通配承接
- **证据：** REA 路由 `dff6c34dd1e276ee`、`f11215f39ec8d03562`、`b270748441732b11`、`edc35f248e80bc7f` 等指向项目、客户、控制台。React 只有入口同形，其余落单页；Plutus Evidence `ev_8d6cbecc…` 保留 `GET /api/plutus/products`、`setProducts([])`、`setActiveTab(k)`，源码 93–98 行新建按钮无 `onClick`，四 Tab 共用同一表。EE 仍待恢复的接口不能按 REA 未检出就断言缺失。
- **验收：** 逐深度路由恢复客户、项目、环境、控制台、版本/回滚、配置和看板；请求、按钮、异常和状态真实闭环，而不是只切 Tab。

### P0-02 · SAE

- **标题：** 专属应用与变更单屏幕没有接到 SAE 工作流
- **证据：** REA 独立得到 9 条路径：详情 `25574661652a33e3`、变更单 `d76d9aac74268237`、订单 `8bb009e072ea6c35`、生产 `c0307b7748ef0070` / `18ee5b5db22aa16d`。React `router/index.tsx:117–119` 只把三个入口交给 `EnvironmentWizardPage` / `EnvironmentsPage`；六个 detail/changeOrder 由普通 `:serviceName/*` 承接。REA 主 chunk 当前保留表未覆盖 SAE 请求，未检出不等于不存在。
- **验收：** 恢复地域/命名空间、SAE 应用、普通与生产变更单及详情、状态和各自请求；逐屏验证，复用普通环境向导不算完成。

### P0-03 · 移动端 / 深链

- **标题：** 上下文仍被回桌面页，项目名落为字面量
- **证据：** REA 工作流 `9514688d05fb2b72`、测试 `5415a6c2e97e9705` / `8d8ebf9f742380f5`、环境 `35a9bafcece56b45`、k8s `fc4eed653b2cd2ee`、helm `7deffbe57495d378`、pm `54bbea1e8b042cd1`。React `router/index.tsx:277–282` 全为 `Navigate`，281 行 `to=/v1/projects/detail/:projectName/detail`，其他任务/测试/服务深链回 dashboard。
- **验收：** 项目、任务、测试、环境、服务参数在刷新、分享和前进后退中保留，呈现对应移动页面，而不是仅保证在桌面打开。

### P0-04 · 动态插件

- **标题：** 固定说明文字没有变成注册、加载和挂载运行时
- **证据：** REA 路由 `0e37a8898622d72c` → `/v1/plugin/:pluginRoute*`，`b86762822635b266` → `/v1/system/plugins`。React `router/index.tsx:254–263` 只显示「已启用插件容器与协议代理」。上轮 EE 静态文本看到 `$pluginManager`、manifest、sidebar 等，本轮未把它升级为运行时已证实。
- **验收：** 加载 manifest、动态注册菜单/路由、挂载项目页、处理权限和加载失败；用可获得的真实插件场景验证。

### P0-05 · 构建执行

- **标题：** 目标找不到仍可能触发第一条工作流
- **证据：** React `Builds.tsx:298–340`：304–313 行 `find` 后 `|| workflows[0]`，321–324 行 `triggerWorkflow`。REA `ev_e2ef180ab37b3f…` 保存相邻 302 行 `validateFields` 等源位置；危险回退由已分析源码定点复核。EE 指定 build/targets 请求位于主 chunk 838917，前轮静态扫描已恢复；REA 当前请求保留窗口未覆盖该段。
- **验收：** 立即去除任意第一条回退，目标不唯一时阻止执行；对齐专属目标请求、preset、日志和失败状态后再做真实执行测试。

---

## 5. 优先缺口 P1

### P1-01 · 项目向导

- **标题：** Helm / PM 创建跳步，初始化与编辑复用总览页
- **证据：** `Projects/Wizard.tsx:302–312` 非 k8s 项目创建后直接跳详情；`router/index.tsx:95–96` 让 edit / initialize 都指向 `ProjectOverviewPage`。
- **验收：** 逐类恢复创建步骤、表单校验和请求；编辑、初始化、总览分开验收。

### P1-02 · 模板

- **标题：** 多类模板的写能力只读或跳转其他域
- **证据：** `api/template.ts` 的 YAML、Dockerfile 已有较完整 CRUD；`Templates/index.tsx:65–69` 对其他类提示到功能模块创建。
- **验收：** 每类模板按对应写请求恢复新增、编辑、删除和校验，不能用别处可以创建代替本域功能。

### P1-03 · License

- **标题：** 固定 Active 与版本展示不是可靠授权状态
- **证据：** `Enterprise/index.tsx:185–194` 固定激活成功，211 行固定 Active，216 行固定版本；245–250 行更新只提示联系商务。
- **验收：** 从真实响应驱动状态、版本、额度和更新；无授权、失败和过期绝不显示 Active。

### P1-04 · 退出登录

- **标题：** 清本地状态不等于 EE 的服务端退出
- **证据：** `BasicLayout.tsx:190–200` 直接调用 Zustand logout；`stores/auth.ts:105–112` 清本地状态。前轮看到 EE `GET /api/v1/logout`；本轮 React 仅确认 `authApi.logout` 存在，未证明实际退出流程发送该请求。
- **验收：** 按 EE 行为处理服务端会话、失败，再清 token、用户状态和敏感缓存。

### P1-05 · 请求错误

- **标题：** 失败被转成空列表，混淆真实空态与故障
- **证据：** REA Plutus 观察 → `setProducts([])`，源码 catch 清空；`api/template.ts:71–154` 多类列表也返回空。
- **验收：** 区分成功空列表、网络、权限和业务失败，显示对应重试/错误路径。

### P1-06 · 系统集成

- **标题：** 通用分类表单不能证明每个厂商配置一致
- **证据：** React 只有 `integration/:category` 泛化路径及回 integration；厂商字段、测试连接、凭证联动和深层 URL 需逐类验证。
- **验收：** 按厂商恢复字段与专用契约，保留深链上下文，不能因一个 category 能渲染就说全部对齐。

---

## 6. 接口覆盖与比较边界

本轮不再把上轮的「Plutus 1 / 43 API」当作全量 REA 结论。它是上轮静态扫描的形状对照；REA 的 request extractor 未原生覆盖所有 Axios 间接别名，且主 bundle 静态表受结果预算约束。

| 观察面 | 本轮可回溯事实 | 允许得出的结论 |
|---|---|---|
| EE 主 chunk | `ev_7c6fe00f…`：448 endpoint observations，其中 200 个以 `/api/` 开始；SAE / build/targets 不在这个保留窗口 | 支持已保留观察；未覆盖部分为 unknown，不能说 EE 没请求 |
| React | 203 个网络候选保留源位置，其中 117 exact / observed，86 low / inferred | 可核查 http/fetch/WS；仍受声明式 extraction 限制 |
| Plutus | React 页面直接核得 `GET /api/plutus/products`；EE 静态表中另有 customer / version / operation 等 | 当前单页不是专属流程；上轮 45 调用 / 43 method+path 是待逐条复核的静态清单 |
| 候选接口 | `rea-api-parity.json`：EE 保留请求与 React method+normalized path 的候选合流 | 候选匹配 ≠ 同源执行、query/body/header/response 或错误契约相同 |
| REA compare | `ev_6e77ee50…`：129 项全部 unknown；0 candidate evaluations | 文件源 ↔ 打包比较并非功能对齐器，不能解读为 0% 实现 |

旧 1,097 调用表达式 / 725 归一形状和 React 323/725 普通静态扫描指标，留在旧报告底稿中，**不作为本轮 REA 的全量分母或完成率**。

---

## 7. 已有主体与验收门槛

| 项 | 说明 | 状态 |
|---|---|---|
| 保留而非推倒：认证、工作流、K8s / Helm 环境 | 登录 RSA/AES、鉴权与 MFA；工作流执行/审批/调试/日志；真实环境抽屉、Pod 日志、终端都已有实现。单个具体功能仍要按契约验收。 | 已有主体 |
| 1 · 先封住错误执行 | 取消 `workflows[0]` 任意回退，修正移动参数；再消除固定 Active 和静默失败。 | 优先 |
| 2 · 做 P0 的完整垂直切片 | Plutus / SAE / 移动 / 插件分别做深链、屏幕、请求与错误状态。 | 随后闭环 |
| 3 · 建立同环境运行基线 | 同后端、同账号、同数据、同视口做网络抓包、交互录制与截图 Diff。 | 未执行 |

**四道验收门禁：**

1. **路由门禁：** EE 路径 → React 目的地 → 上下文参数；命中通配符并不能验收。
2. **请求门禁：** method、query、body、header、响应映射、失败/重试、轮询 / SSE / WS 分别验证。
3. **交互门禁：** 按钮、表单、弹窗、校验、权限、加载/空/错状态、刷新与返回栈。
4. **视觉门禁：** 截图逐屏比较；未经浏览器运行测试，无任一域声明全对齐。

---

## 8. Evidence 索引与置信度

| 证据 | 保留记录 / 本地视图 | 范围 |
|---|---|---|
| EE parent | `ev_ca5e6e88a2c2de9b71c1574059a54797ec1e64ea1e698604120688ecbce61f92` | `/workspace/rea-audit/ee-portal.evidence` |
| EE routes · 200 + 7 | `ev_de4900e614df68…`；`ev_31c7b9332cca6f…` | `ee-routes-page0.json`；`ee-routes-page1.json` |
| EE request facts | `ev_bcc6d3ab5ec1b2…`；`ev_7c6fe00f1c3630…` | `ee-main-chunk-facts-discovery.json`；`ee-main-static.json` |
| React parent / routes | `ev_7712106ee3848f…`；`ev_74973c542d6639…` | `frontend.evidence`；`frontend-routes.json` |
| React P0 facts | Plutus `ev_8d6cbecc864eba…`；Build `ev_e2ef180ab37b3f…` | `react-plutus-static.json`；`react-build-static.json` |
| Compare / source graph | `ev_6e77ee50606436…` | `source-to-ee-bundle.json`；仅文件源比对 |

派生索引（审计当时均在 `/workspace/rea-audit`）：  
`rea-route-parity-evidence-linked.json`、`rea-ee-routes-with-sources.json`、`rea-route-and-react-destination-map.json`、`rea-api-parity.json`、`rea-react-http-observations.json`、`rea-api-coverage-boundaries.json`，以及 `inventory/` 下 routes/components/apis/summary。

| 覆盖面 | 值 |
|---|---|
| EE coverage | 115 files 相关；112 parsed；application partial；47,130 semantic unknowns |
| React coverage | 134 files 相关；129 parsed；application partial；35,984 semantic unknowns |
| 源码洁净（审计当时） | `git status --short` 无输出；本轮只写 scratch 与报告 |
| 遗漏风险 | 压缩路径、动态 URL、懒加载、语义预算和 Axios 代理识别均保留未知 |

**置信度：**

- **高：** 具体源位置的 Route、按钮、状态设置、字面量和可保留请求；静态事实 ≠ 浏览器会实际执行。
- **中：** 参数名归一的 EE → React 目的地、共享页面和多态接口的缺口。
- **仍未知：** 精确视觉、动态权限、实际 query/body/header/response、插件执行、后端请求、SSE 边界。

---

## 9. 按清单验证时怎么用

建议核对顺序：

1. 用本文 **§2 状态汇总表** 对一下分母与四态计数（已有/部分/缺失/未知）。
2. 用 **§4 / §5** 的 P0/P1 验收句，在 `frontend/` 与 EE 门户上逐条点验。
3. 有 `inventory/*.csv` 时：按状态列筛选「缺失」「部分」，对照 `ee_path` / React 路径；组件表先看实现是否存在，再谈交互。
4. API 表：把「部分」当候选合流，**不要**把「已有=0」读成「接口全没」；「未知」保持未知，不要改判缺失。
5. 任何「全对齐」结论必须过完 §7 四道门禁，且最好有同环境 HAR / 截图 Diff。

---

*Markdown 导出时间：2026-11-07（CST）。内容以 Canvas 定稿为准；机器可读 inventory 若需逐行核对，请告知以便重新生成。*

---

## 附录 · inventory 重生成说明（2026-11-07）

工作区 wipe 后已按**静态证据**重生成 `/workspace/rea-audit/inventory/`（routes/components/apis 的 json+csv、`summary.json`）。不宣称原 REA observation ID；分母与四态计数相对 Canvas 定稿可能有小幅偏差，以 `inventory/summary.json` 的 `deltas_vs_prior` 为准。打包文件：`zadig-ee-frontend-audit-inventory.zip`。
