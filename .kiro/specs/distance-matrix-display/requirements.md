# Requirements Document

## Introduction

Wire up the existing `useDistanceMatrix` hook inside `DayContainer` to calculate travel time between consecutive planned pins, and update `BridgeElement` to display the actual distance and duration data returned by the Distance Matrix API. This replaces the current static "Calculating…" placeholder with live travel information, loading states, and mode-appropriate icons.

## Glossary

- **DayContainer**: The React component (`src/components/planner/DayContainer.tsx`) that renders a droppable day column containing planned pins and bridge connectors.
- **BridgeElement**: The React component (`src/components/planner/BridgeElement.tsx`) that renders a visual connector between consecutive timeline cards within a day.
- **useDistanceMatrix**: The custom React hook (`src/hooks/useDistanceMatrix.ts`) that fetches distance and duration data for consecutive pin pairs from the `/api/distancematrix` endpoint.
- **DistanceSegment**: The data type `{ distance: string; duration: string; mode: 'transit' | 'driving' }` returned per consecutive pin pair by `useDistanceMatrix`.
- **PlannedPin**: A `Pin` enriched with `day_number`, `sort_order`, and `itinerary_item_id` fields representing a pin placed in an itinerary day.
- **Travel_Mode**: Either `'transit'` or `'driving'`, passed to the Distance Matrix API to determine the route calculation method.
- **Segment_Index**: The zero-based position of a `DistanceSegment` in the segments array, corresponding to the bridge between pin at position `i` and pin at position `i + 1`.

## Requirements

### Requirement 1: Hook Integration in DayContainer

**User Story:** As a trip planner, I want DayContainer to automatically fetch travel data between my planned pins, so that I can see real travel times without any manual action.

#### Acceptance Criteria

1. WHEN the DayContainer component renders with 2 or more pins, THE DayContainer SHALL call `useDistanceMatrix` with the current pins array and a Travel_Mode.
2. WHEN the DayContainer component renders with fewer than 2 pins, THE DayContainer SHALL not invoke a fetch request via `useDistanceMatrix` (the hook internally returns empty segments).
3. WHEN `useDistanceMatrix` returns segments, THE DayContainer SHALL pass the DistanceSegment at Segment_Index `i` to the BridgeElement rendered between pin `i` and pin `i + 1`.
4. WHILE `useDistanceMatrix` reports `isLoading` as true, THE DayContainer SHALL pass `isLoading={true}` to each BridgeElement.
5. WHEN the pin order changes via drag-and-drop reordering, THE DayContainer SHALL trigger a re-fetch of distance data through the hook's serialized key mechanism.

### Requirement 2: BridgeElement Props Interface

**User Story:** As a developer, I want BridgeElement to accept distance and loading props, so that it can render contextual travel information.

#### Acceptance Criteria

1. THE BridgeElement SHALL accept an optional `distance` prop of type `DistanceSegment`.
2. THE BridgeElement SHALL accept an optional `isLoading` prop of type `boolean`.
3. WHEN neither `distance` nor `isLoading` is provided, THE BridgeElement SHALL render a neutral dashed connector line without travel data text.

### Requirement 3: Loading State Display

**User Story:** As a trip planner, I want to see a visual loading indicator between pins while travel data is being fetched, so that I know the app is working on it.

#### Acceptance Criteria

1. WHILE `isLoading` is true, THE BridgeElement SHALL display a pulsing skeleton animation in place of travel data text.
2. WHILE `isLoading` is true, THE BridgeElement SHALL not display stale distance or duration values from a previous fetch.

### Requirement 4: Travel Data Display

**User Story:** As a trip planner, I want to see the travel time and distance between consecutive pins, so that I can plan realistic daily itineraries.

#### Acceptance Criteria

1. WHEN a DistanceSegment with mode `'driving'` is provided, THE BridgeElement SHALL display a car icon (🚗) alongside the duration text.
2. WHEN a DistanceSegment with mode `'transit'` is provided, THE BridgeElement SHALL display a walking icon (🚶) alongside the duration text.
3. WHEN a DistanceSegment is provided, THE BridgeElement SHALL display the `duration` string value from the segment.
4. WHEN a DistanceSegment is provided, THE BridgeElement SHALL display the `distance` string value from the segment.

### Requirement 5: Fallback Display

**User Story:** As a trip planner, I want to see a clean connector line when no travel data is available, so that the UI remains tidy even without distance information.

#### Acceptance Criteria

1. WHEN `distance` is undefined and `isLoading` is false, THE BridgeElement SHALL render a dashed vertical connector line.
2. WHEN `distance` is undefined and `isLoading` is false, THE BridgeElement SHALL not display any travel data text or mode icon.

### Requirement 6: Segment-to-Bridge Index Alignment

**User Story:** As a developer, I want each BridgeElement to receive the correct segment for its position, so that travel data between pin A→B is not accidentally shown between pin B→C.

#### Acceptance Criteria

1. FOR ALL days with N pins (N ≥ 2), THE DayContainer SHALL render exactly N − 1 BridgeElement components.
2. THE DayContainer SHALL pass `segments[i]` to the BridgeElement rendered between pin at index `i` and pin at index `i + 1`, for every `i` from 0 to N − 2.
3. IF the segments array length is less than N − 1 (e.g., during loading or error), THEN THE DayContainer SHALL pass `undefined` as the distance prop for BridgeElements beyond the available segment count.
