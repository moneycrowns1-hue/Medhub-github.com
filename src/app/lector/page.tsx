import { Suspense } from "react";

import { ResourcesClient } from "@/app/resources/resources-client";

export default function LectorPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-black p-4 text-sm text-white/70">Cargando lector...</div>}>
      <ResourcesClient initialWorkspaceMode="inmersion" hideLibraryPane />
    </Suspense>
  );
}
