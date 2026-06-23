import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FavoritoButton } from "@/components/imoveis/FavoritoButton";

const STORAGE_KEY = "mora_favoritos";

describe("FavoritoButton", () => {
  const sendBeacon = vi.fn((_url: string, _data?: BodyInit) => true);

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    sendBeacon.mockClear();
    vi.stubGlobal("navigator", { sendBeacon });
  });

  it("começa inativo quando o código não está em localStorage", async () => {
    render(<FavoritoButton codigo="MB-00001" variant="pill" />);
    const btn = await screen.findByRole("button", { name: /favoritar/i });
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  it("começa ativo quando o código já está salvo", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["MB-00001"]));
    render(<FavoritoButton codigo="MB-00001" variant="pill" />);
    const btn = await screen.findByRole("button", { name: /favorito/i });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("toggle adiciona ao localStorage e dispara beacon com acao=add", async () => {
    render(<FavoritoButton codigo="MB-00001" variant="pill" />);
    const btn = await screen.findByRole("button", { name: /favoritar/i });
    fireEvent.click(btn);

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      expect(saved).toContain("MB-00001");
    });
    expect(sendBeacon).toHaveBeenCalledOnce();
    const blob = sendBeacon.mock.calls[0][1] as Blob;
    const payload = JSON.parse(await blob.text());
    expect(payload.acao).toBe("add");
    expect(payload.imovel_codigo).toBe("MB-00001");
  });

  it("segundo toggle remove do localStorage e envia acao=remove", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["MB-00001"]));
    render(<FavoritoButton codigo="MB-00001" variant="pill" />);
    const btn = await screen.findByRole("button", { name: /favorito/i });
    fireEvent.click(btn);

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      expect(saved).not.toContain("MB-00001");
    });
    const blob = sendBeacon.mock.calls[0][1] as Blob;
    const payload = JSON.parse(await blob.text());
    expect(payload.acao).toBe("remove");
  });

  it("não afeta favoritos de outros imóveis", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["MB-00099"]));
    render(<FavoritoButton codigo="MB-00001" variant="pill" />);
    const btn = await screen.findByRole("button", { name: /favoritar/i });
    fireEvent.click(btn);
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      expect(saved).toEqual(expect.arrayContaining(["MB-00099", "MB-00001"]));
    });
  });
});
