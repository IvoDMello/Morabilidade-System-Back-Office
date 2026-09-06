import { cache } from "react";
import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BedDouble, Bath, Car, Scan, DoorOpen, Hotel, Building2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Sobrepõe o viewport travado do layout raiz: aqui o visitante é um cliente
 * olhando fotos de imóvel no celular e precisa poder ampliar. As outras duas
 * camadas da trava (gesture* e touch-action) saem no <ZoomLock />.
 */
export const viewport: Viewport = {
  themeColor: "#585a4f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

const BUCKET = "captacoes";
// Assinatura longa: o link fica útil no WhatsApp por uma semana; a página é
// dinâmica, então cada visita re-assina do zero.
const EXPIRA_S = 7 * 24 * 3600;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Publica {
  id: string;
  endereco: string;
  unidade: string | null;
  bairro: string | null;
  andar: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  metragem: number | null;
  tipo_portaria: string | null;
  valor_venda: number | null;
  valor_aluguel: number | null;
  valor_condominio: number | null;
  valor_iptu: number | null;
  capa_path: string | null;
}

/**
 * Busca a captação pelo token público. Roda com service_role (a página não
 * tem sessão), mas expõe SOMENTE os campos do imóvel — nada de proprietário,
 * telefone, observações internas ou opiniões.
 */
const getCaptacao = cache(async (token: string) => {
  if (!UUID_RE.test(token)) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("captacao")
    .select(
      "id,endereco,unidade,bairro,andar,quartos,suites,banheiros,vagas,metragem,tipo_portaria,valor_venda,valor_aluguel,valor_condominio,valor_iptu,capa_path"
    )
    .eq("share_token", token)
    .is("excluido_em", null)
    .maybeSingle();
  if (!data) return null;
  const c = data as Publica;

  const { data: midias } = await supabase
    .from("midia")
    .select("storage_path")
    .eq("captacao_id", c.id)
    .eq("tipo", "foto")
    .order("ordem");

  const paths = (midias ?? []).map((m) => m.storage_path as string).filter(Boolean);
  let fotos: string[] = [];
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, EXPIRA_S);
    fotos = (signed ?? []).flatMap((s) => (s.signedUrl ? [s.signedUrl] : []));
  }
  let capa: string | null = fotos[0] ?? null;
  if (c.capa_path) {
    const { data: s } = await supabase.storage.from(BUCKET).createSignedUrl(c.capa_path, EXPIRA_S);
    capa = s?.signedUrl ?? capa;
  }
  return { c, fotos, capa };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const res = await getCaptacao(token);
  if (!res) return { title: "Imóvel não encontrado" };
  const { c, capa } = res;
  const partes = [
    c.quartos != null && `${c.quartos} quarto${c.quartos === 1 ? "" : "s"}`,
    c.metragem != null && `${c.metragem} m²`,
    c.bairro,
  ].filter(Boolean);
  return {
    title: `${c.endereco} · Morabilidade`,
    description: partes.join(" · ") || "Veja as fotos e os detalhes do imóvel.",
    robots: { index: false },
    // Limpa o manifest herdado do layout raiz: nada de oferecer ao cliente a
    // instalação do PWA interno, cujo start_url é o quadro atrás do login.
    manifest: null,
    openGraph: {
      title: c.endereco,
      description: partes.join(" · "),
      images: capa ? [{ url: capa }] : undefined,
    },
  };
}

export default async function CaptacaoPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await getCaptacao(token);
  if (!res) notFound();
  const { c, fotos, capa } = res;

  const specs: { icon: typeof BedDouble; valor: string; label: string }[] = [];
  if (c.quartos != null) specs.push({ icon: BedDouble, valor: String(c.quartos), label: c.quartos === 1 ? "quarto" : "quartos" });
  if (c.suites != null && c.suites > 0) specs.push({ icon: Hotel, valor: String(c.suites), label: c.suites === 1 ? "suíte" : "suítes" });
  if (c.banheiros != null) specs.push({ icon: Bath, valor: String(c.banheiros), label: c.banheiros === 1 ? "banheiro" : "banheiros" });
  if (c.vagas != null && c.vagas > 0) specs.push({ icon: Car, valor: String(c.vagas), label: c.vagas === 1 ? "vaga" : "vagas" });
  if (c.metragem != null) specs.push({ icon: Scan, valor: `${c.metragem}`, label: "m²" });
  if (c.andar != null) specs.push({ icon: Building2, valor: `${c.andar}º`, label: "andar" });
  if (c.tipo_portaria) specs.push({ icon: DoorOpen, valor: c.tipo_portaria, label: "portaria" });

  const valores = [
    { label: "Venda", v: c.valor_venda, destaque: true },
    { label: "Aluguel", v: c.valor_aluguel, destaque: true, sufixo: "/mês" },
    { label: "Condomínio", v: c.valor_condominio },
    { label: "IPTU", v: c.valor_iptu },
  ].filter((x) => x.v != null);

  return (
    <main className="min-h-dvh bg-[#f3f4f0] pb-12">
      {/* Marca */}
      <header
        className="px-5 py-4 text-[#f3f4f0]"
        style={{ background: "linear-gradient(150deg,#2c2e28 0%,#585a4f 58%,#454840 100%)" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d8cb6a]">
          Morabilidade
        </p>
        <p className="mt-0.5 text-sm text-[#cfd0c9]">Apresentação de imóvel</p>
      </header>

      <div className="mx-auto max-w-2xl px-4">
        {/* Capa */}
        {capa && (
          <div className="relative mt-4 aspect-[16/10] w-full overflow-hidden rounded-2xl bg-[#e2e3dd] shadow-[0_10px_30px_-18px_rgba(46,48,42,0.4)]">
            <Image src={capa} alt={c.endereco} fill priority sizes="(max-width: 672px) 100vw, 672px" className="object-cover" />
          </div>
        )}

        {/* Título */}
        <h1 className="mt-5 font-serif text-[26px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#2e302a]">
          {c.endereco}
        </h1>
        {c.bairro && <p className="mt-1 text-[15px] text-[#7a7d70]">{c.bairro}</p>}

        {/* Specs */}
        {specs.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {specs.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#e8e9e3] bg-white px-3 py-1.5 text-sm text-[#4a4d43]"
              >
                <s.icon className="h-4 w-4 text-[#9a8d3a]" />
                <strong className="font-semibold">{s.valor}</strong> {s.label}
              </span>
            ))}
          </div>
        )}

        {/* Valores */}
        {valores.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {valores.map((x) => (
              <div key={x.label} className="rounded-2xl border border-[#e8e9e3] bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9a9c90]">
                  {x.label}
                </p>
                <p
                  className={
                    x.destaque
                      ? "mt-1 text-lg font-bold text-[#857727]"
                      : "mt-1 text-base font-semibold text-[#4a4d43]"
                  }
                >
                  {formatBRL(x.v!)}
                  {"sufixo" in x && x.sufixo && (
                    <span className="text-sm font-medium text-[#9a9c90]">{x.sufixo}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Galeria */}
        {fotos.length > 1 && (
          <>
            <h2 className="mt-7 font-serif text-lg font-semibold text-[#2e302a]">Fotos</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {fotos.slice(1).map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#e2e3dd]"
                >
                  <Image src={url} alt="" fill loading="lazy" sizes="(max-width: 672px) 50vw, 336px" className="object-cover transition-transform duration-300 hover:scale-[1.03]" />
                </a>
              ))}
            </div>
          </>
        )}

        <footer className="mt-10 border-t border-[#e2e3dd] pt-4 text-center text-xs text-[#9a9c90]">
          Compartilhado pela equipe Morabilidade.
        </footer>
      </div>
    </main>
  );
}
