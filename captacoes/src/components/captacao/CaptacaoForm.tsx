"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { captacaoSchema, type CaptacaoInput } from "@/lib/schemas";
import { maskTelefone } from "@/lib/format";

export function CaptacaoForm({
  defaultValues,
  onSubmit,
  submitLabel = "Salvar",
}: {
  defaultValues?: Partial<CaptacaoInput>;
  /** Retornar false sinaliza falha: o formulário continua marcado como sujo. */
  onSubmit: (data: CaptacaoInput) => Promise<void | boolean>;
  submitLabel?: string;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CaptacaoInput>({
    resolver: zodResolver(captacaoSchema),
    defaultValues,
  });

  // Alterações não salvas: avisa antes de fechar/recarregar a aba.
  useEffect(() => {
    if (!isDirty) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [isDirty]);

  async function submeter(data: CaptacaoInput) {
    const ok = await onSubmit(data);
    // Salvou: os valores atuais viram a nova base (limpa o estado "sujo").
    if (ok !== false) reset(data);
  }

  return (
    <form onSubmit={handleSubmit(submeter)} className="space-y-4">
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="endereco">Endereço *</Label>
          <Input id="endereco" {...register("endereco")} />
          {errors.endereco && <p className="text-xs text-destructive">{errors.endereco.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unidade">Apto / unidade</Label>
          <Input id="unidade" placeholder="302" {...register("unidade")} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_120px] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bairro">Bairro</Label>
          <Input id="bairro" {...register("bairro")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="andar">Andar</Label>
          <Input id="andar" type="number" min={0} {...register("andar")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="quartos">Quartos</Label>
          <Input id="quartos" type="number" min={0} {...register("quartos")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="suites">Suítes</Label>
          <Input id="suites" type="number" min={0} {...register("suites")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="banheiros">Banheiros</Label>
          <Input id="banheiros" type="number" min={0} {...register("banheiros")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vagas">Vagas</Label>
          <Input id="vagas" type="number" min={0} {...register("vagas")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="metragem">Metragem (m²)</Label>
          <Input id="metragem" type="number" min={0} step="0.01" {...register("metragem")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tipo_portaria">Tipo de portaria</Label>
        <Input id="tipo_portaria" {...register("tipo_portaria")} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="proprietario_nome">Nome do proprietário</Label>
          <Input id="proprietario_nome" {...register("proprietario_nome")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Controller
            control={control}
            name="whatsapp"
            render={({ field }) => (
              <Input
                id="whatsapp"
                inputMode="tel"
                placeholder="(11) 98888-7777"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(maskTelefone(e.target.value))}
              />
            )}
          />
          {errors.whatsapp && <p className="text-xs text-destructive">{errors.whatsapp.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="valor_venda">Valor de venda (R$)</Label>
          <Input id="valor_venda" inputMode="decimal" placeholder="0,00" {...register("valor_venda")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="valor_aluguel">Aluguel pedido (R$)</Label>
          <Input id="valor_aluguel" inputMode="decimal" placeholder="0,00" {...register("valor_aluguel")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="valor_condominio">Condomínio (R$)</Label>
          <Input id="valor_condominio" inputMode="decimal" placeholder="0,00" {...register("valor_condominio")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="valor_iptu">IPTU (R$)</Label>
          <Input id="valor_iptu" inputMode="decimal" placeholder="0,00" {...register("valor_iptu")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="anuncio_url">Link do anúncio</Label>
        <Input id="anuncio_url" inputMode="url" placeholder="https://..." {...register("anuncio_url")} />
        {errors.anuncio_url && <p className="text-xs text-destructive">{errors.anuncio_url.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" {...register("observacoes")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pendencias">Pendências / dificuldades</Label>
        <Textarea id="pendencias" {...register("pendencias")} placeholder="Relevante na coluna 'Aguardando informações'" />
      </div>

      <div className="flex items-center justify-end gap-3">
        {isDirty && !isSubmitting && (
          <span className="text-xs font-medium text-amber-600">Alterações não salvas</span>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
