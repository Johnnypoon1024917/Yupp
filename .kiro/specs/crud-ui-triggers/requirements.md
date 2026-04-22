# Requirements Document

## Introduction

This spec addresses two UI bugs in the travel pin board application. First, the `CollectionCard` component contains nested interactive elements — buttons and links are rendered inside a `div[role="button"]`, which violates HTML semantics and creates accessibility issues (screen readers announce nested controls incorrectly, and click events propagate unpredictably). Second, the `PlaceSheet` component's collection picker dropdown is clipped by the parent `Drawer.Content` element's `overflow-hidden`, causing the inline "New Collection" input to be cut off at the bottom of the drawer.

## Glossary

- **CollectionCard**: The React component (`src/components/CollectionCard.tsx`) that renders a single collection as an expandable accordion card inside the `CollectionDrawer`.
- **Header_Region**: The top section of a `CollectionCard` containing the image grid, title, options menu, and chevron. Currently a single `div[role="button"]`.
- **Options_Menu**: The three-dot (`MoreVertical`) dropdown inside the `Header_Region` that exposes Rename and Delete actions for a collection.
- **Pin_Row**: A single pin entry rendered inside the expanded section of a `CollectionCard`, containing an image, title, and external source link.
- **PlaceSheet**: The React component (`src/components/PlaceSheet.tsx`) that renders pin details in a vaul `Drawer` bottom sheet.
- **Collection_Picker**: The dropdown inside `PlaceSheet` that lets the user move a pin to a different collection or create a new one inline.
- **Drawer_Content**: The vaul `Drawer.Content` element that wraps the `PlaceSheet` body and currently applies `overflow-hidden`.

## Requirements

### Requirement 1: Remove Nested Interactive Elements from CollectionCard Header

**User Story:** As a user navigating with a screen reader or keyboard, I want the CollectionCard to have properly structured interactive elements, so that I can activate the accordion toggle, the options menu, and pin links independently without ambiguous focus targets.

#### Acceptance Criteria

1. THE CollectionCard SHALL render the Header_Region as a non-interactive container element (`div` without `role="button"` and without `tabIndex`).
2. THE CollectionCard SHALL render a discrete `button` element wrapping the image grid, title area, and chevron to serve as the accordion toggle.
3. THE Options_Menu toggle button SHALL be a sibling of the accordion toggle button, not a descendant of it.
4. WHEN the accordion toggle button is activated, THE CollectionCard SHALL toggle the expanded state and invoke the `onClick` callback with the collection ID.
5. WHEN the Options_Menu toggle button is activated, THE CollectionCard SHALL open the dropdown menu without toggling the accordion.
6. THE Header_Region SHALL NOT contain any `button`, `a`, or element with an interactive role nested inside another `button` or element with an interactive role.
7. WHEN a Pin_Row external link is activated inside the expanded section, THE CollectionCard SHALL navigate to the source URL without toggling the accordion or triggering the collection click handler.

### Requirement 2: Prevent Collection Picker Clipping in PlaceSheet

**User Story:** As a user creating a new collection from the PlaceSheet, I want the collection picker dropdown and its inline input to be fully visible, so that I can see and interact with the "New Collection" creation form without it being cut off.

#### Acceptance Criteria

1. WHEN the Collection_Picker dropdown is open, THE PlaceSheet SHALL display the full dropdown including the "New Collection" button without visual clipping.
2. WHEN the inline collection creation input is visible inside the Collection_Picker, THE PlaceSheet SHALL display the input field and Save button without visual clipping.
3. THE Drawer_Content element of the PlaceSheet SHALL use an overflow strategy that allows the Collection_Picker dropdown to render fully within the visible viewport.
4. THE PlaceSheet SHALL preserve its rounded top corners and drag-to-dismiss behavior after the overflow change.
5. IF the Collection_Picker dropdown extends beyond the scrollable area, THEN THE PlaceSheet SHALL allow the user to scroll to reveal the full dropdown content.
