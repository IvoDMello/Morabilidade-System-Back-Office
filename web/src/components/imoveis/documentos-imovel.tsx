"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  Trash2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  FLAGS_DOCUMENTO,
  TIPOS_DOCUMENTO,
  TIPO_DOCUMENTO_LABEL,
  tipoPeloNomeDoArquivo,
} from "@/lib/documentos-imovel";
import type { DocumentoImovel, TipoDocumentoImovel } from "@/types";

interface Props {
  imovelId: string;
}

// "auto": cada arquivo pega o tipo pelo próprio nome ("IPTU Sambaíba.jpg" vira
// IPTU), e o que o nome não disser entra como Outro. Corrige-se depois na linha.
type TipoEnvio = TipoDocumentoImovel | "auto";

export function DocumentosImovel({ imovelId }: Props) {
  const isAdmin = useAuthStore((s) => (s.user?.perfil === "admin" || s.user?.perfil === "corretor"));
  const [documentos, setDocumentos] = useState<DocumentoImovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [progressoEnvio, setProgressoEnvio] = useState<{ atual: number; total: number } | null>(null);
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoEnvio>("auto");
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [deletando, setDeletando] = useState<DocumentoImovel | null>(null);
  const [deletandoLoading, setDeletandoLoading] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  const buscar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<DocumentoImovel[]>(`/imoveis/${imovelId}/documentos`);
      setDocumentos(res.data);
    } catch {
      toast.error("Erro ao carregar documentos.");
    } finally {
      setLoading(false);
    }
  }, [imovelId]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const TIPOS_ACEITOS = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const TAMANHO_MAX = 10 * 1024 * 1024;

  async function enviarArquivos(arquivos: File[]) {
    if (arquivos.length === 0) return;
    setEnviando(true);
    let enviados = 0;
    const erros: string[] = [];
    try {
      for (let i = 0; i < arquivos.length; i++) {
        const arquivo = arquivos[i];
        setProgressoEnvio({ atual: i + 1, total: arquivos.length });
        if (arquivo.size > TAMANHO_MAX) {
          erros.push(`${arquivo.name}: excede 10 MB`);
          continue;
        }
        if (arquivo.type && !TIPOS_ACEITOS.includes(arquivo.type)) {
          erros.push(`${arquivo.name}: tipo não permitido`);
          continue;
        }
        try {
          const tipo =
            tipoSelecionado === "auto"
              ? tipoPeloNomeDoArquivo(arquivo.name) ?? "outro"
              : tipoSelecionado;
          const form = new FormData();
          form.append("file", arquivo);
          form.append("tipo", tipo);
          await api.post(`/imoveis/${imovelId}/documentos`, form, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          enviados++;
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
            "erro ao enviar";
          erros.push(`${arquivo.name}: ${msg}`);
        }
      }
      if (enviados > 0) {
        toast.success(
          enviados === 1 ? "Documento enviado." : `${enviados} documentos enviados.`
        );
        buscar();
      }
      erros.forEach((e) => toast.error(e));
    } finally {
      setEnviando(false);
      setProgressoEnvio(null);
      if (inputFileRef.current) inputFileRef.current.value = "";
    }
  }

  async function handleSelecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    if (arquivos.length === 0) return;
    await enviarArquivos(arquivos);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    if (!isAdmin || enviando) return;
    const arquivos = Array.from(e.dataTransfer.files ?? []);
    if (arquivos.length > 0) enviarArquivos(arquivos);
  }

  async function trocarTipo(doc: DocumentoImovel, tipo: TipoDocumentoImovel) {
    if (tipo === doc.tipo) return;
    // Otimista: a flag muda na hora e volta se a API recusar.
    setDocumentos((ds) => ds.map((d) => (d.id === doc.id ? { ...d, tipo } : d)));
    try {
      await api.patch(`/imoveis/${imovelId}/documentos/${doc.id}`, { tipo });
    } catch {
      setDocumentos((ds) => ds.map((d) => (d.id === doc.id ? { ...d, tipo: doc.tipo } : d)));
      toast.error("Erro ao trocar a flag do documento.");
    }
  }

  async function handleDeletar() {
    if (!deletando) return;
    setDeletandoLoading(true);
    try {
      await api.delete(`/imoveis/${imovelId}/documentos/${deletando.id}`);
      toast.success("Documento removido.");
      setDeletando(null);
      buscar();
    } catch {
      toast.error("Erro ao remover documento.");
    } finally {
      setDeletandoLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Documentos internos</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Uso interno, não aparece no site. PDF, JPG, PNG, DOC ou DOCX · máx 10 MB.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <select
              value={tipoSelecionado}
              onChange={(e) => setTipoSelecionado(e.target.value as TipoEnvio)}
              aria-label="Flag dos arquivos enviados"
              className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30"
            >
              <option value="auto">Flag pelo nome do arquivo</option>
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <label
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-lg cursor-pointer hover:opacity-90 transition disabled:opacity-60"
              style={{ backgroundColor: "#585a4f" }}
            >
              {enviando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {enviando
                ? progressoEnvio && progressoEnvio.total > 1
                  ? `Enviando ${progressoEnvio.atual}/${progressoEnvio.total}...`
                  : "Enviando..."
                : "Enviar arquivos"}
              <input
                ref={inputFileRef}
                type="file"
                multiple
                onChange={handleSelecionarArquivo}
                disabled={enviando}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {!loading && <FlagsDocumentos documentos={documentos} />}

      {isAdmin && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!enviando) setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={handleDrop}
          onClick={() => !enviando && inputFileRef.current?.click()}
          className={`mx-5 my-4 px-4 py-6 border-2 border-dashed rounded-lg text-center text-xs transition cursor-pointer ${
            arrastando
              ? "border-[#585a4f] bg-[#585a4f]/5 text-[#585a4f]"
              : "border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50/60"
          } ${enviando ? "opacity-60 pointer-events-none" : ""}`}
        >
          <Upload className="w-5 h-5 mx-auto mb-1.5" />
          {arrastando
            ? "Solte para enviar"
            : "Arraste arquivos aqui ou clique para selecionar"}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-sm">Carregando documentos...</div>
      ) : documentos.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm">
          Nenhum documento enviado.
        </div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {documentos.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition">
              <IconePorMime mime={d.mime_type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{d.nome_arquivo}</p>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
                  <IconeDaFlag tipo={d.tipo} />
                  {isAdmin ? (
                    <select
                      value={d.tipo}
                      onChange={(e) => trocarTipo(d, e.target.value as TipoDocumentoImovel)}
                      aria-label={`Flag de ${d.nome_arquivo}`}
                      className="py-0.5 pl-1.5 pr-1 text-xs border border-slate-200 rounded-md bg-white text-slate-600 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30"
                    >
                      {TIPOS_DOCUMENTO.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{TIPO_DOCUMENTO_LABEL[d.tipo]}</span>
                  )}
                  <span>· {formatarTamanho(d.tamanho_bytes)} · {formatarData(d.created_at)}</span>
                </div>
              </div>
              {d.url && (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                  title="Abrir / baixar"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              {isAdmin && (
                <button
                  onClick={() => setDeletando(d)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deletando}
        onOpenChange={(o) => {
          if (!o) setDeletando(null);
        }}
        title="Remover documento"
        description={`Remover "${deletando?.nome_arquivo ?? ""}"? Esta ação não pode ser desfeita.`}
        loading={deletandoLoading}
        onConfirm={handleDeletar}
      />
    </div>
  );
}

// Faixa com as 5 flags: acesa quando há documento ligado a ela, apagada
// (tracejada) quando falta, para o corretor ver de cara o que ainda não juntou.
function FlagsDocumentos({ documentos }: { documentos: DocumentoImovel[] }) {
  return (
    <div className="flex flex-wrap gap-2 px-5 pt-4" aria-label="Documentos por flag">
      {FLAGS_DOCUMENTO.map(({ tipo, label, Icone }) => {
        const qtd = documentos.filter((d) => d.tipo === tipo).length;
        const tem = qtd > 0;
        return (
          <span
            key={tipo}
            title={
              tem
                ? `${label}: ${qtd === 1 ? "1 documento anexado" : `${qtd} documentos anexados`}`
                : `${label}: nenhum documento anexado`
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              tem
                ? "border-[#585a4f]/30 bg-[#585a4f]/10 text-[#585a4f]"
                : "border-dashed border-slate-200 text-slate-400"
            }`}
          >
            <Icone className="w-3.5 h-3.5" />
            {label}
            {qtd > 1 && <span className="opacity-70">({qtd})</span>}
          </span>
        );
      })}
    </div>
  );
}

function IconeDaFlag({ tipo }: { tipo: TipoDocumentoImovel }) {
  const flag = FLAGS_DOCUMENTO.find((f) => f.tipo === tipo);
  if (!flag) return null;
  return <flag.Icone className="w-3.5 h-3.5 text-[#585a4f] flex-shrink-0" aria-hidden />;
}

function IconePorMime({ mime }: { mime?: string }) {
  if (!mime) return <File className="w-5 h-5 text-slate-300 flex-shrink-0" />;
  if (mime.startsWith("image/"))
    return <ImageIcon className="w-5 h-5 text-emerald-500 flex-shrink-0" />;
  if (mime === "application/pdf")
    return <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />;
  return <File className="w-5 h-5 text-slate-400 flex-shrink-0" />;
}

function formatarTamanho(bytes?: number) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}
