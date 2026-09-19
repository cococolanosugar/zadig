# Proposal: Align Portal Next Layout and Navigation with Live Zadig

## Why

Although the initial `zadig-portal-next` implementation established the React 18 + Ant Design 6 foundation with envelope encryption and working API clients, its layout and navigation hierarchy defaulted to a generic Ant Design Pro template. Direct inspection of the live Zadig deployment (`http://192.168.31.174:8380`) reveals significant structural discrepancies:
1. The global sidebar in live Zadig organizes features into 4 core business domains (`产品交付`, `发布管理`, `资产管理`, `数据视图`) with a red brand logo, a top `+ 添加` quick action button, and fixed bottom entries (`系统设置`, `企业管理`).
2. Live Zadig enforces a strict project-scoped workspace hierarchy: services, environments, builds, and workflows belong under specific projects (`/v1/projects/detail/:projectName/*`) accessible through a project-scoped secondary horizontal sub-navigation bar, rather than being flattened into global top-level menus.
3. The top Header contains dynamic breadcrumbs, a system-wide dismissible alert banner, and 6 standardized developer utility actions.
4. The Signin page employs a two-column split layout with a 6-feature carousel and an authenticated card.

Aligning the layout with `http://192.168.31.174:8380` is required to ensure 100% architectural and behavioral fidelity to the genuine Zadig user experience.

## What Changes

- **Global Sidebar Architecture**:
  - Replace the flat menu with Zadig's 4 business domains: `产品交付` (`运行状态`, `项目`), `发布管理` (`工作流`, `发布计划`, `客户交付`), `资产管理` (`业务目录`, `模板库`, `质量中心`, `制品管理`, `资源配置`), and `数据视图` (`数据概览`, `效能洞察`).
  - Introduce the top brand header with red Z logo, uppercase `ZADIG` typography, and the prominent `+ 添加` primary action button.
  - Add fixed bottom pinned navigation items for `系统设置` and `企业管理`.
  - Add collapsible floating `<` capsule toggle button.
- **Top Header & System Notification**:
  - Add dismissible system broadcast banner at the very top (e.g. SMTP server configuration reminder).
  - Replace static logo in header with dynamic breadcrumbs and current view title.
  - Add 6 standardized utility actions on the right: CLI Download dropdown, Language switcher (ZH/EN), Community link, Documentation quick links, Notification bell, and User profile avatar menu.
- **Project Detail Workspace & Secondary Sub-Navigation**:
  - Introduce `ProjectDetailLayout` for `/v1/projects/detail/:projectName/*`.
  - Render the horizontal secondary navigation tabs: `迭代管理`, `工作流`, `环境`, `服务配置`, `构建`, `测试`, `代码审查`, `版本管理`.
  - Move service management and environment workloads into the project context.
- **Dashboard & Signin Pages**:
  - Redesign Dashboard to match live Zadig's widget card-stream layout with `+ 添加卡片` and `运行中的工作流` table widget.
  - Redesign Signin page to match live Zadig's split-screen layout with left capability showcase carousel and right login card.

## Capabilities

### New Capabilities
- `portal-layout-navigation`: Covers the complete alignment of global sidebar, top header, system banner, project-scoped secondary sub-navigation, and route hierarchy with the live Zadig environment (`http://192.168.31.174:8380`).

## Impact

- **Affected Files**:
  - `frontend/src/layouts/BasicLayout.tsx`: Full overhaul of sidebar structure, header tools, and brand bar.
  - `frontend/src/layouts/ProjectDetailLayout.tsx`: New component providing project-scoped horizontal secondary tabs.
  - `frontend/src/router/index.tsx`: Update route mappings to match `/signin`, `/v1/projects/detail/:projectName/*`, and domain paths.
  - `frontend/src/pages/Dashboard/index.tsx`: Widget card-stream restructuring.
  - `frontend/src/pages/Login/index.tsx`: Two-column carousel login redesign.
- **Dependencies & Backend**:
  - No backend API modifications needed (all REST endpoints continue to proxy to `http://192.168.31.174:8380`).
  - Maintains strict Ant Design 6.x token system and `@ant-design/icons`.
