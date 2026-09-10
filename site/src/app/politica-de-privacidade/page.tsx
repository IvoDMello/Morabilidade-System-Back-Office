import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como a Morabilidade coleta, usa, compartilha e protege dados pessoais, e como exercer seus direitos previstos na LGPD.",
};

/**
 * Política de Privacidade — exigida pela LGPD e pelo Google, que só libera a
 * publicação do app OAuth (o espelho das visitas na Google Agenda) para apps
 * com esta página no ar em domínio verificado.
 *
 * O conteúdo descreve o que o sistema DE FATO faz. Se um fluxo de dados mudar,
 * esta página muda junto — declarar coleta que não existe é tão problemático
 * quanto omitir a que existe. As referências, na data desta redação:
 *   - medição de navegação sem IP: api/app/routers/analytics.py
 *   - favoritos apenas no navegador: site/src/components/imoveis/FavoritoButton.tsx
 *   - ficha de visita e trilha da assinatura: api/app/routers/ficha.py
 */

/** Data da última revisão do texto. Atualizar junto com qualquer mudança. */
const ATUALIZADO_EM = "9 de setembro de 2026";

/** CNPJ fica vazio até confirmação, igual a `empresa_cnpj` em api/app/config.py. */
const CNPJ = "";

/** Mesmo endereço de `email_contato` em api/app/config.py — não criar caixa nova. */
const EMAIL = "contato@morabilidade.com";
const TELEFONE = "(21) 99772-9990";

export default function PoliticaDePrivacidadePage() {
  return (
    <>
      <Navbar />

      {/* ── Cabeçalho ── */}
      <div
        style={{
          backgroundColor: "var(--olive)",
          padding: "clamp(48px,6vw,72px) clamp(20px,5vw,48px)",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--gold)",
              marginBottom: 16,
            }}
          >
            Privacidade
          </p>
          <h1
            className="font-serif text-white"
            style={{
              fontSize: "clamp(28px,5vw,48px)",
              fontWeight: 500,
              lineHeight: 1.15,
              marginBottom: 16,
            }}
          >
            Política de Privacidade
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "rgba(252,252,252,0.62)",
              lineHeight: 1.8,
              maxWidth: 560,
              margin: "0 auto",
            }}
          >
            Como tratamos dados pessoais na Morabilidade, em linguagem direta.
            Atualizada em {ATUALIZADO_EM}.
          </p>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      <div
        style={{
          backgroundColor: "var(--offwhite)",
          padding: "clamp(48px,6vw,72px) clamp(20px,5vw,48px)",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Secao titulo="Quem é responsável pelos seus dados">
            <P>
              A Morabilidade é uma imobiliária digital que atua na Zona Sul do Rio de Janeiro,
              inscrita no CRECI sob o nº J 13167{CNPJ && `, CNPJ ${CNPJ}`}. Somos a
              controladora dos dados pessoais descritos nesta política — ou seja, quem decide
              por que e como eles são tratados.
            </P>
            <P>
              Para qualquer assunto relacionado a privacidade, fale com a gente por{" "}
              <A href={`mailto:${EMAIL}`}>{EMAIL}</A> ou pelo WhatsApp {TELEFONE}.
            </P>
          </Secao>

          <Secao titulo="Que dados coletamos">
            <P>
              Depende do que você faz. Não temos formulário de cadastro no site: navegar por
              imóveis não exige que você se identifique.
            </P>

            <Item titulo="Ao navegar pelo site">
              Registramos um identificador aleatório de sessão (gerado no seu navegador, sem
              relação com sua identidade), as páginas visitadas, o código do imóvel consultado,
              a página que trouxe você até aqui e o tipo de navegador. Serve para entendermos
              quais imóveis despertam interesse.{" "}
              <strong>Não armazenamos o seu endereço IP nessa medição.</strong>
            </Item>

            <Item titulo="Ao favoritar imóveis">
              A lista de favoritos fica salva apenas no seu próprio navegador. Ela não é
              enviada para nós e não sai do seu aparelho.
            </Item>

            <Item titulo="Ao assinar uma ficha de visita">
              Quem visita um imóvel acompanhado da nossa equipe recebe um link para assinar o
              termo de visita. Nele coletamos nome, CPF, e quando informados RG, telefone e
              e-mail, além da assinatura que você desenha na tela. Junto com a assinatura
              guardamos data, hora, endereço IP e localização aproximada do acesso — são a
              prova de autoria e integridade exigida de uma assinatura eletrônica, e existem
              para proteger as duas partes.
            </Item>

            <Item titulo="Ao falar com a gente">
              Se você nos procura por WhatsApp, Instagram ou telefone, ficamos com o conteúdo
              da conversa e o contato usado, para dar continuidade ao atendimento.
            </Item>

            <Item titulo="Se você anuncia um imóvel com a gente">
              Tratamos os dados necessários à intermediação: nome, contato, dados do imóvel e
              a documentação exigida pela legislação imobiliária.
            </Item>
          </Secao>

          <Secao titulo="Para que usamos">
            <Lista
              itens={[
                "Apresentar imóveis e responder ao seu contato.",
                "Agendar e organizar visitas, o que inclui registrar o compromisso na agenda da equipe.",
                "Documentar a visita ao imóvel, por meio do termo assinado.",
                "Intermediar a compra, venda ou locação, quando é o caso.",
                "Entender quais imóveis e páginas têm mais interesse, para melhorar o site.",
                "Cumprir obrigações legais e regulatórias, inclusive as do CRECI, e exercer direitos em processos.",
              ]}
            />
            <P>
              Não usamos seus dados para publicidade comportamental, não fazemos decisões
              automatizadas sobre você e <strong>não vendemos dados pessoais</strong>.
            </P>
          </Secao>

          <Secao titulo="Com que base legal">
            <P>
              A LGPD exige uma justificativa para cada tratamento. Usamos, conforme o caso: a
              execução de contrato e os procedimentos preliminares a ele (art. 7º, V) para o
              atendimento, a visita e a intermediação; o cumprimento de obrigação legal ou
              regulatória (art. 7º, II) para os registros que a lei nos obriga a manter; o
              legítimo interesse (art. 7º, IX) para a medição de navegação e a segurança do
              sistema; e o seu consentimento (art. 7º, I) quando pedimos algo que não se
              encaixa nas hipóteses anteriores.
            </P>
          </Secao>

          <Secao titulo="Com quem compartilhamos">
            <P>
              Não vendemos nem cedemos dados para terceiros usarem por conta própria.
              Compartilhamos apenas com quem precisamos para operar, e apenas o necessário:
            </P>
            <Lista
              itens={[
                "Provedores de infraestrutura que hospedam o site, a aplicação e o banco de dados.",
                "Serviço de armazenamento das fotos dos imóveis.",
                "Serviço de envio de e-mails transacionais.",
                "Google Agenda, para registrar os compromissos de visita da equipe.",
                "WhatsApp e Instagram (Meta), quando o atendimento acontece por esses canais.",
                "Serviço de monitoramento de erros, que recebe dados técnicos de falhas.",
                "Profissionais e autoridades, quando a lei exige ou para exercer direitos.",
              ]}
            />
            <P>
              Parte desses serviços fica fora do Brasil, o que caracteriza transferência
              internacional de dados. Nesses casos, contratamos fornecedores que oferecem
              garantias de proteção compatíveis com a LGPD.
            </P>
          </Secao>

          <Secao titulo="Cookies e armazenamento no navegador">
            <P>
              Não usamos cookies de rastreamento, de perfilamento ou de publicidade, nem
              ferramentas de terceiros para medir audiência. A medição de navegação é nossa e
              usa o <em>sessionStorage</em> do navegador, que é apagado quando você fecha a
              aba. Os imóveis favoritos ficam no <em>localStorage</em>, também no seu aparelho.
              Você pode limpar os dois nas configurações do navegador, a qualquer momento, sem
              perder acesso a nada do site.
            </P>
          </Secao>

          <Secao titulo="Por quanto tempo guardamos">
            <P>
              Mantemos cada dado pelo tempo necessário à finalidade que o justificou. Fichas de
              visita, contratos e registros de intermediação são preservados pelos prazos
              exigidos pela legislação imobiliária, fiscal e civil, inclusive para nossa defesa
              em eventual processo. Dados de navegação são mantidos em forma agregada, sem
              identificar pessoas. Encerrada a finalidade e vencidos os prazos legais, os dados
              são eliminados ou anonimizados.
            </P>
          </Secao>

          <Secao titulo="Seus direitos">
            <P>
              A LGPD garante a você, a qualquer momento e sem custo, o direito de pedir:
            </P>
            <Lista
              itens={[
                "Confirmação de que tratamos dados seus, e acesso a eles.",
                "Correção de dados incompletos, inexatos ou desatualizados.",
                "Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados fora da lei.",
                "Portabilidade dos dados a outro fornecedor.",
                "Informação sobre com quem compartilhamos seus dados.",
                "Revogação do consentimento, quando foi ele que autorizou o tratamento.",
              ]}
            />
            <P>
              Para exercer qualquer um deles, escreva para{" "}
              <A href={`mailto:${EMAIL}`}>{EMAIL}</A>. Respondemos no menor prazo possível e,
              no máximo, nos prazos da LGPD. Podemos pedir uma confirmação de identidade antes
              de atender — é uma proteção sua, para que ninguém obtenha seus dados se passando
              por você. Alguns pedidos de eliminação podem ser recusados quando a lei nos
              obriga a manter o registro; nesse caso explicamos o motivo.
            </P>
          </Secao>

          <Secao titulo="Segurança">
            <P>
              O acesso aos dados é restrito à equipe, com autenticação individual, e o tráfego
              entre o seu navegador e nossos servidores é criptografado. Monitoramos falhas e
              mantemos cópias de segurança do banco de dados. Nenhum sistema é imune a
              incidentes; se ocorrer algum que traga risco relevante a você, comunicaremos você
              e a Autoridade Nacional de Proteção de Dados, como a lei determina.
            </P>
          </Secao>

          <Secao titulo="Menores de idade">
            <P>
              O site e os serviços da Morabilidade são destinados a maiores de 18 anos. Não
              coletamos intencionalmente dados de crianças e adolescentes. Se isso acontecer por
              engano, avise-nos e faremos a eliminação.
            </P>
          </Secao>

          <Secao titulo="Mudanças nesta política">
            <P>
              Podemos revisar este texto para refletir mudanças nos nossos serviços ou na
              legislação. A data no topo indica a última revisão. Alterações relevantes serão
              anunciadas no site.
            </P>
          </Secao>

          <Secao titulo="Fale com a gente">
            <P>
              Dúvidas, pedidos ou reclamações sobre privacidade:{" "}
              <A href={`mailto:${EMAIL}`}>{EMAIL}</A> ou WhatsApp {TELEFONE}. Você também pode
              apresentar reclamação diretamente à Autoridade Nacional de Proteção de Dados
              (ANPD).
            </P>
            <P>
              Veja também as nossas <Link href="/sobre" style={{ color: "var(--olive)", textDecoration: "underline" }}>informações institucionais</Link>{" "}
              e <Link href="/contato" style={{ color: "var(--olive)", textDecoration: "underline" }}>canais de contato</Link>.
            </P>
          </Secao>
        </div>
      </div>

      <Footer />
    </>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2
        className="font-serif"
        style={{
          fontSize: "clamp(19px,2.4vw,24px)",
          fontWeight: 500,
          color: "var(--text)",
          marginBottom: 14,
          lineHeight: 1.3,
        }}
      >
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: 1.85, marginBottom: 14 }}>
      {children}
    </p>
  );
}

function Item({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        borderLeft: "2px solid var(--border)",
        paddingLeft: 16,
        marginBottom: 18,
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
        {titulo}
      </p>
      <p style={{ fontSize: 14.5, color: "var(--text-muted)", lineHeight: 1.8 }}>{children}</p>
    </div>
  );
}

function Lista({ itens }: { itens: string[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px" }}>
      {itens.map((item) => (
        <li
          key={item}
          style={{
            fontSize: 14.5,
            color: "var(--text-muted)",
            lineHeight: 1.8,
            paddingLeft: 18,
            marginBottom: 8,
            position: "relative",
          }}
        >
          <span style={{ position: "absolute", left: 0, color: "var(--gold)", fontWeight: 700 }}>
            ·
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} style={{ color: "var(--olive)", textDecoration: "underline" }}>
      {children}
    </a>
  );
}
