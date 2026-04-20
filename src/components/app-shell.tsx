"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MoonStar,
  Settings,
  X,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { PomodoroOverlay } from "@/components/pomodoro-overlay";
import { GlobalRabbitMascot } from "@/components/global-rabbit-mascot";
import { RabbitGuidePanel } from "@/components/rabbit-guide-panel";
import { SpaceGlobalPlayer } from "@/components/space-global-player";
import { StarField } from "@/components/star-field";
import { readSpacePreference, resolveSpaceMode } from "@/lib/space-theme-resolver";
import { SPACE_SKY, SPACE_THEME_STORAGE_KEY, type SpaceMode } from "@/lib/space-theme-tokens";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Hoy", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/day", label: "Plan", icon: <CalendarDays className="h-4 w-4" /> },
  { href: "/space", label: "Calma", icon: <MoonStar className="h-4 w-4" /> },
  { href: "/biblioteca", label: "Recursos", icon: <BookOpen className="h-4 w-4" /> },
  { href: "/academico", label: "Académico", icon: <GraduationCap className="h-4 w-4" /> },
  { href: "/srs", label: "SRS", icon: <Brain className="h-4 w-4" /> },
  { href: "/stats", label: "Stats", icon: <BarChart3 className="h-4 w-4" /> },
  { href: "/settings", label: "Ajustes", icon: <Settings className="h-4 w-4" /> },
];

function getRouteTitle(pathname: string | null): { label: string; icon: React.ReactNode } {
  if (!pathname) return { label: "Somagnus", icon: <Zap className="h-4 w-4" /> };
  const exact = NAV_ITEMS.find((i) => i.href === pathname);
  if (exact) return { label: exact.label, icon: exact.icon };
  const prefix = NAV_ITEMS.find(
    (i) => i.href !== "/" && pathname.startsWith(i.href + "/"),
  );
  if (prefix) return { label: prefix.label, icon: prefix.icon };
  return { label: "Somagnus", icon: <Zap className="h-4 w-4" /> };
}

function GlobalHeaderMenu({
  open,
  setOpen,
  anchorRect,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  anchorRect: DOMRect | null;
}) {
  const pathname = usePathname();
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = window.setTimeout(() => setRendered(false), 200);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!rendered || typeof document === "undefined") return null;

  const top = anchorRect ? anchorRect.bottom + 10 : 72;
  const right = anchorRect ? Math.max(12, window.innerWidth - anchorRect.right) : 16;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Cerrar menú"
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-[60] cursor-default bg-transparent"
      />
      <div
        ref={cardRef}
        role="menu"
        className={cn(
          "fixed z-[61] w-[min(92vw,340px)] overflow-hidden rounded-3xl border border-border bg-background p-3 shadow-[0_28px_70px_-22px_rgba(0,0,0,0.25)] transition-all duration-200 ease-out",
          visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.96] -translate-y-1",
        )}
        style={{ top, right, willChange: "transform, opacity" }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 opacity-70 blur-2xl"
        />
        <div className="relative flex items-center justify-between px-2 pb-2 pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Navega
          </span>
          <span className="inline-flex h-6 items-center rounded-full bg-primary/15 px-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
            {NAV_ITEMS.length}
          </span>
        </div>
        <ul className="relative space-y-1.5">
          {NAV_ITEMS.map((s, idx) => {
            const active = pathname === s.href;
            const isCalma = s.href === "/space";
            if (isCalma) {
              return (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-3 py-3 text-left text-base font-semibold text-white shadow-[0_10px_30px_-18px_rgba(15,28,64,0.65)] transition-[transform,box-shadow] duration-200 [@media(hover:hover)]:hover:-translate-y-[1px] [@media(hover:hover)]:hover:shadow-[0_14px_34px_-16px_rgba(15,28,64,0.7)]",
                      active ? "border-white/40" : "border-white/15",
                    )}
                    style={{
                      backgroundImage:
                        "radial-gradient(120% 140% at 0% 0%, #1E3470 0%, #172A5E 45%, #0F1D47 80%, #07102B 100%)",
                    }}
                  >
                    {/* tiny stars */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 opacity-70"
                      style={{
                        backgroundImage:
                          "radial-gradient(1px 1px at 18% 30%, rgba(255,255,255,0.9) 50%, transparent 51%),radial-gradient(1px 1px at 72% 20%, rgba(255,255,255,0.7) 50%, transparent 51%),radial-gradient(1.5px 1.5px at 55% 70%, rgba(255,255,255,0.8) 50%, transparent 51%),radial-gradient(1px 1px at 35% 80%, rgba(255,255,255,0.6) 50%, transparent 51%)",
                      }}
                    />
                    <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/25 backdrop-blur-sm">
                      <MoonStar className="h-4 w-4 text-white" />
                    </span>
                    <span className="relative flex-1 truncate">
                      <span className="block leading-tight">{s.label}</span>
                      <span className="block text-[11px] font-medium uppercase tracking-[0.22em] text-white/60">
                        Respira · pausa
                      </span>
                    </span>
                    <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25 transition-colors [@media(hover:hover)]:group-hover:bg-white/25">
                      <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                    </span>
                  </Link>
                </li>
              );
            }
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left text-base font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground [@media(hover:hover)]:hover:bg-muted/60",
                  )}
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-muted to-background ring-1 ring-border">
                    <span className="text-xs font-bold tracking-widest text-muted-foreground">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  </span>
                  <span className="flex-1 truncate inline-flex items-center gap-2">
                    {s.icon}
                    {s.label}
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground [@media(hover:hover)]:group-hover:bg-primary [@media(hover:hover)]:group-hover:text-primary-foreground",
                    )}
                  >
                    <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>,
    document.body,
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isScrolledOnHome, setIsScrolledOnHome] = useState(false);
  const isImmersiveReaderRoute = pathname === "/lector" || (pathname?.startsWith("/lector/") ?? false);
  const isSpaceRoute = pathname === "/space" || (pathname?.startsWith("/space/") ?? false);

  useEffect(() => {
    if (isImmersiveReaderRoute || isSpaceRoute) return;

    const onScroll = () => {
      setIsScrolledOnHome(window.scrollY > 24);
    };

    const syncId = window.setTimeout(onScroll, 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(syncId);
      window.removeEventListener("scroll", onScroll);
    };
  }, [isImmersiveReaderRoute, isSpaceRoute]);

  const integratedAtTop = !isScrolledOnHome;
  const stickyHeaderSolid = isScrolledOnHome;

  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!headerMenuOpen) return;
    const update = () => {
      const el = pillRef.current ?? menuBtnRef.current;
      if (el) setAnchorRect(el.getBoundingClientRect());
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [headerMenuOpen]);

  useEffect(() => {
    setHeaderMenuOpen(false);
  }, [pathname]);

  const routeTitle = getRouteTitle(pathname);

  // Header entrance + route-change micro-animation (mirrors home hero feel).
  useEffect(() => {
    if (isImmersiveReaderRoute || isSpaceRoute) return;
    const pill = pillRef.current;
    const logo = pill?.querySelector<HTMLElement>("[data-app-header-logo]");
    const title = pill?.querySelector<HTMLElement>("[data-app-header-title]");
    const menu = pill?.querySelector<HTMLElement>("[data-app-header-menu]");
    if (!pill) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        pill,
        { y: -12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, ease: "power3.out", clearProps: "all" },
      );
      if (logo) {
        gsap.fromTo(
          logo,
          { x: -8, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.45, ease: "power2.out", delay: 0.1, clearProps: "all" },
        );
      }
      if (title) {
        gsap.fromTo(
          title,
          { y: 6, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.45, ease: "power2.out", delay: 0.18, clearProps: "all" },
        );
      }
      if (menu) {
        gsap.fromTo(
          menu,
          { x: 8, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.45, ease: "power2.out", delay: 0.1, clearProps: "all" },
        );
      }
    });
    return () => ctx.revert();
  }, [pathname, isImmersiveReaderRoute, isSpaceRoute]);

  const [spaceMode, setSpaceMode] = useState<SpaceMode>("day");
  useEffect(() => {
    if (!isSpaceRoute) return;
    const recompute = () => setSpaceMode(resolveSpaceMode(readSpacePreference()));
    recompute();
    const onStorage = (e: StorageEvent) => {
      if (e.key === SPACE_THEME_STORAGE_KEY) recompute();
    };
    const onCustom = () => recompute();
    window.addEventListener("storage", onStorage);
    window.addEventListener("somagnus:space-theme-change", onCustom);
    const id = window.setInterval(recompute, 60_000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("somagnus:space-theme-change", onCustom);
      window.clearInterval(id);
    };
  }, [isSpaceRoute]);

  return (
    <div className={cn("min-h-dvh", isSpaceRoute ? "" : "bg-background")}>
      {isSpaceRoute ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-50"
          style={{ background: SPACE_SKY[spaceMode] }}
        >
          {spaceMode === "night" ? <StarField className="opacity-90" /> : null}
        </div>
      ) : null}
      <PomodoroOverlay />
      <GlobalRabbitMascot compact={isImmersiveReaderRoute} suppressSpeech={isImmersiveReaderRoute} />
      {!isImmersiveReaderRoute ? <RabbitGuidePanel /> : null}
      {!isImmersiveReaderRoute && !isSpaceRoute ? (
        <>
          <div className="fixed left-1/2 top-3 z-40 w-[min(94vw,560px)] -translate-x-1/2">
            <div
              ref={pillRef}
              data-app-header-pill
              className={cn(
                "flex h-14 items-center justify-between gap-2 rounded-full border px-2.5 backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300 sm:px-3",
                stickyHeaderSolid
                  ? "border-border/70 bg-background/85 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.25)]"
                  : integratedAtTop
                    ? "border-border/30 bg-background/40"
                    : "border-border/60 bg-background/70",
              )}
            >
              <Link
                href="/"
                aria-label="Ir a inicio"
                data-app-header-logo
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80 text-foreground transition-colors hover:bg-background"
              >
                <Zap className="h-5 w-5 text-primary" />
              </Link>

              <div
                data-app-header-title
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 text-base font-semibold tracking-tight text-foreground sm:text-lg"
              >
                <span className="text-primary [&>svg]:h-[18px] [&>svg]:w-[18px]">
                  {routeTitle.icon}
                </span>
                <span className="truncate">{routeTitle.label}</span>
              </div>

              <button
                ref={menuBtnRef}
                type="button"
                onClick={() => setHeaderMenuOpen((v) => !v)}
                aria-expanded={headerMenuOpen}
                aria-haspopup="menu"
                aria-label="Secciones"
                data-app-header-menu
                className={cn(
                  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-[background-color,box-shadow] active:scale-95",
                  headerMenuOpen
                    ? "border-border bg-background text-foreground shadow-[0_6px_18px_-8px_rgba(0,0,0,0.25)]"
                    : "border-border/70 bg-background/80 text-foreground hover:bg-background",
                )}
              >
                {headerMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <GlobalHeaderMenu
            open={headerMenuOpen}
            setOpen={setHeaderMenuOpen}
            anchorRect={anchorRect}
          />
        </>
      ) : null}

      <main
        className={cn(
          isImmersiveReaderRoute
            ? "w-full"
            : "mx-auto w-full max-w-7xl px-6",
          pathname === "/" ? "pb-8 pt-20" : isImmersiveReaderRoute ? "p-0" : isSpaceRoute ? "pb-8 pt-0" : "pb-8 pt-20",
        )}
      >
        {children}
      </main>
      <SpaceGlobalPlayer />
    </div>
  );
}
