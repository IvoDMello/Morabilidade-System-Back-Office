"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeUserAction, unsubscribeUserAction } from "@/app/actions/push";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function usePushSubscription() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!vapidPublicKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setIsSupported(true);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => registration.pushManager.getSubscription())
      .then(setSubscription)
      .catch(() => {});
  }, []);

  const subscribe = useCallback(async () => {
    if (!vapidPublicKey) {
      throw new Error("Notificações push não configuradas neste ambiente.");
    }

    setIsPending(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = sub.toJSON();
      await subscribeUserAction({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      });
      setSubscription(sub);
    } finally {
      setIsPending(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    setIsPending(true);
    try {
      await unsubscribeUserAction(subscription.endpoint);
      await subscription.unsubscribe();
      setSubscription(null);
    } finally {
      setIsPending(false);
    }
  }, [subscription]);

  return {
    isSupported,
    isSubscribed: Boolean(subscription),
    isPending,
    subscribe,
    unsubscribe,
  };
}
