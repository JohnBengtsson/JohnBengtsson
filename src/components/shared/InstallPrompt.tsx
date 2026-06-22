"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }

  const visible = !!deferredPrompt && !dismissed;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-20 inset-x-4 z-50 rounded-xl border bg-card shadow-lg p-4"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Install Forge</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add to your home screen for the full app experience.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={handleInstall}
              >
                Install
              </Button>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
