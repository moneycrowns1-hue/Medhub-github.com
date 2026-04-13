import { SUBJECTS, type SubjectSlug } from "@/lib/subjects";

export type ReadingTopic =
  | "Lenguaje, Redacción y Oratoria"
  | "Libros cultos y Estrategia"
  | "Descanso";

export type DayPlan = {
  dayOfWeek: number; // 0=Sunday .. 6=Saturday
  primary: SubjectSlug;
  secondary: SubjectSlug;
  reading: ReadingTopic;
  label: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  focusNote?: string;
  isRestDay?: boolean;
};

const WEEKLY_SCHEDULE: Record<number, DayPlan> = {
  1: {
    dayOfWeek: 1,
    label: "Lunes",
    primary: "anatomia",
    secondary: "histologia",
    reading: "Lenguaje, Redacción y Oratoria",
  },
  2: {
    dayOfWeek: 2,
    label: "Martes",
    primary: "histologia",
    secondary: "anatomia",
    reading: "Libros cultos y Estrategia",
  },
  3: {
    dayOfWeek: 3,
    label: "Miércoles",
    primary: "biologia-celular",
    secondary: "histologia",
    reading: "Lenguaje, Redacción y Oratoria",
  },
  4: {
    dayOfWeek: 4,
    label: "Jueves",
    primary: "embriologia",
    secondary: "biologia-celular",
    reading: "Libros cultos y Estrategia",
  },
  5: {
    dayOfWeek: 5,
    label: "Viernes",
    primary: "anatomia",
    secondary: "embriologia",
    reading: "Libros cultos y Estrategia",
    primaryLabel: "Repaso fuerte Anatomía",
    secondaryLabel: "Repaso fuerte Embriología",
    focusNote: "Repaso fuerte de Anatomía + Embriología.",
  },
  6: {
    dayOfWeek: 6,
    label: "Sábado",
    primary: "anatomia",
    secondary: "embriologia",
    reading: "Lenguaje, Redacción y Oratoria",
    primaryLabel: "Repaso universal",
    secondaryLabel: "Evaluación / Preguntas / Flashcards",
    focusNote: "2h Anatomía · 1h Histología · 1h Biología Celular · 2h Embriología · 1h Evaluación/Preguntas/Flashcards.",
  },
  0: {
    dayOfWeek: 0,
    label: "Domingo",
    primary: "anatomia",
    secondary: "histologia",
    reading: "Descanso",
    primaryLabel: "Descanso",
    secondaryLabel: "Recuperación",
    focusNote: "Domingo de descanso.",
    isRestDay: true,
  },
};

export function getPlanForDate(date: Date = new Date()): DayPlan {
  const day = date.getDay();
  return WEEKLY_SCHEDULE[day] ?? WEEKLY_SCHEDULE[1];
}

export function formatPlanSummary(plan: DayPlan) {
  return {
    dayLabel: plan.label,
    primaryName: plan.primaryLabel ?? SUBJECTS[plan.primary].name,
    secondaryName: plan.secondaryLabel ?? SUBJECTS[plan.secondary].name,
    reading: plan.reading,
    focusNote: plan.focusNote,
    isRestDay: Boolean(plan.isRestDay),
  };
}
