## 1. P0: Environment Lifecycle & Workload Scaling

- [x] 1.1 Implement Environment Creation Wizard page (`Environments/Wizard.tsx`): create 3-step wizard (Cluster & Namespace, Services & Variables, Review & Submit) calling `POST /api/aslan/environment/environments`, verifying route registration at `/v1/projects/detail/:projectName/envs/create`.
- [x] 1.2 Wire genuine workload replica scaling in `Environments/index.tsx`: replace simulated toast with `PUT /api/aslan/environment/environments/:envName/workloads/scale` including target replicas payload and loading indicators, verifying error and success feedback.

## 2. P1: Release Planning & Delivery Versioning

- [x] 2.1 Connect Release Plan page (`ReleasePlan/index.tsx`) to backend API: create typed release plan API helper, replace empty table and static tags with live data from `/api/aslan/release_plan/v1/plans`, and add create release plan modal with POST request, verifying list reload.
- [x] 2.2 Wire Delivery Versioning & Lineage Drawer in `Delivery/index.tsx`: fetch releases from `/api/aslan/delivery/releases` for the version tab, and implement interactive artifact lineage drawer showing commit/workflow/environment flow on click, verifying tab switching and drawer render.

## 3. P2: Operational Statistics, Insights & Security

- [x] 3.1 Connect Statistics page (`Statistics/index.tsx`) to live metrics: replace hardcoded numbers (1280, 342, 6, 99.98%) and dummy tables with live calculations from `/api/aslan/stat/dashboard` and cluster API, verifying dynamic rendering and empty fallback.
- [x] 3.2 Wire time-range filtering and dynamic metrics in `Insights/index.tsx`: bind `7d`, `30d`, `90d` toggles to query parameters for `/api/aslan/stat/build` and `/api/aslan/stat/deploy`, calculating dynamic trend lines and success rates.
- [x] 3.3 Connect User Profile security and MCP token operations in `Profile/index.tsx`: replace static token and fake toasts with real user API token retrieval/rotation and password update endpoints, verifying feedback.

## 4. Verification & Validation

- [x] 4.1 Execute Ant Design lint check (`antd lint ./frontend/src`) and verify 0 warnings and no deprecated APIs.
- [x] 4.2 Execute frontend TypeScript check and production build (`pnpm run build` in `frontend/`) and verify clean compilation.
