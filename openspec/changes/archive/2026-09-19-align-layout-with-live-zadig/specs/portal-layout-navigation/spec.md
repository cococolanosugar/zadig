## Purpose

Provides a responsive layout, navigation hierarchy, and workspace routing architecture fully aligned with the live Zadig continuous delivery platform.

## ADDED Requirements

### Requirement: Four-Domain Global Sidebar Navigation
The system SHALL organize global navigation items into four collapsible business domain groups: 产品交付 (Product Delivery), 发布管理 (Release Management), 资产管理 (Asset Management), and 数据视图 (Data Insights), accompanied by a brand header and fixed bottom entries.

#### Scenario: Navigating via domain menu items
- **WHEN** the user views the left sidebar
- **THEN** the sidebar displays the red ZADIG brand, a primary "+ 添加" button, the four domain menu groups with expandable sub-items, and fixed bottom links for "系统设置" and "企业管理"

#### Scenario: Quick action creation modal
- **WHEN** the user clicks the primary "+ 添加" button at the top of the sidebar
- **THEN** the system presents a quick-action popup allowing immediate creation of projects, workflows, or environments

### Requirement: Project-Scoped Workspace Sub-Navigation
The system SHALL display a horizontal secondary sub-navigation bar when the user accesses a specific project workspace (`/v1/projects/detail/:projectName/*`), scoping services, environments, pipelines, builds, tests, code scanning, and versioning to the active project.

#### Scenario: Entering project workspace
- **WHEN** the user enters a project detail page at `/v1/projects/detail/:projectName`
- **THEN** the system renders the secondary navigation bar with tabs for 迭代管理, 工作流, 环境, 服务配置, 构建, 测试, 代码审查, and 版本管理, updating the content area according to the active tab

#### Scenario: Switching tabs within a project
- **WHEN** the user clicks the "环境" tab on `/v1/projects/detail/:projectName`
- **THEN** the URL updates to `/v1/projects/detail/:projectName/envs` and displays the environment workloads specific to `:projectName`

### Requirement: Standardized Top Header and Alert Banner
The system SHALL provide a dismissible system notification banner at the top of the viewport and a header bar displaying dynamic breadcrumbs and six standard utility actions.

#### Scenario: Viewing top header utility actions
- **WHEN** an authenticated user views any page in the portal
- **THEN** the header displays the current breadcrumb path on the left and utility actions on the right: CLI Download, Language Switcher, Community Link, Documentation Quick Links, Notification Center, and User Profile dropdown

#### Scenario: Dismissing the top alert banner
- **WHEN** the user clicks the close icon on the system alert banner
- **THEN** the banner is dismissed and hidden from the current session

### Requirement: Widget-Based Dashboard Workspace
The system SHALL render the dashboard page with customizable workflow cards, an execution table widget ("运行中的工作流"), and a card creation button ("+ 添加卡片").

#### Scenario: Viewing running workflow tasks
- **WHEN** the user lands on `/v1/dashboard`
- **THEN** the system displays the "运行中的工作流" card with columns for 工作流名称, 执行者, and 创建时间, and an empty placeholder if no executions exist

### Requirement: Split-Screen Authentication Interface
The system SHALL render the signin page (`/signin`) using a split-screen layout featuring a product capability showcase carousel on the left and the encrypted envelope credentials form on the right.

#### Scenario: Rendering the signin page
- **WHEN** an unauthenticated user visits `/signin` or `/login`
- **THEN** the page displays the left-side feature carousel highlighting Zadig's core competencies and the right-side clean form card for username and password entry
