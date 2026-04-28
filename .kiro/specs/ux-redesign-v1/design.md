# Design Document: UX Redesign V1

## Overview

This design covers a comprehensive UX overhaul of Yupp, a social-travel PWA built with Next.js 14, Tailwind CSS 3, Zustand, Framer Motion, vaul drawers, and dnd-kit. The redesign introduces a design-token system as the foundation, then applies it across seven UI surfaces (BottomNav, MagicBar, Home Surface, PlaceSheet, DiscoverFeed, DayContainer, Toast system) while adding new capabilities: undo-toast pattern, illustrated empty states, image loading resilience, haptic feedback, and accessibility improvements.

The approach is additive and non-breaking: existing `accent` aliases are preserved, untouched components remain unchanged, and all existing tests continue to pass. The only new runtime dependency is the Open-Meteo free weather API for DayContainer weather chips.

### Key Design Decisions

1. **Token-first migration**: All visual values (color, radius, type, elevation, motion) are defined once in `tailwind.config.ts` and `globals.css`, then consumed by components via utility classes. This eliminates magic numbers and enables future dark-mode support.
2. **Optimistic + Undo over Confirm**: All destructive actions (pin removal, bulk delete) switch from `window.confirm` to optimistic removal with a 5-second undo toast. This is faster, less disruptive, and mobile-friendly.
3. **Open-Meteo for weather**: The free, no-auth-required Open-Meteo `/v1/forecast` endpoint provides daily weather codes and temperatures. It's fetched client-side with a 7-day window guard and silent failure.
4. **PinImage with next/image**: A dedicated component handles aspect-ratio reservation, deterministic gradient placeholders, fade-in, and error fallback — replacing scattered `<img>` tags.
5. **Haptics via Vibration API**: A thin utility wraps `navigator.vibrate()` with `prefers-reduced-motion` gating. No native dependencies.

## Architecture

### High-Level Component Hierarchy

```mermaid
graph TD
    AppLayout --> MapView
    AppLayout --> BottomNav
    AppLayout --> MagicBar
    AppLayout --> HomeSurface["Home Surface (Trip Cards + Recent Pins)"]
    AppLayout --> PlaceSheet
    AppLayout --> DiscoverFeed
    AppLayout --> ProfileSheet
    AppLayout --> PlannerSidebar
    PlannerSidebar --> TripTimeline
    TripTimeline --> DayContainer
    AppLayout --> ToastContainer

    subgraph "Design Token Layer"
        TailwindConfig["tailwind.config.ts"]
        GlobalsCSS["globals.css :root vars"]
        MotionTS["src/utils/motion.ts"]
        HapticsTS["src/utils/haptics.ts"]
    end

    subgraph "New Components"
        PinImage["src/components/PinImage.tsx"]
        EmptyStates["src/components/empty-states/"]
        DemoUrls["src/components/MagicBar.demoUrls.ts"]
    end
```

### Data Flow for Undo Toast

```mermaid
sequenceDiagram
    participant User
    participant Component
    participant PinStore
    participant ToastStore
    participant Supabase

    User->>Component: Tap "Remove"
    Component->>PinStore: removePin(id) [optimistic]
    Component->>ToastStore: addUndoToast(msg, onUndo)
    ToastStore-->>User: Show undo toast (5s)
    alt User taps Undo
        User->>ToastStore: dismiss + invoke onUndo
        ToastStore->>PinStore: re-add pin from snapshot
    else Timer expires
        ToastStore->>Supabase: commit cloud delete
        ToastStore->>ToastStore: clear localStorage queue entry
    end
```

### Weather Data Flow for DayContainer

```mermaid
sequenceDiagram
    participant DayContainer
    participant useWeather["useWeather hook"]
    participant OpenMeteo["Open-Meteo API"]

    DayContainer->>useWeather: (lat, lng, targetDate)
    useWeather->>useWeather: Check if targetDate within 7-day window
    alt Within window
        useWeather->>OpenMeteo: GET /v1/forecast?latitude=X&longitude=Y&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto
        OpenMeteo-->>useWeather: JSON response
        useWeather-->>DayContainer: { tempHigh, tempLow, weatherCode, icon }
    else Outside window or error
        useWeather-->>DayContainer: null (chip hidden)
    end
```

## Components and Interfaces

### 1. Design Token System (`tailwind.config.ts` + `globals.css`)

**Changes to `tailwind.config.ts`:**
