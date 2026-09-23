# portal-core Specification

## Purpose
Provides foundational web architecture, layout navigation, dynamic cryptographic authentication, and network communication infrastructure for the Zadig web portal.

## Requirements

### Requirement: RSA and AES Cryptographic Authentication
The portal authentication system SHALL implement dynamic RSA public key retrieval and AES-CFB envelope encryption before submitting user credentials to the backend.

#### Scenario: User performs local account login
- **WHEN** user inputs username and password and clicks submit
- **THEN** the system retrieves the RSA public key from the backend, generates a random 32-character AES key, encrypts the password with AES-CFB, encrypts the AES key with RSA PKCS#1 v1.5, and sends the payload to `/api/v1/login`

#### Scenario: Login requires captcha verification
- **WHEN** the backend returns an `x-require-captcha: true` header or failed login count threshold is exceeded
- **THEN** the system displays a graphical captcha input and submits `captcha_id` and `captcha_answer` along with encrypted credentials

#### Scenario: User logout and session clearing
- **WHEN** user clicks logout from the personal avatar dropdown
- **THEN** the system invokes `/api/v1/logout`, voids the session token, clears local storage user caches, and redirects the browser to the login page

### Requirement: Enterprise Portal Layout and Navigation
The web portal SHALL present an enterprise-grade responsive layout supporting global topbar, collapsible sidebar navigation, project scope switching, and breadcrumbs.

#### Scenario: User navigates between main navigation sections
- **WHEN** user clicks sidebar items such as "Workbench", "Projects", "Delivery Center", "Data Insight", or "System Settings"
- **THEN** the application switches views according to the route and highlights the active menu item without full page reload

#### Scenario: User switches active project context
- **WHEN** user selects a different project from the global project selector
- **THEN** the system updates the current project context and reloads project-specific resources (services, builds, environments, workflows)

### Requirement: Unified API Client and Token Handling
The portal SHALL provide a unified HTTP request client that automatically injects Bearer authorization tokens, handles standard error codes, and catches session expiration.

#### Scenario: Authorized API request execution
- **WHEN** an authenticated page makes a backend REST API call
- **THEN** the request interceptor attaches `Authorization: Bearer <token>` to the HTTP headers

#### Scenario: Session token expired
- **WHEN** any backend API returns HTTP status 401 Unauthorized
- **THEN** the client clears authentication state, alerts the user, and redirects to the signin route with return URL query preserved
