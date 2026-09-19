## Purpose

Manages the complete lifecycle of project environments, including multi-step creation wizards with cluster binding and genuine workload replica scaling operations.

## ADDED Requirements

### Requirement: Multi-step Environment Creation Wizard
The system SHALL provide a dedicated environment creation wizard at `/v1/projects/detail/:projectName/envs/create` allowing users to configure cluster targets, namespaces, and services.

#### Scenario: Navigating to environment creation wizard
- **WHEN** the user navigates to `/v1/projects/detail/:projectName/envs/create` or clicks "新建环境" in the environment view
- **THEN** the system renders a multi-step creation wizard rather than redirecting to the environment table

#### Scenario: Submitting new environment creation
- **WHEN** the user selects a target Kubernetes cluster, inputs namespace details, chooses project services, and confirms submission
- **THEN** the system issues an HTTP POST request to `/api/aslan/environment/environments` and transitions to the environment overview upon success

#### Scenario: Handling environment creation error
- **WHEN** the backend returns an error during environment creation (such as namespace conflict or quota exceeded)
- **THEN** the system displays the backend error message and retains user wizard input for correction

### Requirement: Workload Replica Scaling
The system SHALL dispatch genuine scale requests to the backend Aslan environment workload engine when adjusting workload replicas.

#### Scenario: Scaling workload deployment replicas
- **WHEN** the user opens the scale dialog for a service in an active environment and confirms the target replica count
- **THEN** the system sends an HTTP PUT request to `/api/aslan/environment/environments/:envName/workloads/scale` with the workload name and target replica count

#### Scenario: Scale operation failure handling
- **WHEN** the backend fails to adjust replicas due to cluster connectivity issues or resource exhaustion
- **THEN** the system displays the server error notification and does not simulate an optimistic success feedback
