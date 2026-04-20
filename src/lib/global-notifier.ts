"use client";

import {
  canShowNotifications,
  markNotificationSent,
  wasNotificationSent,
} from "@/lib/notifications-store";
import type { RabbitGuideSpeechAction } from "@/lib/rabbit-guide";

/**
 * Central notification bus.
 * - Always speaks through the rabbit (voice queue).
 * - Fires the OS Notification only when the tab is not visible (or forceOs).
 * - Dedupes OS notifications by `tag` using the existing sent registry.
 */

export const RABBIT_VOICE_QUEUE_EVENT = "somagnus:rabbit_voice:queue";

export type VoiceQueuePriority = "notify" | "milestone" | "guide";

export type VoiceQueueEntry = {
  key: string;
  priority: VoiceQueuePriority;
  payload: {
    title: string;
    message: string;
    status?: string;
    actions?: RabbitGuideSpeechAction[];
    durationMs?: number;
  };
};

export type GlobalNotifyPayload = {
  title: string;
  body: string;
  tag?: string;
  status?: string;
  actions?: RabbitGuideSpeechAction[];
  durationMs?: number;
  /** Also fire OS notification even if the tab is visible. */
  forceOs?: boolean;
  /** Skip the OS notification entirely (stay in-app). */
  inAppOnly?: boolean;
};

function fireOsNotification(title: string, body: string, tag?: string) {
  if (!canShowNotifications()) return;
  try {
    new Notification(title, { body, tag });
  } catch {
    // ignore
  }
}

export function enqueueRabbitVoice(entry: VoiceQueueEntry): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<VoiceQueueEntry>(RABBIT_VOICE_QUEUE_EVENT, { detail: entry }));
}

export function notifyGlobal(payload: GlobalNotifyPayload): void {
  if (typeof window === "undefined") return;
  const tag = payload.tag ?? `notify:${payload.title}:${Date.now()}`;

  enqueueRabbitVoice({
    key: tag,
    priority: "notify",
    payload: {
      title: payload.title,
      message: payload.body,
      status: payload.status,
      actions: payload.actions,
      durationMs: payload.durationMs ?? 4800,
    },
  });

  const isHidden = typeof document !== "undefined" && document.visibilityState !== "visible";
  const shouldFireOs = !payload.inAppOnly && (payload.forceOs || isHidden);

  if (shouldFireOs) {
    if (payload.tag && wasNotificationSent(payload.tag)) return;
    fireOsNotification(payload.title, payload.body, payload.tag);
    if (payload.tag) markNotificationSent(payload.tag);
  }
}
