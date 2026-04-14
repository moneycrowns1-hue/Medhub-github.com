"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { getPlanForDate } from "@/lib/schedule";
import { deriveRabbitAssistantOutput } from "@/lib/rabbit-assistant-engine";
import { CLINICAL_TASKS_UPDATED_EVENT, getTasksForDate } from "@/lib/clinical-store";
import { algoStats } from "@/lib/srs-algo";
import { loadSrsLibrary, SRS_UPDATED_EVENT } from "@/lib/srs-storage";
import {
  loadPomodoroState,
  POMODORO_STATE_UPDATED_EVENT,
  type PomodoroState,
} from "@/lib/pomodoro";
import { getTodayStats, STATS_UPDATED_EVENT, type DailyStats } from "@/lib/stats-store";
import {
  loadRabbitGuideState,
  markReadingVisited,
  markPlanChecked,
  markRoutineCompleted,
  markSrsVisited,
  markStudyVisited,
  RABBIT_ASSISTANT_CONTROL_EVENT,
  RABBIT_GUIDE_SPEAK_EVENT,
  RABBIT_GUIDE_PROMPT_EVENT,
  RABBIT_GUIDE_UPDATED_EVENT,
  transitionRabbitGuideState,
  type RabbitGuideState,
} from "@/lib/rabbit-guide";
import {
  loadRabbitPersonality,
  RABBIT_PERSONALITY_UPDATED_EVENT,
  type RabbitPersonality,
} from "@/lib/rabbit-personality";
import type { SubjectSlug } from "@/lib/subjects";

function parseStudySubjectFromPath(pathname: string): SubjectSlug | null {
  if (!pathname.startsWith("/study/")) return null;
  const slug = pathname.slice("/study/".length).split("/")[0];
  if (
    slug === "anatomia" ||
    slug === "histologia" ||
    slug === "embriologia" ||
    slug === "biologia-celular" ||
    slug === "ingles" ||
    slug === "trabajo-online"
  ) {
    return slug;
  }
  return null;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function RabbitGuidePanel() {
  const pathname = usePathname();
  const isDev = process.env.NODE_ENV !== "production";
  const [state, setState] = useState<RabbitGuideState>(() => loadRabbitGuideState());
  const [pomodoroState, setPomodoroState] = useState<PomodoroState>(() => loadPomodoroState());
  const [todayStats, setTodayStats] = useState<DailyStats>(() => getTodayStats());
  const [srsDueToday, setSrsDueToday] = useState(0);
  const [srsDueForGuidedSubject, setSrsDueForGuidedSubject] = useState(0);
  const [clinicalTodayTasks, setClinicalTodayTasks] = useState(0);
  const [clinicalPendingTasks, setClinicalPendingTasks] = useState(0);
  const [clinicalReminderTick, setClinicalReminderTick] = useState(0);
  const [personality, setPersonality] = useState<RabbitPersonality>(() => loadRabbitPersonality());
  const [showDebug, setShowDebug] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const lastGuideSignatureRef = useRef("");
  const lastPathnameRef = useRef<string | null>(null);
  const wasRoutineCompletedRef = useRef(false);

  const replayIntervalRef = useRef<number | null>(null);

  const replaySteps = useMemo(
    () => [
      { label: "Start Study", run: () => transitionRabbitGuideState({ type: "start_study_selected", subjectSlug: "anatomia", pathname: "/study/anatomia" }) },
      { label: "Pomodoro Start", run: () => transitionRabbitGuideState({ type: "pomodoro_started", pathname: "/" }) },
      { label: "Plan Viewed", run: () => transitionRabbitGuideState({ type: "plan_viewed", pathname: "/day" }) },
      { label: "Module Focus", run: () => transitionRabbitGuideState({ type: "study_module_viewed", subjectSlug: "anatomia", pathname: "/study/anatomia" }) },
      { label: "SRS Review", run: () => transitionRabbitGuideState({ type: "srs_viewed", pathname: "/srs" }) },
      { label: "Reading Block", run: () => transitionRabbitGuideState({ type: "reading_viewed", pathname: "/biblioteca" }) },
      { label: "Closure Ready", run: () => transitionRabbitGuideState({ type: "plan_viewed", pathname: "/day" }) },
      { label: "Routine Completed", run: () => transitionRabbitGuideState({ type: "routine_completed", pathname: "/day" }) },
    ],
    [],
  );

  const runReplayStep = useCallback(
    (index: number) => {
      const step = replaySteps[index];
      if (!step) return false;
      step.run();
      return true;
    },
    [replaySteps],
  );

  const resetReplay = useCallback(() => {
    transitionRabbitGuideState({ type: "day_reset", pathname: "/" });
    setReplayIndex(0);
    setIsReplayPlaying(false);
  }, []);

  const stepReplay = useCallback(() => {
    const ok = runReplayStep(replayIndex);
    if (!ok) {
      setIsReplayPlaying(false);
      return;
    }
    setReplayIndex((prev) => prev + 1);
  }, [replayIndex, runReplayStep]);

  useEffect(() => {
    const syncAll = () => {
      const nextGuide = loadRabbitGuideState();
      setState(nextGuide);
      setPomodoroState(loadPomodoroState());
      setTodayStats(getTodayStats());
      setPersonality(loadRabbitPersonality());

      const todayPlan = getPlanForDate(new Date());
      const guidedSubjectSlug = nextGuide.activeSubjectSlug ?? nextGuide.lastStudySubjectSlug ?? todayPlan.primary;
      const srs = loadSrsLibrary();
      const clinicalTasks = getTasksForDate(todayIsoDate());
      setSrsDueToday(algoStats(srs.cards).dueToday);
      setSrsDueForGuidedSubject(algoStats(srs.cards.filter((card) => card.subjectSlug === guidedSubjectSlug)).dueToday);
      setClinicalTodayTasks(clinicalTasks.filter((task) => task.status === "TODAY").length);
      setClinicalPendingTasks(clinicalTasks.filter((task) => task.status === "PENDING").length);
    };

    syncAll();
    window.addEventListener("storage", syncAll);
    window.addEventListener(RABBIT_GUIDE_UPDATED_EVENT, syncAll);
    window.addEventListener(POMODORO_STATE_UPDATED_EVENT, syncAll);
    window.addEventListener(STATS_UPDATED_EVENT, syncAll);
    window.addEventListener(SRS_UPDATED_EVENT, syncAll);
    window.addEventListener(CLINICAL_TASKS_UPDATED_EVENT, syncAll);
    window.addEventListener(RABBIT_PERSONALITY_UPDATED_EVENT, syncAll);

    return () => {
      window.removeEventListener("storage", syncAll);
      window.removeEventListener(RABBIT_GUIDE_UPDATED_EVENT, syncAll);
      window.removeEventListener(POMODORO_STATE_UPDATED_EVENT, syncAll);
      window.removeEventListener(STATS_UPDATED_EVENT, syncAll);
      window.removeEventListener(SRS_UPDATED_EVENT, syncAll);
      window.removeEventListener(CLINICAL_TASKS_UPDATED_EVENT, syncAll);
      window.removeEventListener(RABBIT_PERSONALITY_UPDATED_EVENT, syncAll);
    };
  }, []);

  useEffect(() => {
    if (!pathname.startsWith("/day")) return;
    if (clinicalTodayTasks + clinicalPendingTasks <= 0) return;

    const id = window.setInterval(() => {
      setClinicalReminderTick((prev) => prev + 1);
    }, 130_000);

    return () => window.clearInterval(id);
  }, [pathname, clinicalTodayTasks, clinicalPendingTasks]);

  useEffect(() => {
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;

    const subjectSlug = parseStudySubjectFromPath(pathname);
    if (subjectSlug) {
      markStudyVisited(subjectSlug, pathname);
      return;
    }

    if (pathname === "/day") {
      markPlanChecked(pathname);
      return;
    }

    if (pathname.startsWith("/srs")) {
      markSrsVisited(pathname);
      return;
    }

    if (pathname.startsWith("/resources") || pathname.startsWith("/biblioteca") || pathname.startsWith("/lector/")) {
      markReadingVisited(pathname);
    }
  }, [pathname]);

  useEffect(() => {
    if (todayStats.routineCompleted && !wasRoutineCompletedRef.current) {
      markRoutineCompleted(pathname);
      wasRoutineCompletedRef.current = true;
      return;
    }

    if (!todayStats.routineCompleted) {
      wasRoutineCompletedRef.current = false;
    }
  }, [pathname, todayStats.routineCompleted]);

  const assistantOutput = useMemo(
    () =>
      deriveRabbitAssistantOutput({
        pathname,
        guideState: state,
        pomodoroState,
        todayStats,
        srsDueToday,
        srsDueForGuidedSubject,
        clinicalTodayTasks,
        clinicalPendingTasks,
        clinicalReminderTick,
        personality,
      }),
    [
      state,
      pathname,
      pomodoroState,
      todayStats,
      srsDueToday,
      srsDueForGuidedSubject,
      clinicalTodayTasks,
      clinicalPendingTasks,
      clinicalReminderTick,
      personality,
    ],
  );

  useEffect(() => {
    const signature = assistantOutput.telemetrySignature;
    if (lastGuideSignatureRef.current === signature) return;
    lastGuideSignatureRef.current = signature;

    window.dispatchEvent(new CustomEvent(RABBIT_GUIDE_SPEAK_EVENT, { detail: assistantOutput.speech }));
    window.dispatchEvent(new CustomEvent(RABBIT_ASSISTANT_CONTROL_EVENT, { detail: assistantOutput.control }));
    window.dispatchEvent(new Event(RABBIT_GUIDE_PROMPT_EVENT));
  }, [assistantOutput]);

  useEffect(() => {
    if (!isReplayPlaying) {
      if (replayIntervalRef.current !== null) {
        window.clearInterval(replayIntervalRef.current);
        replayIntervalRef.current = null;
      }
      return;
    }

    replayIntervalRef.current = window.setInterval(() => {
      setReplayIndex((prev) => {
        const ok = runReplayStep(prev);
        if (!ok) {
          setIsReplayPlaying(false);
          return prev;
        }
        const next = prev + 1;
        if (next >= replaySteps.length) {
          setIsReplayPlaying(false);
        }
        return next;
      });
    }, 1400);

    return () => {
      if (replayIntervalRef.current !== null) {
        window.clearInterval(replayIntervalRef.current);
        replayIntervalRef.current = null;
      }
    };
  }, [isReplayPlaying, replaySteps, runReplayStep]);

  if (!isDev) return null;

  const lastTransition = state.transitionHistory.at(-1) ?? null;

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[70]">
      <div className="pointer-events-auto flex justify-end">
        <button
          type="button"
          onClick={() => setShowDebug((v) => !v)}
          className="rounded-md border border-white/30 bg-black/80 px-2 py-1 text-[10px] font-semibold text-white"
        >
          FSM
        </button>
      </div>

      {showDebug ? (
        <div className="mt-2 w-[min(380px,90vw)] rounded-lg border border-white/25 bg-slate-950/95 p-3 text-[11px] text-white/90 shadow-2xl backdrop-blur">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-white/60">Rabbit Routine Inspector</div>
          <div>Ruta: <span className="text-white">{pathname}</span></div>
          <div>Fase: <span className="text-white">{state.routinePhase}</span></div>
          <div>Paso legado: <span className="text-white">{state.step}</span></div>
          <div>Pomodoro: <span className="text-white">{pomodoroState.phase}</span></div>
          <div>Bloques: <span className="text-white">{todayStats.blocksCompleted}</span></div>
          <div>Tarjetas due: <span className="text-white">{srsDueToday}</span></div>
          <div>Tareas hoy: <span className="text-white">{clinicalTodayTasks}</span></div>
          <div>Pendientes: <span className="text-white">{clinicalPendingTasks}</span></div>
          <div>Transiciones: <span className="text-white">{state.transitionHistory.length}</span></div>

          <div className="mt-2 border-t border-white/15 pt-2">
            <div className="text-[10px] uppercase tracking-wider text-white/60">Última transición</div>
            {lastTransition ? (
              <>
                <div>{lastTransition.event}: {lastTransition.fromPhase} → {lastTransition.toPhase}</div>
                <div className="text-white/70">{new Date(lastTransition.atMs).toLocaleTimeString()}</div>
              </>
            ) : (
              <div className="text-white/70">Sin transiciones todavía.</div>
            )}
          </div>

          <div className="mt-3 border-t border-white/15 pt-2">
            <div className="text-[10px] uppercase tracking-wider text-white/60">Replay (dev)</div>
            <div className="mt-1 text-white/70">Paso {Math.min(replayIndex + 1, replaySteps.length)} / {replaySteps.length}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={resetReplay}
                className="rounded border border-white/25 bg-white/10 px-2 py-1 text-[10px]"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={stepReplay}
                className="rounded border border-white/25 bg-white/10 px-2 py-1 text-[10px]"
              >
                Step
              </button>
              <button
                type="button"
                onClick={() => setIsReplayPlaying((v) => !v)}
                className="rounded border border-white/25 bg-white/10 px-2 py-1 text-[10px]"
              >
                {isReplayPlaying ? "Stop" : "Play"}
              </button>
            </div>
            <div className="mt-2 text-white/70">Siguiente: {replaySteps[replayIndex]?.label ?? "Fin del replay"}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
