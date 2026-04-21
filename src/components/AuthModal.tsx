"use client";

import { Drawer } from "vaul";
import { User } from "lucide-react";
import useTravelPinStore from "@/store/useTravelPinStore";
import { createClient } from "@/utils/supabase/client";

export interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message?: string;
}

export default function AuthModal({ open, onOpenChange, message }: AuthModalProps) {
  const user = useTravelPinStore((s) => s.user);
  const setUser = useTravelPinStore((s) => s.setUser);

  const handleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col backdrop-blur-md bg-surface/90 rounded-t-3xl"
          aria-label="Account"
        >
          <Drawer.Handle className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300" />
          <Drawer.Title className="sr-only">Account</Drawer.Title>

          <div className="px-6 py-6">
            {user ? (
              <div className="flex flex-col items-center gap-4">
                {user.user_metadata?.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="User avatar"
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                    <User size={28} className="text-gray-500" />
                  </div>
                )}

                <p className="text-sm text-gray-600">{user.email}</p>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mt-2 w-full rounded-xl bg-gray-100 py-3 text-sm font-medium text-primary transition-colors hover:bg-gray-200"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                {message && (
                  <p className="text-sm text-gray-600 text-center">{message}</p>
                )}
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
                >
                  Sign in with Google
                </button>
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
