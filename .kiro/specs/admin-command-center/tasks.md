# Implementation Plan: Admin Command Center

## Overview

Implements the Admin Command Center in three phases: Data Layer (RBAC + audit logging via Supabase migrations), Security Layer (middleware extension for admin route protection), and Presentation Layer (admin layout + dashboard). Each phase builds incrementally so that the data layer is in place before the security layer references it, and the security layer is in place before the UI renders behind it.

## Tasks

- [x] 1. Create RBAC database schema migration
  - [x] 1.1 Create `supabase/migrations/<timestamp>_admin_rbac.sql`
    - Define `user_role` enum with values: 'admin', 'support', 'user'
    - Create `user_roles` table with `user_id` (UUID PK, FK to auth.users ON DELETE CASCADE), `role` (user_role, NOT NULL, DEFAULT 'user'), `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT now())
    - Enable RLS on `user_roles`
    - Create SELECT policy: `auth.uid() = user_id`
    - No INSERT/UPDATE/DELETE policies (denied for non-service-role clients)
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

- [x] 2. Create audit logging database schema migration
  - [x] 2.1 Create `supabase/migrations/<timestamp>_admin_audit.sql`
    - Create `activity_logs` table with `id` (UUID PK, DEFAULT gen_random_uuid()), `user_id` (UUID FK to auth.users ON DELETE SET NULL, nullable), `action` (TEXT NOT NULL), `entity_id` (UUID, nullable), `metadata` (JSONB DEFAULT '{}'), `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
    - Enable RLS on `activity_logs`
    - Create SELECT policy: only users with role='admin' in user_roles
    - No INSERT/UPDATE/DELETE policies (service role / trigger only)
    - Create `log_pin_creation()` trigger function (SECURITY DEFINER) that inserts into activity_logs with user_id, action='pin_created', entity_id, and metadata containing title + source_url from the inserted pin
    - Create AFTER INSERT trigger `trg_log_pin_creation` on pins table, FOR EACH ROW
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4_

- [x] 3. Extend TypeScript types for admin entities
  - [x] 3.1 Add `UserRole`, `UserRoleRow`, and `ActivityLog` types to `src/types/index.ts`
    - `UserRole` = 'admin' | 'support' | 'user'
    - `UserRoleRow` with user_id, role, created_at
    - `ActivityLog` with id, user_id (nullable), action, entity_id (nullable), metadata (Record<string, unknown>), created_at
    - _Requirements: 1.1, 2.1, 4.1_

- [x] 4. Checkpoint — Verify data layer
  - Ensure all migration SQL is syntactically valid and types compile. Ask the user if questions arise.

- [x] 5. Extend middleware with admin route guard
  - [x] 5.1 Modify `src/middleware.ts` to add admin route protection
    - Import `createServiceRoleClient` from `src/utils/supabase/serviceRole.ts`
    - After the `/planner` redirect and env-var check, add an admin guard block
    - If path starts with `/admin`: call `supabase.auth.getUser()`, redirect to `/` if no user
    - If authenticated: use service role client to query `user_roles` for the user's role
    - Redirect to `/` if role query fails, returns no row, or role is not 'admin'
    - Allow request to proceed only when role is 'admin'
    - Preserve existing session refresh behavior for all routes
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4_

  - [ ]* 5.2 Write property tests for middleware admin guard
    - **Property 7: Unauthenticated admin route redirect**
    - **Property 8: Admin middleware role gate**
    - Create `src/__tests__/middleware.admin.pbt.test.ts`
    - Use fast-check to generate random `/admin` sub-paths, auth states (authenticated/unauthenticated), and roles ('admin', 'support', 'user', missing)
    - Verify: unauthenticated → redirect; non-admin role → redirect; admin role → allow; missing role → redirect
    - Minimum 100 iterations per property
    - **Validates: Requirements 7.1, 7.2, 8.1, 8.2, 8.3, 8.4**

  - [ ]* 5.3 Write unit tests for middleware admin guard
    - Create `src/__tests__/middleware.admin.test.ts`
    - Test specific scenarios: unauthenticated user on /admin, authenticated non-admin on /admin, authenticated admin on /admin, missing user_roles row, query error, non-admin paths unaffected
    - **Validates: Requirements 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4**

- [x] 6. Checkpoint — Verify security layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement admin layout with sidebar navigation
  - [x] 7.1 Create `src/app/admin/layout.tsx`
    - Server component with `<aside>` sidebar and `<main>` content area
    - Sidebar nav links: "Dashboard" → /admin, "Users" → /admin/users, "Global Pins" → /admin/pins
    - All styling via Tailwind CSS utility classes
    - Render `{children}` in the content area
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 7.2 Write unit tests for admin layout
    - Create `src/app/admin/__tests__/layout.test.ts`
    - Verify sidebar renders three nav links with correct hrefs
    - Verify children are rendered in the content area
    - **Validates: Requirements 9.1, 9.2**

- [x] 8. Implement admin dashboard page
  - [x] 8.1 Create `src/app/admin/page.tsx`
    - Server component that fetches 50 most recent activity_logs ordered by created_at descending
    - Use `createClient()` from `src/utils/supabase/server.ts`
    - Render table with columns: Time, User ID, Action, Pin Title
    - Extract Pin Title from `metadata.title`, fallback to "—" if missing
    - Display "—" or "Anonymous" for null user_id
    - Show empty state message when no logs exist
    - All styling via Tailwind CSS utility classes
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ]* 8.2 Write property tests for dashboard data handling
    - **Property 9: Dashboard log ordering and limit**
    - **Property 10: Metadata title extraction**
    - Create `src/app/admin/__tests__/page.pbt.test.ts`
    - Use fast-check to generate arrays of activity log objects with random created_at timestamps and metadata
    - Verify: result is at most 50 items, ordered by created_at descending
    - Verify: metadata.title is correctly extracted for display; missing title falls back to "—"
    - Minimum 100 iterations per property
    - **Validates: Requirements 10.2, 10.4**

  - [ ]* 8.3 Write unit tests for admin dashboard
    - Create `src/app/admin/__tests__/page.test.ts`
    - Test: renders table with correct columns, displays log data, handles empty state, handles null metadata/user_id
    - **Validates: Requirements 10.1, 10.3, 10.4, 10.5**

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The service role client already exists at `src/utils/supabase/serviceRole.ts` — no new file needed
- Migrations use `<timestamp>` placeholder — replace with actual timestamp at creation time (e.g., `20250101000000`)
- All middleware failures on admin routes fail closed (redirect to `/`)
- Property tests use `fast-check` (already in devDependencies) with Vitest
