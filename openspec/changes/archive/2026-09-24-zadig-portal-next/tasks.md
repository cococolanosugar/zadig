## 1. Project Scaffolding & Infrastructure

- [x] 1.1 Initialize Vite + React 18 + TypeScript project structure in `frontend/` and verify clean build with `npm run build`
- [x] 1.2 Install Ant Design 6.x (`antd`), `@ant-design/icons`, `@ant-design/pro-components` v3, and configure `<ConfigProvider>` and `<App>` with Zadig brand tokens
- [x] 1.3 Implement cryptographic utilities for RSA PKCS#1 v1.5 and AES-128-CFB and verify encryption output against backend decryption requirements
- [x] 1.4 Implement Axios HTTP client with Bearer token interceptor, error notifications, and Vite reverse proxy configured for `http://192.168.31.174:8380`
- [x] 1.5 Implement Login page with dynamic RSA public key retrieval (`/api/aslan/system/rsaKey/publicKey`), captcha fallback, and verify successful login with `admin@qq.com`

## 2. Global Layout & Workbench

- [x] 2.1 Implement `ProLayout` shell with global header, collapsible sidebar navigation, breadcrumbs, user profile dropdown, and verify smooth route switching
- [x] 2.2 Implement project context switcher and persistent project selection state in Zustand store
- [x] 2.3 Implement Workbench / Dashboard page with favorite projects, recent workflow runs, and quick action cards

## 3. System Settings & Integration Management

- [x] 3.1 Implement Kubernetes Clusters management with `ProTable` and modal form for kubeconfig and agent registration, verifying cluster list rendering
- [x] 3.2 Implement Code Host integration management with `ProTable` and OAuth/token configuration forms for GitHub, GitLab, and Gitee
- [x] 3.3 Implement Image Registry and Object Storage integration views using `ProTable` and test-connection actions
- [x] 3.4 Implement User, User Group, and RBAC Role Binding management with `ProTable` and DrawerForm permission assignment

## 4. Cloud-Native Services & Environment Management

- [x] 4.1 Implement Monaco Editor integration (`@monaco-editor/react`) for multi-service Kubernetes YAML editing with syntax validation and formatting
- [x] 4.2 Implement Helm Values editor and DiffEditor component for inspecting side-by-side version changes
- [x] 4.3 Implement Environment overview and workload Pod list with color-coded status badges, restart counts, and replica scaling controls
- [x] 4.4 Implement interactive Pod Web Terminal using `@xterm/xterm` and `@xterm/addon-fit` connected to the backend pod exec WebSocket
- [x] 4.5 Implement live container log drawer streaming logs via SSE/chunked response with ANSI color decoding and autoscroll

## 5. Workflow V4 Orchestration & Execution Engine

- [x] 5.1 Implement custom Workflow V4 DAG canvas using React Flow (`@xyflow/react`) supporting Stage, Job, and Step visual nodes and dependency lines
- [x] 5.2 Implement Job configuration drawer forms for Build, Deploy, Test, and Custom Script job types
- [x] 5.3 Implement workflow execution trigger modal with dynamic Git branch, image tag, and runtime variable inputs
- [x] 5.4 Implement Workflow Task execution detail view with live DAG stage progress updates and streaming step console logs

## 6. Delivery Insights & Production Verification

- [x] 6.1 Implement Build, Test, and Deployment insight charts using `@ant-design/plots` (dual-axis trends, duration distributions, and success rate pies)
- [x] 6.2 Implement Data Overview / Statistics dashboard with deployment activity heatmaps and metrics summary cards
- [x] 6.3 Perform end-to-end regression testing against live backend (`http://192.168.31.174:8380`) verifying full navigation, auth, YAML editing, DAG execution, and responsive layout
