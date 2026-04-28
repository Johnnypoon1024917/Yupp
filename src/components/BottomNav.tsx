"use client";

import { CalendarDays, Compass, PlusCircle, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getReducedMotion, DURATION_FAST, EASE_OUT, reducedTransition } from "@/utils/motion";

export interface BottomNavProps {
  activeTab: "discover" | "add" | "plan" | "profile";
  onTabChange: (tab: "discover" | "add" | "plan" | "profile") => void;
}

const tabs = [
  { id: "discover" as const, label: "Discover", Icon: Compass },
  { id: "add" as const, label: "Add", Icon: PlusCircle },
  { id: "plan" as const, label: "Plan", Icon: CalendarDays },
  { id: "profile" as const, label: "Profile", Icon: User },
];

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const reduced = typeof window !== "undefined" ? getReducedMotion() : false;

  return (
    <nav
      className="absolute bottom-0 left-1/2 -translate-x-1/2 z-[90] w-full max-w-md flex items-center justify-between px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-surface/70 backdrop-blur-3xl border-t border-border rounded-t-sheet"
      role="navigation"
      aria-label="Main navigation"
    >
      {tabs.map(({ id, label, Icon }) => {
        const isActive = activeTab === id;

        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            className="relative flex flex-col items-center justify-center gap-0.5 px-4 py-1.5 transition-colors"
          >
            {/* Animated pill highlight */}
            {isActive && !reduced && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 bg-brand-soft rounded-pill"
                transition={{ duration: DURATION_FAST, ease: EASE_OUT }}
              />
            )}
            {isActive && reduced && (
              <AnimatePresence mode="wait">
                <motion.span
                  key={id}
                  className="absolute inset-0 bg-brand-soft rounded-pill"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={reducedTransition}
                />
              </AnimatePresence>
            )}

            <Icon
              size={22}
              className={`relative z-10 transition-colors ${
                isActive ? "text-brand" : "text-ink-2"
              }`}
              aria-hidden="true"
            />
            <span
              className={`relative z-10 text-caption transition-colors ${
                isActive ? "text-brand" : "text-ink-2"
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
