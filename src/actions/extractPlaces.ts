'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ExtractedPlace } from '@/types';
import {
  buildExtractionPrompt,
  parseLLMResponse,
  extractPlaceFromCaption,
  CONFIDENCE_HIGH,
  CONFIDENCE_MEDIUM,
} from '@/utils/extractPlacesUtils';

/**
 * Call a custom OpenAI-compatible LLM endpoint.
 */
async function callCustomLLM(prompt: string): Promise<string | null> {
  const endpoint = process.env.CUSTOM_LLM_ENDPOINT;
  if (!endpoint) return null;

  const apiKey = process.env.CUSTOM_LLM_API_KEY;
  const model = process.env.CUSTOM_LLM_MODEL || 'default';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, prompt, stream: false, format: 'json' }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Custom LLM API error: ${response.status}`);
    const data = (await response.json()) as { response?: string };
    const content = data.response;
    if (typeof content !== 'string') throw new Error('Custom LLM returned no content in response');
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call the DeepSeek chat completions API (OpenAI-compatible).
 */
async function callDeepSeek(prompt: string): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }] }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('DeepSeek returned no content in response');
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call the Google Gemini API via the @google/generative-ai SDK.
 */
async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt, { signal: controller.signal });
    const response = result.response;
    const text = response.text();
    if (typeof text !== 'string' || text.length === 0) throw new Error('Gemini returned no content in response');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Orchestrator: extract places from a caption using the Custom LLM → Gemini → DeepSeek → caption heuristics/og:title fallback chain.
 */
export async function extractPlacesWithAI(
  caption: string,
  ogTitle: string,
): Promise<ExtractedPlace[]> {
  const prompt = buildExtractionPrompt(caption, ogTitle);

  let customSkipped = false;
  try {
    const customResult = await callCustomLLM(prompt);
    if (customResult === null) { customSkipped = true; }
    else { const parsed = parseLLMResponse(customResult); if (parsed.length > 0) return parsed; }
  }  catch (err) {
  console.error('[extractPlaces] LLM failed:', err instanceof Error ? err.message : err);
}

  let geminiSkipped = false;
  try {
    const geminiResult = await callGemini(prompt);
    if (geminiResult === null) { geminiSkipped = true; }
    else { const parsed = parseLLMResponse(geminiResult); if (parsed.length > 0) return parsed; }
  } catch (err) {
  console.error('[extractPlaces] Gemini failed:', err instanceof Error ? err.message : err);
}

  let deepSeekSkipped = false;
  try {
    const deepSeekResult = await callDeepSeek(prompt);
    if (deepSeekResult === null) { deepSeekSkipped = true; }
    else { const parsed = parseLLMResponse(deepSeekResult); if (parsed.length > 0) return parsed; }
  } catch { /* fall through */ }

  if (customSkipped && geminiSkipped && deepSeekSkipped) {
    console.warn('extractPlacesWithAI: all three API keys/endpoints are missing — falling back to caption heuristics');
  } else {
    console.warn('extractPlacesWithAI: all three AI providers failed — falling back to caption heuristics');
  }

  const heuristicResult = extractPlaceFromCaption(caption, ogTitle);

  // Structured logging for heuristic invocation
  console.log('[heuristic]', {
    pattern: heuristicResult?.pattern ?? 'none',
    confidence: heuristicResult?.confidence ?? 0,
    captionLength: caption.length,
    hasOgTitle: !!ogTitle,
  });

  // Confidence gate: low (< 0.4) or null → loud failure (empty array)
  if (!heuristicResult || heuristicResult.confidence < CONFIDENCE_MEDIUM) {
    return [];
  }

  // Build contextualHints from address and districtHint
  const contextualHints: string[] = [];
  if (heuristicResult.address) contextualHints.push(heuristicResult.address);
  if (heuristicResult.districtHint) contextualHints.push(heuristicResult.districtHint);

  return [{
    name: heuristicResult.name,
    contextualHints,
    _heuristicConfidence: heuristicResult.confidence,
    _heuristicPattern: heuristicResult.pattern,
    _needsReview: heuristicResult.confidence < CONFIDENCE_HIGH,
  }];
}
