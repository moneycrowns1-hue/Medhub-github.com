"use client";

import Link from "next/link";
import type { SubjectSlug } from "@/lib/subjects";
import {
  RABBIT_ASSISTANT_CONTROL_EVENT,
  startStudyGuidance,
} from "@/lib/rabbit-guide";
import { SUBJECTS } from "@/lib/subjects";
import { loadPomodoroSettings } from "@/lib/pomodoro-settings";
import { notifyGlobal } from "@/lib/global-notifier";

type Props = {
  href: string;
  subjectSlug: SubjectSlug;
  className: string;
  children: React.ReactNode;
};

export function StartStudyLink({ href, subjectSlug, className, children }: Props) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        startStudyGuidance(subjectSlug);
        window.dispatchEvent(
          new CustomEvent(RABBIT_ASSISTANT_CONTROL_EVENT, {
            detail: {
              behaviorMode: "guide",
              visualState: "idle",
              pauseMs: 2000,
            },
          }),
        );
        const subject = SUBJECTS[subjectSlug];
        const settings = loadPomodoroSettings();
        notifyGlobal({
          title: "Empezamos la rutina",
          body: `Tu primera materia es ${subject.name}. Activa Pomodoro (bloque 1: ${settings.focus1Min} min). Te voy indicando inicio, mitad y cierre de cada bloque; al terminar te sugiero el siguiente paso.`,
          status: "Conejo guía · Preparando ruta",
          actions: [
            { href: "/#pomodoro", label: "Activar Pomodoro", primary: true },
            { href, label: `Abrir ${subject.name}` },
          ],
          durationMs: 6200,
          tag: `start-routine:${subjectSlug}:${Date.now()}`,
          inAppOnly: true,
        });
      }}
    >
      {children}
    </Link>
  );
}
