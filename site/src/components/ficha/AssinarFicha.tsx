"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Check, Download, ShieldCheck, FileSignature, AlertCircle,
} from "lucide-react";
import {
  getFichaPublica, assinarFicha, fichaPdfUrl, type FichaPublica,
} from "@/lib/api";
import { capturarGeo } from "@/lib/geo";
import { formatarMoeda } from "@/lib/utils";
import { SignaturePad, type SignaturePadHandle } from "@/components/assinatura/SignaturePad";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; tipo: "nao_encontrada" | "indisponivel" | "erro" }
  | { fase: "assinar"; ficha: FichaPublica }
  | { fase: "assinada"; ficha: FichaPublica };

export function AssinarFicha({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });

  useEffect(() => {
    let vivo = true;
    getFichaPublica(token)
      .then((ficha) => {
        if (!vivo) return;
        setEstado(
          ficha.status === "assinada"
            ? { fase: "assinada", ficha }
            : { fase: "assinar", ficha },
        );
      })
      .catch((err: Error) => {
        if (!vivo) return;
        const tipo = (err.message === "nao_encontrada" || err.message === "indisponivel")
          ? err.message : "erro";
        setEstado({ fase: "erro", tipo });
      });
    return () => { vivo = false; };
  }, [token]);

  return (
    <main className="min-h-screen bg-[#f7f6f2] py-6 px-4 flex flex-col items-center">
      <div className="w-full max-w-lg">
        <Cabecalho />
        {estado.fase === "carregando" && <Carregando />}
        {estado.fase === "erro" && <Erro tipo={estado.tipo} />}
        {estado.fase === "assinada" && <Confirmacao token={token} />}
        {estado.fase === "assinar" && (
          <Formulario
            token={token}
            ficha={estado.ficha}
            onAssinada={(ficha) => setEstado({ fase: "assinada", ficha })}
          />
        )}
      </div>
    </main>
  );
}

function Cabecalho() {
  return (
    <div className="flex items-center gap-2 mb-4 text-[#585a4f]">
      <FileSignature className="w-5 h-5" />
      <div>
        <p className="font-semibold leading-tight">MORABILIDADE</p>
        <p className="text-[11px] text-[#7a7c72]">Ficha / Termo de Visita a Imóvel</p>
      </div>
    </div>
  );
}

function Carregando() {
  return (
    <div className="bg-white rounded-2xl border border-[#e4e1d6] p-8 flex items-center justify-center gap-2 text-[#7a7c72]">
      <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
    </div>
  );
}

function Erro({ tipo }: { tipo: "nao_encontrada" | "indisponivel" | "erro" }) {
  const msg = tipo === "nao_encontrada"
    ? "Este link de assinatura é inválido."
    : tipo === "indisponivel"
      ? "Esta ficha foi cancelada ou o link expirou."
      : "Não foi possível carregar a ficha. Tente novamente em instantes.";
  return (
    <div className="bg-white rounded-2xl border border-[#e4e1d6] p-8 text-center">
      <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
      <p className="text-slate-700">{msg}</p>
    </div>
  );
}

function Confirmacao({ token }: { token: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e4e1d6] p-8 text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-emerald-50">
        <Check className="w-8 h-8 text-emerald-600" />
      </div>
      <h2 className="text-xl font-semibold text-slate-800">Ficha assinada!</h2>
      <p className="text-[#7a7c72] mt-2 text-sm">
        Tudo certo. Uma cópia ficou registrada com a Morabilidade. Você pode baixar
        o documento assinado abaixo.
      </p>
      <a
        href={fichaPdfUrl(token)}
        className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
        style={{ backgroundColor: "#585a4f" }}
      >
        <Download className="w-4 h-4" /> Baixar PDF assinado
      </a>
    </div>
  );
}

// ── Formulário de assinatura ─────────────────────────────────────────────────

function Formulario({
  token, ficha, onAssinada,
}: {
  token: string;
  ficha: FichaPublica;
  onAssinada: (f: FichaPublica) => void;
}) {
  const [cpf, setCpf] = useState("");
  const [aceite, setAceite] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const [temTraco, setTemTraco] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);
  // Captura a geo em segundo plano assim que a tela abre, pra não atrasar o
  // clique em "Assinar". Se o usuário ignorar o prompt, ficamos só com null.
  const geoRef = useRef<string | null>(null);
  useEffect(() => {
    capturarGeo().then((g) => { geoRef.current = g; });
  }, []);

  const cpfDigitos = cpf.replace(/\D/g, "");

  async function assinar() {
    if (assinando) return;
    if (cpfDigitos.length < 11) { toast.error("Preencha o CPF antes de assinar."); return; }
    if (!temTraco) { toast.error("Desenhe sua assinatura no campo acima."); return; }
    if (!aceite) { toast.error("Marque a caixa de aceite para continuar."); return; }
    setAssinando(true);
    try {
      // Usa a geo já capturada em segundo plano (pode ser null) — sem espera.
      const fichaAtualizada = await assinarFicha(token, {
        aceite: true,
        cpf: cpf.trim(),
        assinatura_png: padRef.current?.toDataURL() ?? null,
        geo: geoRef.current,
      });
      toast.success("Ficha assinada com sucesso!");
      onAssinada(fichaAtualizada);
    } catch (err) {
      toast.error((err as Error).message ?? "Não foi possível assinar.");
    } finally {
      setAssinando(false);
    }
  }

  const endereco = ficha.imovel_endereco ?? "Imóvel";
  const localidade = [ficha.imovel_bairro, ficha.imovel_cidade].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      {/* Resumo do imóvel */}
      <div className="bg-white rounded-2xl border border-[#e4e1d6] overflow-hidden">
        <div className="px-5 py-3" style={{ backgroundColor: "#585a4f" }}>
          <p className="text-[#d8cb6a] text-[11px] font-semibold tracking-wide">DADOS DO IMÓVEL</p>
        </div>
        <div className="p-5 space-y-2">
          <p className="font-semibold text-slate-800 leading-snug">{endereco}</p>
          {localidade && <p className="text-sm text-[#7a7c72]">{localidade}</p>}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm pt-1">
            {ficha.imovel_codigo && (
              <span className="text-[#7a7c72]">Código: <strong className="text-slate-700">{ficha.imovel_codigo}</strong></span>
            )}
            {typeof ficha.imovel_valor === "number" && (
              <span className="text-[#7a7c72]">Valor: <strong className="text-slate-700">{formatarMoeda(ficha.imovel_valor)}</strong></span>
            )}
          </div>
          {ficha.corretor_nome && (
            <p className="text-xs text-[#7a7c72] pt-1">
              Corretor: {ficha.corretor_nome}
              {ficha.corretor_creci ? ` · ${ficha.corretor_creci}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Declaração */}
      <div className="bg-white rounded-2xl border border-[#e4e1d6] p-5">
        <p className="text-[11px] font-semibold tracking-wide text-[#585a4f] mb-2">DECLARAÇÃO DO VISITANTE</p>
        <p className="text-[13px] leading-relaxed text-slate-600 whitespace-pre-line">{ficha.clausula_texto}</p>
      </div>

      {/* Assinatura */}
      <div className="bg-white rounded-2xl border border-[#e4e1d6] p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Visitante</label>
          <input
            value={ficha.visitante_nome}
            disabled
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Seu CPF *</label>
          <input
            inputMode="numeric"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 focus:border-transparent"
          />
        </div>

        <SignaturePad ref={padRef} onInkChange={setTemTraco} />

        {/* Aceite */}
        <label className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={aceite}
            onChange={(e) => setAceite(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#585a4f]"
          />
          <span>Li e estou de acordo com a declaração acima e autorizo o tratamento dos meus dados (LGPD).</span>
        </label>

        <button
          type="button"
          onClick={assinar}
          disabled={assinando}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#585a4f" }}
        >
          {assinando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {assinando ? "Assinando…" : "Assinar eletronicamente"}
        </button>

        <p className="text-[11px] text-[#7a7c72] text-center leading-relaxed">
          Assinatura eletrônica nos termos do art. 107 do Código Civil e da Lei nº 14.063/2020.
          Registramos data, hora e IP como comprovação.
        </p>
      </div>
    </div>
  );
}
