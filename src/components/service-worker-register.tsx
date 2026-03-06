"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const reloadKey = "herohabits-chunk-reload-once";
    const reloadWindowMs = 60_000;
    const now = Date.now();
    const previous = Number(window.sessionStorage.getItem(reloadKey) ?? "0");
    if (previous > 0 && now - previous > reloadWindowMs) {
      window.sessionStorage.removeItem(reloadKey);
    }

    const reloadOnceOnChunkError = () => {
      const last = Number(window.sessionStorage.getItem(reloadKey) ?? "0");
      if (last > 0 && Date.now() - last < reloadWindowMs) {
        return;
      }
      window.sessionStorage.setItem(reloadKey, String(Date.now()));
      window.location.reload();
    };

    const onWindowError = (event: Event) => {
      const err = event as ErrorEvent;
      const text = `${err.message ?? ""} ${String((err.error as { name?: string } | undefined)?.name ?? "")}`;
      if (text.includes("ChunkLoadError")) {
        reloadOnceOnChunkError();
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string } | string | undefined;
      const text =
        typeof reason === "string"
          ? reason
          : `${reason?.name ?? ""} ${reason?.message ?? ""}`;
      if (text.includes("ChunkLoadError")) {
        reloadOnceOnChunkError();
      }
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Check for updates in the background without forcing reload loops.
        void registration.update();
      })
      .catch(() => {
        // Non-blocking for browsers that do not support service workers in this context.
      });

    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
