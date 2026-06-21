// Captura opcional de geolocalização para a trilha de auditoria das
// assinaturas. É sempre NÃO-BLOQUEANTE: se o navegador não suportar, o usuário
// negar a permissão, ou estourar o tempo, resolvemos com `null` e a assinatura
// segue normalmente (o PDF mostra "Geo não informada").

/** Texto curto gravado em `assinante_geo`, ex.: "-3.731876, -38.526670 (±18m)". */
export function capturarGeo(timeoutMs = 8000): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let resolvido = false;
    const finalizar = (valor: string | null) => {
      if (!resolvido) {
        resolvido = true;
        resolve(valor);
      }
    };
    // Rede de segurança: nunca deixa a Promise pendurada além do timeout.
    const t = setTimeout(() => finalizar(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(t);
        const { latitude, longitude, accuracy } = pos.coords;
        const acc = Number.isFinite(accuracy) ? ` (±${Math.round(accuracy)}m)` : "";
        finalizar(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}${acc}`);
      },
      () => {
        clearTimeout(t);
        finalizar(null); // permissão negada, indisponível, etc.
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}
