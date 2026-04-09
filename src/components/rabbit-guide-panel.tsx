"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { getPlanForDate } from "@/lib/schedule";
import { deriveRabbitAssistantOutput } from "@/lib/rabbit-assistant-engine";
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
  markPlanChecked,
  markStudyVisited,
  RABBIT_ASSISTANT_CONTROL_EVENT,
  RABBIT_GUIDE_SPEAK_EVENT,
  RABBIT_GUIDE_PROMPT_EVENT,
  RABBIT_GUIDE_UPDATED_EVENT,
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
  if (slug === "anatomia" || slug === "histologia" || slug === "embriologia" || slug === "biologia-celular") {
    return slug;
  }
  return null;
}

export function RabbitGuidePanel() {
  const pathname = usePathname();
  const [state, setState] = useState<RabbitGuideState>(() => loadRabbitGuideState());
  const [pomodoroState, setPomodoroState] = useState<PomodoroState>(() => loadPomodoroState());
  const [todayStats, setTodayStats] = useState<DailyStats>(() => getTodayStats());
  const [srsDueToday, setSrsDueToday] = useState(0);
  const [srsDueForGuidedSubject, setSrsDueForGuidedSubject] = useState(0);
  const [personality, setPersonality] = useState<RabbitPersonality>(() => loadRabbitPersonality());
  const lastGuideSignatureRef = useRef("");

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
      setSrsDueToday(algoStats(srs.cards).dueToday);
      setSrsDueForGuidedSubject(algoStats(srs.cards.filter((card) => card.subjectSlug === guidedSubjectSlug)).dueToday);
    };

    syncAll();
    window.addEventListener("storage", syncAll);
    window.addEventListener(RABBIT_GUIDE_UPDATED_EVENT, syncAll);
    window.addEventListener(POMODORO_STATE_UPDATED_EVENT, syncAll);
    window.addEventListener(STATS_UPDATED_EVENT, syncAll);
    window.addEventListener(SRS_UPDATED_EVENT, syncAll);
    window.addEventListener(RABBIT_PERSONALITY_UPDATED_EVENT, syncAll);

    return () => {
      window.removeEventListener("storage", syncAll);
      window.removeEventListener(RABBIT_GUIDE_UPDATED_EVENT, syncAll);
      window.removeEventListener(POMODORO_STATE_UPDATED_EVENT, syncAll);
      window.removeEventListener(STATS_UPDATED_EVENT, syncAll);
      window.removeEventListener(SRS_UPDATED_EVENT, syncAll);
      window.removeEventListener(RABBIT_PERSONALITY_UPDATED_EVENT, syncAll);
    };
  }, []);

  useEffect(() => {
    const subjectSlug = parseStudySubjectFromPath(pathname);
    if (subjectSlug) {
      markStudyVisited(subjectSlug);
      return;
    }
    if (pathname === "/day" && state.step === "pomodoro_started") {
      markPlanChecked();
    }
  }, [pathname, state.step]);

  const assistantOutput = useMemo(
    () =>
      deriveRabbitAssistantOutput({
        pathname,
        guideState: state,
        pomodoroState,
        todayStats,
        srsDueToday,
        srsDueForGuidedSubject,
        personality,
      }),
    [state, pathname, pomodoroState, todayStats, srsDueToday, srsDueForGuidedSubject, personality],
  );

  useEffect(() => {
    const signature = assistantOutput.telemetrySignature;
    if (lastGuideSignatureRef.current === signature) return;
    lastGuideSignatureRef.current = signature;

    window.dispatchEvent(new CustomEvent(RABBIT_GUIDE_SPEAK_EVENT, { detail: assistantOutput.speech }));
    window.dispatchEvent(new CustomEvent(RABBIT_ASSISTANT_CONTROL_EVENT, { detail: assistantOutput.control }));
    window.dispatchEvent(new Event(RABBIT_GUIDE_PROMPT_EVENT));
  }, [assistantOutput]);

  return null;
}
