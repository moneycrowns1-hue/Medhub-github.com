"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { Bell, BellOff, Check, CircleAlert, Clock, Send } from "lucide-react";

import { toast } from "@/components/ui/toast";
import {
  DEFAULT_NOTIFICATIONS_PREFS,
  NOTIFICATIONS_PREFS_UPDATED_EVENT,
  canShowNotifications,
  loadNotificationsPrefs,
  requestNotificationPermission,
  resetNotificationsPrefs,
  saveNotificationsPrefs,
  type NotificationsPrefs,
} from "@/lib/notifications-store";

const DAYS_BEFORE_OPTIONS = [0, 1, 3, 7, 14];

type Permission = "default" | "granted" | "denied" | "unsupported";

function readPermission(): Permission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as Permission;
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-xl bg-white/[0.04] p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        {desc ? <div className="mt-0.5 text-xs text-white/65">{desc}</div> : null}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 cursor-pointer accent-white"
      />
    </label>
  );
}

export function NotificationsSection() {
  const [draft, setDraft] = useState<NotificationsPrefs>(DEFAULT_NOTIFICATIONS_PREFS);
  const [saved, setSaved] = useState<NotificationsPrefs>(DEFAULT_NOTIFICATIONS_PREFS);
  const [permission, setPermission] = useState<Permission>("default");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const permChipRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const sync = () => {
      const next = loadNotificationsPrefs();
      setDraft(next);
      setSaved(next);
      setPermission(readPermission());
    };
    sync();
    window.addEventListener(NOTIFICATIONS_PREFS_UPDATED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(NOTIFICATIONS_PREFS_UPDATED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // GSAP entrance animation
  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-notif-card]", {
        y: 22,
        opacity: 0,
        duration: 0.55,
        ease: "power3.out",
      });
      gsap.from("[data-notif-row]", {
        y: 10,
        opacity: 0,
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.06,
        delay: 0.1,
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // GSAP pulse on permission chip when denied/default
  useEffect(() => {
    const el = permChipRef.current;
    if (!el) return;
    gsap.killTweensOf(el);
    if (permission === "granted" || permission === "unsupported") return;
    gsap.fromTo(
      el,
      { boxShadow: "0 0 0 0 rgba(251,191,36,0)" },
      {
        boxShadow: "0 0 0 6px rgba(251,191,36,0.18)",
        duration: 1.1,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      },
    );
    return () => {
      gsap.killTweensOf(el);
    };
  }, [permission]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const handleSave = () => {
    const merged = saveNotificationsPrefs(draft);
    setSaved(merged);
    setDraft(merged);
    toast.success("Preferencias de notificaciones guardadas.");
    // Tiny GSAP confirmation wiggle on the card
    const card = rootRef.current?.querySelector<HTMLElement>("[data-notif-card]");
    if (card) {
      gsap.fromTo(
        card,
        { y: -2 },
        { y: 0, duration: 0.35, ease: "elastic.out(1, 0.5)" },
      );
    }
  };

  const handleReset = () => {
    const merged = resetNotificationsPrefs();
    setDraft(merged);
    setSaved(merged);
    toast.info("Preferencias restablecidas.");
  };

  const handleRequestPermission = async () => {
    const next = await requestNotificationPermission();
    setPermission(next === "default" ? "default" : next);
    if (next === "granted") toast.success("Notificaciones habilitadas.");
    else if (next === "denied") toast.error("Permiso denegado. Podés habilitarlo desde el navegador.");
  };

  const handleTestNotification = () => {
    if (!canShowNotifications()) {
      toast.warning("Primero otorgá permiso en el navegador.");
      return;
    }
    try {
      new Notification("Somagnus · Prueba", {
        body: "Notificaciones funcionando. Te avisaremos del plan y evaluaciones.",
        tag: "somagnus-test",
      });
      toast.info("Notificación de prueba enviada.");
    } catch {
      toast.error("No se pudo enviar la notificación.");
    }
  };

  const toggleDayBefore = (day: number) => {
    setDraft((prev) => {
      const has = prev.evaluationsDaysBefore.includes(day);
      const next = has
        ? prev.evaluationsDaysBefore.filter((d) => d !== day)
        : [...prev.evaluationsDaysBefore, day].sort((a, b) => a - b);
      return { ...prev, evaluationsDaysBefore: next.length ? next : prev.evaluationsDaysBefore };
    });
  };

  const permLabel =
    permission === "granted"
      ? "Permitido"
      : permission === "denied"
      ? "Bloqueado"
      : permission === "unsupported"
      ? "No soportado"
      : "Sin otorgar";

  const permClass =
    permission === "granted"
      ? "bg-emerald-400/15 text-emerald-100"
      : permission === "denied"
      ? "bg-rose-400/15 text-rose-100"
      : permission === "unsupported"
      ? "bg-white/[0.08] text-white/70"
      : "bg-amber-400/15 text-amber-100";

  return (
    <section ref={rootRef} className="space-y-4">
      <div className="space-y-1">
        <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Notificaciones</div>
        <h2 className="text-xl font-bold tracking-tight">Recordatorios del día y evaluaciones</h2>
      </div>

      <div
        data-notif-card
        className="space-y-5 rounded-2xl bg-white/[0.04] p-6 backdrop-blur-xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {permission === "granted" ? (
              <Bell className="h-4 w-4 text-emerald-200" />
            ) : (
              <BellOff className="h-4 w-4 text-white/70" />
            )}
            <span className="text-sm font-medium">Permiso del navegador:</span>
            <span
              ref={permChipRef}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${permClass}`}
            >
              {permission === "granted" ? <Check className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
              {permLabel}
            </span>
          </div>
          <div className="flex gap-2">
            {permission !== "granted" && permission !== "unsupported" ? (
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-medium text-black transition-colors hover:bg-white/90"
                onClick={handleRequestPermission}
              >
                <Bell className="h-4 w-4" />
                Habilitar
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-xs text-white transition-colors hover:bg-white/10 disabled:opacity-50"
              onClick={handleTestNotification}
              disabled={permission !== "granted"}
            >
              <Send className="h-4 w-4" />
              Probar
            </button>
          </div>
        </div>

        <div data-notif-row>
          <ToggleRow
            label="Activar notificaciones"
            desc="Maestro: si está apagado, nada se enviará."
            checked={draft.enabled}
            onChange={(next) => setDraft((p) => ({ ...p, enabled: next }))}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div data-notif-row className="space-y-3 rounded-xl bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-white/85" />
                Plan diario
              </div>
              <input
                type="checkbox"
                checked={draft.dailyPlanEnabled}
                onChange={(e) => setDraft((p) => ({ ...p, dailyPlanEnabled: e.target.checked }))}
                className="h-4 w-4 cursor-pointer accent-white"
              />
            </div>
            <div className="text-xs text-white/65">
              Te avisa la materia principal, secundaria y lectura al inicio del día.
            </div>
            <label className="block space-y-1">
              <div className="text-xs text-white/70">Hora</div>
              <input
                type="time"
                value={draft.dailyPlanTime}
                onChange={(e) => setDraft((p) => ({ ...p, dailyPlanTime: e.target.value }))}
                className="h-10 w-full rounded-lg bg-white/[0.06] px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              />
            </label>
          </div>

          <div data-notif-row className="space-y-3 rounded-xl bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CircleAlert className="h-4 w-4 text-white/85" />
                Evaluaciones
              </div>
              <input
                type="checkbox"
                checked={draft.evaluationsEnabled}
                onChange={(e) => setDraft((p) => ({ ...p, evaluationsEnabled: e.target.checked }))}
                className="h-4 w-4 cursor-pointer accent-white"
              />
            </div>
            <div className="text-xs text-white/65">
              Recuerda exámenes y entregas de la agenda académica.
            </div>
            <label className="block space-y-1">
              <div className="text-xs text-white/70">Hora del recordatorio</div>
              <input
                type="time"
                value={draft.evaluationsTime}
                onChange={(e) => setDraft((p) => ({ ...p, evaluationsTime: e.target.value }))}
                className="h-10 w-full rounded-lg bg-white/[0.06] px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              />
            </label>
            <div className="space-y-1">
              <div className="text-xs text-white/70">Avisar con</div>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_BEFORE_OPTIONS.map((day) => {
                  const active = draft.evaluationsDaysBefore.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDayBefore(day)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? "bg-white text-black"
                          : "bg-white/[0.06] text-white/80 hover:bg-white/10"
                      }`}
                    >
                      {day === 0 ? "El día" : `${day} d antes`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-xl bg-white px-4 text-xs font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-50"
            onClick={handleSave}
            disabled={!dirty}
          >
            Guardar
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-xl bg-white/[0.06] px-4 text-xs text-white transition-colors hover:bg-white/10"
            onClick={handleReset}
          >
            Restablecer
          </button>
        </div>
      </div>
    </section>
  );
}
