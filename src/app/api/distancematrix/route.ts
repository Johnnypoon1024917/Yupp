import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const GOOGLE_DISTANCE_MATRIX_URL =
  'https://maps.googleapis.com/maps/api/distancematrix/json';

interface Coordinate {
  lat: number;
  lng: number;
}

interface DistanceMatrixRequest {
  coordinates: Coordinate[];
  mode: 'transit' | 'driving';
}

interface DistanceSegment {
  distance: string;
  duration: string;
  status: string;
}

export async function POST(request: NextRequest) {
  // Auth verification
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Parse and validate request body
  let body: DistanceMatrixRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { coordinates, mode } = body;

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return NextResponse.json(
      { error: 'At least 2 coordinates required' },
      { status: 400 }
    );
  }

  if (mode !== 'transit' && mode !== 'driving') {
    return NextResponse.json(
      { error: 'Invalid mode. Must be "transit" or "driving"' },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google API key is not configured' },
      { status: 500 }
    );
  }

  // Build consecutive origin→destination pairs and call Google Distance Matrix API
  const segments: DistanceSegment[] = [];

  try {
    for (let i = 0; i < coordinates.length - 1; i++) {
      const origin = coordinates[i];
      const destination = coordinates[i + 1];

      const params = new URLSearchParams({
        origins: `${origin.lat},${origin.lng}`,
        destinations: `${destination.lat},${destination.lng}`,
        mode,
        key: apiKey,
      });

      const response = await fetch(
        `${GOOGLE_DISTANCE_MATRIX_URL}?${params.toString()}`
      );

      if (!response.ok) {
        return NextResponse.json(
          {
            error: 'Google Distance Matrix API request failed',
            details: `HTTP ${response.status}`,
          },
          { status: 502 }
        );
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        return NextResponse.json(
          {
            error: 'Google Distance Matrix API error',
            details: data.status,
          },
          { status: 502 }
        );
      }

      const element = data.rows?.[0]?.elements?.[0];
      if (!element) {
        return NextResponse.json(
          {
            error: 'Google Distance Matrix API returned no results',
            details: 'Empty response elements',
          },
          { status: 502 }
        );
      }

      segments.push({
        distance: element.distance?.text ?? '',
        duration: element.duration?.text ?? '',
        status: element.status,
      });
    }

    return NextResponse.json({ segments });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to fetch distance data',
        details: message,
      },
      { status: 502 }
    );
  }
}
