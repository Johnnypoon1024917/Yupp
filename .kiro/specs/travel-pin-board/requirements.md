# Requirements Document

## Introduction

Travel Pin Board is a luxury minimalist web application that allows users to save and visualize travel destinations on an interactive map. Users paste URLs (e.g., Instagram links) into a floating input bar; the system scrapes metadata (image, title, location), geocodes the location, and renders custom visual markers on a full-screen map. Pins are organized into collections. The aesthetic follows a "Digital Editorial / Luxury Minimalist" design language with soft indigo accents, editorial typography, and smooth animations.

## Glossary

- **Map_View**: The full-screen MapLibre GL JS map component that renders the interactive travel map using a minimal, clutter-free tile style (Maptiler Light or Alidade Smooth).
- **Magic_Bar**: A floating, center-aligned input bar at the top of the viewport where users paste URLs to create new pins.
- **Visual_Marker**: A custom 48x48px HTML map marker with rounded corners, a white border, and a scraped cover image rendered with object-cover fit.
- **Collection_Drawer**: A slide-out panel (left side on desktop, bottom-sheet on mobile) that displays saved pin collections as large cards with 2x2 image grid previews.
- **Scraper**: A backend service using Cheerio/Metascraper that extracts og:image, og:title, and location string from a given URL.
- **Geocoder**: A service that converts a location string into latitude and longitude coordinates using the Nominatim (OpenStreetMap) API.
- **Pin**: A data entity representing a saved travel destination, containing a title, image URL, source URL, latitude, longitude, and collection assignment.
- **Collection**: A named group of Pins. Every new pin defaults to the "Unorganized" collection.
- **Design_Tokens**: The set of CSS custom properties and Tailwind configuration values that define the application's visual identity (colors, radii, typography, shadows).
- **State_Store**: A Zustand store with persist middleware that manages client-side application state and bridges LocalStorage with the database.

## Requirements

### Requirement 1: Project Initialization and Design Token System

**User Story:** As a developer, I want the project scaffolded with Next.js 14 App Router, Tailwind CSS, and global design tokens, so that all components share a consistent luxury minimalist aesthetic.

#### Acceptance Criteria

1. THE Project SHALL use Next.js 14 with the App Router, Tailwind CSS, Framer Motion, and Lucide Icons as its frontend stack.
2. THE Design_Tokens SHALL define the following color values: background #FAFAFA, surface #FFFFFF, primary #000000, accent #6366F1, and border #E5E7EB.
3. THE Design_Tokens SHALL define border-radius values of 16px (rounded-2xl) for cards and full-round (rounded-full) for input elements.
4. THE Design_Tokens SHALL specify Inter or Geist Sans as the primary typeface with bold headers and tracking-tight letter spacing for titles.
5. THE Design_Tokens SHALL define a soft shadow (shadow-sm) for card surfaces and a heavy background blur (backdrop-blur-md) for floating elements.
6. WHEN the application loads, THE Map_View SHALL render as the full-screen background with the off-white (#FAFAFA) background color visible during tile loading.

### Requirement 2: Full-Screen Map Rendering

**User Story:** As a user, I want to see a clean, full-screen interactive map when I open the application, so that I have an uncluttered canvas for my travel pins.

#### Acceptance Criteria

1. WHEN the application loads, THE Map_View SHALL render a full-screen MapLibre GL JS map using a minimal light tile style (Maptiler Light or Alidade Smooth).
2. THE Map_View SHALL suppress all default point-of-interest icons, labels, and map clutter so that only user-created Visual_Markers are displayed.
3. WHILE the map tiles are loading, THE Map_View SHALL display the off-white (#FAFAFA) background color as a seamless loading state.
4. THE Map_View SHALL support standard pan, zoom, and rotation interactions with smooth inertial scrolling.
5. WHEN a new Pin is created, THE Map_View SHALL execute a smooth flyTo animation to center on the new Pin's coordinates with the map pitch set to 45 degrees to create a cinematic 3D perspective during the fly.
6. WHEN the flyTo animation completes and the Visual_Marker pop-in animation finishes, THE Map_View SHALL smoothly ease the pitch back to 0 degrees to return to a level view.

### Requirement 3: Magic Bar Input

**User Story:** As a user, I want a floating input bar at the top of the map where I can paste a URL, so that I can quickly save travel destinations.

#### Acceptance Criteria

1. THE Magic_Bar SHALL render as a floating, horizontally center-aligned input bar at the top of the viewport with rounded-full corners, a subtle border (#E5E7EB), backdrop-blur-md background, and a z-index that positions the Magic_Bar above the Map_View but below any modal overlays.
2. WHEN the Magic_Bar receives focus, THE Magic_Bar SHALL expand slightly in width with a smooth Framer Motion transition.
3. WHEN a URL is pasted into the Magic_Bar, THE Magic_Bar SHALL display a sparkle loading animation to indicate processing has begun.
4. WHILE the Scraper is processing a URL, THE Magic_Bar SHALL display a "Processing..." motion state and disable further input.
5. IF the pasted text is not a valid URL, THEN THE Magic_Bar SHALL display an inline error message and remain ready for new input.
6. WHEN scraping and geocoding complete successfully, THE Magic_Bar SHALL clear its input field and return to its default idle state.

### Requirement 4: URL Scraping

**User Story:** As a user, I want the system to automatically extract the image, title, and location from a pasted URL, so that I do not have to enter pin details manually.

#### Acceptance Criteria

1. WHEN a valid URL is submitted through the Magic_Bar, THE Scraper SHALL extract the og:image, og:title, and location string from the target page using Cheerio or Metascraper.
2. THE Scraper SHALL execute as a Next.js Server Action or API Route on the backend to avoid CORS restrictions.
3. THE Scraper SHALL rotate User-Agent headers from a pool of common browser User-Agent strings on each outbound request to avoid 403 blocks from platforms such as Instagram and TikTok.
4. IF the Scraper receives a 403 Forbidden response, THEN THE Scraper SHALL retry the request with a different User-Agent header up to 3 times before returning an error.
5. WHEN scraping a social media URL, THE Scraper SHALL extract any available geographic context (e.g., bio location, tagged location, caption mentions) and include the context as a "contextual hint" alongside the primary location string in the scrape result.
6. IF the Scraper cannot extract an og:image from the target page, THEN THE Scraper SHALL return a placeholder image identifier.
7. IF the Scraper cannot extract a location string from the target page, THEN THE Scraper SHALL return an error indicating that the location could not be determined.
8. IF the target URL is unreachable or returns a non-200 status after all retry attempts, THEN THE Scraper SHALL return a descriptive error message within 15 seconds.

### Requirement 5: Geocoding

**User Story:** As a user, I want the extracted location to be converted into map coordinates automatically, so that my pin appears in the correct place on the map.

#### Acceptance Criteria

1. WHEN the Scraper returns a location string, THE Geocoder SHALL convert the location string into latitude and longitude coordinates using the Nominatim (OpenStreetMap) API.
2. WHEN the Scraper provides contextual hints (e.g., a city or region name from a social media bio), THE Geocoder SHALL use the contextual hint to bias the search by applying a geographic bounding box or viewbox parameter centered on the hinted region.
3. IF the Nominatim API returns multiple results for the location string, THEN THE Geocoder SHALL select the result with the highest importance score (most prominent) and log the alternative results to the console.
4. IF the Nominatim API returns no results for the location string, THEN THE Geocoder SHALL return an error indicating that the location could not be geocoded.
5. IF the Nominatim API is unreachable, THEN THE Geocoder SHALL return a descriptive error message within 10 seconds.
6. THE Geocoder SHALL respect Nominatim's usage policy by including a valid User-Agent header and limiting requests to one per second.

### Requirement 6: Visual Marker Rendering

**User Story:** As a user, I want my saved destinations to appear as beautiful image thumbnails on the map, so that the experience feels like a curated travel magazine.

#### Acceptance Criteria

1. WHEN a Pin is created with valid coordinates, THE Map_View SHALL render a Visual_Marker at the Pin's latitude and longitude.
2. THE Visual_Marker SHALL render as a 48x48px HTML element with 8px rounded corners, a 2px white border, a subtle drop shadow (0 2px 6px rgba(0,0,0,0.25)) to create a floating effect above the map surface, and the scraped image displayed with aspect-ratio 1/1 and object-cover fit.
3. WHEN a Visual_Marker is added to the Map_View, THE Visual_Marker SHALL animate in with a scale-up pop effect using Framer Motion or CSS keyframes.
4. IF the Pin's image fails to load, THEN THE Visual_Marker SHALL display a neutral placeholder with the accent color (#6366F1) background.
5. WHEN a user clicks a Visual_Marker, THE Map_View SHALL display the Pin's title and source URL in a minimal tooltip or popover.

### Requirement 7: Pin Persistence and State Management

**User Story:** As a user, I want my pins to be saved automatically, so that I do not lose my travel destinations when I close the browser.

#### Acceptance Criteria

1. WHEN a Pin is successfully created, THE State_Store SHALL persist the Pin data to LocalStorage using Zustand's persist middleware.
2. WHEN the application loads, THE State_Store SHALL restore all previously saved Pins from LocalStorage and render their Visual_Markers on the Map_View.
3. THE State_Store SHALL assign every new Pin to the "Unorganized" Collection by default.
4. THE Pin data model SHALL include the following fields: id, title, imageUrl, sourceUrl, latitude, longitude, collectionId, and createdAt timestamp.

### Requirement 8: Collection Drawer

**User Story:** As a user, I want to browse my saved pins organized into collections through a side panel, so that I can manage and revisit my travel destinations.

#### Acceptance Criteria

1. THE Collection_Drawer SHALL render as a slide-out panel from the left side on desktop viewports (width >= 768px) and as a bottom-sheet on mobile viewports (width < 768px).
2. THE Collection_Drawer SHALL display each Collection as a large card with the collection name and a 2x2 image grid preview composed of the first four Pin images in that collection.
3. WHEN a user opens the Collection_Drawer, THE Collection_Drawer SHALL animate in with a smooth slide transition using Framer Motion.
4. WHEN a user taps a Collection card, THE Collection_Drawer SHALL display the list of Pins within that Collection.
5. THE Collection_Drawer SHALL always display an "Unorganized" Collection containing all Pins that have not been assigned to a named collection.
6. WHEN the Collection_Drawer is open on desktop, THE Map_View SHALL resize to accommodate the drawer without overlapping content.

### Requirement 9: End-to-End Pin Creation Flow

**User Story:** As a user, I want to paste a link and see a pin appear on the map in one seamless interaction, so that saving travel destinations feels effortless and delightful.

#### Acceptance Criteria

1. WHEN a user pastes a valid URL into the Magic_Bar, THE system SHALL scrape metadata, geocode the location, create a Pin, persist the Pin to the State_Store, render a Visual_Marker on the Map_View, and fly the map to the new Pin's coordinates with a cinematic pitch tilt in a single uninterrupted flow.
2. WHILE the end-to-end flow is in progress, THE Magic_Bar SHALL display continuous visual feedback (sparkle animation followed by processing state).
3. IF any step in the flow fails (scraping, geocoding, or persistence), THEN THE system SHALL display a descriptive error message in the Magic_Bar and not create a partial Pin.
4. WHEN the flow completes successfully, THE Visual_Marker SHALL appear on the map with the pop-in animation within 2 seconds of the flyTo animation completing.

### Requirement 10: Responsive Layout

**User Story:** As a user, I want the application to work beautifully on both desktop and mobile devices, so that I can manage my travel pins from any device.

#### Acceptance Criteria

1. THE Map_View SHALL occupy the full viewport on all screen sizes.
2. WHEN the viewport width is less than 768px, THE Collection_Drawer SHALL render as a bottom-sheet (using vaul or equivalent) instead of a left-side panel.
3. THE Magic_Bar SHALL remain centered and fully usable on viewports as narrow as 320px.
4. THE Visual_Markers SHALL maintain their 48x48px size and legibility across all viewport sizes.
