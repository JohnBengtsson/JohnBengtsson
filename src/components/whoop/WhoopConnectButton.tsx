"use client";

import { useState } from "react";
import { Loader2, Zap, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativeDate } from "@/lib/utils";

export type WhoopConnectionStatus =
  | { state: "not_connected" }
  | { state: "connected"; lastSyncedAt: string | null }
  | { state: "error"; message: string };

interface WhoopConnectButtonProps {
  status: WhoopConnectionStatus;
  onDisconnect?: () => void;
}

export function WhoopConnectButton({
  status,
  onDisconnect,
}: WhoopConnectButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/whoop/sync", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setSyncError(data.error ?? "Sync failed");
      }
    } catch {
      setSyncError("Network error — try again");
    } finally {
      setSyncing(false);
    }
  }

  if (status.state === "not_connected") {
    return (
      <a href="/api/whoop/auth">
        <Button variant="outline" className="gap-2">
          <Zap className="h-4 w-4" />
          Connect Whoop
        </Button>
      </a>
    );
  }

  if (status.state === "error") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {status.message}
        </div>
        <a href="/api/whoop/auth">
          <Button variant="outline" size="sm">
            Reconnect
          </Button>
        </a>
      </div>
    );
  }

  // Connected state
  const lastSync = status.lastSyncedAt
    ? formatRelativeDate(status.lastSyncedAt)
    : "never";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-recovery-high">
          <CheckCircle2 className="h-4 w-4" />
          <span>Whoop connected</span>
          <span className="text-muted-foreground">· Last synced {lastSync}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="gap-1.5"
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Zap className="h-3.5 w-3.5" />
          )}
          {syncing ? "Syncing…" : "Sync now"}
        </Button>
        {onDisconnect && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            className="gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <XCircle className="h-3.5 w-3.5" />
            Disconnect
          </Button>
        )}
      </div>
      {syncError && (
        <p className="text-xs text-destructive">{syncError}</p>
      )}
    </div>
  );
}
