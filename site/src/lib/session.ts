const SESSION_KEY = "mora_session_id";

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `eph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function sendBeaconJSON(path: string, payload: unknown): void {
  if (typeof window === "undefined") return;
  const url = `${API_URL}${path}`;
  const body = JSON.stringify(payload);
  try {
    const blob = new Blob([body], { type: "application/json" });
    const ok =
      typeof navigator !== "undefined" &&
      "sendBeacon" in navigator &&
      navigator.sendBeacon(url, blob);
    if (!ok) {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Analytics nunca pode quebrar a navegação.
  }
}
