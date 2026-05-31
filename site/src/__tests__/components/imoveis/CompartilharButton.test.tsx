import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CompartilharButton } from "@/components/imoveis/CompartilharButton";

describe("CompartilharButton", () => {
  const sendBeacon = vi.fn(() => true);

  beforeEach(() => {
    sendBeacon.mockClear();
    // Sem navigator.share por padrão — força o fallback dropdown.
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("window", Object.assign(window, { open: vi.fn() }));
  });

  it("abre dropdown com WhatsApp e Copiar link quando navigator.share não existe", () => {
    render(<CompartilharButton codigo="MB-00001" titulo="Apto Ipanema" />);
    fireEvent.click(screen.getByRole("button", { name: /compartilhar/i }));
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText(/copiar link/i)).toBeInTheDocument();
  });

  it("clique em WhatsApp envia beacon com canal=whatsapp e abre wa.me", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<CompartilharButton codigo="MB-00001" titulo="Apto Ipanema" />);
    fireEvent.click(screen.getByRole("button", { name: /compartilhar/i }));
    fireEvent.click(screen.getByText("WhatsApp"));

    expect(openSpy).toHaveBeenCalled();
    expect(openSpy.mock.calls[0][0]).toMatch(/wa\.me/);
    expect(sendBeacon).toHaveBeenCalledOnce();
    const payload = JSON.parse(await (sendBeacon.mock.calls[0][1] as Blob).text());
    expect(payload.canal).toBe("whatsapp");
    expect(payload.imovel_codigo).toBe("MB-00001");
  });

  it("clique em Copiar link envia beacon com canal=copy_link", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { sendBeacon, clipboard: { writeText } });

    render(<CompartilharButton codigo="MB-00001" titulo="Apto Ipanema" />);
    fireEvent.click(screen.getByRole("button", { name: /compartilhar/i }));
    fireEvent.click(screen.getByText(/copiar link/i));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toMatch(/\/imoveis\/MB-00001/);
    await waitFor(() => expect(sendBeacon).toHaveBeenCalledOnce());
    const payload = JSON.parse(await (sendBeacon.mock.calls[0][1] as Blob).text());
    expect(payload.canal).toBe("copy_link");
  });

  it("usa navigator.share quando disponível e marca canal=web_share", async () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { sendBeacon, share });

    render(<CompartilharButton codigo="MB-00001" titulo="Apto Ipanema" />);
    fireEvent.click(screen.getByRole("button", { name: /compartilhar/i }));

    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    await waitFor(() => expect(sendBeacon).toHaveBeenCalledOnce());
    const payload = JSON.parse(await (sendBeacon.mock.calls[0][1] as Blob).text());
    expect(payload.canal).toBe("web_share");
  });

  it("cancelamento do share nativo não dispara evento", async () => {
    const share = vi.fn(() => Promise.reject(new Error("AbortError")));
    vi.stubGlobal("navigator", { sendBeacon, share });

    render(<CompartilharButton codigo="MB-00001" titulo="Apto Ipanema" />);
    fireEvent.click(screen.getByRole("button", { name: /compartilhar/i }));

    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
