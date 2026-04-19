# Requirements Document

## Introduction

The YUPP travel pin board application currently uses a traditional scrolling web layout. This feature converts the application into a mobile-first "App Shell" that mimics the UX of native iOS apps like YaayTravel. The core architectural change is a "Layer Cake" model: the map is a permanently fixed background layer, and all interactive content (navigation, search, place details) floats above it in fixed-position UI elements and bottom sheets. The existing desktop CollectionDrawer and MarkerPopover are replaced by mobile-native interaction patterns.

## Glossary

- **App_Shell**: The root layout component (`AppLayout.tsx`) that establishes the fixed-viewport layer-cake architecture, rendering the Map_Layer at z-index 0 and all floating UI above it.
- **Viewport_Lock**: The CSS configuration applied to `html` and `body` elements that constrains the viewport to exactly `100dvh` × `100vw` with no scrolling or overscroll bounce.
- **Map_Layer**: The MapView component rendered as the permanent background at z-index 0, covering the entire screen.
- **Bottom_Nav**: The bottom navigation bar component (`BottomNav.tsx`) providing primary app navigation with three icon tabs: Discover, Add, and Profile.
- **Place_Sheet**: The bottom sheet component (`PlaceSheet.tsx`) built with the `vaul` Drawer that displays details for the active pin.
- **Magic_Bar**: The existing floating URL input component (`MagicBar.tsx`) used to create pins by pasting URLs.
- **Active_Pin**: The pin currently selected by the user, identified by `activePinId` in the Zustand store.
- **Glassmorphism**: A visual effect combining a semi-transparent white background (`bg-white/80`), backdrop blur (`backdrop-blur-xl`), and a subtle white border (`border-white/20`).
- **Travel_Pin_Store**: The Zustand-based global state store (`useTravelPinStore.ts`) managing pins, collections, and UI state.
- **Pin**: A saved travel destination with title, image, source URL, coordinates, and optional Google Places metadata.

## Requirements

### Requirement 1: Viewport Lock

**User Story:** As a mobile user, I want the app to fill my screen exactly without any browser bounce or scroll behavior, so that the experience feels like a native app rather than a web page.

#### Acceptance Criteria

1. THE Viewport_Lock SHALL set the `body` element dimensions to exactly `100dvh` height and `100vw` width.
2. THE Viewport_Lock SHALL apply `overflow: hidden` to both the `html` and `body` elements.
3. THE Viewport_Lock SHALL apply `overscroll-behavior: none` to the `body` element to prevent all default browser bounce and pull-to-refresh gestures.
4. THE Viewport_Lock SHALL set `position: fixed` on the `body` element to prevent iOS Safari address-bar-induced layout shifts.
5. THE Viewport_Lock SHALL apply `touch-action: none` to the `body` element to prevent default touch gestures outside of explicitly interactive regions.

### Requirement 2: App Shell Component

**User Story:** As a developer, I want a single layout component that establishes the layer-cake architecture, so that the map is always the background and all UI floats above it in a predictable z-index order.

#### Acceptance Criteria

1. THE App_Shell SHALL render the Map_Layer as a full-screen background at z-index 0.
2. THE App_Shell SHALL render the Magic_Bar, Bottom_Nav, and Place_Sheet as children layered above the Map_Layer.
3. THE App_Shell SHALL ensure that the Map_Layer remains permanently mounted and visible regardless of which floating UI elements are active.
4. THE App_Shell SHALL be implemented as a client component at `src/components/AppLayout.tsx`.
5. THE App_Shell SHALL replace the current inline layout in `src/app/page.tsx` as the sole top-level layout structure.

### Requirement 3: Bottom Navigation Bar

**User Story:** As a mobile user, I want a floating bottom navigation bar with clear icons, so that I can quickly switch between discovering places, adding pins, and viewing my profile or collections.

#### Acceptance Criteria

1. THE Bottom_Nav SHALL be positioned with `position: absolute` at the bottom of the viewport with a `bottom` offset of `1.5rem` (Tailwind `bottom-6`), centered horizontally.
2. THE Bottom_Nav SHALL apply the Glassmorphism effect using `bg-white/80`, `backdrop-blur-xl`, and `border border-white/20`.
3. THE Bottom_Nav SHALL display exactly three icon buttons using Lucide React icons: Compass for Discover, PlusCircle for Add, and User for Profile.
4. THE Bottom_Nav SHALL render the PlusCircle (Add) icon in the accent color `#6366F1`.
5. THE Bottom_Nav SHALL render the Compass and User icons in the primary color `#000000` by default.
6. WHEN a user taps the Discover icon, THE Bottom_Nav SHALL indicate the active state on the Discover icon.
7. WHEN a user taps the Add icon, THE Bottom_Nav SHALL trigger the Magic_Bar to receive focus for URL input.
8. WHEN a user taps the Profile icon, THE Bottom_Nav SHALL open the collections view.
9. THE Bottom_Nav SHALL have a z-index higher than the Map_Layer and lower than the Place_Sheet overlay.
10. THE Bottom_Nav SHALL use `rounded-full` border radius to create a pill shape.

### Requirement 4: Place Canvas Bottom Sheet

**User Story:** As a user, I want to see rich details about a place in a bottom sheet when I tap a map marker, so that I can view the image, title, category, and rating without leaving the map context.

#### Acceptance Criteria

1. WHEN the Travel_Pin_Store `activePinId` is set to a non-null value, THE Place_Sheet SHALL automatically open as a `vaul` Drawer from the bottom of the screen.
2. WHEN the Travel_Pin_Store `activePinId` is null, THE Place_Sheet SHALL remain closed.
3. THE Place_Sheet SHALL display a full-bleed, edge-to-edge image of the Active_Pin in the top half of the sheet.
4. THE Place_Sheet SHALL display the Active_Pin title with `text-2xl` size and `tracking-tight` letter spacing below the image.
5. WHEN the Active_Pin has a `primaryType` value, THE Place_Sheet SHALL display the type as a rounded pill badge.
6. WHEN the Active_Pin has a `rating` value, THE Place_Sheet SHALL display the numeric rating.
7. THE Place_Sheet SHALL display a primary action button labeled "Save" or "View Source" with the accent color `#6366F1` as background.
8. WHEN a user taps the "View Source" button, THE Place_Sheet SHALL open the Active_Pin `sourceUrl` in a new browser tab.
9. WHEN a user dismisses the Place_Sheet by dragging it down, THE Travel_Pin_Store SHALL set `activePinId` to null.
10. THE Place_Sheet SHALL have a z-index higher than the Bottom_Nav to overlay all other floating UI.

### Requirement 5: Magic Bar Refactoring

**User Story:** As a mobile user, I want the search bar to float prominently above the map with a strong shadow, so that it is clearly distinguishable from the map content beneath it.

#### Acceptance Criteria

1. THE Magic_Bar SHALL be positioned at `top: 3rem` (Tailwind `top-12`) from the top of the viewport.
2. THE Magic_Bar SHALL apply a `shadow-xl` box shadow to create a prominent floating appearance above the Map_Layer.
3. THE Magic_Bar SHALL maintain its existing URL input, processing animation, and clarification UI functionality.
4. THE Magic_Bar SHALL have a z-index higher than the Map_Layer and lower than the Place_Sheet overlay.

### Requirement 6: Active Pin State Management

**User Story:** As a user, I want tapping a map marker to seamlessly open the place detail sheet, so that I can view pin details with a single interaction.

#### Acceptance Criteria

1. THE Travel_Pin_Store SHALL include an `activePinId` property of type `string | null`, initialized to `null`.
2. THE Travel_Pin_Store SHALL provide a `setActivePinId` action that accepts a `string | null` parameter and updates the `activePinId` state.
3. WHEN a user taps a map marker, THE Map_Layer SHALL call `setActivePinId` with the corresponding Pin `id`.
4. WHEN the Place_Sheet is dismissed, THE Place_Sheet SHALL call `setActivePinId` with `null`.
5. THE Travel_Pin_Store SHALL NOT persist `activePinId` to localStorage, as it is transient UI state.

### Requirement 7: Marker Interaction Replacement

**User Story:** As a mobile user, I want tapping a marker to open the Place Sheet instead of a small popover, so that I get a richer, touch-friendly detail view.

#### Acceptance Criteria

1. WHEN a user taps a map marker, THE Map_Layer SHALL set the `activePinId` in the Travel_Pin_Store instead of calling `showMarkerPopover`.
2. THE Map_Layer SHALL no longer render MapLibre GL JS Popup popovers for marker clicks.
3. THE Map_Layer SHALL continue to perform the cinematic `flyTo` animation to the tapped marker coordinates before the Place_Sheet opens.
