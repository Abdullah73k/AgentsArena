/**
 * Top navigation bar with route links and theme toggle.
 *
 * Clean, minimal design following the existing shadcn/base-lyra style.
 */

import { Link, useLocation } from "react-router-dom";
import {
  RiDashboardLine,
  RiHistoryLine,
  RiFlaskLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: RiDashboardLine },
  { path: "/tests", label: "Test History", icon: RiHistoryLine },
] as const;

export function TopBar() {
  const location = useLocation();

  return (
    <header className="border-border/50 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          to="/"
          className="text-foreground flex items-center gap-2 text-sm font-semibold"
        >
          <RiFlaskLine className="text-primary size-4" />
          <span>AgentArena</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const isActive =
              path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(path);

            return (
              <Link key={path} to={path}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "gap-1.5",
                    isActive && "text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />
      </div>
    </header>
  );
}
