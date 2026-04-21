/**
 * Category Mapper Utility
 *
 * Pure utility that maps Google Place primaryType values to
 * human-readable collection names, icons, and gradient classes.
 * No side effects.
 */

const TYPE_TO_COLLECTION: Record<string, string> = {
  restaurant: "Food & Drink",
  cafe: "Food & Drink",
  bar: "Food & Drink",
  bakery: "Food & Drink",
  hotel: "Accommodations",
  lodging: "Accommodations",
  apartment: "Accommodations",
  tourist_attraction: "Sightseeing",
  museum: "Sightseeing",
  park: "Sightseeing",
  zoo: "Sightseeing",
  shopping_mall: "Shopping",
  store: "Shopping",
};

const KNOWN_COLLECTIONS: ReadonlySet<string> = new Set([
  "Food & Drink",
  "Accommodations",
  "Sightseeing",
  "Shopping",
  "Unorganized",
]);

const CATEGORY_ICONS: Record<string, string> = {
  "Food & Drink": "utensils",
  Accommodations: "bed",
  Sightseeing: "camera",
  Shopping: "shopping-bag",
  Unorganized: "map-pin",
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  "Food & Drink": "bg-gradient-to-br from-orange-400 to-rose-500",
  Accommodations: "bg-gradient-to-br from-blue-400 to-indigo-500",
  Sightseeing: "bg-gradient-to-br from-emerald-400 to-teal-500",
  Shopping: "bg-gradient-to-br from-pink-400 to-purple-500",
  Unorganized: "bg-gradient-to-br from-gray-400 to-slate-500",
};

/** Maps a Google Place primaryType to a user-friendly collection name. */
export function getCollectionForType(
  primaryType: string | undefined
): string {
  if (!primaryType) return "Unorganized";
  if (Object.hasOwn(TYPE_TO_COLLECTION, primaryType)) {
    return TYPE_TO_COLLECTION[primaryType];
  }
  return "Unorganized";
}

/** Returns the set of all known collection names. */
export function getKnownCollectionNames(): ReadonlySet<string> {
  return KNOWN_COLLECTIONS;
}

/** Returns a Lucide icon name for the given collection. */
export function getCategoryIcon(collectionName: string): string {
  return CATEGORY_ICONS[collectionName] ?? CATEGORY_ICONS["Unorganized"];
}

/** Returns a Tailwind gradient class string for the given collection. */
export function getCategoryGradient(collectionName: string): string {
  return (
    CATEGORY_GRADIENTS[collectionName] ?? CATEGORY_GRADIENTS["Unorganized"]
  );
}
