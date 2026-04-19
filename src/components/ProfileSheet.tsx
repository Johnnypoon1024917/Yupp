'use client';

import { Drawer } from 'vaul';
import { User } from 'lucide-react';
import useTravelPinStore from '@/store/useTravelPinStore';
import { createClient } from '@/utils/supabase/client';
import CollectionCard from '@/components/CollectionCard';

export interface ProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileSheet({ open, onOpenChange }: ProfileSheetProps) {
  const user = useTravelPinStore((s) => s.user);
  const setUser = useTravelPinStore((s) => s.setUser);
  const collections = useTravelPinStore((s) => s.collections);
  const pins = useTravelPinStore((s) => s.pins);
  const setActiveCollection = useTravelPinStore((s) => s.setActiveCollection);

  const handleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  const sorted = [...collections].sort((a, b) => {
    if (a.id === 'unorganized') return -1;
    if (b.id === 'unorganized') return 1;
    return 0;
  });

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-surface"
          aria-label="Profile"
        >
          <Drawer.Handle className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300" />
          <Drawer.Title className="sr-only">Profile</Drawer.Title>

          <div className="max-h-[85vh] overflow-y-auto px-6 py-6 space-y-6">
            {/* Auth section */}
            <div>
              {user ? (
                <div className="flex items-center gap-4">
                  {user.user_metadata?.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="User avatar"
                      className="h-14 w-14 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
                      <User size={24} className="text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">
                      {user.user_metadata?.full_name ?? user.email}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-medium text-primary transition-colors hover:bg-gray-200"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
                >
                  Sign in with Google
                </button>
              )}
            </div>

            {/* Collections grid */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Collections
              </h3>
              {collections.length === 0 ? (
                <p className="text-sm text-gray-400">No collections yet.</p>
              ) : (
                <div className="space-y-3">
                  {sorted.map((collection) => {
                    const collectionPins = pins.filter(
                      (p) => p.collectionId === collection.id,
                    );
                    return (
                      <CollectionCard
                        key={collection.id}
                        collection={collection}
                        pins={collectionPins}
                        onClick={(id) => setActiveCollection(id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
