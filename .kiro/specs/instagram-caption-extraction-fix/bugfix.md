# Bugfix Requirements Document

## Introduction

When scraping Instagram posts with long multilingual captions (especially Chinese/CJK content exceeding ~60 characters on the first line), the LLM place extraction pipeline in `extractPlaces.ts` fails to identify actual place names. Instead, it returns the first line of narrative caption text as the "place name", which then fails geocoding. This affects the core scraping flow for Instagram posts from Asian food/travel bloggers — a key user demographic.

Two compounding issues cause this: (1) the LLM extraction prompt is too generic to guide smaller local models through long multilingual captions, and (2) the `extractPlaceNameFromCaption` heuristic fallback misses common Instagram patterns like `@username` mentions, CJK address formats, and structured info blocks beyond the first line.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an Instagram caption is longer than 60 characters on the first line AND the first line is narrative/emotional text (not a place name) THEN the system's `extractPlaceNameFromCaption` returns `null` because the first line exceeds the 60-char threshold, causing the fallback to use `ogTitle` which may also be unhelpful

1.2 WHEN the LLM extraction prompt is sent to a local Ollama model with a long multilingual (Chinese/CJK) caption THEN the system returns the first line of the caption as the place `name` field instead of extracting actual place names, addresses, or business mentions from the structured content within the caption

1.3 WHEN an Instagram caption contains an `@username` mention (e.g., `@panslut.tw`) that identifies a business THEN the system's heuristic fallback does not detect or extract the username as a potential business/place name

1.4 WHEN an Instagram caption contains a CJK address pattern (e.g., `臺中市西區福人街60-1號` with 市/區/路/街/號 markers) THEN the system's heuristic fallback does not detect or extract the address as a place identifier

1.5 WHEN an Instagram caption contains structured info blocks with emoji markers (e.g., lines starting with 📍, 🏵️, or similar) beyond the first line THEN the system only checks the first line and the 📍 pattern, missing other structured data lines that contain place information

### Expected Behavior (Correct)

2.1 WHEN an Instagram caption is longer than 60 characters on the first line AND the first line is narrative/emotional text THEN the system SHALL scan beyond the first line for structured place information (addresses, @mentions, emoji-marked info blocks) before falling back to `ogTitle`

2.2 WHEN the LLM extraction prompt is sent with a long multilingual caption THEN the system SHALL provide explicit instructions in the prompt to ignore narrative/emotional text, focus on @mentions, addresses, business names, and handle CJK content — improving extraction accuracy for smaller local models

2.3 WHEN an Instagram caption contains an `@username` mention (e.g., `@panslut.tw`) THEN the system SHALL extract the username (without the `@` prefix and domain suffix) as a candidate place/business name in the heuristic fallback

2.4 WHEN an Instagram caption contains a CJK address pattern with markers such as 市, 區, 路, 街, 號, 巷, 弄 THEN the system SHALL extract the address string as a contextual hint or place identifier in the heuristic fallback

2.5 WHEN an Instagram caption contains structured info blocks with emoji markers beyond the first line THEN the system SHALL scan multiple lines of the caption for place-relevant patterns, not just the first line and 📍

2.6 WHEN building the LLM extraction prompt THEN the system SHALL include the `ogTitle` (account name) as additional context to help the LLM understand the post structure and authorship

2.7 WHEN sending a caption to the custom LLM (Ollama) for place extraction THEN the system SHALL strip all emojis and decorative special characters from the caption text before including it in the prompt, while preserving CJK characters, Latin alphanumerics, @mentions, addresses, and standard punctuation — this sanitization is NOT applied to Gemini or DeepSeek prompts, which handle emojis correctly

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an Instagram caption has a short first line (≤60 chars) that is a valid place name THEN the system SHALL CONTINUE TO extract it via the existing first-line heuristic

3.2 WHEN an Instagram caption contains a separator pattern (｜, |, -, —, ·) on the first line THEN the system SHALL CONTINUE TO extract the text before the separator as the place name

3.3 WHEN an Instagram caption contains a 📍 emoji followed by a place name THEN the system SHALL CONTINUE TO extract the place name after the 📍 emoji

3.4 WHEN the LLM (Gemini, DeepSeek, or Custom) successfully extracts valid place names from a caption THEN the system SHALL CONTINUE TO return those LLM-extracted results without falling through to heuristics

3.5 WHEN all LLM providers are unavailable or return empty results AND the caption heuristic finds a valid name THEN the system SHALL CONTINUE TO use the heuristic-extracted name before falling back to `ogTitle`

3.6 WHEN the caption is empty or null THEN the system SHALL CONTINUE TO fall back to `ogTitle` as the place name

3.7 WHEN the platform is not Instagram (e.g., Xiaohongshu, Douyin) THEN the system SHALL CONTINUE TO use the existing extraction pipeline without changes to platform-specific logic
