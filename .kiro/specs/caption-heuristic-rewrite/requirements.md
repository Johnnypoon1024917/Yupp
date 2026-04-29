# Requirements Document

## Introduction

When the AI extraction chain (Custom LLM → Gemini → DeepSeek) fails — because all keys are unconfigured, all providers are rate-limited, all calls time out, or all responses parse to empty — Yupp falls back to a regex-based caption heuristic in `extractPlaceNameFromCaption` (in `src/utils/extractPlacesUtils.ts`). The current heuristic is broken in three specific ways:

1. **Pattern ordering is wrong.** It checks "first line ≤60 chars" before checking for structured place blocks. The first line of a typical Hong Kong, Taiwan, or mainland Chinese food-creator post is an emotional reaction ("終於俾我預約到啦‼️…"), not a place name. The structured place data — the Name (District) / 地址：addr / 電話：phone / 營業時間：hours block — usually appears 3–5 lines down. The heuristic returns the emotional first line and never reaches the structured block.

2. **No quality filter.** Any line under 60 characters is accepted as a place name, including ones full of emoji, exclamation marks, and Cantonese sentence particles. There is no notion of "this line obviously isn't a place name."

3. **No confidence signaling.** The heuristic always returns something, even when that something is junk. The orchestrator passes the junk to Google Places, which by sheer luck often returns a wrong-but-real result. The user sees a successful pin in the wrong location and learns not to trust the product.

This release rewrites `extractPlaceNameFromCaption` from scratch with three goals: (a) detect the recurring CJK structured-place blocks that 60–80% of Hong Kong / Taiwan / mainland Chinese travel content uses; (b) reject lines that are obviously narrative rather than place names; (c) surface a confidence score so the orchestrator can either create a pin, flag a pin for user review, or fail loudly with a clear user-facing message. The release also drops the existing English heuristics in favor of a single, smaller, more reliable English pattern set built on the same scoring model.

The release is a defense layer, not the primary extraction path. It only fires when the AI chain fails. The goal is not to match Gemini's quality across all content; the goal is to handle the highly structured majority of CJK content reliably and fail visibly on the rest.

## Glossary

- **AI_Chain**: The existing Custom LLM → Gemini → DeepSeek fallback orchestrator in `extractPlacesWithAI`. Out of scope for changes; this spec touches only what runs after the AI chain returns no results.
- **Heuristic_Extractor**: The function `extractPlaceNameFromCaption` in `src/utils/extractPlacesUtils.ts`. Currently returns `string | null`. After this spec, renamed to `extractPlaceFromCaption` and returns `HeuristicResult | null`.
- **HeuristicResult**: A new type: `{ name: string; address: string | null; districtHint: string | null; confidence: number; pattern: PatternId }` where confidence is a number in [0.1, 1.0] and pattern identifies which detection rule matched.
- **Confidence_Score**: A number in [0.1, 1.0] indicating how likely the extracted name is a real place. High = ≥0.7, Medium = [0.4, 0.7), Low = <0.4. Thresholds are constants exported from the heuristics module.
- **Confidence_Gate**: The orchestrator-level decision logic that consumes a HeuristicResult and either creates a pin (high), creates a pin with a "needs review" flag (medium), or fails loudly (low / no result).
- **Loud_Failure**: The user-facing path when no place can be confidently extracted. Returns a structured error to the calling client component, which displays a clear message instead of creating a junk pin.
- **CJK_Address_Block**: The repeating structured pattern in CJK travel content consisting of a name line followed by 地址： (address), 電話：/电话： (phone), 營業時間：/营业时间： (hours) lines.
- **CJK_Address_Markers**: The single-character tokens that identify a CJK address: 市 (city), 區/区 (district), 路 (road), 街 (street), 號/号 (number), 巷 (lane), 弄 (alley), 道 (way), 村 (village), 鎮/镇 (town).
- **Narrative_Signals**: Linguistic features that indicate a line is emotional/descriptive rather than a place name: high emoji density, exclamation clusters, Cantonese/Mandarin sentence particles (啦, 呀, 喔, 吧, 嘅, 咗, 囉, 嘛, 啊, 哦, 呢, 吖), question marks, and excessive punctuation.
- **Place_Emoji**: Emojis that semantically point to a physical place: 📍, 🏠, 🍽, 🍴, 🏨, 🏩, 🏪, 🏬, 🏭, 🏯, 🏰, 🏟, ⛪, 🕌, 🕍, ⛩, 🗼, 🗽, 🛍, 🎯, 🏖, 🏝, ⛰, 🌊.
- **PatternId**: A string literal union identifying the detection rule that matched: `'cjk_address_block' | 'place_emoji_pin' | 'mention_with_hashtags' | 'standalone_address' | 'english_title_separator' | 'first_line_short'`.
- **Pin_Creation_Outcome**: One of three terminal states for a scrape that fell through to the heuristic: `created` (high confidence), `created_for_review` (medium confidence), `rejected` (low confidence / no result).
- **Region_Prefix**: A short Latin-alphabet prefix on a CJK Instagram handle indicating geography rather than name (e.g., `hk_`, `tw_`, `sg_`, `jp_`).

## Requirements

### Requirement 1: Heuristic Result Shape and Confidence Scoring

**User Story:** As the orchestrator, I want the heuristic extractor to return a structured result with a confidence score, so that downstream logic can decide whether to create a pin, flag it for review, or reject it.

#### Acceptance Criteria

1. WHEN the AI_Chain returns no results and the Heuristic_Extractor is invoked, THE Heuristic_Extractor SHALL return a `HeuristicResult | null` value from a function named `extractPlaceFromCaption`.
2. THE HeuristicResult SHALL contain the fields: `name` (string), `address` (string | null), `districtHint` (string | null), `confidence` (number in [0.1, 1.0]), and `pattern` (PatternId).
3. THE Heuristic_Extractor SHALL export constants `CONFIDENCE_HIGH = 0.7` and `CONFIDENCE_MEDIUM = 0.4` from the heuristics module.
4. THE Heuristic_Extractor SHALL be a pure, synchronous function with no side effects, network calls, or mutable shared state.
5. THE Heuristic_Extractor SHALL accept parameters `(caption: string, ogTitle?: string)` where `ogTitle` is the `og:title` value from the scraped page.
6. WHEN the caption is empty or contains only whitespace, THE Heuristic_Extractor SHALL return `null`.

### Requirement 2: CJK Address Block Detector (Highest Priority Pattern)

**User Story:** As a user saving a Hong Kong / Taiwan / mainland Chinese food post, I want the heuristic to detect the structured Name (District) / 地址：address block that appears in 60–80% of CJK travel content, so that the correct place name and address are extracted even when the AI chain fails.

#### Acceptance Criteria

1. WHEN the caption contains a CJK_Address_Block (a name line followed within 3 lines by a line matching `地址[：:]\s*.+`), THE Heuristic_Extractor SHALL return a HeuristicResult with the name line as `name`, the address-line content as `address`, confidence = 0.9, and pattern = `'cjk_address_block'`.
2. WHEN the name line contains a parenthesized district hint matching the pattern `(.+?)\s*[（(].+?[）)]`, THE Heuristic_Extractor SHALL populate `districtHint` with the parenthesized content.
3. THE CJK Address Block Detector SHALL handle both Traditional Chinese markers (地址, 電話, 營業時間) and Simplified Chinese markers (地址, 电话, 营业时间).
4. THE CJK Address Block Detector SHALL accept both full-width colon `：` and ASCII colon `:` as delimiters, and SHALL tolerate leading/trailing whitespace around the colon.
5. WHEN the immediate predecessor line of the address line is rejected by the Narrative_Signal filter, THE Heuristic_Extractor SHALL look back one additional line for a valid name candidate.
6. WHEN the candidate name line matches the `ogTitle` parameter (case-insensitive, after trimming), THE Heuristic_Extractor SHALL skip that line and continue searching for a different name candidate.

### Requirement 3: Place Emoji + Name Pattern (Second Priority)

**User Story:** As a user saving a post where the creator marks the place with a 📍 or similar place emoji, I want the heuristic to extract the text following the emoji as the place name, so that emoji-annotated place names are captured reliably.

#### Acceptance Criteria

1. WHEN a line begins with a Place_Emoji followed by text, THE Heuristic_Extractor SHALL return a HeuristicResult with the text as `name`, confidence = 0.75, and pattern = `'place_emoji_pin'`.
2. IF the text following the Place_Emoji exceeds 80 characters or is fewer than 2 characters, THEN THE Heuristic_Extractor SHALL reject that candidate and continue to the next pattern.
3. WHEN the Place_Emoji line is immediately followed by a line containing CJK_Address_Markers or the token `地址`, THE Heuristic_Extractor SHALL elevate confidence to 0.85 and populate the `address` field.
4. THE Heuristic_Extractor SHALL strip trailing punctuation, hashtags, and non-Place_Emoji emoji from the extracted name before returning it.
5. WHEN the extracted name after stripping is rejected by the Narrative_Signal filter, THE Heuristic_Extractor SHALL skip that candidate and continue to the next pattern.

### Requirement 4: @mention with Hashtag Context (Third Priority)

**User Story:** As a user saving an Instagram post that @mentions a restaurant account, I want the heuristic to extract and clean the @mention as a place name, so that business account names are used as place identifiers.

#### Acceptance Criteria

1. WHEN the caption contains an `@mention` pattern (`@[A-Za-z0-9._]+`), THE Heuristic_Extractor SHALL extract the username, replace underscores and dots with spaces, and use the cleaned result as `name`.
2. THE Heuristic_Extractor SHALL strip Region_Prefix tokens (`hk_`, `tw_`, `sg_`, `jp_`, and similar 2–3 letter geographic prefixes followed by an underscore) from the beginning of the cleaned handle.
3. WHEN the cleaned handle (after Region_Prefix stripping) equals the `ogTitle` parameter (case-insensitive, after trimming), THE Heuristic_Extractor SHALL skip that candidate because the og:title is the post author, not a place.
4. WHEN the caption also contains a hashtag referencing a district or neighborhood (e.g., `#尖沙咀`, `#中環`, `#信義區`), THE Heuristic_Extractor SHALL populate `districtHint` and set confidence = 0.75.
5. WHEN no district hashtag is found, THE Heuristic_Extractor SHALL set confidence = 0.65.
6. THE Heuristic_Extractor SHALL return pattern = `'mention_with_hashtags'` for all @mention matches.

### Requirement 5: Standalone Address Detector (Fourth Priority)

**User Story:** As a user saving a post that contains a street address but no structured block or emoji marker, I want the heuristic to detect the address line and use it for geocoding, so that posts with inline addresses are still captured.

#### Acceptance Criteria

1. WHEN a line contains two or more CJK_Address_Markers and at least one digit, THE Heuristic_Extractor SHALL return a HeuristicResult with the line as `name`, confidence = 0.55, and pattern = `'standalone_address'`.
2. WHEN a line matches a common English address pattern (a digit sequence followed by a street-type word such as "Street", "Road", "Avenue", "Blvd", "Lane", "Drive"), THE Heuristic_Extractor SHALL return a HeuristicResult with the line as `name`, confidence = 0.55, and pattern = `'standalone_address'`.
3. THE Heuristic_Extractor SHALL populate the `address` field with the full matched line content for standalone address matches.

### Requirement 6: Narrative Signal Filter

**User Story:** As the orchestrator, I want a predicate that identifies lines that are obviously emotional or descriptive rather than place names, so that narrative text is never returned as a place name candidate.

#### Acceptance Criteria

1. THE Heuristic_Extractor SHALL export a pure function `isNarrative(line: string): boolean` that returns `true` when a line exhibits Narrative_Signals.
2. THE `isNarrative` function SHALL return `true` when a line contains 3 or more emoji codepoints (excluding Place_Emoji).
3. THE `isNarrative` function SHALL return `true` when a line contains 2 or more consecutive exclamation marks or question marks (e.g., `!!`, `??`, `‼️`, `⁉️`).
4. THE `isNarrative` function SHALL return `true` when a line ends with a Cantonese or Mandarin sentence particle (啦, 呀, 喔, 吧, 嘅, 咗, 囉, 嘛, 啊, 哦, 呢, 吖).
5. THE `isNarrative` function SHALL return `true` when a line contains more punctuation characters (including emoji) than CJK or Latin alphabetic characters.
6. THE `isNarrative` function SHALL be applied to the candidate name of every pattern before the Heuristic_Extractor returns a result.
7. THE `isNarrative` function SHALL be unit-tested against a fixture set of at least 20 narrative lines and 20 non-narrative lines drawn from real CJK travel captions.

### Requirement 7: Last-Resort First-Line Pattern (Lowest Priority)

**User Story:** As the orchestrator, I want a last-resort pattern that considers the first non-empty line of the caption only after all higher-priority patterns have failed, so that simple short-title posts still produce a result with appropriately low confidence.

#### Acceptance Criteria

1. WHEN all higher-priority patterns (CJK Address Block, Place Emoji, @mention, Standalone Address, English Title-Separator) fail to match, THE Heuristic_Extractor SHALL evaluate the first non-empty line of the caption as a last-resort candidate.
2. THE Heuristic_Extractor SHALL accept the first-line candidate only when its length is between 2 and 50 characters (inclusive), the `isNarrative` predicate returns `false`, and the line does not match the `ogTitle` parameter (case-insensitive).
3. WHEN the first-line candidate passes all filters, THE Heuristic_Extractor SHALL return a HeuristicResult with confidence = 0.35 and pattern = `'first_line_short'`.
4. WHEN the first-line candidate fails any filter, THE Heuristic_Extractor SHALL return `null`.

### Requirement 8: English Title-Separator Pattern

**User Story:** As a user saving an English-language post with a title like "Best Ramen in Tokyo | Food Guide", I want the heuristic to extract the segment before the separator as the place name, so that English title conventions are handled without the old fragile heuristics.

#### Acceptance Criteria

1. WHEN the first non-empty line of the caption contains a separator character from the set `[｜ | · — – -]` (full-width pipe, ASCII pipe, middle dot, em dash, en dash, hyphen), THE Heuristic_Extractor SHALL extract the text segment before the first separator as the candidate name.
2. THE Heuristic_Extractor SHALL return a HeuristicResult with confidence = 0.6 and pattern = `'english_title_separator'`.
3. THE Heuristic_Extractor SHALL reject the candidate if the segment before the separator is fewer than 2 characters or exceeds 80 characters.
4. THE Heuristic_Extractor SHALL reject the candidate if the `isNarrative` predicate returns `true` for the segment.
5. WHEN this pattern matches, THE Heuristic_Extractor SHALL replace all existing English heuristic logic in the current `extractPlaceNameFromCaption` function.

### Requirement 9: Loud Failure Surface

**User Story:** As a user, I want to see a clear error message when no place can be confidently extracted, so that I am not misled by a junk pin placed at the wrong location.

#### Acceptance Criteria

1. WHEN the Heuristic_Extractor returns `null`, THE `extractPlacesWithAI` orchestrator SHALL return an empty `ExtractedPlace[]` array instead of falling back to `ogTitle`.
2. WHEN `extractPlacesWithAI` returns an empty array, THE `scrapeUrl` function SHALL propagate a `ScrapeResult` with `extractedPlaces: []`.
3. WHEN `extractedPlaces` is empty, THE MagicBar component SHALL display a user-facing error message: "We couldn't identify a place in this post. Try pasting the place name directly." using the existing toast mechanism.
4. THE `ScrapeError` type SHALL support a new error code `'no_places_found'` to distinguish extraction failures from network or scraping failures.
5. THE Pin type SHALL include an optional `needsReview: boolean` field, defaulting to `false`, to flag pins created from medium-confidence heuristic results.

### Requirement 10: Geocoding Confidence Gate

**User Story:** As the orchestrator, I want to gate pin creation on a combined confidence score from both the heuristic and the geocoder, so that only high-confidence results create pins automatically and medium-confidence results are flagged for user review.

#### Acceptance Criteria

1. WHEN the Heuristic_Extractor returns a HeuristicResult with confidence ≥ CONFIDENCE_HIGH (0.7), THE orchestrator SHALL pass the result to `geocodeLocation` and create a pin with `needsReview = false` on successful geocoding.
2. WHEN the Heuristic_Extractor returns a HeuristicResult with confidence in [CONFIDENCE_MEDIUM, CONFIDENCE_HIGH) (i.e., [0.4, 0.7)), THE orchestrator SHALL pass the result to `geocodeLocation` and create a pin with `needsReview = true` on successful geocoding.
3. WHEN the Heuristic_Extractor returns a HeuristicResult with confidence < CONFIDENCE_MEDIUM (0.4), THE orchestrator SHALL trigger the Loud_Failure path and return an empty array.
4. THE `geocodeLocation` function SHALL accept an optional `heuristicConfidence` parameter and include it in the returned result for downstream logging.
5. WHEN `geocodeLocation` returns `status: 'needs_user_input'` for a heuristic-sourced query, THE orchestrator SHALL treat it as a Loud_Failure rather than prompting the user.

### Requirement 11: Logging and Observability

**User Story:** As a developer, I want structured logging for every heuristic invocation, so that I can debug extraction failures and measure pattern effectiveness in production.

#### Acceptance Criteria

1. WHEN the Heuristic_Extractor completes (whether returning a result or null), THE orchestrator SHALL log a summary line containing: matched pattern (or `'none'`), confidence score (or `0`), caption length in characters, and whether `ogTitle` was provided.
2. THE orchestrator SHALL log the summary using `console.log` in non-production environments and structured JSON in production environments.
3. WHEN a pin is created from a heuristic result, THE analytics event `PIN_CREATED` SHALL include additional fields: `extraction_source: 'heuristic'`, `heuristic_pattern: PatternId`, and `heuristic_confidence: number`.

### Requirement 12: Test Coverage

**User Story:** As a developer, I want comprehensive test coverage for the rewritten heuristic, so that regressions are caught before deployment.

#### Acceptance Criteria

1. THE Heuristic_Extractor SHALL have unit tests covering each pattern (CJK Address Block, Place Emoji, @mention, Standalone Address, English Title-Separator, First-Line) with at least 3 positive and 2 negative cases per pattern.
2. THE `isNarrative` function SHALL have a dedicated test suite with a fixture set of at least 20 narrative and 20 non-narrative lines from real CJK travel captions.
3. THE Heuristic_Extractor SHALL have property-based tests verifying: (a) for all valid HeuristicResult returns, confidence is in [0.1, 1.0] and pattern is a valid PatternId; (b) for all inputs where `isNarrative` returns `true` on the candidate name, the Heuristic_Extractor does not return that candidate as `name`.
4. THE Confidence_Gate logic SHALL have integration tests verifying the three Pin_Creation_Outcome paths: `created`, `created_for_review`, and `rejected`.

### Requirement 13: Migration and Backwards Compatibility

**User Story:** As a developer, I want a clean migration from the old heuristic to the new one with no dead code left behind, so that the codebase remains maintainable.

#### Acceptance Criteria

1. WHEN the new `extractPlaceFromCaption` function is deployed, THE old `extractPlaceNameFromCaption` function SHALL be removed entirely from `src/utils/extractPlacesUtils.ts`.
2. THE `extractPlacesWithAI` orchestrator in `src/actions/extractPlaces.ts` SHALL be updated to call `extractPlaceFromCaption` instead of `extractPlaceNameFromCaption`, and SHALL consume the `HeuristicResult` type to implement the Confidence_Gate.
3. THE migration SHALL introduce no new runtime dependencies beyond what is already in `package.json`.
4. ALL call sites that currently import `extractPlaceNameFromCaption` SHALL be updated to use `extractPlaceFromCaption` and handle the new `HeuristicResult | null` return type.
