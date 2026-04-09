export type RabbitPersonality = "balanced" | "calm" | "active";

const STORAGE_KEY = "somagnus:rabbit_personality:v1";
export const RABBIT_PERSONALITY_UPDATED_EVENT = "somagnus:rabbit_personality:updated";

export const DEFAULT_RABBIT_PERSONALITY: RabbitPersonality = "balanced";

export const RABBIT_PERSONALITY_OPTIONS: Array<{ id: RabbitPersonality; label: string; desc: string }> = [
  {
    id: "balanced",
    label: "Balanceado",
    desc: "Pausas y movimiento en equilibrio para el día a día.",
  },
  {
    id: "calm",
    label: "Calmo",
    desc: "Más descansos, menos saltos y ritmo tranquilo.",
  },
  {
    id: "active",
    label: "Activo",
    desc: "Más desplazamiento y energía durante la sesión.",
  },
];

function sanitizeRabbitPersonality(value: unknown): RabbitPersonality {
  if (value === "calm" || value === "active" || value === "balanced") return value;
  return DEFAULT_RABBIT_PERSONALITY;
}

export function loadRabbitPersonality(): RabbitPersonality {
  if (typeof window === "undefined") return DEFAULT_RABBIT_PERSONALITY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RABBIT_PERSONALITY;
    return sanitizeRabbitPersonality(JSON.parse(raw));
  } catch {
    return DEFAULT_RABBIT_PERSONALITY;
  }
}

export function saveRabbitPersonality(value: RabbitPersonality) {
  if (typeof window === "undefined") return;
  const next = sanitizeRabbitPersonality(value);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(RABBIT_PERSONALITY_UPDATED_EVENT));
}

export function resetRabbitPersonality() {
  saveRabbitPersonality(DEFAULT_RABBIT_PERSONALITY);
}
