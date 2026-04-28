# Requirements Document

## Introduction

Yupp is a social-travel PWA that lets users paste URLs from Instagram, Xiaohongshu, Douyin, and TikTok to pin places on a map, organise them into collections, and plan multi-day itineraries with drag-and-drop. The current UI has functional depth — vaul drawers, framer-motion accents, a working DnD planner — but suffers from inconsistent styling, missing design tokens, and surface-level UX gaps that hurt every user, every session.

This release rebuilds the visual foundation by introducing a complete design-token system (color, type, radius, elevation, motion) and applies that foundation to seven specific UI surfaces in one cohesive pass. The scope also covers undo-toast patterns, illustrated empty states, image loading resilience, haptic feedback, and accessibility improvements.

## Glossary

- **Design_Token_System**: The set of named Tailwind theme extensions and CSS custom properties that define color, typography, radius, elevation, and motion values for the entire application.
- **Brand_Palette**: The named color token set defined in `tailwind.config.ts` and mirrored as CSS custom properties on `:root`.
- **Radius_Scale**: The five named border-radius tokens (chip, control, card, sheet, pill) used across all components.
- **Type_Scale**: The six named typography presets (display, title, headline, body, caption, micro) defined as Tailwind `fontSize` extensions.
- **Elevation_Scale**: The four named box-shadow tokens (elev-0, elev-1, elev-2, elev-3, elev-modal) applied to layered surfaces.
- **Motion_System**: The set of duration tokens, easing curves, and framer-motion presets exported from `src/utils/motion.ts`.
- **Bottom_Nav**: The `BottomNav` component (`src/components/BottomNav.tsx`) providing primary tab navigation.
- **MagicBar**: The `MagicBar` component (`src/components/MagicBar.tsx`) providing URL input and scrape processing.
- **Platform_Chip**: A tappable chip rendered inside MagicBar that triggers processing of a demo URL for a specific social platform.
- **PlaceSheet**: The `PlaceSheet` vaul drawer component (`src/components/PlaceSheet.tsx`) displaying pin details.
- **DiscoverFeed**: The `DiscoverFeed` vaul drawer component (`src/components/DiscoverFeed.tsx`) displaying saved places in a grid.
- **DayContainer**: The `DayContainer` component (`src/components/planner/DayContainer.tsx`) rendering a single day in the trip timeline.
- **PlannerSidebar**: The `PlannerSidebar` component (`src/components/PlannerSidebar.tsx`) housing the planner panel and drawer.
- **ProfileSheet**: The `ProfileSheet` vaul drawer component (`src/components/ProfileSheet.tsx`) displaying user profile and collections.
- **Home_Surface**: The main map view area rendered by `AppLayout` when no drawers are open.
- **Trip_Card**: A horizontally scrollable card on the Home_Surface representing a saved itinerary.
- **Recent_Pins_Strip**: A horizontally scrollable row of 88×88 px pin thumbnails on the Home_Surface.
- **Undo_Toast**: A toast variant with an "Undo" action button and a 5-second countdown before committing a destructive operation.
- **Toast_Store**: The Zustand store at `src/store/useToastStore.ts` managing toast state.
- **PinImage**: A reusable image component at `src/components/PinImage.tsx` handling aspect-ratio reservation, placeholder, fade-in, and error fallback.
- **Haptics_Utility**: The utility module at `src/utils/haptics.ts` providing `tap()`, `success()`, and `error()` vibration functions.
- **Open-Meteo_API**: The free weather API (Open-Meteo) used to fetch forecast data for DayContainer weather chips.
- **Planner_Store**: The Zustand store at `src/store/usePlannerStore.ts` managing itinerary and planned-pin state.
- **Pin_Store**: The Zustand store at `src/store/useTravelPinStore.ts` managing pin and collection state.

## Requirements

### Requirement 1: Brand Palette Tokens

**User Story:** As a developer, I want a single source of truth for all brand colors defined as Tailwind tokens and CSS custom properties, so that every component uses consistent colors and a future dark theme can override values in one place.

#### Acceptance Criteria

1. THE Design_Token_System SHALL define the following named colors in `tailwind.config.ts` under `theme.extend.colors`: brand `#FF5A4E`, brand-soft `#FFE4E1`, brand-ink `#7A1F18`, surface `#FFFFFF`, surface-raised `#FAFAFA`, surface-sunken `#F4F4F5`, ink-1 `#0A0A0B`, ink-2 `#52525B`, ink-3 `#A1A1AA`, border `#E5E7EB`, border-strong `#D4D4D8`, success `#22C55E`, warning `#F59E0B`, danger `#EF4444`.
2. THE Design_Token_System SHALL retain `accent` as an alias that resolves to the `brand` color value.
3. THE Design_Token_System SHALL register a Tailwind plugin that provides category gradient utility classes (`bg-cat-food`, `bg-cat-stay`, `bg-cat-see`, `bg-cat-shop`, `bg-cat-default`) mapping to the gradients currently defined in `src/utils/categories.ts`.
4. THE Design_Token_System SHALL emit every palette color as a CSS custom property on the `:root` selector in `src/app/globals.css` using the naming convention `--color-{token-name}`.

### Requirement 2: Radius Scale

**User Story:** As a developer, I want a finite set of named border-radius tokens, so that rounded corners are consistent across all surfaces and easy to update globally.

#### Acceptance Criteria

1. THE Design_Token_System SHALL define five border-radius tokens in `tailwind.config.ts` under `theme.extend.borderRadius`: chip `8px`, control `12px`, card `16px`, sheet `24px`, pill `9999px`.
2. WHEN a component currently uses `rounded-[32px]`, THE component SHALL be migrated to use the `rounded-sheet` token class instead.
3. THE PlaceSheet, ProfileSheet, DiscoverFeed, and PlannerSidebar components SHALL each use the `rounded-sheet` token for their top-level drawer rounding.

### Requirement 3: Type Scale

**User Story:** As a developer, I want named typography presets in Tailwind, so that font sizes, line heights, letter spacing, and weights are applied consistently without magic numbers.

#### Acceptance Criteria

1. THE Design_Token_System SHALL define six `fontSize` entries in `tailwind.config.ts` under `theme.extend.fontSize`: display `["32px", {lineHeight:"36px", letterSpacing:"-0.5px", fontWeight:"700"}]`, title `["24px", {lineHeight:"28px", letterSpacing:"-0.4px", fontWeight:"700"}]`, headline `["17px", {lineHeight:"22px", letterSpacing:"-0.2px", fontWeight:"600"}]`, body `["15px", {lineHeight:"22px", letterSpacing:"0px", fontWeight:"400"}]`, caption `["13px", {lineHeight:"18px", letterSpacing:"0.1px", fontWeight:"500"}]`, micro `["11px", {lineHeight:"14px", letterSpacing:"0.4px", fontWeight:"600"}]`.
2. WHEN a component uses inline font-size, line-height, letter-spacing, or font-weight values that match a Type_Scale token, THE component SHALL be migrated to use the corresponding `text-{token}` utility class.

### Requirement 4: Elevation Scale

**User Story:** As a developer, I want named elevation tokens for box shadows, so that layering is visually consistent and each surface sits at a predictable depth.

#### Acceptance Criteria

1. THE Design_Token_System SHALL define five `boxShadow` entries in `tailwind.config.ts` under `theme.extend.boxShadow`: elev-0 `"none"`, elev-1 `"0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)"`, elev-2 `"0 4px 12px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)"`, elev-3 `"0 12px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)"`, elev-modal `"0 24px 80px rgba(0,0,0,0.16), 0 8px 24px rgba(0,0,0,0.10)"`.
2. WHEN a component uses inline `shadow-[...]` values for card, popover, bottom-sheet, or modal surfaces, THE component SHALL be migrated to the corresponding `shadow-elev-{n}` utility class.

### Requirement 5: Motion System

**User Story:** As a developer, I want centralised motion presets for durations and easings, so that animations feel cohesive and can be tuned globally.

#### Acceptance Criteria

1. THE Motion_System SHALL export three duration constants from `src/utils/motion.ts`: `DURATION_FAST` (0.15 seconds), `DURATION_BASE` (0.25 seconds), `DURATION_SLOW` (0.4 seconds).
2. THE Motion_System SHALL export three easing definitions from `src/utils/motion.ts`: `EASE_OUT` (cubic-bezier out curve), `EASE_IN` (cubic-bezier in curve), `EASE_SPRING` (framer-motion spring configuration with defined stiffness and damping).
3. THE Motion_System SHALL export reusable framer-motion transition preset objects (e.g., `fadeIn`, `slideUp`, `scaleIn`) that compose the duration and easing constants.
4. WHEN the MagicBar component contains animation definitions that duplicate Motion_System presets, THE MagicBar SHALL be refactored to import and use the shared presets from `src/utils/motion.ts`.
5. WHEN the user has enabled `prefers-reduced-motion`, THE Motion_System SHALL provide a reduced-motion variant that sets all durations to 0 seconds and disables spring physics.

### Requirement 6: Bottom Navigation Redesign

**User Story:** As a user, I want clearly labelled navigation tabs with smooth active-state feedback, so that I always know which section I am on and can switch confidently.

#### Acceptance Criteria

1. THE Bottom_Nav SHALL render each tab as an icon paired with a text label using the `caption` type token.
2. WHEN a tab is active, THE Bottom_Nav SHALL render a pill-shaped highlight behind the active tab using the `brand-soft` background color and the `pill` radius token.
3. WHEN a tab becomes active, THE Bottom_Nav SHALL animate the pill highlight to the new tab position using a framer-motion `layoutId` shared-layout animation.
4. THE Bottom_Nav SHALL set `aria-current="page"` on the active tab button element.
5. WHEN the user has enabled `prefers-reduced-motion`, THE Bottom_Nav SHALL replace the `layoutId` slide animation with an instant cross-fade transition.

### Requirement 7: MagicBar Empty-State and Platform Chips

**User Story:** As a new user, I want to see tappable platform demo chips and a cycling placeholder in the MagicBar, so that I understand what the app does and can try it immediately without finding my own URL.

#### Acceptance Criteria

1. WHILE the MagicBar is in the `idle` state and the input field is empty, THE MagicBar SHALL display four Platform_Chips labelled Instagram, Xiaohongshu, Douyin, and TikTok below the input field.
2. WHEN a user taps a Platform_Chip, THE MagicBar SHALL initiate the URL processing flow using the corresponding demo URL from `src/components/MagicBar.demoUrls.ts`.
3. THE MagicBar SHALL cycle the input placeholder text through platform-specific example phrases (e.g., "Paste an Instagram reel...", "Paste a Xiaohongshu post...") at a 3-second interval.
4. THE MagicBar SHALL store demo URLs in a dedicated module at `src/components/MagicBar.demoUrls.ts` exporting a record mapping platform names to URL strings.
5. WHEN the existing `needs_input` clarification UI code path is present in MagicBar, THE MagicBar SHALL remove that dead code path.

### Requirement 8: Home Surface — Trip Cards and Recent Pins

**User Story:** As a returning user, I want to see my saved trips and recent pins on the home screen, so that I can quickly resume planning or revisit a recently saved place.

#### Acceptance Criteria

1. WHILE a registered user has one or more itineraries in the Planner_Store, THE Home_Surface SHALL display a horizontally scrollable strip of Trip_Cards above the Bottom_Nav.
2. WHEN a user taps a Trip_Card, THE Home_Surface SHALL navigate to the corresponding trip planner view.
3. THE Home_Surface SHALL display a Recent_Pins_Strip showing the 12 most recently created pins from the Pin_Store as 88×88 pixel thumbnail images.
4. WHEN a user taps a Recent_Pins_Strip thumbnail, THE Home_Surface SHALL set that pin as the active pin and open the PlaceSheet.
5. WHILE any vaul drawer (PlaceSheet, DiscoverFeed, ProfileSheet, PlannerSidebar) is open, THE Home_Surface SHALL hide the Trip_Cards strip and Recent_Pins_Strip.
6. THE Home_Surface SHALL source Trip_Card and Recent_Pins_Strip data from existing Planner_Store and Pin_Store state without introducing new data-fetching logic.

### Requirement 9: PlaceSheet Information Density

**User Story:** As a user viewing a saved place, I want to see opening hours, price level, and an open/closed status at a glance, so that I can decide whether to visit without leaving the app.

#### Acceptance Criteria

1. WHEN a Pin has `openingHours` data, THE PlaceSheet SHALL display the opening hours in a collapsible section below the address.
2. WHEN a Pin has a `priceLevel` value, THE PlaceSheet SHALL display a price-level indicator (e.g., "$", "$$", "$$$") next to the place type badge.
3. WHEN a Pin has `openingHours` data, THE PlaceSheet SHALL display an open/closed status chip using the `success` token for open and the `danger` token for closed.
4. WHEN a Pin has multiple images, THE PlaceSheet SHALL display a horizontally swipeable photo carousel in the hero area instead of a single image.
5. WHEN a user taps "Remove from Map", THE PlaceSheet SHALL perform an optimistic removal and show an Undo_Toast instead of a `window.confirm` dialog.
6. THE PlaceSheet SHALL render a sticky bottom action row containing the "View Source" and "Open in Google Maps" buttons that remains visible during scroll.
7. THE PlaceSheet SHALL migrate all inline color, radius, shadow, and typography values to the corresponding Design_Token_System classes.
8. WHILE the user is in edit mode (editing title or description), THE PlaceSheet SHALL prevent the vaul drawer from being dismissed by drag gesture.

### Requirement 10: DiscoverFeed Search, Filter, Sort, and Multi-Select

**User Story:** As a user with many saved places, I want to search, filter by category, sort, and bulk-manage my pins, so that I can find and organise places efficiently.

#### Acceptance Criteria

1. THE DiscoverFeed SHALL display a sticky search bar at the top of the scrollable area that filters pins by title and address as the user types.
2. THE DiscoverFeed SHALL display a horizontally scrollable row of category filter chips below the search bar, allowing the user to filter pins by collection category.
3. THE DiscoverFeed SHALL provide a sort menu with three options: recently added, highest rated, and alphabetical.
4. WHEN a user long-presses a pin card, THE DiscoverFeed SHALL enter multi-select mode, visually indicating selected cards with a check overlay.
5. WHILE in multi-select mode, THE DiscoverFeed SHALL display a bulk action bar with options to delete selected pins and move selected pins to a collection.
6. WHEN a user confirms bulk delete, THE DiscoverFeed SHALL perform an optimistic removal of selected pins and show an Undo_Toast instead of a `window.confirm` dialog.
7. WHILE the DiscoverFeed is loading pin data, THE DiscoverFeed SHALL display skeleton placeholder cards matching the grid layout dimensions.

### Requirement 11: Planner DayContainer Metadata Header

**User Story:** As a user planning a trip day, I want to see the date, dominant city, stop count, distance, and weather at a glance, so that I can make informed scheduling decisions.

#### Acceptance Criteria

1. THE DayContainer SHALL display the day number and a formatted date (e.g., "Mon, Jun 16") in the header row.
2. THE DayContainer SHALL display the dominant city name derived from the addresses of the pins assigned to that day.
3. THE DayContainer SHALL display the stop count and total estimated distance for the day in the header.
4. WHEN the trip has a `tripDate` set and the day is within a 7-day forecast window, THE DayContainer SHALL fetch weather data from the Open-Meteo_API and display a weather chip showing temperature and condition icon.
5. IF the Open-Meteo_API request fails or the day falls outside the forecast window, THEN THE DayContainer SHALL hide the weather chip without displaying an error.
6. THE DayContainer header SHALL remain sticky at the top of its scroll container while the user scrolls through the day's pins.
7. WHEN a user taps the day header title, THE DayContainer SHALL enter an inline rename mode allowing the user to set a custom day label.
8. THE DayContainer SHALL migrate all inline color, radius, shadow, and typography values to the corresponding Design_Token_System classes.

### Requirement 12: Undo Toast Pattern

**User Story:** As a user, I want a 5-second undo window after destructive actions, so that I can recover from accidental deletions without losing data.

#### Acceptance Criteria

1. THE Toast_Store SHALL support an `undo` toast variant in addition to the existing `success`, `error`, and `info` variants.
2. THE Toast_Store SHALL expose an `addUndoToast(message: string, onUndo: () => void)` method that creates an Undo_Toast with a 5-second auto-dismiss timer.
3. WHEN a user taps the "Undo" button on an Undo_Toast within the 5-second window, THE Toast_Store SHALL invoke the `onUndo` callback and immediately dismiss the toast.
4. WHEN the 5-second window expires without the user tapping "Undo", THE Toast_Store SHALL dismiss the toast and allow the deferred destructive operation to commit.
5. THE PlaceSheet `handleRemove` function SHALL be migrated from `window.confirm` to the Undo_Toast pattern with optimistic removal and deferred cloud delete.
6. THE DiscoverFeed `handleRemove` function SHALL be migrated from `window.confirm` to the Undo_Toast pattern with optimistic removal and deferred cloud delete.
7. THE Toast_Store SHALL persist pending delete operations in a `localStorage` queue keyed by pin ID, so that deletions commit on next app load if the user closes the browser during the undo window.

### Requirement 13: Illustrated Empty States

**User Story:** As a new user encountering an empty screen, I want to see a friendly illustration and a clear call-to-action, so that I understand what the feature does and how to get started.

#### Acceptance Criteria

1. WHEN the Home_Surface has zero pins and zero itineraries, THE Home_Surface SHALL display an illustrated empty state with an inline SVG, a descriptive message, and a CTA button that focuses the MagicBar.
2. WHEN the DiscoverFeed has zero pins, THE DiscoverFeed SHALL display an illustrated empty state with an inline SVG, a descriptive message, and a CTA button that focuses the MagicBar.
3. WHEN the Planner TripTimeline has zero planned pins, THE TripTimeline SHALL display an illustrated empty state with an inline SVG, a descriptive message, and a CTA button that opens the LibraryPane.
4. WHEN the Planner LibraryPane has zero unplanned pins, THE LibraryPane SHALL display an illustrated empty state with an inline SVG and a descriptive message.
5. THE empty state illustrations SHALL be stored as inline SVG components in `src/components/empty-states/illustrations/` and SHALL use Brand_Palette token CSS custom properties for fill and stroke colors.
6. THE application SHALL include a `public/placeholder-pin.svg` file used as the fallback image for pins without a resolved image URL.

### Requirement 14: Image Loading Resilience

**User Story:** As a user, I want images to load gracefully with placeholders and fade-in transitions, so that the interface feels polished even on slow connections.

#### Acceptance Criteria

1. THE PinImage component SHALL reserve the correct aspect ratio using a CSS aspect-ratio property to prevent layout shift during image loading.
2. WHILE an image is loading, THE PinImage component SHALL display a deterministic gradient placeholder derived from the pin ID, so that the same pin always shows the same placeholder color.
3. WHEN an image finishes loading, THE PinImage component SHALL fade the image in over the placeholder using the `DURATION_BASE` motion token.
4. IF an image fails to load, THEN THE PinImage component SHALL display a fallback state using the deterministic gradient and a centered map-pin icon.
5. THE PinImage component SHALL be located at `src/components/PinImage.tsx` and SHALL use `next/image` with `remotePatterns` configured in `next.config.mjs` for Instagram, Xiaohongshu, Douyin, and TikTok CDN domains.

### Requirement 15: Haptic Feedback on Mobile

**User Story:** As a mobile user, I want subtle vibration feedback on key interactions, so that the app feels responsive and tactile.

#### Acceptance Criteria

1. THE Haptics_Utility SHALL export three functions from `src/utils/haptics.ts`: `tap()` for light feedback, `success()` for confirmation feedback, and `error()` for failure feedback.
2. WHEN a user taps a pin marker on the map, THE MapView component SHALL call `Haptics_Utility.tap()`.
3. WHEN a user taps a Platform_Chip in the MagicBar, THE MagicBar SHALL call `Haptics_Utility.tap()`.
4. WHEN a user toggles a pin in multi-select mode in the DiscoverFeed, THE DiscoverFeed SHALL call `Haptics_Utility.tap()`.
5. WHEN a pin is successfully created after URL processing, THE MagicBar SHALL call `Haptics_Utility.success()`.
6. WHEN a user saves a day in the planner, THE DayContainer SHALL call `Haptics_Utility.success()`.
7. WHEN a scrape or geocode operation fails, THE MagicBar SHALL call `Haptics_Utility.error()`.
8. WHEN the user has enabled `prefers-reduced-motion`, THE Haptics_Utility SHALL suppress all vibration calls.

### Requirement 16: Accessibility and Keyboard Support

**User Story:** As a user relying on assistive technology or keyboard navigation, I want all interactive elements to be properly labelled and keyboard-operable, so that I can use every feature of the application.

#### Acceptance Criteria

1. THE application SHALL use semantic `<button>` or `<a>` elements for all interactive controls, each with a descriptive `aria-label` attribute.
2. THE application SHALL display visible focus rings on all focusable elements using a consistent 2px offset ring style with the `brand` color.
3. WHEN the DiscoverFeed is in multi-select mode, THE DiscoverFeed SHALL support toggling pin selection with Space or Enter keys and exiting multi-select mode with the Escape key.
4. THE DiscoverFeed sort menu and category filter chips SHALL be fully navigable using the Tab key.
5. THE application SHALL provide `sr-only` (screen-reader-only) labels for icon-only buttons and decorative elements that convey meaning.
6. THE Bottom_Nav SHALL set `aria-current="page"` on the currently active tab.

### Requirement 17: Migration and Backwards Compatibility

**User Story:** As a developer, I want the token migration to be non-breaking, so that untouched components continue to work and existing tests pass without modification.

#### Acceptance Criteria

1. THE Design_Token_System SHALL retain `accent` as a color alias resolving to the `brand` token value, so that existing `text-accent`, `bg-accent`, and `border-accent` classes continue to work.
2. WHEN a component is migrated to Design_Token_System classes, THE migration SHALL be end-to-end within that component, replacing all inline magic values with token classes in a single pass.
3. THE migration SHALL leave components not listed in this requirements document visually and functionally unchanged.
4. THE migration SHALL maintain all existing test suites in a passing state without requiring test modifications.
5. THE migration SHALL introduce no new runtime dependencies beyond the Open-Meteo_API fetch for DayContainer weather data.
6. THE migration SHALL not alter the supported browser matrix or minimum browser version requirements.
