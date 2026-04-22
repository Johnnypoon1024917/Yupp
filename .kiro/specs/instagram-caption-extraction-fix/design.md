# Instagram Caption Extraction Fix — Bugfix Design

## Overview

The LLM place extraction pipeline in `extractPlaces.ts` fails on long multilingual Instagram captions. Two compounding issues cause incorrect place extraction: (1) the LLM prompt is too generic for smaller local models to handle long CJK captions — they return narrative text as the "place name", and (2) the heuristic fallback (`extractPlaceNameFromCaption`) only inspects the first line and the 📍 pattern, missing @mentions, CJK addresses, and multi-line structured info blocks.

The fix improves the LLM prompt with explicit multilingual extraction instructions, adds a caption sanitization step that strips emojis and special characters before sending to the custom LLM (which struggles with these tokens), and enriches the heuristic fallback with three new pattern scanners that operate across all caption lines. The `buildExtractionPrompt` function is extended to accept `ogTitle` as additional context for the LLM.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — a long multilingual Instagram caption where the first line is narrative text (>60 chars) and the caption body contains extractable place information (@mentions, CJK addresses, structured emoji blocks) that the current code misses
- **Property (P)**: The desired behavior — the system extracts actual place names, addresses, or business identifiers from the caption instead of returning narrative text or a generic ogTitle fallback
- **Preservation**: Existing extraction behaviors that must remain unchanged — short first-line extraction, separator patterns, 📍 emoji extraction, successful LLM results, and the overall fallback chain order
- **`extractPlaceNameFromCaption`**: The heuristic function in `src/actions/extractPlaces.ts` (line 233) that attempts pattern-based place name extraction when all LLM providers fail
- **`buildExtractionPrompt`**: The function in `src/actions/extractPlaces.ts` (line 38) that constructs the LLM prompt from the caption text
- **`EXTRACTION_PROMPT_TEMPLATE`**: The static prompt string (line 34) sent to all three LLM providers
- **`extractPlacesWithAI`**: The orchestrator function (line 273) that runs the Custom LLM → Gemini → DeepSeek → heuristic fallback chain
- **ogTitle**: The `<title>` tag content from the scraped page, typically the Instagram account name (e.g., "panslut.tw on Instagram")

## Bug Details

### Bug Condition

The bug manifests when an Instagram caption is long (first line >60 characters of narrative/emotional text) and contains place information embedded in structured patterns (@mentions, CJK addresses, emoji-marked info blocks) beyond the first line. The LLM returns narrative text as the place name due to an insufficiently specific prompt, and the heuristic fallback misses the structured patterns because it only scans the first line and the 📍 emoji.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { caption: string, ogTitle: string }
  OUTPUT: boolean

  firstLine := firstNonEmptyLine(input.caption)

  captionIsLongNarrative := length(firstLine) > 60
                            AND NOT containsPlaceName(firstLine)

  hasExtractablePatterns := captionContainsAtMention(input.caption)
                            OR captionContainsCJKAddress(input.caption)
                            OR captionContainsStructuredEmojiBlock(input.caption, beyondFirstLine=true)

  RETURN captionIsLongNarrative AND hasExtractablePatterns
END FUNCTION
```

### Examples

- **@mention missed**: Caption starts with "今天跟朋友去了一家超棒的餐廳，環境很好氣氛也很讚，推薦大家去試試看！\n📍 台中市\n@panslut.tw" → Current system returns `null` from heuristic (first line >60 chars), falls back to ogTitle. Expected: extract `panslut.tw` as a candidate business name.
- **CJK address missed**: Caption body contains "臺中市西區福人街60-1號" on a later line → Current system never scans beyond first line for address patterns. Expected: extract the address string as a place identifier.
- **Multi-line emoji block missed**: Caption has "🏵️ 盤子餐廳\n📍 台中市西區\n🕐 11:00-21:00" → Current system only catches the 📍 line. Expected: also extract "盤子餐廳" from the 🏵️ line.
- **LLM returns narrative**: Local Ollama model receives generic prompt with 500-char CJK caption → returns `[{"name": "今天跟朋友去了一家超棒的餐廳"}]` (first line of narrative). Expected: LLM should extract actual business names/addresses from structured content.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Short first-line extraction (≤60 chars) must continue to return the first line as the place name
- Separator pattern extraction (｜, |, -, —, ·) on the first line must continue to work
- 📍 emoji extraction must continue to work (and is now supplemented, not replaced)
- Successful LLM extraction results must continue to be returned without falling through to heuristics
- The Custom LLM → Gemini → DeepSeek → heuristic fallback chain order must remain unchanged
- Empty/null caption must continue to fall back to ogTitle
- Non-Instagram platforms (Xiaohongshu, Douyin) must be completely unaffected

**Scope:**
All inputs that do NOT involve long multilingual captions with missed structured patterns should be completely unaffected by this fix. This includes:
- Captions with short first lines that are valid place names
- Captions where the LLM successfully extracts places
- Captions where existing 📍 or separator patterns already work
- All non-Instagram platform extraction paths


## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Overly Generic LLM Prompt**: The `EXTRACTION_PROMPT_TEMPLATE` (line 34) says "Extract all restaurants, attractions, or points of interest from this social media caption" with no guidance on handling multilingual content, ignoring narrative text, or prioritizing @mentions and addresses. Smaller local models (Ollama) interpret this as "summarize the caption" and return the first line of narrative text as the place name.

2. **Missing ogTitle Context in Prompt**: `buildExtractionPrompt` only takes `caption` — it does not include the `ogTitle` (Instagram account name) which could help the LLM understand the post's authorship context and avoid returning narrative text as a place name.

3. **First-Line-Only Heuristic Scanning**: `extractPlaceNameFromCaption` only examines the first non-empty line (plus a single 📍 scan). It never looks at subsequent lines for @mentions, CJK addresses, or other emoji-marked info blocks. When the first line is >60 chars of narrative text, it returns `null` and falls through to ogTitle.

4. **No @mention Pattern Recognition**: The heuristic has no regex for `@username` patterns, which are a common Instagram convention for tagging business accounts (e.g., `@panslut.tw`).

5. **No CJK Address Pattern Recognition**: The heuristic has no regex for CJK address markers (市, 區, 路, 街, 號, 巷, 弄) which are structured and highly reliable indicators of a physical location.

6. **Emojis and Special Characters Confuse Local LLM**: The caption is sent to the custom Ollama model with all emojis (🥹, 🤣, 🥰, 🏵️, etc.) and special characters intact. Smaller local models waste token budget on these and get confused, often returning emoji-adjacent text as the "place name" instead of parsing the actual structured content.

## Correctness Properties

Property 1: Bug Condition — Structured Place Extraction from Long Multilingual Captions

_For any_ input where the caption's first line is narrative text (>60 chars, not a place name) AND the caption body contains extractable structured patterns (@mentions, CJK addresses, or emoji-marked info blocks beyond the first line), the fixed `extractPlaceNameFromCaption` function SHALL return a non-null place name extracted from those structured patterns instead of returning `null`.

**Validates: Requirements 2.1, 2.3, 2.4, 2.5**

Property 2: Preservation — Short Caption and Existing Pattern Behavior

_For any_ input where the caption's first line is ≤60 characters and is a valid place name, OR the caption contains a separator pattern on the first line, OR the caption contains a 📍 emoji with a place name, the fixed `extractPlaceNameFromCaption` function SHALL produce the same result as the original function, preserving all existing first-line extraction behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/actions/extractPlaces.ts`

**1. Improve `EXTRACTION_PROMPT_TEMPLATE` (line 34)**:
- Add explicit instructions to ignore narrative/emotional text
- Add instructions to prioritize @mentions, physical addresses, and business names
- Add multilingual/CJK handling guidance
- Instruct the model to look for structured info blocks (emoji-prefixed lines)
- Keep the JSON output format requirement unchanged

**2. Extend `buildExtractionPrompt` signature (line 38)**:
- Add `ogTitle` as an optional second parameter
- Include ogTitle in the prompt as "Post author / account name: {ogTitle}" context line
- This helps the LLM distinguish the author from place names in the caption

**3. Add @mention extraction to `extractPlaceNameFromCaption` (line 233)**:
- After existing patterns fail on the first line, scan all caption lines for `@username` patterns
- Extract the username portion (strip `@` prefix and any trailing domain like `.tw`)
- Return as candidate place name if found

**4. Add CJK address extraction to `extractPlaceNameFromCaption`**:
- Scan all caption lines for CJK address patterns containing markers: 市, 區, 路, 街, 號, 巷, 弄
- Extract the full address string as a place identifier
- Return as candidate place name if found

**5. Add multi-line emoji block scanning to `extractPlaceNameFromCaption`**:
- After first-line patterns, scan subsequent lines for emoji-prefixed info blocks
- Recognize common place-indicator emojis beyond 📍 (e.g., 🏵️, 🏠, 🍽️, 🏪, etc.)
- Extract the text following the emoji as a candidate place name

**6. Update `extractPlacesWithAI` (line 273)**:
- Build two prompts: one with sanitized caption for the custom LLM (`buildExtractionPrompt(sanitizeCaptionForLLM(caption), ogTitle)`), and one with the original caption for Gemini/DeepSeek (`buildExtractionPrompt(caption, ogTitle)`)
- Pass the sanitized prompt to `callCustomLLM` and the original prompt to `callGemini`/`callDeepSeek`

**7. Add `sanitizeCaptionForLLM` helper function**:
- Create a new exported pure function that strips emojis and special characters from caption text before sending to the custom LLM
- Remove all Unicode emoji characters (emoji presentation sequences, modifier sequences, flag sequences, etc.)
- Remove decorative special characters (★, ♥, ♦, ✨, etc.) but preserve CJK characters, Latin alphanumerics, @mentions, punctuation, and whitespace
- Collapse multiple consecutive whitespace/newlines into single instances
- Apply this sanitization ONLY to the caption text sent in the prompt to `callCustomLLM` — Gemini and DeepSeek handle emojis fine
- The heuristic fallback continues to operate on the original unsanitized caption (it needs emojis for 📍 pattern matching)

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that call `extractPlaceNameFromCaption` with long multilingual captions containing @mentions, CJK addresses, and multi-line emoji blocks. Run these tests on the UNFIXED code to observe that the function returns `null` for all of them.

**Test Cases**:
1. **@mention extraction test**: Caption with narrative first line (>60 chars) + `@panslut.tw` on a later line → will return `null` on unfixed code
2. **CJK address extraction test**: Caption with narrative first line + `臺中市西區福人街60-1號` on a later line → will return `null` on unfixed code
3. **Multi-line emoji block test**: Caption with narrative first line + `🏵️ 盤子餐廳` on a later line → will return `null` on unfixed code
4. **Combined patterns test**: Caption with all three patterns present → will return `null` on unfixed code

**Expected Counterexamples**:
- `extractPlaceNameFromCaption` returns `null` for all test cases because it only scans the first line
- The first line exceeds 60 chars so Pattern 3 (short first line) doesn't match
- No separator on the first line so Pattern 1 doesn't match

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := extractPlaceNameFromCaption_fixed(input.caption)
  ASSERT result IS NOT NULL
  ASSERT result matches one of: @mention username, CJK address, emoji-block place name
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT extractPlaceNameFromCaption_original(input) = extractPlaceNameFromCaption_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for short captions, separator patterns, 📍 patterns, and empty captions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Short first-line preservation**: Generate random captions with first line ≤60 chars → verify fixed function returns same result as original
2. **Separator pattern preservation**: Generate captions with separator patterns on first line → verify fixed function returns same result as original
3. **📍 pattern preservation**: Generate captions with 📍 emoji followed by place name → verify fixed function returns same result as original
4. **Empty/null caption preservation**: Verify fixed function returns `null` for empty/null input, same as original

### Unit Tests

- Test `extractPlaceNameFromCaption` with @mention patterns in various positions
- Test `extractPlaceNameFromCaption` with CJK address patterns (市, 區, 路, 街, 號 combinations)
- Test `extractPlaceNameFromCaption` with multi-line emoji blocks (🏵️, 🏠, 🍽️ prefixes)
- Test `buildExtractionPrompt` with and without ogTitle parameter
- Test that the improved prompt template contains multilingual extraction instructions
- Test `sanitizeCaptionForLLM` strips emojis (🥹, 🤣, 📍, 🏵️) while preserving CJK text, Latin text, @mentions, and addresses
- Test `sanitizeCaptionForLLM` collapses excessive whitespace after emoji removal
- Test `sanitizeCaptionForLLM` preserves punctuation needed for address parsing (-, /, numbers)

### Property-Based Tests

- Generate random long captions (>60 char first line) with injected @mention patterns → verify extraction succeeds
- Generate random captions with injected CJK address strings → verify extraction succeeds
- Generate random short captions (≤60 char first line) → verify fixed function matches original function output (preservation)
- Generate random captions with separator patterns → verify fixed function matches original function output (preservation)

### Integration Tests

- Test full `extractPlacesWithAI` flow with ogTitle passed through to prompt builder
- Test that the fallback chain still works end-to-end: LLM failure → heuristic → ogTitle
- Test that non-Instagram platforms are completely unaffected by the changes
