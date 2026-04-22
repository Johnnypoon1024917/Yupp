# Requirements Document

## Introduction

This specification covers a combined QA hotfix and new feature batch for the travel pin-board PWA. It addresses five areas: removing an iOS-hostile automatic clipboard polling mechanism from AppLayout, replacing it with an explicit user-initiated "Paste & Scan" button in MagicBar, fixing a CSS clipping bug in the PlaceSheet collection dropdown, adding Enter-to-save keyboard support on the PlaceSheet edit title input, and introducing a new "Country" grouping mode for the SavedLibrary and LibraryPane components backed by a new `extractCountry` address utility.

## Glossary

- **AppLayout**: The root client component (`src/components/AppLayout.tsx`) that composes the map, navigation, MagicBar, drawers, and sheets.
- **MagicBar**: The floating URL input bar (`src/components/MagicBar.tsx`) where users paste travel links to create pins.
- **PlaceSheet**: The Vaul-based bottom drawer (`src/components/PlaceSheet.tsx`) that displays pin details, editing controls, and the collection picker dropdown.
- **Collection_Dropdown**: The absolutely-positioned dropdown inside PlaceSheet that lists collections and the inline "New Collection" input.
- **SavedLibrary**: The planner sidebar component (`src/components/planner/SavedLibrary.tsx`) that displays saved pins grouped by region or category with a segmented toggle.
- **LibraryPane**: The planner component (`src/components/planner/LibraryPane.tsx`) that displays saved pins grouped by city.
- **Pin**: A saved travel location record containing title, address, coordinates, imageUrl, sourceUrl, collectionId, and other metadata.
- **Clipboard_Polling**: The `useEffect` block in AppLayout that attaches a `window.addEventListener('focus', handleFocus)` listener to automatically read the system clipboard on every window focus event.
- **LinkBanner**: The notification banner component (`src/components/LinkBanner.tsx`) rendered by AppLayout when a clipboard URL is detected.
- **Paste_Button**: A new icon button using the `Clipboard` lucide-react icon placed adjacent to the MagicBar text input.
- **extractCountry**: A new utility function in `src/utils/address.ts` that extracts the country name from a Google Places formatted address.
- **processUrl**: The existing async function inside MagicBar that validates, scrapes, geocodes, and pins a URL.

## Requirements

### Requirement 1: Remove Automatic Clipboard Polling from AppLayout

**User Story:** As a mobile user on iOS Safari, I want the app to stop reading my clipboard automatically on window focus, so that iOS does not penalize the app with privacy warnings or degraded performance.

#### Acceptance Criteria

1. THE AppLayout SHALL NOT contain a `useEffect` block that binds a `focus` event listener to the `window` object for clipboard detection.
2. THE AppLayout SHALL NOT render the LinkBanner component or maintain `bannerUrl` or `bannerPlatform` state variables.
3. THE AppLayout SHALL NOT import or reference `extractSupportedUrl` or `formatPlatformName` from `@/utils/urlParsing`.
4. THE AppLayout SHALL NOT import or reference `detectPlatform` from `@/actions/extractPlaces`.
5. THE AppLayout SHALL NOT declare or use a `processedLinksRef` ref for tracking previously detected clipboard URLs.
6. WHEN AppLayout is rendered, THE AppLayout SHALL preserve all other existing functionality including the `autoPaste` query parameter consumption, DndContext, MapView, MagicBar, BottomNav, PlaceSheet, ProfileSheet, DiscoverFeed, CollectionDrawer, PlannerSidebar, and AuthModal.

### Requirement 2: Add Explicit Paste and Scan Button to MagicBar

**User Story:** As a user, I want a visible "Paste" button next to the URL input in MagicBar, so that I can explicitly paste and process a clipboard URL with a single tap instead of relying on invisible clipboard polling.

#### Acceptance Criteria

1. WHEN the MagicBar is in idle state, THE MagicBar SHALL display a Paste_Button adjacent to the text input element inside the form, using the `Clipboard` icon from the `lucide-react` library.
2. WHEN the user taps the Paste_Button, THE MagicBar SHALL invoke `navigator.clipboard.readText()` to read the current clipboard contents.
3. WHEN `navigator.clipboard.readText()` returns text that passes the `isValidUrl` validation, THE MagicBar SHALL call `processUrl(trimmed, true)` with the trimmed clipboard text.
4. WHEN `navigator.clipboard.readText()` returns text that does not pass the `isValidUrl` validation, THE MagicBar SHALL not call `processUrl` and SHALL not display an error.
5. IF `navigator.clipboard.readText()` throws an error (permission denied or unavailable API), THEN THE MagicBar SHALL silently ignore the error without displaying a notification.
6. WHILE the MagicBar is in the `processing` state, THE Paste_Button SHALL be hidden or disabled to prevent duplicate submissions.

### Requirement 3: Fix Collection Dropdown CSS Clipping in PlaceSheet

**User Story:** As a user creating a new collection from the PlaceSheet dropdown, I want the "New Collection" input to be fully visible, so that the input field is not cut off by an overflow-hidden container.

#### Acceptance Criteria

1. THE Collection_Dropdown outer wrapper (the absolutely-positioned `div`) SHALL use `overflow-visible` instead of `overflow-hidden` so that child content extending beyond the dropdown boundary is not clipped.
2. THE Collection_Dropdown inner wrapper that maps over the collection buttons SHALL apply `rounded-b-lg overflow-hidden` to maintain rounded corners on the scrollable collection list without clipping the "New Collection" input area.
3. WHEN the user opens the collection picker and clicks "New Collection", THE PlaceSheet SHALL display the inline collection name input fully visible without any portion being clipped by a parent container.

### Requirement 4: Enter Key to Save Edited Pin Title in PlaceSheet

**User Story:** As a user editing a pin title in PlaceSheet, I want to press the Enter key to save my changes, so that I do not have to scroll down to find and tap the "Save Changes" button.

#### Acceptance Criteria

1. WHILE the PlaceSheet is in editing mode, THE editTitle input element SHALL listen for `keydown` events.
2. WHEN the user presses the Enter key while focused on the editTitle input, THE PlaceSheet SHALL invoke the `handleSaveEdit` function to persist the title and description changes.
3. WHEN the user presses any key other than Enter while focused on the editTitle input, THE PlaceSheet SHALL not invoke `handleSaveEdit`.

### Requirement 5: Country Extraction Utility

**User Story:** As a developer, I want an `extractCountry` utility function, so that pins can be grouped by country using the last segment of a Google Places formatted address.

#### Acceptance Criteria

1. THE extractCountry function SHALL be exported from `src/utils/address.ts`.
2. WHEN a valid address string containing at least one comma is provided, THE extractCountry function SHALL return the trimmed last comma-separated segment as the country name.
3. WHEN an address string containing no commas is provided, THE extractCountry function SHALL return the trimmed full string as the country name.
4. WHEN an empty string or undefined value is provided, THE extractCountry function SHALL return the string "Unknown Country".
5. FOR ALL valid address strings, parsing with extractCountry then embedding the result back into an address with the same trailing segment SHALL produce an equivalent country value (round-trip property).

### Requirement 6: Country Grouping Mode in SavedLibrary

**User Story:** As a user browsing saved pins in the planner sidebar, I want a "Country" grouping option alongside "Region" and "Category", so that I can organize my pins by the country they belong to.

#### Acceptance Criteria

1. THE SavedLibrary segmented toggle SHALL display three options: "Region", "Category", and "Country".
2. WHEN the user selects the "Country" grouping mode, THE SavedLibrary SHALL group filtered pins by the value returned by `extractCountry` applied to each pin's `address` field.
3. WHEN the user selects the "Country" grouping mode, THE SavedLibrary SHALL display each country group with its name as the section header and a count of pins in that group.
4. THE SavedLibrary SHALL default to the "Region" grouping mode on initial render.
5. WHEN the user switches between "Region", "Category", and "Country" modes, THE SavedLibrary SHALL re-group the currently filtered pins without resetting the search query.

### Requirement 7: Country Grouping Mode in LibraryPane

**User Story:** As a user browsing pins in the LibraryPane, I want a "Country" grouping option alongside the existing city grouping, so that I can view my pins organized by country.

#### Acceptance Criteria

1. THE LibraryPane SHALL provide a mechanism to switch between "City" and "Country" grouping modes.
2. WHEN the user selects the "Country" grouping mode, THE LibraryPane SHALL group filtered pins by the value returned by `extractCountry` applied to each pin's `address` field.
3. WHEN the user selects the "Country" grouping mode, THE LibraryPane SHALL display each country group with its name as the section header and a count of pins in that group.
4. THE LibraryPane SHALL default to the "City" grouping mode on initial render.
5. WHEN the user switches between "City" and "Country" modes, THE LibraryPane SHALL re-group the currently filtered pins without resetting the search query.
