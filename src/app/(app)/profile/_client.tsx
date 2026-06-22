"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  LogOut,
  Moon,
  Sun,
  Monitor,
  Bell,
  BellOff,
  Trash2,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  WhoopConnectButton,
  type WhoopConnectionStatus,
} from "@/components/whoop/WhoopConnectButton";
import { createClient } from "@/lib/supabase/client";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Stockholm",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

interface ProfileClientProps {
  userId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  timezone: string;
  whoopStatus: WhoopConnectionStatus;
  hasPushSubscription: boolean;
}

export function ProfileClient({
  userId,
  email,
  displayName: initialName,
  avatarUrl,
  timezone: initialTz,
  whoopStatus,
  hasPushSubscription,
}: ProfileClientProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState(initialName ?? "");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [timezone, setTimezone] = useState(initialTz);
  const [savingTz, setSavingTz] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(hasPushSubscription);
  const [togglingPush, setTogglingPush] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const initials = (displayName || email).slice(0, 2).toUpperCase();

  async function saveName() {
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName || null })
      .eq("id", userId);
    setSavingName(false);
    if (error) {
      toast.error("Failed to save name");
    } else {
      setEditingName(false);
      toast.success("Name updated");
    }
  }

  async function saveTimezone(tz: string) {
    setSavingTz(true);
    const { error } = await supabase
      .from("profiles")
      .update({ timezone: tz })
      .eq("id", userId);
    setSavingTz(false);
    if (error) {
      toast.error("Failed to save timezone");
    } else {
      setTimezone(tz);
      toast.success("Timezone updated");
    }
  }

  async function toggleNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Push notifications not supported in this browser");
      return;
    }
    setTogglingPush(true);
    try {
      if (pushEnabled) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await fetch("/api/notifications/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        }
        setPushEnabled(false);
        toast.success("Notifications disabled");
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Permission denied — enable in browser settings");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        });
        const json = sub.toJSON();
        const res = await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
          }),
        });
        if (!res.ok) throw new Error("Subscribe failed");
        setPushEnabled(true);
        toast.success("Notifications enabled");
      }
    } catch {
      toast.error("Failed to update notifications");
    } finally {
      setTogglingPush(false);
    }
  }

  async function handleWhoopDisconnect() {
    await supabase.from("whoop_connections").delete().eq("user_id", userId);
    router.refresh();
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account", { method: "DELETE" });
    if (res.ok) {
      router.push("/login");
    } else {
      toast.error("Failed to delete account");
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-lg mx-auto pb-28">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* Identity */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={avatarUrl ?? undefined} alt={displayName || email} />
              <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
            </Avatar>
            <p className="text-xs text-muted-foreground truncate flex-1">{email}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display name</Label>
            {editingName ? (
              <div className="flex gap-2">
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={saveName}
                  disabled={savingName}
                  aria-label="Save name"
                >
                  <Check className="h-4 w-4 text-primary" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditingName(false)}
                  aria-label="Cancel editing"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                className="flex items-center gap-2 text-sm py-1.5 text-foreground hover:text-primary transition-colors"
                onClick={() => setEditingName(true)}
              >
                <span>
                  {displayName || (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </span>
                <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timezone */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Timezone</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            value={timezone}
            onChange={(e) => saveTimezone(e.target.value)}
            disabled={savingTz}
            aria-label="Select timezone"
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Push notifications</p>
              <p className="text-xs text-muted-foreground">
                Morning & evening reminders
              </p>
            </div>
            <Button
              variant={pushEnabled ? "default" : "outline"}
              size="sm"
              onClick={toggleNotifications}
              disabled={togglingPush}
              aria-pressed={pushEnabled}
            >
              {pushEnabled ? (
                <Bell className="h-4 w-4 mr-1.5" />
              ) : (
                <BellOff className="h-4 w-4 mr-1.5" />
              )}
              {pushEnabled ? "On" : "Off"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium mb-3">Theme</p>
          <div className="flex gap-2">
            {(["dark", "light", "system"] as const).map((t) => {
              const Icon =
                t === "dark" ? Moon : t === "light" ? Sun : Monitor;
              return (
                <Button
                  key={t}
                  size="sm"
                  variant={theme === t ? "default" : "outline"}
                  onClick={() => setTheme(t)}
                  className="flex-1 capitalize"
                >
                  <Icon className="h-3.5 w-3.5 mr-1.5" />
                  {t}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Whoop */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Whoop Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <WhoopConnectButton
            status={whoopStatus}
            onDisconnect={handleWhoopDisconnect}
          />
        </CardContent>
      </Card>

      <Separator />

      <Button
        variant="outline"
        className="w-full"
        onClick={handleSignOut}
        disabled={signingOut}
      >
        <LogOut className="h-4 w-4 mr-2" />
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>

      {/* Danger zone */}
      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-destructive">
            Danger zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" className="w-full">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete account?</DialogTitle>
                <DialogDescription>
                  All your data — campaigns, logs, XP, and Whoop connections —
                  will be permanently deleted. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete permanently"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
