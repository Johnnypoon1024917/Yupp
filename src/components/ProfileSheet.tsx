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
        <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[100] mx-auto max-w-md flex flex-col bg-surface rounded-t-[32px] shadow-[0_-8px_40px_rgba(0,0,0,0.12)] outline-none"
          aria-label="Profile"
        >
          <div className="mx-auto mt-4 mb-5 h-1.5 w-12 rounded-full bg-gray-300 flex-shrink-0" />
          <Drawer.Title className="sr-only">Profile</Drawer.Title>

          <div className="max-h-[85vh] overflow-y-auto px-6 py-1 pb-6 space-y-6">
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
                    <p className="text-sm font-medium text-gray-500 tracking-wide truncate">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-gray-200"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
                >
                  Sign in with Google
                </button>
              )}
            </div>

            {/* Collections grid */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 tracking-wide mb-3">
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
