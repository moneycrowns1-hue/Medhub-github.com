"use client";

import { useEffect, useState } from "react";

import { getPlanForDate, type DayPlan } from "@/lib/schedule";
import { isoDate } from "@/lib/dates";

/**
 * Returns today's plan using the *client's* local timezone, so the cátedra
 * rotation flips exactly at the user's midnight (never before).
 *
 * - SSR / first client render: returns `initial` if provided (keeps hydration
 *   identical to the server-rendered markup), else computes from `new Date()`.
 * - After mount: recomputes from local `new Date()`.
 * - Auto-refresh: at local midnight (scheduled via setTimeout), every hour as a
 *   safety net, on window focus, and on tab visibility change.
 *
 * This fixes two related issues:
 *  1. Server (UTC) and client (UTC-5, etc.) disagreeing on `getDay()`, which
 *     caused a cátedra shown as "Principal" on Home to appear as "Secundaria"
 *     on its internal page (or vice-versa).
 *  2. Cátedras "resetting early" because the server computed the next weekday
 *     before the user's actual local midnight.
 */
export function useTodayPlan(initial?: DayPlan): DayPlan {
  const [plan, setPlan] = useState<DayPlan>(() => initial ?? getPlanForDate(new Date()));

  useEffect(() => {
    let midnightTimer: number | undefined;
    let lastKey = isoDate(new Date());

    const recompute = () => {
      const now = new Date();
      const key = isoDate(now);
      const next = getPlanForDate(now);
      setPlan((prev) => {
        if (
          prev.dayOfWeek === next.dayOfWeek &&
          prev.primary === next.primary &&
          prev.secondary === next.secondary &&
          prev.reading === next.reading
        ) {
          return prev;
        }
        return next;
      });
      lastKey = key;
    };

    const scheduleMidnight = () => {
      const now = new Date();
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        5, // 5s past midnight to avoid edge cases
        0,
      );
      const delay = Math.max(1000, midnight.getTime() - now.getTime());
      midnightTimer = window.setTimeout(() => {
        recompute();
        scheduleMidnight();
      }, delay);
    };

    // Initial client recompute (may differ from SSR if timezones differ).
    recompute();
    scheduleMidnight();

    const hourly = window.setInterval(recompute, 60 * 60 * 1000);

    const onFocus = () => {
      const key = isoDate(new Date());
      if (key !== lastKey) recompute();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (midnightTimer !== undefined) window.clearTimeout(midnightTimer);
      window.clearInterval(hourly);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return plan;
}
