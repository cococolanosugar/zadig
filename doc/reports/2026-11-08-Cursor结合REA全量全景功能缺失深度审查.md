# Cursor 结合 REA 全量全景功能缺失深度审查

| 项 | 内容 |
| --- | --- |
| 审计类型 | REA-backed Full-Surface Gap Audit（12 业务域拉网式对账） |
| 日期 | 2026-11-08 |
| 执行 | Cursor（Auditor Agent） |
| 规范 | `scratch_cursor_rea_full_audit_spec.txt` |
| 分支 | `feat/zadig-portal-next` |
| 真理源 | `doc/review/rea_evidence_bundle.json`（≈255MB）+ `doc/review/rea_extracted_endpoints.json`（812） |
| 对照基线 | `doc/reports/2026-11-08-Cursor结合REA端到端核心路径再审查.md` |
| 约束 | **只读审计**；未改业务代码；未执行 git commit / push |

---

## 0. 方法论与证据口径

### 0.1 REA 812 条目如何落地为可对账集合

REA 清单 812 条并非 812 个独立后端 HTTP 契约，混有：

| 类别 | 约略规模 | 处理 |
| --- | --- | --- |
| 真实 `/api/*` HTTP 调用（GET/POST/PUT/DELETE） | **去重后 154** | 主对账集合 |
| `property:path` / 前端路由 | ~211+ | 路由对齐参考，不计入 API 覆盖率分母 |
| 图表/运行时 `model.get` 等噪声 | 其余 | 排除 |

本报告以 **154 个唯一 `METHOD + /api/...` 端点** 为契约母集，再按 12 域分类，并用人肉核对 UI 是否真正消费（避免「API 文件有字符串、页面未调用」的假阳性）。

### 0.2 三类裁决（规范强制）

| 类 | 含义 |
| --- | --- |
| **A** | 后端 Handler 真实存在 + REA 官方产物有调用，但前端缺失 / 参数错误 / 静默吞错 |
| **B** | 企业闭源或产品分流（`plutus/*` 等），已合规降级，**不算缺陷** |
| **C** | 逻辑闭环，仅体验/对齐差异（含 API 版本演进替代） |

### 0.3 总覆盖快照

| 集合 | 端点数 | 前端命中 | 覆盖率 |
| --- | --- | --- | --- |
| 全量 `/api` 去重 | 154 | 131 | **85.1%** |
| 剔除企业闭源后 | 144 | 130 | **90.3%** |
| 非企业写操作缺失 | — | **10 真缺口 + 1 版本演进** | 见 §3 |
| 企业 `plutus*` | 10 | 1（license 探活） | B 类 |

**总判**：相对端到端再审查时点，工作流 `available`/`patch`、服务 convert、执行页审批门控与部署环境深链等主链缺口多已闭合。全景拉网后，**残余 A 类集中在系统集成高阶校验写操作、主机密钥批处理、邮件业务配置、应用批量导入、Helm Git Values UI 消费、以及测试列表未走 picket 鉴权代理**。

---

## 1. 十二域全景评分卡

评分综合考虑：REA 端点命中、关键写操作完备度、高阶配置深度、静默吞错与路由死链。

| # | 业务域 | 评分 | REA `/api` 样本命中 | 一句话 |
| --- | ---: | ---: | --- | --- |
| 1 | 项目管理 Projects | **88** | 7/8 | 分组/模板/向导齐；缺 `applications/bulk` |
| 2 | 服务管理 Services | **90** | 2/2（样本薄） | labels/convert/version 回滚齐；主保存已接 convert |
| 3 | 环境管理 Environments | **84** | 2/2（样本薄） | operations/rendersets 主路径齐；**yamlContent 仅 API、UI 未消费** |
| 4 | 构建与扫描 Builds & Scanners | **90** | 8/8 | Dockerfile/registry/扫描 CRUD 齐 |
| 5 | 工作流 V4 Pipelines | **90** | 11/11 | lint/patch/available/sql 已接线 JobConfigDrawer |
| 6 | 任务执行 Execution | **88** | （含于 workflowtask 族） | 取消/重试/克隆/审批/轮询/环境深链齐；组审批仍靠后端 |
| 7 | 测试中心 Testing | **82** | 1/2 | CRUD/取消/报告齐；**未走 `picket/testing`** |
| 8 | 发布计划与交付 Release/Delivery | **90** | 4/4 | 发布计划 + delivery/releases 主链齐 |
| 9 | 效能洞察 Insights | **86** | 8/9 | 质量/AI/dashboard 齐；`testTrend` 用 v2 替代（C） |
| 10 | 模板中心 Templates | **92** | 6/6 | build/yaml/dockerfile/charts/workflow/scanning 齐 |
| 11 | 系统设置与集成 Settings | **72** | 67/77 | **缺口最集中**：多类 `/validate`、privateKey 批处理、邮件 service、安装包删除、注册开关写 |
| 12 | 用户/RBAC/全局 User | **85** | 8/9 | 用户组/角色/MFA/Dashboard 齐；缺 `users/count` |

**全景综合评分：约 86 / 100**

---

## 2. 分域穿透审查

### 2.1 项目管理 (Projects) — 88

**REA 对照**：`/api/aslan/project/products`、`/project/group`、`/templates/info`、`/api/v1/picket/projects`、`/api/aslan/application/*`

**已对齐**
- 列表/向导创建：`product_name` + `product_feature` 完整组装。
- 项目分组 CRUD + preset；模板层级 `templates/info`。
- 数据资产目录：应用单条 CRUD + fields 定义；search 已接。
- Sprints / VarsGroup / RBAC / Collaboration 页面存在且有 API。

**A 类**
| ID | 摘要 | 证据 |
| --- | --- | --- |
| FULL-A-01 | 缺 `POST /api/aslan/application/applications/bulk` | REA 有调用；`Directory` 仅单条 POST；后端应用域支持批量创建 |

**C 类**
- EE 多步路由 `projects/create/:name/k8s/service` 等均落到单一 Wizard（URL 兼容、步骤机未拆）。

### 2.2 服务管理 (Services) — 90

**REA 对照**：`/service/services`、`variable/convert`、`labels`、`version/*`

**已对齐（相对 E2E 再审查有进展）**
- 主 YAML 保存路径已调用 `convertVariableKVAndYaml`（不再仅抽屉/导入）。
- labels CRUD；version 列表/diff/rollback。
- Repo/Template/Kube workloads/PM/Helm 导入抽屉齐全。

**残余**
- **C**：多 container → build `service_module` 仍偏启发式，属建模深度而非端点缺失。

### 2.3 环境管理 (Environments) — 84

**REA 对照**：`/environment/environments`、`/operations`、`rendersets/*`（含 `yamlContent`）

**已对齐**
- K8s/Helm/VM/SAE 创建向导；`production` 分流；operations 审计。
- Renderset：renderchart / default-values / globalVariables / variables。
- Pod 终端、事件、节点、工作负载、Istio/共享环境等高阶抽屉存在。

**A 类**
| ID | 摘要 | 证据 |
| --- | --- | --- |
| FULL-A-02 | `getYamlContent` API 已封装，**HelmRendersetDrawer 零调用** | 注释声称支持「外部 Git YAML 提取」，实现未接 `environmentApi.getYamlContent`；后端 `GetYamlContent` 仍在 |

→ 这是典型「字符串命中 ≠ 功能闭环」案例：自动对账记 HIT，人工裁定 **A**。

### 2.4 构建与代码扫描 (Builds & Scanners) — 90

**REA 对照**：`/build/build`、`/template/build`、`/testing/scanning`

**已对齐**
- Builds：`docker_file` / `build_context` / `registry_id` / `pre_build` / repos。
- Scanners 页 + 系统 Sonar 集成 validate。
- 模板 build CRUD。

**残余**：高阶 cache/密钥挂载 UI 深度弱于 EE（C）。

### 2.5 工作流 V4 (Pipelines) — 90

**REA 对照**：`v4/lint`、`v4/patch`、`dynamicVariable/available`、`sql/validate`、favorite、plugin

**已对齐（E2E 再审查 P1 多已关闭）**
- DAG 保存前 `lintWorkflow`。
- `JobConfigDrawer` 打开时拉 `getAvailableDynamicVariables`；Patch 项可 `getPatchParams`。
- `validateSQL`；Jenkins 参数；fromjob deploy；favorite/plugin 模板。

**C 类**
- `available` 请求体使用「单 Job 预览 workflow」桩对象，复杂跨 Stage 引用完整度可能弱于 EE 传整包 WorkflowV4（需实机验证，暂不升 A）。

### 2.6 任务执行与审批 (Execution) — 88

**REA 对照**：SSE `/api/logs/sse/v4/workflow/*`、`workflowtask` approve/cancel/retry/clone

**已对齐**
- SSE LogViewer；`approveStage` L3 字段。
- 取消 / 重试 / 克隆按钮真实调用。
- 运行中/待审批 3s 轮询。
- **审批人前端门控**（`approvalRestricted` 比对 `user.uid`/`name`）。
- 部署成功提取 `env` 并深链 `/v1/projects/detail/.../envs/{env}`。

**C 类**
- 审批人含 `group` 时前端放开、交后端鉴权（合理降级）。
- 深链到环境后是否强制刷新 Pod 镜像：依赖环境页自身加载，无额外「强制 invalidate」事件（弱 C）。

### 2.7 测试中心 (Testing) — 82

**REA 对照**：`/api/aslan/testing/test`、`/api/v1/picket/testing`、testtask cancel/report

**已对齐**
- Quality 页：测试 CRUD、触发、`DELETE testtask`（CancelTestTaskV3）、restart、artifact、JUnit/HTML 报告。

**A 类**
| ID | 摘要 | 证据 |
| --- | --- | --- |
| FULL-A-03 | 列表走 `GET /api/aslan/testing/test`，**未使用** REA/EE 的 `GET /api/v1/picket/testing` | picket 负责按权限过滤；直连 aslan 可能导致越权可见或与官方行为不一致 |

### 2.8 发布计划与交付 (ReleasePlan & Delivery) — 90

**REA 对照**：`/delivery/releases*`、`/release_plan/*`、`template/release_plan`、hook setting

**已对齐**
- ReleasePlan CRUD/排期/审批相关页；Delivery K8s/Helm 版本、retry、charts、global-variables。
- hook setting / template release_plan 在 REA 样本中可命中前端。

**B**：涉及 plutus 客户交付的版本推送等见 §4。

### 2.9 效能洞察 (Insights) — 86

**REA 对照**：`/stat/quality/*`、`/stat/v2/ai/*`、`dashboard/*`、`stat/v2/config`

**已对齐**
- 构建质量族（average/daily/health/latestTen/tenDuration/trend）均有调用。
- 测试平均/健康 + **v2** `dailyHealthTrend`。
- AI analysis / prompt；dashboard overview/running；外源 `api_config` 类型存在于 `stat.ts`。

**C 类（非 A）**
| ID | 摘要 |
| --- | --- |
| FULL-C-01 | REA 调用 `POST /stat/quality/testTrend`；前端改用 `POST /stat/v2/quality/test/dailyHealthTrend`。后端两路由均在；属版本演进替代，功能未断。 |

### 2.10 模板中心 (Templates) — 92

**REA 对照**：`/template/{build,yaml,dockerfile,charts,workflow,scanning,release_plan}`、`workflow/plugin/template`

**已对齐**：CRUD + yaml extract/validateVariable + dockerfile validation + 引用同步入口。评分最高档之一。

### 2.11 系统设置与集成 (Settings) — 72（缺口主战场）

**REA 对照**：cluster/registry/codehosts/privateKey/im_app/observability/api_gateways/cloud_service/emails/features/install…

**已对齐（部分）**
- 集群 validate/创建；registry validate；codehosts validate；s3/helm/dbinstance validate。
- 集成页对 **项目管理 / 配置中心 / Sonar / Jenkins** 有专用 validate。
- privateKey 单条创建/删除；邮箱 **host** CRUD + validate。
- workflowHook、导航、公告、容量、LLM validate 等。

**A 类写操作 / 高阶配置缺失**

| ID | 端点 | 影响 |
| --- | --- | --- |
| FULL-A-04 | `POST .../im_app/validate` | IM 集成「测试连接」退化成列表 GET 探活，**不验证第三方凭据** |
| FULL-A-05 | `POST .../api_gateways/validate` | 网关连通性未真实校验 |
| FULL-A-06 | `POST .../observability/validate` | 监控系统连通性未真实校验 |
| FULL-A-07 | `POST .../cloud_service/validate` | 云服务（SAE 等）连通性未真实校验 |
| FULL-A-08 | `POST .../privateKey/validate` | 主机密钥无法预检 |
| FULL-A-09 | `POST .../privateKey/batch` | 缺少批量导入主机/密钥（EE 有） |
| FULL-A-10 | `GET .../privateKey/labels` | 密钥标签元数据未接 |
| FULL-A-11 | `POST /api/v1/emails/service` | 仅有 SMTP host；**邮件业务身份/发件服务配置**缺失（后端 `EmailService` CRUD 存在） |
| FULL-A-12 | `PUT /api/v1/features/RegisterTrigger` | 登录页只 **GET** 特性；管理端无法开关开放注册 |
| FULL-A-13 | `PUT /api/aslan/system/install/delete` | 安装包/工具链删除写路径未接（列表 GET 有；删除语义与 basicImages 删除不同） |

**说明**：集成页 `handleTestConnection` 对 im/gateway/monitor/cloudService 走 `else` 分支 —— `GET` 列表 URL —— 并提示「接口可达」，与 REA 中独立 `/validate` 写操作不对齐。此为高置信 A。

### 2.12 用户、RBAC 与全局 (User) — 85

**REA 对照**：`/api/v1/users`、`user-group`、`role-templates`、`login/mfa/*`、dashboard、installation

**已对齐**
- 用户/用户组/成员抽屉；系统角色模板；个人中心；MFA enroll/setup/verify；安装向导；RSA 公钥登录信封。

**A 类**
| ID | 摘要 |
| --- | --- |
| FULL-A-14 | `GET /api/v1/users/count` 未使用；用户治理页/仪表盘缺少官方计数契约（可能用 search total 凑合，行为可能不一致） |

---

## 3. 关键写操作缺口总表（非企业）

| # | Method + Path | 域 | 裁决 | 建议 |
| --- | --- | --- | --- | --- |
| 1 | POST `/application/applications/bulk` | Projects | **A** | Directory 增加批量导入 |
| 2 | POST `/system/im_app/validate` | Settings | **A** | Integration 专用 validate 分支 |
| 3 | POST `/system/api_gateways/validate` | Settings | **A** | 同上 |
| 4 | POST `/system/observability/validate` | Settings | **A** | 同上 |
| 5 | POST `/system/cloud_service/validate` | Settings | **A** | 同上 |
| 6 | POST `/system/privateKey/validate` | Settings | **A** | VMs/Key 表单保存前预检 |
| 7 | POST `/system/privateKey/batch` | Settings | **A** | 批量创建主机密钥 |
| 8 | POST `/v1/emails/service` | Settings | **A** | 邮件「业务服务」配置 CRUD |
| 9 | PUT `/v1/features/RegisterTrigger` | Settings | **A** | 系统配置开关开放注册 |
| 10 | PUT `/system/install/delete` | Settings | **A** | 安装包删除对齐 EE |
| 11 | POST `/stat/quality/testTrend` | Insights | **C** | 已用 v2 `dailyHealthTrend` 替代，保留回归即可 |

**UI 消费型 A（API 已有）**

| # | 能力 | 裁决 |
| --- | --- | --- |
| 12 | `rendersets/yamlContent` → Helm 抽屉未调用 | **A**（FULL-A-02） |

**读路径 A**

| # | Path | 裁决 |
| --- | --- | --- |
| 13 | GET `/v1/picket/testing` | **A**（FULL-A-03） |
| 14 | GET `/system/privateKey/labels` | **A**（FULL-A-10） |
| 15 | GET `/v1/users/count` | **A**（FULL-A-14） |

---

## 4. B 类：企业闭源（不计缺陷）

| 端点 | 说明 |
| --- | --- |
| `POST /api/plutus/products` 等客户/版本/renderSet | 社区前端 `Plutus` 页已声明降级 |
| `POST /api/plutus/services/getHelmServices` | 企业 Helm 交付 |
| `POST /api/plutus-enterprise/organization` | 企业组织 |
| `GET /api/plutus/operation` | 企业操作审计 |

---

## 5. 静默吞错与契约卫生

扫描 `frontend/src` 中 `.catch(() => []|null|{})` 显性模式，数量已较少（约 7 处热点），主要：

| 位置 | 模式 | 裁决 |
| --- | --- | --- |
| `Quality/index.tsx` 报告 detail/events/report | `.catch(() => null/[ ])` | **C**/弱 A：报告子资源失败时静默空态，建议至少 `message.warning` |
| `Settings/Config` 并行加载 cleanCache/capacity | `.catch(() => null)` | **C**：可选配置容错合理 |
| `GroupMembersDrawer` | `.catch(() => null)` | **C** |
| `Scanners.tsx` | `.catch(() => {})` | **C**/弱 A：完全吞掉，建议保留 |

未发现大面积 API 层「失败变空数组掩盖 403」系统性问题；工作流 lint/validate 多数使用 `skipErrorHandler` + 显式错误提示，方向正确。

---

## 6. 与端到端再审查的 Delta

| 再审查项 | 全景时点状态 |
| --- | --- |
| `dynamicVariable/available` 未消费 | **已关闭**（JobConfigDrawer） |
| `v4/patch` 未接 | **已关闭**（getPatchParams） |
| 主服务保存无 convert | **已关闭** |
| 审批人前端门控 | **已关闭** |
| 部署成功环境深链 | **已关闭** |
| `rendersets/yamlContent` | **仍开放**（API 有、UI 无）→ FULL-A-02 |
| 系统集成多类 validate / privateKey batch / emails.service | **新暴露为全景主缺口** |

结论：主交付链已从「断点修复期」进入「边缘高阶配置对齐期」；全景分数（≈86）高于纯 E2E 再审查（≈80）反映主链变好，但 Settings 域拖累明显。

---

## 7. 整改优先级建议（只审不改）

### P0 / 高优先级 P1（建议本迭代）
1. Integration：为 im / gateway / monitor / cloudService 补齐专用 `/validate`（FULL-A-04~07）。  
2. HelmRendersetDrawer 消费 `getYamlContent`（FULL-A-02）。  
3. 测试列表改走 `/api/v1/picket/testing`（FULL-A-03）。  
4. 邮件 `emails/service` 配置页（FULL-A-11）。  
5. `features/RegisterTrigger` 管理端写开关（FULL-A-12）。

### P1
6. privateKey `validate` + `batch` + `labels`（FULL-A-08~10）。  
7. `applications/bulk`（FULL-A-01）。  
8. `install/delete`（FULL-A-13）。  
9. `users/count` 用于用户治理统计（FULL-A-14）。

### P2 / 回归
10. 确认 `available` 传整包 Workflow 与 EE 一致性。  
11. Quality 报告子请求失败时的用户可见反馈。  
12. 实机跑通 12 域冒烟矩阵（见下）。

### 建议冒烟矩阵（抽样）

| 域 | 关键写操作 | 期望 |
| --- | --- | --- |
| Projects | 建项 + bulk 应用 | 201；批量成功 |
| Services | 保存 YAML | convert 后变量一致 |
| Envs | Git 拉 Values | yamlContent 填入编辑器 |
| Builds | 保存含 registry_id | 回读一致 |
| Pipelines | 保存含 patch | lint + patch params |
| Execution | 审批非名单用户 | 按钮禁用 |
| Testing | 非管理员列表 | 与 picket 过滤一致 |
| Settings | IM/网关/监控/云 测连 | 走 `/validate` 而非 GET 列表 |
| Settings | 开关 RegisterTrigger | PUT 后登录页注册入口变化 |

---

## 8. 结论

对 REA 812 清单去噪后的 **154** 个唯一 `/api` 契约与 `frontend/src` 拉网对账：非企业覆盖约 **90%**。端到端主链相关契约基本闭合；**全景视角下的真实功能缺失与契约断点主要落在系统集成高阶校验写路径、主机密钥批处理、邮件业务服务、应用批量创建、Helm Git Values UI 消费，以及测试列表鉴权代理未对齐**。企业 `plutus/*` 一律 B 类剔除。

**只读审计声明**：未修改任何业务代码；未执行 `git add` / `commit` / `push`。

---

*报告结束 · 终端标记 `REA_FULL_AUDIT_DONE`*
