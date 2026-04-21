import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceRoleClient } from "@/utils/supabase/serviceRole";
import type { Itinerary, PlannedPin } from "@/types";
import PublicTripView from "@/components/PublicTripView";

interface TripPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Extracts a city name from an address string.
 * Takes the first comma-separated segment, or the full address if no comma.
 */
export function extractCity(address: string): string {
  const firstSegment = address.split(",")[0].trim();
  return firstSegment || address.trim();
}

export async function generateMetadata({
  params,
}: TripPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  // Fetch itinerary
  const { data: itineraryRow, error: itineraryError } = await supabase
    .from("itineraries")
    .select("id, name, is_public")
    .eq("id", id)
    .single();

  if (itineraryError || !itineraryRow || !itineraryRow.is_public) {
    return {
      title: "Trip not found",
    };
  }

  // Fetch itinerary items joined with pins to get address and image info
  const { data: items } = await supabase
    .from("itinerary_items")
    .select("pin_id, day_number, sort_order, pins(address, image_url)")
    .eq("itinerary_id", id)
    .order("day_number", { ascending: true })
    .order("sort_order", { ascending: true });

  const pins = (items ?? [])
    .filter((item: Record<string, unknown>) => item.pins != null)
    .map((item: Record<string, unknown>) => item.pins as Record<string, unknown>);

  // Derive city from first pin's address
  const firstAddress = pins.length > 0 ? (pins[0].address as string) : "";
  const city = firstAddress ? extractCity(firstAddress) : "Somewhere";

  const ogTitle = `Trip to ${city}: ${itineraryRow.name} on Yupp`;

  // Find first pin with a non-empty imageUrl
  const firstImagePin = pins.find(
    (pin) => typeof pin.image_url === "string" && pin.image_url.length > 0
  );

  const metadata: Metadata = {
    title: ogTitle,
    openGraph: {
      title: ogTitle,
      ...(firstImagePin
        ? { images: [{ url: firstImagePin.image_url as string }] }
        : {}),
    },
  };

  return metadata;
}

export default async function TripPage({ params }: TripPageProps) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  // Fetch the itinerary
  const { data: itineraryRow, error: itineraryError } = await supabase
    .from("itineraries")
    .select("id, user_id, name, trip_date, created_at, is_public")
    .eq("id", id)
    .single();

  if (itineraryError || !itineraryRow) {
    return notFound();
  }

  if (!itineraryRow.is_public) {
    return notFound();
  }

  const itinerary: Itinerary = {
    id: itineraryRow.id,
    userId: itineraryRow.user_id,
    name: itineraryRow.name,
    tripDate: itineraryRow.trip_date,
    createdAt: itineraryRow.created_at,
  };

  // Fetch itinerary items joined with pins
  const { data: items, error: itemsError } = await supabase
    .from("itinerary_items")
    .select("id, pin_id, day_number, sort_order, pins(*)")
    .eq("itinerary_id", id)
    .order("day_number", { ascending: true })
    .order("sort_order", { ascending: true });

  if (itemsError || !items) {
    return notFound();
  }

  // Map joined rows into PlannedPin[]
  const plannedPins: PlannedPin[] = items
    .filter((item: Record<string, unknown>) => item.pins != null)
    .map((item: Record<string, unknown>) => {
      const pin = item.pins as Record<string, unknown>;
      return {
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
        day_number: item.day_number as number,
        sort_order: item.sort_order as number,
        itinerary_item_id: item.id as string,
      } satisfies PlannedPin;
    });

  return <PublicTripView itinerary={itinerary} plannedPins={plannedPins} />;
}
