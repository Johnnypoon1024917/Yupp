import type { Pin } from '@/types';

export function getGoogleMapsPlaceUrl(pin: Pin): string {
  const query = `${pin.latitude},${pin.longitude}`;
  const placeId = pin.placeId ? `&query_place_id=${pin.placeId}` : '';
  return `https://www.google.com/maps/search/?api=1&query=${query}${placeId}`;
}

export function getGoogleMapsDirUrl(pins: Pin[]): string | null {
  if (pins.length === 0) return null;
  if (pins.length === 1) return getGoogleMapsPlaceUrl(pins[0]);

  const origin = `${pins[0].latitude},${pins[0].longitude}`;
  const destination = `${pins[pins.length - 1].latitude},${pins[pins.length - 1].longitude}`;

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;

  if (pins.length > 2) {
    const waypoints = pins
      .slice(1, -1)
      .map((p) => `${p.latitude},${p.longitude}`)
      .join('|');
    url += `&waypoints=${waypoints}`;
  }

  return url;
}
