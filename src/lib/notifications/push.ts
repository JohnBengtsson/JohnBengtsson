import webpush from "web-push";

let configured = false;

export function configureVapid() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys are not configured");
  }
  webpush.setVapidDetails(
    "mailto:forge@noreply.app",
    publicKey,
    privateKey
  );
  configured = true;
}

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPush(
  sub: PushSubscription,
  payload: PushPayload
): Promise<void> {
  configureVapid();
  await webpush.sendNotification(
    {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth_key },
    },
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url ?? "/dashboard" },
    })
  );
}
