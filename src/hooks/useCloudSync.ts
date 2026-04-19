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
  cloudCollections: { id: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < localCollections.length; i++) {
    if (i < cloudCollections.length) {
      map.set(localCollections[i].id, cloudCollections[i].id);
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
// Main hook: 8.1, 8.5, 8.6, 8.7
// ---------------------------------------------------------------------------

export default function useCloudSync() {
  useEffect(() => {
    const supabase = createClient();
    const { setUser, setCloudData } = useTravelPinStore.getState();

    // 8.1 — Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      }
    });

    // 8.1 / 8.6 — Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user;
        setUser(user);

        try {
          // 8.2 — Detect local data
          const { pins, collections } = useTravelPinStore.getState();
          const { localPins, localCollections } = getLocalData(pins, collections);

          // Filter out the default "unorganized" placeholder — it's not a real
          // user collection and shouldn't be inserted into Supabase.
          const collectionsToInsert = localCollections.filter(
            (c) => c.id !== 'unorganized',
          );

          let collectionIdMap = new Map<string, string>();
          let unorganizedCloudId: string | undefined;

          // Ensure the user has an "Unorganized" collection in the cloud
          const { data: existingUnorganized } = await supabase
            .from('collections')
            .select('id')
            .eq('user_id', user.id)
            .eq('name', 'Unorganized')
            .limit(1)
            .single();

          if (existingUnorganized) {
            unorganizedCloudId = existingUnorganized.id;
          } else {
            const { data: newUnorganized } = await supabase
              .from('collections')
              .insert({ user_id: user.id, name: 'Unorganized' })
              .select('id')
              .single();
            unorganizedCloudId = newUnorganized?.id;
          }

          if (!unorganizedCloudId) {
            throw new Error('Failed to resolve unorganized collection');
          }

          // 8.3 — Batch insert local collections, build ID map
          if (collectionsToInsert.length > 0) {
            const rows = collectionsToInsert.map((c) => ({
              user_id: user.id,
              name: c.name,
              is_public: c.isPublic ?? false,
            }));

            const { data: cloudCols, error: colErr } = await supabase
              .from('collections')
              .insert(rows)
              .select('id');

            if (colErr) throw colErr;
            collectionIdMap = buildCollectionIdMap(
              collectionsToInsert,
              cloudCols ?? [],
            );
          }

          // Map the local "unorganized" id to the cloud unorganized id
          collectionIdMap.set('unorganized', unorganizedCloudId);

          // 8.4 — Remap pin collection IDs and batch insert
          if (localPins.length > 0) {
            const remappedPins = remapPinCollectionIds(
              localPins,
              collectionIdMap,
              unorganizedCloudId,
            );

            const pinRows = remappedPins.map((p) => ({
              user_id: user.id,
              collection_id: p.collectionId,
              title: p.title,
              image_url: p.imageUrl,
              source_url: p.sourceUrl,
              latitude: p.latitude,
              longitude: p.longitude,
              place_id: p.placeId ?? null,
              primary_type: p.primaryType ?? null,
              rating: p.rating ?? null,
            }));

            const { error: pinErr } = await supabase
              .from('pins')
              .insert(pinRows);

            if (pinErr) throw pinErr;
          }

          // 8.5 — Post-migration hydration
          const { data: cloudCollections } = await supabase
            .from('collections')
            .select('*')
            .eq('user_id', user.id);

          const { data: cloudPins } = await supabase
            .from('pins')
            .select('*')
            .eq('user_id', user.id);

          const hydratedCollections: Collection[] = (cloudCollections ?? []).map(
            (c: Record<string, unknown>) => ({
              id: c.id as string,
              name: c.name as string,
              createdAt: c.created_at as string,
              user_id: c.user_id as string,
              isPublic: c.is_public as boolean,
            }),
          );

          const hydratedPins: Pin[] = (cloudPins ?? []).map(
            (p: Record<string, unknown>) => ({
              id: p.id as string,
              title: p.title as string,
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
            }),
          );

          setCloudData(hydratedPins, hydratedCollections);

          // 8.7 — Success toast
          showToast('Your pins have been synced to the cloud ☁️', 'success');
        } catch (err) {
          // 8.7 — Error toast, retain local data
          console.error('Cloud sync failed:', err);
          showToast('Sync failed — your local data is safe', 'error');
        }
      }

      // 8.6 — Handle sign-out
      if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    // 8.1 — Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);
}
