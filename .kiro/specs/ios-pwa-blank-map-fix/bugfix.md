# Bugfix Requirements Document

## Introduction

The MapLibre map renders as a blank/gray screen when the app is installed as a PWA on iOS (added to Home Screen). The map works correctly on desktop browsers and Android. Three distinct root causes contribute to this failure: Stadia Maps blocking iOS PWA requests due to stripped Origin headers, iOS WebKit calculating canvas size before DOM paint, and `100dvh` not being supported on older iOS versions (iOS 15 and below).

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the app is running as an iOS Home Screen PWA THEN the system fails to load map tiles because Stadia Maps blocks requests with empty Origin headers, resulting in a blank/gray map

1.2 WHEN the map initializes on iOS Safari THEN the system calculates the MapLibre canvas size before the DOM has fully painted, resulting in a 0×0 canvas that renders nothing

1.3 WHEN the app is running on iOS 15 or below THEN the system uses `h-[100dvh]` without a fallback, causing the layout container to collapse to 0px height and the map to be invisible

1.4 WHEN the app is running on iOS 15 or below THEN the system uses `height: 100dvh` on the body element without a fallback, causing the body to collapse to 0px height

### Expected Behavior (Correct)

2.1 WHEN the app is running as an iOS Home Screen PWA THEN the system SHALL load map tiles from CARTO Positron (`https://basemaps.cartocdn.com/gl/positron-gl-style/style.json`), which does not enforce Origin header checks, and the map SHALL render correctly

2.2 WHEN the map initializes on iOS Safari THEN the system SHALL call `map.resize()` after a short delay (100ms) following map creation to ensure the canvas recalculates its dimensions after DOM paint

2.3 WHEN the app is running on iOS 15 or below THEN the system SHALL use `h-screen` as a CSS fallback before `h-[100dvh]` on the layout container, ensuring the container has a valid height even without `dvh` support

2.4 WHEN the app is running on iOS 15 or below THEN the system SHALL use `height: 100%` as a CSS fallback before `height: 100dvh` on the body element, ensuring the body has a valid height even without `dvh` support

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the app is running on desktop browsers THEN the system SHALL CONTINUE TO render the map correctly with the same clean, light, minimalist visual style

3.2 WHEN the app is running on Android browsers or PWA THEN the system SHALL CONTINUE TO render the map correctly without any visual or functional regression

3.3 WHEN the app is running on iOS 16+ with `dvh` support THEN the system SHALL CONTINUE TO use dynamic viewport height for accurate layout sizing

3.4 WHEN map markers, flyTo animations, and drag-to-plan interactions are used THEN the system SHALL CONTINUE TO function identically to current behavior

3.5 WHEN the map is resized due to planner sidebar transitions THEN the system SHALL CONTINUE TO recalculate its dimensions correctly
