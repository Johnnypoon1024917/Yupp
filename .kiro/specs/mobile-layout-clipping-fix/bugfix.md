# Bugfix Requirements Document

## Introduction

Three related mobile layout bugs cause UI elements to clip, overlap, or overflow on small screens. The MagicBar search input overlaps the hamburger menu button on mobile viewports, long URLs inside the MagicBar push the Paste button out of bounds due to missing flex min-width constraints, and the PlaceSheet drawer content overflows its scroll boundaries on mobile devices. These issues degrade the mobile experience while desktop layout remains unaffected.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the viewport is mobile-width (below `md` breakpoint) THEN the MagicBar's centered positioning (`left-1/2 -translate-x-1/2 w-[90%]`) causes it to overlap the top-left hamburger menu button

1.2 WHEN a long URL is entered or pasted into the MagicBar input THEN the `<input>` element's flex sizing allows it to grow beyond its container, pushing the Paste button out of the visible bounds

1.3 WHEN the PlaceSheet drawer is opened on a mobile device with lengthy content THEN the drawer content overflows its scroll boundaries because the inner scrollable container lacks `overscroll-behavior: contain`, allowing scroll chaining to the background page

### Expected Behavior (Correct)

2.1 WHEN the viewport is mobile-width (below `md` breakpoint) THEN the system SHALL position the MagicBar anchored to the right of the menu button using `left-[3.5rem] right-4` and remove the centering transform, while on `md`+ screens the system SHALL center the MagicBar using `md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[400px]`

2.2 WHEN a long URL is entered or pasted into the MagicBar input THEN the system SHALL constrain the input element with `min-w-0` so it shrinks within its flex container, keeping the Paste button visible and within bounds

2.3 WHEN the PlaceSheet drawer is opened on a mobile device THEN the system SHALL contain scroll within the drawer's scrollable area by applying `overscroll-behavior: contain` to the inner scroll container, preventing scroll chaining to the background page

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the viewport is desktop-width (`md` breakpoint or above) THEN the system SHALL CONTINUE TO display the MagicBar centered horizontally at the top of the viewport

3.2 WHEN a short URL or normal-length text is entered into the MagicBar input THEN the system SHALL CONTINUE TO display the input and Paste button correctly within the bar

3.3 WHEN the PlaceSheet drawer is opened with content that fits within the viewport THEN the system SHALL CONTINUE TO display the content without unnecessary scroll behavior

3.4 WHEN the PlaceSheet drawer is opened on desktop THEN the system SHALL CONTINUE TO display and scroll content normally

---

## Bug Condition Derivation

### Bug 1: MagicBar Overlap

```pascal
FUNCTION isBugCondition_Overlap(X)
  INPUT: X of type ViewportContext
  OUTPUT: boolean

  RETURN X.viewportWidth < md_breakpoint
END FUNCTION

// Property: Fix Checking — MagicBar Mobile Positioning
FOR ALL X WHERE isBugCondition_Overlap(X) DO
  layout ← renderMagicBar'(X)
  ASSERT layout.left = "3.5rem" AND layout.right = "4" AND layout.transform = none
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_Overlap(X) DO
  ASSERT renderMagicBar(X) = renderMagicBar'(X)
END FOR
```

### Bug 2: Input Flexbox Squishing

```pascal
FUNCTION isBugCondition_InputOverflow(X)
  INPUT: X of type MagicBarInput
  OUTPUT: boolean

  RETURN length(X.urlText) > containerFitThreshold
END FUNCTION

// Property: Fix Checking — Input Flex Containment
FOR ALL X WHERE isBugCondition_InputOverflow(X) DO
  layout ← renderMagicBarInput'(X)
  ASSERT layout.pasteButton.isVisible AND layout.input.width <= layout.container.width
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_InputOverflow(X) DO
  ASSERT renderMagicBarInput(X) = renderMagicBarInput'(X)
END FOR
```

### Bug 3: PlaceSheet Scroll Boundaries

```pascal
FUNCTION isBugCondition_ScrollOverflow(X)
  INPUT: X of type PlaceSheetContext
  OUTPUT: boolean

  RETURN X.isMobile AND X.contentHeight > X.viewportHeight
END FUNCTION

// Property: Fix Checking — Scroll Containment
FOR ALL X WHERE isBugCondition_ScrollOverflow(X) DO
  sheet ← renderPlaceSheet'(X)
  ASSERT sheet.scrollContainer.overscrollBehavior = "contain"
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_ScrollOverflow(X) DO
  ASSERT renderPlaceSheet(X) = renderPlaceSheet'(X)
END FOR
```
