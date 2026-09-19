# Zadig 前端重构架构规范、开发经验与全量路由对齐清单

本文档系统性总结了基于线上运行环境（`http://192.168.31.174:8380`）为唯一真理源，在 `frontend/` 目录下使用 **React 18 + Vite + TypeScript + Ant Design 6.x + ProComponents 3.x** 对标老旧 Vue 2.6 `zadig-ee-portal` 产物进行现代化重构的核心经验、工程规范与全量路由功能对齐矩阵。

---

## 一、重构背景与目标愿景

* **工程目标**：在 `frontend/` 目录下构建独立 SPA 单体应用，彻底替代老旧的 Vue 2.6 `zadig-portal`，并通过 Vite 开发代理直连线上 Go 微服务后端（核心调度服务 `aslan`、用户与鉴权服务 `user`、系统配置服务 `systemconfig`）。
* **唯一真理源**：以真实运行环境（`http://192.168.31.174:8380`）及其编译包 `zadig-ee-portal` 为准，全面对标交互体验、DOM 布局结构、数据流转与通信协议。
* **设计标准**：严格遵守 **Ant Design 6.x** 最新官方设计体系与 **ProComponents 3.x** 企业级中后台最佳实践。

---

## 二、关键重构经验与架构原则 (Lessons Learned)

### 1. “真理源”高于“惯性常识”
* **切忌凭空臆测布局**：在中后台重构中，不可随意按照通用卡片网格做“自由发挥”。
  * *典型案例*：在重构系统集成大盘（`/v1/system/integration`）时，初期误用了解构式的 4 列 Card 网格；但线上真实 DOM（`zadig-ee-portal` Chunk 87 / `.integration-home`）是严格的 **单列通栏垂直条状列表 (`.integration-list`)**，具有固定的 `margin-bottom: 10px; padding: 20px 30px;`、鼠标悬浮平移微动 `transform: translateX(5px)`，以及朴素镂空的幽灵蓝边“配置”按钮。
  * *开发法则*：编写任何功能模块前，必须查阅对应模块在 `zadig-ee-portal/static/js/` 和 `static/css/` 中的 classNames 与样式属性，实现 100% 视觉对齐。

### 2. “路由-接口-视图”三位一体逆向验证法
* **路由层溯源**：从编译产物主路由表（`93.*.js`）提取完整的 `vue-router` 路径树，确保所有深层二级、三级子路由（如 `projects/detail/:name/sprints`、`builds/detail/:buildName`、`system/integration/:category`）均有专属组件承接，禁止粗暴重定向或命中通配符 404。
* **接口层核对**：定位各模块调用的实际 RESTful 接口（如 `/api/aslan/sprint_management/v1/sprint/`、`/api/aslan/build/build`、`/api/aslan/testing/scanning`），确保入参、Query 参数与 Payload 数据模型一致。
* **视图层还原**：复刻状态机（连接中/已连接/失败/未执行）、门禁指标（Bugs/漏洞/代码坏味道）及操作反馈。

### 3. Ant Design 6.x 严格演进守则
* **改后必 Lint**：修改或新增 Ant Design 组件后，必须执行：
  ```bash
  antd lint ./src
  ```
  确保提交代码保持 **0 警告、0 废弃项**。
* **规避已废弃 API 清单**：
  * **边框与变体**：禁用已被废弃的 `Card bordered={false}`，统一采用新语法 `variant="borderless"`。
  * **样式插槽**：禁用旧版 `bodyStyle`、`headStyle`、`valueStyle`，统一转向语义化 `styles={{ body: {...}, content: {...} }}` 体系。
  * **组件升级替换**：
    * 禁用 `Input.Group` 与 `Input addonBefore/addonAfter`，统一使用 `<Space.Compact>`。
    * 禁用 `Alert message`，统一改用 `Alert title`。
    * 禁用 `Drawer width`，统一改用 `Drawer size={560}`。
    * 移除 `Modal` 上已弃用的 `destroyOnClose` 属性。
  * **上下文消费**：严禁直接调用全局静态方法 `message.success()`，必须在根层包裹 `<App>` 容器并通过 `const { message, modal } = App.useApp();` 或统一门面 `feedback.message` 消费。

### 4. 全栈安全通信铁律 (Crypto Envelope Guardrail)
* 线上 Zadig 后端 `/api/v1/login` 强制校验混合信封加密：
  1. 调用 `GET /api/aslan/system/rsaKey/publicKey` 取得服务器 RSA 公钥；
  2. 客户端内存生成 32 位随机字符串作为 AES 密钥；
  3. 使用 `node-forge` 的 `RSAES-PKCS1-V1_5` 加密该 AES 密钥并经 Base64 与 URL-Encode 得到 `encrypted_key`；
  4. 使用 `aes-js` 的 AES-128-CFB 模式配合 16 位随机 IV 对密码加密并转 Hex 得到 `password`；
  5. 组装请求报文并发送。

### 5. 实时日志与终端流式连接 (SSE & WebSocket)
* **实时构建/部署日志**：服务端采用 `text/event-stream` (SSE) 推送，前端通过流式响应读取并接入 `@xterm/xterm` 控制台渲染，包含 ANSI 颜色解析与虚拟滚动限频。
* **Pod Web Terminal**：容器 Exec 必须通过原生 WebSocket 连接后端的 podexec 代理，并结合 `@xterm/addon-fit` 处理窗口自适应 `resize` 事件。

---

## 三、全量路由、页面组件与功能接口对齐矩阵 (Full Route Matrix)

### 1. 认证鉴权与全局工作台 (Auth & Dashboard)

| 路由 Path | 前端页面组件 | 布局形式 | 核心业务功能 | 调用的后端 Microservice API |
| :--- | :--- | :--- | :--- | :--- |
| `/signin`<br>`/login`<br>`/login/password` | `pages/Login/index.tsx` | 居中卡片单页，带科技感背景与品牌 Logo | RSA/AES 信封加密登录、Token 存储、会话拦截与登录重定向记忆 | `GET /api/aslan/system/rsaKey/publicKey`<br>`POST /api/v1/login` |
| `/v1/dashboard`<br>`/v1/status` | `pages/Dashboard/index.tsx` | `BasicLayout` 全局侧边栏 + 顶部导航 | 工作流全量统计、环境运行健康度大盘、最近任务动态、快速进入工作区 | `GET /api/aslan/workflow/v4/list`<br>`GET /api/aslan/project/products` |

### 2. 项目管理与初始化向导 (Projects & Wizard)

| 路由 Path | 前端页面组件 | 布局形式 | 核心业务功能 | 调用的后端 Microservice API |
| :--- | :--- | :--- | :--- | :--- |
| `/v1/projects` | `pages/Projects/index.tsx` | 全局布局，支持卡片栅格与紧凑表格双视图切换 | 项目模糊搜索、星标收藏置顶、部署类型过滤（K8s/Helm/主机）、权限标签 | `GET /api/v1/picket/projects`<br>`POST /api/aslan/project/favorite` |
| `/v1/projects/create`<br>`/v1/projects/create/:projectName/k8s/:step` | `pages/Projects/Wizard.tsx` | 居中 1000px 步骤卡片容器 | 4 步交付向导：项目基础信息 ➔ 声明式微服务骨架 ➔ 多环境与集群绑定 ➔ 自动化 CI/CD 流水线生成 | `POST /api/aslan/project/products`<br>`POST /api/aslan/environment/environments` |

### 3. 项目级专属工作空间 (Project-Scoped Workspace)

> **统一父级布局容器**：`layouts/ProjectDetailLayout.tsx`（包含顶层项目上下文下拉切换器与 9 个二级横向 Tab 导航栏）。

| 二级路由 Path | 前端页面组件 | 页面布局与特性 | 核心业务功能 | 调用的后端 Microservice API |
| :--- | :--- | :--- | :--- | :--- |
| `projects/detail/:name/detail` | `pages/Projects/Overview.tsx` | 2x2 统计卡片 + 双并列表格 | 项目架构总览、关联微服务环境状态表、关联工作流近期触发概览 | `GET /api/aslan/project/products/:name`<br>`GET /api/aslan/environment/environments` |
| `projects/detail/:name/sprints` | `pages/Projects/Sprints.tsx` | 统计 KPI 卡片 + 状态过滤标签 + 交付看板表 | 敏捷迭代管理、进行中/规划中/已完成过滤、工作项交付进度条、新建/编辑迭代 Modal | `GET /api/aslan/sprint_management/v1/sprint/`<br>`POST /api/aslan/sprint_management/v1/sprint/` |
| `projects/detail/:name/pipelines`<br>`pipelines/:name`<br>`pipelines/:name/task/:taskId`<br>`pipelines/custom/:name/:taskId` | `pages/Pipelines/index.tsx`<br>`pages/Pipelines/Execution.tsx` | 工作流列表 + 动态 DAG 画布 + xterm.js 实时终端 | 工作流 V4 引擎调度、手动触发任务、分阶段状态监听、实时 SSE 流式日志输出与重试 | `GET /api/aslan/workflow/v4/workflow/:name`<br>`GET /api/aslan/workflow/v4/workflow/task/sse` |
| `projects/detail/:name/envs`<br>`envs/:envName` | `pages/Environments/index.tsx` | 环境选择栏 + Pod 状态表格 + 抽屉/终端 | 多环境拓扑、Pod 运行状态/重启次数、实时容器日志弹窗、WebSocket Web 终端连接 | `GET /api/aslan/environment/environments/:name`<br>`WS /api/aslan/environment/podexec` |
| `projects/detail/:name/services` | `pages/Services/index.tsx` | 经典双栏布局（左侧服务树 + 右侧 Monaco 编辑器） | K8s 原生 YAML 声明式配置、多变量注入、实时语法校验、服务模版加载 | `GET /api/aslan/service/template/service/:name`<br>`POST /api/aslan/service/template/service` |
| `projects/detail/:name/builds`<br>`builds/create`<br>`builds/detail/:buildName` | `pages/Projects/Builds.tsx` | 模块统计卡片 + 构建表格 + 配置 Modal | 多语言构建配置（Go/Node/Java/Py）、关联服务组件、基础构建镜像选择、Shell 脚本与立即执行 | `GET /api/aslan/build/build`<br>`POST /api/aslan/build/build`<br>`GET /api/aslan/build/build/serviceModule` |
| `projects/detail/:name/test` | `pages/Quality/index.tsx` | 质量报表卡片 + 测试套件表格 | 自动化测试套件执行、代码覆盖率统计、测试任务历史记录与报告导出 | `GET /api/aslan/testing/test`<br>`POST /api/aslan/testing/test/task` |
| `projects/detail/:name/scanner`<br>`scanner/create`<br>`scanner/ai-review/create`<br>`scanner/detail/:scannerName` | `pages/Projects/Scanners.tsx` | 门禁卡片 + 扫描规则列表 + 质检报告 Drawer | SonarQube/Trivy 静态检测、**Zadig AI 智能代码审查 (LLM PR Review)**、门禁阻断与修复建议 | `GET /api/aslan/testing/scanning`<br>`POST /api/aslan/testing/scanning/:name/task` |
| `projects/detail/:name/version` | `pages/Delivery/index.tsx` | 制品追踪与版本管理双 Tab | 容器镜像 Tag 追踪、发布版本快照生成、交付物归档与下载 | `GET /api/aslan/delivery/artifacts`<br>`GET /api/aslan/delivery/releases` |

### 4. 全局资产与企业交付中心 (Global Assets & Releases)

| 路由 Path | 前端页面组件 | 页面布局与特性 | 核心业务功能 | 调用的后端 Microservice API |
| :--- | :--- | :--- | :--- | :--- |
| `/v1/template`<br>`/v1/template/:tab` | `pages/Templates/index.tsx` | 6 大类模版卡片与代码预览 Tab（URL 同步） | 20 个企业内建交付工作流模版、K8s YAML 模版、Chart 模版、Dockerfile 模版、构建模版 | `GET /api/aslan/template/workflow`<br>`GET /api/aslan/template/yaml` |
| `/v1/releasePlan` | `pages/ReleasePlan/index.tsx` | 发布日历看板 + 里程碑状态轴 | 发布排期计划日历、版本封版倒计时、阶段推进与阻断标记 | `GET /api/aslan/release_plan/v1/plan` |
| `/v1/plutus` | `pages/Plutus/index.tsx` | 客户交付矩阵卡片 | 专有云与客户私有化多租户交付管理、商业授权与交付状态追踪 | `GET /api/plutus/products` |
| `/v1/directory` | `pages/Directory/index.tsx` | 业务域卡片 + 服务组件依赖图谱 | 微服务企业级服务目录梳理、业务域归属划分与负责人映射 | `GET /api/aslan/service/directory` |
| `/v1/delivery`<br>`/v1/delivery/:tab` | `pages/Delivery/index.tsx` | 全局制品追踪与版本发布 Tab | 跨项目交付物镜像版本追踪、发布快照生成与下载 | `GET /api/aslan/delivery/artifacts` |
| `/v1/resource`<br>`/v1/resource/:tab` | `pages/Resource/index.tsx` | 资源 4 标签页（集群、代码源、镜像仓、存储） | 统一基础设施资产总览，支持直接跳转各专业设置页 | `GET /api/aslan/cluster/clusters`<br>`GET /api/aslan/code/workspace` |

### 5. 效能度量与个人偏好 (Insights & Profile)

| 路由 Path | 前端页面组件 | 页面布局与特性 | 核心业务功能 | 调用的后端 Microservice API |
| :--- | :--- | :--- | :--- | :--- |
| `/v1/statistics`<br>`/v1/insight`<br>`/v1/insights` | `pages/Statistics/index.tsx`<br>`pages/Insights/index.tsx` | 效能报表栅格 + 趋势图表 | 交付周期时长、构建频次趋势、代码变更失败率、团队工程效能大盘 | `GET /api/aslan/stat/v2/quality/test/count`<br>`GET /api/aslan/stat/build` |
| `/v1/profile`<br>`/v1/profile/mcp`<br>`/v1/profile/info`<br>`/v1/profile/security`<br>`/v1/profile/preference` | `pages/Profile/index.tsx` | 左侧偏好 Tab + 右侧设置面板 | 账号基本信息维护、**AI 助手 MCP Server 连接配置 (SSE 端口/端点)**、API Token 管理 | `GET /api/v1/users/me`<br>`GET /api/v1/profile/preference` |
| `/v1/enterprise`<br>`/v1/enterprise/info`<br>`/v1/enterprise/license`<br>`/v1/enterprise/theme`<br>`/v1/enterprise/language` | `pages/Enterprise/index.tsx` | 许可证状态 + 企业主题品牌配置 | 企业版 License 状态授权检测、系统 Logo/主题主色定制、系统版本信息 | `GET /api/plutus-enterprise/license`<br>`GET /api/aslan/system/theme` |

### 6. 系统集成与基础设施设置 (System Integration & Settings)

| 路由 Path | 前端页面组件 | 页面布局与特性 (100% 对齐线上) | 核心业务功能 | 调用的后端 Microservice API |
| :--- | :--- | :--- | :--- | :--- |
| `/v1/system/integration`<br>`/v1/system/integration/:category` | `pages/Settings/Integration/index.tsx` | **垂直单列通栏卡片列表 (`.integration-list`)**，具有 `translateX(5px)` 悬浮微动、30px 纯色图标与镂空配置按钮 | 完整对齐 **12 大系统集成能力**（账号系统、代码源、项目管理、IM 集成、AI 模型、CI/CD 工具、代码扫描、配置管理、网关组件、监控系统、云服务、其他系统），支持连通性测试与配置弹窗 | `/api/aslan/code/codehost`<br>`/api/aslan/system/llm/integration`<br>`/api/aslan/system/cicdTools`<br>`/api/aslan/system/sonar/integration`<br>`/api/aslan/system/im_app`<br>`/api/aslan/system/configuration`<br>`/api/aslan/system/project_management` |
| `/v1/system/clusters` | `pages/Settings/Clusters/index.tsx` | 基础设施配置表格 | Kubernetes 集群接入向导 (Agent / KubeConfig 模式)、连通性探测、命名空间同步 | `GET /api/aslan/cluster/clusters`<br>`POST /api/aslan/cluster/clusters` |
| `/v1/system/codehosts` | `pages/Settings/CodeHosts/index.tsx` | 资产卡片列表 | GitLab/GitHub/Gitee 代码源授权接入与 OAuth 回调测试 | `GET /api/aslan/code/codehost`<br>`POST /api/aslan/code/codehost` |
| `/v1/system/registries` | `pages/Settings/Registries/index.tsx` | 镜像仓维护表格 | Harbor / DockerHub / 阿里云 ACR / 腾讯云 TCR 镜像仓库凭据与信封加密连通性验证 | `GET /api/aslan/system/registry/namespaces?encryptedKey=`<br>`POST /api/aslan/system/registry/namespaces` |
| `/v1/system/storage`<br>`/v1/system/secrets` | `pages/Settings/Storage/index.tsx` | 对象存储与密钥配置表格 | S3 / MinIO / 阿里云 OSS 对象存储桶集成与构建缓存凭据配置 | `GET /api/aslan/system/s3storage?encryptedKey=`<br>`POST /api/aslan/system/s3storage` |
| `/v1/system/users` | `pages/Settings/Users/index.tsx` | 用户管理 ProTable | 统一用户账号维护、系统管理员/普通成员角色授权、重置密码 | `POST /api/v1/users/search`<br>`POST /api/v1/users`<br>`GET /api/v1/policy/roles` |
| `/v1/system/config`<br>`/v1/system/apps`<br>`/v1/system/imgs`<br>`/v1/system/workflowTasks`<br>`/v1/system/plugins`<br>`/v1/system/announcement`<br>`/v1/system/auditlog` | `pages/Settings/Config/index.tsx` | 全系统基础设施综合配置 Tab 体系（URL 同步） | 8 大核心系统配置：<br>1. **SMTP 邮箱服务器** (`mail`)<br>2. **任务并发与调度** (`workflowTasks` / `concurrency`)<br>3. **构建系统镜像** (`imgs`)<br>4. **依赖软件包管理** (`apps`)<br>5. **系统插件** (`plugins`)<br>6. **系统公告** (`announcement`)<br>7. **网络代理** (`proxy`)<br>8. **操作审计日志** (`auditlog`) | `GET/POST /api/aslan/system/concurrency/workflow`<br>`GET/POST/DELETE /api/aslan/system/basicImages`<br>`GET /api/aslan/system/install`<br>`GET /api/aslan/system/plugin`<br>`GET /api/aslan/system/operation?status=0&per_page=50&page=1`<br>`GET/POST /api/v1/emails/host`<br>`GET/POST /api/aslan/system/proxyManage` |

---

## 四、工程质量与生产基线

1. **静态语法与废弃项检测**：
   ```bash
   antd lint ./src
   # Output: Scanned 56 files. No issues found. (0 废弃项、0 告警)
   ```
2. **TypeScript 严格类型检查**：
   ```bash
   pnpm exec tsc --noEmit
   # Output: exit code 0
   ```
3. **生产级打包验证**：
   ```bash
   pnpm run build
   # Output: built in ~28s, exit code 0
   ```
4. **Git 管理准则**：
   * 所有重构与对齐修改均规范落入本地提交；
   * 严格遵守“不随意推送”指令，确保远端分支安全。

