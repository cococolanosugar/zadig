# portal-workflow Specification

## Purpose
Provides declarative workflow DAG orchestration, custom job and step pipeline configuration, parameter-driven task execution triggering, and real-time execution log streaming.

## Requirements

### Requirement: Custom Workflow V4 DAG Orchestration
The system SHALL provide an interactive visual canvas representing stages, concurrent jobs, and sequential steps with node configuration drawers and dependency validation.

#### Scenario: User configures workflow stages and jobs
- **WHEN** user adds a build job, deploy job, or custom test job to a workflow stage
- **THEN** the visual DAG canvas renders nodes, links parent-child stages, and allows configuring service targets, repositories, and environment variables

#### Scenario: User saves workflow definition
- **WHEN** user clicks save after configuring stages, jobs, and steps
- **THEN** the system validates that all upstream job references are valid and submits the complete workflow V4 payload to the backend

### Requirement: Workflow Task Triggering and Parameter Resolution
The system SHALL display an interactive execution trigger modal allowing users to select target branches, service images, runtime variables, and approval settings before dispatching a task run.

#### Scenario: User triggers a workflow execution
- **WHEN** user clicks "Run Workflow" from the workflow list or detail page
- **THEN** the system presents a dynamic form populated with build repositories, service targets, and environment selections, and dispatches task creation upon submission

### Requirement: Real-time Workflow Execution Tracking and Log Streaming
The system SHALL track task run status across stages, display step duration counters, and stream build/deploy console logs in real time.

#### Scenario: User inspects running workflow task
- **WHEN** user navigates to an active workflow task detail page
- **THEN** the system shows a live status DAG indicating pending, running, failed, or passed stages and jobs, automatically polling status updates

#### Scenario: User views live step logs
- **WHEN** user clicks a running job step
- **THEN** the system streams step execution logs through SSE, highlights errors and ANSI escape color codes, and supports automatic autoscroll
