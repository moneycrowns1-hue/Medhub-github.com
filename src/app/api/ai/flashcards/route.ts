import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = false;

type AiFlashcardType = "basic" | "cloze";

type AiFlashcard = {
  type: AiFlashcardType;
  front: string;
  back: string;
  tags?: string[];
};

type AiNoteDraft = {
  title?: string;
  tags?: string[];
  cards: AiFlashcard[];
};

type AiFlashcardsResponse = {
  notes: AiNoteDraft[];
};

function jsonFromModelText(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const slice = trimmed.slice(start, end + 1);
      return JSON.parse(slice);
    }
    throw new Error("No se pudo parsear JSON desde la respuesta del modelo");
  }
}

function normalizeAiResponse(data: unknown): AiFlashcardsResponse {
  const obj = data as Partial<AiFlashcardsResponse>;
  const notes = Array.isArray(obj?.notes) ? obj.notes : [];

  const cleanNotes: AiNoteDraft[] = notes
    .map((n) => {
      const nn = n as Partial<AiNoteDraft>;
      const cards = Array.isArray(nn.cards) ? nn.cards : [];
      const cleanCards: AiFlashcard[] = cards
        .map((c) => {
          const cc = c as Partial<AiFlashcard>;
          const type: AiFlashcardType = cc.type === "cloze" ? "cloze" : "basic";
          const front = typeof cc.front === "string" ? cc.front.trim() : "";
          const back = typeof cc.back === "string" ? cc.back.trim() : "";
          const tags = Array.isArray(cc.tags) ? cc.tags.filter((t) => typeof t === "string") : undefined;
          return { type, front, back, tags };
        })
        .filter((c) => c.front.length > 0 && c.back.length > 0);

      const title = typeof nn.title === "string" ? nn.title.trim() : undefined;
      const tags = Array.isArray(nn.tags) ? nn.tags.filter((t) => typeof t === "string") : undefined;
      return { title, tags, cards: cleanCards };
    })
    .filter((n) => n.cards.length > 0);

  return { notes: cleanNotes };
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Falta GEMINI_API_KEY en el entorno (configura .env.local)" },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | null
    | {
        text?: string;
        maxCards?: number;
        language?: string;
        topic?: string;
        mode?: "flashcards" | "exam";
        subjectSlug?: string;
      };

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const maxCards =
    typeof body?.maxCards === "number" && Number.isFinite(body.maxCards)
      ? Math.max(5, Math.min(80, Math.floor(body.maxCards)))
      : 25;

  const language = typeof body?.language === "string" && body.language.trim() ? body.language.trim() : "es";

  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  const mode = body?.mode === "exam" ? "exam" : "flashcards";
  const subjectSlug = typeof body?.subjectSlug === "string" ? body.subjectSlug.trim() : "";

  if (!text) {
    return NextResponse.json({ error: "Texto vacío" }, { status: 400 });
  }

  const modeLine =
    mode === "exam"
      ? `MODO: Examen (MCQ). Cada card type=basic.
FRONT: una pregunta tipo examen con 4 opciones (A-D) en líneas separadas.
BACK: la respuesta correcta (ej: "Respuesta: B") + explicación breve + por qué las otras opciones están mal (si aplica).`
      : `MODO: Flashcards (Anki). Mezcla basic y cloze cuando convenga.
Para cloze usa {{c1::...}} y evita cloze largos.`;

  const topicLine = topic ? `TEMA/FOCO: ${topic}` : "TEMA/FOCO: (no especificado)";
  const subjectLine = subjectSlug
    ? `MATERIA OBJETIVO: ${subjectSlug}`
    : "MATERIA OBJETIVO: (general)";
  const specializationLine = "ESPECIALIZACIÓN: (sin especialización adicional).";

  const prompt = `Vas a crear material de estudio a partir de un PDF para un estudiante de medicina.

REGLAS:
- Responde SOLO con JSON válido.
- No incluyas markdown, ni explicaciones.
- Devuelve un objeto con esta forma exacta:
{
  "notes": [
    {
      "title": "opcional",
      "tags": ["opcional"],
      "cards": [
        {"type":"basic","front":"...","back":"...","tags":["..."]},
        {"type":"cloze","front":"Texto con {{c1::...}}","back":"Extra","tags":["..."]}
      ]
    }
  ]
}

CALIDAD:
- Tarjetas cortas, atómicas y sin ambigüedad.
- Evita preguntas vagas.
- No inventes información: si el texto no lo sustenta, no lo agregues.
- Idioma: ${language}.
- Genera aproximadamente ${maxCards} tarjetas (repartidas en notes).

${modeLine}

${topicLine}

${subjectLine}

${specializationLine}

TEXTO FUENTE:
${text}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
    key,
  )}`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
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
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const content =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => (typeof p.text === "string" ? p.text : ""))
      .join("\n") ??
    "";
  const parsed = jsonFromModelText(content);
  const normalized = normalizeAiResponse(parsed);

  return NextResponse.json(normalized);
}
