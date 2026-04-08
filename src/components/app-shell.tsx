"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  LayoutDashboard,
  Menu,
  MoonStar,
  Settings,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { PomodoroOverlay } from "@/components/pomodoro-overlay";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Hoy", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/day", label: "Plan", icon: <CalendarDays className="h-4 w-4" /> },
  { href: "/space", label: "Space", icon: <MoonStar className="h-4 w-4" /> },
  { href: "/resources", label: "Recursos", icon: <BookOpen className="h-4 w-4" /> },
  { href: "/srs", label: "SRS", icon: <Brain className="h-4 w-4" /> },
  { href: "/stats", label: "Stats", icon: <BarChart3 className="h-4 w-4" /> },
  { href: "/settings", label: "Ajustes", icon: <Settings className="h-4 w-4" /> },
];

function NavLinks({ className, showLabels = true }: { className?: string; showLabels?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex gap-1", className)}>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
            )}
          >
            {item.icon}
            {showLabels ? <span>{item.label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isScrolledOnHome, setIsScrolledOnHome] = useState(false);

  useEffect(() => {
    if (pathname !== "/") return;

    const onScroll = () => {
      setIsScrolledOnHome(window.scrollY > 40);
    };

    const syncId = window.setTimeout(onScroll, 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(syncId);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  const integratedAtTop = pathname === "/" && !isScrolledOnHome;

  return (
    <div className="min-h-dvh bg-background">
      <PomodoroOverlay />
      <header
        className={cn(
          "inset-x-0 top-0 z-40 transition-all duration-500",
          integratedAtTop
            ? "absolute border-b border-transparent bg-transparent"
            : "fixed border-b border-border/50 bg-background/75 backdrop-blur-xl",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger
                render={
                  <button
                    type="button"
                    className="md:hidden inline-flex size-9 items-center justify-center rounded-xl transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  />
                }
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <SheetHeader className="px-5 py-5">
                  <SheetTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Somagnus
                  </SheetTitle>
                </SheetHeader>
                <Separator />
                <NavLinks className="flex-col px-3 py-3" />
              </SheetContent>
            </Sheet>

            <Link href="/" className="flex items-center gap-2 text-base font-bold tracking-tight">
              <Zap className="h-5 w-5 text-primary" />
              <span>Somagnus</span>
            </Link>
          </div>

          <div className="ml-auto hidden md:flex">
            <NavLinks className="flex-row gap-0.5" />
          </div>
        </div>
      </header>

      <main className={cn("mx-auto w-full max-w-7xl px-6", pathname === "/" ? "py-8" : "pb-8 pt-24")}>{children}</main>
    </div>
  );
}
