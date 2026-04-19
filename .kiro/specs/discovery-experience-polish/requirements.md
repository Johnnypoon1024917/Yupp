# Requirements Document

## Introduction

This spec captures the final polish pass for the YUPP Discovery experience across three pillars: Intelligence (confidence-based geocoding to minimize human fallback), Hierarchy (pixel-perfect editorial typography in the PlaceSheet), and Imagery (a portrait-safe frame that displays full Instagram images without cropping). The existing codebase has partial implementations; this spec defines the precise thresholds, pixel values, and behavioral contracts that constitute "done."

## Glossary

- **Geocoder**: The server action at `src/actions/geocodeLocation.ts` that resolves a location string into geographic coordinates via the Google Places Text Search API.
- **PlaceSheet**: The bottom-drawer UI component at `src/components/PlaceSheet.tsx` that displays details for a saved Pin.
- **Pin**: The core data model representing a saved place, defined in `src/types/index.ts`.
- **Prominence_Picker**: The `pickProminentPlace` function inside the Geocoder that selects the best result from multiple Google Places candidates.
- **Contextual_Hint**: A string (e.g., "Hong Kong", "Bali") extracted from the source content that provides geographic context for disambiguation.
- **Portrait_Frame**: The hero image container in the PlaceSheet that displays Instagram images at their native 4:5 aspect ratio without cropping.
- **Editorial_Typography**: The set of precise font-size, line-height, weight, tracking, and color values applied to PlaceSheet text elements.
- **CTA_Button**: The primary call-to-action button in the PlaceSheet that links to the original source (e.g., Instagram post).

## Requirements

### Requirement 1: Contextual Hint Matching in Prominence Picker

**User Story:** As a user pasting an Instagram link, I want the Geocoder to automatically resolve the correct location when a contextual hint matches, so that I am not asked to manually disambiguate.

#### Acceptance Criteria

1. WHEN multiple Google Places results are returned AND a Contextual_Hint is provided, THE Prominence_Picker SHALL iterate over all results and select the first result whose `formattedAddress` contains the Contextual_Hint (case-insensitive match).
2. WHEN a Contextual_Hint matches a result's `formattedAddress`, THE Geocoder SHALL return `status: 'success'` with that result's coordinates, displayName, and address.
3. WHEN no Contextual_Hint matches any result's `formattedAddress`, THE Prominence_Picker SHALL proceed to rating-based selection.

### Requirement 2: Rating-Based Prominence Selection

**User Story:** As a user pasting a link to a well-known venue, I want the Geocoder to automatically select a highly-rated prominent location, so that I avoid unnecessary manual disambiguation.

#### Acceptance Criteria

1. WHEN no Contextual_Hint match is found AND the first Google Places result has a `rating` greater than 4.2 AND `user_ratings_total` greater than 50, THE Prominence_Picker SHALL select that result as the winner.
2. WHEN the first result's `rating` is 4.2 or below OR `user_ratings_total` is 50 or below, THE Prominence_Picker SHALL NOT select based on rating alone.
3. WHEN a result is selected by rating-based prominence, THE Geocoder SHALL return `status: 'success'` with that result's coordinates, displayName, and address.

### Requirement 3: Address Field in Geocode Result

**User Story:** As a developer consuming the Geocoder output, I want the success result to include a human-readable `address` field, so that downstream components can display the formatted address.

#### Acceptance Criteria

1. THE Geocoder SHALL include an `address` field of type `string` in every `status: 'success'` response.
2. WHEN a successful result is returned, THE Geocoder SHALL populate the `address` field with the Google Places `formatted_address` value.
3. IF the `formatted_address` is unavailable, THEN THE Geocoder SHALL fall back to the `displayName.text` value for the `address` field.

### Requirement 4: Ambiguity Fallback to Human Input

**User Story:** As a user, I want the Geocoder to ask me for help only when results are genuinely ambiguous, so that I am not interrupted unnecessarily.

#### Acceptance Criteria

1. WHEN multiple results are returned AND the top two results share the same `displayName` (case-insensitive) AND their coordinates are within 0.05 degrees of latitude and longitude, THE Prominence_Picker SHALL return null (genuinely ambiguous).
2. WHEN the Prominence_Picker returns null, THE Geocoder SHALL return `status: 'needs_user_input'` with the provided `partialData`.
3. WHEN zero results are returned from Google Places, THE Geocoder SHALL return `status: 'needs_user_input'`.

### Requirement 5: Google Places Field Mask for User Ratings Total

**User Story:** As a developer, I want the Google Places API request to include `userRatingCount` in the field mask, so that the Prominence_Picker can evaluate rating-based prominence using the total number of ratings.

#### Acceptance Criteria

1. THE Geocoder SHALL include `places.userRatingCount` in the `X-Goog-FieldMask` header sent to the Google Places Text Search API.
2. THE `GooglePlacesResponse` type SHALL include an optional `userRatingCount` field of type `number` on each place object.

### Requirement 6: PlaceSheet Title Typography

**User Story:** As a user viewing a saved place, I want the title to appear in a bold editorial style, so that the PlaceSheet feels premium and luxurious.

#### Acceptance Criteria

1. THE PlaceSheet SHALL render the Pin title with `font-size: 26px`, `line-height: 30px`, `font-weight: 800` (extrabold), `letter-spacing: -0.8px`, and `color: #111111`.

### Requirement 7: PlaceSheet Address Display

**User Story:** As a user viewing a saved place, I want to see the address directly under the title, so that I immediately know where the place is located.

#### Acceptance Criteria

1. WHEN a Pin has a non-empty `address` field, THE PlaceSheet SHALL render the address directly below the title.
2. THE PlaceSheet SHALL style the address with `font-size: 14px`, `line-height: 18px`, `font-weight: 500` (medium), `color: #71717A`, and `margin-top: 4px`.

### Requirement 8: PlaceSheet Description Typography

**User Story:** As a user viewing a saved place, I want the Instagram caption to appear in a subtle italic style below a divider, so that the content hierarchy is clear and the vibe text is visually distinct.

#### Acceptance Criteria

1. THE PlaceSheet SHALL render a horizontal divider above the description with `margin-top: 24px`, `margin-bottom: 24px`, `height: 1px`, and `background-color: #F4F4F5` (gray-100 equivalent).
2. THE PlaceSheet SHALL render the description text with `font-size: 13px`, `line-height: 22px`, `color: #52525B`, `letter-spacing: 0.1px`, `font-style: italic`, and a maximum of 6 visible lines (line-clamp-6).

### Requirement 9: PlaceSheet Primary CTA Button

**User Story:** As a user viewing a saved place, I want a prominent action button to open the original Instagram post, so that I can easily navigate to the source.

#### Acceptance Criteria

1. THE PlaceSheet SHALL render the primary CTA button with `height: 56px`, `border-radius: 28px`, `background-color: black` (#000000), `text-color: white`, `font-size: 16px`, and `font-weight: 700` (bold).

### Requirement 10: Portrait-Safe Hero Image Frame

**User Story:** As a user viewing a saved place, I want to see the full Instagram image without cropping, so that I can appreciate the complete photo as the creator intended.

#### Acceptance Criteria

1. THE Portrait_Frame SHALL use a 4:5 aspect ratio container (`aspect-ratio: 4/5`) with `background-color: #F4F4F5` and `overflow: hidden`.
2. THE Portrait_Frame SHALL render a blurred background layer using the same image with `object-fit: cover`, `filter: blur(24px)` (blur-2xl), `opacity: 0.3`, and `transform: scale(1.1)`.
3. THE Portrait_Frame SHALL render the primary image with `object-fit: contain` to display the full image without cropping.
4. THE Portrait_Frame SHALL render a bottom gradient overlay (`height: 96px`) that transitions from white to transparent, creating a seamless blend into the content area below.
