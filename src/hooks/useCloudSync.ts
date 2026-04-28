'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import useTravelPinStore from '@/store/useTravelPinStore';
import type { Pin, Collection } from '@/types';

// ---------------------------------------------------------------------------
// Toast helper (lightweight DOM-based, no external library)
// ---------------------------------------------------------------------------

function showToast(message: string, type: 'success' | 'error') {
  if (typeof document === 'undefined') return;

  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 24px',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    zIndex: '9999',
    opacity: '0',
    transition: 'opacity 0.3s ease',
    background: type === 'success'
      ? 'rgba(34,197,94,0.9)'
      : 'rgba(239,68,68,0.9)',
    backdropFilter: 'blur(8px)',
  });

  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---------------------------------------------------------------------------
// Pure helper: 8.2 — Local data detection
// ---------------------------------------------------------------------------

export function getLocalData(
  pins: Pin[],
  collections: Collection[],
): { localPins: Pin[]; localCollections: Collection[] } {
  return {
    localPins: pins.filter((p) => p.user_id === undefined),
    localCollections: collections.filter((c) => c.user_id === undefined),
  };
}

// ---------------------------------------------------------------------------
// Pure helper: 8.3 — Collection ID mapping
// ---------------------------------------------------------------------------

export function buildCollectionIdMap(
  localCollections: Collection[],
  cloudCollections: { id: string; name?: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const local of localCollections) {
    const match = cloudCollections.find((c) => c.name === local.name);
    if (match) {
      map.set(local.id, match.id);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Pure helper: 8.4 — Pin collection ID remapping
// ---------------------------------------------------------------------------

export function remapPinCollectionIds(
  pins: Pin[],
  idMap: Map<string, string>,
  unorganizedCloudId: string,
): Pin[] {
  return pins.map((pin) => ({
    ...pin,
    collectionId: idMap.get(pin.collectionId) ?? unorganizedCloudId,
  }));
}

// ---------------------------------------------------------------------------
// Hydrate helpers — map Supabase rows → app types
// ---------------------------------------------------------------------------

function hydrateCollections(rows: Record<string, unknown>[]): Collection[] {
  return rows.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    createdAt: c.created_at as string,
    user_id: c.user_id as string,
    isPublic: c.is_public as boolean,
  }));
}

function hydratePins(rows: Record<string, unknown>[]): Pin[] {
  return rows.map((p) => ({
    id: p.id as string,
    title: p.title as string,
    description: (p.description as string) ?? undefined,
    imageUrl: p.image_url as string,
    sourceUrl: p.source_url as string,
    latitude: p.latitude as number,
    longitude: p.longitude as number,
    collectionId: p.collection_id as string,
    createdAt: p.created_at as string,
    user_id: p.user_id as string,
    placeId: (p.place_id as string) ?? undefined,
    primaryType: (p.primary_type as string) ?? undefined,
    rating: (p.rating as number) ?? undefined,
    address: (p.address as string) ?? undefined,
  }));
}

// ---------------------------------------------------------------------------
// Ensure authenticated session — auto sign-in anonymously if needed
// ---------------------------------------------------------------------------

async function ensureSession(supabase: ReturnType<typeof createClient>) {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    return session.user;
  }

  // No session — sign in anonymously so we have a user_id for RLS
  console.log('[useCloudSync] No session found, signing in anonymously...');
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    console.error('[useCloudSync] Anonymous sign-in failed:', error.message);
    return null;
  }

  console.log('[useCloudSync] Anonymous session created:', data.user?.id);
  return data.user;
}

// ---------------------------------------------------------------------------
// Resolve or create the "Unorganized" collection for a user
// ---------------------------------------------------------------------------

async function resolveUnorganizedCollection(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('collections')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'Unorganized')
    .limit(1)
    .single();

  if (existing) return existing.id;

  const { data: created } = await supabase
    .from('collections')
    .insert({ user_id: userId, name: 'Unorganized' })
    .select('id')
    .single();

  if (!created) throw new Error('Failed to create Unorganized collection');
  return created.id;
}

// ---------------------------------------------------------------------------
// Core sync: push unsynced local data → Supabase, then hydrate store
// ---------------------------------------------------------------------------

async function pushLocalDataAndHydrate(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const { pins, collections } = useTravelPinStore.getState();
  const { setCloudData } = useTravelPinStore.getState();
  const { localPins, localCollections } = getLocalData(pins, collections);

  const collectionsToInsert = localCollections.filter(
    (c) => c.id !== 'unorganized',
  );

  let collectionIdMap = new Map<string, string>();
  const unorganizedCloudId = await resolveUnorganizedCollection(supabase, userId);

  // Batch insert local collections, build ID map
  if (collectionsToInsert.length > 0) {
    const rows = collectionsToInsert.map((c) => ({
      user_id: userId,
      name: c.name,
      is_public: c.isPublic ?? false,
    }));

    const { data: cloudCols, error: colErr } = await supabase
      .from('collections')
      .insert(rows)
      .select('id, name');

    if (colErr) throw colErr;
    collectionIdMap = buildCollectionIdMap(collectionsToInsert, cloudCols ?? []);
  }

  collectionIdMap.set('unorganized', unorganizedCloudId);

  // Remap pin collection IDs and batch insert
  if (localPins.length > 0) {
    const remappedPins = remapPinCollectionIds(localPins, collectionIdMap, unorganizedCloudId);

    const pinRows = remappedPins.map((p) => ({
      user_id: userId,
      collection_id: p.collectionId,
      title: p.title,
      description: p.description ?? null,
      image_url: p.imageUrl,
      source_url: p.sourceUrl,
      latitude: p.latitude,
      longitude: p.longitude,
      place_id: p.placeId ?? null,
      primary_type: p.primaryType ?? null,
      rating: p.rating ?? null,
      address: p.address ?? null,
    }));

    const { error: pinErr } = await supabase.from('pins').insert(pinRows);
    if (pinErr) throw pinErr;
  }

  // Post-sync hydration
  const { data: cloudCollections } = await supabase
    .from('collections').select('*').eq('user_id', userId);
  const { data: cloudPins } = await supabase
    .from('pins').select('*').eq('user_id', userId);

  setCloudData(
    hydratePins((cloudPins ?? []) as Record<string, unknown>[]),
    hydrateCollections((cloudCollections ?? []) as Record<string, unknown>[]),
  );

  return { syncedPins: localPins.length, syncedCollections: collectionsToInsert.length };
}

// ---------------------------------------------------------------------------
// Main hook — ensures a session exists (anonymous or real), then syncs
// ---------------------------------------------------------------------------

export default function useCloudSync() {
  useEffect(() => {
    const supabase = createClient();
    const { setUser } = useTravelPinStore.getState();
    let isMounted = true;

    // Boot: ensure we always have a session (anonymous if needed)
    async function boot() {
      const user = await ensureSession(supabase);
      if (!user || !isMounted) return;

      setUser(user);

      // Push any unsynced local pins
      try {
        const { pins } = useTravelPinStore.getState();
        const hasUnsyncedPins = pins.some((p) => p.user_id === undefined);
        if (hasUnsyncedPins) {
          const { syncedPins } = await pushLocalDataAndHydrate(supabase, user.id);
          if (syncedPins > 0) {
            showToast('Pins synced to the cloud ☁️', 'success');
          }
        }
      } catch (err) {
        console.error('[useCloudSync] Initial sync failed:', err);
        showToast('Sync failed — your local data is safe', 'error');
      }
    }

    boot();

    // Listen for auth state changes (Google sign-in upgrades anonymous session)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        setUser(session.user);

        try {
          const { syncedPins } = await pushLocalDataAndHydrate(supabase, session.user.id);
          if (syncedPins > 0) {
            showToast('Your pins have been synced to the cloud ☁️', 'success');
          }
        } catch (err) {
          console.error('[useCloudSync] Auth change sync failed:', err);
          showToast('Sync failed — your local data is safe', 'error');
        }
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        // Immediately restore an anonymous session so local pins can still be saved
        supabase.auth.signInAnonymously().then(({ data }) => {
          if (data.user && isMounted) setUser(data.user);
        });
      }
    });

    // Live sync: push new pins to Supabase as they're added
    const unsubscribeStore = useTravelPinStore.subscribe(
      async (state, prevState) => {
        if (state.pins.length <= prevState.pins.length) return;
        if (!state.user) return;

        const prevIds = new Set(prevState.pins.map((p) => p.id));
        const newPins = state.pins.filter(
          (p) => !prevIds.has(p.id) && p.user_id === undefined,
        );
        if (newPins.length === 0) return;

        try {
          const unorganizedCloudId = await resolveUnorganizedCollection(
            supabase, state.user.id,
          );

          // Build collection ID map so each pin uses its actual collectionId
          const { collections: localCollections } = useTravelPinStore.getState();
          const { data: cloudCols } = await supabase
            .from('collections')
            .select('id, name')
            .eq('user_id', state.user.id);
          const collectionIdMap = buildCollectionIdMap(
            localCollections,
            cloudCols ?? [],
          );
          collectionIdMap.set('unorganized', unorganizedCloudId);

          const pinRows = newPins.map((p) => ({
            user_id: state.user!.id,
            collection_id: collectionIdMap.get(p.collectionId) ?? unorganizedCloudId,
            title: p.title,
            description: p.description ?? null,
            image_url: p.imageUrl,
            source_url: p.sourceUrl,
            latitude: p.latitude,
            longitude: p.longitude,
            place_id: p.placeId ?? null,
            primary_type: p.primaryType ?? null,
            rating: p.rating ?? null,
            address: p.address ?? null,
          }));

          const { data: insertedPins, error: pinErr } = await supabase
            .from('pins')
            .insert(pinRows)
            .select('*');

          if (pinErr) {
            console.error('[liveSync] Pin insert failed:', pinErr);
            showToast('Failed to save pin to cloud', 'error');
            return;
          }

          if (insertedPins && insertedPins.length > 0) {
            const hydratedNew = hydratePins(insertedPins as Record<string, unknown>[]);
            const { pins: currentPins } = useTravelPinStore.getState();
            const newPinIds = new Set(newPins.map((p) => p.id));
            const updatedPins = currentPins
              .filter((p) => !newPinIds.has(p.id))
              .concat(hydratedNew);
            useTravelPinStore.setState({ pins: updatedPins });
          }
        } catch (err) {
          console.error('[liveSync] Unexpected error:', err);
        }
      },
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      unsubscribeStore();
    };
  }, []);
}
