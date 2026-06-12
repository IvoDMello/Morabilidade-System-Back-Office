# Ficha de Visita — passo a passo do corretor

A ficha de visita é o termo digital que o visitante assina pelo celular antes de conhecer o imóvel. Ela protege a comissão (vincula o visitante à corretagem pelo prazo combinado, arts. 725/727 do Código Civil) também cadastra o visitante automaticamente como cliente e monta o perfil de imóvel que ele busca.

---

## Antes de começar: acessar o painel

1. Abra **https://painel.morabilidade.com.br** (funciona no computador e no navegador do celular).
2. Entre com o **e-mail e a senha** do seu usuário (cadastrado pelo administrador).
3. No menu lateral, clique em **"Imóveis"** e abra o imóvel que será visitado.

> Sem acesso? Peça ao administrador para criar seu usuário com perfil de corretor.

## 1. Gerar a ficha

1. Abra o **imóvel** que será visitado no painel.
2. Entre na aba **"Fichas de visita"**.
3. Preencha os dados do visitante:
   - **Nome** (obrigatório)
   - **WhatsApp** (obrigatório — é por ele que o link é enviado e o cliente é cadastrado)
   - **CPF** (recomendado — ajuda a não duplicar cadastros)
   - **E-mail** (opcional)
4. Clique em **"Gerar e copiar link"**.

O link de assinatura já fica copiado na área de transferência, pronto para colar em qualquer conversa.

## 2. Enviar para o visitante

Na lista de **fichas emitidas**, use o botão de **WhatsApp** ao lado da ficha: ele abre a conversa com o visitante com a mensagem e o link prontos. Também dá para copiar o link de novo a qualquer momento.

> O link vale por **7 dias**. Depois disso a ficha expira e é preciso gerar outra.

## 3. O que o visitante faz (no celular)

1. Abre o link e confere os dados da visita (imóvel, endereço, valor, corretor).
2. Lê a declaração e **informa o CPF**.
3. **Assina com o dedo** na tela e confirma o aceite.

Pronto: o sistema registra data/hora e IP, gera o **PDF assinado** e guarda tudo como prova. O visitante pode baixar o PDF na hora — e se abrir o link de novo depois, vê a confirmação com o botão de download.

## 4. O que acontece sozinho (sem trabalho manual)

**Na geração da ficha:**
- O sistema procura o visitante na base de clientes pelo **CPF, telefone ou e-mail**.
- Se já existe → a ficha é **vinculada ao cadastro existente** (nada é duplicado).
- Se não existe → o visitante vira um **cliente novo** automaticamente, com origem "ficha de visita" e você como corretor responsável. Um aviso na tela confirma qual dos dois aconteceu.

**Na assinatura:**
- O CPF confirmado completa o cadastro do cliente (se estava em branco).
- O sistema monta o **perfil de busca** do cliente a partir de todas as visitas que ele já assinou: tipo de imóvel, cidade, bairros visitados, faixa de valor e dormitórios. Quanto mais visitas, mais preciso o perfil.
- Esse perfil entra no módulo de **Oportunidades**: quando entrar um imóvel compatível, o cliente aparece como interessado.

## 5. Perfil inferido × perfil manual

- Na ficha do cliente, o perfil inferido aparece com um **aviso âmbar** indicando que foi calculado pelas visitas e que é recalculado a cada nova assinatura.
- Se você **editar e salvar** o perfil, ele passa a ser **manual**: o sistema para de recalcular e respeita o que você definiu.
- Um perfil que você já cadastrou manualmente **nunca** é sobrescrito pelas visitas.

## 6. Gerenciar as fichas

Na aba "Fichas de visita" de cada imóvel:

| Ação | Quando usar |
|------|-------------|
| **Copiar link / WhatsApp** | Reenviar o link enquanto a ficha está pendente |
| **Baixar PDF** | Pendente = rascunho para conferência; assinada = documento oficial com trilha de auditoria |
| **Cancelar** | O link deixa de funcionar (não dá para cancelar ficha já assinada) |

Status possíveis: **Aguardando assinatura** → **Assinada** (ou **Cancelada** / **Expirada**).

## 7. Boas práticas

- **Sempre peça o CPF** ao gerar a ficha: é o dado mais confiável para o sistema reconhecer um cliente que volta a visitar outros imóveis.
- Gere a ficha **antes** da visita e envie pelo WhatsApp — o visitante assina no caminho ou na porta do imóvel.
- Visitou de novo com outro corretor? Sem problema: o sistema reconhece o cliente pelo CPF/telefone e soma a nova visita ao mesmo perfil.
