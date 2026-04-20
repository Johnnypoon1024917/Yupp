# Requirements Document

## Introduction

YUPP is a travel pin board application that lets users paste social media URLs, scrape location metadata, geocode venues, and pin them on an interactive map. Currently, the scraping pipeline supports a single location extraction per URL and is limited to Instagram-like pages. This feature upgrades YUPP to a Multi-Location Extraction engine that supports Instagram, Douyin, and Xiaohongshu, uses dual-LLM orchestration (DeepSeek primary, Gemini backup) to extract multiple points of interest from captions, and plots all discovered places simultaneously on the map.

## Glossary

- **Scraper**: The server action (`scrapeUrl`) responsible for navigating to a URL via a headless browser, detecting the platform, and extracting page metadata.
- **AI_Extractor**: The function (`extractPlacesWithAI`) that sends a social media caption to an LLM and receives a structured JSON array of extracted places.
- **DeepSeek_Client**: An OpenAI-compatible HTTP client configured to call the DeepSeek API at `https://api.deepseek.com`.
- **Gemini_Client**: A client using the `@google/generative-ai` SDK to call the Google Gemini API.
- **ScrapeResult**: The TypeScript interface representing a successful scrape outcome, including extracted places.
- **ExtractedPlace**: An object containing a place `name` and an array of `contextualHints` strings providing geographic context.
- **MagicBar**: The URL input component that orchestrates scraping, geocoding, and pin creation.
- **Pin_Store**: The Zustand store (`useTravelPinStore`) that holds all map pins and collections.
- **Geocoder**: The server action (`geocodeLocation`) that resolves a place name into geographic coordinates via the Google Places API.
- **MapView**: The map rendering component that displays markers and supports drag interactions.
- **Platform**: One of the supported social media domains: Instagram (`instagram.com`), Douyin (`v.douyin.com`), or Xiaohongshu (`xiaohongshu.com`, `xhslink.com`).
- **usePlannerDnd**: The custom React hook (`usePlannerDnd.tsx`) that configures drag-and-drop sensors and handlers for the itinerary planner, using `@dnd-kit/core`.

## Requirements

### Requirement 1: Multi-Place Data Model

**User Story:** As a developer, I want the ScrapeResult interface to return an array of extracted places instead of a single location, so that downstream components can process multiple points of interest from a single URL.

#### Acceptance Criteria

1. THE ScrapeResult SHALL contain an `extractedPlaces` field typed as `Array<{ name: string; contextualHints: string[] }>`.
2. THE ScrapeResult SHALL retain the `title`, `description`, `imageUrl`, and `sourceUrl` fields with their existing types.
3. THE ScrapeResult SHALL remove the singular `location` and `contextualHints` fields, replacing them with the `extractedPlaces` array.
4. WHEN no places are found by the AI_Extractor, THE ScrapeResult SHALL contain an empty `extractedPlaces` array.

### Requirement 2: Multi-Platform Domain Detection

**User Story:** As a user, I want to paste URLs from Douyin and Xiaohongshu in addition to Instagram, so that I can pin places from Chinese social media platforms.

#### Acceptance Criteria

1. WHEN a URL contains the hostname `v.douyin.com`, THE Scraper SHALL recognize the URL as a Douyin platform link.
2. WHEN a URL contains the hostname `xiaohongshu.com`, THE Scraper SHALL recognize the URL as a Xiaohongshu platform link.
3. WHEN a URL contains the hostname `xhslink.com`, THE Scraper SHALL recognize the URL as a Xiaohongshu short-link.
4. WHEN a URL contains the hostname `instagram.com`, THE Scraper SHALL continue to recognize the URL as an Instagram platform link.
5. WHEN a URL contains an unrecognized hostname, THE Scraper SHALL proceed with generic metadata extraction without platform-specific logic.

### Requirement 3: DeepSeek Primary AI Extraction

**User Story:** As a developer, I want the system to use DeepSeek as the primary LLM for extracting places from captions, so that we leverage a cost-effective and capable model for structured data extraction.

#### Acceptance Criteria

1. THE DeepSeek_Client SHALL use the OpenAI-compatible API endpoint at `https://api.deepseek.com`.
2. THE DeepSeek_Client SHALL authenticate using an API key read from the `DEEPSEEK_API_KEY` environment variable.
3. WHEN a caption is provided, THE AI_Extractor SHALL send a prompt to the DeepSeek_Client requesting extraction of all restaurants, attractions, or points of interest as a JSON array of ExtractedPlace objects.
4. WHEN the DeepSeek_Client returns a valid JSON array, THE AI_Extractor SHALL parse the response into an array of ExtractedPlace objects.
5. IF the DeepSeek_Client response is not valid JSON, THEN THE AI_Extractor SHALL treat the response as a failure and proceed to the Gemini backup.

### Requirement 4: Gemini Backup AI Extraction

**User Story:** As a developer, I want Gemini to serve as a backup LLM when DeepSeek fails, so that place extraction remains available even during DeepSeek outages or errors.

#### Acceptance Criteria

1. THE Gemini_Client SHALL use the `@google/generative-ai` SDK.
2. THE Gemini_Client SHALL authenticate using an API key read from the `GEMINI_API_KEY` environment variable.
3. IF the DeepSeek_Client call fails or times out, THEN THE AI_Extractor SHALL send the same prompt to the Gemini_Client.
4. WHEN the Gemini_Client returns a valid JSON array, THE AI_Extractor SHALL parse the response into an array of ExtractedPlace objects.
5. IF the Gemini_Client response is not valid JSON, THEN THE AI_Extractor SHALL treat the response as a failure and proceed to the og:title fallback.

### Requirement 5: AI Extraction Timeout and Fallback Chain

**User Story:** As a user, I want the system to gracefully handle AI service failures, so that I still get at least one pin even when both LLMs are unavailable.

#### Acceptance Criteria

1. THE AI_Extractor SHALL enforce a timeout of 10 seconds per LLM call.
2. WHEN the DeepSeek_Client call exceeds 10 seconds, THE AI_Extractor SHALL abort the DeepSeek request and attempt the Gemini_Client.
3. WHEN both the DeepSeek_Client and Gemini_Client calls fail, THE AI_Extractor SHALL fall back to using the page og:title as a single ExtractedPlace with an empty `contextualHints` array.
4. THE AI_Extractor SHALL execute the fallback chain in the order: DeepSeek → Gemini → og:title.
5. WHEN the AI_Extractor falls back to og:title, THE AI_Extractor SHALL log a warning indicating both LLM providers failed.

### Requirement 6: AI Extraction Prompt and Response Parsing

**User Story:** As a developer, I want a well-defined prompt and strict response parsing, so that the AI models return consistently structured place data.

#### Acceptance Criteria

1. THE AI_Extractor SHALL send the following prompt template to each LLM: "Extract all restaurants, attractions, or points of interest from this social media caption. Return ONLY a valid JSON array of objects: [{ \"name\": \"Place Name\", \"contextualHints\": [\"City\", \"Neighborhood\"] }]. Return an empty array if none found."
2. THE AI_Extractor SHALL append the caption text after the prompt template.
3. WHEN the LLM response contains a JSON array embedded in markdown code fences, THE AI_Extractor SHALL strip the code fences before parsing.
4. WHEN the parsed JSON is not an array, THE AI_Extractor SHALL treat the response as invalid.
5. WHEN an element in the parsed array lacks a `name` field of type string, THE AI_Extractor SHALL exclude that element from the result.

### Requirement 7: Batch Geocoding in MagicBar

**User Story:** As a user, I want all extracted places from a single URL to be geocoded and pinned simultaneously, so that I can discover multiple spots from one social media post in a single action.

#### Acceptance Criteria

1. WHEN the Scraper returns a successful ScrapeResult with a non-empty `extractedPlaces` array, THE MagicBar SHALL initiate geocoding for every ExtractedPlace in the array.
2. THE MagicBar SHALL use `Promise.allSettled` to geocode all places in parallel.
3. WHEN a geocode call returns status `success`, THE MagicBar SHALL call `addPin` on the Pin_Store with the resolved coordinates and metadata.
4. WHEN a geocode call returns status `error` or `needs_user_input`, THE MagicBar SHALL skip that place without blocking the remaining geocode results.
5. WHEN the `extractedPlaces` array is empty, THE MagicBar SHALL display an error message: "No places found in this post."

### Requirement 8: Batch Processing Visual Feedback

**User Story:** As a user, I want to see progress updates while the system extracts and pins multiple places, so that I understand what the application is doing.

#### Acceptance Criteria

1. WHILE the AI_Extractor is processing a caption, THE MagicBar SHALL display the status text "Scanning for multiple spots...".
2. WHILE geocoding is in progress for extracted places, THE MagicBar SHALL display the status text "Pinning spots...".
3. WHEN all geocoding calls have settled, THE MagicBar SHALL display the status text "Pinned [X] spots from [Platform]!" where [X] is the count of successfully geocoded places and [Platform] is the detected platform name.
4. WHEN zero places are successfully geocoded from a non-empty `extractedPlaces` array, THE MagicBar SHALL display an error message indicating geocoding failed for all extracted places.

### Requirement 9: MapView Marker Drag Preservation

**User Story:** As a user, I want to continue dragging map markers into the sidebar after the multi-platform upgrade, so that existing itinerary planning functionality is not broken.

#### Acceptance Criteria

1. THE MapView SHALL preserve the `draggable: true` configuration on all map markers.
2. THE MapView SHALL preserve the `document.elementsFromPoint(x, y)` bridge logic used for marker-to-sidebar drag interactions.
3. WHEN a marker is dragged, THE MapView SHALL continue to detect sidebar drop targets using the existing element detection mechanism.

### Requirement 10: Environment Variable Configuration

**User Story:** As a developer, I want all new API keys to be configured via environment variables, so that secrets are not hardcoded and deployment remains flexible.

#### Acceptance Criteria

1. THE AI_Extractor SHALL read the DeepSeek API key from the `DEEPSEEK_API_KEY` environment variable.
2. THE AI_Extractor SHALL read the Gemini API key from the `GEMINI_API_KEY` environment variable.
3. IF the `DEEPSEEK_API_KEY` environment variable is not set, THEN THE AI_Extractor SHALL skip the DeepSeek call and proceed directly to the Gemini_Client.
4. IF the `GEMINI_API_KEY` environment variable is not set, THEN THE AI_Extractor SHALL skip the Gemini call and proceed to the og:title fallback.
5. IF both `DEEPSEEK_API_KEY` and `GEMINI_API_KEY` environment variables are not set, THEN THE AI_Extractor SHALL fall back to og:title extraction and log a warning that no AI providers are configured.

### Requirement 11: Planner DnD Sensor Preservation

**User Story:** As a user, I want drag-and-drop in the planner to use separate MouseSensor and TouchSensor configurations after the multi-platform upgrade, so that desktop dragging starts instantly and touch dragging uses a delay to avoid conflicting with scroll gestures.

#### Acceptance Criteria

1. THE usePlannerDnd hook SHALL configure a `MouseSensor` with a distance activation constraint of 5 pixels and no delay, enabling instant drag initiation on desktop.
2. THE usePlannerDnd hook SHALL configure a `TouchSensor` with a delay activation constraint of 200 milliseconds and a tolerance of 8 pixels, preventing accidental drags during touch scrolling.
3. THE usePlannerDnd hook SHALL register both the `MouseSensor` and the `TouchSensor` via the `useSensors` hook from `@dnd-kit/core`.
4. THE usePlannerDnd hook SHALL continue to register a `KeyboardSensor` with `sortableKeyboardCoordinates` for accessible keyboard-based reordering.
5. THE usePlannerDnd hook SHALL NOT use a single `PointerSensor` to handle both mouse and touch input, as a unified sensor forces a delay on desktop or removes the delay on touch.
