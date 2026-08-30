"use client";

import { useState } from "react";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text transition-colors">
      <TopBar onToggleMenu={() => setMenuOpen((v) => !v)} />
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main className="flex-1 w-full min-w-0">
        <div className="w-full px-2 py-4 sm:px-3">
          {children}
        </div>
      </main>
    </div>
  );
}
