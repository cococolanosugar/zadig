## Purpose

Provides end-to-end workflow pipeline closure including DAG orchestration stage and job persistence and real-time streaming execution logs via Server-Sent Events.

## ADDED Requirements

### Requirement: Persistent Workflow DAG Orchestration Configuration
The system SHALL persist workflow stage and job configurations designed in the DAG editor directly to the backend Aslan workflow engine via HTTP PUT.

#### Scenario: Saving workflow DAG canvas configuration
- **WHEN** the user modifies stages, jobs, or dependencies in the DAG canvas and clicks "保存"
- **THEN** the system issues a `PUT /api/aslan/workflow/v4/{workflow_name}` request with the updated workflow definition and displays a confirmation message upon HTTP 200 response

#### Scenario: Handling DAG save errors
- **WHEN** the backend rejects the DAG update with an error (such as validation failure or 400 Bad Request)
- **THEN** the system displays the exact error message from the backend response and preserves the user's unsaved canvas state without resetting

### Requirement: Real-time Workflow Task Execution Log Streaming
The system SHALL establish a Server-Sent Events (SSE) stream to consume live container and job logs for running workflow execution tasks and render them dynamically in the terminal console.

#### Scenario: Subscribing to workflow task log stream
- **WHEN** the user opens an active task execution detail view at `/v1/projects/detail/:projectName/pipelines/multi/:workflowName/:taskId`
- **THEN** the system connects to the backend SSE log endpoint `/api/aslan/logs/sse/v4/workflow/:workflowName/task/:taskId` and appends incoming log chunks into the xterm log console with ANSI color formatting

#### Scenario: Closing task log stream upon completion
- **WHEN** the server sends the terminal end-of-stream event or the workflow task execution transitions to a terminal state (PASSED, FAILED, CANCELLED)
- **THEN** the system cleanly closes the SSE connection and stops polling
