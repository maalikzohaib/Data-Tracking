"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { Menu, Sun, Moon, LogOut } from "lucide-react";

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
    <header className="sticky top-0 z-40 h-14 w-full bg-panel/95 backdrop-blur-sm border-b border-border px-4 lg:px-6 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        {/* Menu Toggle — pill button */}
        <button
          onClick={onToggleMenu}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-pill border border-border hover:border-text text-text text-sm font-medium transition-all"
          title="Open Navigation Menu"
        >
          <Menu className="w-4 h-4 stroke-[1.75]" />
          <span className="hidden sm:inline text-xs font-medium">Menu</span>
        </button>

        <div className="flex items-center gap-2.5 border-l border-border pl-3">
          <div
            className="h-7 w-7 rounded-pill bg-text flex items-center justify-center text-bg font-semibold text-xs cursor-pointer transition-transform hover:scale-105"
            onClick={() => router.push("/orders")}
          >
            B
          </div>
          <div>
            <div className="font-medium text-sm leading-tight text-text flex items-center gap-2">
              Business Tracker
              <span className="hidden md:inline-block text-eyebrow px-2.5 py-0.5 rounded-pill bg-aloe text-black font-medium">
                {currentTitle}
              </span>
            </div>
            <div className="text-micro text-muted hidden sm:block">Shopify · Meta · PKR</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme Switcher — pill */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill border border-border hover:border-text text-xs font-medium text-text transition-colors"
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
        >
          {theme === "dark" ? (
            <Sun className="w-3.5 h-3.5 stroke-[2]" />
          ) : (
            <Moon className="w-3.5 h-3.5 stroke-[2]" />
          )}
          <span className="hidden sm:inline font-medium">
            {theme === "dark" ? "Light" : "Dark"}
          </span>
        </button>

        {/* Logout — pill */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill border border-border hover:border-bad hover:text-bad text-xs font-medium text-muted transition-colors"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5 stroke-[1.75]" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
