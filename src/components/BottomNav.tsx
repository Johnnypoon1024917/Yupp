"use client";

import { CalendarDays, Compass, PlusCircle, User } from "lucide-react";

export interface BottomNavProps {
  activeTab: "discover" | "add" | "plan" | "profile";
  onTabChange: (tab: "discover" | "add" | "plan" | "profile") => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      className="absolute bottom-0 left-1/2 -translate-x-1/2 z-[90] w-full max-w-md flex items-center justify-between px-8 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-white/70 backdrop-blur-3xl border-t border-white/40 rounded-t-[32px]"
      role="navigation"
      aria-label="Main navigation"
    >
      <button
        type="button"
        onClick={() => onTabChange("discover")}
        aria-label="Discover"
        aria-current={activeTab === "discover" ? "page" : undefined}
        className={`relative flex items-center justify-center p-2 transition-transform duration-200 ${activeTab === "discover" ? "scale-110" : ""}`}
      >
        <Compass size={24} className={`transition-colors duration-200 ${activeTab === "discover" ? "text-accent" : "text-black"}`} />
        {activeTab === "discover" && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
        )}
      </button>

      <button
        type="button"
        onClick={() => onTabChange("add")}
        aria-label="Add"
        className={`flex items-center justify-center p-2 transition-transform duration-200 ${activeTab === "add" ? "scale-110" : ""}`}
      >
        <PlusCircle size={24} className="text-accent" />
      </button>

      <button
        type="button"
        onClick={() => onTabChange("plan")}
        aria-label="Plan"
        aria-current={activeTab === "plan" ? "page" : undefined}
        className={`relative flex items-center justify-center p-2 transition-transform duration-200 ${activeTab === "plan" ? "scale-110" : ""}`}
      >
        <CalendarDays size={24} className={`transition-colors duration-200 ${activeTab === "plan" ? "text-accent" : "text-black"}`} />
        {activeTab === "plan" && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
        )}
      </button>

      <button
        type="button"
        onClick={() => onTabChange("profile")}
        aria-label="Profile"
        aria-current={activeTab === "profile" ? "page" : undefined}
        className={`relative flex items-center justify-center p-2 transition-transform duration-200 ${activeTab === "profile" ? "scale-110" : ""}`}
      >
        <User size={24} className={`transition-colors duration-200 ${activeTab === "profile" ? "text-accent" : "text-black"}`} />
        {activeTab === "profile" && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
        )}
      </button>
    </nav>
  );
}
