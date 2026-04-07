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
import { Button } from "@/components/ui/button";

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
          className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-white/30"
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
      const s = loadPomodoroSettings();
      setDraft(s);
      setSaved(s);
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
    const s = loadPomodoroSettings();
    setDraft(s);
    setSaved(s);
    setNotice("Ajustes restablecidos.");
  };

  return (
    <div className="space-y-10">
      <div className="space-y-2 rounded-3xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
        <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Ajustes</div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-foreground/70">
          Personalizá la duración de tus bloques para sostener foco con menos fricción.
        </p>
      </div>

      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Pomodoro</div>
          <h2 className="text-xl font-bold tracking-tight">Duraciones de bloques</h2>
        </div>

        <div className="space-y-6 rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
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
            <Button className="border border-white/25 bg-white text-black hover:bg-white/90" onClick={save} disabled={!dirty}>
              Guardar
            </Button>
            <Button variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={reset}>
              Restablecer
            </Button>
            {notice ? <div className="ml-1 self-center text-xs text-foreground/65">{notice}</div> : null}
          </div>

          <div className="text-xs text-foreground/60">
            Los cambios se reflejan en el Pomodoro al iniciar una nueva fase.
          </div>
        </div>
      </section>
    </div>
  );
}
