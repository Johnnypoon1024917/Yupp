# Requirements Document

## Introduction

YUPP is a Next.js 14 travel app that lets users paste social media URLs to create map pins. The current geocoding pipeline uses Nominatim (OpenStreetMap), which struggles with messy, semantic location data scraped from social media (restaurant names, landmarks, colloquial place references). This feature replaces Nominatim with the Google Places API (New) for higher-quality geocoding and introduces a Human-in-the-Loop UI fallback so users can manually clarify ambiguous locations instead of hitting a dead-end error.

## Glossary

- **Geocoder**: The server action (`geocodeLocation`) responsible for converting a location string into geographic coordinates.
- **Google_Places_API**: The Google Places API (New) Text Search endpoint (`POST https://places.googleapis.com/v1/places:searchText`) used to resolve location strings to place data.
- **MagicBar**: The primary input component (`src/components/MagicBar.tsx`) where users paste URLs and interact with the scrape-and-pin pipeline.
- **EnrichedData**: A data structure containing supplementary place metadata returned by Google Places (placeId, primaryType, rating).
- **GeocodeResult**: A discriminated union type representing the outcome of a geocoding operation: SUCCESS, NEEDS_USER_INPUT, or ERROR.
- **FieldMask**: The `X-Goog-FieldMask` HTTP header sent to Google Places API to restrict the response to only requested fields, reducing billed cost.
- **Confidence_Logic**: The decision algorithm that inspects Google Places API results to determine whether the geocode is high-confidence (single clear match) or ambiguous (zero or multiple results).
- **Needs_Input_State**: The MagicBar UI state displayed when the Geocoder cannot resolve a location with high confidence, prompting the user to manually clarify.
- **Scraper**: The server action (`scrapeUrl`) that extracts metadata (title, imageUrl, location, contextualHints) from a pasted URL.

## Requirements

### Requirement 1: Remove Nominatim Integration

**User Story:** As a developer, I want all Nominatim API logic removed from the geocoding server action, so that the codebase has a single, clean geocoding path through Google Places.

#### Acceptance Criteria

1. THE Geocoder SHALL contain no references to the Nominatim API base URL, Nominatim-specific types, Nominatim rate-limiting logic, or Nominatim query functions.
2. THE Geocoder SHALL not import or use any Nominatim-related constants, interfaces, or helper functions.

### Requirement 2: Google Places API Integration

**User Story:** As a developer, I want the Geocoder to use the Google Places API (New) Text Search endpoint, so that semantic and messy location strings from social media are resolved accurately.

#### Acceptance Criteria

1. WHEN the Geocoder receives a location string and optional contextual hints, THE Geocoder SHALL send a POST request to `https://places.googleapis.com/v1/places:searchText` with a `textQuery` field combining the location string and contextual hints (e.g., "Cedric Grolet, Paris").
2. THE Geocoder SHALL include the `X-Goog-FieldMask` header set to `places.location,places.displayName,places.primaryType,places.rating,places.id` on every request to the Google_Places_API.
3. THE Geocoder SHALL include the `X-Goog-Api-Key` header populated from the `GOOGLE_PLACES_API_KEY` environment variable on every request to the Google_Places_API.
4. IF the `GOOGLE_PLACES_API_KEY` environment variable is not set, THEN THE Geocoder SHALL return an ERROR GeocodeResult with a descriptive error message without making any network request.
5. THE Geocoder SHALL set a request timeout of 10 seconds for calls to the Google_Places_API.
6. IF the Google_Places_API returns a non-OK HTTP status, THEN THE Geocoder SHALL return an ERROR GeocodeResult containing the HTTP status code in the error message.

### Requirement 3: Confidence Logic

**User Story:** As a user, I want the system to determine whether a geocoding result is trustworthy, so that I only get auto-pinned when the location is unambiguous.

#### Acceptance Criteria

1. WHEN the Google_Places_API returns exactly one result, THE Geocoder SHALL return a SUCCESS GeocodeResult containing lat, lng, displayName, and enrichedData.
2. WHEN the Google_Places_API returns zero results, THE Geocoder SHALL return a NEEDS_USER_INPUT GeocodeResult containing the original scraped title and image URL as partialData.
3. WHEN the Google_Places_API returns multiple results, THE Geocoder SHALL return a NEEDS_USER_INPUT GeocodeResult containing the original scraped title and image URL as partialData.
4. IF the Google_Places_API request throws a network error or times out, THEN THE Geocoder SHALL return an ERROR GeocodeResult with a descriptive error message.

### Requirement 4: Type Definitions Update

**User Story:** As a developer, I want the type system to accurately represent all possible geocoding outcomes, so that the frontend can handle each case with type safety.

#### Acceptance Criteria

1. THE EnrichedData interface SHALL contain the fields: `placeId` (string), `primaryType` (optional string), and `rating` (optional number).
2. THE GeocodeResult type SHALL be a discriminated union with a `status` field supporting three variants: `SUCCESS` (containing lat, lng, displayName, enrichedData), `NEEDS_USER_INPUT` (containing partialData with title and imageUrl), and `ERROR` (containing an error message string).
3. THE GeocodeResult type SHALL replace the existing `GeocodeResult` and `GeocodeError` interfaces in `src/types/index.ts`.

### Requirement 5: MagicBar State Machine Update

**User Story:** As a user, I want the MagicBar to handle ambiguous locations gracefully instead of showing an error, so that I can manually clarify the location and still create a pin.

#### Acceptance Criteria

1. THE MagicBar SHALL support the following states: `idle`, `processing`, `needs_input`, `success`, and `error`.
2. WHEN the Geocoder returns a NEEDS_USER_INPUT result, THE MagicBar SHALL transition to the `needs_input` state.
3. WHEN the Geocoder returns a SUCCESS result, THE MagicBar SHALL transition to the `success` state.
4. WHEN the Geocoder returns an ERROR result, THE MagicBar SHALL transition to the `error` state.
5. WHILE in the `needs_input` state, THE MagicBar SHALL display the Needs_Input_State UI instead of a red error message.

### Requirement 6: Needs-Input UI

**User Story:** As a user, I want a friendly, non-alarming prompt when the system cannot resolve my location, so that I can provide clarification without feeling like something broke.

#### Acceptance Criteria

1. WHEN the MagicBar enters the `needs_input` state, THE MagicBar SHALL smoothly expand downward using Framer Motion layout animation.
2. WHILE in the `needs_input` state, THE MagicBar SHALL display the scraped thumbnail image on the left side of the expanded area.
3. WHILE in the `needs_input` state, THE MagicBar SHALL display the message "We saved the vibe! Where exactly is this?" as a friendly prompt.
4. WHILE in the `needs_input` state, THE MagicBar SHALL render a text input field where the user can type a venue name or address.
5. WHILE in the `needs_input` state, THE MagicBar SHALL NOT display any red error styling or error iconography.
6. WHEN the user types a clarification string and presses Enter in the Needs_Input_State, THE MagicBar SHALL send that string to the Geocoder server action as a new geocoding request.
7. WHEN the clarification geocoding request returns SUCCESS, THE MagicBar SHALL create the pin and transition to the `success` state.
8. IF the clarification geocoding request returns ERROR or NEEDS_USER_INPUT again, THEN THE MagicBar SHALL remain in the `needs_input` state and allow the user to try again.

### Requirement 7: Design Tokens and Animation

**User Story:** As a user, I want the Needs-Input UI to feel like a natural extension of the MagicBar, so that the experience is seamless and consistent with the app's editorial aesthetic.

#### Acceptance Criteria

1. THE MagicBar SHALL use the Framer Motion `layout` prop to animate the expansion when transitioning to the `needs_input` state.
2. THE MagicBar expanded area SHALL use `rounded-2xl` border radius, `backdrop-blur-md` background blur, and crisp border styling consistent with the existing MagicBar design.
3. THE MagicBar transition between states SHALL use spring-based animation with stiffness and damping values consistent with the existing MagicBar animations.

### Requirement 8: Environment Variable Security

**User Story:** As a developer, I want the Google Places API key to be securely managed, so that it is never exposed to the client browser.

#### Acceptance Criteria

1. THE Geocoder SHALL read the API key exclusively from the `GOOGLE_PLACES_API_KEY` server-side environment variable.
2. THE Geocoder SHALL execute only within a Next.js server action context (marked with `'use server'` directive), ensuring the API key is never sent to the client.
3. THE Geocoder SHALL NOT include the API key in any response payload, log output, or error message returned to the client.

### Requirement 9: Query Construction

**User Story:** As a user, I want the geocoder to combine all available context when searching, so that ambiguous venue names are resolved more accurately.

#### Acceptance Criteria

1. WHEN contextual hints are provided alongside a location string, THE Geocoder SHALL combine the location string and the first contextual hint into a single `textQuery` value (e.g., location "Cedric Grolet" with hint "Paris" produces textQuery "Cedric Grolet, Paris").
2. WHEN no contextual hints are provided, THE Geocoder SHALL use the location string alone as the `textQuery` value.
3. WHEN the location string is empty or contains only whitespace, THE Geocoder SHALL return an ERROR GeocodeResult with a descriptive error message without making any network request.
