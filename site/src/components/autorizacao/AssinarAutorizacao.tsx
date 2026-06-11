"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, MapPin, Check, Download, ShieldCheck, Stamp, AlertCircle, Clock, Users,
} from "lucide-react";
import {
  getAutorizacaoPublica, assinarAutorizacao, autorizacaoPdfUrl, type AutorizacaoPublica,
} from "@/lib/api";
import { formatarMoeda } from "@/lib/utils";
import { SignaturePad, type SignaturePadHandle } from "@/components/assinatura/SignaturePad";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; tipo: "nao_encontrada" | "indisponivel" | "erro" }
  | { fase: "assinar"; auth: AutorizacaoPublica }
  // Este signatário já assinou, mas ainda faltam outros proprietários.
  | { fase: "aguardando"; auth: AutorizacaoPublica }
  | { fase: "assinada"; auth: AutorizacaoPublica };

function faseDe(auth: AutorizacaoPublica): Estado {
  if (auth.status === "assinada") return { fase: "assinada", auth };
  if (auth.ja_assinou) return { fase: "aguardando", auth };
  return { fase: "assinar", auth };
}

const NEGOCIO: Record<AutorizacaoPublica["tipo_negocio"], string> = {
  venda: "Venda", locacao: "Locação", ambos: "Venda e/ou locação",
};

export function AssinarAutorizacao({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });

  useEffect(() => {
    let vivo = true;
    getAutorizacaoPublica(token)
      .then((auth) => {
        if (!vivo) return;
        setEstado(faseDe(auth));
      })
      .catch((err: Error) => {
        if (!vivo) return;
        const tipo = (err.message === "nao_encontrada" || err.message === "indisponivel") ? err.message : "erro";
        setEstado({ fase: "erro", tipo });
      });
    return () => { vivo = false; };
  }, [token]);

  return (
    <main className="min-h-screen bg-[#f7f6f2] py-6 px-4 flex flex-col items-center">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2 mb-4 text-[#585a4f]">
          <Stamp className="w-5 h-5" />
          <div>
            <p className="font-semibold leading-tight">MORABILIDADE</p>
            <p className="text-[11px] text-[#7a7c72]">Autorização de Intermediação Imobiliária</p>
          </div>
        </div>
        {estado.fase === "carregando" && <Carregando />}
        {estado.fase === "erro" && <Erro tipo={estado.tipo} />}
        {estado.fase === "assinada" && <Confirmacao token={token} />}
        {estado.fase === "aguardando" && <AguardandoDemais auth={estado.auth} />}
        {estado.fase === "assinar" && (
          <Formulario token={token} auth={estado.auth} onAssinada={(auth) => setEstado(faseDe(auth))} />
        )}
      </div>
    </main>
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
      ? "Esta autorização foi cancelada ou o link expirou."
      : "Não foi possível carregar a autorização. Tente novamente em instantes.";
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
      <h2 className="text-xl font-semibold text-slate-800">Autorização assinada!</h2>
      <p className="text-[#7a7c72] mt-2 text-sm">
        Tudo certo. Uma cópia ficou registrada com a Morabilidade. Você pode baixar o documento assinado abaixo.
      </p>
      <a
        href={autorizacaoPdfUrl(token)}
        className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
        style={{ backgroundColor: "#585a4f" }}
      >
        <Download className="w-4 h-4" /> Baixar PDF assinado
      </a>
    </div>
  );
}

function AguardandoDemais({ auth }: { auth: AutorizacaoPublica }) {
  const signatarios = auth.signatarios ?? [];
  const pendentes = signatarios.filter((s) => !s.assinou);
  return (
    <div className="bg-white rounded-2xl border border-[#e4e1d6] p-8 text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-emerald-50">
        <Check className="w-8 h-8 text-emerald-600" />
      </div>
      <h2 className="text-xl font-semibold text-slate-800">Sua assinatura foi registrada!</h2>
      <p className="text-[#7a7c72] mt-2 text-sm">
        Falta a assinatura de {pendentes.length === 1 ? "1 proprietário" : `${pendentes.length} proprietários`}.
        Assim que todos assinarem, o documento final fica disponível para download.
      </p>
      <ul className="mt-4 text-sm text-left max-w-xs mx-auto space-y-1.5">
        {signatarios.map((s) => (
          <li key={s.nome} className="flex items-center gap-2">
            {s.assinou
              ? <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              : <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />}
            <span className="text-slate-700 truncate">{s.nome}</span>
            <span className="text-xs text-[#7a7c72] ml-auto">{s.assinou ? "assinou" : "pendente"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-[#7a7c72]">{label}</span>
      <span className="text-slate-700 font-medium text-right">{valor}</span>
    </div>
  );
}

function Formulario({
  token, auth, onAssinada,
}: {
  token: string;
  auth: AutorizacaoPublica;
  onAssinada: (a: AutorizacaoPublica) => void;
}) {
  const [cpf, setCpf] = useState("");
  const [aceite, setAceite] = useState(false);
  const [geo, setGeo] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "carregando" | "ok" | "erro">("idle");
  const [assinando, setAssinando] = useState(false);
  const [temTraco, setTemTraco] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  const capturarGeo = useCallback(() => {
    if (!("geolocation" in navigator)) { setGeoStatus("erro"); return; }
    setGeoStatus("carregando");
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeo(`${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`); setGeoStatus("ok"); },
      () => setGeoStatus("erro"),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, []);

  const cpfDigitos = cpf.replace(/\D/g, "");
  const podeAssinar = aceite && cpfDigitos.length >= 11 && temTraco && !assinando;

  async function assinar() {
    if (!podeAssinar) return;
    setAssinando(true);
    try {
      const atualizada = await assinarAutorizacao(token, {
        aceite: true,
        cpf: cpf.trim(),
        assinatura_png: padRef.current?.toDataURL() ?? null,
        geo,
      });
      toast.success("Autorização assinada com sucesso!");
      onAssinada(atualizada);
    } catch (err) {
      toast.error((err as Error).message ?? "Não foi possível assinar.");
    } finally {
      setAssinando(false);
    }
  }

  const endereco = auth.imovel_endereco ?? "Imóvel";
  const localidade = [auth.imovel_bairro, auth.imovel_cidade].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      {/* Resumo do imóvel + condições */}
      <div className="bg-white rounded-2xl border border-[#e4e1d6] overflow-hidden">
        <div className="px-5 py-3" style={{ backgroundColor: "#585a4f" }}>
          <p className="text-[#d8cb6a] text-[11px] font-semibold tracking-wide">CONDIÇÕES DA INTERMEDIAÇÃO</p>
        </div>
        <div className="p-5 space-y-2">
          <p className="font-semibold text-slate-800 leading-snug">{endereco}</p>
          {localidade && <p className="text-sm text-[#7a7c72]">{localidade}</p>}
          <div className="border-t border-[#e4e1d6] mt-3 pt-3 space-y-1.5">
            <Linha label="Negócio" valor={NEGOCIO[auth.tipo_negocio]} />
            {typeof auth.valor_autorizado === "number" && (
              <Linha label="Valor autorizado" valor={formatarMoeda(auth.valor_autorizado)} />
            )}
            <Linha label="Exclusividade" valor={auth.exclusiva ? "Com exclusividade" : "Sem exclusividade"} />
            {typeof auth.comissao_venda_pct === "number" && (auth.tipo_negocio === "venda" || auth.tipo_negocio === "ambos") && (
              <Linha label="Comissão (venda)" valor={`${String(auth.comissao_venda_pct).replace(".", ",")}%`} />
            )}
            {auth.comissao_locacao_desc && (auth.tipo_negocio === "locacao" || auth.tipo_negocio === "ambos") && (
              <Linha label="Comissão (locação)" valor={auth.comissao_locacao_desc} />
            )}
            <Linha label="Prazo" valor={`${auth.prazo_dias} dias`} />
          </div>
          {auth.corretor_nome && (
            <p className="text-xs text-[#7a7c72] pt-2">
              Corretor: {auth.corretor_nome}{auth.corretor_creci ? ` · ${auth.corretor_creci}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Texto da autorização */}
      <div className="bg-white rounded-2xl border border-[#e4e1d6] p-5">
        <p className="text-[11px] font-semibold tracking-wide text-[#585a4f] mb-2">AUTORIZAÇÃO E DECLARAÇÕES</p>
        <p className="text-[13px] leading-relaxed text-slate-600 whitespace-pre-line">{auth.clausula_texto}</p>
      </div>

      {/* Co-proprietários (quando há mais de um signatário) */}
      {(auth.signatarios ?? []).length > 1 && (
        <div className="bg-white rounded-2xl border border-[#e4e1d6] p-5">
          <p className="text-[11px] font-semibold tracking-wide text-[#585a4f] mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> PROPRIETÁRIOS DESTA AUTORIZAÇÃO
          </p>
          <ul className="space-y-1.5 text-sm">
            {(auth.signatarios ?? []).map((s) => (
              <li key={s.nome} className="flex items-center gap-2">
                {s.assinou
                  ? <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  : <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                <span className="text-slate-700 truncate">
                  {s.nome}{s.nome === auth.signatario_nome ? " (você)" : ""}
                </span>
                <span className="text-xs text-[#7a7c72] ml-auto">{s.assinou ? "assinou" : "pendente"}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-[#7a7c72] mt-2">
            Cada proprietário assina pelo próprio link. O documento fica pronto quando todos assinarem.
          </p>
        </div>
      )}

      {/* Assinatura */}
      <div className="bg-white rounded-2xl border border-[#e4e1d6] p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Proprietário</label>
          <input value={auth.signatario_nome || auth.proprietario_nome} disabled
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-700" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Seu CPF / CNPJ *</label>
          <input inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 focus:border-transparent" />
        </div>

        <SignaturePad ref={padRef} onInkChange={setTemTraco} />

        <button type="button" onClick={capturarGeo}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">
          {geoStatus === "carregando" ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          {geoStatus === "ok" ? "Localização anexada ✓" : geoStatus === "erro" ? "Não foi possível obter a localização" : "Anexar minha localização (opcional)"}
        </button>

        <label className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#585a4f]" />
          <span>Li e estou de acordo com as condições e declarações acima e autorizo o tratamento dos meus dados (LGPD).</span>
        </label>

        <button type="button" onClick={assinar} disabled={!podeAssinar}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#585a4f" }}>
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
