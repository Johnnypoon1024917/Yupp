# Requirements Document

## Introduction

The Monetization Engine turns the travel workstation into a revenue-generating application by embedding affiliate booking links into place details. When a user views a saved pin, the system presents a contextual, branded call-to-action button that deep-links to a relevant travel booking platform (Booking.com for hotels, Klook/Viator for attractions, TripAdvisor/OpenTable for restaurants). Every affiliate click is tracked in a `referral_clicks` table for analytics. Pins with high ratings receive social proof badges to drive engagement and conversions.

## Glossary

- **Affiliate_Link_Utility**: A pure helper function (`getAffiliateLink`) in `src/utils/affiliateLinks.ts` that accepts a Pin and returns a platform-specific deep-link search URL based on the pin's `primaryType` and `address`.
- **PlaceSheet**: The bottom-sheet drawer component (`src/components/PlaceSheet.tsx`) that displays pin details when a user taps a map marker.
- **Referral_Click_Tracker**: A server action (`trackReferralClick`) that inserts a row into the `referral_clicks` Supabase table recording the user, pin, platform, and timestamp.
- **Social_Proof_Badge**: A visual indicator (emoji + label) rendered on pins or in the PlaceSheet header when a pin's rating exceeds a defined threshold.
- **Pin**: The core data object defined in `src/types/index.ts` representing a saved place with fields including `primaryType`, `address`, `rating`, and `title`.
- **Platform_Name**: A string identifier for the affiliate destination (e.g., `"booking.com"`, `"klook"`, `"viator"`, `"tripadvisor"`, `"opentable"`).
- **VisualMarker**: The imperative DOM-based map marker component (`src/components/VisualMarker.ts`) rendered on the MapLibre map.

## Requirements

### Requirement 1: Affiliate Link Generation

**User Story:** As a traveler, I want to see a relevant booking link for each saved place, so that I can quickly book accommodations, tickets, or reservations from the place detail view.

#### Acceptance Criteria

1. WHEN a Pin has a `primaryType` containing "hotel" or "accommodation", THE Affiliate_Link_Utility SHALL return a Booking.com search URL in the format `https://www.booking.com/searchresults.html?ss={title}+{city}` where `{title}` is the pin title and `{city}` is extracted from the pin address.
2. WHEN a Pin has a `primaryType` containing "restaurant" or "food", THE Affiliate_Link_Utility SHALL return a TripAdvisor or OpenTable search URL incorporating the pin title and city.
3. WHEN a Pin has a `primaryType` containing "tourist_attraction", "museum", or "park", THE Affiliate_Link_Utility SHALL return a Klook or Viator search URL incorporating the pin title and city.
4. WHEN a Pin has a `primaryType` that does not match any known category, THE Affiliate_Link_Utility SHALL return null.
5. WHEN a Pin has no `primaryType` defined, THE Affiliate_Link_Utility SHALL return null.
6. WHEN a Pin has no `address` defined, THE Affiliate_Link_Utility SHALL use only the pin title in the generated URL without a city component.
7. THE Affiliate_Link_Utility SHALL URI-encode the title and city components in the generated URL.
8. FOR ALL valid Pin inputs, generating an affiliate link and then parsing the URL SHALL produce a valid URL object (round-trip property).

### Requirement 2: Branded Affiliate Buttons in PlaceSheet

**User Story:** As a traveler, I want to see a prominent, branded booking button in the place detail sheet, so that I can take action on a place with a single tap.

#### Acceptance Criteria

1. WHEN a Pin has a `primaryType` matching the hotel category, THE PlaceSheet SHALL render a button with the label "Book Stay", background color `#003580` (Booking.com Blue), and white text.
2. WHEN a Pin has a `primaryType` matching the attraction category, THE PlaceSheet SHALL render a button with the label "Get Tickets", background color `#ff5b00` (Klook Orange), and white text.
3. WHEN a Pin has a `primaryType` matching the restaurant category, THE PlaceSheet SHALL render a button with the label "Reserve Table", and white text on a branded background.
4. WHEN the affiliate button is tapped, THE PlaceSheet SHALL open the affiliate link in a new browser tab using `target="_blank"` with `rel="noopener noreferrer"`.
5. WHEN a Pin has no matching affiliate category, THE PlaceSheet SHALL not render an affiliate button.
6. THE PlaceSheet SHALL render the affiliate button section below the rating and address, under a "Plan Your Visit" header.

### Requirement 3: Click Tracking Infrastructure

**User Story:** As a product owner, I want every affiliate button click to be recorded, so that I can measure monetization performance and optimize conversion.

#### Acceptance Criteria

1. THE `referral_clicks` database table SHALL contain columns: `id` (UUID primary key), `user_id` (UUID referencing auth.users), `pin_id` (UUID), `platform_name` (text), and `created_at` (timestamptz defaulting to now).
2. WHEN a user clicks an affiliate button, THE Referral_Click_Tracker SHALL insert a row into the `referral_clicks` table with the current user's ID, the pin ID, and the platform name before the link opens.
3. WHILE a user is not authenticated, THE Referral_Click_Tracker SHALL insert a row with a null `user_id`.
4. IF the tracking insert fails, THEN THE PlaceSheet SHALL still open the affiliate link without blocking the user.
5. THE `referral_clicks` table SHALL enforce Row Level Security allowing users to insert their own rows and allowing service-role access for analytics.

### Requirement 4: Social Proof Badges

**User Story:** As a traveler, I want to see at a glance which places are highly rated, so that I can prioritize the most popular destinations.

#### Acceptance Criteria

1. WHEN a Pin has a `rating` greater than 4.5, THE PlaceSheet SHALL display a "🔥 Popular" badge in the header area near the title.
2. WHEN a Pin has a `rating` of 4.5 or less, THE PlaceSheet SHALL not display a social proof badge.
3. WHEN a Pin has no `rating` defined, THE PlaceSheet SHALL not display a social proof badge.
4. THE Social_Proof_Badge SHALL be visually distinct using a warm background color and rounded pill styling consistent with the existing badge design in PlaceSheet.
