'use client';

import { useState, useEffect, useRef } from 'react';
import type { PlannedPin } from '@/types';

export interface DistanceSegment {
  distance: string;
  duration: string;
  mode: 'transit' | 'driving';
}

interface UseDistanceMatrixResult {
  segments: DistanceSegment[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches distance/duration data for consecutive PlannedPin pairs.
 * Only re-fetches when pin order changes (tracked via serialized key).
 * Skips the API call entirely if fewer than 2 pins.
 */
export function useDistanceMatrix(
  pins: PlannedPin[],
  mode: 'transit' | 'driving'
): UseDistanceMatrixResult {
  const [segments, setSegments] = useState<DistanceSegment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Build a serialized key from pin id + sort_order to detect order changes
  const serializedKey = pins
    .map((p) => `${p.id}:${p.sort_order}`)
    .join('|');

  useEffect(() => {
    // Skip if fewer than 2 pins — no consecutive pairs to compute
    if (pins.length < 2) {
      setSegments([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const coordinates = pins.map((p) => ({ lat: p.latitude, lng: p.longitude }));

    setIsLoading(true);
    setError(null);

    fetch('/api/distancematrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates, mode }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body) => {
            throw new Error(body.error ?? `HTTP ${res.status}`);
          });
        }
        return res.json();
      })
      .then((data: { segments: { distance: string; duration: string; status: string }[] }) => {
        if (controller.signal.aborted) return;
        setSegments(
          data.segments.map((seg) => ({
            distance: seg.distance,
            duration: seg.duration,
            mode,
          }))
        );
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to fetch distance data');
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedKey, mode]);

  return { segments, isLoading, error };
}
