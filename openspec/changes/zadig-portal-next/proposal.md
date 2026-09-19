## Why

Zadig's existing frontend (`zadig-portal`) is built on a legacy Vue 2.6 and Element-UI 2.15 architecture that lacks TypeScript typings, modern state management, and modern component primitives. Furthermore, the local repository contains only early/partial source code, whereas the real production system (e.g. `http://192.168.31.174:8380`) runs an advanced version with dynamic RSA/AES envelope authentication, Custom Workflow V4 DAG orchestration, and extensive cloud-native features.

Rebuilding the web portal with React 18+, Ant Design 6.x, and ProComponents v3.x (`zadig-portal-next`) provides a unified enterprise design language, drastically reduces CRUD and form boilerplate, leverages Monaco Editor for robust K8s YAML editing, and replaces ad-hoc DAG logic with React Flow while strictly integrating with the existing Zadig backend APIs.

## What Changes

- **New Modern Frontend Scaffolding (`zadig-portal-next`)**: Setup a Vite + React 18/19 + TypeScript + Ant Design 6 + ProComponents v3 web application.
- **Enterprise Layout & Authentication**:
  - Implement full ProLayout with global topbar, dynamic sidebar, project switcher, and breadcrumbs.
  - Implement backend-compatible login with RSA dynamic public key retrieval and AES-CFB password encryption envelope.
  - Manage JWT tokens, refresh flows, and user profile cache.
- **Cloud-Native Service & Environment Management**:
  - Integrate Monaco Editor for multi-service Kubernetes YAML, Helm values, and template variable editing.
  - Implement Environment and Pod management with live status badges, scaling, and container restart.
  - Embed xterm.js with WebSocket for interactive pod exec web terminal and SSE streaming for container logs.
- **Workflow V4 Orchestration & Real-time Task Execution**:
  - Build a declarative DAG canvas using React Flow (`@xyflow/react`) for Stage -> Job -> Step pipelines.
  - Provide task triggering modal with dynamic parameter injection and artifact selections.
  - Provide real-time task execution detail view with ANSI-colored streaming logs via SSE.
- **Insights, Analytics & System Management**:
  - Implement data statistics and performance insights using `@ant-design/plots` (AntV G2 5.x) charts.
  - Implement ProTable and DrawerForm/ModalForm based management for Clusters, Code Hosts, Image Registries, Object Storage, and Users/Roles RBAC.

## Capabilities

### New Capabilities
- `portal-core`: Base architecture, Ant Design 6 theme tokens, ProLayout navigation, dynamic RSA/AES authentication, and HTTP/SSE/WebSocket client infrastructure.
- `portal-service-env`: Kubernetes service configuration (Monaco Editor), Helm values editing, and environment/pod monitoring with xterm.js interactive shell.
- `portal-workflow`: Custom Workflow V4 DAG editor, pipeline run triggers, and real-time step execution log streaming.
- `portal-insight-settings`: Delivery performance dashboards with `@ant-design/plots` and system configuration/RBAC user management with ProTable.

### Modified Capabilities
<!-- None: Greenfield frontend rewrite against existing unchanged backend APIs -->

## Impact

- **Affected Code**: Creates new frontend directory `frontend/` without modifying existing backend services (`aslan`, `user`, `systemconfig`).
- **Dependencies**: Introduces React 18+, `antd` 6.x, `@ant-design/pro-components` 3.x, `@ant-design/plots` 2.x, `@xyflow/react`, `@monaco-editor/react`, `@xterm/xterm`, `axios`, `zustand`.
- **Backend Compatibility**: 100% backward-compatible with Zadig backend REST endpoints, SSE log streams, and WebSocket pod exec proxies.
