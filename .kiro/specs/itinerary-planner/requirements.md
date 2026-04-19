# Requirements Document

## Introduction

The Itinerary Planner is a new feature for YUPP that lets users transition saved travel pins into structured, day-by-day trip plans. It introduces a `/planner` route with a dual-pane "Drafting Table" UI, a relational Supabase schema for itineraries and itinerary items, a Zustand-based planner store, drag-and-drop powered by `@dnd-kit`, and a Google Distance Matrix logistics engine that calculates travel time between consecutive stops within a day.

## Glossary

- **Planner_Page**: The Next.js page component rendered at the `/planner` route, hosting the Drafting Table layout.
- **Drafting_Table**: The dual-pane (desktop) or stacked (mobile) workspace comprising the Saved Library and the Trip Timeline.
- **Saved_Library**: The left pane (or top section on mobile) that displays all of the user's saved pins grouped by city/region.
- **Trip_Timeline**: The right pane (or bottom section on mobile) that displays day containers with ordered itinerary items.
- **Day_Container**: A droppable region within the Trip Timeline representing a single day of the trip (e.g., Day 1, Day 2).
- **Itinerary**: A named trip plan owned by a user, stored in the `itineraries` Supabase table.
- **Itinerary_Item**: A record linking a specific pin to an itinerary with a day number and sort order, stored in the `itinerary_items` Supabase table.
- **Planned_Pin**: A composite client-side type combining a Pin with its itinerary placement metadata (day_number, sort_order, itinerary_item_id).
- **Planner_Store**: A Zustand store (`usePlannerStore`) managing the local drafting state including the active itinerary, items per day, and unsaved change tracking.
- **Bridge_Element**: A UI element displayed between consecutive timeline cards showing travel time/distance to the next stop.
- **Distance_Matrix_Proxy**: A Next.js API route at `/api/distancematrix` that proxies requests to the Google Distance Matrix API.
- **Bottom_Nav**: The existing bottom navigation component (`BottomNav.tsx`) providing tab-based routing.
- **Supabase_Client**: The existing browser-side Supabase client created via `createClient()` from `@/utils/supabase/client`.
- **RLS**: Row-Level Security, the Supabase/Postgres mechanism that restricts data access per authenticated user.

## Requirements

### Requirement 1: Itineraries Database Table

**User Story:** As a user, I want my trip plans persisted in the database, so that my itineraries survive across sessions and devices.

#### Acceptance Criteria

1. THE Migration SHALL create an `itineraries` table with columns: `id` (UUID, primary key, default `gen_random_uuid()`), `user_id` (UUID, foreign key to `auth.users(id)`, not null), `name` (TEXT, not null), `trip_date` (DATE, nullable), and `created_at` (TIMESTAMPTZ, default `now()`).
2. THE Migration SHALL enable RLS on the `itineraries` table.
3. THE Migration SHALL create RLS policies on the `itineraries` table so that SELECT, INSERT, UPDATE, and DELETE operations are restricted to rows where `user_id = auth.uid()`.

### Requirement 2: Itinerary Items Database Table

**User Story:** As a user, I want each pin placement within a trip to be stored, so that my day-by-day ordering is preserved.

#### Acceptance Criteria

1. THE Migration SHALL create an `itinerary_items` table with columns: `id` (UUID, primary key, default `gen_random_uuid()`), `itinerary_id` (UUID, foreign key to `itineraries(id)` with CASCADE DELETE, not null), `pin_id` (UUID, foreign key to `pins(id)`, not null), `day_number` (INT, default 1), `sort_order` (INT, not null), and `created_at` (TIMESTAMPTZ, default `now()`).
2. THE Migration SHALL enable RLS on the `itinerary_items` table.
3. THE Migration SHALL create RLS policies on the `itinerary_items` table so that SELECT, INSERT, UPDATE, and DELETE operations are restricted to rows where `itinerary_id` belongs to an itinerary owned by the current user (`itinerary_id IN (SELECT id FROM itineraries WHERE user_id = auth.uid())`).

### Requirement 3: Data Models and Type Definitions

**User Story:** As a developer, I want well-defined TypeScript types for itinerary data, so that the planner feature has type-safe data structures.

#### Acceptance Criteria

1. THE Type_System SHALL export an `Itinerary` interface with fields: `id` (string), `userId` (string), `name` (string), `tripDate` (string or null), and `createdAt` (string).
2. THE Type_System SHALL export an `ItineraryItem` interface with fields: `id` (string), `itineraryId` (string), `pinId` (string), `dayNumber` (number), `sortOrder` (number), and `createdAt` (string).
3. THE Type_System SHALL export a `PlannedPin` type that combines the existing `Pin` interface with additional fields: `day_number` (number), `sort_order` (number), and `itinerary_item_id` (string).

### Requirement 4: Planner Zustand Store

**User Story:** As a user, I want the planner to track my in-progress edits locally, so that I can drag and rearrange pins before saving.

#### Acceptance Criteria

1. THE Planner_Store SHALL maintain state for: the active Itinerary (or null), a map of Planned_Pin arrays keyed by day number, and a boolean flag indicating unsaved changes.
2. WHEN a pin is added to a Day_Container, THE Planner_Store SHALL append a Planned_Pin to the corresponding day's array and set the unsaved changes flag to true.
3. WHEN a pin is reordered within a Day_Container, THE Planner_Store SHALL update the `sort_order` of all affected Planned_Pins in that day and set the unsaved changes flag to true.
4. WHEN a pin is moved from one Day_Container to another, THE Planner_Store SHALL remove the Planned_Pin from the source day, insert it into the target day, recalculate `sort_order` for both days, and set the unsaved changes flag to true.
5. WHEN the user saves the itinerary, THE Planner_Store SHALL persist all Planned_Pins to Supabase via the Supabase_Client and reset the unsaved changes flag to false.
6. WHEN the user loads an existing itinerary, THE Planner_Store SHALL fetch the itinerary and its items from Supabase via the Supabase_Client and populate the local state.

### Requirement 5: Planner Page Layout

**User Story:** As a user, I want a dedicated planner workspace, so that I can build trip itineraries without leaving the app.

#### Acceptance Criteria

1. THE Planner_Page SHALL be accessible at the `/planner` route.
2. THE Planner_Page SHALL render a full-viewport container (`h-screen overflow-hidden`) that prevents body scrolling.
3. WHILE the viewport width is 768px or greater, THE Drafting_Table SHALL display the Saved_Library at 35% width on the left and the Trip_Timeline at 65% width on the right in a horizontal flex layout.
4. WHILE the viewport width is less than 768px, THE Drafting_Table SHALL stack the Saved_Library on top and the Trip_Timeline on the bottom in a vertical layout.

### Requirement 6: Saved Library Pane

**User Story:** As a user, I want to browse my saved pins organized by location, so that I can quickly find places to add to my trip.

#### Acceptance Criteria

1. THE Saved_Library SHALL retrieve all pins from the existing `useTravelPinStore`.
2. THE Saved_Library SHALL group pins by city or region derived from each pin's `address` field.
3. THE Saved_Library SHALL provide a text search input that filters the displayed pins by title or address.
4. THE Saved_Library SHALL render each pin as a compact card with a 4:5 aspect-ratio image, the pin title, and a visible "Drag to Plan" affordance.
5. THE Saved_Library SHALL support its own internal scrolling independent of the Trip_Timeline.

### Requirement 7: Trip Timeline Pane

**User Story:** As a user, I want a day-by-day timeline view, so that I can organize my trip schedule visually.

#### Acceptance Criteria

1. THE Trip_Timeline SHALL display a vertical list of Day_Containers, each labeled with its day number (e.g., "Day 1", "Day 2").
2. THE Trip_Timeline SHALL allow the user to add new Day_Containers.
3. WHEN a Day_Container contains Planned_Pins, THE Trip_Timeline SHALL render each as a horizontal card showing: a 64px image, the pin title, and the Bridge_Element to the next pin.
4. THE Trip_Timeline SHALL support its own internal scrolling independent of the Saved_Library.

### Requirement 8: Drag-and-Drop Interactions

**User Story:** As a user, I want to drag pins from my library into day slots and reorder them, so that I can build my itinerary intuitively.

#### Acceptance Criteria

1. THE Drafting_Table SHALL use `@dnd-kit/core` and `@dnd-kit/sortable` to implement drag-and-drop.
2. WHEN a user drags a pin from the Saved_Library and drops it into a Day_Container, THE Drafting_Table SHALL create a new Planned_Pin in the Planner_Store at the drop position.
3. WHEN a user drags a Planned_Pin within the same Day_Container, THE Drafting_Table SHALL reorder the pin and update sort_order values in the Planner_Store.
4. WHEN a user drags a Planned_Pin from one Day_Container to a different Day_Container, THE Drafting_Table SHALL move the pin across days and update both day arrays in the Planner_Store.
5. THE Drafting_Table SHALL use `framer-motion` for layout animations when cards are dropped or reordered.

### Requirement 9: Distance Matrix Logistics Engine

**User Story:** As a user, I want to see travel times between consecutive stops, so that I can plan realistic daily schedules.

#### Acceptance Criteria

1. THE Distance_Matrix_Proxy SHALL expose a POST endpoint at `/api/distancematrix` that accepts an array of coordinate pairs and a travel mode (`transit` or `driving`).
2. THE Distance_Matrix_Proxy SHALL call the Google Distance Matrix API with the provided coordinates and return distance and duration data for each consecutive pair.
3. IF the Google Distance Matrix API returns an error or a non-OK status, THEN THE Distance_Matrix_Proxy SHALL return a structured error response with the error details.
4. WHEN the `sort_order` or `day_number` of any Planned_Pin in a Day_Container changes, THE Planner_Page SHALL request updated travel times from the Distance_Matrix_Proxy for that day's consecutive pin pairs.
5. THE Trip_Timeline SHALL display a Bridge_Element between consecutive timeline cards showing the travel mode icon and duration (e.g., "🚗 12 mins" or "🚶 15 mins").
6. THE Planner_Page SHALL trigger distance calculations only when sort_order or day_number changes, to minimize API calls.

### Requirement 10: Navigation Integration

**User Story:** As a user, I want to access the planner from the main navigation, so that I can switch between the map and the planner easily.

#### Acceptance Criteria

1. THE Bottom_Nav SHALL include a "Plan" tab with an appropriate icon that navigates to the `/planner` route.
2. WHEN the user taps the "Plan" tab, THE Bottom_Nav SHALL route the user to the Planner_Page.

### Requirement 11: Itinerary CRUD via Supabase

**User Story:** As a user, I want to create, read, update, and delete itineraries, so that I can manage multiple trip plans.

#### Acceptance Criteria

1. WHEN the user creates a new itinerary, THE Planner_Store SHALL insert a new row into the `itineraries` table via the Supabase_Client with the user's `auth.uid()` as `user_id`.
2. WHEN the user opens the Planner_Page, THE Planner_Store SHALL fetch the user's itineraries from the `itineraries` table via the Supabase_Client.
3. WHEN the user deletes an itinerary, THE Planner_Store SHALL delete the corresponding row from the `itineraries` table via the Supabase_Client, and the CASCADE DELETE constraint SHALL remove all associated itinerary_items.
4. WHEN the user renames an itinerary, THE Planner_Store SHALL update the `name` column of the corresponding row in the `itineraries` table via the Supabase_Client.

### Requirement 12: Mobile-Safe Layout

**User Story:** As a mobile user, I want the planner to respect safe areas and be fully usable on small screens, so that no content is obscured by device chrome.

#### Acceptance Criteria

1. THE Planner_Page SHALL apply safe-area insets using `env(safe-area-inset-bottom)` and `env(safe-area-inset-top)` to prevent content from being hidden behind device UI elements.
2. WHILE the viewport width is less than 768px, THE Drafting_Table SHALL render the Saved_Library and Trip_Timeline in a vertically stacked layout with each pane independently scrollable.
