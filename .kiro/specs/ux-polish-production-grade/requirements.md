# Requirements Document

## Introduction

This feature delivers production-grade UX polish to the YUPP travel planning app. It covers four areas: skeleton loading states during data fetches, optimistic UI for drag-and-drop operations, graceful AI failure handling with a toast notification system, and empty-state illustrations for blank itineraries. The goal is to eliminate blank screens, network-dependent lag, raw error messages, and lifeless empty states — bringing the experience to an Airbnb-tier level of polish.

## Glossary

- **Skeleton_Loader**: A shimmering placeholder UI rendered in place of real content while data is loading from Supabase.
- **PinCardSkeleton**: A single skeleton placeholder component that mimics the shape and layout of a `TimelineCard` (64×64 image area + text line).
- **TripTimeline**: The React component (`src/components/planner/TripTimeline.tsx`) that renders the list of day containers and their planned pins.
- **DayContainer**: The React component (`src/components/planner/DayContainer.tsx`) that renders a single day's droppable zone and its sorted pin cards.
- **Planner_Store**: The Zustand store (`src/store/usePlannerStore.ts`) managing itinerary state including `dayItems`, mutations, and Supabase persistence.
- **MagicBar**: The URL-input component (`src/components/MagicBar.tsx`) that scrapes links, geocodes places, and creates travel pins.
- **DraftingTable**: The top-level planner layout component (`src/components/planner/DraftingTable.tsx`) that composes the library pane and trip timeline inside a DnD context.
- **Toast_System**: A non-blocking notification UI that displays transient messages (success, error, info) overlaid on the app without interrupting user flow.
- **Optimistic_Update**: A pattern where the local UI state is updated immediately before the asynchronous server call completes, with rollback on failure.
- **Empty_State**: A styled placeholder UI shown when an itinerary contains zero planned pins across all days.
- **Rollback**: The act of reverting local state to its pre-mutation snapshot when an asynchronous persistence call fails.

## Requirements

### Requirement 1: Skeleton Loading for Itinerary Data

**User Story:** As a traveler, I want to see shimmering placeholder cards while my itinerary loads, so that I know content is on its way rather than staring at a blank screen.

#### Acceptance Criteria

1. WHILE the Planner_Store `loadItinerary` call is in progress, THE TripTimeline SHALL render Skeleton_Loader placeholders instead of real pin cards.
2. THE PinCardSkeleton SHALL visually match the dimensions of a TimelineCard: a 64×64 pixel rounded rectangle on the left and a text-width rectangle on the right.
3. THE PinCardSkeleton SHALL use the Tailwind `animate-pulse` utility class to produce a shimmering animation.
4. THE PinCardSkeleton SHALL use the `bg-neutral-100` background color consistent with the existing neutral palette.
5. WHILE the Planner_Store `loadItinerary` call is in progress, EACH DayContainer SHALL render exactly 3 PinCardSkeleton components as placeholders.
6. WHEN the `loadItinerary` call resolves successfully, THE TripTimeline SHALL replace all PinCardSkeleton components with the actual PlannedPin cards.
7. IF the `loadItinerary` call fails, THEN THE TripTimeline SHALL remove the Skeleton_Loader placeholders and display the empty day state.

### Requirement 2: Optimistic UI for Drag-and-Drop Operations

**User Story:** As a traveler, I want my drag-and-drop reorders and cross-day moves to feel instant, so that planning my trip feels fluid and responsive regardless of network speed.

#### Acceptance Criteria

1. WHEN a user completes a drag-and-drop reorder within the same day, THE Planner_Store `reorderPinInDay` action SHALL update the local `dayItems` state immediately without waiting for a Supabase response.
2. WHEN a user completes a drag-and-drop move between days, THE Planner_Store `movePinBetweenDays` action SHALL update the local `dayItems` state immediately without waiting for a Supabase response.
3. WHEN a local drag-and-drop mutation is applied, THE Planner_Store SHALL capture a snapshot of the `dayItems` state before the mutation for rollback purposes.
4. WHEN a local drag-and-drop mutation is applied, THE Planner_Store SHALL asynchronously invoke `saveItinerary` to persist the change to Supabase in the background.
5. IF the background `saveItinerary` call fails, THEN THE Planner_Store SHALL restore the `dayItems` state to the pre-mutation snapshot.
6. IF the background `saveItinerary` call fails, THEN THE Toast_System SHALL display the message: "Sync failed. Reverting changes."
7. WHILE a background `saveItinerary` call is in flight, THE Planner_Store SHALL accept and queue additional drag-and-drop mutations without blocking the UI.

### Requirement 3: Toast Notification System

**User Story:** As a traveler, I want errors and status messages to appear as polished, non-blocking toast notifications, so that I am informed without my workflow being interrupted.

#### Acceptance Criteria

1. THE Toast_System SHALL render notifications as floating, non-modal overlays positioned at the bottom-center of the viewport.
2. THE Toast_System SHALL support at minimum three notification variants: "success", "error", and "info".
3. WHEN a toast notification is displayed, THE Toast_System SHALL automatically dismiss the notification after 4 seconds.
4. THE Toast_System SHALL allow a maximum of 3 visible notifications stacked simultaneously; older notifications SHALL be dismissed when the limit is exceeded.
5. THE Toast_System SHALL apply an enter animation (slide up + fade in) and an exit animation (slide down + fade out) to each notification.
6. THE Toast_System SHALL be accessible: each notification SHALL have `role="status"` and `aria-live="polite"` attributes.

### Requirement 4: Graceful AI Failure Handling in MagicBar

**User Story:** As a traveler, I want friendly, human-readable messages when AI extraction or geocoding fails, so that I understand what happened without seeing raw technical errors.

#### Acceptance Criteria

1. IF the `scrapeUrl` action returns a failure result, THEN THE MagicBar SHALL display a Toast_System error notification with user-friendly copy instead of the raw error string.
2. IF the `geocodeLocation` action fails for all extracted places, THEN THE MagicBar SHALL display a Toast_System error notification with the message: "Our AI is currently taking a coffee break. We saved the link to your unorganized collection instead!"
3. IF a network or unexpected error is caught during MagicBar processing, THEN THE MagicBar SHALL display a Toast_System error notification with the message: "Something went wrong. Please try again in a moment."
4. THE MagicBar SHALL remove the inline `<motion.p>` error element and use the Toast_System exclusively for all error display.
5. WHEN an AI extraction fails, THE MagicBar SHALL reset its internal state to "idle" within 300 milliseconds of displaying the toast notification.

### Requirement 5: Empty State Illustration for Itineraries

**User Story:** As a traveler, I want to see an inviting illustration and helpful prompt when my itinerary is empty, so that I know how to get started.

#### Acceptance Criteria

1. WHEN the `dayItems` record contains zero PlannedPin entries across all days, THE DraftingTable SHALL render an Empty_State illustration instead of the standard TripTimeline.
2. THE Empty_State illustration SHALL display a map icon centered horizontally within the content area.
3. THE Empty_State illustration SHALL display the text: "Your canvas is empty. Paste a TikTok or Xiaohongshu link to start building your dream trip." below the map icon.
4. THE Empty_State text SHALL use the `text-neutral-400` color and `text-[13px]` font size consistent with the existing YUPP typography.
5. THE Empty_State container SHALL be vertically centered within the available TripTimeline viewport area.
6. WHEN a user adds the first pin to any day, THE DraftingTable SHALL immediately replace the Empty_State with the standard TripTimeline view.

### Requirement 6: Skeleton and Empty State Serialization Round-Trip

**User Story:** As a developer, I want confidence that the loading and empty state logic correctly transitions between states, so that no intermediate UI glitch occurs.

#### Acceptance Criteria

1. FOR ALL valid `dayItems` state objects, serializing the state to JSON and deserializing it back SHALL produce an equivalent `dayItems` object (round-trip property).
2. FOR ALL `dayItems` state transitions from loading to loaded, THE TripTimeline SHALL render either skeleton placeholders or real pin cards, and SHALL NOT render both simultaneously.
3. FOR ALL drag-and-drop optimistic mutations followed by a rollback, THE Planner_Store `dayItems` state SHALL be identical to the pre-mutation snapshot.
