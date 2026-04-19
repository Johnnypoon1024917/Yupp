-- =============================================================
-- Itineraries table
-- =============================================================
CREATE TABLE itineraries (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id),
  name       TEXT        NOT NULL,
  trip_date  DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================
-- Enable Row-Level Security
-- =============================================================
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- RLS policies for itineraries
-- =============================================================
CREATE POLICY select_own_itineraries ON itineraries FOR SELECT USING (user_id = auth.uid());
CREATE POLICY insert_own_itineraries ON itineraries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY update_own_itineraries ON itineraries FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY delete_own_itineraries ON itineraries FOR DELETE USING (user_id = auth.uid());

-- =============================================================
-- Itinerary Items table
-- =============================================================
CREATE TABLE itinerary_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id  UUID        NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  pin_id        UUID        NOT NULL REFERENCES pins(id),
  day_number    INT         DEFAULT 1,
  sort_order    INT         NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- =============================================================
-- Enable Row-Level Security
-- =============================================================
ALTER TABLE itinerary_items ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- RLS policies for itinerary_items
-- =============================================================
CREATE POLICY select_own_itinerary_items ON itinerary_items FOR SELECT
  USING (itinerary_id IN (SELECT id FROM itineraries WHERE user_id = auth.uid()));
CREATE POLICY insert_own_itinerary_items ON itinerary_items FOR INSERT
  WITH CHECK (itinerary_id IN (SELECT id FROM itineraries WHERE user_id = auth.uid()));
CREATE POLICY update_own_itinerary_items ON itinerary_items FOR UPDATE
  USING (itinerary_id IN (SELECT id FROM itineraries WHERE user_id = auth.uid()));
CREATE POLICY delete_own_itinerary_items ON itinerary_items FOR DELETE
  USING (itinerary_id IN (SELECT id FROM itineraries WHERE user_id = auth.uid()));
