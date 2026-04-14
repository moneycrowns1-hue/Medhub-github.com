"use client";

import { useEffect } from "react";

export function PwaBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const nextData = (window as Window & {
      __NEXT_DATA__?: { assetPrefix?: string };
    }).__NEXT_DATA__;
    const prefix = typeof nextData?.assetPrefix === "string" ? nextData.assetPrefix : "";
    const normalizedPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    const swUrl = `${normalizedPrefix}/sw.js`;
    const swScope = normalizedPrefix ? `${normalizedPrefix}/` : "/";

    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        const regScopeUrl = new URL(registration.scope);
        const regScopePath = regScopeUrl.pathname;
        if (swScope !== "/" && regScopePath !== swScope && regScopePath === "/") {
          void registration.unregister();
        }
      }
      return navigator.serviceWorker.register(swUrl, { scope: swScope });
    }).catch(() => {
      // ignore registration failures
    });
  }, []);

  return null;
}
