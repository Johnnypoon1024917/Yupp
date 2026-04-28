# Requirements Document

## Introduction

The Enterprise Admin Command Center adds a role-based administration layer to the YUPP travel pin board application. It introduces RBAC (Role-Based Access Control) via Supabase, automatic audit logging of user activity, middleware-level route protection for admin pages, and a server-rendered admin dashboard for monitoring platform activity. The feature is structured in three architectural phases: Data Layer (RBAC + Audit), Security Layer (Middleware), and Presentation Layer (Dashboard UI).

## Glossary

- **RBAC_System**: The Role-Based Access Control subsystem implemented via Supabase database tables, enums, and Row Level Security policies that govern user permissions.
- **Audit_Logger**: The Supabase trigger-based subsystem that automatically records user activity (pin creation events) into the activity_logs table.
- **Admin_Middleware**: The Next.js middleware layer that intercepts requests to /admin routes and enforces authentication and role-based authorization checks.
- **Admin_Dashboard**: The server-rendered Next.js page at /admin that displays activity logs in a tabular format for administrators.
- **Admin_Layout**: The Next.js layout component at /admin that provides sidebar navigation for the admin section.
- **User_Role**: An enumerated type with values 'admin', 'support', and 'user' that classifies a user's permission level.
- **Activity_Log**: A database record capturing a user action, including the acting user, action type, target entity, and structured metadata.
- **Pin**: A saved travel location with title, coordinates, source URL, and associated metadata, stored in the pins table.
- **Service_Role_Client**: A Supabase client instantiated with the service role key that bypasses Row Level Security for privileged server-side operations.

## Requirements

### Requirement 1: User Role Enum Type

**User Story:** As a platform operator, I want a well-defined set of user roles, so that the system can classify users into distinct permission tiers.

#### Acceptance Criteria

1. THE RBAC_System SHALL define a `user_role` PostgreSQL enum type with exactly three values: 'admin', 'support', 'user'.
2. THE RBAC_System SHALL use the `user_role` enum as the column type for role assignment in the user_roles table.

### Requirement 2: User Roles Table

**User Story:** As a platform operator, I want each user to have an assigned role persisted in the database, so that the system can look up permissions for any authenticated user.

#### Acceptance Criteria

1. THE RBAC_System SHALL create a `user_roles` table with columns: user_id (UUID, primary key, foreign key to auth.users), role (user_role enum, default 'user'), and created_at (timestamptz, default now()).
2. THE RBAC_System SHALL enforce a one-to-one relationship between auth.users and user_roles via the user_id primary key constraint.
3. THE RBAC_System SHALL default the role column to 'user' when a new row is inserted without an explicit role value.

### Requirement 3: User Roles Row Level Security

**User Story:** As a platform operator, I want users to only read their own role, so that role information is not leaked across users.

#### Acceptance Criteria

1. THE RBAC_System SHALL enable Row Level Security on the user_roles table.
2. WHILE Row Level Security is enabled on user_roles, THE RBAC_System SHALL allow authenticated users to SELECT only rows where user_id matches auth.uid().
3. WHILE Row Level Security is enabled on user_roles, THE RBAC_System SHALL deny all INSERT, UPDATE, and DELETE operations from non-service-role clients on the user_roles table.

### Requirement 4: Activity Logs Table

**User Story:** As a platform administrator, I want all significant user actions recorded in a structured log, so that I can audit platform activity.

#### Acceptance Criteria

1. THE Audit_Logger SHALL create an `activity_logs` table with columns: id (UUID, primary key, default gen_random_uuid()), user_id (UUID, foreign key to auth.users), action (TEXT), entity_id (UUID), metadata (JSONB), and created_at (timestamptz, default now()).
2. THE Audit_Logger SHALL store the action column as a human-readable action identifier (e.g., 'pin_created').
3. THE Audit_Logger SHALL store structured contextual data in the metadata JSONB column.

### Requirement 5: Activity Logs Row Level Security

**User Story:** As a platform operator, I want only administrators to view activity logs, so that sensitive audit data is protected from unauthorized access.

#### Acceptance Criteria

1. THE Audit_Logger SHALL enable Row Level Security on the activity_logs table.
2. WHILE Row Level Security is enabled on activity_logs, THE Audit_Logger SHALL allow SELECT access only to users whose user_id has a role of 'admin' in the user_roles table.
3. WHILE Row Level Security is enabled on activity_logs, THE Audit_Logger SHALL deny all INSERT, UPDATE, and DELETE operations from non-service-role clients on the activity_logs table.

### Requirement 6: Automatic Pin Creation Audit Trigger

**User Story:** As a platform administrator, I want pin creation events to be automatically logged, so that I have a complete audit trail without relying on application code.

#### Acceptance Criteria

1. WHEN a new row is inserted into the pins table, THE Audit_Logger SHALL execute the `log_pin_creation()` trigger function.
2. WHEN the `log_pin_creation()` trigger fires, THE Audit_Logger SHALL insert a new activity_logs row with user_id set to NEW.user_id, action set to 'pin_created', entity_id set to NEW.id, and metadata containing the pin title and source_url from the inserted row.
3. WHEN the inserted pin row has a NULL user_id, THE Audit_Logger SHALL still insert the activity_logs row with user_id set to NULL.
4. THE Audit_Logger SHALL define the trigger as an AFTER INSERT trigger on the pins table, executing once per row.

### Requirement 7: Admin Route Authentication Guard

**User Story:** As a platform operator, I want unauthenticated users blocked from accessing admin pages, so that the admin section is only reachable by logged-in users.

#### Acceptance Criteria

1. WHEN a request targets a path starting with '/admin', THE Admin_Middleware SHALL verify the user is authenticated via Supabase session.
2. IF an unauthenticated user requests a path starting with '/admin', THEN THE Admin_Middleware SHALL redirect the user to '/'.
3. THE Admin_Middleware SHALL preserve existing middleware behavior for the legacy /planner redirect and Supabase session refresh.

### Requirement 8: Admin Route Role Authorization Guard

**User Story:** As a platform operator, I want only users with the 'admin' role to access admin pages, so that non-admin authenticated users cannot reach the admin dashboard.

#### Acceptance Criteria

1. WHEN an authenticated user requests a path starting with '/admin', THE Admin_Middleware SHALL query the user_roles table to retrieve the user's role.
2. IF the authenticated user does not have a role of 'admin' in the user_roles table, THEN THE Admin_Middleware SHALL redirect the user to '/'.
3. WHEN the authenticated user has a role of 'admin', THE Admin_Middleware SHALL allow the request to proceed to the admin route.
4. IF the user_roles query fails or returns no row for the authenticated user, THEN THE Admin_Middleware SHALL redirect the user to '/'.

### Requirement 9: Admin Layout with Sidebar Navigation

**User Story:** As an administrator, I want a dedicated admin layout with sidebar navigation, so that I can navigate between admin sections efficiently.

#### Acceptance Criteria

1. THE Admin_Layout SHALL render a sidebar containing navigation links to "Dashboard" (/admin), "Users" (/admin/users), and "Global Pins" (/admin/pins).
2. THE Admin_Layout SHALL render child route content adjacent to the sidebar.
3. THE Admin_Layout SHALL use Tailwind CSS utility classes for all styling.
4. THE Admin_Layout SHALL be implemented as a Next.js layout component at `src/app/admin/layout.tsx`.

### Requirement 10: Admin Dashboard Activity Log View

**User Story:** As an administrator, I want to see the latest activity logs on the admin dashboard, so that I can monitor recent platform activity at a glance.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL be implemented as a Next.js Server Component at `src/app/admin/page.tsx`.
2. WHEN the Admin_Dashboard loads, THE Admin_Dashboard SHALL fetch the 50 most recent activity_logs ordered by created_at descending.
3. THE Admin_Dashboard SHALL display each activity log in a table with columns: Time, User ID, Action, and Pin Title.
4. THE Admin_Dashboard SHALL extract the Pin Title from the metadata JSONB field of each activity log row.
5. IF the activity_logs query returns zero rows, THEN THE Admin_Dashboard SHALL display an empty state message indicating no activity has been recorded.
6. THE Admin_Dashboard SHALL use Tailwind CSS utility classes for all table styling.
7. WHEN the Admin_Dashboard fetches activity logs, THE Admin_Dashboard SHALL use the server-side Supabase client from `src/utils/supabase/server.ts`.
