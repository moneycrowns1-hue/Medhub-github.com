import { notFound } from "next/navigation";

import { ResourcesClient } from "@/app/resources/resources-client";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: "demo" }];
}

export default async function LectorPage({ params }: Props) {
  const { id } = await params;
  if (!id) return notFound();

  return <ResourcesClient initialWorkspaceMode="inmersion" initialSelectedId={id} hideLibraryPane />;
}
