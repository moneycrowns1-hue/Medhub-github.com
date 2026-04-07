import { notFound } from "next/navigation";

import { SUBJECTS, type SubjectSlug } from "@/lib/subjects";
import { StudyClient } from "./study-client";

type Props = {
  params: Promise<{ subject: string }>;
};

export function generateStaticParams() {
  return Object.keys(SUBJECTS).map((slug) => ({
    subject: slug,
  }));
}

export default async function StudySubjectPage({ params }: Props) {
  const { subject } = await params;
  const slug = subject as SubjectSlug;
  const def = SUBJECTS[slug];

  if (!def) return notFound();

  return <StudyClient subject={def} />;
}
