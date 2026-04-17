"use client";

export const NOTIFICATIONS_PREFS_KEY = "somagnus:notifications:prefs:v1";
export const NOTIFICATIONS_PREFS_UPDATED_EVENT = "somagnus:notifications:prefs:updated";
export const NOTIFICATIONS_SENT_KEY = "somagnus:notifications:sent:v1";

export type NotificationsPrefs = {
  enabled: boolean;
  dailyPlanEnabled: boolean;
  /** HH:MM 24h, e.g. "08:00" */
  dailyPlanTime: string;
  evaluationsEnabled: boolean;
  /** Days-before to trigger a reminder. e.g. [7, 3, 1, 0] */
  evaluationsDaysBefore: number[];
  /** HH:MM when to fire evaluation reminders on the trigger day */
  evaluationsTime: string;
};

export const DEFAULT_NOTIFICATIONS_PREFS: NotificationsPrefs = {
  enabled: false,
  dailyPlanEnabled: true,
  dailyPlanTime: "08:00",
  evaluationsEnabled: true,
  evaluationsDaysBefore: [7, 3, 1, 0],
  evaluationsTime: "09:00",
};

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function sanitizeNotificationsPrefs(input?: Partial<NotificationsPrefs>): NotificationsPrefs {
  const base = { ...DEFAULT_NOTIFICATIONS_PREFS, ...(input ?? {}) };
  if (!HHMM_RE.test(base.dailyPlanTime)) base.dailyPlanTime = DEFAULT_NOTIFICATIONS_PREFS.dailyPlanTime;
  if (!HHMM_RE.test(base.evaluationsTime)) base.evaluationsTime = DEFAULT_NOTIFICATIONS_PREFS.evaluationsTime;
  const days = Array.isArray(base.evaluationsDaysBefore)
    ? base.evaluationsDaysBefore
        .map((n) => Math.max(0, Math.min(60, Math.floor(Number(n)))))
        .filter((n) => Number.isFinite(n))
    : [];
  base.evaluationsDaysBefore = Array.from(new Set(days)).sort((a, b) => a - b);
  if (!base.evaluationsDaysBefore.length) base.evaluationsDaysBefore = [...DEFAULT_NOTIFICATIONS_PREFS.evaluationsDaysBefore];
  return base;
}

export function loadNotificationsPrefs(): NotificationsPrefs {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATIONS_PREFS;
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_PREFS_KEY);
    if (!raw) return DEFAULT_NOTIFICATIONS_PREFS;
    return sanitizeNotificationsPrefs(JSON.parse(raw) as Partial<NotificationsPrefs>);
  } catch {
    return DEFAULT_NOTIFICATIONS_PREFS;
  }
}

export function saveNotificationsPrefs(next: Partial<NotificationsPrefs>): NotificationsPrefs {
  const merged = sanitizeNotificationsPrefs({ ...loadNotificationsPrefs(), ...next });
  if (typeof window !== "undefined") {
    window.localStorage.setItem(NOTIFICATIONS_PREFS_KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event(NOTIFICATIONS_PREFS_UPDATED_EVENT));
  }
  return merged;
}

export function resetNotificationsPrefs(): NotificationsPrefs {
  return saveNotificationsPrefs(DEFAULT_NOTIFICATIONS_PREFS);
}

// Dedup registry for sent notifications (by key per-day)
type SentRegistry = Record<string, number>;

function readSent(): SentRegistry {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_SENT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SentRegistry;
  } catch {
    return {};
  }
}

function writeSent(reg: SentRegistry) {
  if (typeof window === "undefined") return;
  try {
    // Prune entries older than 14 days
    const cutoff = Date.now() - 14 * 86_400_000;
    const pruned: SentRegistry = {};
    for (const [k, v] of Object.entries(reg)) {
      if (v >= cutoff) pruned[k] = v;
    }
    window.localStorage.setItem(NOTIFICATIONS_SENT_KEY, JSON.stringify(pruned));
  } catch {
    // ignore
  }
}

export function markNotificationSent(key: string) {
  const reg = readSent();
  reg[key] = Date.now();
  writeSent(reg);
}

export function wasNotificationSent(key: string): boolean {
  return Boolean(readSent()[key]);
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function canShowNotifications(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  );
}
