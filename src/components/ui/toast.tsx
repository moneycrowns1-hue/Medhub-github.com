"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info" | "warning";

export type ToastPayload = {
  id: string;
  title?: string;
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastInput = Omit<ToastPayload, "id"> & { id?: string };

const TOAST_EVENT = "somagnus:toast";

function uid() {
  return `t_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export function toast(input: ToastInput): string {
  if (typeof window === "undefined") return "";
  const payload: ToastPayload = {
    id: input.id ?? uid(),
    title: input.title,
    message: input.message,
    variant: input.variant ?? "info",
    durationMs: input.durationMs ?? 3500,
  };
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
  return payload.id;
}

toast.success = (message: string, title?: string) => toast({ message, title, variant: "success" });
toast.error = (message: string, title?: string) => toast({ message, title, variant: "error" });
toast.info = (message: string, title?: string) => toast({ message, title, variant: "info" });
toast.warning = (message: string, title?: string) => toast({ message, title, variant: "warning" });

function VariantIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "success") return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
  if (variant === "error") return <XCircle className="h-4 w-4 text-rose-300" />;
  if (variant === "warning") return <TriangleAlert className="h-4 w-4 text-amber-300" />;
  return <Info className="h-4 w-4 text-cyan-300" />;
}

function variantClass(variant: ToastVariant): string {
  if (variant === "success") return "border-emerald-300/35 bg-emerald-400/10";
  if (variant === "error") return "border-rose-300/35 bg-rose-400/10";
  if (variant === "warning") return "border-amber-300/35 bg-amber-400/10";
  return "border-cyan-300/35 bg-cyan-400/10";
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      if (!detail) return;
      setToasts((prev) => [...prev, detail]);
      if (detail.durationMs && detail.durationMs > 0) {
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((entry) => entry.id !== detail.id));
        }, detail.durationMs);
      }
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((entry) => entry.id !== id));

  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[120] flex flex-col items-center gap-2 px-4 sm:inset-auto sm:bottom-6 sm:right-6 sm:items-end"
    >
      {toasts.map((entry) => (
        <div
          key={entry.id}
          role="status"
          className={cn(
            "pointer-events-auto w-full max-w-sm rounded-xl border px-3 py-2.5 text-white shadow-xl backdrop-blur-xl",
            variantClass(entry.variant ?? "info"),
          )}
        >
          <div className="flex items-start gap-2">
            <div className="pt-0.5">
              <VariantIcon variant={entry.variant ?? "info"} />
            </div>
            <div className="flex-1 space-y-0.5">
              {entry.title ? <div className="text-sm font-semibold">{entry.title}</div> : null}
              <div className="text-xs text-white/90">{entry.message}</div>
            </div>
            <button
              type="button"
              onClick={() => dismiss(entry.id)}
              className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Cerrar notificación"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
