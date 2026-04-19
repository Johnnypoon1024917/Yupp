"use client";

import { Compass, PlusCircle, User } from "lucide-react";

export interface BottomNavProps {
  activeTab: "discover" | "add" | "profile";
  onTabChange: (tab: "discover" | "add" | "profile") => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-6 px-8 py-3 rounded-full bg-white/80 backdrop-blur-xl border border-white/20"
      role="navigation"
      aria-label="Main navigation"
    >
      <button
        type="button"
        onClick={() => onTabChange("discover")}
        aria-label="Discover"
        aria-current={activeTab === "discover" ? "page" : undefined}
        className="relative flex items-center justify-center p-2"
      >
        <Compass size={24} color="#000000" />
        {activeTab === "discover" && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-black" />
        )}
      </button>

      <button
        type="button"
        onClick={() => onTabChange("add")}
        aria-label="Add"
        className="flex items-center justify-center p-2"
      >
        <PlusCircle size={24} color="#6366F1" />
      </button>

      <button
        type="button"
        onClick={() => onTabChange("profile")}
        aria-label="Profile"
        aria-current={activeTab === "profile" ? "page" : undefined}
        className="relative flex items-center justify-center p-2"
      >
        <User size={24} color="#000000" />
        {activeTab === "profile" && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-black" />
        )}
      </button>
    </nav>
  );
}
