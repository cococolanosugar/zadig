# portal-service-env Specification

## Purpose
Provides cloud-native service orchestration, multi-file Kubernetes YAML and Helm values editing, environment lifecycle management, live Pod monitoring, and interactive container terminal execution.

## Requirements

### Requirement: Cloud-Native Service Configuration with Monaco Editor
The system SHALL provide code and YAML editing capabilities for Kubernetes resources and Helm Charts with syntax highlighting, diff inspection, and template variable replacement.

#### Scenario: User edits service YAML configuration
- **WHEN** user selects a service module in the service manager
- **THEN** the system loads the multi-document YAML content into an embedded Monaco editor with syntax validation and auto-completion

#### Scenario: User inspects configuration changes before saving
- **WHEN** user clicks "Compare / Diff" on a modified service configuration
- **THEN** the system renders a side-by-side Monaco DiffEditor showing additions and deletions between the current draft and the active version

### Requirement: Environment Overview and Pod Lifecycle Operations
The system SHALL list runtime environments, display Kubernetes workloads and Pod health statuses, and support workload scaling and restart operations.

#### Scenario: User views workload and Pod list
- **WHEN** user opens an environment detail page
- **THEN** the system displays all deployment workloads, running pods, restart counts, CPU/memory usage, and color-coded status badges

#### Scenario: User scales workload replica count
- **WHEN** user changes replica slider or inputs count and confirms
- **THEN** the system sends a workload update request to `/api/aslan/environment/environments/:env/workloads` and updates the live pod status

### Requirement: Interactive Pod Web Terminal and Streaming Container Logs
The system SHALL establish an interactive terminal session to running containers via WebSocket and stream container logs via Server-Sent Events or chunked HTTP.

#### Scenario: User launches container terminal session
- **WHEN** user clicks "Terminal" icon on an active pod container
- **THEN** the system establishes a WebSocket connection to the pod exec proxy and binds an xterm.js terminal instance allowing command execution

#### Scenario: User views live container logs
- **WHEN** user opens container logs drawer
- **THEN** the system streams log chunks in real-time with ANSI color rendering, auto-scroll, and text search capabilities
