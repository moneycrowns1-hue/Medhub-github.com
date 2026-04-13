import { SUBJECTS, type SubjectSlug } from "@/lib/subjects";

export type ReadingTopic =
  | "Lenguaje, Redacción y Oratoria"
  | "Libros cultos y Estrategia";

export type DayPlan = {
  dayOfWeek: number; // 0=Sunday .. 6=Saturday
  primary: SubjectSlug;
  secondary: SubjectSlug;
  reading: ReadingTopic;
  label: string;
};

const WEEKLY_SCHEDULE: Record<number, DayPlan> = {
  1: {
    dayOfWeek: 1,
    label: "Lunes",
    primary: "anatomia",
    secondary: "ingles",
    reading: "Lenguaje, Redacción y Oratoria",
  },
  2: {
    dayOfWeek: 2,
    label: "Martes",
    primary: "histologia",
    secondary: "trabajo-online",
    reading: "Libros cultos y Estrategia",
  },
  3: {
    dayOfWeek: 3,
    label: "Miércoles",
    primary: "biologia-celular",
    secondary: "ingles",
    reading: "Lenguaje, Redacción y Oratoria",
  },
  4: {
    dayOfWeek: 4,
    label: "Jueves",
    primary: "embriologia",
    secondary: "trabajo-online",
    reading: "Libros cultos y Estrategia",
  },
  5: {
    dayOfWeek: 5,
    label: "Viernes",
    primary: "anatomia",
    secondary: "embriologia",
    reading: "Libros cultos y Estrategia",
  },
  6: {
    dayOfWeek: 6,
    label: "Sábado",
    primary: "ingles",
    secondary: "histologia",
    reading: "Lenguaje, Redacción y Oratoria",
  },
  0: {
    dayOfWeek: 0,
    label: "Domingo",
    primary: "trabajo-online",
    secondary: "anatomia",
    reading: "Libros cultos y Estrategia",
  },
};

export function getPlanForDate(date: Date = new Date()): DayPlan {
  const day = date.getDay();
  return WEEKLY_SCHEDULE[day] ?? WEEKLY_SCHEDULE[1];
}

export function formatPlanSummary(plan: DayPlan) {
  return {
    dayLabel: plan.label,
    primaryName: SUBJECTS[plan.primary].name,
    secondaryName: SUBJECTS[plan.secondary].name,
    reading: plan.reading,
  };
}
