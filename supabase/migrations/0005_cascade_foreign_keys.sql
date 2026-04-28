-- =============================================================
-- Add ON DELETE CASCADE to foreign keys that reference auth.users
-- and pins, so user deletion cascades cleanly.
-- =============================================================

-- pins.user_id → auth.users(id)
ALTER TABLE pins
  DROP CONSTRAINT pins_user_id_fkey,
  ADD CONSTRAINT pins_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- collections.user_id → auth.users(id)
ALTER TABLE collections
  DROP CONSTRAINT collections_user_id_fkey,
  ADD CONSTRAINT collections_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- itinerary_items.pin_id → pins(id)
ALTER TABLE itinerary_items
  DROP CONSTRAINT itinerary_items_pin_id_fkey,
  ADD CONSTRAINT itinerary_items_pin_id_fkey
    FOREIGN KEY (pin_id) REFERENCES pins(id) ON DELETE CASCADE;
