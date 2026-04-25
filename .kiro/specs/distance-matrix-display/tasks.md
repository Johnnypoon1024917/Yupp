# Tasks

## Task 1: Update BridgeElement props and render logic

- [x] 1.1 Add `BridgeElementProps` interface with optional `distance: DistanceSegment` and `isLoading: boolean` props to `src/components/planner/BridgeElement.tsx`
- [x] 1.2 Implement loading state: when `isLoading` is true, render a pulsing skeleton placeholder (`animate-pulse`) instead of any travel data or stale distance values
- [x] 1.3 Implement data display state: when `distance` is defined and `isLoading` is not true, render mode icon (🚗 for driving, 🚶 for transit), duration text, and distance text
- [x] 1.4 Implement fallback state: when neither `distance` is defined nor `isLoading` is true, render the neutral dashed connector line without any travel data text or icons

## Task 2: Wire useDistanceMatrix into DayContainer

- [x] 2.1 Import `useDistanceMatrix` and call it with `pins` and `'driving'` mode at the top of the `DayContainer` component body in `src/components/planner/DayContainer.tsx`
- [x] 2.2 Pass `segments[i]` as the `distance` prop and `isLoading` as the `isLoading` prop to each `BridgeElement` rendered between pin `i` and pin `i+1`
- [x] 2.3 Ensure BridgeElements beyond the available segment count receive `undefined` as the distance prop (natural behavior when `segments[i]` is out of bounds)

## Task 3: Write unit tests

- [x] 3.1 Write unit tests for BridgeElement: fallback dashed line (no props), skeleton on `isLoading=true`, stale data hidden during loading, driving icon, transit icon
- [x] 3.2 Write unit tests for DayContainer integration: hook called with correct args for ≥2 pins, no fetch for <2 pins, `isLoading` forwarded to all bridges

## Task 4: Write property-based tests

- [x] 4.1 PBT: Property 1 — Bridge count invariant: for any N pins (2–20), verify exactly N−1 BridgeElements are produced `Feature: distance-matrix-display, Property 1: Bridge count invariant`
- [x] 4.2 PBT: Property 2 — Segment-to-bridge alignment: for any N pins and M segments (M ≤ N−1), verify bridge i gets segments[i] or undefined `Feature: distance-matrix-display, Property 2: Segment-to-bridge alignment`
- [x] 4.3 PBT: Property 3 — BridgeElement displays segment data faithfully: for any DistanceSegment, rendered output contains both distance and duration strings `Feature: distance-matrix-display, Property 3: BridgeElement displays segment data faithfully`
