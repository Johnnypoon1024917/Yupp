import type { Pin } from '@/types';

export interface AffiliateLinkResult {
  url: string;
  platformName: string;
  label: string;
  bgColor: string;
}

/**
 * Extracts the city component from a pin's address string.
 * Heuristic: takes the second-to-last comma-separated segment,
 * or the full address if no commas.
 */
export function extractCity(address: string): string {
  const segments = address.split(',').map((s) => s.trim());
  if (segments.length < 2) {
    return address.trim();
  }
  return segments[segments.length - 2];
}

interface CategoryConfig {
  keywords: string[];
  platformName: string;
  label: string;
  bgColor: string;
  baseUrl: string;
  paramKey: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    keywords: ['hotel', 'lodging'],
    platformName: 'Booking.com',
    label: 'Book Stay',
    bgColor: '#003580',
    baseUrl: 'https://www.booking.com/searchresults.html',
    paramKey: 'ss',
  },
  {
    keywords: ['restaurant', 'food', 'cafe'],
    platformName: 'TripAdvisor',
    label: 'Reserve Table',
    bgColor: '#34E0A1',
    baseUrl: 'https://www.tripadvisor.com/Search',
    paramKey: 'q',
  },
  {
    keywords: ['tourist_attraction', 'museum', 'park'],
    platformName: 'Klook',
    label: 'Get Tickets',
    bgColor: '#FF5B00',
    baseUrl: 'https://www.klook.com/search/',
    paramKey: 'query',
  },
];

/**
 * Pure function: maps a Pin's primaryType to an affiliate deep-link.
 * Returns null if no matching category or missing primaryType.
 */
export function getAffiliateLink(pin: Pin): AffiliateLinkResult | null {
  if (!pin.primaryType) {
    return null;
  }

  const type = pin.primaryType;
  const category = CATEGORIES.find((cat) =>
    cat.keywords.some((kw) => type.includes(kw))
  );

  if (!category) {
    return null;
  }

  const encodedTitle = encodeURIComponent(pin.title);
  let searchValue = encodedTitle;

  if (pin.address) {
    const city = extractCity(pin.address);
    const encodedCity = encodeURIComponent(city);
    searchValue = `${encodedTitle}+${encodedCity}`;
  }

  const url = `${category.baseUrl}?${category.paramKey}=${searchValue}`;

  return {
    url,
    platformName: category.platformName,
    label: category.label,
    bgColor: category.bgColor,
  };
}
