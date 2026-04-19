# Implementation Plan: Travel Pin Board

## Overview

Implement a luxury minimalist travel pin board web application using Next.js 14 App Router, Tailwind CSS, Framer Motion, MapLibre GL JS, and Zustand. The implementation follows the pin creation pipeline: URL input → server-side scraping → geocoding → state persistence → map rendering with cinematic animation. Tasks are ordered to build foundational layers first (project setup, data models, state) then layer on UI components and server actions, wiring everything together at the end.

## Tasks

- [x] 1. Scaffold Next.js 14 project with design tokens and global styles
  - [x] 1.1 Initialize Next.js 14 App Router project with TypeScript, Tailwind CSS, Framer Motion, Lucide Icons, and MapLibre GL JS
    - Run `npx create-next-app@14` with App Router and TypeScript
    - Install dependencies: `framer-motion`, `lucide-react`, `maplibre-gl`, `zustand`, `uuid`, `cheerio`, `vaul`
    - _Requirements: 1.1_
  - [x] 1.2 Configure Tailwind design tokens and global CSS
    - Define color tokens: background #FAFAFA, surface #FFFFFF, primary #000000, accent #6366F1, border #E5E7EB
    - Define border-radius values: 16px (rounded-2xl) for cards, rounded-full for inputs
    - Configure Inter or Geist Sans as primary typeface with bold headers and tracking-tight
    - Define shadow-sm for cards and backdrop-blur-md for floating elements
    - Set up `app/layout.tsx` with font loading and global styles
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Define data models and Zustand store with LocalStorage persistence
  - [x] 2.1 Create Pin and Collection TypeScript interfaces
    - Create `src/types/index.ts` with `Pin`, `Collection`, `ScrapeResult`, `ScrapeError`, `GeocodeResult`, `GeocodeError` interfaces
    - Pin fields: id, title, imageUrl, sourceUrl, latitude, longitude, collectionId, createdAt
    - Collection fields: id, name, createdAt
    - _Requirements: 7.4_
  - [x] 2.2 Implement Zustand store with persist middleware
    - Create `src/store/useTravelPinStore.ts`
    - Implement state: pins, collections, activeCollectionId, isDrawerOpen
    - Implement actions: addPin, removePin, movePin, addCollection, removeCollection, setActiveCollection, toggleDrawer
    - Initialize with default "Unorganized" collection (id: "unorganized")
    - Configure persist middleware with `travel-pin-board-storage` key, partializing only pins and collections
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 2.3 Implement hydration-safe hook for SSR compatibility
    - Create `src/hooks/useHydrated.ts` with the hydration-safe pattern to prevent SSR/client mismatches
    - _Requirements: 7.2_
  - [ ]* 2.4 Write unit tests for Zustand store actions
    - Test addPin assigns "unorganized" collectionId by default
    - Test movePin updates collectionId correctly
    - Test removeCollection moves orphaned pins to "unorganized"
    - Test addCollection creates collection with UUID and timestamp
    - _Requirements: 7.1, 7.3_

- [x] 3. Implement server actions for URL scraping
  - [x] 3.1 Implement scrapeUrl server action
    - Create `src/actions/scrapeUrl.ts` with `'use server'` directive
    - Implement User-Agent rotation pool with 5+ browser UA strings
    - Implement HTML fetching with 15-second timeout
    - Implement retry logic: on 403, retry up to 3 times with different UA
    - Extract metadata: og:image → twitter:image → first large img; og:title → title tag
    - Extract location from og:locale, geo meta tags, structured data, or caption text patterns
    - Extract contextual hints from bio/caption content
    - Return ScrapeResult on success, ScrapeError on failure
    - Return placeholder image identifier when og:image is missing
    - Return error when location cannot be determined
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_
  - [ ]* 3.2 Write unit tests for scrapeUrl
    - Test User-Agent rotation selects from pool
    - Test retry logic on 403 responses
    - Test metadata extraction from sample HTML
    - Test error handling for unreachable URLs
    - _Requirements: 4.3, 4.4, 4.8_

- [x] 4. Implement server action for geocoding
  - [x] 4.1 Implement geocodeLocation server action
    - Create `src/actions/geocodeLocation.ts` with `'use server'` directive
    - Implement Nominatim API integration with `TravelPinBoard/1.0` User-Agent
    - Implement rate limiting: 1 request/second using timestamp-based throttle
    - Implement viewbox biasing when contextual hints are provided
    - Select highest importance result when multiple results returned; log alternatives
    - Implement 10-second timeout per request
    - Return GeocodeResult on success, GeocodeError on failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ]* 4.2 Write unit tests for geocodeLocation
    - Test viewbox biasing with contextual hints
    - Test highest importance selection from multiple results
    - Test error handling for no results and unreachable API
    - Test rate limiting enforcement
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 5. Checkpoint - Verify data layer and server actions
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement full-screen MapView component
  - [x] 6.1 Create MapView component with MapLibre GL JS
    - Create `src/components/MapView.tsx`
    - Initialize MapLibre with minimal light tile style (Maptiler Light or Alidade Smooth)
    - Render map as full-screen background with #FAFAFA background during tile loading
    - Suppress default POI icons and labels via style layer filtering
    - Support pan, zoom, and rotation with smooth inertial scrolling
    - Read pins from Zustand store and render/remove markers on state changes
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 6.2 Implement flyTo cinematic animation for new pins
    - On new pin creation, execute `flyTo` to pin coordinates with `pitch: 45`
    - On `moveend`, execute `easeTo({ pitch: 0 })` to return to level view
    - _Requirements: 2.5, 2.6_
  - [x] 6.3 Implement map resize behavior for Collection Drawer
    - When Collection Drawer opens on desktop, resize map container with CSS transition
    - _Requirements: 8.6_

- [x] 7. Implement Visual Marker and Marker Popover
  - [x] 7.1 Create VisualMarker element factory
    - Create `src/components/VisualMarker.ts` with `createVisualMarkerElement` function
    - Render 48×48px HTML element with 8px rounded corners, 2px white border, drop shadow
    - Display scraped image with aspect-ratio 1/1 and object-cover fit
    - Implement CSS keyframes scale-up pop-in animation (0 → 1.15 → 1.0 over 400ms)
    - Implement fallback: accent-colored (#6366F1) placeholder with Lucide map-pin icon on image load failure
    - Wire click handler to open MarkerPopover
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 7.2 Create MarkerPopover component
    - Create `src/components/MarkerPopover.tsx`
    - Render via `maplibregl.Popup` attached to marker coordinates
    - Display pin title and source URL as clickable link
    - _Requirements: 6.5_

- [x] 8. Implement MagicBar floating input component
  - [x] 8.1 Create MagicBar component with state machine
    - Create `src/components/MagicBar.tsx`
    - Implement state machine: idle → processing → error → success → idle
    - Style with rounded-full, border #E5E7EB, backdrop-blur-md, z-index: 40
    - Implement Framer Motion width expansion on focus
    - Implement URL validation (inline error for invalid URLs)
    - _Requirements: 3.1, 3.2, 3.5_
  - [x] 8.2 Implement processing states and sparkle animation
    - Show sparkle loading animation when URL is pasted
    - Display "Processing..." motion state and disable input during server action
    - Clear input and return to idle on success
    - _Requirements: 3.3, 3.4, 3.6_

- [x] 9. Implement Collection Drawer with responsive layout
  - [x] 9.1 Create CollectionDrawer component
    - Create `src/components/CollectionDrawer.tsx`
    - Desktop (≥768px): fixed left panel, 360px wide, slide-in with Framer Motion
    - Mobile (<768px): bottom-sheet using `vaul` Drawer with drag-to-dismiss
    - _Requirements: 8.1, 8.3, 10.2_
  - [x] 9.2 Create CollectionCard component
    - Create `src/components/CollectionCard.tsx`
    - Display collection name and 2×2 image grid preview from first four pin images
    - Always show "Unorganized" collection
    - On tap, display list of pins within the collection
    - _Requirements: 8.2, 8.4, 8.5_

- [x] 10. Checkpoint - Verify all UI components render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Wire end-to-end pin creation flow
  - [x] 11.1 Connect MagicBar to scrapeUrl and geocodeLocation server actions
    - On URL submit: call scrapeUrl → on success call geocodeLocation → create Pin in store
    - Handle errors at each step: display descriptive error in MagicBar, do not create partial pin
    - _Requirements: 9.1, 9.3_
  - [x] 11.2 Wire pin creation to map animation and marker rendering
    - After pin is added to store, trigger MapView flyTo with cinematic pitch
    - Render VisualMarker with pop-in animation within 2 seconds of flyTo completing
    - Ensure continuous visual feedback in MagicBar throughout the flow
    - _Requirements: 9.1, 9.2, 9.4_

- [x] 12. Implement responsive layout and final polish
  - [x] 12.1 Ensure responsive behavior across viewports
    - Map_View occupies full viewport on all screen sizes
    - MagicBar remains centered and usable at 320px width
    - Visual_Markers maintain 48×48px size across all viewports
    - Collection_Drawer switches between left panel and bottom-sheet at 768px breakpoint
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [ ]* 12.2 Write integration tests for end-to-end pin creation flow
    - Test full pipeline: URL input → scrape → geocode → store → marker render
    - Test error handling at each pipeline stage
    - Test MagicBar state transitions during flow
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Unit tests validate specific examples and edge cases
- No property-based tests are included as the design does not define correctness properties
