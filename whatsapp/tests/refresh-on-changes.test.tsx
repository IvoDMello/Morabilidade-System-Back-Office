// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import type { WhatsAppMessage } from "@/types/whatsapp";

/**
 * A conversa aberta não pode recarregar a página no servidor a cada 4s: isso
 * estourou a cota de CPU da Vercel e pausou o deploy (11/11/2026). O hook
 * consulta o Supabase pelo navegador e só chama router.refresh() quando o
 * banco mudou.
 */

const { router } = vi.hoisted(() => {
  // O hook lê a fonte de dados ao ser importado.
  process.env.NEXT_PUBLIC_DATA_SOURCE = "supabase";
  return { router: { refresh: vi.fn() } };
});

vi.mock("next/navigation", () => ({ useRouter: () => router }));

type Resposta = { data: unknown[] | null; error: { message: string } | null };

const banco: { conversas: Resposta; mensagens: Resposta } = {
  conversas: { data: [], error: null },
  mensagens: { data: [], error: null },
};
const consultas = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    schema: () => ({
      from: (tabela: string) => {
        consultas(tabela);
        const resposta = () =>
          tabela === "whatsapp_conversations" ? banco.conversas : banco.mensagens;
        const consulta = {
          select: () => consulta,
          eq: () => consulta,
          order: () => consulta,
          limit: () => consulta,
          then: (ok: (r: Resposta) => unknown, erro: (e: unknown) => unknown) =>
            Promise.resolve(resposta()).then(ok, erro),
        };
        return consulta;
      },
    }),
  }),
}));

import { useRefreshOnChanges } from "@/features/whatsapp/use-refresh-on-changes";

function mensagem(id: string, status: WhatsAppMessage["status"]): WhatsAppMessage {
  return { id, conversationId: "conv-1", status } as WhatsAppMessage;
}

const NA_TELA = {
  inboxVersion: "2026-11-11T12:00:00.1+00:00",
  messages: [mensagem("m1", "received"), mensagem("m2", "delivered")],
};

function bancoIgualATela() {
  banco.conversas = { data: [{ updated_at: NA_TELA.inboxVersion }], error: null };
  banco.mensagens = {
    data: [
      { id: "m2", status: "delivered" },
      { id: "m1", status: "received" },
    ],
    error: null,
  };
}

/** Deixa a conferência do mount e `n` ciclos de 4s rodarem. */
async function ciclos(n: number) {
  await vi.advanceTimersByTimeAsync(0);
  for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(4000);
}

beforeEach(() => {
  vi.useFakeTimers();
  router.refresh.mockClear();
  consultas.mockClear();
  bancoIgualATela();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});

describe("useRefreshOnChanges", () => {
  it("não recarrega a página quando nada mudou no banco", async () => {
    renderHook(() => useRefreshOnChanges(NA_TELA));
    await ciclos(10);

    expect(consultas).toHaveBeenCalledWith("whatsapp_conversations");
    expect(consultas).toHaveBeenCalledWith("whatsapp_messages");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("recarrega uma vez quando chega mudança em qualquer conversa", async () => {
    renderHook(() => useRefreshOnChanges(NA_TELA));
    await ciclos(1);
    banco.conversas = { data: [{ updated_at: "2026-11-11T12:05:00+00:00" }], error: null };
    // Mesmo que a tela demore a receber os dados novos, não recarrega de novo
    // para o mesmo estado do banco.
    await ciclos(5);

    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("recarrega quando muda o tique de uma mensagem (entregue → lida)", async () => {
    renderHook(() => useRefreshOnChanges(NA_TELA));
    await ciclos(1);
    banco.mensagens = {
      data: [
        { id: "m2", status: "read" },
        { id: "m1", status: "received" },
      ],
      error: null,
    };
    await ciclos(1);

    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("para de recarregar quando a tela já mostra o estado novo", async () => {
    const { rerender } = renderHook((props) => useRefreshOnChanges(props), {
      initialProps: NA_TELA,
    });
    const novaVersao = "2026-11-11T12:05:00+00:00";
    banco.conversas = { data: [{ updated_at: novaVersao }], error: null };
    await ciclos(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);

    rerender({ ...NA_TELA, inboxVersion: novaVersao });
    await ciclos(5);

    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("se a consulta falhar, ainda atualiza, mas só a cada 30s", async () => {
    banco.conversas = { data: null, error: { message: "rede fora" } };
    renderHook(() => useRefreshOnChanges(NA_TELA));

    await ciclos(6); // 24s
    expect(router.refresh).not.toHaveBeenCalled();

    await ciclos(2); // 32s
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("trata banco vazio como falha (sessão expirada esconde tudo pela RLS)", async () => {
    banco.conversas = { data: [], error: null };
    renderHook(() => useRefreshOnChanges(NA_TELA));

    await ciclos(8);

    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("não consulta nada com a aba escondida", async () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    renderHook(() => useRefreshOnChanges(NA_TELA));

    await ciclos(5);

    expect(consultas).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
