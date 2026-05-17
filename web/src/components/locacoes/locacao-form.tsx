"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatarMoeda } from "@/lib/utils";
import type { Cliente, ImovelListOut } from "@/types";

// Decimal vindo de input é string; convertemos no submit.
const schema = z
  .object({
    imovel_id: z.string().min(1, "Selecione o imóvel"),
    proprietario_id: z.string().min(1, "Selecione o proprietário"),
    locatario_id: z.string().min(1, "Selecione o locatário"),

    data_inicio: z.string().min(1, "Obrigatório"),
    data_fim: z.string().min(1, "Obrigatório"),
    dia_vencimento: z.coerce.number().int().min(1).max(31),

    aluguel_mensal: z.coerce.number().min(0, "Valor inválido"),
    condominio_mensal: z.coerce.number().min(0).default(0),
    incluir_condominio_cobranca: z.boolean().default(true),

    fundo_reserva: z.coerce.number().min(0).default(0),
    fundo_obra: z.coerce.number().min(0).default(0),
    incluir_fundo_obra_cobranca: z.boolean().default(false),

    iptu_anual: z.coerce.number().min(0).default(0),
    incluir_iptu_cobranca: z.boolean().default(false),

    numero_iptu: z.string().optional().or(z.literal("")),
    dados_cobranca_pix: z.string().optional().or(z.literal("")),
    observacoes_demonstrativo: z.string().optional().or(z.literal("")),

    taxa_administracao_pct: z.coerce.number().min(0).max(100).default(0),
  })
  .refine((d) => new Date(d.data_fim) > new Date(d.data_inicio), {
    message: "Fim deve ser depois do início",
    path: ["data_fim"],
  })
  .refine((d) => d.proprietario_id !== d.locatario_id, {
    message: "Proprietário e locatário devem ser pessoas diferentes",
    path: ["locatario_id"],
  });

export type LocacaoFormData = z.infer<typeof schema>;

const inputClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 focus:border-[#585a4f]";
const selectClass = inputClass;
const labelClass = "block text-xs font-medium text-slate-600 mb-1";

function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {hint && !error && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full pt-2 pb-1 border-b border-slate-100">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{children}</h3>
    </div>
  );
}

interface Props {
  defaultValues?: Partial<LocacaoFormData>;
  onSubmit: (data: LocacaoFormData) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function LocacaoForm({
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Salvar",
}: Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LocacaoFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      dia_vencimento: 5,
      condominio_mensal: 0,
      incluir_condominio_cobranca: true,
      fundo_reserva: 0,
      fundo_obra: 0,
      incluir_fundo_obra_cobranca: false,
      iptu_anual: 0,
      incluir_iptu_cobranca: false,
      taxa_administracao_pct: 0,
      ...defaultValues,
    },
  });

  // Cargas iniciais — imóveis e clientes (lista enxuta).
  // A imobiliária opera com volume baixo (~100 de cada); select nativo basta.
  const [imoveis, setImoveis] = useState<ImovelListOut[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingListas, setLoadingListas] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<ImovelListOut[]>("/imoveis/", { params: { page_size: 100 } }),
      api.get<Cliente[]>("/clientes/", { params: { page_size: 100 } }),
    ])
      .then(([imv, cli]) => {
        setImoveis(imv.data);
        setClientes(cli.data);
      })
      .catch(() => {})
      .finally(() => setLoadingListas(false));
  }, []);

  // Cálculo do total ao vivo — replica a regra do PDF Artur Araripe:
  //   Aluguel + (Condomínio se incluir) + (IPTU/10 se incluir)
  //              + (Fundo de obra se incluir) − Fundo de reserva
  const w = watch();
  const total = useMemo(() => {
    const aluguel = Number(w.aluguel_mensal) || 0;
    const cond = w.incluir_condominio_cobranca ? Number(w.condominio_mensal) || 0 : 0;
    const fobra = w.incluir_fundo_obra_cobranca ? Number(w.fundo_obra) || 0 : 0;
    const iptu = w.incluir_iptu_cobranca ? (Number(w.iptu_anual) || 0) / 10 : 0;
    const fres = Number(w.fundo_reserva) || 0;
    return aluguel + cond + fobra + iptu - fres;
  }, [
    w.aluguel_mensal,
    w.condominio_mensal,
    w.fundo_obra,
    w.iptu_anual,
    w.fundo_reserva,
    w.incluir_condominio_cobranca,
    w.incluir_fundo_obra_cobranca,
    w.incluir_iptu_cobranca,
  ]);

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex justify-end">{submitButton}</div>

      {/* Partes e imóvel */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SectionTitle>Partes e imóvel</SectionTitle>

          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Imóvel *" error={errors.imovel_id?.message}>
              <select {...register("imovel_id")} className={selectClass} disabled={loadingListas}>
                <option value="">— Selecionar imóvel —</option>
                {imoveis.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.codigo} · {i.logradouro}
                    {i.numero ? `, ${i.numero}` : ""} — {i.bairro}, {i.cidade}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <Field label="Proprietário *" error={errors.proprietario_id?.message}>
              <select
                {...register("proprietario_id")}
                className={selectClass}
                disabled={loadingListas}
              >
                <option value="">— Selecionar —</option>
                {clientes
                  .filter((c) => !c.tipo_cliente || c.tipo_cliente === "proprietario")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome_completo}
                    </option>
                  ))}
              </select>
            </Field>
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <Field label="Locatário *" error={errors.locatario_id?.message}>
              <select
                {...register("locatario_id")}
                className={selectClass}
                disabled={loadingListas}
              >
                <option value="">— Selecionar —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_completo}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* Vigência */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SectionTitle>Vigência</SectionTitle>

          <Field label="Data de início *" error={errors.data_inicio?.message}>
            <input type="date" {...register("data_inicio")} className={inputClass} />
          </Field>

          <Field label="Data de fim *" error={errors.data_fim?.message}>
            <input type="date" {...register("data_fim")} className={inputClass} />
          </Field>

          <Field label="Dia do vencimento *" error={errors.dia_vencimento?.message}>
            <input
              type="number"
              min={1}
              max={31}
              {...register("dia_vencimento")}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* Valores */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SectionTitle>Valores mensais</SectionTitle>

          <Field label="Aluguel mensal (R$) *" error={errors.aluguel_mensal?.message}>
            <input
              type="number"
              step="0.01"
              min={0}
              {...register("aluguel_mensal")}
              className={inputClass}
            />
          </Field>

          <Field label="Condomínio (R$)" error={errors.condominio_mensal?.message}>
            <input
              type="number"
              step="0.01"
              min={0}
              {...register("condominio_mensal")}
              className={inputClass}
            />
            <label className="flex items-center gap-2 mt-2 text-xs text-slate-600">
              <input
                type="checkbox"
                {...register("incluir_condominio_cobranca")}
                className="rounded border-slate-300 text-[#585a4f] focus:ring-[#585a4f]/30"
              />
              Incluir condomínio na cobrança
            </label>
          </Field>

          <Field
            label="Fundo de reserva (R$)"
            hint="Sempre deduz do total — responsabilidade do proprietário"
            error={errors.fundo_reserva?.message}
          >
            <input
              type="number"
              step="0.01"
              min={0}
              {...register("fundo_reserva")}
              className={inputClass}
            />
          </Field>

          <Field label="Fundo de obra (R$)" error={errors.fundo_obra?.message}>
            <input
              type="number"
              step="0.01"
              min={0}
              {...register("fundo_obra")}
              className={inputClass}
            />
            <label className="flex items-center gap-2 mt-2 text-xs text-slate-600">
              <input
                type="checkbox"
                {...register("incluir_fundo_obra_cobranca")}
                className="rounded border-slate-300 text-[#585a4f] focus:ring-[#585a4f]/30"
              />
              Incluir fundo de obra na cobrança
            </label>
          </Field>

          <Field
            label="IPTU anual (R$)"
            hint="Quando incluído, é dividido em 10 parcelas mensais"
            error={errors.iptu_anual?.message}
          >
            <input
              type="number"
              step="0.01"
              min={0}
              {...register("iptu_anual")}
              className={inputClass}
            />
            <label className="flex items-center gap-2 mt-2 text-xs text-slate-600">
              <input
                type="checkbox"
                {...register("incluir_iptu_cobranca")}
                className="rounded border-slate-300 text-[#585a4f] focus:ring-[#585a4f]/30"
              />
              Incluir IPTU na cobrança (parcelado em 10x)
            </label>
          </Field>

          <Field label="Número de inscrição do IPTU">
            <input
              type="text"
              {...register("numero_iptu")}
              className={inputClass}
              placeholder="Ex: 1.234.567-8"
            />
          </Field>

          <Field
            label="Taxa de administração (%)"
            hint="Percentual retido pela imobiliária sobre o aluguel pago antes do repasse"
            error={errors.taxa_administracao_pct?.message}
          >
            <input
              type="number"
              step="0.01"
              min={0}
              max={100}
              {...register("taxa_administracao_pct")}
              className={inputClass}
              placeholder="0"
            />
          </Field>
        </div>
      </div>

      {/* Demonstrativo ao vivo */}
      <div
        className="rounded-xl border border-[#d8cb6a]/40 p-5"
        style={{ backgroundColor: "#fdfaef" }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#585a4f" }}>
          Demonstrativo (preview)
        </h3>
        <div className="space-y-1 text-sm text-slate-700 font-mono">
          <Linha label="Aluguel mensal" valor={Number(w.aluguel_mensal) || 0} />
          {w.incluir_condominio_cobranca && (
            <Linha label="+ Condomínio" valor={Number(w.condominio_mensal) || 0} />
          )}
          {w.incluir_fundo_obra_cobranca && (
            <Linha label="+ Fundo de obra" valor={Number(w.fundo_obra) || 0} />
          )}
          {w.incluir_iptu_cobranca && (
            <Linha
              label="+ IPTU (1/10)"
              valor={(Number(w.iptu_anual) || 0) / 10}
            />
          )}
          {Number(w.fundo_reserva) > 0 && (
            <Linha
              label="− Fundo de reserva"
              valor={Number(w.fundo_reserva) || 0}
              negativo
            />
          )}
          <div className="border-t border-[#585a4f]/20 my-2" />
          <div className="flex justify-between font-bold text-base" style={{ color: "#585a4f" }}>
            <span>Total a pagar</span>
            <span>{formatarMoeda(total)}</span>
          </div>
        </div>
      </div>

      {/* Cobrança */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionTitle>Cobrança</SectionTitle>

          <div className="sm:col-span-2">
            <Field label="Chave PIX para depósito">
              <input
                type="text"
                {...register("dados_cobranca_pix")}
                className={inputClass}
                placeholder="Ex: pedro.bassan.jr@gmail.com"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              label="Observações do demonstrativo"
              hint="Aparece no rodapé do PDF enviado ao locatário"
            >
              <textarea
                {...register("observacoes_demonstrativo")}
                rows={3}
                className={inputClass + " resize-none"}
                placeholder="Ex: O locatário deverá manter em dia o pagamento do IPTU e do condomínio."
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="flex justify-end">{submitButton}</div>
    </form>
  );
}

function Linha({
  label,
  valor,
  negativo,
}: {
  label: string;
  valor: number;
  negativo?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className={negativo ? "text-red-600" : ""}>{formatarMoeda(valor)}</span>
    </div>
  );
}
