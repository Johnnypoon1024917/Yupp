# Requirements Document

## Introduction

This feature extends the AI-powered place extraction pipeline in `src/actions/extractPlaces.ts` by introducing a self-hosted Custom LLM as the highest-priority provider. The fallback chain is reordered to: Custom LLM → Gemini → DeepSeek → caption heuristics/og:title. Supporting environment variables are added for endpoint, API key, and model configuration.

## Glossary

- **Extraction_Pipeline**: The `extractPlacesWithAI` function in `src/actions/extractPlaces.ts` that orchestrates AI-based place extraction from social media captions using a tiered fallback chain.
- **Custom_LLM_Client**: The `callCustomLLM` function that communicates with a self-hosted LLM endpoint using the OpenAI-compatible chat completions API format.
- **Fallback_Chain**: The ordered sequence of AI providers attempted by the Extraction_Pipeline; each provider is tried in order and the first to return a valid non-empty result is used.
- **Provider**: An AI service (Custom LLM, Gemini, or DeepSeek) that accepts a text prompt and returns a raw string response for place extraction.
- **ExtractedPlace**: A TypeScript interface with `name: string` and `contextualHints: string[]` fields representing a parsed place result.
- **OpenAI_Compatible_Format**: An HTTP POST payload containing `model` and `messages` fields, with a JSON response containing `choices[].message.content`.
- **Caption_Heuristics**: The `extractPlaceNameFromCaption` function that uses pattern matching to extract a place name from a social media caption before falling back to the og:title.

## Requirements

### Requirement 1: Custom LLM Environment Configuration

**User Story:** As a developer, I want to configure a custom LLM endpoint via environment variables, so that I can point the extraction pipeline at any self-hosted or third-party OpenAI-compatible LLM without code changes.

#### Acceptance Criteria

1. THE `.env.local.example` file SHALL contain the keys `CUSTOM_LLM_ENDPOINT`, `CUSTOM_LLM_API_KEY`, and `CUSTOM_LLM_MODEL` with placeholder values and a descriptive comment block.
2. WHEN `CUSTOM_LLM_ENDPOINT` is not set or is empty, THE Custom_LLM_Client SHALL return null to indicate the provider should be skipped.
3. WHEN `CUSTOM_LLM_API_KEY` is not set or is empty, THE Custom_LLM_Client SHALL omit the `Authorization` header from the request.
4. WHEN `CUSTOM_LLM_MODEL` is not set, THE Custom_LLM_Client SHALL use a sensible default model identifier in the request payload.

### Requirement 2: Custom LLM Client Function

**User Story:** As a developer, I want a `callCustomLLM` function that calls a self-hosted LLM endpoint, so that I can use any OpenAI-compatible model as the primary extraction provider.

#### Acceptance Criteria

1. THE Custom_LLM_Client SHALL accept a `prompt` parameter of type `string` and return a `Promise<string | null>`.
2. THE Custom_LLM_Client SHALL send an HTTP POST request to the URL specified by `CUSTOM_LLM_ENDPOINT` using the OpenAI_Compatible_Format with the `model` field set from `CUSTOM_LLM_MODEL` and a single user message containing the prompt.
3. THE Custom_LLM_Client SHALL set a `Content-Type: application/json` header on every request.
4. WHEN `CUSTOM_LLM_API_KEY` is set and non-empty, THE Custom_LLM_Client SHALL include an `Authorization: Bearer <key>` header in the request.
5. THE Custom_LLM_Client SHALL enforce a 10-second timeout using an AbortController, aborting the request if no response is received within that window.
6. IF the HTTP response status is not OK, THEN THE Custom_LLM_Client SHALL throw an error containing the status code and status text.
7. IF the response payload does not contain a string at `choices[0].message.content`, THEN THE Custom_LLM_Client SHALL throw an error indicating missing content.
8. WHEN the request succeeds and content is present, THE Custom_LLM_Client SHALL return the content string.

### Requirement 3: Reordered Three-Tier Fallback Chain

**User Story:** As a developer, I want the extraction pipeline to try Custom LLM first, then Gemini, then DeepSeek, so that my self-hosted model gets priority while retaining reliable fallbacks.

#### Acceptance Criteria

1. THE Extraction_Pipeline SHALL attempt providers in this exact order: Custom_LLM_Client, then Gemini, then DeepSeek.
2. WHEN a Provider returns a non-null response that parses into a non-empty array of ExtractedPlace objects, THE Extraction_Pipeline SHALL return that array immediately without calling subsequent providers.
3. WHEN a Provider returns null (indicating it was skipped due to missing configuration), THE Extraction_Pipeline SHALL proceed to the next Provider in the Fallback_Chain.
4. WHEN a Provider throws an error, THE Extraction_Pipeline SHALL catch the error and proceed to the next Provider in the Fallback_Chain.
5. WHEN a Provider returns a non-null response that parses into an empty array, THE Extraction_Pipeline SHALL proceed to the next Provider in the Fallback_Chain.
6. WHEN all three Providers are skipped due to missing configuration, THE Extraction_Pipeline SHALL log a console warning stating that all three API keys/endpoints are missing.
7. WHEN all three Providers fail or return empty results (and at least one was attempted), THE Extraction_Pipeline SHALL log a console warning stating that all three AI providers failed.
8. WHEN all Providers are exhausted, THE Extraction_Pipeline SHALL fall back to Caption_Heuristics and then og:title, returning an array with a single ExtractedPlace.
