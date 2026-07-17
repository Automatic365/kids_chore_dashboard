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

    // When an updated service worker takes control, reload once so the open
    // page picks up the new bundle instead of running stale JS until the next
    // manual navigation. Skip the very first install (no prior controller).
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    const onControllerChange = () => {
      if (!hadController || refreshing) {
        return;
      }
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let updateInterval: number | undefined;
    let onVisibilityChange: (() => void) | undefined;

    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        void registration.update();

        // The board runs for days on a tablet without navigation, so poll
        // for new deploys hourly and whenever the app returns to foreground.
        updateInterval = window.setInterval(() => {
          void registration.update();
        }, 60 * 60 * 1000);
        onVisibilityChange = () => {
          if (document.visibilityState === "visible") {
            void registration.update();
          }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
      })
      .catch(() => {
        // Non-blocking for browsers that do not support service workers in this context.
      });

    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (updateInterval !== undefined) {
        window.clearInterval(updateInterval);
      }
      if (onVisibilityChange) {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, []);

  return null;
}
