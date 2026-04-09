"use client";

import Link from "next/link";
import type { SubjectSlug } from "@/lib/subjects";
import { RABBIT_GUIDE_SPEAK_EVENT, startStudyGuidance } from "@/lib/rabbit-guide";
import { SUBJECTS } from "@/lib/subjects";

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
        const subject = SUBJECTS[subjectSlug];
        window.dispatchEvent(
          new CustomEvent(RABBIT_GUIDE_SPEAK_EVENT, {
            detail: {
              title: "Empezamos",
              message: `Perfecto, vamos con ${subject.name}. Primero activo modo guía y luego seguimos el bloque paso a paso.`,
              status: "Conejo en pausa · Preparando ruta",
              actions: [{ href: "/#pomodoro", label: "Ir a Pomodoro", primary: true }],
              durationMs: 4200,
            },
          }),
        );
      }}
    >
      {children}
    </Link>
  );
}
