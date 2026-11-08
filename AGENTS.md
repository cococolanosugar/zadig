# AGENTS.md - Project Context & Guidelines

本文档为 AI Agent 以及开发者提供 `zadig` 项目（特别是 `feat/zadig-portal-next` 分支）的全局架构上下文、开发规范、核心约束与前端重构标准。

---

## 1. 项目概览 (Project Overview)

* **项目名称**：`zadig` (KodeRover 云原生持续交付平台)
* **当前分支**：`feat/zadig-portal-next`
* **目标愿景**：基于真实运行环境（`http://192.168.31.174`）为唯一真理源，在 `frontend/` 目录下使用 **React 18 + Vite + TypeScript + Ant Design 6.x + ProComponents 3.x** 完全复刻并重构现代化前端应用，替代老旧的 Vue 2.6 `zadig-portal`。
* **默认验证凭据**：线上环境与本地开发代理统一管理员账号为 `admin`，密码为 `Zadig@2026`，前端可通过信封加密直接登录验证。
* **架构模式**：
  * **后端**：Go 微服务架构（核心微服务 `aslan`、用户与鉴权服务 `user`、系统配置服务 `systemconfig`），通信采用标准 RESTful HTTP + SSE (实时日志流) + WebSocket (Pod Web 终端)。
  * **前端**：独立 SPA 单体工程位于 `frontend/`，通过 Vite 代理连接后端服务。
  * **参考与设计标准**：全面对标 [Ant Design](https://ant.design) 6.x 官方设计规范与 [Ant Design Pro Components](https://procomponents.ant.design) 3.x 企业级中后台最佳实践。

---

## 2. 仓库目录结构规范 (Repository Layout)

```text
zadig/
├── cmd/                           # 后端各微服务启动入口 (aslan, user, cron, hub-server 等)
├── pkg/                           # 后端核心业务逻辑与工具库
│   ├── microservice/              # 微服务核心实现
│   │   ├── aslan/                 # 核心调度、项目、环境、构建、工作流 V4 引擎
│   │   ├── user/                  # 用户管理、RBAC 权限、RSA/AES 登录鉴权
│   │   └── systemconfig/          # 基础设施集成 (集群、代码源、镜像仓、存储)
│   ├── tool/                      # 基础驱动 (k8s client, crypto, gorm, mongo)
│   └── setting/                   # 全局系统常量与环境变量定义
│
├── frontend/                      # 【核心重构目标】全新 React 18 + Ant Design 6 前端工程
│   ├── src/
│   │   ├── api/                   # 强类型 API 接口层 (基于 Axios，统一注入 Bearer Token)
│   │   ├── assets/                # 静态资源与矢量图标
│   │   ├── components/            # 全局通用组件 (Monaco YAML 编辑器, xterm 终端, DAG 画布)
│   │   ├── layouts/               # 全局布局体系 (基于 ProLayout，支持项目切换与动态面包屑)
│   │   ├── pages/                 # 各业务域页面 (Dashboard, Projects, Services, Pipelines, Envs, Settings)
│   │   ├── stores/                # 状态管理 (Zustand)
│   │   ├── utils/                 # 工具函数 (RSA/AES 加密信封、JWT 解析、时间格式化)
│   │   └── App.tsx                # 根应用容器 (包裹 ConfigProvider + App)
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts             # Vite 配置 (含开发代理至 http://192.168.31.174)
│
├── openspec/                      # 变更管理与规范定义 (OpenSpec 规划工作区)
├── manifest/                      # 系统部署与编排声明
│   └── deploy/
│       └── helm/                  # Zadig 官方 Helm Chart (v5.0.0, 包含 values.yaml 与 templates)
├── zadig-portal/                  # 【历史参考】早期 Vue 2.6 前端源码 (仅作字段与数据模型参考，禁止修改)
├── .mcp.json                      # 本地 MCP 服务声明 (antd, codegraph, gitnexus, chrome-devtools)
├── mise.toml                      # 全栈开发工具链与版本锁 (Go, Node, pnpm, @ant-design/cli 等)
└── AGENTS.md                      # 本文档
```

---

## 3. 前端 Ant Design 6 规范与 CLI 工具使用守则

本项目新前端工程统一基于 **Ant Design 6.x** 与 **ProComponents 3.x** 构建。组件 API 与定制模式存在演进与破坏性变更，开发者及 AI Agent 必须严格遵守以下守则：

### 3.1 深度理解官方全量组件知识 (Official LLM Knowledge Base)
* 开发前端界面时，必须阅读并参考官方大模型全量知识库：[https://ant.design/llms-full.txt](https://ant.design/llms-full.txt)，深入理解 Ant Design 75 个全量组件的设计体系与规范、类型提取工具（如 `GetRef`、`GetProps`、`GetProp`）以及上下文机制，在编写 Ant Design 代码时充分应用这些知识。

### 3.2 写前必查 (Query Before Writing)
* 严禁凭历史记忆臆测组件 Props 或配置项。编写组件前，优先使用 `@ant-design/cli` 工具查询确切 API：
  ```bash
  antd info <Component> --format json  # 查询组件最新 Props、类型定义及默认值
  antd demo <Component> <demoKey>      # 获取官方标准运行示例源码
  antd semantic <Component>            # 查看组件语义化 DOM 结构 (classNames / styles 插槽)
  ```

### 3.3 严防废弃用法 (No Deprecated APIs)
* **变体与边框**：禁止使用已被弃用的 `Card bordered`（必须统一使用 `variant="borderless"` 等新变体语法）。
* **样式定制**：样式属性全面转向语义化 `styles` 与 `classNames` 体系，严禁使用弃用的 `valueStyle`、`bodyStyle`、`headStyle` 等旧属性。
* **全局反馈组件**：严禁直接调用全局静态方法 `message.success()` / `notification.error()` / `Modal.confirm()`（会丢失 `ConfigProvider` 主题上下文）。根层必须包裹 `<App>` 容器，并在组件内部通过 `const { message, modal, notification } = App.useApp();` Hook 消费。

### 3.4 改后必 Lint (Lint After Changes)
* 编写或修改前端 Ant Design 代码后，必须执行静态语法与废弃项检测：
  ```bash
  antd lint ./frontend/src
  ```
  确保提交的代码保持 0 警告、0 废弃项。

### 3.5 诊断与故障排查 (Doctor & Env)
* 若遇到组件渲染异常、样式不生效或依赖冲突，运行以下指令快速定位环境与 peerDependencies 问题：
  ```bash
  antd doctor
  antd env
  ```

### 3.6 ProLayout 侧边栏辅助链接规范 (ProLayout links & all-blocks)
* 侧边栏底部辅助区域严格对齐官方 `ant-design/ant-design-pro (all-blocks)` 规范：严禁在 `menuFooterRender` 中随意注入大尺寸自定义 Card 破坏侧边栏留白。统一使用 ProLayout 原生 `links?: React.ReactNode[]` 属性挂载文档链接与辅助工具，并结合 `menuFooterRender` 输出极简版权信息，保证展开与折叠态 100% 视觉协调。

---

## 4. 全栈通信与安全编码规范 (Fullstack Communication & Security)

### 4.1 认证传输信封加密铁律 (Crypto Envelope Guardrail)
* 线上 Zadig 后端 `/api/v1/login` 强制校验信封加密，明文密码直接拦截（报错 `encrypted_key is required`）。
* **标准加密流水线**：
  1. 调用 `GET /api/aslan/system/rsaKey/publicKey` 取得服务器 RSA 公钥；
  2. 客户端内存中生成 32 位随机字符作为 AES 密钥；
  3. 使用 `node-forge` 的 `RSAES-PKCS1-V1_5` 加密该 AES 密钥并经 Base64 与 URL-Encode 得到 `encrypted_key`；
  4. 使用 `aes-js` 的 AES-128-CFB 模式配合 16 位随机 IV 对密码进行加密并转为 Hex 字符串得到 `password`；
  5. 组装请求报文并发送。

### 4.2 统一请求拦截与 Token 托管
* 统一使用 Axios 客户端管理请求，自动拦截并注入 `Authorization: Bearer <token>`。
* 当接口返回 HTTP 401 Unauthorized 时，自动清空本地会话并跳转至 `/signin`，保留重定向来源路由（`redirect` 参数）。

### 4.3 实时日志与终端流式连接
* **实时构建/部署日志**：服务端采用 `text/event-stream` (SSE) 推送。前端通过 `fetch` 流式响应读取或 `EventSource` 监听，输入 `@xterm/xterm` 控制台渲染，必须带有 ANSI 颜色解析与虚拟滚动限频，防止大量日志崩溃 DOM。
* **Pod Web Terminal**：环境管理中对容器的 Exec 操作必须通过原生 WebSocket 连接后端的 podexec 代理，并结合 `@xterm/addon-fit` 处理窗口自适应尺寸变更（`resize` 事件）。

---

## 5. 本地 MCP 项目级配置与 AI 协同规范 (Local MCP Architecture)

项目根目录声明了 [`.mcp.json`](.mcp.json)，激活了统一版本锁定的四大本地 MCP 服务：

```json
{
  "mcpServers": {
    "antd": {
      "command": "antd",
      "args": ["mcp"]
    },
    "codegraph": {
      "command": "codegraph",
      "args": ["serve", "--mcp"]
    },
    "gitnexus": {
      "command": "gitnexus",
      "args": ["mcp"]
    },
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

* **`antd` (v6.6.2)**：向 AI Agent 提供 Ant Design 75 个组件的 Props 定义、Design Tokens、语义化 classNames/styles 插槽与官方可运行 Demo。
* **`codegraph` (v1.6.0)**：本地持久化代码知识图谱，基于 AST 进行跨文件调用链追踪与精确符号定位。
* **`gitnexus` (v1.6.11)**：基于知识图谱的代码变更影响面分析（Impact Analysis），精准预判函数/类型改动对下游调用者的破坏。
* **`chrome-devtools`**：提供真实浏览器页面交互、Console 错误捕获与 DOM 检查支持。

---

## 6. 全局 UTF-8 编码与工程一致性守则

1. 所有新建的 TypeScript、React JSX、JSON、YAML、SQL 与 Markdown 文件必须且仅能以 **UTF-8 无 BOM (UTF-8 without BOM)** 格式保存。
2. 严禁在 Windows PowerShell 环境中使用管道符（如 `Get-Content | ...`）直接传递 SQL 或配置文件，防止默认 ANSI/GBK 转码造成中文字符不可逆乱码。

---

## 7. 官方 Helm Chart 资源与部署编排规范 (Helm Chart & Manifests)

项目在 `manifest/deploy/helm/` 维护了 KodeRover 官方发布的 Zadig 核心部署 Helm Chart（当前版本为 **v5.0.0**），用于环境编排、values 参数比对及微服务配置真理源对账。

### 7.1 Chart 仓库元数据
* **官方 Chart 仓库地址**：`https://koderover.tencentcloudcr.com/chartrepo/chart`
* **Helm Repo 别名**：`koderover-chart`
* **当前版本目标**：`koderover-chart/zadig`（Chart Version: `5.0.0`，App Version: `5.0.0`）
* **本地平铺路径**：`manifest/deploy/helm/`（注：去除中间层 `zadig/` 目录，使 `Chart.yaml` 与 `values.yaml` 直接平铺在 `manifest/deploy/helm/` 根下）

### 7.2 获取与同步命令流水线
```bash
# 1. 添加官方 Helm 仓库并更新索引
helm repo add koderover-chart https://koderover.tencentcloudcr.com/chartrepo/chart --force-update
helm repo update koderover-chart

# 2. 检索可用版本
helm search repo koderover-chart/zadig --version 5.0.0

# 3. 拉取指定版本 Chart 包
helm pull koderover-chart/zadig --version 5.0.0

# 4. 解压至 manifest/deploy/helm 并平铺文件
tar -xzf zadig-5.0.0.tgz -C manifest/deploy/helm
# 移动 zadig/* 至 helm/ 根层并移除临时目录与压缩包
Get-ChildItem -Path "manifest/deploy/helm/zadig" | Move-Item -Destination "manifest/deploy/helm" -Force
Remove-Item "manifest/deploy/helm/zadig" -Force -Recurse
Remove-Item "zadig-5.0.0.tgz" -Force
```

### 7.3 核心资产结构
* `manifest/deploy/helm/Chart.yaml`：Chart 元信息及声明；
* `manifest/deploy/helm/values.yaml`：Zadig 5.0.0 各微服务（aslan、user、cron、hub-server、dind、mongodb、mysql、redis 等）全量参数默认值；
* `manifest/deploy/helm/templates/`：Kubernetes 编排清单模板；
* `manifest/deploy/helm/charts/`：子依赖 Chart（dex, gloo, minio）。

---

## 8. 官方前端构建产物获取与逆向真理源对账规范 (Official Portal Artifacts & Alignment)

项目根目录下的 `zadig-ee-portal/` 目录为前端重构与逆向审计的**唯一静态真理源**。该目录必须与官方发布镜像中的构建产物保持 1:1 字节级完全对齐，严禁人工直接修改，只能通过官方 Docker 镜像拉取并导出覆盖。

### 8.1 镜像元数据与定位规则
* **镜像来源契约**：根据 `manifest/deploy/helm/values.yaml` 中声明的 `global.image.registry` 与 `frontend.image` 组合确定：
  * **Registry**：`koderover.tencentcloudcr.com/koderover-public`
  * **Repository**：`zadig-portal`
  * **Tag**：`5.0.0-RELEASE.3-1020`
  * **完整镜像名**：`koderover.tencentcloudcr.com/koderover-public/zadig-portal:5.0.0-RELEASE.3-1020`
* **容器文档根目录**：镜像内 Nginx 配置挂载路径为 `/zadig-ee-portal/`（包含 `index.html`、`static/`、`workers/`），版本信息记录于 `/zadig-ee-portal/static/version.json`。

### 8.2 获取、同步与纯净化流水线
在升级或重新获取产物前，**必须先清空本地历史目录**，以彻底避免历史旧版本 Chunk 与新版本 Chunk 混杂形成孤儿文件。

```bash
# 1. 确保 Docker 守护进程运行并拉取最新官方镜像
docker pull koderover.tencentcloudcr.com/koderover-public/zadig-portal:5.0.0-RELEASE.3-1020

# 2. 清理本地 zadig-ee-portal 历史残留文件（防止新老 Chunk 混淆）
# PowerShell:
if (Test-Path "zadig-ee-portal") {
    Get-ChildItem -Path "zadig-ee-portal" -Recurse | Remove-Item -Force -Recurse
} else {
    New-Item -ItemType Directory -Path "zadig-ee-portal" -Force
}

# 3. 创建临时无挂载容器并拷贝构建产物
docker rm -f temp_zadig_portal 2>$null
docker create --name temp_zadig_portal koderover.tencentcloudcr.com/koderover-public/zadig-portal:5.0.0-RELEASE.3-1020
docker cp temp_zadig_portal:/zadig-ee-portal/. zadig-ee-portal/

# 4. 彻底销毁临时容器
docker rm -f temp_zadig_portal

# 5. 核验版本信息元数据
cat zadig-ee-portal/static/version.json
```

### 8.3 产物验收与一致性比对标准
导出完成后，必须进行完整性核验：
1. **文件与 Chunk 数量对账**：
   * 静态资源总文件数精确为 **382** 个（包含 111 个 JS Chunk 及其 `.gz` 压缩包、77 个 CSS 样式文件、78 个字体/矢量图标）；
2. **版本元数据对齐**：
   * `static/version.json` 的 `COMMIT_ID` 与官方发布标签 Commit 完全一致（当前基准为 `92d17fd5b85cd580e1102404ea3e248c0788fae9`）；
3. **SHA-256 零差异验收**：
   * 若需校验本地目录与镜像产物一致性，可通过临时容器导出至独立临时目录，遍历所有 382 个文件进行 SHA-256 哈希比对，必须达到 0 缺失、0 冗余、0 mismatch。

---

## 9. 本地部署访问与 gateway-proxy 端口转发调试方案 (Local Access & Port-Forward)

在 Docker Desktop Kubernetes（kind 节点 `desktop-control-plane`，Node IP 为 WSL2 内部地址，如 `172.18.0.4`）上部署 Zadig 后，**NodePort 无法从 Windows 宿主机直接访问**；且 Kubernetes NodePort 默认范围为 30000–32767，不能分配 80 端口。宿主机侧统一通过 `kubectl port-forward` 暴露 `gateway-proxy`。

### 9.1 gateway-proxy 服务拓扑

* Service：`zadig/gateway-proxy`，NodePort 映射为 `80:30080/TCP`、`443:30443/TCP`，targetPort 为 `8080/8443`。
* 集群内访问：`http://gateway-proxy.zadig.svc.cluster.local`（80 端口）或 `http://gateway-proxy.zadig`。
* 入口网关为 Gloo/Envoy，`VirtualService` 将 `/`、`/api/*`、`/dex` 等路径路由到 zadig-portal、aslan、user 等微服务。
* 不要直接访问 `http://172.18.0.4:30080`：该地址位于 WSL2 内部网络，Windows 宿主机无路由。

### 9.2 标准访问命令

```powershell
# 方式 A：localhost:30080（与 Zadig ADDRESS 配置一致，推荐日常使用）
kubectl port-forward -n zadig svc/gateway-proxy 30080:80

# 方式 B：宿主机 IP:80（监听所有网卡，局域网/Tailscale 均可访问）
kubectl port-forward -n zadig svc/gateway-proxy 80:80 --address 0.0.0.0
```

* 方式 B 的访问地址为 `http://<本机IP>`（当前环境为 `http://192.168.31.174`）；绑定前确认 80 端口未被占用：
  `Get-NetTCPConnection -State Listen -LocalPort 80`
* 仅本机访问可省略 `--address 0.0.0.0`（默认只监听 127.0.0.1）。
* 局域网其他设备访问时，需在 Windows 防火墙放行 80/TCP 入站。

### 9.3 Windows 后台常驻

```powershell
$kubectl = (Get-Command kubectl).Source
Start-Process -FilePath $kubectl `
  -ArgumentList @('port-forward','-n','zadig','svc/gateway-proxy','80:80','--address','0.0.0.0') `
  -RedirectStandardOutput "$env:TEMP\zadig-port-forward-80.log" `
  -RedirectStandardError "$env:TEMP\zadig-port-forward-80.log.err" `
  -WindowStyle Hidden
```

* 后台进程会随机器重启或进程退出而失效，重跑命令即可；也可使用 Lens 的 Port Forward 功能。
* 查看当前转发进程：
  `Get-CimInstance Win32_Process -Filter "Name='kubectl.exe'" | Where-Object { $_.CommandLine -match 'port-forward' }`
* 注意：按端口匹配进程时不要用模糊的 `80:80`，否则会把 `30080:80` 的转发进程一并误杀。

### 9.4 连通性验收

```powershell
curl.exe -s http://localhost/api/v1/login-enabled
curl.exe -s http://192.168.31.174/api/v1/login-enabled
```

* 返回 `{"enabled":false}` 且 HTTP 200：说明网关 → user 服务链路正常；`enabled:false` 仅表示第三方/SSO 登录未开启，不是故障。
* 门户首页 `/` 返回 200，`/static/version.json` 中 `VERSION` 应为 `5.0.0-RELEASE.3-1020`。

### 9.5 运行与登录验证凭据 (Authentication & Login)

* **参考运行地址**：`http://192.168.31.174`
* **管理员用户名**：`admin`
* **管理员密码**：`Zadig@2026`
* **前端开发与验证**：在 `frontend/` 下执行 `pnpm dev` 启动前端开发服务（默认监听端口 5174），Vite 代理自动将 `/api`、`/dex` 转发至 `http://192.168.31.174`。在登录页使用上述账号密码登录即可通过 RSA/AES 信封加密获取 Token，在实际页面中进行全量功能验证。

### 9.6 常见问题

* **connection refused / 目标计算机积极拒绝**：转发进程已退出或端口未监听，检查 `Get-NetTCPConnection -State Listen -LocalPort 80` 后重跑命令。
* **address already in use**：80 端口被 IIS/http.sys 或其他进程占用，改用 30080 或先释放端口。
* **localhost 可通、本机 IP 不通**：缺少 `--address 0.0.0.0`，或被 Windows 防火墙拦截。
* **ADDRESS 不一致**：Helm 默认 `endpoint` 为 `http://localhost:30080`；若要固定使用 `http://<本机IP>`，需同步修改 `manifest/deploy/helm/values-local.yaml` 中的 `endpoint`（`type: FQDN`、`FQDN: <本机IP>`）和 Dex `staticClients.redirectURIs`（`http://<本机IP>/api/v1/callback`），再执行 `helm upgrade`。

---

## 10. 全量逆向工程实践与沉淀体系 (Reverse Engineering Practices & Lessons Learned)

在基于生产镜像产物（`zadig-ee-portal/`）与在线参考环境（`http://192.168.31.174`）重构现代前端的过程中，总结并沉淀了如下逆向工程方法论、多 Agent 协作体系与核心业务域避坑指南。

### 10.1 多 Agent 闭环逆向流水线 (Multi-Agent RE Pipeline)
逆向任务不宜单点孤军奋战，推荐采用四位一体闭环流水线：
```text
┌─────────────────────────┐
│ Antigravity (总控/对账)  │ ➔ 制定任务清单与协议对账规范
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Claude Code (静态逆向)  │ ➔ 审计 zadig-ee-portal Bundle + Go 后端微服务源码，输出详细审计报告
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Antigravity (协议复核)  │ ➔ 提炼高精度 Implementation Spec（锁定类型、URL、Payload、UI 契约）
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Cursor (精密实现落地)   │ ➔ 在 frontend/ 下实施 React 18 + TS + Ant Design 6.x 落地重构
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 双门禁 + Chrome DevTools│ ➔ antd lint (0 告警) + pnpm build (0 错误) + 真实浏览器 E2E 交互验收
└─────────────────────────┘
```

### 10.2 静态产物逆向与后端交叉核验方法论 (Bundle RE & Backend Cross-Audit)
1. **静态 Bundle 定位切入点**：
   * 所有官方构建产物位于 `zadig-ee-portal/static/js/*.js`。
   * 路由与视图映射：首先在 `app.xxx.js` 检索 Vue Router 配置，定位组件名与其异步加载的 Chunk 文件哈希。
   * 接口与字段反查：利用关键词（如 `/api/aslan/`, `/api/v1/`, 请求参数名）在 `zadig-ee-portal/static/js/` 下全局搜索，确定请求 Method、Query、Body 结构与状态码处理分支。
2. **严防“前端代码孤证”——必须交叉核验 Go 后端源码**：
   * **陷阱示例 1（MFA 重置）**：前端 Bundle 中存在调用 `POST /api/v1/users/:uid/mfa/disable`，但在 Go 后端源码（`pkg/microservice/user/core/handler/user.go`）中明确校验 `if ctx.UserID != uid { return ErrForbidden }`，表明该接口仅供登录用户自服务；管理员强制重置 MFA 的真实有效接口为 `DELETE /api/v1/users/:uid/mfa`。若不核验后端，就会导致管理端报 403 越权错误。
   * **陷阱示例 2（RBAC 动作树）**：后端 `GET /api/v1/policy/resource-actions` 返回结构为 `[]*ResourceDefinition{ resource, alias, rules: []*Action{ action, alias } }`。前端角色创建接口所需要的 verb 列表是纯动词（如 `get_workflow`, `edit_workflow`），而非拼接后的 `resource:verb`，必须对齐 Go 结构体序列化字段。

### 10.3 核心业务域逆向避坑知识库 (Domain Knowledge & Gotchas)

#### 1. 项目向导与模板体系 (Projects & Wizards)
* **向导模式**：新建项目并非单一表单，官方支持 5 类项目卡片模式（K8s YAML 项目、Helm Chart 项目、K8s 托管项目、生产托管项目、虚拟机项目），向导流程必须支持多集群调度策略。
* **数据结构**：接口 `POST /api/aslan/project/v3/projects`，包含 `project_name`、`product_name`、`desc` 与部署策略对象。

#### 2. 工作流与模板库 (Pipelines & Templates)
* **预置模板库**：工作流新建入口需提供官方内置模板库（单服务构建部署、多环境分支发布等），支持一键加载阶段（Stages）与任务（Jobs）骨架。
* **DAG 画布与执行器**：画布数据模型必须与 Aslan 工作流 V4 调度引擎的 Stage-Job 结构严格 1:1 对齐，防止保存时后端校验失败。

#### 3. 基础设施集成 (CodeHosts & Clusters)
* **代码源集成**：涵盖 7 大代码托管平台（GitLab、GitHub、Gerrit、Gitee、Gitee EE、Codeup、GitLab EE），平台表单各不相同（个人 Token、OAuth 鉴权应用、内网 HTTP/SOCKS5 代理穿透），OAuth 流程需引导用户至提供商授权并在回调中完成交换。
* **集群高级调度**：集群抽屉具备四面板高级配置（连接信息、缓存 PVC 共享、DinD Docker 守护进程调度、镜像仓库路由解析），DinD 策略对流水线容器化构建性能至关重要。

#### 4. 企业与定制信息 (Enterprise Branding)
* **品牌资产四槽位**：企业定制不仅是名称和简介，核心为四槽位 Base64 图标资产——登录页 Logo、浅色顶部导航 Logo、深色顶部导航 Logo、浏览器 Favicon；必须提供实时缩略图预览与重置机制。

#### 5. 工作台与卡片系统 (Dashboard Widgets)
* **有效卡片真理源**：官方后端工作台存储于 `GET/PUT/POST /api/aslan/system/dashboard/settings`，支持且仅支持 3 类微部件：
  1. `running_workflow` (当前运行中的工作流)
  2. `my_workflow` (常用/收藏工作流)
  3. `my_env` (我的环境，必须携带 `is_production: boolean` 传参区分生产与测试)
* **实时性保证**：工作台卡片必须引入 5 秒轻量定时轮询，实现构建/发布任务状态的无感自动刷新。

#### 6. 发布计划与日历视图 (Release Plan & Calendar)
* **视图切换与持久化**：支持 Segmented 列表（List）与日历（Calendar）无缝切换，偏好配置持久化至 `localStorage`。
* **按月范围查询**：日历视图必须带入当前月份起止的 Unix 秒级时间戳（`startTime` 与 `endTime`），并设置 `pageSize: 9999` 拉取整月计划，在 `<Calendar cellRender={...} />` 单元格内按状态（`planning`, `running`, `success`, `failed`）呈现徽标与抽屉联动。
* **接口路径契约**：计划立即/调度执行接口必须精准对齐 `/api/aslan/release_plan/v1/{id}/schedule_execute`。

#### 7. 用户管理与 RBAC 精细权限 (Users & RBAC)
* **用户即时授权**：调用 `POST /api/v1/users` 创建用户账号后，必须立即联动调用 `POST /api/v1/policy/role-bindings/user/{uid}?namespace=*` 绑定系统角色，防止产生无权限孤儿账号。
* **系统角色真理源与内置保护**：角色列表统一通过 `GET /api/v1/policy/roles?namespace=*` 获取；对于 `type === 'system'` 的内置角色（如 `admin`、`global-read-only`），前端必须禁用其“修改”和“删除”操作，防止破坏平台基础设施权限。

### 10.4 验证与防退化双门禁标准 (Anti-Regression & Verification Standards)
每次逆向代码重构提交前，必须顺序通过三道严格门禁：
1. **Ant Design 6.x CLI 静态语法检查**：
   ```bash
   npx antd lint ./frontend/src
   # 必须保持 0 errors, 0 warnings
   ```
2. **TypeScript 类型安全与 Vite 构建检查**：
   ```bash
   pnpm --dir frontend run build
   # 确保无 TS 报错且产物打包顺利输出
   ```
3. **Chrome DevTools MCP 真实浏览器验收**：
   * 在真实浏览器中打开目标路由，验证元素可见性、网络请求（Network）、控制台日志（Console 无 Red Error），并进行点击与表单提交操作，确保端到端功能闭环。



