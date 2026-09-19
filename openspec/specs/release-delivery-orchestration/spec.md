## Purpose

Coordinates release plans across projects and manages artifact versioning, release history, and downstream deployment tracing.

## Requirements

### Requirement: Release Plan Management
The system SHALL retrieve, create, and display real release plan schedules from the backend release management service without static mock values.

#### Scenario: Viewing release plans
- **WHEN** the user accesses the Release Plan page at `/v1/releasePlan`
- **THEN** the system issues an HTTP GET request to `/api/aslan/release_plan/v1/plans` and renders actual release milestone cards and status badges

#### Scenario: Creating a new release plan
- **WHEN** the user submits the new release plan modal with plan name, target window, and release manager
- **THEN** the system issues an HTTP POST request to `/api/aslan/release_plan/v1/plans` and refreshes the list upon confirmation

### Requirement: Delivery Release Versioning and Lineage
The system SHALL manage distinct artifact release versions and render delivery lineage graphs connected to real delivery API endpoints.

#### Scenario: Viewing release version list
- **WHEN** the user selects the "发布版本管理" tab on `/v1/delivery`
- **THEN** the system requests version definitions from `/api/aslan/delivery/releases` rather than reusing the flat artifact list

#### Scenario: Inspecting artifact lineage flow
- **WHEN** the user clicks "查看流向图" for an artifact entry
- **THEN** the system opens an interactive lineage drawer illustrating the commit, build workflow, and target deployment environment for that specific artifact
