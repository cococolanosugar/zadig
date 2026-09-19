## Why

在前期快速演进与界面对齐过程中，部分关键模块引入了乐观假动作（如 `setTimeout` 弹窗成功、假数据回退）以及未持久化的本地 React 状态，导致 DAG 画布保存失效、构建与测试无法真实触发、日志流未联通，且空数据时掩盖了真实后端状态。为了达成生产级交付可用标准，必须立即完成 P0 级关键链路持久化闭环，并推进 P1 级假数据与假动作的全面拔除，恢复以运行后端为唯一真理源的契约。

## What Changes

- **工作流与执行闭环 (P0)**：
  - 打通 DAG 编排画布保存：连接后端 `updateWorkflow` (PUT) 接口，使图形化编排阶段 (Stages) 与任务 (Jobs) 变更真正持久化入库。
  - 接入实时 SSE 任务日志流：将流水线执行详情页的控制台连接到 `/api/aslan/logs/sse/v4/workflow/*` 实时流，替换静态占位。
  - 构建任务真实触发：替换 `Builds.tsx` 中的 `setTimeout` 假动作，调用真实构建执行接口并跳转或展示执行记录。
  - 服务创建真实持久化：替换 `Services/index.tsx` 中的仅追加本地 state 操作，调用创建/导入服务 YAML 接口。
- **假数据与假动作全面拔除 (P1)**：
  - 协作迭代 (`Sprints.tsx`)：移除 `sprint-v1.0` 等编造数据 Fallback，移除失败时的乐观假成功提示，呈现真实空状态与错误提示。
  - 构建管理 (`Builds.tsx`)：移除硬编码构建条目回退，构建列表直连后端返回，支持真实执行触发。
  - 代码扫描 (`Scanners.tsx`)：移除 `sonar-check` / `ai-review` / `trivy-scan` 编造条目及硬编码 100% 统计卡片，真实展示扫描配置与扫描历史。
  - 质量与测试 (`Quality/index.tsx`)：移除硬编码“42秒”耗时与假“已触发自动化测试任务”提示，接入真实测试触发与统计。
  - 系统集成 (`Settings/Integration/index.tsx`)：移除空数据时的假“已连接”回退，将测试连接、保存、删除操作改造为真实的后端 API 调用与错误透传。

## Capabilities

### New Capabilities
- `workflow-execution-closure`: DAG 编排持久化、实时 SSE 日志流监听与构建执行真实化闭环。
- `service-build-delivery-closure`: 服务配置持久化创建与构建/环境核心生命周期真实调度。
- `mock-fallback-elimination`: 彻底拔除 Sprints、Builds、Scanners、Quality、Integration 中的假数据降级与假成功交互，保障真实错误暴露与标准空状态。

### Modified Capabilities
<!-- None: existing portal-layout-navigation requirements remain unchanged. -->

## Impact

- **前端影响组件**：
  - `frontend/src/pages/Pipelines/PipelineDetail/index.tsx`
  - `frontend/src/pages/Pipelines/PipelineExecution/index.tsx`
  - `frontend/src/pages/Projects/Builds.tsx`
  - `frontend/src/pages/Projects/Sprints.tsx`
  - `frontend/src/pages/Projects/Scanners.tsx`
  - `frontend/src/pages/Services/index.tsx`
  - `frontend/src/pages/Quality/index.tsx`
  - `frontend/src/pages/Settings/Integration/index.tsx`
- **后端通信接口**：
  - `PUT /api/aslan/workflow/v4/{workflow_name}` (DAG 保存)
  - `GET /api/aslan/logs/sse/v4/workflow/{workflow_name}/task/{task_id}` (实时 SSE 日志)
  - `POST /api/aslan/build/{name}` / `POST /api/aslan/build/job` (构建执行)
  - `POST /api/aslan/service/template` / `POST /api/aslan/service/yaml` (服务创建)
  - `GET/POST/PUT/DELETE /api/aslan/system/integration/*` (系统集成真实调用)
