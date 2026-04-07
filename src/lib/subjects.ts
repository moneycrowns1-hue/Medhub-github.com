export type SubjectSlug = "anatomia" | "histologia" | "embriologia" | "biologia-celular";

export type SubjectUiMode = "visual" | "timeline" | "flowcharts" | "redirect";

export type SubjectDefinition = {
  slug: SubjectSlug;
  name: string;
  uiMode: SubjectUiMode;
  redirectUrl?: string;
};

export const HISTOLOGY_URL =
  "https://moneycrowns1-hue.github.io/histologia-github.com/#/";

export const SUBJECTS: Record<SubjectSlug, SubjectDefinition> = {
  anatomia: {
    slug: "anatomia",
    name: "Anatomía",
    uiMode: "visual",
  },
  histologia: {
    slug: "histologia",
    name: "Histología",
    uiMode: "redirect",
    redirectUrl: HISTOLOGY_URL,
  },
  embriologia: {
    slug: "embriologia",
    name: "Embriología",
    uiMode: "timeline",
  },
  "biologia-celular": {
    slug: "biologia-celular",
    name: "Biología Celular",
    uiMode: "flowcharts",
  },
};

export const SUBJECT_LIST: SubjectDefinition[] = Object.values(SUBJECTS);
