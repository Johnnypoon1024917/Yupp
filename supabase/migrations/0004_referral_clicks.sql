-- =============================================================
-- Referral clicks table for affiliate link tracking
-- =============================================================
CREATE TABLE referral_clicks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES auth.users(id),
  pin_id        UUID        NOT NULL,
  platform_name TEXT        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own rows
CREATE POLICY insert_own_referral_clicks ON referral_clicks
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Allow anonymous inserts (user_id is null)
CREATE POLICY insert_anon_referral_clicks ON referral_clicks
  FOR INSERT WITH CHECK (user_id IS NULL);
