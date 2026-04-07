import { SrsClient } from "@/app/srs/srs-client";

export default function SrsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">SRS</h1>
        <p className="text-sm text-muted-foreground">
          Repaso espaciado tipo Anki. (UI primero)
        </p>
      </div>

      <SrsClient />
    </div>
  );
}
