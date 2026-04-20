export type SpaceMode = "day" | "night";
export type SpacePreference = "auto" | "day" | "night";

export const SPACE_THEME_STORAGE_KEY = "somagnus:space:theme:v1";

export const SPACE_SKY = {
  day: "linear-gradient(180deg, #9FD3FF 0%, #6AB7F2 35%, #3C8CE0 70%, #1E5DB0 100%)",
  night:
    "linear-gradient(180deg, #0A1533 0%, #112147 40%, #16255A 75%, #1A2960 100%)",
} as const;

export const SPACE_THEME = {
  day: {
    skyGradient: SPACE_SKY.day,
    textPrimary: "#1B2B44",
    textSoft: "#5B6B86",
    // Tailwind class tokens
    cardBg: "bg-white/65",
    cardBorder: "border-white/60",
    cardText: "text-[#1B2B44]",
    cardTextSoft: "text-[#5B6B86]",
    chipBg: "bg-white/65",
    chipBorder: "border-white/70",
    searchBg: "bg-white/65",
    searchBorder: "border-white/60",
    sectionTitle: "text-white drop-shadow-[0_2px_12px_rgba(10,30,70,0.35)]",
    playerBg: "bg-white",
    playerBorder: "border-slate-200",
    playerSoftBg: "bg-slate-50",
    playerSoftBorder: "border-slate-200",
    playerText: "text-[#1B2B44]",
    playerTextSoft: "text-[#5B6B86]",
    playerProgressTrack: "bg-slate-200",
    cloudOpacity: [0.85, 0.9, 0.55, 0.6] as [number, number, number, number],
    toggleIcon: "Sun" as const,
  },
  night: {
    skyGradient: SPACE_SKY.night,
    textPrimary: "#FFFFFF",
    textSoft: "rgba(255,255,255,0.72)",
    cardBg: "bg-white/10",
    cardBorder: "border-white/20",
    cardText: "text-white",
    cardTextSoft: "text-white/75",
    chipBg: "bg-white/10",
    chipBorder: "border-white/20",
    searchBg: "bg-white/10",
    searchBorder: "border-white/20",
    sectionTitle: "text-white drop-shadow-[0_2px_18px_rgba(180,200,255,0.45)]",
    playerBg: "bg-[#12204A]/90",
    playerBorder: "border-white/15",
    playerSoftBg: "bg-white/10",
    playerSoftBorder: "border-white/15",
    playerText: "text-white",
    playerTextSoft: "text-white/75",
    playerProgressTrack: "bg-white/15",
    cloudOpacity: [0.35, 0.4, 0.25, 0.3] as [number, number, number, number],
    toggleIcon: "Moon" as const,
  },
} as const;
