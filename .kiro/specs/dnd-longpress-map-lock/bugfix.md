# Bugfix Requirements Document

## Introduction

The Drag-and-Drop (DnD) system for pins in the planner sidebar conflicts with map panning. When a user tries to drag a pin from the SavedLibrary, the map underneath also receives pointer events and starts panning. The `PointerSensor` uses a distance-based activation constraint (`distance: 5`) that triggers too easily and cannot distinguish between a "map pan" gesture and a "pin drag" intent. Additionally, the `DndContext` only wraps the `PlannerSidebar` (not the full layout), pointer events propagate from the sidebar to the map, the sidebar uses unreliable `onPointerEnter/Leave` to toggle map interactions, and there is no visual feedback during the drag activation period.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user presses and moves a pin card 5px in the SavedLibrary THEN the system activates drag immediately, and the map underneath simultaneously begins panning because the distance-based `PointerSensor` (`distance: 5`) cannot distinguish drag intent from pan intent

1.2 WHEN a drag is initiated from the SavedLibrary THEN the system cannot coordinate drag events with the map because the `DndContext` only wraps the `PlannerSidebar` component, not the full layout including `MapView`

1.3 WHEN the pointer enters or leaves the PlannerSidebar THEN the system unreliably toggles map interactions via `onPointerEnter`/`onPointerLeave` handlers, causing "ghost" movement events that reach the map and trigger unintended panning

1.4 WHEN a user begins pressing and holding a pin card to initiate a drag THEN the system provides no visual feedback during the activation period, leaving the user unaware that a drag is about to activate

1.5 WHEN a user interacts with the PlannerSidebar THEN the system allows pointer move events to propagate from the sidebar container to the map underneath, causing unintended map movement

1.6 WHEN `disableInteractions` is called on the map during a drag THEN the system does not disable `touchPitch`, leaving an incomplete interaction lockout on touch devices

### Expected Behavior (Correct)

2.1 WHEN a user presses and holds a pin card for 500ms without moving more than 5px THEN the system SHALL activate the drag operation, clearly distinguishing drag intent from map pan gestures via a delay-based `PointerSensor` (`delay: 500, tolerance: 5`)

2.2 WHEN a drag is initiated from the SavedLibrary THEN the system SHALL coordinate drag events globally because the `DndContext` wraps the entire layout (including `MapView`), with the `DragOverlay` rendered at root level

2.3 WHEN a drag starts THEN the system SHALL disable map interactions exclusively via `onDragStart`/`onDragEnd` callbacks, without relying on `onPointerEnter`/`onPointerLeave` handlers on the sidebar

2.4 WHEN a user presses and holds a pin card during the 500ms activation period THEN the system SHALL provide visual feedback (scale and shadow animation via framer-motion `whileTap`) indicating that a drag is about to activate

2.5 WHEN a user interacts with the PlannerSidebar THEN the system SHALL stop propagation of pointer move events on the sidebar container to prevent them from reaching the map

2.6 WHEN `disableInteractions` is called on the map THEN the system SHALL also disable `touchPitch` for a complete interaction lockout, and `enableInteractions` SHALL re-enable `touchPitch`

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a library pin is dragged and dropped onto a day container THEN the system SHALL CONTINUE TO add the pin to the target day correctly

3.2 WHEN a planned pin is dragged within the same day THEN the system SHALL CONTINUE TO reorder the pin correctly

3.3 WHEN a planned pin is dragged between different days THEN the system SHALL CONTINUE TO move the pin to the target day at the correct position

3.4 WHEN the planner sidebar is closed THEN the system SHALL CONTINUE TO re-enable all map interactions

3.5 WHEN the user uses keyboard navigation for drag-and-drop THEN the system SHALL CONTINUE TO support `KeyboardSensor` with sortable keyboard coordinates

3.6 WHEN the user searches for pins in the SavedLibrary THEN the system SHALL CONTINUE TO filter and group pins by region correctly
