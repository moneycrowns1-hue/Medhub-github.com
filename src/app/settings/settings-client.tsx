"use client";

import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_POMODORO_SETTINGS,
  loadPomodoroSettings,
  POMODORO_SETTINGS_UPDATED_EVENT,
  resetPomodoroSettings,
  sanitizePomodoroSettings,
  savePomodoroSettings,
  type PomodoroSettings,
} from "@/lib/pomodoro-settings";
import { NotificationsSection } from "./_components/notifications-section";

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-foreground/90">{label}</div>
      <div className="flex items-center gap-2">
        <input
          className="h-10 w-full rounded-xl bg-white/[0.06] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          type="number"
          min={1}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="text-sm text-foreground/65">min</div>
      </div>
      {hint ? <div className="text-xs text-foreground/60">{hint}</div> : null}
    </div>
  );
}

export function SettingsClient() {
  const [draft, setDraft] = useState<PomodoroSettings>(DEFAULT_POMODORO_SETTINGS);
  const [saved, setSaved] = useState<PomodoroSettings>(DEFAULT_POMODORO_SETTINGS);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const pomodoro = loadPomodoroSettings();
      setDraft(pomodoro);
      setSaved(pomodoro);
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(POMODORO_SETTINGS_UPDATED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(POMODORO_SETTINGS_UPDATED_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(id);
  }, [notice]);

  const dirty = useMemo(() => {
    const a = sanitizePomodoroSettings(draft);
    const b = sanitizePomodoroSettings(saved);
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [draft, saved]);

  const save = () => {
    const next = sanitizePomodoroSettings(draft);
    savePomodoroSettings(next);
    setSaved(next);
    setDraft(next);
    setNotice("Cambios guardados.");
  };

  const reset = () => {
    resetPomodoroSettings();
    const pomodoro = loadPomodoroSettings();
    setDraft(pomodoro);
    setSaved(pomodoro);
    setNotice("Ajustes restablecidos.");
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Pomodoro</div>
          <h2 className="text-xl font-bold tracking-tight">Duraciones de bloques</h2>
        </div>

        <div className="space-y-6 rounded-2xl bg-white/[0.04] p-6 backdrop-blur-xl">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Focus 1"
              value={draft.focus1Min}
              onChange={(v) => setDraft((p) => ({ ...p, focus1Min: v }))}
              hint="Primer bloque de enfoque"
            />
            <Field
              label="Focus 2"
              value={draft.focus2Min}
              onChange={(v) => setDraft((p) => ({ ...p, focus2Min: v }))}
              hint="Segundo bloque de enfoque"
            />
            <Field
              label="Focus 3"
              value={draft.focus3Min}
              onChange={(v) => setDraft((p) => ({ ...p, focus3Min: v }))}
              hint="Tercer bloque (más corto)"
            />
            <Field
              label="Descansos"
              value={draft.breakMin}
              onChange={(v) => setDraft((p) => ({ ...p, breakMin: v }))}
              hint="Aplica para Descanso 1 y Descanso 2"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-xl bg-white px-4 text-xs font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-50"
              onClick={save}
              disabled={!dirty}
            >
              Guardar
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-xl bg-white/[0.06] px-4 text-xs text-white transition-colors hover:bg-white/10"
              onClick={reset}
            >
              Restablecer
            </button>
            {notice ? <div className="ml-1 self-center text-xs text-foreground/65">{notice}</div> : null}
          </div>

          <div className="text-xs text-foreground/60">
            Los cambios se reflejan en el Pomodoro al iniciar una nueva fase.
          </div>
        </div>
      </section>

      <NotificationsSection />
    </div>
  );
}
