import { Suspense } from "react";

import { ResourcesClient } from "@/app/resources/resources-client";

export default function BibliotecaPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-foreground/70">Cargando biblioteca...</div>}>
      <ResourcesClient initialWorkspaceMode="gestion" />
    </Suspense>
  );
}
