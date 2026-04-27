"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, FileText, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface ImportError {
  linha: number;
  motivo: string;
}

interface ImportResultado {
  total_lidas: number;
  criadas: number;
  erros: number;
  campos_reconhecidos: string[];
  campos_ignorados: string[];
  detalhes_erros: ImportError[];
}

const CAMPOS_RECONHECIDOS = [
  { campo: "nome_completo", aliases: "Nome, Nome Completo, Cliente, Contato" },
  { campo: "telefone", aliases: "Telefone, Celular, WhatsApp, Tel" },
  { campo: "email", aliases: "Email, E-mail" },
  { campo: "cpf_cnpj", aliases: "CPF, CNPJ, Documento" },
  { campo: "data_nascimento", aliases: "Data Nascimento, Data de Nascimento, Aniversário (DD/MM/AAAA)" },
  { campo: "telefone_secundario", aliases: "Telefone Secundário, Telefone 2" },
  { campo: "instagram", aliases: "Instagram, IG" },
  { campo: "endereco", aliases: "Endereço, Logradouro, Rua" },
  { campo: "cidade", aliases: "Cidade, Município" },
  { campo: "estado", aliases: "Estado, UF (sigla com 2 letras)" },
  { campo: "pais", aliases: "País, Country" },
  { campo: "profissao_empresa", aliases: "Profissão, Empresa, Ocupação" },
  { campo: "origem_lead", aliases: "Origem, Fonte, Canal (site, indicacao, whatsapp, instagram, etc.)" },
  { campo: "status", aliases: "Status (ativo, em_negociacao, inativo, concluido)" },
  { campo: "tipo_cliente", aliases: "Tipo (comprador, locatario, proprietario, investidor)" },
  { campo: "renda_aproximada", aliases: "Renda (aceita 'R$ 5.000,00')" },
  { campo: "como_conheceu", aliases: "Como Conheceu, Referência" },
  { campo: "observacoes", aliases: "Observações, Obs, Anotações" },
  { campo: "imovel_codigo", aliases: "Código do Imóvel (só para proprietário)" },
];

export default function ImportarClientesPage() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ImportResultado | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Selecione um arquivo .csv");
      return;
    }
    setArquivo(file);
    setResultado(null);
  }

  async function handleImportar() {
    if (!arquivo) return;
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("file", arquivo);
      const res = await api.post<ImportResultado>("/clientes/importar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResultado(res.data);
      if (res.data.criadas > 0) {
        toast.success(`${res.data.criadas} cliente(s) importado(s) com sucesso.`);
      }
      if (res.data.erros > 0) {
        toast.warning(`${res.data.erros} linha(s) com erro — veja os detalhes abaixo.`);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Erro ao importar CSV.";
      toast.error(msg);
    } finally {
      setEnviando(false);
    }
  }

  function reset() {
    setArquivo(null);
    setResultado(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/clientes"
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Importar clientes</h1>
          <p className="text-slate-500 text-sm">
            Suba um arquivo CSV com os clientes. Os cabeçalhos são reconhecidos automaticamente.
          </p>
        </div>
      </div>

      {!resultado && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
          <label
            htmlFor="csv-file"
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-lg p-10 cursor-pointer hover:border-[#585a4f]/40 hover:bg-slate-50 transition"
          >
            <Upload className="w-10 h-10 text-slate-300" />
            {arquivo ? (
              <>
                <p className="text-sm font-medium text-slate-700">{arquivo.name}</p>
                <p className="text-xs text-slate-400">
                  {(arquivo.size / 1024).toFixed(1)} KB · clique para trocar
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-600">Clique para selecionar um CSV</p>
                <p className="text-xs text-slate-400">
                  Aceita arquivos .csv com separador <code>,</code> ou <code>;</code>
                </p>
              </>
            )}
            <input
              id="csv-file"
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <div className="flex justify-end gap-2 mt-4">
            {arquivo && (
              <button
                onClick={reset}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleImportar}
              disabled={!arquivo || enviando}
              className="flex items-center gap-2 px-5 py-2 text-white text-sm font-medium rounded-lg transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#585a4f" }}
            >
              {enviando ? "Importando..." : "Importar"}
            </button>
          </div>
        </div>
      )}

      {resultado && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Resultado da importação</h2>
            <button
              onClick={reset}
              className="text-slate-400 hover:text-slate-700 transition"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Lidas</p>
              <p className="text-2xl font-bold text-slate-700">{resultado.total_lidas}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3">
              <p className="text-xs text-emerald-600 uppercase tracking-wide">Criadas</p>
              <p className="text-2xl font-bold text-emerald-700">{resultado.criadas}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-amber-600 uppercase tracking-wide">Erros</p>
              <p className="text-2xl font-bold text-amber-700">{resultado.erros}</p>
            </div>
          </div>

          {resultado.campos_reconhecidos.length > 0 && (
            <div className="text-xs text-slate-500 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 inline-block mr-1 text-emerald-500" />
              Campos reconhecidos: {resultado.campos_reconhecidos.join(", ")}
            </div>
          )}

          {resultado.campos_ignorados.length > 0 && (
            <div className="text-xs text-slate-500 mb-4">
              <AlertTriangle className="w-3.5 h-3.5 inline-block mr-1 text-amber-500" />
              Colunas ignoradas (não casaram com nenhum campo):{" "}
              {resultado.campos_ignorados.join(", ")}
            </div>
          )}

          {resultado.detalhes_erros.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-700 mb-2">
                Linhas com erro (mostrando até 50):
              </p>
              <div className="max-h-60 overflow-y-auto bg-slate-50 rounded-lg p-3 text-xs font-mono">
                {resultado.detalhes_erros.map((e, i) => (
                  <div key={i} className="text-slate-600 py-0.5">
                    Linha {e.linha}: {e.motivo}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
            <Link
              href="/clientes"
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition"
            >
              Voltar para listagem
            </Link>
            <button
              onClick={reset}
              className="px-4 py-2 text-white text-sm font-medium rounded-lg transition hover:opacity-90"
              style={{ backgroundColor: "#585a4f" }}
            >
              Importar outro arquivo
            </button>
          </div>
        </div>
      )}

      <details className="bg-white rounded-xl border border-slate-200 p-5">
        <summary className="text-sm font-medium text-slate-700 cursor-pointer flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          Cabeçalhos reconhecidos automaticamente
        </summary>
        <div className="mt-4 space-y-1.5 text-xs">
          <p className="text-slate-500 mb-3">
            Os cabeçalhos do CSV são normalizados (sem acentos, sem maiúsculas) e comparados com a lista
            abaixo. Linhas sem <strong>nome</strong> ou <strong>telefone</strong> reconhecidos são puladas.
          </p>
          {CAMPOS_RECONHECIDOS.map((c) => (
            <div key={c.campo} className="grid grid-cols-3 gap-2 py-1 border-b border-slate-50">
              <code className="text-slate-600 font-mono">{c.campo}</code>
              <span className="col-span-2 text-slate-500">{c.aliases}</span>
            </div>
          ))}
          <p className="text-slate-400 mt-3 text-[11px]">
            Vindo do <strong>Jetmob</strong>: exporte os contatos em CSV pelo painel deles e suba aqui — a
            maioria dos cabeçalhos casa direto. Para colunas que não forem reconhecidas, basta renomear o
            cabeçalho na planilha (ex.: <em>Cliente Nome</em> → <em>Nome</em>) antes de importar.
          </p>
        </div>
      </details>
    </div>
  );
}
