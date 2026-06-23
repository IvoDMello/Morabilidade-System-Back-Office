"use client";

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
  onSubmit: (data: CaptacaoInput) => Promise<void>;
  submitLabel?: string;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CaptacaoInput>({
    resolver: zodResolver(captacaoSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="endereco">Endereço *</Label>
        <Input id="endereco" {...register("endereco")} />
        {errors.endereco && <p className="text-xs text-destructive">{errors.endereco.message}</p>}
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="valor_venda">Valor de venda (R$)</Label>
          <Input id="valor_venda" inputMode="decimal" placeholder="0,00" {...register("valor_venda")} />
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

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
