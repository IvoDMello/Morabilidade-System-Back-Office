"use client";

import { useEffect, useRef, useState } from "react";
import type { UseFormWatch, UseFormReset, FieldValues } from "react-hook-form";

const PREFIX = "morabilidade-draft:";

// Rascunhos mais antigos do que isso são descartados, quase certamente
// o usuário esqueceu, mudou de máquina, ou os dados ficaram obsoletos.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface StoredDraft<T> {
  values: T;
  savedAt: number;
}

interface UseFormAutosaveOptions<T extends FieldValues> {
  /** Chave estável que identifica o draft. Ex: `imovel:novo`, `imovel:abc123`. */
  key: string;
  watch: UseFormWatch<T>;
  reset: UseFormReset<T>;
  /** ms entre saves. Default 2000. */
  debounceMs?: number;
  /** Campos a ignorar ao salvar (ex.: senhas, uploads). */
  exclude?: (keyof T)[];
}

interface UseFormAutosaveResult {
  /** True quando há um draft persistido aguardando decisão do usuário. */
  hasDraft: boolean;
  /** Idade do draft em ms (sempre 0 antes de detectar). */
  draftAgeMs: number;
  /** Aplica o draft no form e limpa a flag. */
  restoreDraft: () => void;
  /** Descarta o draft sem aplicar. */
  discardDraft: () => void;
  /** Limpa o draft (uso ao submeter com sucesso). */
  clearDraft: () => void;
}

/**
 * Persiste o estado de um `react-hook-form` no localStorage com debounce.
 *
 * Por que: forms longos (ex.: cadastro de imóvel) eram perdidos quando o
 * token JWT expirava no meio do trabalho. Mesmo com o refresh proativo
 * agora resolvendo a causa raiz, este autosave é defesa em profundidade
 *, cobre crash do browser, kernel panic, queda de luz, fechar a aba
 * sem querer, etc.
 *
 * Fora do escopo: arquivos (File/Blob). Quem usa precisa garantir que os
 * campos serializem em JSON.
 */
export function useFormAutosave<T extends FieldValues>({
  key,
  watch,
  reset,
  debounceMs = 2000,
  exclude = [],
}: UseFormAutosaveOptions<T>): UseFormAutosaveResult {
  const storageKey = PREFIX + key;
  const [hasDraft, setHasDraft] = useState(false);
  const [draftAgeMs, setDraftAgeMs] = useState(0);
  const restoredRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  // Mount: detecta rascunho existente.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed: StoredDraft<T> = JSON.parse(raw);
      const age = Date.now() - (parsed.savedAt ?? 0);
      if (age > MAX_AGE_MS) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      setHasDraft(true);
      setDraftAgeMs(age);
    } catch {
      // JSON corrompido, limpa pra evitar travar o boot do form.
      try { window.localStorage.removeItem(storageKey); } catch {}
    }
  }, [storageKey]);

  // Save com debounce. Subscribe direto ao watch() de RHF.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sub = watch((values) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        try {
          const sanitized: Record<string, unknown> = { ...(values as Record<string, unknown>) };
          for (const k of exclude) {
            delete sanitized[k as string];
          }
          const payload: StoredDraft<T> = {
            values: sanitized as T,
            savedAt: Date.now(),
          };
          window.localStorage.setItem(storageKey, JSON.stringify(payload));
        } catch {
          // QuotaExceededError, modo anônimo, etc, silenciar é melhor que
          // crashar o form. Pior caso: usuário perde rascunho de browser-crash.
        }
      }, debounceMs);
    });
    return () => {
      sub.unsubscribe();
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // exclude é estável na prática (array literal); incluir nas deps causaria
    // resubscribe a cada render. Confiamos no contrato do chamador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch, storageKey, debounceMs]);

  function restoreDraft() {
    if (typeof window === "undefined" || restoredRef.current) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed: StoredDraft<T> = JSON.parse(raw);
      reset(parsed.values, { keepDefaultValues: false });
      restoredRef.current = true;
    } catch {}
    setHasDraft(false);
  }

  function discardDraft() {
    if (typeof window === "undefined") return;
    try { window.localStorage.removeItem(storageKey); } catch {}
    setHasDraft(false);
  }

  function clearDraft() {
    if (typeof window === "undefined") return;
    try { window.localStorage.removeItem(storageKey); } catch {}
    setHasDraft(false);
  }

  return { hasDraft, draftAgeMs, restoreDraft, discardDraft, clearDraft };
}
