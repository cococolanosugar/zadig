## Purpose

Provides global cluster infrastructure metrics and project-scoped delivery performance insights backed by real-time statistics endpoints.

## ADDED Requirements

### Requirement: Live Cluster and System Statistics
The system SHALL populate global platform metrics, weekly activity charts, and cluster resource utilization tables from the backend statistics API.

#### Scenario: Rendering global statistics dashboard
- **WHEN** the user navigates to the Statistics page at `/v1/statistics`
- **THEN** the system requests aggregated statistics from `/api/aslan/stat/dashboard` and `/api/aslan/stat/transaction` and computes KPI values dynamically

#### Scenario: Displaying real cluster resource allocation
- **WHEN** the user views the cluster compute resources table
- **THEN** the system fetches cluster resource metrics from `/api/aslan/cluster/clusters` and displays real CPU and memory utilization progress bars

### Requirement: Time-scoped Delivery Performance Insights
The system SHALL dynamically query delivery trends, success distributions, and duration breakdowns filtered by the selected time range.

#### Scenario: Switching delivery insight time range
- **WHEN** the user toggles the time range selector (7d, 30d, 90d) on `/v1/insight`
- **THEN** the system issues filtered requests to `/api/aslan/stat/build` and `/api/aslan/stat/deploy` and updates trend lines and charts accordingly

### Requirement: Authentic User Security and Profile Operations
The system SHALL execute user credential updates and MCP token rotations against backend user and system authentication endpoints.

#### Scenario: Updating account password
- **WHEN** the user submits the password change form in `/v1/profile`
- **THEN** the system dispatches an HTTP request to the user password modification endpoint and alerts the user with server-returned status

#### Scenario: Generating user API token
- **WHEN** the user requests a new API token for MCP integration in `/v1/profile`
- **THEN** the system requests a freshly generated token from the backend user API token service and displays the updated value
