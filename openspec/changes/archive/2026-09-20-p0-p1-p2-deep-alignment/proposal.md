## Why

While core workflow DAG persistence and build execution are now real, critical user workflows in environment lifecycle management (creation wizard and replica scaling), release orchestration (release plans and delivery versioning), and operational observability (statistics and delivery insights) remain disconnected from the backend Aslan engine or rely on static dummy charts. This change addresses remaining P0, P1, and P2 functional gaps identified in the review report to deliver an authentic, end-to-end cloud-native continuous delivery experience.

## What Changes

- **P0: Environment Lifecycle & Scaling**:
  - Implement a dedicated multi-step environment creation wizard route (`/envs/create`) supporting K8s cluster selection, namespace configuration, workload selection, and variable resolution.
  - Wire genuine workload replica scaling directly to `PUT /api/aslan/environment/environments/:envName/workloads/scale`.
- **P1: Release & Delivery Pipeline**:
  - Connect the Release Plan page (`/v1/releasePlan`) to `/api/aslan/release_plan/v1/*`, supporting calendar tracking, milestone inspection, and status management.
  - Implement genuine version creation and artifact lineage flow on the Delivery page (`/v1/delivery`) calling `/api/aslan/delivery/releases` and `/api/aslan/delivery/artifacts`.
- **P2: Operational Analytics & Insights**:
  - Connect the Statistics page (`/v1/statistics`) to `/api/aslan/stat/*` to render live cluster CPU/memory utilization, pipeline metrics, and deployment activity.
  - Wire time-range filtering (`7d`, `30d`, `90d`) and live metrics on the Delivery Insights page (`/v1/insight`) to backend observability APIs.
  - Wire Profile security operations (`/v1/profile`) to authentic password update and user API token rotation endpoints.

## Capabilities

### New Capabilities
- `environment-lifecycle-management`: Multi-step environment creation wizard and real-time workload replica scaling for project environments.
- `release-delivery-orchestration`: Release plan calendar tracking, milestone management, and end-to-end artifact delivery release versioning.
- `analytics-insights-observability`: Live operational metrics, cluster resource utilization reporting, and time-scoped delivery performance analytics.

### Modified Capabilities

None.

## Impact

- **Frontend Routes**: Adds dedicated environment wizard page component at `/v1/projects/detail/:projectName/envs/create`.
- **Frontend Pages**: Refactors `Environments/index.tsx`, `ReleasePlan/index.tsx`, `Delivery/index.tsx`, `Statistics/index.tsx`, `Insights/index.tsx`, and `Profile/index.tsx`.
- **API Services**: Introduces typed API callers for release planning, delivery release tracking, and system statistics under `frontend/src/api/`.
- **Dependencies**: Reuses existing `@ant-design/plots`, Axios client, and Ant Design 6 components.
