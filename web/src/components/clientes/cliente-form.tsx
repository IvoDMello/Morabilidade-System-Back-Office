"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

const schema = z
  .object({
    nome_completo: z.string().min(2, "Nome obrigatório"),
    email: z.string().email("E-mail inválido").or(z.literal("")).optional(),
    telefone: z.string().min(8, "Telefone obrigatório"),
    cpf_cnpj: z.string().optional().or(z.literal("")),
    telefone_secundario: z.string().optional().or(z.literal("")),
    instagram: z.string().optional().or(z.literal("")),
    endereco: z.string().optional().or(z.literal("")),
    cidade: z.string().optional().or(z.literal("")),
    estado: z.string().optional().or(z.literal("")),
    pais: z.string().optional().or(z.literal("")),
    origem_lead: z.string().optional().or(z.literal("")),
    corretor_id: z.string().optional().or(z.literal("")),
    status: z.string().optional().or(z.literal("")),
    tipo_cliente: z.string().optional().or(z.literal("")),
    como_conheceu: z.string().optional().or(z.literal("")),
    observacoes: z.string().optional().or(z.literal("")),
    imovel_codigo: z.string().optional().or(z.literal("")),
  })
  .refine((data) => data.estado !== "EX" || (data.pais && data.pais.trim().length > 0), {
    message: "Informe o país",
    path: ["pais"],
  });

export type ClienteFormData = z.infer<typeof schema>;

const inputClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 focus:border-[#585a4f]";
const selectClass = inputClass;
const labelClass = "block text-xs font-medium text-slate-600 mb-1";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
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
  defaultValues?: Partial<ClienteFormData>;
  onSubmit: (data: ClienteFormData) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function ClienteForm({ defaultValues, onSubmit, isLoading, submitLabel = "Salvar" }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ClienteFormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {},
  });

  const estadoSelecionado = watch("estado");
  const tipoSelecionado = watch("tipo_cliente");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Dados principais */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SectionTitle>Dados principais</SectionTitle>

          <div className="sm:col-span-2 lg:col-span-2">
            <Field label="Nome completo *" error={errors.nome_completo?.message}>
              <input {...register("nome_completo")} className={inputClass} placeholder="Nome completo" />
            </Field>
          </div>

          <Field label="E-mail" error={errors.email?.message}>
            <input {...register("email")} type="email" className={inputClass} placeholder="email@exemplo.com" />
          </Field>

          <Field label="Telefone / WhatsApp *" error={errors.telefone?.message}>
            <input {...register("telefone")} className={inputClass} placeholder="(00) 00000-0000" />
          </Field>

          <Field label="Telefone secundário">
            <input {...register("telefone_secundario")} className={inputClass} placeholder="(00) 00000-0000" />
          </Field>

          <Field label="Instagram">
            <input {...register("instagram")} className={inputClass} placeholder="@perfil ou link" />
          </Field>

          <Field label="CPF / CNPJ">
            <input {...register("cpf_cnpj")} className={inputClass} placeholder="000.000.000-00" />
          </Field>

          <SectionTitle>Perfil</SectionTitle>

          <Field label="Tipo de cliente">
            <select {...register("tipo_cliente")} className={selectClass}>
              <option value="">— Selecionar —</option>
              <option value="comprador">Comprador</option>
              <option value="locatario">Locatário</option>
              <option value="proprietario">Proprietário</option>
              <option value="investidor">Investidor</option>
            </select>
          </Field>

          <Field label="Status">
            <select {...register("status")} className={selectClass}>
              <option value="">— Selecionar —</option>
              <option value="ativo">Ativo</option>
              <option value="em_negociacao">Em negociação</option>
              <option value="inativo">Inativo</option>
              <option value="concluido">Concluído</option>
            </select>
          </Field>

          <Field label="Origem do lead">
            <select {...register("origem_lead")} className={selectClass}>
              <option value="">— Selecionar —</option>
              <option value="site">Site</option>
              <option value="indicacao">Indicação</option>
              <option value="ligacao">Ligação</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="outro">Outro</option>
            </select>
          </Field>

          <Field label="Como conheceu a imobiliária">
            <input {...register("como_conheceu")} className={inputClass} placeholder="Ex: Indicação de amigo" />
          </Field>

          {tipoSelecionado === "proprietario" && (
            <Field label="Código do imóvel" error={errors.imovel_codigo?.message}>
              <input
                {...register("imovel_codigo")}
                className={inputClass}
                placeholder="Ex: IMO-00001 (opcional)"
              />
            </Field>
          )}

          <SectionTitle>Endereço</SectionTitle>

          <div className="sm:col-span-2">
            <Field label="Endereço">
              <input {...register("endereco")} className={inputClass} placeholder="Rua, número, complemento" />
            </Field>
          </div>

          <Field label="Cidade">
            <input {...register("cidade")} className={inputClass} placeholder="Cidade" />
          </Field>

          <Field label="Estado">
            <select {...register("estado")} className={selectClass}>
              <option value="">— UF —</option>
              {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
              <option value="EX">EX — Exterior</option>
            </select>
          </Field>

          {estadoSelecionado === "EX" && (
            <Field label="País *" error={errors.pais?.message}>
              <input {...register("pais")} className={inputClass} placeholder="Ex: Portugal, EUA, Argentina" />
            </Field>
          )}

          <SectionTitle>Observações</SectionTitle>

          <div className="col-span-full">
            <Field label="Observações">
              <textarea
                {...register("observacoes")}
                rows={3}
                className={inputClass + " resize-none"}
                placeholder="Informações adicionais sobre o cliente..."
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-2.5 text-white text-sm font-medium rounded-lg transition hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: "#585a4f" }}
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
