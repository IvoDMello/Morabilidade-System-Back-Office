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

const numToStr = (n: number | null | undefined) => (n == null ? "" : String(n));
const strToNum = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

type FormState = {
  tipo_negocio: string;
  tipo_imovel: string;
  condicao: string;
  cidade: string;
  bairro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  dormitorios: string;
  suites: string;
  banheiros: string;
  vagas_garagem: string;
  area_util: string;
  valor_venda: string;
  condominio_mensal: string;
  iptu_mensal: string;
  instagram_url: string;
  prop_nome: string;
  prop_whatsapp: string;
};

export function CadastrarImovel({ captacao }: { captacao: Captacao }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>({
    // obrigatórios da integração — defaults seguros, mas editáveis
    tipo_negocio: "venda",
    tipo_imovel: "",
    condicao: "usado",
    cidade: "Rio de Janeiro",
    bairro: "",
    logradouro: captacao.endereco ?? "",
    numero: "",
    complemento: "",
    // pré-preenchidos a partir da captação
    dormitorios: numToStr(captacao.quartos),
    suites: numToStr(captacao.suites),
    banheiros: numToStr(captacao.banheiros),
    vagas_garagem: numToStr(captacao.vagas),
    area_util: numToStr(captacao.metragem),
    valor_venda: numToStr(captacao.valor_venda),
    condominio_mensal: numToStr(captacao.valor_condominio),
    iptu_mensal: numToStr(captacao.valor_iptu),
    instagram_url: captacao.anuncio_url ?? "",
    prop_nome: captacao.proprietario_nome ?? "",
    prop_whatsapp: captacao.whatsapp ?? "",
  });

  const set =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const faltando = useMemo(() => {
    const req: [keyof FormState, string][] = [
      ["tipo_negocio", "Tipo de negócio"],
      ["tipo_imovel", "Tipo de imóvel"],
      ["condicao", "Condição"],
      ["cidade", "Cidade"],
      ["bairro", "Bairro"],
      ["logradouro", "Logradouro"],
      ["prop_nome", "Nome do proprietário"],
    ];
    return req.filter(([k]) => !form[k].trim()).map(([, l]) => l);
  }, [form]);

  async function submit() {
    if (faltando.length) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/captacao/${captacao.id}/cadastrar-imovel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proprietario: {
            nome_completo: form.prop_nome.trim(),
            telefone: form.prop_whatsapp.trim(),
          },
          imovel: {
            tipo_negocio: form.tipo_negocio,
            tipo_imovel: form.tipo_imovel,
            condicao: form.condicao,
            cidade: form.cidade.trim(),
            bairro: form.bairro.trim(),
            logradouro: form.logradouro.trim(),
            numero: form.numero.trim() || null,
            complemento: form.complemento.trim() || null,
            dormitorios: strToNum(form.dormitorios),
            suites: strToNum(form.suites),
            banheiros: strToNum(form.banheiros),
            vagas_garagem: strToNum(form.vagas_garagem),
            area_util: strToNum(form.area_util),
            valor_venda: strToNum(form.valor_venda),
            condominio_mensal: strToNum(form.condominio_mensal),
            iptu_mensal: strToNum(form.iptu_mensal),
            instagram_url: form.instagram_url.trim() || null,
          },
        }),
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
            <div className="grid gap-3 sm:grid-cols-5">
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
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo label="Valor de venda (R$)">
                <Input inputMode="decimal" value={form.valor_venda} onChange={set("valor_venda")} />
              </Campo>
              <Campo label="Condomínio (R$)">
                <Input inputMode="decimal" value={form.condominio_mensal} onChange={set("condominio_mensal")} />
              </Campo>
              <Campo label="IPTU (R$)">
                <Input inputMode="decimal" value={form.iptu_mensal} onChange={set("iptu_mensal")} />
              </Campo>
            </div>
            <Campo label="Link do anúncio (Instagram)">
              <Input value={form.instagram_url} onChange={set("instagram_url")} />
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
