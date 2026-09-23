# portal-insight-settings Specification

## Purpose
Provides delivery efficiency analytics dashboards, multi-dimensional trend charts, third-party system integrations, and enterprise RBAC user and permission management.

## Requirements

### Requirement: Delivery Insights and Statistics Visualization
The system SHALL visualize build success rates, deployment frequencies, lead times, and test failure trends across projects and time windows using Ant Design Charts.

#### Scenario: User analyzes build performance metrics
- **WHEN** user opens the Build Insight tab and selects project filters and date ranges
- **THEN** the system requests build statistics and renders dual-axis trend lines, duration distribution columns, and success rate pie charts

#### Scenario: User inspects delivery summary dashboard
- **WHEN** user views the Data Overview / Statistics page
- **THEN** the system aggregates weekly and monthly deployment figures and displays interactive heatmaps and metrics summary cards

### Requirement: Cloud-Native System Integration Management
The system SHALL manage Kubernetes clusters, Git code hosts, Docker container registries, and object storage integrations through unified data tables and drawer forms.

#### Scenario: User registers a new Kubernetes cluster
- **WHEN** user clicks "Add Cluster" and supplies cluster name and kubeconfig or chooses agent installation
- **THEN** the system tests cluster connectivity, registers the cluster via `/api/aslan/system/cluster`, and displays its connection health status in the table

#### Scenario: User configures Git code repository integration
- **WHEN** user connects a GitHub, GitLab, or Gitee host with application credentials
- **THEN** the system verifies the token or OAuth callback and adds the host to the system codehost list

### Requirement: Enterprise User, Group, and Role-Based Access Control
The system SHALL support user listing, search, creation, group association, and role-binding assignments for system and project scopes.

#### Scenario: Administrator manages users and assigns roles
- **WHEN** an administrator views the User Management ProTable and edits a user's role bindings
- **THEN** the system updates user role bindings via `/api/v1/users/:uid/roles` and immediately reflects updated authorization levels
