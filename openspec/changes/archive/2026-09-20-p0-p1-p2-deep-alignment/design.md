## Context

See `proposal.md` for motivation. Following the initial P0/P1 delivery closure, several secondary pages still exhibit architectural gaps:
1. Environment creation was never mapped to a distinct view; it fell back to the environment table.
2. Workload scaling modal only executed local toasts.
3. Release plans, delivery versions, statistics, and insights used hardcoded values and mock fallback states.

The backend exposes standard REST endpoints under `/api/aslan/environment/*`, `/api/aslan/release_plan/v1/*`, `/api/aslan/delivery/*`, and `/api/aslan/stat/*`.

## Goals / Non-Goals

**Goals:**
- Provide a dedicated, responsive `EnvironmentWizardPage` component at `/v1/projects/detail/:projectName/envs/create`.
- Wire `PUT /api/aslan/environment/environments/:envName/workloads/scale` with authentic replica update payloads and loading states.
- Connect `ReleasePlanPage` to `/api/aslan/release_plan/v1/*` for live scheduling and plan creation.
- Separate `DeliveryPage` artifacts and versions tabs with authentic endpoints (`/api/aslan/delivery/artifacts` and `/api/aslan/delivery/releases`) and an artifact lineage drawer.
- Wire `StatisticsPage` and `InsightsPage` to `/api/aslan/stat/*` and cluster metrics with real dynamic computations and time range filtering.
- Connect `UserProfilePage` password update and MCP token retrieval to real auth endpoints.

**Non-Goals:**
- Implementing micro-frontend plugin mounting (`/v1/plugin/*`).
- Re-architecting multi-tenant RBAC policies or MFA enrollment flows.
- Mobile client (`/mobile`) view implementations.

## Decisions

### Decision 1: Dedicated Environment Wizard Component
- **Rationale**: Currently, `/v1/projects/detail/:projectName/envs/create` maps directly to `EnvironmentsPage`, confusing users. We create `src/pages/Environments/Wizard.tsx` with a standard 3-step Ant Design `Steps` flow (1: Basic & Cluster, 2: Services & Config, 3: Review & Create) and register it specifically under the project routing subtree.
- **Alternatives Considered**: In-page modal on the environment table. Rejected because full environment creation requires complex namespace configuration, service multi-selection, and environment variable overrides that require dedicated screen real estate.

### Decision 2: Distinct Data Stores for Delivery Artifacts vs. Release Versions
- **Rationale**: `DeliveryPage` previously displayed the same `artifacts` array across both tabs. We create distinct state hooks for `artifacts` and `releases` fetched from `/api/aslan/delivery/artifacts` and `/api/aslan/delivery/releases`, rendering tailored column sets for each.
- **Alternatives Considered**: Merging both into a single polymorphic table. Rejected because release versions carry semantic versioning, milestone tags, and changelog data distinct from raw image artifacts.

### Decision 3: Dynamic Statistics Fallbacks via Aggregated Project Data
- **Rationale**: When platform-wide statistics endpoints (`/api/aslan/stat/dashboard`) return partial data, we compute live sums from project and pipeline lists rather than hardcoding static mock numbers (such as 1280 or 342).
- **Alternatives Considered**: Showing blank widgets if any single stat fails. Rejected because partial metrics (e.g. cluster node count) provide immediate operational value.

## Risks / Trade-offs

- **[Risk: Large Payload on Multi-Cluster Queries]** → Cluster metrics and pod counts can be heavy on clusters with thousands of pods.  
  *Mitigation*: Use summary query parameters (`/api/aslan/cluster/clusters`) and avoid streaming real-time pod logs unless drawers or modals are opened.
- **[Risk: Environments with No Services Ready]** → New projects may lack services, causing the environment wizard step 2 to be empty.  
  *Mitigation*: Provide an Ant Design `<Empty />` with a direct call-to-action button to "+ 新建服务".
