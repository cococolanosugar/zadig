## Purpose

Provides real backend persistence for service template management and real build trigger execution within project workspaces.

## Requirements

### Requirement: Persistent Service Creation and Template Management
The system SHALL persist new service configurations and YAML templates to the backend Aslan service engine and synchronize the project service list upon completion.

#### Scenario: Creating a new service definition
- **WHEN** the user submits the create service modal with service name and YAML configuration in `/v1/projects/detail/:projectName/services`
- **THEN** the system issues a POST request to `/api/aslan/service/template` to create the service, refreshes the service list from the backend upon success, and closes the modal

#### Scenario: Handling service creation failure
- **WHEN** the backend returns an error during service creation (such as duplicate service name or invalid YAML syntax)
- **THEN** the system displays the backend error notification, leaves the modal open, and does not append phantom items to the local service list

### Requirement: Real Build Task Triggering
The system SHALL dispatch real build execution requests to the backend Aslan build engine and link to the generated execution record.

#### Scenario: Triggering a build execution
- **WHEN** the user clicks "执行" on a build item in `/v1/projects/detail/:projectName/builds`
- **THEN** the system submits an execution request to the build execution endpoint and notifies the user with the server-assigned execution task ID

#### Scenario: Handling build trigger errors
- **WHEN** the backend fails to trigger the build due to missing code repository credentials or missing parameters
- **THEN** the system displays the actual error message from the backend and does not simulate a fake success toast
