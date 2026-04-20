"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  SPACE_THEME_STORAGE_KEY,
  type SpaceMode,
  type SpacePreference,
} from "@/lib/space-theme-tokens";
import {
  readSpacePreference,
  resolveSpaceMode,
  writeSpacePreference,
} from "@/lib/space-theme-resolver";

type SpaceThemeContextValue = {
  mode: SpaceMode;
  preference: SpacePreference;
  setPreference: (pref: SpacePreference) => void;
  cyclePreference: () => void;
};

const SpaceThemeContext = createContext<SpaceThemeContextValue | null>(null);

export function SpaceThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<SpacePreference>("auto");
  const [mode, setMode] = useState<SpaceMode>(() => resolveSpaceMode("auto"));

  // Hydrate from storage once on client.
  useEffect(() => {
    const pref = readSpacePreference();
    setPreferenceState(pref);
    setMode(resolveSpaceMode(pref));
  }, []);

  // Recompute mode when preference changes, and every minute if auto.
  useEffect(() => {
    setMode(resolveSpaceMode(preference));
    if (preference !== "auto") return;
    const id = window.setInterval(() => {
      setMode(resolveSpaceMode("auto"));
    }, 60_000);
    return () => window.clearInterval(id);
  }, [preference]);

  // Sync across tabs / with AppShell.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SPACE_THEME_STORAGE_KEY) return;
      const pref = readSpacePreference();
      setPreferenceState(pref);
      setMode(resolveSpaceMode(pref));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPreference = useCallback((pref: SpacePreference) => {
    setPreferenceState(pref);
    writeSpacePreference(pref);
    setMode(resolveSpaceMode(pref));
    // Nudge same-tab listeners (AppShell polls, so optional) by dispatching storage event shape.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("somagnus:space-theme-change"));
    }
  }, []);

  const cyclePreference = useCallback(() => {
    const order: SpacePreference[] = ["auto", "day", "night"];
    setPreferenceState((prev) => {
      const idx = order.indexOf(prev);
      const next = order[(idx + 1) % order.length];
      writeSpacePreference(next);
      setMode(resolveSpaceMode(next));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("somagnus:space-theme-change"));
      }
      return next;
    });
  }, []);

  const value = useMemo<SpaceThemeContextValue>(
    () => ({ mode, preference, setPreference, cyclePreference }),
    [mode, preference, setPreference, cyclePreference],
  );

  return <SpaceThemeContext.Provider value={value}>{children}</SpaceThemeContext.Provider>;
}

export function useSpaceTheme(): SpaceThemeContextValue {
  const ctx = useContext(SpaceThemeContext);
  if (!ctx) {
    // Safe fallback (components outside provider default to day).
    return {
      mode: "day",
      preference: "auto",
      setPreference: () => {},
      cyclePreference: () => {},
    };
  }
  return ctx;
}
