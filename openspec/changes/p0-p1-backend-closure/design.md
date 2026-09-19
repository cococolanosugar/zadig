## Context

See `proposal.md` for motivation. Currently, `frontend/` is an Ant Design 6 + React 18 SPA interfacing with the live Aslan backend at `http://192.168.31.174:8380` via Vite reverse proxy. While layouts and route hierarchies are ~90% aligned, several business pages use client-side mock fallbacks (`sprint-v1.0`, `sonar-check`, hardcoded metrics) or synthetic `setTimeout` operations. Furthermore, critical mutations (DAG canvas save, service creation) only manipulate in-memory React state, and task execution logs lack the real SSE stream connection.

## Goals / Non-Goals

**Goals:**
- **P0 Delivery Closure**:
  - Persist workflow DAG configurations to backend via `workflowApi.updateWorkflow(name, payload)`.
  - Connect task execution terminal to `/api/aslan/logs/sse/v4/workflow/:workflowName/:taskId/:jobName/:lines` via Server-Sent Events.
  - Connect service creation to `POST /api/aslan/service/services` with real server template initialization and tree refresh.
  - Connect build triggering to real workflow/build execution dispatch.
- **P1 Mock Eradication & Truthful Feedback**:
  - Eliminate mock fallback arrays from `Sprints.tsx`, `Builds.tsx`, `Scanners.tsx`, `Quality/index.tsx`, and `Settings/Integration/index.tsx`.
  - Standardize empty state rendering using Ant Design `<Empty />` with primary creation CTA buttons.
  - Eliminate fake success toasts in `catch` blocks; faithfully propagate backend error messages to users.

**Non-Goals:**
- Compatibility with legacy Workflow V2/V3 (the target v5.0 platform is exclusively Workflow V4).
- Implementation of micro-frontend plugin runtime (`/v1/plugin/*`) or mobile tree (`/mobile`).
- Third-party SSO providers (OAuth, LDAP, Feishu) requiring external IdP configuration.

## Decisions

### 1. Workflow DAG Persistence Architecture
- **Approach**: In `WorkflowCanvas.tsx`, change `onSave` to be an asynchronous callback that passes the updated `WorkflowV4Item` back to `PipelinesPage`. In `PipelinesPage`, `handleSaveWorkflow` calls `workflowApi.updateWorkflow(updated.name, updated)`.
- **Loading & Error Handling**: During save, show button loading status. On error, display backend notification error message, but keep the modified canvas state intact so the user does not lose their configuration.
- **Alternative considered**: Direct API call inside `WorkflowCanvas`. Rejected to keep `WorkflowCanvas` decoupled from route-level project stores and reusable across detail and wizard pages.

### 2. Live SSE Task Log Streaming
- **Approach**: Leverage the existing `LogViewer` component which already has `FitAddon` and `EventSource` support.
- **Endpoint**: Compute the stream URL as:
  `/api/aslan/logs/sse/v4/workflow/${workflowName}/${taskId}/${selectedJob}/1000`
- **Dynamic Switching**: When the user clicks different job tabs (`selectedJob`) in `PipelineExecutionPage`, the stream URL updates, cleanly closing the previous `EventSource` and opening the stream for the selected job.
- **Alternative considered**: Polling REST logs every 2 seconds. Rejected because backend Aslan natively provides the SSE streaming endpoint for real-time output.

### 3. Service Creation Protocol
- **Approach**: In `Services/index.tsx`, update `handleCreateService` to issue `POST /api/aslan/service/services` with:
  ```json
  {
    "product_name": activeProject,
    "service_name": newServiceName,
    "source": "spock",
    "type": "k8s",
    "visibility": "private",
    "yaml": defaultServiceYaml
  }
  ```
- Upon success, trigger `loadServices()` to fetch the real service list from the backend and select the newly created service.

### 4. Eradication of "Fallback-to-Mock" Anti-pattern
- **Rule**: When API returns an empty array `[]` or throws 404/500, never populate fake mock items (`sprint-v1.0`, `sonar-check`, `${projectName}-backend-build`).
- **Rendering**: Render antd `<Empty description="..." />` styled consistently with action buttons to create new items.
- **Error Transparency**: In all `catch` blocks, use `feedback.message.error(...)` or let the HTTP interceptor handle error presentation. Never output `feedback.message.success` on failure.

## Risks / Trade-offs

- **[Risk] Empty projects may look sparse compared to demo mock cards**  
  → *Mitigation*: Design helpful `<Empty />` components with clear onboarding explanations and direct "+ 新建" primary buttons.
- **[Risk] Aslan backend SSE stream drops or closes when task completes**  
  → *Mitigation*: `LogViewer` handles `onerror` by displaying `[Stream Ended]` gracefully and closing the event source without throwing unhandled exceptions.
- **[Risk] Workflow job names may not match default selected job**  
  → *Mitigation*: In `PipelineExecutionPage`, initialize `selectedJob` from the first job in the first stage of `task.stages` dynamically rather than hardcoding `'build-job'`.
