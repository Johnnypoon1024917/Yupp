import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import type { Itinerary, PlannedPin } from '@/types';

// ---------------------------------------------------------------------------
// Query key constants
// ---------------------------------------------------------------------------

export const itineraryKeys = {
  all: ['itineraries'] as const,
  detail: (id: string) => ['itinerary', id] as const,
};

// ---------------------------------------------------------------------------
// Row → Itinerary mapping (exported for testing)
// ---------------------------------------------------------------------------

export interface ItineraryRow {
  id: string;
  user_id: string;
  name: string;
  trip_date: string | null;
  created_at: string;
}

export function mapRowToItinerary(row: ItineraryRow): Itinerary {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    tripDate: row.trip_date,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// useItineraries hook
// ---------------------------------------------------------------------------

async function fetchItineraries(): Promise<Itinerary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('itineraries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch itineraries: ${error.message}`);
  }

  return (data ?? []).map(mapRowToItinerary);
}

export function useItineraries() {
  return useQuery({
    queryKey: itineraryKeys.all,
    queryFn: fetchItineraries,
  });
}

// ---------------------------------------------------------------------------
// Itinerary detail types & hydration (exported for testing)
// ---------------------------------------------------------------------------

/** Return shape of useItineraryDetail */
export interface ItineraryDetailData {
  itinerary: Itinerary;
  dayItems: Record<number, PlannedPin[]>;
}

/**
 * Hydrate raw Supabase rows into ItineraryDetailData.
 * Exported so property tests can exercise the logic without Supabase.
 */
export function hydrateItineraryDetail(
  itineraryRow: ItineraryRow,
  itemRows: Array<{
    id: string;
    day_number: number;
    sort_order: number;
    pins: Record<string, unknown> | null;
  }>,
): ItineraryDetailData {
  const itinerary = mapRowToItinerary(itineraryRow);

  const dayItems: Record<number, PlannedPin[]> = {};
  for (const item of itemRows) {
    const pin = item.pins;
    if (!pin) continue;

    const plannedPin: PlannedPin = {
      id: pin.id as string,
      title: pin.title as string,
      description: (pin.description as string) ?? undefined,
      imageUrl: pin.image_url as string,
      sourceUrl: pin.source_url as string,
      latitude: pin.latitude as number,
      longitude: pin.longitude as number,
      collectionId: pin.collection_id as string,
      createdAt: pin.created_at as string,
      placeId: (pin.place_id as string) ?? undefined,
      primaryType: (pin.primary_type as string) ?? undefined,
      rating: (pin.rating as number) ?? undefined,
      address: (pin.address as string) ?? undefined,
      user_id: (pin.user_id as string) ?? undefined,
      day_number: item.day_number,
      sort_order: item.sort_order,
      itinerary_item_id: item.id,
    };

    const day = item.day_number;
    if (!dayItems[day]) dayItems[day] = [];
    dayItems[day].push(plannedPin);
  }

  // Ensure at least day 1 exists
  if (Object.keys(dayItems).length === 0) {
    dayItems[1] = [];
  }

  return { itinerary, dayItems };
}

// ---------------------------------------------------------------------------
// useItineraryDetail hook
// ---------------------------------------------------------------------------

async function fetchItineraryDetail(id: string): Promise<ItineraryDetailData> {
  const supabase = createClient();

  const { data: itineraryRow, error: itinError } = await supabase
    .from('itineraries')
    .select('*')
    .eq('id', id)
    .single();

  if (itinError || !itineraryRow) {
    throw new Error(
      `Failed to fetch itinerary: ${itinError?.message ?? 'not found'}`,
    );
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from('itinerary_items')
    .select('*, pins(*)')
    .eq('itinerary_id', id)
    .order('day_number', { ascending: true })
    .order('sort_order', { ascending: true });

  if (itemsError) {
    throw new Error(
      `Failed to fetch itinerary items: ${itemsError.message}`,
    );
  }

  return hydrateItineraryDetail(itineraryRow as ItineraryRow, itemRows ?? []);
}

export function useItineraryDetail(id: string | undefined | null) {
  return useQuery({
    queryKey: itineraryKeys.detail(id ?? ''),
    queryFn: () => fetchItineraryDetail(id!),
    enabled: !!id,
  });
}
