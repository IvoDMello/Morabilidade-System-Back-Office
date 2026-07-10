"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  type CadastroForm,
  camposFaltando,
  formInicial,
  montarRequest,
} from "@/lib/cadastro-imovel";
import type { Captacao } from "@/types";

// Opções espelham os enums do back-office (api/app/schemas/imovel.py).
const TIPO_NEGOCIO = [
  { v: "venda", l: "Venda" },
  { v: "locacao", l: "Locação" },
  { v: "ambos", l: "Ambos" },
];
const TIPO_IMOVEL = [
  { v: "apartamento", l: "Apartamento" },
  { v: "cobertura", l: "Cobertura" },
  { v: "casa", l: "Casa" },
  { v: "casa_vila", l: "Casa de vila" },
  { v: "casa_condominio", l: "Casa de condomínio" },
  { v: "outro", l: "Outro" },
];
const CONDICAO = [
  { v: "novo", l: "Novo" },
  { v: "usado", l: "Usado" },
  { v: "em_construcao", l: "Em construção" },
  { v: "na_planta", l: "Na planta" },
];

const SELECT_CLS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function CadastrarImovel({ captacao }: { captacao: Captacao }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<CadastroForm>(() => formInicial(captacao));

  const set =
    (k: keyof CadastroForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const faltando = useMemo(() => camposFaltando(form), [form]);

  async function submit() {
    if (faltando.length) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/captacao/${captacao.id}/cadastrar-imovel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(montarRequest(form)),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Falha ao cadastrar o imóvel.");
        return;
      }
      toast.success(`Imóvel ${data.codigo} cadastrado no sistema.`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Erro de rede ao cadastrar o imóvel.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Building2 className="h-4 w-4" /> Cadastrar imóvel no sistema
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cadastrar imóvel no sistema</DialogTitle>
          <DialogDescription>
            Os dados da captação já vêm preenchidos. Complete os campos obrigatórios
            destacados e revise antes de gravar no back-office.
          </DialogDescription>
        </DialogHeader>

        {faltando.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Falta{faltando.length > 1 ? "m" : ""} {faltando.length} campo
              {faltando.length > 1 ? "s" : ""} obrigatório{faltando.length > 1 ? "s" : ""}:{" "}
              <strong>{faltando.join(", ")}</strong>.
            </span>
          </div>
        )}

        <div className="space-y-4">
          {/* Obrigatórios da integração */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Obrigatório para o cadastro
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo label="Tipo de negócio" obrigatorio vazio={!form.tipo_negocio}>
                <select className={SELECT_CLS} value={form.tipo_negocio} onChange={set("tipo_negocio")}>
                  {TIPO_NEGOCIO.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Tipo de imóvel" obrigatorio vazio={!form.tipo_imovel}>
                <select className={SELECT_CLS} value={form.tipo_imovel} onChange={set("tipo_imovel")}>
                  <option value="">Selecione…</option>
                  {TIPO_IMOVEL.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Condição" obrigatorio vazio={!form.condicao}>
                <select className={SELECT_CLS} value={form.condicao} onChange={set("condicao")}>
                  {CONDICAO.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
              </Campo>
            </div>

            {captacao.endereco && (
              <p className="text-xs text-muted-foreground">
                Endereço da captação: <span className="italic">{captacao.endereco}</span> — separe
                em logradouro, número e bairro abaixo.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Logradouro" obrigatorio vazio={!form.logradouro.trim()}>
                <Input value={form.logradouro} onChange={set("logradouro")} />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Número">
                  <Input value={form.numero} onChange={set("numero")} />
                </Campo>
                <Campo label="Complemento">
                  <Input value={form.complemento} onChange={set("complemento")} />
                </Campo>
              </div>
              <Campo label="Bairro" obrigatorio vazio={!form.bairro.trim()}>
                <Input value={form.bairro} onChange={set("bairro")} />
              </Campo>
              <Campo label="Cidade" obrigatorio vazio={!form.cidade.trim()}>
                <Input value={form.cidade} onChange={set("cidade")} />
              </Campo>
            </div>
          </section>

          {/* Pré-preenchidos pela captação */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Da captação (revise)
            </p>
            <div className="grid gap-3 sm:grid-cols-6">
              <Campo label="Andar">
                <Input inputMode="numeric" value={form.andar} onChange={set("andar")} />
              </Campo>
              <Campo label="Quartos">
                <Input inputMode="numeric" value={form.dormitorios} onChange={set("dormitorios")} />
              </Campo>
              <Campo label="Suítes">
                <Input inputMode="numeric" value={form.suites} onChange={set("suites")} />
              </Campo>
              <Campo label="Banheiros">
                <Input inputMode="numeric" value={form.banheiros} onChange={set("banheiros")} />
              </Campo>
              <Campo label="Vagas">
                <Input inputMode="numeric" value={form.vagas_garagem} onChange={set("vagas_garagem")} />
              </Campo>
              <Campo label="Área (m²)">
                <Input inputMode="decimal" value={form.area_util} onChange={set("area_util")} />
              </Campo>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Campo label="Valor de venda (R$)">
                <Input inputMode="decimal" value={form.valor_venda} onChange={set("valor_venda")} />
              </Campo>
              <Campo label="Valor de locação (R$)">
                <Input inputMode="decimal" value={form.valor_locacao} onChange={set("valor_locacao")} />
              </Campo>
              <Campo label="Condomínio (R$)">
                <Input inputMode="decimal" value={form.condominio_mensal} onChange={set("condominio_mensal")} />
              </Campo>
              <Campo label="IPTU (R$)">
                <Input inputMode="decimal" value={form.iptu_mensal} onChange={set("iptu_mensal")} />
              </Campo>
            </div>
            <Campo label="Observações internas (não aparecem no site)">
              <Input value={form.observacoes_internas} onChange={set("observacoes_internas")} />
            </Campo>
          </section>

          {/* Proprietário */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Proprietário (vira um cliente)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Nome do proprietário" obrigatorio vazio={!form.prop_nome.trim()}>
                <Input value={form.prop_nome} onChange={set("prop_nome")} />
              </Campo>
              <Campo label="WhatsApp">
                <Input value={form.prop_whatsapp} onChange={set("prop_whatsapp")} />
              </Campo>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || faltando.length > 0}>
            {saving ? "Cadastrando…" : "Cadastrar imóvel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  label,
  obrigatorio,
  vazio,
  children,
}: {
  label: string;
  obrigatorio?: boolean;
  vazio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className={cn(obrigatorio && vazio && "text-destructive")}>
        {label}
        {obrigatorio && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
