"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";

const PAGE_TITLES: Record<string, string> = {
  "/": "Orders / Sales",
  "/orders": "Orders / Sales",
  "/dashboard": "Dashboard",
  "/profit": "Profit Report",
  "/expenses": "Expenses",
  "/cashflow": "Cash Flow",
  "/meta": "Meta Ads",
  "/cod": "COD Charges",
  "/inventory": "Inventory",
  "/settings": "Settings",
};

export default function TopBar({ onToggleMenu }: { onToggleMenu: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  // Hide top bar on login page
  if (pathname === "/login") return null;

  const currentTitle = PAGE_TITLES[pathname] || "Business Tracker";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 h-16 w-full bg-panel/90 backdrop-blur-md border-b border-border px-4 lg:px-6 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-4">
        {/* Top Menu Icon Toggle */}
        <button
          onClick={onToggleMenu}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-panel2 border border-border hover:border-brand text-text font-medium text-sm transition-all hover:scale-105"
          title="Open Navigation Menu"
        >
          <span className="text-lg leading-none">☰</span>
          <span className="hidden sm:inline text-xs font-semibold">Menu</span>
        </button>

        <div className="flex items-center gap-3 border-l border-border pl-4">
          <div
            className="h-8 w-8 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-glow font-display cursor-pointer"
            style={{ backgroundImage: "linear-gradient(135deg, #10b981, #f5c451)" }}
            onClick={() => router.push("/orders")}
          >
            B
          </div>
          <div>
            <div className="font-display font-bold text-sm leading-tight text-text flex items-center gap-2">
              Business Tracker
              <span className="hidden md:inline-block text-[10px] px-2 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-brand-light font-medium">
                {currentTitle}
              </span>
            </div>
            <div className="text-[11px] text-muted hidden sm:block">Shopify · Meta · PKR</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Light/Dark Theme Switcher */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-panel2 border border-border hover:border-brand text-xs font-medium text-text transition-colors"
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
        >
          <span>{theme === "dark" ? "☀️" : "🌙"}</span>
          <span className="hidden sm:inline font-semibold">
            {theme === "dark" ? "Light" : "Dark"}
          </span>
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 rounded-xl bg-panel2 border border-border hover:border-red-500/50 hover:text-red-500 text-xs font-medium text-muted transition-colors"
          title="Sign out"
        >
          🚪 <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
