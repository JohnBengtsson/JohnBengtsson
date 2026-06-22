"use client";

import { useEffect } from "react";
import { useAppStore } from "@/stores/useAppStore";

// Handles offline-queue hydration and online-event flush.
// Rendered once inside the app shell.
export function AppBootstrap() {
  const hydrateQueue = useAppStore((s) => s.hydrateQueue);
  const flushQueue = useAppStore((s) => s.flushQueue);

  useEffect(() => {
    // Load any queued items from IndexedDB that survived a previous session
    hydrateQueue();

    // Flush whenever the browser regains connectivity
    const onOnline = () => flushQueue();
    window.addEventListener("online", onOnline);

    // Also flush on initial mount in case we're already online
    if (navigator.onLine) flushQueue();

    return () => window.removeEventListener("online", onOnline);
  }, [hydrateQueue, flushQueue]);

  return null;
}
