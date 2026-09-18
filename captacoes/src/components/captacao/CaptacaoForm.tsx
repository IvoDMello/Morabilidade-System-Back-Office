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
import { cn } from "@/lib/utils";
import { TelefoneJaCadastrado } from "./TelefoneJaCadastrado";

/**
 * Rótulo em versalete: o formulário é longo e quase todo campo de texto — com
 * rótulo do mesmo peso do conteúdo, a coluna virava uma parede cinza. Miúdo e
 * espaçado, ele sai da frente e o valor preenchido é que lidera.
 */
const ROTULO = "text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7a7d70]";

/** Campo alto o bastante para o polegar, que é como este app é preenchido. */
const CAMPO = "h-12 rounded-xl border-[#e2e3dd] bg-white px-3.5 text-[15px]";

/**
 * Número dentro da caixinha de composição. Sem as setinhas do `number`: elas
 * roubam metade da largura útil de uma caixa de 58px e ninguém incrementa
 * metragem de um em um.
 */
const NUMERO =
  "w-full bg-transparent text-center text-[17px] font-bold leading-none text-[#2e302a] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/** Uma caixa da composição: o número grande e a unidade miúda por baixo. */
function CaixaNumero({
  id,
  rotulo,
  destaque = false,
  children,
}: {
  id: string;
  rotulo: string;
  /** A metragem puxa a cor da casa: é o número que define o imóvel. */
  destaque?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-text flex-col items-center rounded-xl border px-1 pb-1.5 pt-2.5 focus-within:ring-2 focus-within:ring-ring",
        destaque ? "border-[#e6dfb8] bg-[#f7f3e8]" : "border-[#e2e3dd] bg-white"
      )}
    >
      {children}
      <span className="mt-1.5 text-[8.5px] font-semibold uppercase tracking-[0.06em] text-[#8b8e82]">
        {rotulo}
      </span>
    </label>
  );
}

export function CaptacaoForm({
  defaultValues,
  onSubmit,
  submitLabel = "Salvar",
  checarTelefone = false,
}: {
  defaultValues?: Partial<CaptacaoInput>;
  /** Retornar false sinaliza falha: o formulário continua marcado como sujo. */
  onSubmit: (data: CaptacaoInput) => Promise<void | boolean>;
  submitLabel?: string;
  /**
   * Avisa, ao digitar o WhatsApp, se o número já tem captação. Só faz sentido
   * onde o store do quadro está hidratado (é dele que sai a lista) — hoje, no
   * cadastro de captação nova.
   */
  checarTelefone?: boolean;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
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
      <div className="space-y-1.5">
        <Label htmlFor="endereco" className={ROTULO}>
          Endereço *
        </Label>
        <Input id="endereco" className={CAMPO} {...register("endereco")} />
        {errors.endereco && <p className="text-xs text-destructive">{errors.endereco.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="apto" className={ROTULO}>
            Apto
          </Label>
          <Input id="apto" placeholder="302" className={CAMPO} {...register("apto")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unidade" className={ROTULO}>
            Unidade
          </Label>
          <Input id="unidade" placeholder="—" className={CAMPO} {...register("unidade")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bairro" className={ROTULO}>
          Bairro
        </Label>
        <Input id="bairro" className={CAMPO} {...register("bairro")} />
      </div>

      {/* Composição em caixinhas: são cinco números de um ou dois dígitos que
          se leem juntos ("2/1/1/1/210"), não cinco campos de texto. Assim
          cabem numa linha só no celular e a ficha do imóvel se lê de relance,
          do mesmo jeito que aparece no cartão da fila. */}
      <div className="space-y-1.5">
        <span className={cn(ROTULO, "block")}>Composição</span>
        <div className="grid grid-cols-5 gap-2">
          <CaixaNumero id="quartos" rotulo="quartos">
            <input id="quartos" type="number" min={0} className={NUMERO} {...register("quartos")} />
          </CaixaNumero>
          <CaixaNumero id="suites" rotulo="suítes">
            <input id="suites" type="number" min={0} className={NUMERO} {...register("suites")} />
          </CaixaNumero>
          <CaixaNumero id="banheiros" rotulo="banh.">
            <input id="banheiros" type="number" min={0} className={NUMERO} {...register("banheiros")} />
          </CaixaNumero>
          <CaixaNumero id="vagas" rotulo="vagas">
            <input id="vagas" type="number" min={0} className={NUMERO} {...register("vagas")} />
          </CaixaNumero>
          <CaixaNumero id="metragem" rotulo="m²" destaque>
            <input
              id="metragem"
              type="number"
              min={0}
              step="0.01"
              className={NUMERO}
              {...register("metragem")}
            />
          </CaixaNumero>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tipo_portaria" className={ROTULO}>
          Tipo de portaria
        </Label>
        <Input id="tipo_portaria" className={CAMPO} {...register("tipo_portaria")} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="proprietario_nome" className={ROTULO}>
            Nome do proprietário
          </Label>
          <Input id="proprietario_nome" className={CAMPO} {...register("proprietario_nome")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp" className={ROTULO}>
            WhatsApp
          </Label>
          <Controller
            control={control}
            name="whatsapp"
            render={({ field }) => (
              <Input
                id="whatsapp"
                className={CAMPO}
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

      {checarTelefone && (
        <TelefoneJaCadastrado
          whatsapp={watch("whatsapp")}
          onUsarProprietario={(nome) =>
            setValue("proprietario_nome", nome, { shouldDirty: true })
          }
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="valor_venda" className={ROTULO}>
            Valor de venda (R$)
          </Label>
          <Input id="valor_venda" className={CAMPO} inputMode="decimal" placeholder="0,00" {...register("valor_venda")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="valor_aluguel" className={ROTULO}>
            Aluguel pedido (R$)
          </Label>
          <Input id="valor_aluguel" className={CAMPO} inputMode="decimal" placeholder="0,00" {...register("valor_aluguel")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="valor_condominio" className={ROTULO}>
            Condomínio (R$)
          </Label>
          <Input id="valor_condominio" className={CAMPO} inputMode="decimal" placeholder="0,00" {...register("valor_condominio")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="valor_iptu" className={ROTULO}>
            IPTU (R$)
          </Label>
          <Input id="valor_iptu" className={CAMPO} inputMode="decimal" placeholder="0,00" {...register("valor_iptu")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="anuncio_url" className={ROTULO}>
            Link do anúncio
          </Label>
        <Input id="anuncio_url" className={CAMPO} inputMode="url" placeholder="https://..." {...register("anuncio_url")} />
        {errors.anuncio_url && <p className="text-xs text-destructive">{errors.anuncio_url.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="observacoes" className={ROTULO}>
            Observações
          </Label>
        <Textarea id="observacoes" className="rounded-xl border-[#e2e3dd] bg-white text-[15px]" {...register("observacoes")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pendencias" className={ROTULO}>
            Pendências / dificuldades
          </Label>
        <Textarea
          id="pendencias"
          className="rounded-xl border-[#e2e3dd] bg-white text-[15px]"
          placeholder="O que trava esta captação"
          {...register("pendencias")}
        />
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
