## Purpose

Eliminates artificial mock data fallbacks and simulated UI actions across workspace and settings modules, enforcing real backend responses and standard empty states.

## Requirements

### Requirement: Truthful Data Rendering for Workspace Iterations and Builds
The system SHALL display only real backend data for sprints and build configurations, rendering an empty state when no records exist and reporting real errors on operation failure.

#### Scenario: Viewing empty sprint iterations
- **WHEN** the backend returns an empty array for project sprints
- **THEN** the system renders a standard Ant Design empty state component and does not inject fabricated demo sprint items

#### Scenario: Sprint save failure handling
- **WHEN** the backend returns an error response during sprint creation or update
- **THEN** the system displays the backend error message and does not show an optimistic success message

#### Scenario: Viewing empty build list
- **WHEN** the backend returns an empty array for project builds
- **THEN** the system renders an empty state with a "新建构建" action prompt rather than populating mock build records

### Requirement: Truthful Data Rendering for Code Scanners and Quality Tests
The system SHALL display only real scanner configurations and automated test suites, eliminating hardcoded KPI metrics and simulated test execution.

#### Scenario: Viewing code scanner list with no configured scanners
- **WHEN** the backend returns an empty list for code scanners
- **THEN** the system renders an empty state and does not populate fabricated scanner cards (such as fake Sonar or Trivy items)

#### Scenario: Displaying test quality metrics
- **WHEN** the user views the Quality page
- **THEN** the system computes summary statistics only from real test task execution data returned by the backend without displaying hardcoded duration strings

#### Scenario: Triggering test execution
- **WHEN** the user clicks "执行测试" on an automated test record
- **THEN** the system dispatches an HTTP execution request to the backend test task endpoint and handles the real response

### Requirement: Authentic System Integration Management
The system SHALL execute genuine backend API requests for testing, saving, and deleting external integrations without simulated delays or synthetic fallback configurations.

#### Scenario: Testing integration connectivity
- **WHEN** the user clicks "测试连接" on an integration configuration form
- **THEN** the system sends a test connectivity request to the backend integration test endpoint and displays the actual connectivity check result

#### Scenario: Saving integration configuration
- **WHEN** the user submits an integration configuration form
- **THEN** the system issues a POST or PUT request to the backend integration endpoint and updates the UI only after receiving a successful response

#### Scenario: Viewing unconfigured integration categories
- **WHEN** an integration category has zero items configured in the backend
- **THEN** the system renders an empty state for that tab rather than displaying synthetic "Connected" demo entries
