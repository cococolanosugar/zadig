# Tasks: Align Portal Next Layout and Navigation with Live Zadig

## 1. Global Sidebar & Brand Overhaul

- [x] 1.1 Overhaul brand header in `frontend/src/layouts/BasicLayout.tsx` with the red Z logo, uppercase `ZADIG` typography, and the primary `+ 添加` quick action button, and verify visual rendering.
- [x] 1.2 Restructure sidebar menu into the four domain groups (`产品交付`, `发布管理`, `资产管理`, `数据视图`) with their respective sub-items and pinned bottom links (`系统设置`, `企业管理`), and verify route links.
- [x] 1.3 Add floating capsule collapse toggle button `<` on sidebar border with animated state changes and verify expanded and collapsed states.

## 2. Top Header & System Notification Banner

- [x] 2.1 Implement dismissible top broadcast alert banner for system notifications in `BasicLayout.tsx` and verify dismiss behavior.
- [x] 2.2 Add dynamic breadcrumb navigation bar displaying current page title and route path hierarchy in the header, and verify route changes update the breadcrumb.
- [x] 2.3 Implement the 6 standard header utility actions (CLI Download popover, Language switcher, Community link, Documentation quick links, Notification center, and User Profile dropdown with admin/settings/logout), and verify interactive menus.

## 3. Project Detail Workspace & Sub-Navigation

- [x] 3.1 Create `frontend/src/layouts/ProjectDetailLayout.tsx` with the horizontal secondary sub-navigation tab bar (`迭代管理`, `工作流`, `环境`, `服务配置`, `构建`, `测试`, `代码审查`, `版本管理`), and verify active tab styling.
- [x] 3.2 Update `frontend/src/router/index.tsx` to nest `/v1/projects/detail/:projectName/*` routes inside `ProjectDetailLayout` with fallback redirects from legacy flat routes, and verify browser navigation.
- [x] 3.3 Scope service management (`/services`) and environment workloads (`/envs`) directly inside the active project workspace context, and verify project data isolation.

## 4. Dashboard & Signin Pages Alignment

- [x] 4.1 Redesign `frontend/src/pages/Dashboard/index.tsx` to adopt the widget card-stream layout with `+ 添加卡片` header button and `运行中的工作流` execution table widget, and verify data fetching.
- [x] 4.2 Redesign `frontend/src/pages/Login/index.tsx` (supporting both `/signin` and `/login`) with split-screen layout featuring a left-side 6-card capability carousel and right-side login card, and verify envelope login flow.

## 5. Quality, Lint & Browser Verification

- [x] 5.1 Run `antd lint ./src` and verify 0 warnings and 0 deprecated APIs.
- [x] 5.2 Run `pnpm run build` and verify clean TypeScript compilation and production bundle build with zero errors.
- [x] 5.3 Validate full application flow in Chrome DevTools against `http://192.168.31.174:8380` and verify zero console errors and 100% 200 OK network responses.
