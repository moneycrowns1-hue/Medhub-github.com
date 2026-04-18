import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = false;

type ExplainRequest = {
  front?: string;
  back?: string;
  subjectSlug?: string;
  language?: string;
};

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Falta GEMINI_API_KEY en el entorno (configura .env.local)" },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => null)) as null | ExplainRequest;
  const front = typeof body?.front === "string" ? body.front.trim() : "";
  const back = typeof body?.back === "string" ? body.back.trim() : "";
  const language = typeof body?.language === "string" && body.language.trim() ? body.language.trim() : "es";
  const subjectSlug = typeof body?.subjectSlug === "string" ? body.subjectSlug.trim() : "";

  if (!front) {
    return NextResponse.json({ error: "Falta el frente de la tarjeta." }, { status: 400 });
  }

  const prompt = `Eres un tutor médico claro y breve. Explica la siguiente tarjeta de estudio.
Idioma: ${language}.
${subjectSlug ? `Materia: ${subjectSlug}.` : ""}

FORMATO DE SALIDA (sin markdown pesado):
- Idea clave (1-2 líneas)
- Por qué importa (1 línea)
- Truco para recordarlo (1 línea)
- Error común a evitar (1 línea)

Tarjeta:
FRENTE: ${front}
REVERSO: ${back || "(sin reverso)"}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
    key,
  )}`;

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return NextResponse.json(
      { error: `Gemini error: ${r.status}`, details: t.slice(0, 2000) },
      { status: 500 },
    );
  }

  const data = (await r.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content =
    data.candidates?.[0]?.content?.parts?.map((p) => (typeof p.text === "string" ? p.text : "")).join("\n") ?? "";

  return NextResponse.json({ explanation: content.trim() });
}
