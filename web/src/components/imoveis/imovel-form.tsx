"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Tag, User } from "@/types";

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
  tipo_negocio: z.enum(["venda", "locacao", "ambos"]),
  disponibilidade: z.enum(["disponivel", "reservado", "vendido_locado"]),
  condicao: z.enum(["em_construcao", "na_planta", "novo", "usado"]),
  cep: z.string().optional(),
  logradouro: z.string().min(1, "Logradouro obrigatório"),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().min(1, "Bairro obrigatório"),
  cidade: z.string().min(1, "Cidade obrigatória"),
  tipo_imovel: z.enum(["casa", "apartamento", "terreno", "sala", "galpao", "loja", "cobertura", "kitnet", "outro"]),
  dormitorios: optInt,
  suites: optInt,
  banheiros: optInt,
  vagas_garagem: optInt,
  mobiliado: z.preprocess(
    (v) => (v === "" ? null : v),
    z.enum(["sim", "nao", "semi-mobiliado"]).nullable().optional()
  ),
  andar: optInt,
  area_total: optPositive,
  area_util: optPositive,
  valor_venda: optPositive,
  valor_locacao: optPositive,
  iptu_mensal: optPositive,
  condominio_mensal: optPositive,
  descricao: z.string().optional(),
  video_url: z.string().optional(),
  corretor_id: z.string().optional().nullable(),
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
  const [cepLoading, setCepLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
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

  const tipoNegocio = watch("tipo_negocio");
  const selectedTagIds = watch("tag_ids") ?? [];

  useEffect(() => {
    api.get<Tag[]>("/tags/").then((r) => setTags(r.data)).catch(() => {});
    api.get<User[]>("/usuarios/").then((r) => setUsers(r.data)).catch(() => {});
  }, []);

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

  function toggleTag(id: string) {
    const current = selectedTagIds;
    const updated = current.includes(id)
      ? current.filter((t) => t !== id)
      : [...current, id];
    setValue("tag_ids", updated);
  }

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Botão de salvar no topo (atalho — evita rolar até o final) */}
      <div className="flex justify-end">{submitButton}</div>

      {/* ── 1. Identificação ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <SectionTitle>Identificação</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <option value="casa">Casa</option>
              <option value="apartamento">Apartamento</option>
              <option value="terreno">Terreno</option>
              <option value="sala">Sala comercial</option>
              <option value="galpao">Galpão</option>
              <option value="loja">Loja</option>
              <option value="cobertura">Cobertura</option>
              <option value="kitnet">Kitnet / Studio</option>
              <option value="outro">Outro</option>
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
              <input type="number" step="0.01" min={0} {...register("valor_venda")} className={inputClass} placeholder="0,00" />
              <FieldError message={errors.valor_venda?.message} />
            </div>
          )}

          {(tipoNegocio === "locacao" || tipoNegocio === "ambos") && (
            <div>
              <Label>Valor de locação (R$)</Label>
              <input type="number" step="0.01" min={0} {...register("valor_locacao")} className={inputClass} placeholder="0,00" />
              <FieldError message={errors.valor_locacao?.message} />
            </div>
          )}

          <div>
            <Label>IPTU mensal (R$)</Label>
            <input type="number" step="0.01" min={0} {...register("iptu_mensal")} className={inputClass} placeholder="0,00" />
          </div>

          <div>
            <Label>Condomínio mensal (R$)</Label>
            <input type="number" step="0.01" min={0} {...register("condominio_mensal")} className={inputClass} placeholder="0,00" />
          </div>
        </div>
      </div>

      {/* ── 5. Informações adicionais ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <SectionTitle>Informações adicionais</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <Label>Descrição</Label>
            <textarea
              {...register("descricao")}
              rows={4}
              className={inputClass + " resize-none"}
              placeholder="Descreva o imóvel..."
            />
          </div>

          <div>
            <Label>Link do vídeo (YouTube / Vimeo)</Label>
            <input {...register("video_url")} className={inputClass} placeholder="https://..." />
            <FieldError message={errors.video_url?.message} />
          </div>

          <div>
            <Label>Corretor responsável</Label>
            <select {...register("corretor_id")} className={selectClass}>
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
