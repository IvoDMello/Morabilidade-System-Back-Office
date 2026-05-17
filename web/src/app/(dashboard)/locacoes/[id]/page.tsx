"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, XCircle, FileDown, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
  LocacaoForm,
  type LocacaoFormData,
} from "@/components/locacoes/locacao-form";
import { PagamentosLocacao } from "@/components/locacoes/pagamentos-locacao";
import { AnexosLocacao } from "@/components/locacoes/anexos-locacao";
import { ReajustesLocacao } from "@/components/locacoes/reajustes-locacao";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContratoLocacao } from "@/types";

export default function EditarContratoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const isAdmin = useAuthStore((s) => s.user?.perfil === "admin");

  const [contrato, setContrato] = useState<ContratoLocacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [rescindindo, setRescindindo] = useState(false);
  const [rescindirOpen, setRescindirOpen] = useState(false);
  const [motivoRescisao, setMotivoRescisao] = useState("");

  // Demonstrativo do mês — default = mês corrente em formato "YYYY-MM"
  const [mesDemonstrativo, setMesDemonstrativo] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const res = await api.get<ContratoLocacao>(`/locacoes/${id}`);
      setContrato(res.data);
    } catch {
      toast.error("Contrato não encontrado.");
      router.push("/locacoes");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleSubmit(data: LocacaoFormData) {
    setSalvando(true);
    try {
      // Backend ignora imovel/proprietario/locatario no PATCH (não permite trocar),
      // mas mandamos só os campos editáveis para evitar 422.
      const {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        imovel_id, proprietario_id, locatario_id,
        ...rest
      } = data;
      const payload = {
        ...rest,
        numero_iptu: rest.numero_iptu || null,
        dados_cobranca_pix: rest.dados_cobranca_pix || null,
        observacoes_demonstrativo: rest.observacoes_demonstrativo || null,
      };
      await api.patch(`/locacoes/${id}`, payload);
      toast.success("Contrato atualizado!");
      carregar();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Erro ao salvar.";
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  }

  async function handleGerarPdf() {
    setGerandoPdf(true);
    try {
      const res = await api.post(
        `/locacoes/${id}/demonstrativo`,
        null,
        { params: { mes: mesDemonstrativo }, responseType: "blob" }
      );
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        extrairNomeArquivo(res.headers["content-disposition"]) ??
        `demonstrativo_${mesDemonstrativo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Demonstrativo gerado.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Erro ao gerar PDF.";
      toast.error(msg);
    } finally {
      setGerandoPdf(false);
    }
  }

  async function handleEnviarEmail() {
    setEnviandoEmail(true);
    try {
      const res = await api.post(
        `/locacoes/${id}/demonstrativo/enviar`,
        null,
        { params: { mes: mesDemonstrativo } }
      );
      toast.success(`Enviado para ${res.data.enviado_para}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Erro ao enviar e-mail.";
      toast.error(msg);
    } finally {
      setEnviandoEmail(false);
    }
  }

  async function handleRescindir() {
    if (!motivoRescisao.trim()) {
      toast.error("Informe o motivo da rescisão.");
      return;
    }
    setRescindindo(true);
    try {
      await api.post(`/locacoes/${id}/rescindir`, {
        motivo_rescisao: motivoRescisao.trim(),
        data_rescisao: new Date().toISOString().slice(0, 10),
      });
      toast.success("Contrato rescindido.");
      setRescindirOpen(false);
      setMotivoRescisao("");
      carregar();
    } catch {
      toast.error("Erro ao rescindir.");
    } finally {
      setRescindindo(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-slate-400 text-sm">
        <div className="w-4 h-4 border-2 border-slate-200 border-t-[#585a4f] rounded-full animate-spin" />
        Carregando contrato...
      </div>
    );
  }

  if (!contrato) return null;

  const defaultValues: Partial<LocacaoFormData> = {
    imovel_id: contrato.imovel_id,
    proprietario_id: contrato.proprietario_id,
    locatario_id: contrato.locatario_id,
    data_inicio: contrato.data_inicio,
    data_fim: contrato.data_fim,
    dia_vencimento: contrato.dia_vencimento,
    aluguel_mensal: Number(contrato.aluguel_mensal),
    condominio_mensal: Number(contrato.condominio_mensal),
    incluir_condominio_cobranca: contrato.incluir_condominio_cobranca,
    fundo_reserva: Number(contrato.fundo_reserva),
    fundo_obra: Number(contrato.fundo_obra),
    incluir_fundo_obra_cobranca: contrato.incluir_fundo_obra_cobranca,
    iptu_anual: Number(contrato.iptu_anual),
    incluir_iptu_cobranca: contrato.incluir_iptu_cobranca,
    numero_iptu: contrato.numero_iptu ?? "",
    dados_cobranca_pix: contrato.dados_cobranca_pix ?? "",
    observacoes_demonstrativo: contrato.observacoes_demonstrativo ?? "",
    taxa_administracao_pct: Number(contrato.taxa_administracao_pct ?? 0),
  };

  // Valor sugerido para próximo pagamento — replica regra do form.
  const valorSugerido =
    Number(contrato.aluguel_mensal) +
    (contrato.incluir_condominio_cobranca ? Number(contrato.condominio_mensal) : 0) +
    (contrato.incluir_fundo_obra_cobranca ? Number(contrato.fundo_obra) : 0) +
    (contrato.incluir_iptu_cobranca ? Number(contrato.iptu_anual) / 10 : 0) -
    Number(contrato.fundo_reserva);

  const podeRescindir =
    isAdmin && contrato.status !== "rescindido" && contrato.status !== "encerrado";

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/locacoes"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {contrato.imovel?.codigo ?? "Contrato"} ·{" "}
              <span className="text-slate-500 font-normal text-lg">
                {contrato.locatario?.nome}
              </span>
            </h1>
            <p className="text-slate-500 text-sm">
              {contrato.imovel?.endereco ?? "—"}
            </p>
          </div>
        </div>
        {podeRescindir && (
          <button
            onClick={() => setRescindirOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 border border-red-200 bg-white rounded-lg hover:bg-red-50 transition"
          >
            <XCircle className="w-4 h-4" />
            Rescindir
          </button>
        )}
      </div>

      {contrato.status === "rescindido" && contrato.motivo_rescisao && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-800">
          <strong>Rescindido</strong>
          {contrato.data_rescisao && ` em ${formatarData(contrato.data_rescisao)}`}.
          <p className="text-xs mt-1 text-red-700">{contrato.motivo_rescisao}</p>
        </div>
      )}

      {isAdmin && contrato.status !== "encerrado" && (
        <div
          className="rounded-xl border border-[#d8cb6a]/40 p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between"
          style={{ backgroundColor: "#fdfaef" }}
        >
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "#585a4f" }}>
              Demonstrativo mensal
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Gera o PDF do mês para envio ao locatário. Cria/atualiza o snapshot do pagamento.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="month"
              value={mesDemonstrativo}
              onChange={(e) => setMesDemonstrativo(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30"
            />
            <button
              onClick={handleGerarPdf}
              disabled={gerandoPdf || !mesDemonstrativo}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition disabled:opacity-60"
              style={{ backgroundColor: "#585a4f" }}
            >
              {gerandoPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              {gerandoPdf ? "Gerando..." : "Gerar PDF"}
            </button>
            <button
              onClick={handleEnviarEmail}
              disabled={enviandoEmail || !mesDemonstrativo}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition disabled:opacity-60"
              style={{ borderColor: "#585a4f", color: "#585a4f" }}
              title="Envia o PDF para o e-mail cadastrado do locatário"
            >
              {enviandoEmail ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              {enviandoEmail ? "Enviando..." : "Enviar por e-mail"}
            </button>
          </div>
        </div>
      )}

      <PagamentosLocacao
        contratoId={contrato.id}
        valorSugerido={Math.max(0, valorSugerido)}
        diaVencimentoPadrao={contrato.dia_vencimento}
      />

      <div className="mt-6">
        <ReajustesLocacao
          contratoId={contrato.id}
          aluguelAtual={Number(contrato.aluguel_mensal)}
          onAplicado={carregar}
        />
      </div>

      <div className="mt-6">
        <AnexosLocacao contratoId={contrato.id} />
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Dados do contrato</h2>
        <LocacaoForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isLoading={salvando}
          submitLabel="Salvar alterações"
        />
      </div>

      <ConfirmDialog
        open={rescindirOpen}
        onOpenChange={(o) => {
          if (!o) {
            setRescindirOpen(false);
            setMotivoRescisao("");
          }
        }}
        title="Rescindir contrato"
        description={
          <div className="space-y-3">
            <p>
              Esta ação marca o contrato como rescindido. O histórico de pagamentos
              é preservado.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Motivo da rescisão
              </label>
              <textarea
                value={motivoRescisao}
                onChange={(e) => setMotivoRescisao(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 focus:border-[#585a4f] resize-none"
                placeholder="Ex: Locatário desocupou antecipadamente"
              />
            </div>
          </div>
        }
        confirmLabel="Rescindir"
        loading={rescindindo}
        onConfirm={handleRescindir}
      />
    </div>
  );
}

function formatarData(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

/** Extrai o nome de arquivo do header Content-Disposition (suporta com aspas). */
function extrairNomeArquivo(header: string | undefined): string | null {
  if (!header) return null;
  const m = /filename="?([^";]+)"?/i.exec(header);
  return m ? m[1] : null;
}
