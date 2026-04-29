// Tracked event names — keep in sync with ANALYTICS.md
export const EVENTS = {
  PIN_CREATED: 'pin_created',
  PIN_VIEWED: 'pin_viewed',
  ITINERARY_CREATED: 'itinerary_created',
  PIN_PLANNED: 'pin_planned',
  DIRECTIONS_OPENED: 'directions_opened',
  TRIP_SHARED: 'trip_shared',
  USER_SIGNED_UP: 'user_signed_up',
  LANDING_CTA_CLICKED: 'landing_cta_clicked',
  LANDING_SCROLL_DEPTH: 'landing_scroll_depth',
  APP_OPENED: 'app_opened',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
