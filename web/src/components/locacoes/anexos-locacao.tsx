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
import type { AnexoLocacao, TipoAnexoLocacao } from "@/types";

interface Props {
  contratoId: string;
}

const TIPOS: { value: TipoAnexoLocacao; label: string }[] = [
  { value: "contrato", label: "Contrato" },
  { value: "aditivo", label: "Aditivo" },
  { value: "vistoria", label: "Vistoria" },
  { value: "outro", label: "Outro" },
];

const TIPO_LABEL: Record<TipoAnexoLocacao, string> = Object.fromEntries(
  TIPOS.map((t) => [t.value, t.label])
) as Record<TipoAnexoLocacao, string>;

export function AnexosLocacao({ contratoId }: Props) {
  const isAdmin = useAuthStore((s) => (s.user?.perfil === "admin" || s.user?.perfil === "corretor"));
  const [anexos, setAnexos] = useState<AnexoLocacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoAnexoLocacao>("contrato");
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [deletando, setDeletando] = useState<AnexoLocacao | null>(null);
  const [deletandoLoading, setDeletandoLoading] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  const buscar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AnexoLocacao[]>(`/locacoes/${contratoId}/anexos`);
      setAnexos(res.data);
    } catch {
      toast.error("Erro ao carregar anexos.");
    } finally {
      setLoading(false);
    }
  }, [contratoId]);

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

  async function enviarArquivo(arquivo: File) {
    if (arquivo.size > TAMANHO_MAX) {
      toast.error("Arquivo excede 10 MB.");
      return;
    }
    if (arquivo.type && !TIPOS_ACEITOS.includes(arquivo.type)) {
      toast.error("Tipo de arquivo não permitido. Use PDF, JPG, PNG, DOC ou DOCX.");
      return;
    }
    setEnviando(true);
    try {
      const form = new FormData();
      form.append("file", arquivo);
      form.append("tipo", tipoSelecionado);
      await api.post(`/locacoes/${contratoId}/anexos`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Anexo enviado.");
      buscar();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Erro ao enviar arquivo.";
      toast.error(msg);
    } finally {
      setEnviando(false);
      if (inputFileRef.current) inputFileRef.current.value = "";
    }
  }

  async function handleSelecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    await enviarArquivo(arquivo);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    if (!isAdmin || enviando) return;
    const arquivo = e.dataTransfer.files?.[0];
    if (arquivo) enviarArquivo(arquivo);
  }

  async function handleDeletar() {
    if (!deletando) return;
    setDeletandoLoading(true);
    try {
      await api.delete(`/locacoes/anexos/${deletando.id}`);
      toast.success("Anexo removido.");
      setDeletando(null);
      buscar();
    } catch {
      toast.error("Erro ao remover anexo.");
    } finally {
      setDeletandoLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Anexos do contrato</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            PDF, JPG, PNG, DOC ou DOCX · máx 10 MB.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <select
              value={tipoSelecionado}
              onChange={(e) => setTipoSelecionado(e.target.value as TipoAnexoLocacao)}
              className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30"
            >
              {TIPOS.map((t) => (
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
              {enviando ? "Enviando..." : "Enviar arquivo"}
              <input
                ref={inputFileRef}
                type="file"
                onChange={handleSelecionarArquivo}
                disabled={enviando}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

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
            : "Arraste um arquivo aqui ou clique para selecionar"}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-sm">Carregando anexos...</div>
      ) : anexos.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm">
          Nenhum anexo enviado.
        </div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {anexos.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition">
              <IconePorMime mime={a.mime_type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{a.nome_arquivo}</p>
                <p className="text-xs text-slate-400">
                  {TIPO_LABEL[a.tipo]} · {formatarTamanho(a.tamanho_bytes)} · {formatarData(a.created_at)}
                </p>
              </div>
              {a.url && (
                <a
                  href={a.url}
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
                  onClick={() => setDeletando(a)}
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
        title="Remover anexo"
        description={`Remover "${deletando?.nome_arquivo ?? ""}"? Esta ação não pode ser desfeita.`}
        loading={deletandoLoading}
        onConfirm={handleDeletar}
      />
    </div>
  );
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
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}
