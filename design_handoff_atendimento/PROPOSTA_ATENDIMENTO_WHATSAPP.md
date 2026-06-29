# Proposta de Projeto: Central de Atendimento WhatsApp

**Produto:** Morabilidade
**Documento:** Proposta para aprovação dos parceiros
**Data:** 27/06/2026
**Status:** Aguardando aprovação (nada foi construído ainda)

---

## 1. Resumo em uma frase

Criar uma central própria de atendimento via WhatsApp, instalável como aplicativo no celular dos atendentes, onde cada conversa fica ligada ao cliente e ao imóvel de interesse dentro do nosso sistema, acabando com o WhatsApp manual e com a perda de contexto.

---

## 2. O problema que estamos resolvendo

Hoje o atendimento acontece no WhatsApp Business comum. Isso traz dores concretas:

- **Contexto se perde.** Quem é o cliente? Qual imóvel ele viu? Quem já falou com ele? Tudo fica na cabeça do atendente ou perdido no rolo de mensagens.
- **Não dá pra cruzar com o catálogo.** Não conseguimos responder rápido "quais clientes têm interesse no imóvel X".
- **Risco de perder histórico.** Se o aparelho some, troca de número ou o atendente sai, o histórico vai junto.
- **Não escala com mais de um atendente.** Sem registro de quem atendeu, sem repasse organizado de conversa.

---

## 3. A solução proposta

Uma central de atendimento, acessada por endereço próprio (ex: `atendimento.morabilidade.com.br`), instalável como ícone no celular (tecnologia PWA, sem precisar publicar em loja de aplicativos).

Principais ganhos:

- Cada conversa **ligada ao cliente cadastrado** e aos **imóveis de interesse** (pelo código do imóvel).
- **Busca por código de imóvel:** ver na hora todos os interessados num imóvel.
- **Histórico centralizado e seguro**, fora do celular pessoal.
- **Vários atendentes** com identidade configurável e organização de quem atende o quê.

> O que nos diferencia de comprar uma ferramenta pronta de mercado: a ligação com o nosso catálogo de imóveis e com os nossos clientes cadastrados já vem nativa, sem custo de licença mensal. Ferramentas de mercado até permitem integrações parecidas, mas exigem esforço e mensalidade para chegar perto disso.

---

## 4. O que entra (escopo por fases)

A construção é incremental: cada fase entrega algo que já funciona antes de passar pra próxima.

### Fase 1: MVP (o essencial pra operar)
- Conexão do número WhatsApp Business na central.
- Lista de conversas com mensagens não lidas e busca.
- Chat em tempo real (mensagem nova aparece sem recarregar).
- Envio de mensagem com status visível (enviado, entregue, falhou).
- Ligação da conversa com o cliente e com os imóveis de interesse.
- Busca de interessados por código de imóvel.
- Segurança de dados desde o início (acesso controlado, conformidade com LGPD).

### Fase 2: Operação com equipe
- Perfis de nome do atendente (ex: "Equipe Morabilidade").
- Atribuição e status das conversas (aberta, aguardando, resolvida).
- Recebimento de mídia (foto, áudio, documento).
- Aplicativo otimizado para uso no celular o dia inteiro.

### Fase 3: Produtividade
- Respostas rápidas (modelos de mensagem prontos).
- Busca dentro do histórico da conversa.
- Envio de mídia.

---

## 5. O que NÃO entra (limites honestos do WhatsApp)

Para não criar expectativa errada, três pontos são limitação do próprio WhatsApp, não do nosso sistema:

1. **O nome do atendente não muda para o cliente.** O cliente sempre vê o número da imobiliária. O nome do atendente serve apenas como registro interno de quem respondeu.
2. **O número opera como um WhatsApp comum.** Não há janela de horário nem modelo de mensagem para aprovar: o envio é livre, a qualquer hora, exatamente como na rotina atual. O único cuidado é não fazer disparo em massa para quem nunca nos procurou, para não arriscar bloqueio do número pelo WhatsApp (o mesmo risco que já existe hoje no WhatsApp Business).
3. **Aviso no iPhone é mais limitado e exige instalar o app.** A notificação funciona, mas o atendente precisa instalar o aplicativo na tela inicial (não basta abrir no navegador). É uma característica conhecida desse tipo de aplicativo no iOS.

---

## 6. Custos

| Item | Situação |
|------|----------|
| Banco de dados e login (Supabase) | **Já pago.** Usa o plano atual. As novas tabelas entram aqui sem custo extra de plano. |
| Hospedagem (Railway) | **Já pago.** Pode haver um acréscimo modesto de consumo por subir o serviço de WhatsApp, a confirmar no painel. |
| Software de WhatsApp (Evolution API) | **Gratuito** (código aberto, hospedado por nós). |
| Endereço/subdomínio | Usa o domínio que já temos. |
| Desenvolvimento | Tempo de desenvolvimento interno. |

**Resumo de custo de infraestrutura:** baixo e previsível. O investimento principal é tempo de desenvolvimento, não dinheiro de assinatura. O acréscimo no Railway precisa ser confirmado observando o consumo real na primeira semana.

---

## 7. Riscos e como tratamos

| Risco | Tratamento |
|-------|-----------|
| WhatsApp da central cair e travar o resto do sistema | O serviço de WhatsApp fica **isolado** da nossa API principal. Se um cair, o outro continua de pé. |
| Mensagem de cliente se perder | Toda mensagem tem status; falha de envio fica visível e pode ser reenviada. |
| Vazamento de dados de cliente | Controle de acesso por usuário desde a primeira versão (LGPD). |
| Bloqueio do número pelo WhatsApp | Uso responsável, sem disparos em massa para quem não nos procurou. |

---

## 8. O que decidir nesta reunião

1. **Aprovar o projeto** e a abordagem por fases.
2. Confirmar que vale começar pelo **MVP (Fase 1)** antes de investir nas demais.
3. Definir **qual número** de WhatsApp será usado na central.
4. Alinhar que as três limitações do WhatsApp (seção 5) são aceitáveis.

---

## 9. Próximo passo após aprovação

Subir o serviço de WhatsApp isolado, criar as tabelas com segurança de dados e entregar a primeira conversa funcionando ponta a ponta. A partir daí, cada fase é apresentada funcionando antes de seguir.
