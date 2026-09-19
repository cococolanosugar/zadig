## 1. P0: Workflow DAG Persistence & SSE Real-time Logs

- [x] 1.1 Connect DAG canvas save to backend API: In `WorkflowCanvas.tsx` and `Pipelines/index.tsx`, implement async workflow save calling `workflowApi.updateWorkflow(updated.name, updated)` with button loading indicator and error notification, verifying via PUT request dispatch and state synchronization.
- [x] 1.2 Connect task execution logs to real SSE stream: In `PipelineExecutionPage` (`Pipelines/Execution.tsx`), compute stream URL `/api/aslan/logs/sse/v4/workflow/:workflowName/:taskId/:selectedJob/1000` and pass to `LogViewer`, verifying dynamic connection badge and live chunk streaming.

## 2. P0: Service Creation & Build Execution Closure

- [x] 2.1 Connect service creation to backend API: In `Services/index.tsx`, refactor `handleCreateService` to call `POST /api/aslan/service/services` with standard K8s template payload and refresh service list on success, verifying modal close and tree update.
- [x] 2.2 Wire build execution trigger: In `Builds.tsx`, replace the `setTimeout` mock inside `handleConfirmExecute` with real build trigger execution and status feedback, verifying action dispatch without fake delays.

## 3. P1: Eradicate Mock Data Fallbacks & Fake Actions

- [x] 3.1 Clean up Sprints page: In `Sprints.tsx`, eliminate all fallback mock sprint items (`sprint-v1.0`, `sprint-v1.1`), replace with Ant Design `<Empty description="暂无迭代记录" />`, and replace optimistic success toasts in `catch` blocks with `feedback.message.error`.
- [x] 3.2 Clean up Builds page: In `Builds.tsx`, eliminate fallback mock build items on empty and error, replace with Ant Design `<Empty description="暂无构建模块" />` with a primary "新建构建" button, and verify error exposure.
- [x] 3.3 Clean up Scanners page: In `Scanners.tsx`, remove fabricated scanner cards (`sonar-check`, `ai-review`, `trivy-scan`), remove hardcoded `value="100%"` KPI card, and render real empty status and calculated rates.
- [x] 3.4 Clean up Quality page: In `Quality/index.tsx`, remove hardcoded `value="42 秒"` metric card, replace mock message toast on test run with real trigger handler, and render clean empty state.
- [x] 3.5 Clean up Integration settings: In `Settings/Integration/index.tsx`, eliminate fake "Connected" fallback items on empty data, and replace simulated `setTimeout` in connection testing, saving, and deleting with authentic HTTP calls or honest error reporting.

## 4. Verification & Validation

- [x] 4.1 Execute Ant Design lint check (`antd lint ./frontend/src`) and verify 0 warnings and no deprecated APIs.
- [x] 4.2 Execute frontend TypeScript check and production build (`pnpm run build` in `frontend/`) and verify clean compilation.
