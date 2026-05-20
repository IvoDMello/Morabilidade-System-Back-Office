Estou trabalhando no projeto Morabilidade-System-Back-Office (monorepo com api/, web/ e site/).

Contexto da empresa:
- Imobiliária 100% digital, sem sede física
- Opera via Instagram (@morabilidade, 90k+ seguidores) e WhatsApp
- Equipe reduzida — não exibir quantidade de corretores
- Stack: FastAPI + Supabase + Firebase Storage (API), Next.js 15 + shadcn/ui (web/), Next.js 15 + Tailwind puro (site/)
- Documento de referência: Pendencias_Sistema_imobiliario.docx na raiz do projeto

Preciso executar as tasks abaixo em ordem de prioridade. Execute uma de cada vez e me informe quando concluir para eu revisar antes de avançar.

─── P0 — pré go-live ───────────────────────────────────────────
1. Commitar site/next.config.ts (está modificado e não commitado)
2. Adicionar botão WhatsApp flutuante no site/ — fixo no canto inferior direito em TODAS as páginas. Na página de detalhe do imóvel (/imoveis/[codigo]), a mensagem deve referenciar o código e título do imóvel. Nas demais páginas, mensagem genérica da empresa.
3. Adicionar ícone + link do Instagram (@morabilidade) no Navbar e no Footer do site/
4. Adicionar formulário/botão "Tenho Interesse" na página de detalhe do imóvel (site/src/app/imoveis/[codigo]/page.tsx) — botão primário abre WhatsApp com dados do imóvel, botão secundário abre form de email para /contato
5. Preencher a página /sobre (site/src/app/sobre/page.tsx) com estrutura profissional — história, diferenciais, como funciona o atendimento, espaço para depoimentos. Usar placeholders realistas (não [X])

─── P1 — SEO e confiança ───────────────────────────────────────
6. SEO técnico: gerar sitemap.xml dinâmico consumindo GET /imoveis/publico/disponiveis, criar robots.txt, adicionar Schema.org RealEstateListing na página de detalhe, configurar Open Graph com foto do imóvel para compartilhamento no WhatsApp/Instagram
7. Adicionar seção de depoimentos de clientes na homepage (site/src/app/page.tsx) — componente com 3-4 cards de depoimento fictícios mas realistas como placeholder
8. Embed de Google Maps na página de detalhe do imóvel usando o endereço do imóvel
9. Configurar Sentry na API (api/) e no site (site/) para monitoramento de erros em produção

─── P2 — back-office ───────────────────────────────────────────
10. Botão de export CSV na listagem de imóveis e na listagem de clientes do painel web/
11. Templates HTML de email profissionais com branding Morabilidade para: confirmação de contato recebido (para o visitante) e notificação interna de novo lead (para a equipe)
12. Adicionar gráficos no dashboard do web/ — origem de leads (pizza) e status de clientes (barras) — usando Recharts
13. Rate limiting nas rotas públicas da API (/imoveis/publico/*) — máximo 60 req/min por IP

─── P3 — grande feature ────────────────────────────────────────
14. Módulo de Match imóvel × cliente:
    - Tabela de preferências no banco (tipo negócio, tipo imóvel, cidade, faixa de preço, dormitórios mínimos)
    - Interface no back-office para cadastrar preferências do cliente
    - Algoritmo de matching: ao cadastrar/atualizar imóvel disponível, encontrar clientes compatíveis
    - Notificação automática por email (via Resend) para clientes compatíveis
    - Aba "Matches" no detalhe do cliente mostrando imóveis compatíveis

Pode começar pela task 1.
