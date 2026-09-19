## Context

Zadig's backend exposes modular microservices (`aslan`, `user`, `systemconfig`) communicating over RESTful HTTP, Server-Sent Events (SSE) for task and container logs, and WebSocket for Pod interactive shell executions. See `proposal.md` for motivation. The frontend reconstruction (`zadig-portal-next`) must integrate with the existing backend without modifying backend endpoints or database schemas, while using the actual running system (`http://192.168.31.174:8380`) as the single source of truth for visual layout and functional behavior.

## Goals / Non-Goals

**Goals:**
- Deliver a clean, production-ready frontend using React 18, TypeScript 5, Ant Design 6, and ProComponents v3.
- Faithfully replicate real-world Zadig workflows: dynamic RSA/AES envelope authentication, project switching, custom workflow V4 DAG orchestration, K8s YAML editing, Pod terminal execution, and delivery insight dashboards.
- Eliminate legacy Vue 2 boilerplate by utilizing `ProTable`, `ProForm`, `StepsForm`, and `ProLayout`.
- Provide complete TypeScript type safety across all API request and response models.

**Non-Goals:**
- Modify backend Go code or database schemas.
- Re-architect backend authentication protocols; the client must conform to the backend's existing RSA public key exchange and AES-CFB decryption pipeline.
- Implement deprecated v1 legacy workflow modes; focus on modern Custom Workflow V4 and standard Product workflows present on the live site.

## Decisions

### Decision 1: Build Tooling and Foundation — Vite 6 + React 18 + TypeScript
- **Choice**: Vite 6 with `@vitejs/plugin-react` and TypeScript.
- **Rationale**: Instant cold start, lightning-fast HMR during component refactoring, simple proxy configuration to `http://192.168.31.174:8380`, and clean tree-shaking for enterprise bundle sizes.
- **Alternatives considered**:
  - *Webpack*: Slower HMR and build times; already a bottleneck in the legacy `zadig-portal`.
  - *Next.js / Remix*: Unnecessary SSR complexity for an internal DevOps portal that requires client-side WebSocket and terminal persistence.

### Decision 2: UI Design System — Ant Design 6.x + ProComponents 3.x
- **Choice**: `antd@6.6.x` and `@ant-design/pro-components@3.1.x`.
- **Rationale**:
  - Ant Design 6 features optimized CSS-in-JS performance and complete Design Token customizability, perfectly matching Zadig's cloud-native enterprise aesthetics.
  - ProComponents v3 brings `ProLayout` (nested project menus, breadcrumbs, user avatars), `ProTable` (automatic pagination, search forms, and batch toolbars), and `StepsForm` (project creation wizards), reducing UI boilerplate by over 30%.
  - Top-level wrapping with `<ConfigProvider>` and `<App>` ensures message and modal dialogs remain reactive and theme-consistent.
- **Alternatives considered**:
  - *Ant Design 5*: Viable, but antd 6 represents the latest active standard with improved token runtime performance and React 19 compatibility.

### Decision 3: Authentication Protocol — Client-Side RSA+AES Envelope Encryption
- **Choice**: Dynamic dual-cipher envelope encryption using `node-forge` (RSA PKCS#1 v1.5) and `aes-js` (AES-128-CFB).
- **Rationale**: The live Zadig backend rejects plaintext login requests with `encrypted_key is required`. Before sending credentials to `/api/v1/login`, the client queries `/api/aslan/system/rsaKey/publicKey`, generates a random 32-character AES key, encrypts the password with AES-CFB using the AES key and a 16-byte random IV, encrypts the AES key with the RSA public key, and sends both as `password` (hex) and `encrypted_key` (url-encoded base64).
- **Alternatives considered**:
  - *Plain text with HTTPS*: Incompatible with existing backend verification in `pkg/microservice/user/core/service/login/local.go`.

### Decision 4: Cloud-Native Code & YAML Editing — Monaco Editor
- **Choice**: `@monaco-editor/react` with VS Code's editor engine.
- **Rationale**: Provides native YAML syntax checking, multi-document navigation, side-by-side diffing (`DiffEditor`), line-number folding, and variable auto-completion, far outperforming the legacy CodeMirror setup.
- **Alternatives considered**:
  - *CodeMirror 6*: Smaller bundle size, but lacks the out-of-the-box diffing and enterprise YAML diagnostics of Monaco Editor.

### Decision 5: Workflow V4 DAG Orchestration — React Flow (`@xyflow/react`)
- **Choice**: React Flow (`@xyflow/react`).
- **Rationale**: Declarative node-edge graph architecture, smooth canvas panning/zooming, custom React node components (for Stage, Job, Step with status indicators), and robust DAG validation.
- **Alternatives considered**:
  - *AntV X6*: Strong candidate, but React Flow provides a more idiomatic React hooks API and simpler custom DOM node lifecycle.
  - *HTML Drag-and-Drop / vuedraggable*: The old legacy approach that led to fragile line calculations and limited visual scalability.

### Decision 6: Pod Terminal & Real-Time Log Streaming — xterm.js + EventSource
- **Choice**: `@xterm/xterm` with `@xterm/addon-fit` for interactive shell; standard SSE / fetch chunked reading for task logs.
- **Rationale**:
  - Web terminal requires true ANSI terminal emulation, resize event propagation (`fitAddon`), and bidirectional WebSocket streaming to Kubernetes pod exec proxies.
  - Build and deploy logs stream via chunked HTTP or SSE from Aslan; rendering them in an optimized terminal canvas prevents DOM thrashing during massive log outputs.

### Decision 7: Data Insights & Analytics — Ant Design Charts (`@ant-design/plots`)
- **Choice**: `@ant-design/plots` (AntV G2 5.x).
- **Rationale**: Declarative chart definitions that automatically inherit Ant Design 6 theme tokens (palette, typography, tooltips) with out-of-the-box responsive resizing. Replaces legacy ECharts configurations seamlessly.

## Risks / Trade-offs

- **[Risk] Complex Workflow V4 state schema**: Workflow V4 contains extensive job types (build, deploy, custom script, approval, scan) with interdependent parameter schemas.
  → *Mitigation*: Model strict TypeScript interfaces for all Workflow V4 models derived from Aslan's `job.go` definitions, with schema-driven form generation per job type.
- **[Risk] High-throughput build log rendering**: Large builds can emit tens of thousands of log lines, potentially freezing the browser tab.
  → *Mitigation*: Leverage xterm.js buffer throttling and virtualized list rendering instead of raw DOM element appending.
- **[Risk] Dynamic project permission matrices**: Zadig RBAC enforces project-level and system-level action bindings.
  → *Mitigation*: Create a central authorization context (`useAuthz` hook) caching `role_binding` permissions to conditionally render action buttons and protected routes.

## Migration Plan

1. **Phase 1: Project Scaffolding & Core Auth**: Establish Vite, Ant Design 6, ProLayout, and RSA/AES login against the live server.
2. **Phase 2: System Settings & Workspace Management**: Deliver Clusters, Registries, Codehosts, Storage, and User/Role tables with `ProTable`.
3. **Phase 3: Services & Environments**: Implement Monaco YAML editor, environment pod status list, and interactive xterm.js pod exec shell.
4. **Phase 4: Workflow DAG & Task Execution**: Implement React Flow DAG pipeline editor and real-time execution log viewer.
5. **Phase 5: Insights & Final Polish**: Integrate Ant Design Charts for delivery analytics and conduct end-to-end regression against `http://192.168.31.174:8380`.
