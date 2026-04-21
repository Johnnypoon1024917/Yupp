# Requirements Document

## Introduction

This feature introduces the viral loop and security layer for the Yupp travel app (Phase 5). It enables public read-only trip sharing with social metadata, an itinerary cloning engine for viral growth, rate limiting on the geocoding API to protect the Google Places budget, and a login gateway that enforces authentication before trip planning. Together these capabilities let users share trips publicly, let viewers clone trips into their own accounts, and protect the platform from API abuse.

## Glossary

- **Itinerary**: A named trip plan owned by a user, stored in the `itineraries` table, containing one or more Itinerary_Items organized by day.
- **Itinerary_Item**: A single pinned location within an Itinerary, stored in the `itinerary_items` table, referencing a Pin and assigned to a day number and sort order.
- **Pin**: A saved travel location with coordinates, metadata, and imagery, stored in the `pins` table.
- **Public_Trip_Page**: A read-only Next.js page at `/trip/[id]` that renders a public Itinerary with its Pins on a full-screen map and timeline overlay.
- **Clone_Engine**: A Zustand store action (`cloneItinerary`) that copies all Itinerary_Items from a public Itinerary into a new Itinerary owned by the current authenticated user.
- **Rate_Limiter**: A fixed-window rate limiting mechanism that restricts the number of `geocodeLocation` server action invocations per IP address within a one-minute window.
- **AuthModal**: The existing authentication drawer component that prompts users to sign in with Google.
- **AppLayout**: The root client component that manages tab navigation, overlays, and the drag-and-drop context.
- **OG_Tags**: OpenGraph meta tags embedded in the HTML head for social media link previews (title, description, image).
- **RLS**: Row-Level Security policies in Supabase/PostgreSQL that control data access at the row level.
- **Service_Role_Client**: A Supabase client initialized with the service role key, bypassing RLS for server-side data fetching of public content.

## Requirements

### Requirement 1: Public Itinerary Visibility Column

**User Story:** As a trip creator, I want to mark my itinerary as public, so that external viewers can see my trip without needing an account.

#### Acceptance Criteria

1. THE migration `0003_public_sharing.sql` SHALL add an `is_public` boolean column to the `itineraries` table with a default value of `false`.
2. WHEN the migration is applied, THE migration SHALL update the `select_own_itineraries` RLS policy on the `itineraries` table so that SELECT is allowed when `user_id = auth.uid() OR is_public = true`.
3. WHEN the migration is applied, THE migration SHALL update the `select_own_itinerary_items` RLS policy on the `itinerary_items` table so that SELECT is allowed when the parent itinerary has `is_public = true` or the itinerary's `user_id = auth.uid()`.
4. WHEN the migration is applied, THE migration SHALL update the `select_own_pins` RLS policy on the `pins` table so that SELECT is allowed for Pins referenced by Itinerary_Items belonging to a public Itinerary, in addition to the existing owner-based access.

### Requirement 2: Public Trip Page Data Fetching

**User Story:** As an external viewer, I want to view a shared trip without logging in, so that I can explore the itinerary and its locations.

#### Acceptance Criteria

1. WHEN a request is made to `/trip/[id]`, THE Public_Trip_Page SHALL fetch the Itinerary metadata and all associated Pins using a Service_Role_Client that bypasses RLS.
2. IF the Itinerary with the given `id` does not exist, THEN THE Public_Trip_Page SHALL render a 404 not-found response.
3. IF the Itinerary exists but `is_public` is `false`, THEN THE Public_Trip_Page SHALL render a 404 not-found response.
4. THE Public_Trip_Page SHALL not require an authenticated user session to render public Itinerary data.

### Requirement 3: Public Trip Page UI

**User Story:** As an external viewer, I want to see the trip displayed on a full-screen map with a timeline, so that I can visually explore the itinerary.

#### Acceptance Criteria

1. THE Public_Trip_Page SHALL render a full-screen map displaying all Pins from the public Itinerary as markers.
2. THE Public_Trip_Page SHALL render a read-only Timeline Overlay listing all Pins grouped by day number and sorted by sort order.
3. THE Public_Trip_Page SHALL display the Itinerary name and trip date in the Timeline Overlay header.

### Requirement 4: Social Sharing Metadata

**User Story:** As a trip creator sharing a link on social media, I want the link preview to show a rich card with the trip title and image, so that the shared link attracts clicks.

#### Acceptance Criteria

1. THE Public_Trip_Page SHALL implement a `generateMetadata` function that produces dynamic OpenGraph meta tags.
2. THE `generateMetadata` function SHALL set the `og:title` to the format: `Trip to [City]: [Itinerary Name] on Yupp` where `[City]` is derived from the first Pin's address.
3. WHEN the Itinerary contains at least one Pin with a non-empty `imageUrl`, THE `generateMetadata` function SHALL set the `og:image` to the first Pin's `imageUrl`.
4. IF the Itinerary contains no Pins with a valid `imageUrl`, THEN THE `generateMetadata` function SHALL omit the `og:image` tag.

### Requirement 5: Clone Trip Button and Viral Hook

**User Story:** As a viewer of a public trip, I want to copy the trip to my own account with one click, so that I can use it as a starting point for my own travel plans.

#### Acceptance Criteria

1. THE Public_Trip_Page SHALL display a prominent "Copy this Trip to my Yupp" button.
2. WHEN a logged-in user clicks the "Copy this Trip to my Yupp" button, THE Public_Trip_Page SHALL invoke the Clone_Engine to create a cloned Itinerary for the current user.
3. WHEN an unauthenticated user clicks the "Copy this Trip to my Yupp" button, THE Public_Trip_Page SHALL display the AuthModal with the message "Log in to save and plan your own trips."
4. WHEN the Clone_Engine completes successfully, THE Public_Trip_Page SHALL navigate the user to the main app with the cloned Itinerary loaded.

### Requirement 6: Clone Engine

**User Story:** As a logged-in user, I want the clone operation to faithfully duplicate all trip pins into my new itinerary, so that I get an exact copy of the shared trip.

#### Acceptance Criteria

1. WHEN `cloneItinerary` is called with a valid public Itinerary ID, THE Clone_Engine SHALL fetch all Itinerary_Items and their associated Pins from the source Itinerary.
2. WHEN `cloneItinerary` is called, THE Clone_Engine SHALL create a new Itinerary owned by the current authenticated user with the same name as the source Itinerary.
3. WHEN `cloneItinerary` is called, THE Clone_Engine SHALL batch insert new Itinerary_Items into the cloned Itinerary, preserving the original day_number and sort_order of each item.
4. IF the current user is not authenticated, THEN THE Clone_Engine SHALL not create any Itinerary or Itinerary_Items and SHALL log an error.
5. IF the source Itinerary fetch fails, THEN THE Clone_Engine SHALL log the error and not create a partial Itinerary.
6. FOR ALL valid public Itineraries, cloning then loading the cloned Itinerary SHALL produce an equivalent set of PlannedPins with matching day_number and sort_order values (round-trip property).

### Requirement 7: Geocode Rate Limiting

**User Story:** As a platform operator, I want to limit geocoding requests per IP address, so that the Google Places API budget is protected from abuse.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL enforce a fixed-window limit of 20 requests per minute per IP address on the `geocodeLocation` server action.
2. WHEN a request is within the rate limit, THE Rate_Limiter SHALL allow the `geocodeLocation` action to proceed normally.
3. WHEN a request exceeds the rate limit, THE Rate_Limiter SHALL return `{ status: 'error', error: 'Too many requests. Please slow down!' }` without calling the Google Places API.
4. WHEN a new one-minute window begins, THE Rate_Limiter SHALL reset the request count for each IP address to zero.
5. FOR ALL sequences of N requests from the same IP within one minute where N is at most 20, THE Rate_Limiter SHALL allow all N requests (metamorphic property: request count equals allowed count up to the limit).

### Requirement 8: Login Gateway for Plan Tab

**User Story:** As a product owner, I want unauthenticated users to be prompted to log in when they try to access the Plan tab, so that trip planning is tied to user accounts.

#### Acceptance Criteria

1. WHEN an unauthenticated user selects the "plan" tab, THE AppLayout SHALL intercept the tab change and display the AuthModal instead of opening the planner.
2. WHEN an unauthenticated user selects the "plan" tab, THE AppLayout SHALL display the message "Log in to save and plan your own trips." in the AuthModal.
3. WHEN an authenticated user selects the "plan" tab, THE AppLayout SHALL open the planner sidebar as normal.
4. THE AppLayout SHALL not change the active tab to "plan" when the user is unauthenticated.
