# Requirements Document

## Introduction

The Smart Pin Organizer transforms the existing "Unorganized" pin list into an AI-powered categorization system. When a user saves a pin (e.g., a ramen shop in Tokyo), the system automatically determines the venue category from the Google Place `primaryType` field and places the pin into a matching collection (e.g., "Food & Drink"). Collections are created on-the-fly when they do not yet exist. The PlaceSheet UI is enriched with a prominent category pill and a graceful image fallback, and the SavedLibrary gains a toggle to group pins by category in addition to the existing region grouping.

## Glossary

- **Pin**: A saved place record containing title, coordinates, image, source URL, and Google Place metadata such as `primaryType` and `rating`.
- **Collection**: A named folder that groups related pins. Every collection has a unique `id`, a `name`, and a `createdAt` timestamp.
- **Category_Mapper**: The pure utility function `getCollectionForType` that maps a Google Place `primaryType` string to a user-friendly collection name.
- **Pin_Store**: The Zustand store (`useTravelPinStore`) that manages pins and collections in local state and persists them to localStorage.
- **PlaceSheet**: The bottom-sheet drawer component that displays full details for a selected pin.
- **SavedLibrary**: The sidebar panel that lists all saved pins grouped by region or category.
- **Supabase_Client**: The Supabase browser client used for persisting collections and pins to the cloud database.
- **primaryType**: A string field on a Pin sourced from the Google Places API describing the venue type (e.g., `"restaurant"`, `"museum"`).

## Requirements

### Requirement 1: Category Mapping

**User Story:** As a user, I want each Google Place type to map to a human-readable collection name, so that my pins are sorted into intuitive folders.

#### Acceptance Criteria

1. WHEN the Category_Mapper receives a primaryType of "restaurant", "cafe", "bar", or "bakery", THE Category_Mapper SHALL return "Food & Drink".
2. WHEN the Category_Mapper receives a primaryType of "hotel", "lodging", or "apartment", THE Category_Mapper SHALL return "Accommodations".
3. WHEN the Category_Mapper receives a primaryType of "tourist_attraction", "museum", "park", or "zoo", THE Category_Mapper SHALL return "Sightseeing".
4. WHEN the Category_Mapper receives a primaryType of "shopping_mall" or "store", THE Category_Mapper SHALL return "Shopping".
5. WHEN the Category_Mapper receives a primaryType that does not match any defined mapping, THE Category_Mapper SHALL return "Unorganized".
6. WHEN the Category_Mapper receives an empty string or undefined value, THE Category_Mapper SHALL return "Unorganized".
7. FOR ALL valid primaryType strings, mapping then looking up the result in the known collection names set SHALL produce a value contained in the set {"Food & Drink", "Accommodations", "Sightseeing", "Shopping", "Unorganized"} (closed-world property).

### Requirement 2: Auto-Create Collections on Pin Save

**User Story:** As a user, I want collections to be created automatically when I save a pin, so that I never have to manually organize my pins.

#### Acceptance Criteria

1. WHEN a pin is added to the Pin_Store, THE Pin_Store SHALL determine the target collection name by passing the pin's primaryType to the Category_Mapper.
2. WHEN the target collection name already exists in the Pin_Store collections list, THE Pin_Store SHALL assign the existing collection's id to the new pin's collectionId field.
3. WHEN the target collection name does not exist in the Pin_Store collections list, THE Pin_Store SHALL create a new collection with that name before assigning its id to the new pin's collectionId field.
4. WHILE the user is authenticated, THE Pin_Store SHALL persist newly created collections to Supabase via the Supabase_Client.
5. THE Pin_Store SHALL preserve all previously existing collections and pins when a new collection is auto-created.
6. WHEN a pin has no primaryType defined, THE Pin_Store SHALL assign the pin to the "Unorganized" collection.
7. FOR ALL pins added to the Pin_Store, the pin's collectionId SHALL reference a collection that exists in the Pin_Store collections list (referential integrity property).

### Requirement 3: PlaceSheet Category Pill

**User Story:** As a user, I want to see the category of a place prominently displayed in the PlaceSheet, so that I can quickly understand what kind of venue it is.

#### Acceptance Criteria

1. WHEN a pin has a collectionId that maps to a named collection, THE PlaceSheet SHALL display the collection name as a pill element positioned above the pin title.
2. WHEN a pin belongs to the "Unorganized" collection, THE PlaceSheet SHALL display "Unorganized" in the category pill.
3. THE PlaceSheet SHALL render the category pill with a visually distinct background color and rounded shape to differentiate the pill from surrounding text.

### Requirement 4: PlaceSheet Image Fallback

**User Story:** As a user, I want to see a visually appealing placeholder when a pin has no image, so that the PlaceSheet still looks polished.

#### Acceptance Criteria

1. WHEN a pin has a valid imageUrl, THE PlaceSheet SHALL display the image in the hero area.
2. WHEN a pin has an empty or missing imageUrl, THE PlaceSheet SHALL display a gradient placeholder background in the hero area.
3. WHEN a pin has an empty or missing imageUrl, THE PlaceSheet SHALL display a centered category-appropriate icon on top of the gradient placeholder.
4. THE PlaceSheet SHALL use the pin's mapped collection name to select the appropriate icon for the gradient placeholder.

### Requirement 5: SavedLibrary Grouping Toggle

**User Story:** As a user, I want to toggle between grouping my saved pins by region and by category, so that I can browse my pins in the way that makes the most sense for my current task.

#### Acceptance Criteria

1. THE SavedLibrary SHALL display a toggle control that allows the user to switch between "Group by Region" and "Group by Category" modes.
2. WHEN the user selects "Group by Region", THE SavedLibrary SHALL group pins by their derived region extracted from the pin address, matching the current behavior.
3. WHEN the user selects "Group by Category", THE SavedLibrary SHALL group pins by their collection name.
4. THE SavedLibrary SHALL default to "Group by Region" mode on initial render.
5. WHEN the user switches grouping mode, THE SavedLibrary SHALL re-render the pin list immediately without a full page reload.
6. WHEN the user applies a search filter, THE SavedLibrary SHALL apply the filter before grouping in both modes.
7. FOR ALL pins displayed in "Group by Category" mode, each pin SHALL appear under exactly one category group matching its assigned collection name (partition property).
