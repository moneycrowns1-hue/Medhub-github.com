import Link from "next/link";
import { ArrowRight, Headphones, MoonStar, Sparkles, Waves } from "lucide-react";

const moods = [
  {
    title: "Respira",
    subtitle: "2 min para volver al centro",
    tone: "bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_45%)]",
  },
  {
    title: "Enfócate",
    subtitle: "Prep mental antes de estudiar",
    tone: "bg-[radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.2),transparent_45%)]",
  },
  {
    title: "Descarga",
    subtitle: "Cerrar el día sin ruido mental",
    tone: "bg-[radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.2),transparent_45%)]",
  },
];

const sessions = [
  {
    title: "Reset express",
    type: "Micro pausa",
    length: "03:00",
    desc: "Baja tensión y arranca con claridad.",
  },
  {
    title: "Foco profundo",
    type: "Preparación",
    length: "08:00",
    desc: "Ritual mental antes de un bloque largo.",
  },
  {
    title: "Dormir mejor",
    type: "Noche",
    length: "10:00",
    desc: "Transición suave para descansar de verdad.",
  },
];

export default function SpacePage() {
  return (
    <div className="space-y-10 pb-6 text-white">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-[linear-gradient(160deg,#1b4f63_0%,#222252_58%,#18172a_100%)] p-6 shadow-[0_30px_80px_-40px_rgba(117,208,255,0.55)] md:p-10">
        <div className="pointer-events-none absolute -top-24 right-[-30px] h-64 w-64 rounded-full bg-cyan-200/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-55px] left-[-30px] h-52 w-52 rounded-full bg-indigo-300/20 blur-3xl" />

        <div className="relative z-10 max-w-2xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/85">
            <MoonStar className="h-3.5 w-3.5" />
            Space
          </div>

          <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
            Tu espacio mental para estudiar con más calma.
          </h1>

          <p className="text-sm text-white/75 md:text-base">
            Inspirado en una experiencia tipo Headspace: menos ruido, más presencia y rutinas simples que sí se sostienen.
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Empezar ahora
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/day"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/15"
            >
              Conectar con mi plan
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-white/80">
          <Sparkles className="h-4 w-4" />
          Elige cómo te sientes hoy
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {moods.map((mood) => (
            <article
              key={mood.title}
              className="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/35"
            >
              <div className={`pointer-events-none absolute inset-0 ${mood.tone}`} />
              <div className="relative z-10 space-y-1">
                <h2 className="text-base font-semibold">{mood.title}</h2>
                <p className="text-xs text-white/70">{mood.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-3xl border border-white/20 bg-white/8 p-6 backdrop-blur-xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
            <Headphones className="h-3.5 w-3.5" />
            Sesiones guiadas
          </div>

          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.title}
                className="flex items-center justify-between rounded-2xl border border-white/15 bg-black/20 px-4 py-3 transition hover:border-white/30"
              >
                <div>
                  <div className="text-sm font-semibold">{session.title}</div>
                  <div className="text-xs text-white/65">{session.type} · {session.desc}</div>
                </div>
                <div className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/85">
                  {session.length}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="relative overflow-hidden rounded-3xl border border-white/20 bg-[linear-gradient(170deg,rgba(73,171,201,0.25),rgba(64,92,196,0.15),rgba(15,17,36,0.5))] p-6 backdrop-blur-xl">
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-200/20 blur-2xl" />
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
              <Waves className="h-3.5 w-3.5" />
              Próximamente
            </div>
            <h3 className="text-xl font-semibold">Biblioteca de audios personalizados</h3>
            <p className="text-sm text-white/75">
              Aquí vas a integrar tus audios cuando estén listos. La estructura ya está preparada para sumar colecciones, favoritos y reproducción continua.
            </p>
            <div className="rounded-2xl border border-dashed border-white/30 bg-white/5 p-4 text-xs text-white/70">
              Estado actual: sección base activa, diseño listo, lógica preparada para crecer sin romper la experiencia.
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
