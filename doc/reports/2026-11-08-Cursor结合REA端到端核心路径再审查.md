# Cursor 结合 REA 端到端核心交付路径再审查

| 项 | 内容 |
| --- | --- |
| 审计类型 | REA-backed E2E Critical Golden Path 二次穿透审查 |
| 日期 | 2026-11-08 |
| 执行 | Cursor（Auditor Agent） |
| 规范 | `scratch_cursor_rea_e2e_spec.txt` |
| 分支 | `feat/zadig-portal-next` |
| 真理源 | `doc/review/rea_evidence_bundle.json`（≈255MB，官方 `zadig-ee-portal` 静态逆向图谱）+ `doc/review/rea_golden_path_endpoints.json`（49）+ `doc/review/rea_extracted_endpoints.json`（812） |
| 对照基线 | `doc/reports/2026-11-08-Cursor端到端交付主链路全景审查.md`（前次综合约 65/100） |
| 约束 | **只读审计**；未改业务代码；未执行 git commit / push |

---

## 0. 方法与证据使用说明

1. **REA 证据包**：对 255MB bundle 采用头读 + summary 探测（完整 `inspect_analysis_view` 易 OOM）；语义端点以 `rea_golden_path_endpoints.json` / `rea_extracted_endpoints.json` 为准。
2. **对照三角**：`frontend/src` 接线 × REA 黄金端点 × `pkg/microservice/aslan`（及 picket/user）Go handler/model。
3. **误报过滤**：企业闭源 `plutus/*`、规范书过时 approve 示例字段、后端已有但前端未配的能力，分别标注「范围外 / 已纠正 / 前端断点」。

---

## 1. 七大关卡总评与评分（相对前次 E2E）

| 关卡 | 前次 | 本次 | Δ | 闭环判定（一句话） |
| --- | --- | --- | --- | --- |
| Stage 1 · 项目创建与初始化 | 58 | **86** | +28 | `product_name`/`product_feature`、分组与模板已通；建项可选 vars/cluster 仍浅 |
| Stage 2 · 应用/服务定义 | 78 | **82** | +4 | labels + convert 抽屉/导入已接；**主 YAML 保存未强制 convert** |
| Stage 3 · 环境创建与集群绑定 | 80 | **78** | −2 | Wizard `cluster_id`/`namespace`/`production` 齐；**REA `rendersets/yamlContent` 前端 API 缺失** |
| Stage 4 · 打包与编译配置 | 60 | **86** | +26 | `docker_file`/`build_context`/`registry_id` 已入表单与 payload |
| Stage 5 · 工作流编排与触发 | 55 | **78** | +23 | lint + fromjob + `/v1` 深链已修；**`dynamicVariable/available` 未消费、`v4/patch` 未接** |
| Stage 6 · 审批门禁 | 70 | **80** | +10 | 审批持久化 + L3 approve + 3s 轮询已通；**向导默认无审批 Stage；无前端审批人门控** |
| Stage 7 · 发布到目标 K8s | 52 | **74** | +22 | fromjob 镜像贯穿已接通；**部署成功后环境/Pod 无自动回填联动** |

**端到端黄金路径综合评分：约 80 / 100**（前次约 65）

**总判**：前次三大 P0（列表缺 `product_name`、触发跳转缺 `/v1`、deploy 无 fromjob）经 R12 已闭合，**「项目→服务→环境→构建→工作流→触发→执行页」主链已可诚实宣称基本打通**。结合 REA 49 黄金端点二次穿透后，残余风险集中在：**编排期变量/补丁契约不完整、Helm Git Values 拉取断点、默认流水线仍跳过审批、部署终态与环境视图未闭环**。尚不足以宣称与官方 EE 产物「零差异一键黄金交付」，但已从「结构性断点」进入「增强与对齐」阶段。

---

## 2. REA 黄金端点 × 前端接线矩阵（49）

### 2.1 核心 API 类（与七关直接相关）

| REA 端点 | 方法 | 前端现状 | 关卡 | 判定 |
| --- | --- | --- | --- | --- |
| `/api/aslan/project/group` | GET | `projectApi.getProjectGroups` + 列表页分组 | S1 | ✅ |
| `/api/aslan/project/templates/info` | GET | `projectApi` 模板层级 | S1 | ✅ |
| `/api/v1/picket/projects` | GET/POST | 项目列表/创建代理链 | S1 | ✅ |
| `/api/aslan/service/services/variable/convert` | POST | `convertVariableKVAndYaml`；Import/VariablesDrawer 调用 | S2 | ⚠️ 主保存未调用 |
| `/api/aslan/service/labels` | POST | Services 标签 CRUD 已接 | S2 | ✅ |
| `/api/aslan/environment/operations`（含 `production=true`） | GET | `Environments/index.tsx` 直连 | S3 | ✅ |
| `/api/aslan/environment/rendersets/yamlContent` | GET | 仅 Helm 抽屉注释提及；**`api/environment.ts` 无方法** | S3 | ❌ |
| `/api/aslan/system/registry/namespaces` | POST 等 | Builds `getRegistries` + 系统设置 | S4 | ✅ |
| `/api/aslan/template/build` | POST | `templateApi` Build 模板 | S4 | ✅ |
| `/api/aslan/template/workflow` | POST | 模板中心工作流模板 | S5 | ✅ |
| `/api/aslan/workflow/v4/lint` | POST | `lintWorkflow`；Pipelines DAG 保存前调用 | S5 | ✅（向导创建未 lint） |
| `/api/aslan/workflow/v4/patch` | POST | **全仓无引用**；后端为 `GetPatchParams` | S5 | ❌ |
| `/api/aslan/workflow/v4/dynamicVariable/available` | POST | API 已封装；**无 UI 调用方** | S5 | ⚠️ 死接线 |
| `/api/aslan/workflow/v4/sql/validate` | POST | JobConfigDrawer `validateSQL` | S5 | ✅ |
| `/api/aslan/workflow/plugin` (+ `/template`) | GET | workflow API / 插件相关 | S5 | ✅（非黄金主链必需） |
| `/api/aslan/system/workflowHook` | PUT | `systemConfig` + Settings | 旁路 | ✅ |
| `/api/plutus/services/getHelmServices` | POST | 企业闭源；`Plutus` 页显式降级说明 | 范围外 | ⊘ EE only |

### 2.2 路由类（REA `property:path`）

| REA 路由 | 前端现状 | 判定 |
| --- | --- | --- |
| `projects/create/:project_name/k8s/service` 等多步创建 | `router` 已挂同形 path，**一律落到单一 `Projects/Wizard`** | ⚠️ URL 兼容、UX 浅于 EE |
| `projects/detail/:project_name/services` / `workflows/custom/...` | 已有 `/v1/projects/detail/...` 等价深链 | ✅ |
| `plutus/project/create` / `customer/detail/...` | 社区仓库无 plutus 业务实现 | ⊘ EE only |

**API 缺口小结（真缺失，非脚本误报）**：`workflow/v4/patch`、`rendersets/yamlContent`、`dynamicVariable/available`（有 API 无消费）。`environment/operations` / `workflowHook` 已接（早期仅扫 `api/*.ts` 时会假阴性）。

---

## 3. 关卡逐级穿透审查

### Stage 1 · 项目创建与初始化 — 86

**REA 对照**：`project/group`、`templates/info`、`picket/projects`。

**现状（相对前次已修复）**
- `projectApi.createProject`（R12）始终组装 `product_name` + 默认 `product_feature`；列表 Modal 透传 `deploy_type`。
- `Projects/Wizard.tsx`：`product_name`←「项目唯一标识」、`project_name`←「显示名称」，与后端 `Product` 语义一致。
- 分组 CRUD + preset、模板 info 已接线。

**残余缺陷**
- **P2 · REA-S1-1**：建项 payload 仍不暴露 `vars` / `custom_vars` / 初始 `cluster_id`；复杂初始化依赖后续环境向导，非阻塞但弱于 EE 向导一步到位。
- **P2 · REA-S1-2**：EE 多步路由（`k8s/service`、`helm/delivery` 等）仅浅层兼容，步骤状态机未按 REA 路由拆分。

### Stage 2 · 应用与服务定义 — 82

**REA 对照**：`variable/convert`、`service/labels`。

**现状**
- 主路径：`validateServiceYaml` → `POST /service/services?force=true`；默认 YAML 含 containers。
- `ImportFromRepoModal` / `ImportFromTemplateModal` / `ServiceVariablesDrawer` 显式调用 `convertVariableKVAndYaml`。
- 服务 labels GET/POST/DELETE 已接。

**残余缺陷**
- **P1 · REA-S2-1**：`Services/index.tsx` 主保存路径**不**调用 `variable/convert`。手工编辑 YAML 中的变量占位时，KV/YAML 双写可能与后端期望不一致，后续构建 targets / 环境变量渲染偶发漂移。
- **P2 · REA-S2-2**：向导不自动创建 Build 配置；服务→构建仍靠 Builds 页手工绑 `service_module`（module≈服务名启发式）。

### Stage 3 · 环境创建与集群绑定 — 78

**REA 对照**：`environment/operations`、`rendersets/yamlContent`。

**现状**
- `Environments/Wizard.tsx`：K8s/Helm `POST .../environments?type=`，payload 含 `env_name`、`cluster_id`、`namespace`、`services`、`production`；PM 走 `/init/type/vm`。
- 操作审计：`GET /api/aslan/environment/operations?...` 已用。
- Renderset：renderchart / default-values / globalVariables / variables 已接。

**残余缺陷**
- **P1 · REA-S3-1**：REA 高频端点 `GET /api/aslan/environment/rendersets/yamlContent`（后端 `GetYamlContent`，从 codehost/repo 拉 Values）在前端 **无 API 封装、无 UI 入口**。Helm 环境「从 Git 合并外部 Values」相对 EE 断点。
- **P2 · REA-S3-2**：集群连通性仍延后到创建失败时暴露（无独立 validate 按钮，虽 REA 另有 `cluster/clusters/validate`）。

### Stage 4 · 打包与编译配置 — 86

**REA 对照**：`template/build`、`registry/namespaces`。

**现状（相对前次已修复）**
- `Builds.tsx` 表单与保存 payload 含 `docker_file`、`build_context`、`registry_id`；注册表 options 来自 `getRegistries()`。
- `pre_build.res_req` / `image_id` / repos / scripts 保留。

**残余缺陷**
- **P2 · REA-S4-1**：高阶项（私有密钥挂载、精细 cache 目录策略）UI 覆盖仍浅于 EE；不阻断「Dockerfile + 仓库 → 推镜像」主路径。
- **P2 · REA-S4-2**：多 container module 解析仍弱（module 常等于服务名）。

### Stage 5 · 工作流编排与触发 — 78

**REA 对照**：`v4/lint`、`v4/patch`、`dynamicVariable/available`、`sql/validate`；模型 `ZadigDeployJobSpec.{Source,JobName,DeployContents,Env}`。

**现状（相对前次已修复）**
- DAG 保存前 `lintWorkflow`；失败阻断保存。
- `WorkflowTriggerModal` 跳转：`/v1/projects/detail/.../pipelines/custom/.../${taskId}`。
- Wizard 默认 deploy.spec：`source:'fromjob'`, `job_name:'build'`, `deploy_contents:['image']`。
- `JobConfigDrawer` 为 `zadig-deploy` 提供 fromjob/runtime 镜像来源与上游 Job 名；`sql/validate` 已接。
- Trigger 使用 `renderDynamicVariables`（运行时选项渲染）。

**残余缺陷**
- **P1 · REA-S5-1**：`getAvailableDynamicVariables` **零调用**。EE 在 Job 配置期用 `available` 枚举可引用占位符；当前编排器依赖用户手写，复杂流水线易在运行期才爆引用错误（lint 无法完全替代）。
- **P1 · REA-S5-2**：`POST /api/aslan/workflow/v4/patch`（`GetPatchParams`：从 Patch YAML 抽变量成 Param）前端完全缺失。含 K8s YAML Patch 类 Job 时，参数面板无法自动生成，与 REA 产物行为不一致。
- **P2 · REA-S5-3**：向导 `POST /workflow/v4` 创建跳过 lint；非法拓扑可能延后到首次打开 DAG 保存才发现。
- **P2 · REA-S5-4**：`zadig-deploy` 在 `envOptions` 为空时回退硬编码 `dev/qa/staging/prod`，可能把不存在的 env 写入 spec。

### Stage 6 · 审批门禁 — 80

**REA / L3 对照**：审批配置持久化 + `ApproveRequest{workflow_name,job_name,task_id,approve,comment}`。

**现状（相对前次已增强）**
- `JobConfigDrawer`：`native_approval.{timeout,needed_approvers,approve_users[{type,user_id,user_name}]}` 可读回可写回；支持 lark/dingtalk/workwx 类型切换与 fromjob 审批人来源。
- `Execution.handleApprove` 与 L3 对齐；`setInterval(3s)` 在 `running|wait_for_approval|waiting` 自动刷新。

**残余缺陷**
- **P1 · REA-S6-1**：向导默认流水线仍是「构建→部署」**无 approval Stage**。相对规范书与企业黄金路径「构建→审批→发布」，审批门禁为可选手工加装，非默认必经。
- **P1 · REA-S6-2**：执行页**无**「当前用户 ∈ approve_users」前端门控；非审批人仍见同意/驳回，依赖后端 403（体验与误触风险）。
- **P2 · REA-S6-3**：飞书/钉钉/企微节点级 lint（后端 `lintApproval`）前端仅原生路径字段完整，第三方节点编辑深度弱于 EE。

### Stage 7 · 发布到目标 K8s — 74

**REA 对照**：部署日志 SSE、环境服务镜像回填；交付旁路 `delivery/releases`（版本中心，非本关必须）。

**现状（相对前次已修复）**
- fromjob 贯通后，构建产物镜像具备流入 `zadig-deploy` 的配置路径；后端 `SourceFromJob` 可吃到前端输入。
- SSE：`/api/logs/sse/v4/workflow/{wf}/{task}/{job}/1000` → LogViewer。
- ServiceDetail 可查 Pod/镜像；Delivery 中心独立完备。

**残余缺陷**
- **P1 · REA-S7-1**：任务 `passed` 后执行页**不**深链到目标 env/ServiceDetail，也**不**触发环境 Pod/镜像刷新；用户需手工打开环境页确认 K8s 滚动结果——「发布到目标集群」终态可见性断裂。
- **P2 · REA-S7-2**：Helm 路径有 `mergeImage`；纯 K8s + fromjob 对 `services[]` / `DeployServiceInfo` 细结构 UI 仍偏薄，多服务同 Job 场景弱于 EE。
- **P2 · REA-S7-3**：生产环境（`production=true`）与普通环境在 deploy Job 上的 `Production` 字段未在抽屉显式绑定，依赖环境名约定。

---

## 4. 参数贯穿矩阵（二次复核）

| 上游输出 | 下游输入 | 预期字段 | 本次结果 |
| --- | --- | --- | --- |
| 列表/向导建项 | 全局项目 Key | `product_name` + `product_feature` | ✅ 已修复 |
| 服务 YAML | 构建 targets | `service_name` / module | ⚠️ 手工；convert 非主保存 |
| 服务清单 | 环境 `services[][]` | 服务名 + type | ✅ |
| 构建配置 | 镜像仓/Dockerfile | `registry_id` / `docker_file` | ✅ 已修复 |
| 构建产物 | 部署 Job | `source=fromjob` + `job_name` + `deploy_contents` | ✅ 向导+抽屉已修 |
| 部署 Job | 目标环境 | `env` | ✅ 有字段；空列表时假选项风险 |
| 审批 Job | 继续执行 | L3 approve payload | ✅；默认流水线常无此 Job |
| 触发任务 | 执行页 | `/v1/.../taskId` | ✅ 已修复 |
| 部署完成 | Env Pod 镜像 | 自动刷新/深链 | ❌ 仍缺 |
| 编排变量 | Job 占位符 | `dynamicVariable/available` | ❌ API 闲置 |
| Patch YAML | 工作流 Params | `v4/patch` | ❌ 未接 |
| Git Values | Renderset | `rendersets/yamlContent` | ❌ 未接 |

---

## 5. 与前次 E2E 结论的 Delta（缺陷台账）

### 5.1 前次缺陷关闭情况

| 前次 ID | 级别 | 状态 | 证据 |
| --- | --- | --- | --- |
| E2E-P0-1 | P0 | **已关闭** | `createProject` 强制 `product_name` |
| E2E-P0-2 | P0 | **已关闭** | TriggerModal `/v1/.../${taskId}` |
| E2E-P0-3 | P0 | **已关闭** | Wizard + JobConfigDrawer fromjob |
| E2E-P1-1 | P1 | **已关闭** | Builds `docker_file`/`registry_id`/`build_context` |
| E2E-P1-2 | P1 | **已关闭** | zadig-deploy 镜像来源 UI |
| E2E-P1-3 | P1 | **部分关闭** | 轮询 ✅；审批人前端门控仍缺 → 迁入 REA-S6-2 |
| E2E-P1-4 | P1 | **已关闭** | 列表创建走统一 API + 反馈路径 |
| E2E-P1-5 | P1 | **仍开放** | → REA-S7-1 |
| E2E-P2-2 | P2 | **仍开放** | → REA-S6-1（升级为 P1：相对黄金路径） |

### 5.2 本次新增 / 确证缺陷（REA 二次发现）

| ID | 级别 | 关卡 | 摘要 | 建议 |
| --- | --- | --- | --- | --- |
| REA-S5-1 | P1 | S5 | `dynamicVariable/available` 有 API 无 UI | JobConfigDrawer / Trigger 配置期拉取可引用变量列表 |
| REA-S5-2 | P1 | S5 | `POST /workflow/v4/patch` 未接 | 封装 `getPatchParams`，Patch Job 保存时自动同步 Params |
| REA-S3-1 | P1 | S3 | `rendersets/yamlContent` 未接 | `environmentApi.getYamlContent` + Helm 抽屉「从代码源加载 Values」 |
| REA-S2-1 | P1 | S2 | 主服务保存不调用 convert | 保存前可选/强制 `variable/convert` 对齐 KV |
| REA-S6-1 | P1 | S6 | 向导默认无审批 Stage | 默认插入 approval（或向导勾选「生产需审批」） |
| REA-S6-2 | P1 | S6 | 无审批人前端门控 | 用会话 uid 与 `approve_users` 比对禁用按钮 |
| REA-S7-1 | P1 | S7 | 部署成功无环境回填联动 | passed 后深链 env + 提示刷新 Pod/镜像 |
| REA-S5-3 | P2 | S5 | 向导创建工作流跳过 lint | 创建前复用 `lintWorkflow` |
| REA-S5-4 | P2 | S5 | deploy 环境假选项回退 | `envOptions` 空时禁选并引导创建环境 |
| REA-S1-2 | P2 | S1 | EE 多步创建路由仅浅兼容 | 按 deployType/step 拆向导子步骤或文档声明等价 |
| REA-S7-3 | P2 | S7 | deploy.`production` 未显式绑定 | 随目标环境 production 标志写入 spec |

---

## 6. 排除项与误报防范

| 项 | 判定 |
| --- | --- |
| `plutus/*`、`getHelmServices` | **企业闭源**；社区前端已声明降级，不计入 OSS 黄金路径 P0 |
| 规范书 approve `{status,approval_id}` | **过时示例**；以 L3 `approve:bool` 为准，前端正确 |
| 255MB evidence bundle 全量 AST 灌入会话 | **不可行**；端点 JSON + 定点 Go/TS 对照等价完成契约审计 |
| `environment/operations` / `workflowHook`「缺失」 | **脚本误报**（实现不在单一 api 文件字面量）；人工已核实存在 |
| 后端无 `SourceFromJob` | **误报**；断点曾在前端，现已基本修复 |
| CreateEnvModal.tsx 路径名 | 规范书旧名；实际为 `Environments/Wizard.tsx`，功能等价 |

---

## 7. 整改优先级建议（只审不改，供主控调度）

### P1（本迭代建议）
1. 接线 `dynamicVariable/available` 到 Job/触发配置 UI。  
2. 实现 `workflow/v4/patch` → Params 同步。  
3. 实现 `rendersets/yamlContent` Helm Values 拉取。  
4. 向导默认或可选插入 approval；Execution 审批人门控。  
5. 服务主保存与 convert 对齐；部署成功深链环境并刷新。

### P2（对齐 EE 体验）
6. 向导创建工作流前 lint；去掉假 env 回退。  
7. 多步创建路由真实步骤化；deploy.`production` 绑定。  
8. 多 container module 与多服务 deploy UI 加深。

### 回归用例（建议实机）
| # | 步骤 | 期望 |
| --- | --- | --- |
| 1 | 列表新建项目（含 deploy_type） | 成功；无 empty product_name |
| 2 | 向导 K8s：服务+环境+fromjob 工作流 | 工作流 spec 含 fromjob/build |
| 3 | Builds 配 Dockerfile+registry 并触发 | 构建推镜像成功 |
| 4 | DAG 保存含错误拓扑 | lint 阻断 |
| 5 | 手工加 approval → 触发 → 审批 | 轮询推进；非审批人应被拒/禁用 |
| 6 | 部署 passed | 执行页可一键进环境看到新镜像 |
| 7 | Helm：从 Git 拉 Values | 在 yamlContent 修复后应成功 |

---

## 8. 结论

结合 REA 官方产物二次审查表明：**前次阻断「一键黄金交付」的三类 P0 已在当前分支闭合**，综合分由约 **65 → 80**。剩余确证缺口以 REA 契约对齐为主（`available` 未消费、`v4/patch`、`yamlContent`）、默认路径缺审批、以及部署终态与环境视图未联动——属于可排期的 P1，而非再次出现「任务已创建却 404 / 镜像无法流入部署」级硬断点。

**只读审计声明**：本报告撰写过程未修改任何业务代码，未执行 `git add` / `commit` / `push`。

---

*报告结束 · 标记见终端 `REA_E2E_AUDIT_DONE`*
