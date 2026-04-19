# Requirements Document

## Introduction

Pivot the Itinerary Planner from a standalone page (`/planner`) to a slide-in sidebar overlay within the main Map view. The Map remains active and interactive while the planner is open, creating a "Command Center" experience. On mobile devices the planner renders as a full-screen vaul drawer instead of a sidebar to preserve screen real estate.

## Glossary

- **Planner_Sidebar**: A fixed-position panel that slides in from the right side of the viewport, hosting the ItineraryToolbar and TripTimeline components. Maximum width 400px on desktop.
- **Planner_Drawer**: A full-screen vaul-based bottom-sheet used on viewports narrower than 768px as the mobile equivalent of the Planner_Sidebar.
- **AppLayout**: The root client component (`src/components/AppLayout.tsx`) that composes the MapView, MagicBar, BottomNav, and overlay sheets.
- **MapView**: The MapLibre GL map component that exposes a `resize()` imperative method via `MapViewRef`.
- **BottomNav**: The bottom navigation bar with discover, add, plan, and profile tabs.
- **ItineraryToolbar**: The toolbar component for trip CRUD operations (create, rename, save, delete, list).
- **TripTimeline**: The scrollable day-based timeline that renders DayContainers with sortable PlannedPins.
- **LibraryPane**: The draggable saved-pins grid used as the drag source for planning.
- **CollectionDrawer**: The existing left-side drawer for browsing pin collections, which uses vaul on mobile and Framer Motion on desktop.
- **DraftingTable**: The DnD context wrapper that orchestrates drag-and-drop between LibraryPane and TripTimeline.
- **isPlannerOpen**: A boolean state value controlling the open/closed state of the Planner_Sidebar or Planner_Drawer.
- **usePlannerStore**: The Zustand store managing itinerary state (active itinerary, day items, CRUD actions).

## Requirements

### Requirement 1: Planner Sidebar Toggle State

**User Story:** As a user, I want to open and close the planner from the main map view, so that I can plan my trip without leaving the map.

#### Acceptance Criteria

1. WHEN the user taps the "Plan" tab in the BottomNav, THE AppLayout SHALL toggle the isPlannerOpen state between true and false.
2. WHILE isPlannerOpen is true, THE BottomNav SHALL display the "Plan" tab icon with the accent color and an active indicator dot.
3. WHILE isPlannerOpen is false, THE BottomNav SHALL display the "Plan" tab icon in the default (black) color without an active indicator dot.
4. WHEN isPlannerOpen transitions to true, THE AppLayout SHALL fetch itineraries from usePlannerStore if they have not been loaded in the current session.

### Requirement 2: Desktop Sidebar Layout

**User Story:** As a desktop user, I want the planner to appear as a slide-in sidebar on the right, so that I can see the map and plan simultaneously.

#### Acceptance Criteria

1. WHILE the viewport width is 768px or greater and isPlannerOpen is true, THE Planner_Sidebar SHALL render as a fixed-position panel anchored to the right edge of the viewport with a maximum width of 400px, full viewport height, and a z-index of 80.
2. WHEN isPlannerOpen transitions from false to true on desktop, THE Planner_Sidebar SHALL animate from translate-x-full to translate-x-0 over 300ms using an ease-in-out timing function.
3. WHEN isPlannerOpen transitions from true to false on desktop, THE Planner_Sidebar SHALL animate from translate-x-0 to translate-x-full over 300ms using an ease-in-out timing function.
4. THE Planner_Sidebar SHALL apply a left-facing box shadow of `rgba(0,0,0,0.1)` with a 40px blur and -10px horizontal offset.
5. THE Planner_Sidebar SHALL render the ItineraryToolbar at the top and the TripTimeline as scrollable content below it.

### Requirement 3: Mobile Drawer Layout

**User Story:** As a mobile user, I want the planner to appear as a full-screen drawer, so that I have enough space to manage my itinerary on a small screen.

#### Acceptance Criteria

1. WHILE the viewport width is less than 768px and isPlannerOpen is true, THE Planner_Drawer SHALL render as a full-screen vaul Drawer component.
2. WHEN the user drags the Planner_Drawer handle downward past the dismiss threshold, THE Planner_Drawer SHALL close and set isPlannerOpen to false.
3. THE Planner_Drawer SHALL render the ItineraryToolbar at the top and the TripTimeline as scrollable content below it.

### Requirement 4: Map Interaction While Planner Is Open

**User Story:** As a user, I want the map to remain interactive while the planner is open, so that I can explore locations and plan at the same time.

#### Acceptance Criteria

1. WHILE isPlannerOpen is true, THE MapView SHALL remain mounted, visible, and interactive (pan, zoom, marker clicks).
2. WHEN isPlannerOpen transitions to true on desktop, THE AppLayout SHALL call MapView.resize() after the sidebar transition completes (300ms delay) so the map recalculates its container dimensions.
3. WHEN isPlannerOpen transitions to false on desktop, THE AppLayout SHALL call MapView.resize() after the sidebar transition completes (300ms delay) so the map recalculates its container dimensions.

### Requirement 5: Saved Library Integration with CollectionDrawer

**User Story:** As a user, I want to drag pins from my saved collections into the trip timeline, so that I can build my itinerary from pins I have already saved.

#### Acceptance Criteria

1. WHILE isPlannerOpen is true, THE DraftingTable DnD context SHALL wrap both the CollectionDrawer content (drag source) and the Planner_Sidebar TripTimeline (drop target).
2. WHEN a user drags a pin from the LibraryPane and drops it onto a DayContainer in the TripTimeline, THE DraftingTable SHALL add the pin to the target day via usePlannerStore.addPinToDay.
3. WHEN a user reorders a PlannedPin within the same DayContainer, THE DraftingTable SHALL update the sort order via usePlannerStore.reorderPinInDay.
4. WHEN a user drags a PlannedPin from one DayContainer to another DayContainer, THE DraftingTable SHALL move the pin via usePlannerStore.movePinBetweenDays.

### Requirement 6: Route Cleanup

**User Story:** As a developer, I want to remove the standalone planner page, so that the codebase has a single entry point for the planner experience.

#### Acceptance Criteria

1. THE AppLayout SHALL serve as the sole host for the planner UI; the file `src/app/planner/page.tsx` SHALL be deleted.
2. IF a user navigates to the `/planner` URL path, THEN THE application SHALL redirect to the root path `/`.

### Requirement 7: Navigation State Consistency

**User Story:** As a user, I want the bottom navigation to correctly reflect which panel is active, so that I always know where I am in the app.

#### Acceptance Criteria

1. WHEN the user taps the "Plan" tab while isPlannerOpen is false, THE AppLayout SHALL set isPlannerOpen to true and close any other open overlays (ProfileSheet, DiscoverFeed).
2. WHEN the user taps the "Plan" tab while isPlannerOpen is true, THE AppLayout SHALL set isPlannerOpen to false and reset the active tab to "add".
3. WHEN the user taps the "Discover" or "Profile" tab while isPlannerOpen is true, THE AppLayout SHALL set isPlannerOpen to false before opening the requested overlay.
4. WHEN isPlannerOpen transitions to true, THE AppLayout SHALL set the activeTab state to "plan".
