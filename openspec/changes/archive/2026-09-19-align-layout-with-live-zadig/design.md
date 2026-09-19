# Design: Align Portal Next Layout and Navigation with Live Zadig

## Context

See `proposal.md` for background and motivation. The frontend application currently runs on Vite + React 18 + Ant Design 6.x + ProComponents 3.x, communicating with the live backend at `http://192.168.31.174:8380`. The existing layout must transition from a generic flat template to Zadig's domain-oriented architecture and project-scoped navigation model.

## Goals / Non-Goals

**Goals:**
- Exactly replicate the layout, sidebar organization, header tools, and visual hierarchy of `http://192.168.31.174:8380/`.
- Restructure navigation into the 4 primary domain groups: `产品交付`, `发布管理`, `资产管理`, and `数据视图`.
- Implement project workspace isolation via `ProjectDetailLayout` with secondary tabs (`迭代管理`, `工作流`, `环境`, `服务配置`, `构建`, `测试`, `代码审查`, `版本管理`).
- Provide the top system broadcast alert banner and 6 standard utility actions in the header.
- Maintain Ant Design 6.x compliance with 0 deprecated APIs and 0 lint warnings.

**Non-Goals:**
- Changing backend Go microservices or rewriting proxy configurations.
- Modifying underlying business logic in existing services or environment components.

## Decisions

### 1. Global Navigation & Sidebar Domain Structure
- **Decision**: Configure ProLayout with custom `menuDataRender` and custom `menuHeaderRender` to reflect Zadig's domain model.
  - **Brand Section**: Red brand icon + uppercase bold `ZADIG` + primary `+ 添加` button directly beneath the brand.
  - **Domains**:
    - `产品交付`: 运行状态 (`/v1/status`), 项目 (`/v1/projects`)
    - `发布管理`: 工作流 (`/v1/releaseWorkflow`), 发布计划 (`/v1/releasePlan`), 客户交付 (`/v1/plutus`)
    - `资产管理`: 业务目录 (`/v1/directory`), 模板库 (`/v1/template`), 质量中心 (`/v1/tests`), 制品管理 (`/v1/delivery`), 资源配置 (`/v1/resource`)
    - `数据视图`: 数据概览 (`/v1/statistics`), 效能洞察 (`/v1/insight`)
  - **Pinned Bottom**: 系统设置 (`/v1/system/config` or `/v1/system/clusters`), 企业管理 (`/v1/enterprise`).
- **Alternative considered**: Plain CSS sidebar without ProLayout. Rejected because ProLayout provides built-in responsive breakpoints, collapse animation, and token synchronization.

### 2. Project Workspace & Secondary Horizontal Sub-Navigation
- **Decision**: Introduce `ProjectDetailLayout.tsx` as a nested route wrapper for `/v1/projects/detail/:projectName/*`.
  - Displays a persistent horizontal tab bar underneath the header:
    `[ 迭代管理 | 工作流 | 环境 | 服务配置 | 构建 | 测试 | 代码审查 | 版本管理 ]`
  - Re-routes project-scoped features (e.g. Services, Environments, Builds) into `/v1/projects/detail/:projectName/services`, `/v1/projects/detail/:projectName/envs`, etc., while maintaining backwards compatibility redirects.
- **Alternative considered**: Keeping services and environments as global top-level pages with a project dropdown. Rejected because it directly violates Zadig's architectural model where services and environments belong strictly inside a project context.

### 3. Top Header, System Banner & Utility Actions
- **Decision**: Render a system-wide dismissible Alert banner above the layout container.
  - Left Header: Render dynamic Ant Design `Breadcrumb` based on current path and active project.
  - Right Header: 6 standardized action buttons:
    1. CLI Download Popover (`git-zadig` binaries)
    2. Language toggle button (`中 / EN`)
    3. Community / WeChat group link
    4. Help Documentation drawer/popover
    5. Notifications icon (`Badge` + `BellOutlined`)
    6. User Profile Dropdown (`Avatar` + `Dropdown` menu with Admin, Settings, Signout)

### 4. Split-Screen Signin Page
- **Decision**: Redesign `src/pages/Login/index.tsx` (and support `/signin` path):
  - Left section: Ant Design `Carousel` showing Zadig's 6 core value propositions (Workflow, Environments, Tests, Templates, Insights, AI).
  - Right section: Clean white authentication card with envelope crypto pipeline.

### 5. Dashboard Card Stream Layout
- **Decision**: Refactor `src/pages/Dashboard/index.tsx` to match live Zadig:
  - Top action: `+ 添加卡片` (Add Card button).
  - Card: `运行中的工作流` table (Columns: 工作流名称, 执行者, 创建时间).

## Risks / Trade-offs

- **[Risk] Deep nested routes for project details**: `/v1/projects/detail/:projectName/envs` may break direct bookmarks to old `/v1/envs`.
  → **Mitigation**: Add redirect routes in `AppRouter` mapping `/v1/services` and `/v1/envs` to the last selected or default project workspace.
- **[Risk] ProLayout menu folding compatibility with custom pinned bottom items**:
  → **Mitigation**: Use ProLayout's `menuFooterRender` with token-based styling so pinned items collapse cleanly into icons when collapsed is true.
