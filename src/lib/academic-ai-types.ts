import type { AcademicSubjectSlug } from "@/lib/academic-store";

export type AcademicAiSourceType = "pdf" | "text" | "image" | "audio";

export type AcademicAiGenerateRequest = {
  subjectSlug: AcademicSubjectSlug;
  semesterId: string;
  blockRef: { blockType: "partial" | "final" | "remedial"; blockIndex: number | null };
  source: {
    type: AcademicAiSourceType;
    title?: string;
    text?: string;
    resourceId?: string;
  };
  outputs: Array<"flashcards" | "notes" | "quiz">;
  maxItems?: number;
};

export type AcademicAiFlashcardDraft = {
  front: string;
  back: string;
  difficulty?: "baja" | "media" | "alta";
};

export type AcademicAiNoteDraft = {
  title: string;
  content: string;
};

export type AcademicAiQuizDraft = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

export type AcademicAiGenerateResultOk = {
  status: "ok";
  flashcards?: AcademicAiFlashcardDraft[];
  notes?: AcademicAiNoteDraft[];
  quiz?: AcademicAiQuizDraft[];
};

export type AcademicAiGenerateResultDisabled = {
  status: "disabled";
  reason: "ai_maintenance" | "not_configured" | "quota_exceeded";
  message: string;
};

export type AcademicAiGenerateResult = AcademicAiGenerateResultOk | AcademicAiGenerateResultDisabled;

export async function requestAcademicGeneration(
  _request: AcademicAiGenerateRequest,
): Promise<AcademicAiGenerateResult> {
  return {
    status: "disabled",
    reason: "ai_maintenance",
    message: "La generación con IA está en mantenimiento. Tus registros manuales siguen funcionando con normalidad.",
  };
}
