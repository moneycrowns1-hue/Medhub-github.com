"use client";

import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_RABBIT_PERSONALITY,
  RABBIT_PERSONALITY_OPTIONS,
  RABBIT_PERSONALITY_UPDATED_EVENT,
  resetRabbitPersonality,
  saveRabbitPersonality,
  loadRabbitPersonality,
  type RabbitPersonality,
} from "@/lib/rabbit-personality";
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
  const [rabbitDraft, setRabbitDraft] = useState<RabbitPersonality>(DEFAULT_RABBIT_PERSONALITY);
  const [rabbitSaved, setRabbitSaved] = useState<RabbitPersonality>(DEFAULT_RABBIT_PERSONALITY);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const pomodoro = loadPomodoroSettings();
      const rabbit = loadRabbitPersonality();
      setDraft(pomodoro);
      setSaved(pomodoro);
      setRabbitDraft(rabbit);
      setRabbitSaved(rabbit);
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(POMODORO_SETTINGS_UPDATED_EVENT, sync);
    window.addEventListener(RABBIT_PERSONALITY_UPDATED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(POMODORO_SETTINGS_UPDATED_EVENT, sync);
      window.removeEventListener(RABBIT_PERSONALITY_UPDATED_EVENT, sync);
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
    const pomodoroDirty = JSON.stringify(a) !== JSON.stringify(b);
    return pomodoroDirty || rabbitDraft !== rabbitSaved;
  }, [draft, saved, rabbitDraft, rabbitSaved]);

  const save = () => {
    const next = sanitizePomodoroSettings(draft);
    savePomodoroSettings(next);
    saveRabbitPersonality(rabbitDraft);
    setSaved(next);
    setDraft(next);
    setRabbitSaved(rabbitDraft);
    setNotice("Cambios guardados.");
  };

  const reset = () => {
    resetPomodoroSettings();
    resetRabbitPersonality();
    const pomodoro = loadPomodoroSettings();
    const rabbit = loadRabbitPersonality();
    setDraft(pomodoro);
    setSaved(pomodoro);
    setRabbitDraft(rabbit);
    setRabbitSaved(rabbit);
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

      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Conejo guía</div>
          <h2 className="text-xl font-bold tracking-tight">Personalidad del conejo</h2>
        </div>

        <div className="space-y-4 rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
          <label className="space-y-2">
            <div className="text-sm font-medium text-foreground/90">Estilo de movimiento</div>
            <select
              className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              value={rabbitDraft}
              onChange={(e) => setRabbitDraft(e.target.value as RabbitPersonality)}
            >
              {RABBIT_PERSONALITY_OPTIONS.map((option) => (
                <option key={option.id} value={option.id} className="bg-slate-900">
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-xs text-foreground/70">
            {RABBIT_PERSONALITY_OPTIONS.find((option) => option.id === rabbitDraft)?.desc}
          </div>

          <div className="text-xs text-foreground/60">
            El cambio aplica al instante y mantiene el desplazamiento global entre secciones.
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">QA Manual</div>
          <h2 className="text-xl font-bold tracking-tight">Checklist del conejo asistente</h2>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
          <div className="text-sm text-foreground/80">
            Prueba recomendada (dev): abre el botón <span className="font-semibold">FSM</span>, usa <span className="font-semibold">Reset</span>,
            luego <span className="font-semibold">Play</span> para recorrer todas las fases.
          </div>

          <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground/80">
            <li>El replay completa la secuencia de fases sin saltos ni bloqueos.</li>
            <li>El conejo mantiene patrulla por los 4 bordes (sin salirse del viewport).</li>
            <li>En esquinas, el giro no flota y los pies siguen apoyados en el borde.</li>
            <li>En borde superior, la orientación se ve natural (sin apoyar orejas/cabeza).</li>
            <li>La burbuja se reubica automáticamente: arriba/abajo/izquierda/derecha según posición.</li>
            <li>La burbuja nunca se corta ni sale de pantalla, incluso en móvil.</li>
            <li>La flecha/cola de pensamiento apunta al conejo desde el lado correcto.</li>
            <li>En pausas y cambios de modo, el movimiento y animación siguen coherentes.</li>
          </ol>

          <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-xs text-foreground/70">
            Si detectas un caso raro, anota: ruta, fase FSM, lado del conejo y resolución de pantalla.
          </div>
        </div>
      </section>
    </div>
  );
}
