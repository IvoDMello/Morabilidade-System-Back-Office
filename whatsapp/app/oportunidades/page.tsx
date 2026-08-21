import { OportunidadesView } from "@/features/oportunidades/components/oportunidades-view";
import { getPainelOportunidades } from "@/services/oportunidades.service";

interface OportunidadesPageProps {
  /** `?c=<contactId>` abre a linha daquele contato já expandida. */
  searchParams: Promise<{ c?: string }>;
}

/**
 * Oportunidades: o cruzamento cliente × catálogo trazido para o lado da
 * conversa.
 *
 * O painel web já sabia dizer quais imóveis combinam com cada cliente, mas a
 * resposta morria lá — entre saber e mandar mensagem havia abrir o WhatsApp,
 * achar a pessoa, copiar código, procurar preço e escrever tudo à mão. Aqui as
 * duas pontas ficam na mesma tela: a lista sai com o texto pronto e o botão de
 * enviar do lado.
 */
export default async function OportunidadesPage({ searchParams }: OportunidadesPageProps) {
  const [params, painel] = await Promise.all([searchParams, getPainelOportunidades()]);

  // Lido no servidor e passado adiante: o rascunho é montado no cliente, mas o
  // link do site é configuração, não estado da tela.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="hidden md:block">
        <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Oportunidades</h1>
        <p className="mt-0.5 text-[13px] text-ink-dim">
          Imóveis do catálogo que combinam com o que cada contato procura — com a mensagem
          pronta para enviar.
        </p>
      </div>

      <OportunidadesView painel={painel} siteUrl={siteUrl} contatoDestacado={params.c} />
    </div>
  );
}
