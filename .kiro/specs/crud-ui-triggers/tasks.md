# Implementation Plan: CRUD UI Triggers

## Overview

Implement four CRUD UI trigger features across the travel pin board: new store actions (`updatePin`, `renameCollection`), inline collection creation and pin editing in PlaceSheet, collection management in CollectionDrawer/CollectionCard, and a styled delete confirmation dialog in ItineraryToolbar. All changes follow the existing local-first + fire-and-forget Supabase persistence pattern.

## Tasks

- [ ] 1. Add `updatePin` and `renameCollection` store actions
  - [x] 1.1 Add `updatePin` action to `useTravelPinStore`
    - Add `updatePin: (id: string, updates: Partial<Pin>) => void` to the `TravelPinStore` interface
    - Implement the action: merge `updates` into the matching pin via spread, no-op if ID not found
    - Add fire-and-forget Supabase `update` on the `pins` table for authenticated users
    - Log errors to console on Supabase failure; retain local state
    - _Requirements: 2.1, 2.2, 2.3, 2.9, 2.10_

  - [ ]* 1.2 Write property test: updatePin merge correctness
    - **Property 2: updatePin merge correctness**
    - Generate random pins and `Partial<Pin>` updates with fast-check; verify fields in `updates` match the update value and fields NOT in `updates` match the original
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 1.3 Write property test: updatePin no-op on non-existent ID
    - **Property 3: updatePin no-op on non-existent ID**
    - Generate store state with pins and a non-matching ID; verify the pins array is unchanged after calling `updatePin`
    - **Validates: Requirements 2.3**

  - [x] 1.4 Add `renameCollection` action to `useTravelPinStore`
    - Add `renameCollection: (id: string, newName: string) => void` to the `TravelPinStore` interface
    - Implement the action: update `collection.name` for matching ID, no-op if `id === 'unorganized'`
    - Add fire-and-forget Supabase `update` on the `collections` table for authenticated users
    - Log errors to console on Supabase failure; retain local state
    - _Requirements: 3.4, 3.9, 3.10_

  - [ ]* 1.5 Write property test: renameCollection updates name and preserves other fields
    - **Property 5: renameCollection name update + field preservation**
    - Generate non-default collections and new names; verify only `name` changes while `id`, `createdAt`, `user_id`, `isPublic` are preserved
    - **Validates: Requirements 3.9**

  - [ ]* 1.6 Write property test: renameCollection no-op on Unorganized
    - **Property 6: renameCollection no-op on Unorganized**
    - Generate arbitrary new names; verify calling `renameCollection("unorganized", newName)` leaves the collections array unchanged
    - **Validates: Requirements 3.10**

- [x] 2. Checkpoint — Verify store actions
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Implement PlaceSheet inline collection creation
  - [x] 3.1 Add inline collection creation UI to PlaceSheet
    - Add `isCreatingCollection` and `newCollectionName` local state
    - Add a `Plus` icon button at the bottom of the collection dropdown list
    - When clicked, show an inline `<input>` + "Save" button replacing the Plus button
    - On submit with non-empty name: call `addCollection(name)`, then `movePin(pin.id, newCollection.id)`, close dropdown, reset state
    - On empty/whitespace submit: no-op, keep input visible
    - Wire `addCollection` from `useTravelPinStore`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 3.2 Write property test: whitespace collection names are rejected
    - **Property 1: Whitespace collection names are rejected**
    - Generate whitespace-only strings; verify submitting them does not call `addCollection` and the store's collection list remains unchanged
    - **Validates: Requirements 1.6**

- [ ] 4. Implement PlaceSheet edit pin capability
  - [x] 4.1 Add edit pin UI to PlaceSheet
    - Add `isEditing`, `editTitle`, `editDescription` local state
    - Add a `Pencil` icon button near the pin title area
    - In edit mode: replace `<h2>` with `<input>`, replace description `<p>` with `<textarea>`, pre-populated with current values
    - Add a "Save Changes" button that calls `updatePin(pin.id, { title, description })` and exits edit mode
    - Wire `updatePin` from `useTravelPinStore`
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 5. Checkpoint — Verify PlaceSheet changes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement CollectionCard management menu
  - [x] 6.1 Add MoreVertical menu to CollectionCard
    - Add `menuOpen`, `isRenaming`, `renameValue` local state
    - Add `onRename` and `onDelete` callback props; add `isDefault` prop (true for "unorganized")
    - Render a `MoreVertical` icon button on non-default cards
    - Show a dropdown with "Rename" and "Delete" options when menu is open
    - "Rename": show inline `<input>` pre-populated with current name + confirm/cancel buttons; on submit call `onRename(id, newName)`
    - "Delete": call `window.confirm` then `onDelete(id)` on confirmation
    - Hide menu for default collection (`isDefault === true`)
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.8_

  - [ ]* 6.2 Write property test: removeCollection moves pins to Unorganized
    - **Property 4: removeCollection moves pins to Unorganized**
    - Generate non-default collections with pins; verify after `removeCollection(id)` all affected pins have `collectionId === "unorganized"` and the collection is removed
    - **Validates: Requirements 3.6**

- [ ] 7. Wire CollectionDrawer to CollectionCard management actions
  - [x] 7.1 Update CollectionDrawer to pass management callbacks
    - Wire `renameCollection` and `removeCollection` from `useTravelPinStore` into `DrawerContent`
    - Pass `onRename`, `onDelete`, and `isDefault` props to each `CollectionCard`
    - Add fire-and-forget Supabase delete on the `collections` table for authenticated users when deleting
    - _Requirements: 3.4, 3.6, 3.7, 3.8_

- [ ] 8. Implement ItineraryToolbar delete confirmation dialog
  - [x] 8.1 Replace direct delete with styled confirmation dialog
    - Add `showDeleteConfirm` and `deletingId` local state
    - On delete button click: set `showDeleteConfirm = true` and `deletingId` to the itinerary ID instead of calling `deleteItinerary` directly
    - Render a styled overlay + dialog panel showing the itinerary name and a warning about permanent deletion
    - "Delete" button (red/destructive): calls `deleteItinerary(id)`, closes dialog
    - "Cancel" button: closes dialog, no state changes
    - Apply to both the active itinerary header delete and the list row delete
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1–6)
- All Supabase persistence follows the existing fire-and-forget pattern — update local state synchronously, then attempt cloud write without blocking UI
