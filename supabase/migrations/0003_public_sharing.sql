-- =============================================================
-- Add is_public column to itineraries
-- =============================================================
ALTER TABLE itineraries ADD COLUMN is_public BOOLEAN DEFAULT false;

-- =============================================================
-- Update RLS policy for itineraries: allow SELECT for owner OR public
-- =============================================================
DROP POLICY IF EXISTS select_own_itineraries ON itineraries;
CREATE POLICY select_own_itineraries ON itineraries FOR SELECT
  USING (user_id = auth.uid() OR is_public = true);

-- =============================================================
-- Update RLS policy for itinerary_items: allow SELECT when parent
-- itinerary is owned by the user OR is public
-- =============================================================
DROP POLICY IF EXISTS select_own_itinerary_items ON itinerary_items;
CREATE POLICY select_own_itinerary_items ON itinerary_items FOR SELECT
  USING (
    itinerary_id IN (
      SELECT id FROM itineraries
      WHERE user_id = auth.uid() OR is_public = true
    )
  );

-- =============================================================
-- Update RLS policy for pins: allow SELECT for owner OR when the
-- pin is referenced by an itinerary_item belonging to a public
-- itinerary
-- =============================================================
DROP POLICY IF EXISTS select_own_pins ON pins;
CREATE POLICY select_own_pins ON pins FOR SELECT
  USING (
    user_id = auth.uid()
    OR id IN (
      SELECT ii.pin_id FROM itinerary_items ii
      JOIN itineraries i ON i.id = ii.itinerary_id
      WHERE i.is_public = true
    )
  );
