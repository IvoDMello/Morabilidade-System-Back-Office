"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Phone, Plus, RotateCcw, X } from "lucide-react";
import { api } from "@/lib/api";
import { useFormAutosave } from "@/lib/use-form-autosave";
import type { Cliente, Tag, User } from "@/types";

// ── Schema de validação ────────────────────────────────────────────────────────

// Converte string vazia / null para null; aceita números inteiros >= 0
const optInt = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().int().min(0).nullable().optional()
);

// Converte string vazia / null para null; aceita números positivos (decimais)
const optPositive = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().positive().nullable().optional()
);

const schema = z.object({
  codigo: z.string().optional(),
  titulo: z.string().max(120, "Máximo de 120 caracteres").optional(),
  tipo_negocio: z.enum(["venda", "locacao", "ambos"]),
  disponibilidade: z.enum(["disponivel", "reservado", "vendido_locado"]),
  condicao: z.enum(["em_construcao", "na_planta", "novo", "usado"]),
  cep: z.string().optional(),
  logradouro: z.string().min(1, "Logradouro obrigatório"),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().min(1, "Bairro obrigatório"),
  cidade: z.string().min(1, "Cidade obrigatória"),
  tipo_imovel: z.enum(["apartamento", "casa", "casa_vila", "casa_condominio", "cobertura"]),
  dormitorios: optInt,
  suites: optInt,
  banheiros: optInt,
  vagas_garagem: optInt,
  mobiliado: z.preprocess(
    (v) => (v === "" ? null : v),
    z.enum(["sim", "nao", "semi-mobiliado"]).nullable().optional()
  ),
  andar: optInt,
  ano_construcao: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().min(1900).max(2100).nullable().optional()
  ),
  idade_predio: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().min(0).max(500).nullable().optional()
  ),
  area_total: optPositive,
  area_util: optPositive,
  valor_venda: optPositive,
  valor_locacao: optPositive,
  valor_sob_consulta: z.boolean().default(false),
  iptu_mensal: optPositive,
  condominio_mensal: optPositive,
  inscricao_municipal: z.string().optional(),
  rgi: z.string().optional(),
  numero_matricula: z.string().optional(),
  descricao: z.string().optional(),
  observacoes_internas: z.string().optional(),
  instagram_url: z.string().optional(),
  corretor_id: z.string().optional().nullable(),
  proprietario_id: z.string().optional().nullable(),
  destaque_ordem: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().min(1).max(5).nullable().optional()
  ),
  tag_ids: z.array(z.string()).default([]),
});

export type ImovelFormData = z.infer<typeof schema>;

interface ImovelFormProps {
  defaultValues?: Partial<ImovelFormData>;
  onSubmit: (data: ImovelFormData) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

// ── Sub-componentes de UI ─────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-slate-700 mb-1">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500">{message}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-2 mb-4 border-b border-slate-100">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{children}</h3>
    </div>
  );
}

// ── Máscara de dinheiro pt-BR (separador de milhar + vírgula decimal) ────────
function formatMoneyBR(value: number | null | undefined): string {
  if (value == null || isNaN(value as number)) return "";
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function parseMoneyBR(display: string): number | null {
  const clean = display.replace(/\./g, "").replace(",", ".");
  if (clean === "" || clean === "-") return null;
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

// Reaplica milhares enquanto o usuário digita, mantendo a vírgula decimal e
// limitando a 2 casas. Aceita apenas dígitos e uma vírgula.
function maskMoneyTyping(raw: string): string {
  let s = raw.replace(/[^\d,]/g, "");
  const firstComma = s.indexOf(",");
  if (firstComma !== -1) {
    s = s.slice(0, firstComma + 1) + s.slice(firstComma + 1).replace(/,/g, "");
  }
  const [intPart = "", decPart] = s.split(",");
  const intClean = intPart.replace(/^0+(?=\d)/, "");
  const intFormatted = intClean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (decPart !== undefined) {
    return `${intFormatted || "0"},${decPart.slice(0, 2)}`;
  }
  return intFormatted;
}

function MoneyInput({
  value,
  onChange,
  onBlur,
  className,
  placeholder,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
}) {
  const [display, setDisplay] = useState<string>(() => formatMoneyBR(value));

  // Sincroniza se o valor externo mudar por outro caminho (reset, restore draft,
  // CEP, troca de período do IPTU, etc.). Só sobrescreve quando o valor parseado
  // do display divergir, pra não brigar com o que o usuário está digitando.
  useEffect(() => {
    const parsed = parseMoneyBR(display);
    if ((value ?? null) !== (parsed ?? null)) {
      setDisplay(formatMoneyBR(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      value={display}
      onChange={(e) => {
        const masked = maskMoneyTyping(e.target.value);
        setDisplay(masked);
        onChange(parseMoneyBR(masked));
      }}
      onBlur={onBlur}
    />
  );
}

const inputClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 focus:border-[#585a4f] " +
  "placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400";

const selectClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 focus:border-[#585a4f] " +
  "disabled:bg-slate-50 disabled:text-slate-400";

// ── Componente principal ──────────────────────────────────────────────────────

export function ImovelForm({
  defaultValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Salvar imóvel",
}: ImovelFormProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cepLoading, setCepLoading] = useState(false);
  // Cadastro rápido de proprietário direto na tela do imóvel (só nome + WhatsApp).
  const [showNovoProp, setShowNovoProp] = useState(false);
  const [novoPropNome, setNovoPropNome] = useState("");
  const [novoPropTelefone, setNovoPropTelefone] = useState("");
  const [novoPropSaving, setNovoPropSaving] = useState(false);
  const [novoPropErro, setNovoPropErro] = useState<string | null>(null);
  const [iptuPeriodo, setIptuPeriodo] = useState<"mensal" | "anual">("mensal");
  // Valor exibido no input do IPTU. Em modo "anual" representa o anual; em
  // "mensal" representa o mensal — a conversão acontece no handler abaixo
  // antes de persistir em `iptu_mensal` no form.
  const [iptuValor, setIptuValor] = useState<number | null>(
    defaultValues?.iptu_mensal != null ? defaultValues.iptu_mensal : null
  );
  const descricaoRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ImovelFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      disponibilidade: "disponivel",
      tipo_negocio: "venda",
      condicao: "usado",
      tipo_imovel: "casa",
      tag_ids: [],
      ...defaultValues,
    },
  });

  // Autosave do rascunho no localStorage. Defesa em profundidade contra
  // crash do browser, perda de sessão (já mitigada pelo refresh proativo),
  // ou fechar a aba sem querer. Chave estável por imóvel:
  //  - "novo"          → cadastro
  //  - "<codigo>"      → edição (cada imóvel tem seu próprio rascunho)
  const draftKey = `imovel:${defaultValues?.codigo ?? "novo"}`;
  const { hasDraft, draftAgeMs, restoreDraft, discardDraft, clearDraft } =
    useFormAutosave<ImovelFormData>({ key: draftKey, watch, reset });

  const tipoNegocio = watch("tipo_negocio");
  const selectedTagIds = watch("tag_ids") ?? [];
  const descricaoValue = watch("descricao");
  const proprietarioId = watch("proprietario_id");
  const corretorId = watch("corretor_id");

  useEffect(() => {
    api.get<Tag[]>("/tags/").then((r) => setTags(r.data)).catch(() => {});
    api.get<User[]>("/usuarios/").then((r) => setUsers(r.data)).catch(() => {});
    // O endpoint /clientes/ aceita page_size até 100 (limite do backend).
    // Operação tem ~100 clientes — uma página basta hoje; se crescer, vira combobox com busca.
    api.get<Cliente[]>("/clientes/", { params: { page_size: 100 } })
      .then((r) => setClientes(r.data))
      .catch((err) => {
        console.error("[imovel-form] falha ao carregar clientes", err);
      });
  }, []);

  const proprietarioSelecionado = useMemo(
    () => clientes.find((c) => c.id === proprietarioId) ?? null,
    [clientes, proprietarioId]
  );

  // Auto-resize da textarea de descrição para eliminar scrollbar dupla
  useEffect(() => {
    const el = descricaoRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [descricaoValue]);

  async function buscarCep(cep: string) {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setValue("logradouro", data.logradouro || "");
        setValue("bairro", data.bairro || "");
        setValue("cidade", data.localidade || "");
      }
    } catch {
      // silently ignore
    } finally {
      setCepLoading(false);
    }
  }

  function handleIptuPeriodoChange(periodo: "mensal" | "anual") {
    if (periodo === iptuPeriodo) return;
    if (iptuValor != null && iptuValor > 0) {
      const converted =
        periodo === "anual"
          ? parseFloat((iptuValor * 10).toFixed(2))
          : parseFloat((iptuValor / 10).toFixed(2));
      setIptuValor(converted);
      setValue("iptu_mensal", periodo === "anual" ? parseFloat((converted / 10).toFixed(2)) : converted);
    }
    setIptuPeriodo(periodo);
  }

  function handleIptuValorChange(num: number | null) {
    setIptuValor(num);
    if (num == null) {
      setValue("iptu_mensal", null);
    } else {
      setValue("iptu_mensal", iptuPeriodo === "anual" ? parseFloat((num / 10).toFixed(2)) : num);
    }
  }

  async function criarProprietarioRapido() {
    const nome = novoPropNome.trim();
    const tel = novoPropTelefone.trim();
    if (!nome) {
      setNovoPropErro("Informe o nome do proprietário.");
      return;
    }
    if (!tel) {
      setNovoPropErro("Informe o WhatsApp do proprietário.");
      return;
    }
    setNovoPropSaving(true);
    setNovoPropErro(null);
    try {
      const { data: novo } = await api.post<Cliente>("/clientes/", {
        nome_completo: nome,
        telefone: tel,
        tipo_cliente: "proprietario",
      });
      // Adiciona à lista local e já seleciona — o vínculo com o imóvel é
      // persistido ao salvar o formulário (envia proprietario_id).
      setClientes((prev) => [novo, ...prev]);
      setValue("proprietario_id", novo.id);
      setNovoPropNome("");
      setNovoPropTelefone("");
      setShowNovoProp(false);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setNovoPropErro(detail || "Não foi possível cadastrar o proprietário.");
    } finally {
      setNovoPropSaving(false);
    }
  }

  function toggleTag(id: string) {
    const current = selectedTagIds;
    const updated = current.includes(id)
      ? current.filter((t) => t !== id)
      : [...current, id];
    setValue("tag_ids", updated);
  }

  const { ref: descricaoFormRef, ...descricaoReg } = register("descricao");

  const submitButton = (
    <button
      type="submit"
      disabled={isLoading}
      className="flex items-center gap-2 px-6 py-2.5 text-white text-sm font-medium rounded-lg transition hover:opacity-90 disabled:opacity-60"
      style={{ backgroundColor: "#585a4f" }}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {submitLabel}
    </button>
  );

  async function handleSubmitWithDraftCleanup(data: ImovelFormData) {
    await onSubmit(data);
    // Submit OK → o pai (página) sobrevive ao await. Se chegou aqui, limpa.
    clearDraft();
  }

  function formatDraftAge(ms: number): string {
    const min = Math.floor(ms / 60_000);
    if (min < 1) return "agora há pouco";
    if (min < 60) return `${min} min atrás`;
    const h = Math.floor(min / 60);
    return h === 1 ? "1 hora atrás" : `${h} horas atrás`;
  }

  return (
    <form onSubmit={handleSubmit(handleSubmitWithDraftCleanup)} className="space-y-8">
      {/* Banner de recuperação de rascunho */}
      {hasDraft && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <RotateCcw className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Rascunho não salvo encontrado</p>
            <p className="text-xs text-amber-800 mt-0.5">
              Você começou a preencher este formulário {formatDraftAge(draftAgeMs)} e não chegou a salvar. Deseja recuperar?
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={restoreDraft}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-600 text-white hover:bg-amber-700 transition"
            >
              Recuperar
            </button>
            <button
              type="button"
              onClick={discardDraft}
              aria-label="Descartar rascunho"
              className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-md transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Botão de salvar no topo (atalho — evita rolar até o final) */}
      <div className="flex justify-end">{submitButton}</div>

      {/* ── 1. Identificação ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <SectionTitle>Identificação</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <Label>Título</Label>
            <input
              {...register("titulo")}
              className={inputClass}
              placeholder="Ex.: Apartamento amplo com vista para o mar"
              maxLength={120}
            />
            <FieldError message={errors.titulo?.message} />
            <p className="mt-1 text-xs text-slate-400">
              Exibido na página pública do imóvel no lugar do endereço.
            </p>
          </div>

          <div>
            <Label>Código</Label>
            <input
              {...register("codigo")}
              className={inputClass}
              placeholder="Auto-gerado"
            />
            <p className="mt-1 text-xs text-slate-400">Deixe vazio para gerar automaticamente</p>
          </div>

          <div>
            <Label required>Tipo de negócio</Label>
            <select {...register("tipo_negocio")} className={selectClass}>
              <option value="venda">Venda</option>
              <option value="locacao">Locação</option>
              <option value="ambos">Venda e Locação</option>
            </select>
            <FieldError message={errors.tipo_negocio?.message} />
          </div>

          <div>
            <Label required>Disponibilidade</Label>
            <select {...register("disponibilidade")} className={selectClass}>
              <option value="disponivel">Disponível</option>
              <option value="reservado">Reservado</option>
              <option value="vendido_locado">Vendido / Locado</option>
            </select>
            <FieldError message={errors.disponibilidade?.message} />
          </div>

          <div>
            <Label required>Condição</Label>
            <select {...register("condicao")} className={selectClass}>
              <option value="usado">Usado</option>
              <option value="novo">Novo</option>
              <option value="em_construcao">Em construção</option>
              <option value="na_planta">Na planta</option>
            </select>
            <FieldError message={errors.condicao?.message} />
          </div>

          <div className="lg:col-span-2">
            <Label>Destaque na home</Label>
            <select {...register("destaque_ordem")} className={selectClass}>
              <option value="">Não destacado</option>
              <option value="1">Posição 1</option>
              <option value="2">Posição 2</option>
              <option value="3">Posição 3</option>
              <option value="4">Posição 4</option>
              <option value="5">Posição 5</option>
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Ao escolher uma posição já em uso, o imóvel anterior perde o destaque.
            </p>
          </div>

          <div className="sm:col-span-2 lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Proprietário</label>
              <button
                type="button"
                onClick={() => {
                  setShowNovoProp((v) => !v);
                  setNovoPropErro(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#585a4f] hover:underline"
              >
                {showNovoProp ? (
                  <>
                    <X className="w-3 h-3" /> Cancelar
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" /> Novo proprietário
                  </>
                )}
              </button>
            </div>
            {/* value controlado: os clientes chegam por fetch depois que o RHF já
                aplicou o defaultValue, e um <select> não-controlado cai na primeira
                option ("Nenhum") quando as options são renderizadas depois. */}
            <select
              {...register("proprietario_id")}
              value={proprietarioId ?? ""}
              className={selectClass}
            >
              <option value="">Nenhum</option>
              {clientes
                // Mantém o proprietário atual mesmo que não seja tipo_cliente='proprietario'
                // (ex: foi reclassificado). Caso contrário, oferece apenas proprietários ou
                // clientes sem tipo definido — evita poluir o select com locatários/investidores.
                .filter(
                  (c) =>
                    c.id === proprietarioId ||
                    !c.tipo_cliente ||
                    c.tipo_cliente === "proprietario"
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_completo}
                  </option>
                ))}
            </select>
            {proprietarioSelecionado?.telefone ? (
              <a
                href={`https://wa.me/${proprietarioSelecionado.telefone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-[#585a4f] hover:underline"
                title="Abrir conversa no WhatsApp"
              >
                <Phone className="w-3 h-3" />
                {proprietarioSelecionado.telefone}
              </a>
            ) : (
              <p className="mt-1 text-xs text-slate-400">
                Sincroniza automaticamente com o contrato de locação deste imóvel.
              </p>
            )}

            {showNovoProp && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-xs font-medium text-slate-600">
                  Cadastro rápido — só nome e WhatsApp. Você pode completar os dados depois em Clientes.
                </p>
                <input
                  type="text"
                  value={novoPropNome}
                  onChange={(e) => setNovoPropNome(e.target.value)}
                  className={inputClass}
                  placeholder="Nome do proprietário"
                />
                <input
                  type="tel"
                  value={novoPropTelefone}
                  onChange={(e) => setNovoPropTelefone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      criarProprietarioRapido();
                    }
                  }}
                  className={inputClass}
                  placeholder="WhatsApp (com DDD)"
                />
                {novoPropErro && <p className="text-xs text-red-500">{novoPropErro}</p>}
                <button
                  type="button"
                  onClick={criarProprietarioRapido}
                  disabled={novoPropSaving}
                  className="flex items-center gap-2 px-4 py-2 text-white text-xs font-medium rounded-lg transition hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: "#585a4f" }}
                >
                  {novoPropSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Cadastrar e vincular
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Endereço ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <SectionTitle>Endereço</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>CEP</Label>
            <div className="flex gap-2">
              <input
                {...register("cep")}
                className={inputClass}
                placeholder="00000-000"
                maxLength={9}
              />
              <button
                type="button"
                onClick={() => buscarCep(watch("cep") ?? "")}
                disabled={cepLoading}
                className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition whitespace-nowrap disabled:opacity-50"
              >
                {cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
              </button>
            </div>
          </div>

          <div className="sm:col-span-2">
            <Label required>Logradouro</Label>
            <input {...register("logradouro")} className={inputClass} placeholder="Rua, Avenida..." />
            <FieldError message={errors.logradouro?.message} />
          </div>

          <div>
            <Label>Número</Label>
            <input {...register("numero")} className={inputClass} placeholder="S/N" />
          </div>

          <div>
            <Label>Complemento</Label>
            <input {...register("complemento")} className={inputClass} placeholder="Apto, Bloco..." />
          </div>

          <div>
            <Label required>Bairro</Label>
            <input {...register("bairro")} className={inputClass} placeholder="Bairro" />
            <FieldError message={errors.bairro?.message} />
          </div>

          <div>
            <Label required>Cidade</Label>
            <input {...register("cidade")} className={inputClass} placeholder="Cidade" />
            <FieldError message={errors.cidade?.message} />
          </div>
        </div>
      </div>

      {/* ── 3. Características ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <SectionTitle>Características</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label required>Tipo de imóvel</Label>
            <select {...register("tipo_imovel")} className={selectClass}>
              <option value="apartamento">Apartamento</option>
              <option value="casa">Casa</option>
              <option value="casa_vila">Casa de vila</option>
              <option value="casa_condominio">Casa de condomínio</option>
              <option value="cobertura">Cobertura</option>
            </select>
            <FieldError message={errors.tipo_imovel?.message} />
          </div>

          <div>
            <Label>Dormitórios</Label>
            <input type="number" min={0} {...register("dormitorios")} className={inputClass} placeholder="0" />
          </div>

          <div>
            <Label>Suítes</Label>
            <input type="number" min={0} {...register("suites")} className={inputClass} placeholder="0" />
          </div>

          <div>
            <Label>Banheiros</Label>
            <input type="number" min={0} {...register("banheiros")} className={inputClass} placeholder="0" />
          </div>

          <div>
            <Label>Vagas na garagem</Label>
            <input type="number" min={0} {...register("vagas_garagem")} className={inputClass} placeholder="0" />
          </div>

          <div>
            <Label>Mobiliado</Label>
            <select {...register("mobiliado")} className={selectClass}>
              <option value="">Não informado</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
              <option value="semi-mobiliado">Semi-mobiliado</option>
            </select>
          </div>

          <div>
            <Label>Andar</Label>
            <input type="number" min={0} {...register("andar")} className={inputClass} placeholder="—" />
            <p className="mt-1 text-xs text-slate-400">
              Térreo = <strong>1</strong> (usado pelo filtro &quot;Apenas térreo&quot; do site).
            </p>
          </div>

          <div>
            <Label>Ano de construção</Label>
            <input
              type="number"
              min={1900}
              max={2100}
              {...register("ano_construcao")}
              className={inputClass}
              placeholder="Ex: 2010"
            />
            <FieldError message={errors.ano_construcao?.message} />
            {(() => {
              const ano = watch("ano_construcao");
              const anoAtual = new Date().getFullYear();
              if (ano && Number(ano) > 0 && Number(ano) <= anoAtual) {
                const idade = anoAtual - Number(ano);
                return (
                  <p className="mt-1 text-xs text-slate-400">
                    Idade aproximada: <strong>{idade} {idade === 1 ? "ano" : "anos"}</strong>.
                  </p>
                );
              }
              return null;
            })()}
          </div>

          <div>
            <Label>Idade do prédio (anos)</Label>
            <input
              type="number"
              min={0}
              max={500}
              {...register("idade_predio")}
              className={inputClass}
              placeholder="Ex: 15"
            />
            <FieldError message={errors.idade_predio?.message} />
            <p className="mt-1 text-xs text-slate-400">
              Use quando o ano de construção for desconhecido.
            </p>
          </div>

          <div>
            <Label>Área total (m²)</Label>
            <input type="number" step="0.01" min={0} {...register("area_total")} className={inputClass} placeholder="0,00" />
          </div>

          <div>
            <Label>Área útil (m²)</Label>
            <input type="number" step="0.01" min={0} {...register("area_util")} className={inputClass} placeholder="0,00" />
          </div>
        </div>
      </div>

      {/* ── 4. Valores ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <SectionTitle>Valores</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(tipoNegocio === "venda" || tipoNegocio === "ambos") && (
            <div>
              <Label>Valor de venda (R$)</Label>
              <Controller
                control={control}
                name="valor_venda"
                render={({ field }) => (
                  <MoneyInput
                    value={field.value as number | null | undefined}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    className={inputClass}
                    placeholder="0,00"
                  />
                )}
              />
              <FieldError message={errors.valor_venda?.message} />
            </div>
          )}

          {(tipoNegocio === "locacao" || tipoNegocio === "ambos") && (
            <div>
              <Label>Valor de locação (R$)</Label>
              <Controller
                control={control}
                name="valor_locacao"
                render={({ field }) => (
                  <MoneyInput
                    value={field.value as number | null | undefined}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    className={inputClass}
                    placeholder="0,00"
                  />
                )}
              />
              <FieldError message={errors.valor_locacao?.message} />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">IPTU (R$)</label>
              <div className="flex text-xs rounded-md overflow-hidden border border-slate-200">
                {(["mensal", "anual"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleIptuPeriodoChange(p)}
                    className={`px-2.5 py-0.5 capitalize transition ${
                      iptuPeriodo === p ? "text-white" : "text-slate-500 hover:bg-slate-50"
                    }`}
                    style={iptuPeriodo === p ? { backgroundColor: "#585a4f" } : undefined}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <MoneyInput
              value={iptuValor}
              onChange={handleIptuValorChange}
              className={inputClass}
              placeholder="0,00"
            />
            {iptuPeriodo === "anual" && iptuValor != null && iptuValor > 0 && (
              <p className="mt-1 text-xs text-slate-400">
                ≈ R${" "}
                {(iptuValor / 10).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                /mês
              </p>
            )}
          </div>

          <div>
            <Label>Condomínio mensal (R$)</Label>
            <Controller
              control={control}
              name="condominio_mensal"
              render={({ field }) => (
                <MoneyInput
                  value={field.value as number | null | undefined}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  className={inputClass}
                  placeholder="0,00"
                />
              )}
            />
          </div>
        </div>

        {/* Sob consulta — esconde os valores no site, mantendo-os registrados aqui */}
        <label className="mt-4 flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            {...register("valor_sob_consulta")}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#585a4f]"
          />
          <span className="text-sm text-slate-700">
            Valor sob consulta
            <span className="block text-xs text-slate-400">
              Os valores ficam registrados aqui, mas o site exibe “Sob consulta” no lugar do preço.
            </span>
          </span>
        </label>
      </div>

      {/* ── 5. Documentação ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <SectionTitle>Documentação</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>Inscrição municipal</Label>
            <input
              {...register("inscricao_municipal")}
              className={inputClass}
              placeholder="Ex: 1234567-8"
            />
          </div>

          <div>
            <Label>RGI</Label>
            <input
              {...register("rgi")}
              className={inputClass}
              placeholder="Registro Geral de Imóveis"
            />
          </div>

          <div>
            <Label>Número da matrícula</Label>
            <input
              {...register("numero_matricula")}
              className={inputClass}
              placeholder="Nº da matrícula no cartório"
            />
          </div>
        </div>
      </div>

      {/* ── 6. Informações adicionais ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <SectionTitle>Informações adicionais</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <Label>Descrição</Label>
            <textarea
              {...descricaoReg}
              ref={(el) => {
                descricaoFormRef(el);
                descricaoRef.current = el;
              }}
              style={{ minHeight: "6rem", overflow: "hidden" }}
              className={inputClass + " resize-none"}
              placeholder="Descreva o imóvel..."
            />
          </div>

          <div>
            <Label>Link do anúncio no Instagram (post ou reel)</Label>
            <input {...register("instagram_url")} className={inputClass} placeholder="https://www.instagram.com/reel/..." />
            <FieldError message={errors.instagram_url?.message} />
            <p className="mt-1 text-xs text-slate-400">
              Aparece como botão na página do imóvel no site.
            </p>
          </div>

          <div className="lg:col-span-2">
            <Label>Observações internas</Label>
            <textarea
              {...register("observacoes_internas")}
              rows={3}
              className={inputClass + " resize-y"}
              placeholder="Notas internas da equipe — não aparecem no site público."
            />
            <p className="mt-1 text-xs text-amber-600">
              Visível para a equipe (admins e corretores). Não aparece no site público.
            </p>
          </div>

          <div>
            <Label>Corretor responsável</Label>
            {/* value controlado pelo mesmo motivo do select de proprietário:
                a lista de usuários chega por fetch depois do defaultValue. */}
            <select
              {...register("corretor_id")}
              value={corretorId ?? ""}
              className={selectClass}
            >
              <option value="">Nenhum</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome_completo}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-4">
            <Label>Etiquetas</Label>
            <Controller
              control={control}
              name="tag_ids"
              render={() => (
                <div className="flex flex-wrap gap-2 mt-1">
                  {tags.map((tag) => {
                    const active = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                          active
                            ? "text-white border-transparent shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                        style={active ? { backgroundColor: tag.cor ?? "#3B82F6" } : undefined}
                      >
                        {tag.nome}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>
        )}
      </div>

      {/* ── Botão de submit (final) ── */}
      <div className="flex justify-end">{submitButton}</div>
    </form>
  );
}
