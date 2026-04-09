"use client";

import Link from "next/link";
import type { SubjectSlug } from "@/lib/subjects";
import { startStudyGuidance } from "@/lib/rabbit-guide";

type Props = {
  href: string;
  subjectSlug: SubjectSlug;
  className: string;
  children: React.ReactNode;
};

export function StartStudyLink({ href, subjectSlug, className, children }: Props) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        startStudyGuidance(subjectSlug);
      }}
    >
      {children}
    </Link>
  );
}
