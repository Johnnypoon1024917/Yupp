# Implementation Plan: Itinerary Planner

## Overview

Build a full itinerary planning feature for YUPP: Supabase migration for itineraries/items tables, TypeScript types, a Zustand planner store, a dual-pane Drafting Table UI (Saved Library + Trip Timeline), @dnd-kit drag-and-drop, Google Distance Matrix API proxy, BottomNav integration, framer-motion animations, and mobile-safe layout. Tasks build incrementally — schema first, then types, then store, then UI panes, then DnD wiring, then logistics engine, then navigation integration.

## Tasks

- [x] 1. Create Supabase migration for itineraries and itinerary_items tables
  - [x] 1.1 Create migration file `supabase/migrations/0002_itinerary_planner.sql` with `itineraries` table
    - Columns: `id` (UUID PK, default `gen_random_uuid()`), `user_id` (UUID FK to `auth.users(id)`, NOT NULL), `name` (TEXT, NOT NULL), `trip_date` (DATE, nullable), `created_at` (TIMESTAMPTZ, default `now()`)
    - Enable RLS on `itineraries`
    - Create SELECT, INSERT, UPDATE, DELETE policies restricted to `user_id = auth.uid()`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Add `itinerary_items` table to the same migration file
    - Columns: `id` (UUID PK, default `gen_random_uuid()`), `itinerary_id` (UUID FK to `itineraries(id)` with CASCADE DELETE, NOT NULL), `pin_id` (UUID FK to `pins(id)`, NOT NULL), `day_number` (INT, default 1), `sort_order` (INT, NOT NULL), `created_at` (TIMESTAMPTZ, default `now()`)
    - Enable RLS on `itinerary_items`
    - Create SELECT, INSERT, UPDATE, DELETE policies using subquery: `itinerary_id IN (SELECT id FROM itineraries WHERE user_id = auth.uid())`
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Define TypeScript types for itinerary data
  - [x] 2.1 Add `Itinerary`, `ItineraryItem`, and `PlannedPin` types to `src/types/index.ts`
    - `Itinerary`: `id` (string), `userId` (string), `name` (string), `tripDate` (string | null), `createdAt` (string)
    - `ItineraryItem`: `id` (string), `itineraryId` (string), `pinId` (string), `dayNumber` (number), `sortOrder` (number), `createdAt` (string)
    - `PlannedPin`: Combines existing `Pin` with `day_number` (number), `sort_order` (number), `itinerary_item_id` (string)
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Implement the Planner Zustand store
  - [x] 3.1 Create `src/store/usePlannerStore.ts` with core state and actions
    - State: `activeItinerary` (Itinerary | null), `dayItems` (Record<number, PlannedPin[]>), `hasUnsavedChanges` (boolean), `itineraries` (Itinerary[])
    - Actions: `addPinToDay(pin, dayNumber)` — appends PlannedPin, sets unsaved flag
    - Actions: `reorderPinInDay(dayNumber, oldIndex, newIndex)` — updates sort_order for all affected pins, sets unsaved flag
    - Actions: `movePinBetweenDays(sourceDayNumber, targetDayNumber, pinId, targetIndex)` — removes from source, inserts into target, recalculates sort_order for both days, sets unsaved flag
    - Actions: `removePinFromDay(dayNumber, pinId)` — removes pin, recalculates sort_order
    - Actions: `addDay()` — adds a new empty day container
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 3.2 Add Supabase CRUD actions to `usePlannerStore`
    - `createItinerary(name, tripDate?)` — inserts into `itineraries` table via Supabase client, sets as active
    - `fetchItineraries()` — fetches user's itineraries from Supabase
    - `loadItinerary(itineraryId)` — fetches itinerary + items from Supabase, populates `dayItems` state
    - `saveItinerary()` — persists all PlannedPins to Supabase (upsert itinerary_items), resets unsaved flag
    - `deleteItinerary(itineraryId)` — deletes from Supabase (CASCADE removes items)
    - `renameItinerary(itineraryId, newName)` — updates name in Supabase
    - _Requirements: 4.5, 4.6, 11.1, 11.2, 11.3, 11.4_

  - [ ]* 3.3 Write unit tests for `usePlannerStore`
    - Test addPinToDay appends pin and sets unsaved flag
    - Test reorderPinInDay updates sort_order correctly
    - Test movePinBetweenDays removes from source and inserts into target
    - Test saveItinerary resets unsaved flag
    - Create file `src/store/__tests__/usePlannerStore.test.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. Checkpoint — Data layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Build the Planner Page and Drafting Table layout
  - [x] 5.1 Create the Planner Page at `src/app/planner/page.tsx`
    - Full-viewport container with `h-screen overflow-hidden`
    - Apply safe-area insets: `env(safe-area-inset-bottom)` and `env(safe-area-inset-top)`
    - Render the DraftingTable component
    - _Requirements: 5.1, 5.2, 12.1_

  - [x] 5.2 Create `src/components/planner/DraftingTable.tsx` with responsive dual-pane layout
    - Desktop (≥768px): horizontal flex — SavedLibrary at 35% width left, TripTimeline at 65% width right
    - Mobile (<768px): vertical stack — SavedLibrary on top, TripTimeline on bottom, each independently scrollable
    - _Requirements: 5.3, 5.4, 12.2_

- [x] 6. Implement the Saved Library pane
  - [x] 6.1 Create `src/components/planner/SavedLibrary.tsx`
    - Retrieve all pins from `useTravelPinStore`
    - Group pins by city/region derived from each pin's `address` field
    - Render a text search input that filters pins by title or address
    - Render each pin as a compact card: 4:5 aspect-ratio image, pin title, "Drag to Plan" affordance
    - Own internal scrolling (`overflow-y-auto`) independent of Trip Timeline
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 7. Implement the Trip Timeline pane
  - [x] 7.1 Create `src/components/planner/TripTimeline.tsx`
    - Render vertical list of DayContainers from `usePlannerStore.dayItems`
    - Each DayContainer labeled with day number (e.g., "Day 1", "Day 2")
    - Include "Add Day" button to append new day containers
    - Own internal scrolling (`overflow-y-auto`) independent of Saved Library
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 7.2 Create `src/components/planner/DayContainer.tsx`
    - Droppable container for PlannedPins
    - Render each PlannedPin as a horizontal card: 64px image, pin title
    - Display Bridge_Element between consecutive cards (placeholder for travel time)
    - _Requirements: 7.3_

- [x] 8. Checkpoint — UI panes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Wire up drag-and-drop with @dnd-kit
  - [x] 9.1 Install `@dnd-kit/core` and `@dnd-kit/sortable` packages
    - Run `npm install @dnd-kit/core @dnd-kit/sortable`
    - _Requirements: 8.1_

  - [x] 9.2 Integrate DndContext and SortableContext into DraftingTable
    - Wrap DraftingTable content with `DndContext` from `@dnd-kit/core`
    - Make SavedLibrary pins draggable using `useDraggable`
    - Make DayContainer a droppable zone
    - Make PlannedPin cards sortable within DayContainer using `useSortable`
    - Handle `onDragEnd`: detect source (library vs day) and target (day container + position)
    - On library→day drop: call `addPinToDay` on Planner Store
    - On same-day reorder: call `reorderPinInDay` on Planner Store
    - On cross-day move: call `movePinBetweenDays` on Planner Store
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 9.3 Add framer-motion layout animations for card drops and reorders
    - Wrap PlannedPin cards with `motion.div` using `layout` prop
    - Animate card insertion, removal, and reorder transitions
    - _Requirements: 8.5_

- [x] 10. Implement the Distance Matrix logistics engine
  - [x] 10.1 Create API route `src/app/api/distancematrix/route.ts`
    - POST endpoint accepting `{ coordinates: {lat, lng}[], mode: 'transit' | 'driving' }`
    - Proxy request to Google Distance Matrix API for consecutive coordinate pairs
    - Return distance and duration data for each pair
    - Return structured error response if Google API returns error or non-OK status
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 10.2 Create `src/hooks/useDistanceMatrix.ts` hook
    - Accept a day's PlannedPins array as input
    - Call `/api/distancematrix` with consecutive pin coordinate pairs
    - Return array of `{ distance, duration, mode }` for each consecutive pair
    - Only trigger when sort_order or day_number changes (use dependency tracking)
    - _Requirements: 9.4, 9.6_

  - [x] 10.3 Create `src/components/planner/BridgeElement.tsx` and integrate into TripTimeline
    - Display travel mode icon and duration between consecutive timeline cards (e.g., "🚗 12 mins" or "🚶 15 mins")
    - Wire into DayContainer to render between PlannedPin cards using data from `useDistanceMatrix`
    - _Requirements: 9.5_

  - [ ]* 10.4 Write unit tests for the Distance Matrix API route
    - Mock Google Distance Matrix API responses
    - Test successful response with valid coordinate pairs
    - Test error handling for API failures
    - Test input validation (empty coordinates, invalid mode)
    - Create file `src/app/api/distancematrix/__tests__/route.test.ts`
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 11. Checkpoint — DnD and logistics
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Integrate planner into BottomNav and itinerary CRUD UI
  - [x] 12.1 Add "Plan" tab to `src/components/BottomNav.tsx`
    - Add a "Plan" tab with an appropriate icon (e.g., `CalendarDays` from lucide-react)
    - Update `BottomNavProps` type to include `"plan"` in the activeTab union
    - Navigate to `/planner` route when tapped
    - _Requirements: 10.1, 10.2_

  - [x] 12.2 Update `src/components/AppLayout.tsx` to handle the new "plan" tab
    - Add routing logic for the "plan" tab to navigate to `/planner`
    - _Requirements: 10.2_

  - [x] 12.3 Add itinerary list and CRUD controls to the Planner Page
    - Show itinerary selector/list on the Planner Page (fetch via `usePlannerStore.fetchItineraries`)
    - "New Trip" button to create itinerary
    - Rename and delete actions on existing itineraries
    - Save button that calls `usePlannerStore.saveItinerary()`
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The project already has `framer-motion`, `zustand`, and `@supabase/supabase-js` installed; only `@dnd-kit` packages need to be added
- The `GOOGLE_PLACES_API_KEY` env var pattern is already established; the Distance Matrix proxy will need a similar key (or reuse the same one)
- All Supabase operations use the existing `createClient()` from `@/utils/supabase/client`
