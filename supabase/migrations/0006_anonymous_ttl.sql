-- =============================================================
-- Enable pg_cron extension
-- =============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- =============================================================
-- Purge function: deletes anonymous users older than 48 hours
-- Relies on ON DELETE CASCADE to clean up dependent rows
-- (pins, collections, itineraries, itinerary_items)
-- =============================================================
CREATE OR REPLACE FUNCTION public.purge_old_anonymous_users()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM auth.users
  WHERE is_anonymous = true
    AND created_at < now() - interval '48 hours';
$$;

-- =============================================================
-- Hourly cron job (idempotent: unschedule then schedule)
-- =============================================================
DO $$
BEGIN
  PERFORM cron.unschedule('purge-old-anonymous-users');
EXCEPTION
  WHEN others THEN
    -- Job does not exist yet; ignore
    NULL;
END;
$$;

SELECT cron.schedule(
  'purge-old-anonymous-users',
  '0 * * * *',
  $$SELECT public.purge_old_anonymous_users()$$
);
