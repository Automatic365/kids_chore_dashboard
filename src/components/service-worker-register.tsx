"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Check for updates in the background without forcing reload loops.
        void registration.update();
      })
      .catch(() => {
        // Non-blocking for browsers that do not support service workers in this context.
      });
  }, []);

  return null;
}
