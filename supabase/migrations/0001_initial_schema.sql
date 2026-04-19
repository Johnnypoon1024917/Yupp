-- =============================================================
-- Collections table
-- =============================================================
CREATE TABLE collections (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id),
  name       TEXT        NOT NULL,
  is_public  BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================
-- Pins table
-- =============================================================
CREATE TABLE pins (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id),
  collection_id UUID        NOT NULL REFERENCES collections(id),
  title         TEXT        NOT NULL,
  image_url     TEXT        NOT NULL,
  source_url    TEXT        NOT NULL,
  latitude      FLOAT       NOT NULL,
  longitude     FLOAT       NOT NULL,
  place_id      TEXT,
  primary_type  TEXT,
  rating        FLOAT,
  description   TEXT,
  address       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- =============================================================
-- Enable Row-Level Security
-- =============================================================
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins        ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- RLS policies for collections
-- =============================================================
CREATE POLICY select_own_collections ON collections FOR SELECT USING (user_id = auth.uid());
CREATE POLICY insert_own_collections ON collections FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY update_own_collections ON collections FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY delete_own_collections ON collections FOR DELETE USING (user_id = auth.uid());

-- =============================================================
-- RLS policies for pins
-- =============================================================
CREATE POLICY select_own_pins ON pins FOR SELECT USING (user_id = auth.uid());
CREATE POLICY insert_own_pins ON pins FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY update_own_pins ON pins FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY delete_own_pins ON pins FOR DELETE USING (user_id = auth.uid());
