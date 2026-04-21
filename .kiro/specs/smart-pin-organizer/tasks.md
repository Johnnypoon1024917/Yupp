# Tasks

## Task 1: Create Category Mapper Utility

- [ ] 1.1 Create `src/utils/categories.ts` with `getCollectionForType(primaryType: string | undefined): string` that maps known primaryType values to collection names ("Food & Drink", "Accommodations", "Sightseeing", "Shopping") and returns "Unorganized" for unknown/empty/undefined inputs
- [ ] 1.2 Add `getKnownCollectionNames(): ReadonlySet<string>` that returns the set of all valid collection names
- [ ] 1.3 Add `getCategoryIcon(collectionName: string): string` that returns a Lucide icon name for each category (e.g., "utensils" for Food & Drink, "bed" for Accommodations, "camera" for Sightseeing, "shopping-bag" for Shopping, "map-pin" for Unorganized)
- [ ] 1.4 Add `getCategoryGradient(collectionName: string): string` that returns a Tailwind gradient class string for each category

## Task 2: Unit Tests for Category Mapper

- [ ] 2.1 Create `src/utils/__tests__/categories.test.ts` with example-based tests for all specific mappings (Requirements 1.1–1.4) and edge cases (Requirement 1.6: empty string, undefined)
- [ ] 2.2 [PBT] Create `src/utils/__tests__/categories.pbt.test.ts` — Property 1: closed-world mapping with unknown fallback. Generate arbitrary strings with fast-check, verify output is always in the known set, and that non-mapped strings return "Unorganized". Tag: `Feature: smart-pin-organizer, Property 1: Closed-world mapping with unknown fallback`. Min 100 runs.

## Task 3: Enhance addPin in Zustand Store

- [ ] 3.1 Import `getCollectionForType` in `src/store/useTravelPinStore.ts`
- [ ] 3.2 Modify `addPin` to call `getCollectionForType(pinData.primaryType)` to determine the target collection name
- [ ] 3.3 Add logic to find an existing collection by name or create a new one (with `uuidv4()` id) before assigning `collectionId` to the new pin
- [ ] 3.4 Add Supabase persistence for auto-created collections when `state.user` is non-null: fire-and-forget insert with error logging via `createClient()`

## Task 4: Store Property-Based Tests

- [ ] 4.1 [PBT] Create `src/store/__tests__/useTravelPinStore.pbt.test.ts` — Property 2: addPin assigns correct collection name. Generate random pins with random primaryType values, add to store, verify collectionId references a collection whose name matches `getCollectionForType(primaryType)`. Tag: `Feature: smart-pin-organizer, Property 2: addPin assigns correct collection name`. Min 100 runs.
- [ ] 4.2 [PBT] In same file — Property 3: Collection deduplication. Generate a random primaryType, add two pins with that type, verify both share the same collectionId and only one collection with that name exists. Tag: `Feature: smart-pin-organizer, Property 3: Collection deduplication on repeated primaryType`. Min 100 runs.
- [ ] 4.3 [PBT] In same file — Property 4: Preservation on pin addition. Generate a sequence of random pins, add them one by one, verify after each addition that all previous pins and collections still exist. Tag: `Feature: smart-pin-organizer, Property 4: Preservation on pin addition`. Min 100 runs.
- [ ] 4.4 [PBT] In same file — Property 5: Referential integrity. Generate random pins, add them, verify every pin's collectionId exists in the collections list. Tag: `Feature: smart-pin-organizer, Property 5: Referential integrity`. Min 100 runs.

## Task 5: Store Unit Tests for Edge Cases and Integration

- [ ] 5.1 Add tests to `src/store/__tests__/useTravelPinStore.test.ts` for: pin with undefined primaryType routes to "Unorganized" (Requirement 2.6), and Supabase collection insert is called when user is authenticated (Requirement 2.4, mocked)

## Task 6: PlaceSheet Category Pill

- [ ] 6.1 In `src/components/PlaceSheet.tsx`, look up the pin's collection from the store and render a category pill `<span>` above the title `<h2>` showing the collection name with rounded-full, px-3, py-1 styling and a subtle background color
- [ ] 6.2 Ensure the pill displays "Unorganized" when the pin belongs to the default collection

## Task 7: PlaceSheet Gradient Image Fallback

- [ ] 7.1 In `src/components/PlaceSheet.tsx`, add a conditional branch in the hero image section: when `pin.imageUrl` is falsy, render a gradient background using `getCategoryGradient(collectionName)` instead of the `<img>` elements
- [ ] 7.2 Render a centered Lucide icon on top of the gradient using `getCategoryIcon(collectionName)` to select the appropriate icon component

## Task 8: PlaceSheet Unit Tests

- [ ] 8.1 Create `src/components/__tests__/PlaceSheet.test.ts` with tests for: category pill renders with correct collection name (Req 3.1), pill shows "Unorganized" for default collection (Req 3.2), pill has distinct styling classes (Req 3.3), image renders when imageUrl is present (Req 4.1), gradient fallback renders when imageUrl is missing (Req 4.2), category icon renders on gradient (Req 4.3)

## Task 9: SavedLibrary Grouping Toggle

- [ ] 9.1 Add `groupPinsByCategory(pins: Pin[], collections: Collection[]): Record<string, Pin[]>` exported function to `src/components/planner/SavedLibrary.tsx` that groups pins by their collection name
- [ ] 9.2 Add `groupMode` state (`'region' | 'category'`, default `'region'`) and a segmented toggle control above the search bar
- [ ] 9.3 Wire the toggle to switch between `groupPinsByRegion` and `groupPinsByCategory` in the `useMemo` derivation, applying `filterPins` before grouping in both modes

## Task 10: SavedLibrary Property-Based Tests

- [ ] 10.1 [PBT] Create `src/components/planner/__tests__/SavedLibrary.pbt.test.ts` — Property 6: Category grouping is a correct partition. Generate random pins with random collectionIds and a matching collections array, call `groupPinsByCategory`, verify every pin appears exactly once and under the correct collection name group. Tag: `Feature: smart-pin-organizer, Property 6: Category grouping is a correct partition`. Min 100 runs.
- [ ] 10.2 [PBT] In same file — Property 7: Filter-before-group commutativity. Generate random pins and search queries, verify `groupPinsByCategory(filterPins(pins, query), collections)` produces groups where no excluded pin appears. Tag: `Feature: smart-pin-organizer, Property 7: Filter-before-group commutativity`. Min 100 runs.

## Task 11: SavedLibrary Unit Tests

- [ ] 11.1 Add tests to `src/components/planner/__tests__/SavedLibrary.test.ts` for: toggle control renders (Req 5.1), default mode is "Group by Region" (Req 5.4), switching mode re-renders without page reload (Req 5.5)
