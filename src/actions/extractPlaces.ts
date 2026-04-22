import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ExtractedPlace, Platform } from '@/types';

/**
 * Detect the social media platform from a URL's hostname.
 */
export function detectPlatform(url: string): Platform {
  try {
    const { hostname } = new URL(url);

    if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) {
      return 'instagram';
    }
    if (hostname === 'v.douyin.com') {
      return 'douyin';
    }
    if (
      hostname === 'xiaohongshu.com' ||
      hostname.endsWith('.xiaohongshu.com') ||
      hostname === 'xhslink.com' ||
      hostname.endsWith('.xhslink.com')
    ) {
      return 'xiaohongshu';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

const EXTRACTION_PROMPT_TEMPLATE =
  'Extract all restaurants, attractions, or points of interest from this social media caption. Return ONLY a valid JSON array of objects: [{ "name": "Place Name", "contextualHints": ["City", "Neighborhood"] }]. Return an empty array if none found.';

/**
 * Build the full extraction prompt by combining the template with the caption.
 */
export function buildExtractionPrompt(caption: string): string {
  return `${EXTRACTION_PROMPT_TEMPLATE}\n\nCaption: ${caption}`;
}

/**
 * Parse a raw LLM response string into an array of ExtractedPlace objects.
 * Strips markdown code fences if present, validates the JSON is an array,
 * and filters out elements missing a string `name` field.
 * Returns an empty array for any invalid or non-array response.
 */
export function parseLLMResponse(raw: string): ExtractedPlace[] {
  try {
    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    let cleaned = raw.trim();
    const fenceRegex = /^```(?:\w*)\s*\n?([\s\S]*?)\n?\s*```$/;
    const match = cleaned.match(fenceRegex);
    if (match) {
      cleaned = match[1].trim();
    }

    const parsed: unknown = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (el): el is ExtractedPlace =>
        el != null &&
        typeof el === 'object' &&
        'name' in el &&
        typeof (el as Record<string, unknown>).name === 'string'
    ).map((el) => ({
      name: el.name,
      contextualHints: Array.isArray(el.contextualHints)
        ? el.contextualHints.filter((h: unknown) => typeof h === 'string')
        : [],
    }));
  } catch {
    return [];
  }
}

/**
 * Call a custom OpenAI-compatible LLM endpoint.
 * Returns the assistant message content on success, or null if
 * CUSTOM_LLM_ENDPOINT is not set or empty (indicating the provider should be skipped).
 * Throws on network errors or non-OK responses so the fallback chain can proceed.
 * Enforces a 10-second timeout via AbortController.
 */
async function callCustomLLM(prompt: string): Promise<string | null> {
  const endpoint = process.env.CUSTOM_LLM_ENDPOINT;
  if (!endpoint) {
    return null;
  }

  const apiKey = process.env.CUSTOM_LLM_API_KEY;
  const model = process.env.CUSTOM_LLM_MODEL || 'default';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Custom LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('Custom LLM returned no content in response');
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call the DeepSeek chat completions API (OpenAI-compatible).
 * Returns the assistant message content on success, or null if
 * DEEPSEEK_API_KEY is not set (indicating the provider should be skipped).
 * Throws on network errors or non-OK responses so the fallback chain can proceed.
 * Enforces a 10-second timeout via AbortController.
 */
async function callDeepSeek(prompt: string): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('DeepSeek returned no content in response');
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call the Google Gemini API via the @google/generative-ai SDK.
 * Returns the generated text on success, or null if
 * GEMINI_API_KEY is not set (indicating the provider should be skipped).
 * Throws on network errors or empty responses so the fallback chain can proceed.
 * Enforces a 10-second timeout via AbortController.
 */
async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent(
      prompt,
      { signal: controller.signal },
    );

    const response = result.response;
    const text = response.text();
    if (typeof text !== 'string' || text.length === 0) {
      throw new Error('Gemini returned no content in response');
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Attempt to extract a place name from a caption using simple heuristics.
 * Looks for patterns common in social media posts about restaurants/places:
 * - Text before a separator (｜, |, -, —, ·) on the first line
 * - 📍 pin emoji followed by a name
 * - Text after country flag emojis on the first line
 * Returns null if no confident extraction can be made.
 */
export function extractPlaceNameFromCaption(caption: string): string | null {
  if (!caption || caption.trim().length === 0) return null;

  const firstLine = caption.split('\n').filter((l) => l.trim().length > 0)[0]?.trim();
  if (!firstLine) return null;

  // Strip leading country flag emojis (🇫🇷, 🇯🇵, etc.) — they are surrogate pairs
  const withoutFlags = firstLine.replace(/^[\u{1F1E0}-\u{1F1FF}]{2,}\s*/u, '').trim();

  // Pattern 1: text before a CJK/Latin separator on the first line
  // e.g. "La Terrace by Louise ｜米芝蓮一星餐廳"
  const separatorMatch = withoutFlags.match(/^(.+?)\s*[｜|·\-–—:]\s*/);
  if (separatorMatch?.[1]) {
    const candidate = separatorMatch[1].trim();
    if (candidate.length >= 2 && candidate.length <= 100) {
      return candidate;
    }
  }

  // Pattern 2: 📍 followed by a place name
  const pinMatch = caption.match(/📍\s*(.+?)(?:\n|$)/);
  if (pinMatch?.[1]) {
    const candidate = pinMatch[1].trim();
    if (candidate.length >= 2 && candidate.length <= 100) {
      return candidate;
    }
  }

  // Pattern 3: first line itself if it's short enough to be a name (≤60 chars)
  if (withoutFlags.length >= 2 && withoutFlags.length <= 60) {
    return withoutFlags;
  }

  return null;
}

/**
 * Orchestrator: extract places from a caption using the Custom LLM → Gemini → DeepSeek → caption heuristics/og:title fallback chain.
 * Returns an array of ExtractedPlace objects. Always returns at least one place (the og:title fallback).
 */
export async function extractPlacesWithAI(
  caption: string,
  ogTitle: string,
): Promise<ExtractedPlace[]> {
  const prompt = buildExtractionPrompt(caption);

  // --- Try Custom LLM ---
  let customSkipped = false;
  try {
    const customResult = await callCustomLLM(prompt);
    if (customResult === null) {
      customSkipped = true;
    } else {
      const parsed = parseLLMResponse(customResult);
      if (parsed.length > 0) {
        return parsed;
      }
      // Empty parsed result — fall through to Gemini
    }
  } catch {
    // Custom LLM threw — fall through to Gemini
  }

  // --- Try Gemini ---
  let geminiSkipped = false;
  try {
    const geminiResult = await callGemini(prompt);
    if (geminiResult === null) {
      geminiSkipped = true;
    } else {
      const parsed = parseLLMResponse(geminiResult);
      if (parsed.length > 0) {
        return parsed;
      }
      // Empty parsed result — fall through to DeepSeek
    }
  } catch {
    // Gemini threw — fall through to DeepSeek
  }

  // --- Try DeepSeek ---
  let deepSeekSkipped = false;
  try {
    const deepSeekResult = await callDeepSeek(prompt);
    if (deepSeekResult === null) {
      deepSeekSkipped = true;
    } else {
      const parsed = parseLLMResponse(deepSeekResult);
      if (parsed.length > 0) {
        return parsed;
      }
      // Empty parsed result — fall through to caption heuristics
    }
  } catch {
    // DeepSeek threw — fall through to caption heuristics
  }

  // --- Fallback to caption heuristics → og:title ---
  if (customSkipped && geminiSkipped && deepSeekSkipped) {
    console.warn('extractPlacesWithAI: all three API keys/endpoints are missing — falling back to caption heuristics');
  } else {
    console.warn('extractPlacesWithAI: all three AI providers failed — falling back to caption heuristics');
  }

  // Try to extract a meaningful place name from the caption before using og:title
  const captionName = extractPlaceNameFromCaption(caption);
  const fallbackName = captionName ?? ogTitle;

  return [{ name: fallbackName, contextualHints: [] }];
}
