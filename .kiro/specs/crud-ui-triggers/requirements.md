# Requirements Document

## Introduction

This feature connects missing CRUD UI triggers to existing Zustand store actions across four areas of the travel pin board application: inline collection creation in the place sheet, pin editing capability, collection management (rename/delete), and itinerary management confirmation dialogs. The goal is to give users full control over their saved data through intuitive, inline UI affordances that match the existing neutral/minimalist Tailwind aesthetic.

## Glossary

- **PlaceSheet**: The vaul bottom-sheet drawer component (`PlaceSheet.tsx`) that displays pin details and actions when a user selects a pin.
- **CollectionPicker**: The dropdown inside PlaceSheet that allows users to move a pin between collections.
- **CollectionDrawer**: The slide-in panel/bottom-sheet (`CollectionDrawer.tsx`) that lists all user collections with expandable pin previews.
- **CollectionCard**: A card component rendered inside CollectionDrawer that displays a single collection with its pins.
- **TravelPinStore**: The Zustand store (`useTravelPinStore.ts`) managing pins and collections state with local persistence and Supabase sync.
- **PlannerStore**: The Zustand store (`usePlannerStore.ts`) managing itineraries and day-based pin planning with Supabase CRUD.
- **ItineraryToolbar**: The toolbar component (`ItineraryToolbar.tsx`) that displays itinerary header actions (rename, delete, save, back).
- **Pin**: A saved place with title, description, image, coordinates, and collection assignment.
- **Collection**: A user-defined folder grouping pins, identified by UUID (or "unorganized" for the default).
- **Itinerary**: A named trip plan containing day-organized pins.
- **Supabase**: The cloud persistence backend used for authenticated user data sync.
- **Lucide**: The icon library (`lucide-react`) used throughout the application for UI icons.

## Requirements

### Requirement 1: Inline Collection Creation

**User Story:** As a user organizing a pin, I want to create a new collection directly from the collection picker dropdown, so that I do not have to leave the PlaceSheet to create a folder.

#### Acceptance Criteria

1. WHEN the CollectionPicker dropdown is open, THE PlaceSheet SHALL display a "+ New Collection" button at the bottom of the collection list.
2. WHEN the user clicks the "+ New Collection" button, THE PlaceSheet SHALL show an inline text input field and a "Save" button, controlled by a local `isCreatingCollection` state.
3. WHEN the user submits a non-empty collection name, THE PlaceSheet SHALL call `addCollection(newName)` on the TravelPinStore and receive the new Collection object.
4. WHEN the new collection is created successfully, THE PlaceSheet SHALL call `movePin(pin.id, newCollection.id)` on the TravelPinStore to assign the current pin to the new collection.
5. WHEN the pin is moved to the new collection, THE PlaceSheet SHALL close the CollectionPicker dropdown and reset the `isCreatingCollection` state to false.
6. WHEN the user submits an empty or whitespace-only collection name, THE PlaceSheet SHALL not call `addCollection` and SHALL keep the input field visible for correction.
7. THE PlaceSheet SHALL display a Plus icon from Lucide for the "+ New Collection" button, consistent with the existing icon style.

### Requirement 2: Edit Pin Capability

**User Story:** As a user, I want to edit pin titles and descriptions inline, so that I can fix typos or customize AI-generated content without removing and re-adding the pin.

#### Acceptance Criteria

1. THE TravelPinStore SHALL provide an `updatePin(id: string, updates: Partial<Pin>)` action that merges the provided updates into the matching pin's state.
2. WHEN the `updatePin` action is called with a valid pin ID, THE TravelPinStore SHALL update only the specified fields of the pin while preserving all other fields.
3. IF the `updatePin` action is called with an ID that does not match any existing pin, THEN THE TravelPinStore SHALL make no state changes.
4. THE PlaceSheet SHALL display a Pencil icon button near the pin title area.
5. WHEN the user clicks the Pencil icon, THE PlaceSheet SHALL enter edit mode by setting a local `isEditing` state to true.
6. WHILE the PlaceSheet is in edit mode, THE PlaceSheet SHALL replace the title `<h2>` element with an `<input>` field and the description `<p>` element with a `<textarea>` field, pre-populated with the current pin values.
7. WHILE the PlaceSheet is in edit mode, THE PlaceSheet SHALL display a "Save Changes" button.
8. WHEN the user clicks "Save Changes", THE PlaceSheet SHALL call `updatePin` on the TravelPinStore with the edited title and description values, then exit edit mode.
9. WHEN the user is authenticated and saves pin edits, THE PlaceSheet SHALL persist the updated title and description to Supabase by updating the corresponding row in the `pins` table.
10. IF the Supabase update fails for an authenticated user, THEN THE PlaceSheet SHALL retain the local store update and log the error to the console.

### Requirement 3: Collection Rename and Delete

**User Story:** As a user, I want to rename or delete my custom collections, so that I can keep my folders organized and remove ones I no longer need.

#### Acceptance Criteria

1. THE CollectionDrawer SHALL display a MoreVertical icon button on each CollectionCard, excluding the "Unorganized" default collection.
2. WHEN the user clicks the MoreVertical icon on a CollectionCard, THE CollectionDrawer SHALL display a dropdown menu with "Rename" and "Delete" options.
3. WHEN the user selects "Rename", THE CollectionDrawer SHALL display an inline text input pre-populated with the current collection name and a confirm button.
4. WHEN the user submits a non-empty rename value, THE CollectionDrawer SHALL update the collection name in the TravelPinStore and persist the change to Supabase for authenticated users.
5. WHEN the user selects "Delete", THE CollectionDrawer SHALL display a confirmation prompt before proceeding.
6. WHEN the user confirms deletion, THE CollectionDrawer SHALL call `removeCollection(id)` on the TravelPinStore, which moves contained pins back to "Unorganized".
7. WHEN the user is authenticated and deletes a collection, THE CollectionDrawer SHALL delete the collection row from the Supabase `collections` table.
8. THE CollectionDrawer SHALL not display rename or delete options for the "Unorganized" collection (id === "unorganized").
9. THE TravelPinStore SHALL provide a `renameCollection(id: string, newName: string)` action that updates the collection name in state.
10. IF the `renameCollection` action is called with the "unorganized" collection ID, THEN THE TravelPinStore SHALL make no state changes.

### Requirement 4: Itinerary Delete Confirmation

**User Story:** As a user, I want a confirmation dialog before deleting a trip, so that I do not accidentally lose my itinerary data.

#### Acceptance Criteria

1. WHEN the user clicks the delete button for an itinerary in the ItineraryToolbar, THE ItineraryToolbar SHALL display a confirmation dialog before calling `deleteItinerary`.
2. WHEN the user confirms the deletion in the dialog, THE ItineraryToolbar SHALL call `deleteItinerary(itineraryId)` on the PlannerStore.
3. WHEN the user cancels the deletion in the dialog, THE ItineraryToolbar SHALL close the dialog and make no changes to the itinerary.
4. THE ItineraryToolbar SHALL use a visually distinct confirmation dialog that clearly communicates the destructive nature of the action, including the itinerary name.
