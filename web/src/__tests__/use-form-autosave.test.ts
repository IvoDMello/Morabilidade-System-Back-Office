import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useFormAutosave } from "@/lib/use-form-autosave";

// O hook depende de react-hook-form só pelos tipos de watch/reset. Nos testes
// passamos um watch falso que captura o callback de subscribe e um reset spy.

const STORAGE_KEY = "morabilidade-draft:imovel:novo";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface FakeWatch {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch: any;
  emit: (values: Record<string, unknown>) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

function makeWatch(): FakeWatch {
  let cb: ((values: Record<string, unknown>) => void) | null = null;
  const unsubscribe = vi.fn();
  const watch = vi.fn((fn: (values: Record<string, unknown>) => void) => {
    cb = fn;
    return { unsubscribe };
  });
  return {
    watch,
    emit: (values) => cb?.(values),
    unsubscribe,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useFormAutosave — detecção de rascunho no mount", () => {
  it("hasDraft false quando não há nada salvo", () => {
    const { watch } = makeWatch();
    const { result } = renderHook(() =>
      useFormAutosave({ key: "imovel:novo", watch, reset: vi.fn() })
    );
    expect(result.current.hasDraft).toBe(false);
  });

  it("detecta rascunho recente e expõe a idade", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ values: { titulo: "x" }, savedAt: Date.now() - 5000 })
    );
    const { watch } = makeWatch();
    const { result } = renderHook(() =>
      useFormAutosave({ key: "imovel:novo", watch, reset: vi.fn() })
    );
    expect(result.current.hasDraft).toBe(true);
    expect(result.current.draftAgeMs).toBeGreaterThanOrEqual(5000);
  });

  it("descarta e ignora rascunho mais velho que 24h", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ values: { titulo: "x" }, savedAt: Date.now() - MAX_AGE_MS - 1000 })
    );
    const { watch } = makeWatch();
    const { result } = renderHook(() =>
      useFormAutosave({ key: "imovel:novo", watch, reset: vi.fn() })
    );
    expect(result.current.hasDraft).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("limpa rascunho com JSON corrompido sem quebrar", () => {
    localStorage.setItem(STORAGE_KEY, "{ nao é json");
    const { watch } = makeWatch();
    const { result } = renderHook(() =>
      useFormAutosave({ key: "imovel:novo", watch, reset: vi.fn() })
    );
    expect(result.current.hasDraft).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("useFormAutosave — salvamento com debounce", () => {
  it("persiste valores após o debounce", () => {
    const { watch, emit } = makeWatch();
    renderHook(() =>
      useFormAutosave({ key: "imovel:novo", watch, reset: vi.fn(), debounceMs: 2000 })
    );

    act(() => emit({ titulo: "Apê na Glória" }));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull(); // ainda no debounce

    act(() => vi.advanceTimersByTime(2000));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.values.titulo).toBe("Apê na Glória");
    expect(typeof stored.savedAt).toBe("number");
  });

  it("não salva campos listados em exclude", () => {
    const { watch, emit } = makeWatch();
    renderHook(() =>
      useFormAutosave({
        key: "imovel:novo",
        watch,
        reset: vi.fn(),
        exclude: ["senha"],
      })
    );

    act(() => emit({ titulo: "ok", senha: "segredo" }));
    act(() => vi.advanceTimersByTime(2000));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.values.titulo).toBe("ok");
    expect(stored.values.senha).toBeUndefined();
  });
});

describe("useFormAutosave — restore / discard / clear", () => {
  it("restoreDraft aplica os valores via reset e zera hasDraft", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ values: { titulo: "salvo" }, savedAt: Date.now() })
    );
    const reset = vi.fn();
    const { watch } = makeWatch();
    const { result } = renderHook(() =>
      useFormAutosave({ key: "imovel:novo", watch, reset })
    );

    act(() => result.current.restoreDraft());
    expect(reset).toHaveBeenCalledWith({ titulo: "salvo" }, { keepDefaultValues: false });
    expect(result.current.hasDraft).toBe(false);
  });

  it("discardDraft remove o rascunho sem chamar reset", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ values: { titulo: "salvo" }, savedAt: Date.now() })
    );
    const reset = vi.fn();
    const { watch } = makeWatch();
    const { result } = renderHook(() =>
      useFormAutosave({ key: "imovel:novo", watch, reset })
    );

    act(() => result.current.discardDraft());
    expect(reset).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.hasDraft).toBe(false);
  });

  it("clearDraft remove o rascunho persistido", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ values: { titulo: "salvo" }, savedAt: Date.now() })
    );
    const { watch } = makeWatch();
    const { result } = renderHook(() =>
      useFormAutosave({ key: "imovel:novo", watch, reset: vi.fn() })
    );

    act(() => result.current.clearDraft());
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("cancela a subscription do watch ao desmontar", () => {
    const { watch, unsubscribe } = makeWatch();
    const { unmount } = renderHook(() =>
      useFormAutosave({ key: "imovel:novo", watch, reset: vi.fn() })
    );
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
