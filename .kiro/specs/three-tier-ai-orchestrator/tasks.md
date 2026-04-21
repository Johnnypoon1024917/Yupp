# Implementation Plan: Three-Tier AI Orchestrator

## Overview

Add a `callCustomLLM` function to `src/actions/extractPlaces.ts` and reorder the fallback chain to Custom LLM → Gemini → DeepSeek → caption heuristics/og:title. All changes are confined to `src/actions/extractPlaces.ts` and `.env.local.example`.

## Tasks

- [ ] 1. Add Custom LLM environment variable placeholders
  - Add `CUSTOM_LLM_ENDPOINT`, `CUSTOM_LLM_API_KEY`, and `CUSTOM_LLM_MODEL` with placeholder values and a descriptive comment block to `.env.local.example`
  - _Requirements: 1.1_

- [ ] 2. Implement `callCustomLLM` function and reorder the fallback chain
  - [ ] 2.1 Implement the `callCustomLLM` function in `src/actions/extractPlaces.ts`
    - Add a private `callCustomLLM(prompt: string): Promise<string | null>` function
    - Return `null` immediately when `CUSTOM_LLM_ENDPOINT` is missing or empty
    - Read `CUSTOM_LLM_API_KEY` from `process.env`; include `Authorization: Bearer <key>` header only when key is non-empty
    - Read `CUSTOM_LLM_MODEL` from `process.env`; default to `"default"` when unset
    - Send POST to the endpoint with `Content-Type: application/json` and OpenAI-compatible body `{ model, messages: [{ role: "user", content: prompt }] }`
    - Enforce 10-second timeout via `AbortController`
    - Throw on non-OK status (include status code and status text in error message)
    - Throw when `choices[0].message.content` is missing or not a string
    - Return the content string on success
    - _Requirements: 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ] 2.2 Reorder `extractPlacesWithAI` to the three-tier fallback chain
    - Restructure the orchestrator to attempt providers in order: `callCustomLLM` → `callGemini` → `callDeepSeek`
    - Extend skip/fail tracking from two booleans to three (`customSkipped`, `geminiSkipped`, `deepSeekSkipped`)
    - Return immediately when any provider yields a non-empty parsed `ExtractedPlace[]`
    - On provider skip (null), error (catch), or empty parse result, proceed to the next provider
    - Update the all-skipped warning to `"all three API keys/endpoints are missing"`
    - Update the all-failed warning to `"all three AI providers failed"`
    - Preserve existing caption heuristics → og:title fallback at the end of the chain
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 2.3 Write property test: Missing endpoint skips the provider (Property 1)
    - **Property 1: Missing endpoint skips the provider**
    - Use fast-check to generate arbitrary empty/undefined endpoint values
    - Verify `callCustomLLM` returns `null` without issuing any HTTP request
    - **Validates: Requirements 1.2**

  - [ ]* 2.4 Write property test: Request construction is correct for all prompts (Property 2)
    - **Property 2: Request construction is correct for all prompts**
    - Use fast-check to generate arbitrary non-empty prompt strings and model names
    - Mock `fetch` and verify the POST URL, `Content-Type` header, and JSON body structure
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 2.5 Write property test: Authorization header matches API key presence (Property 3)
    - **Property 3: Authorization header matches API key presence**
    - Use fast-check to generate arbitrary truthy/falsy API key values
    - Verify `Authorization: Bearer <key>` is present iff key is non-empty; absent otherwise
    - **Validates: Requirements 1.3, 2.4**

  - [ ]* 2.6 Write property test: Non-successful responses produce errors (Property 4)
    - **Property 4: Non-successful responses produce errors**
    - Use fast-check to generate random non-OK status codes (400–599) and malformed payloads
    - Verify `callCustomLLM` throws an error containing the status code and status text
    - **Validates: Requirements 2.6, 2.7**

  - [ ]* 2.7 Write property test: Successful responses are returned verbatim (Property 5)
    - **Property 5: Successful responses are returned verbatim**
    - Use fast-check to generate arbitrary content strings in valid OpenAI response shape
    - Verify `callCustomLLM` returns the exact content string
    - **Validates: Requirements 2.8**

- [ ] 3. Checkpoint — Verify `callCustomLLM` and reordered chain
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Orchestrator fallback chain property tests
  - [ ]* 4.1 Write property test: First valid provider short-circuits the chain (Property 6)
    - **Property 6: First valid provider short-circuits the chain**
    - Use fast-check to generate random valid `ExtractedPlace[]` arrays and random provider success positions
    - Mock all three providers; verify the successful provider's result is returned and no subsequent provider is called
    - **Validates: Requirements 3.2**

  - [ ]* 4.2 Write property test: Failed or empty providers do not halt the chain (Property 7)
    - **Property 7: Failed or empty providers do not halt the chain**
    - Use fast-check to generate random errors and empty responses at random provider positions
    - Verify the orchestrator proceeds to the next provider rather than propagating the error
    - **Validates: Requirements 3.4, 3.5**

  - [ ]* 4.3 Write property test: Exhausted chain falls back to caption heuristics then og:title (Property 8)
    - **Property 8: Exhausted chain falls back to caption heuristics then og:title**
    - Use fast-check to generate random caption/ogTitle pairs
    - Mock all three providers to skip/fail/return empty; verify the returned array contains a single element with the expected fallback name and empty `contextualHints`
    - **Validates: Requirements 3.8**

- [ ] 5. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All property tests use `fast-check` with ≥100 iterations and live in `src/actions/__tests__/extractPlaces.pbt.test.ts`
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- No new files are created beyond the test file; all production changes are in `src/actions/extractPlaces.ts` and `.env.local.example`
