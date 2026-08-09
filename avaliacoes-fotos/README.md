# Avaliações Fotográficas · Morabilidade

Ferramenta local para gerar PDFs de avaliação com as fotos do imóvel, na identidade visual da Morabilidade.

## Como usar
1. Abra o **`Abrir Avaliações.bat`** (ou dê dois cliques em `index.html`).
2. Preencha **endereço/identificação**, **data** e **avaliador** — esses dados vão no cabeçalho de todas as páginas.
3. Em cada uma das **4 entregas**, arraste ou selecione as fotos:
   - Imóvel para **Venda — com mobília**
   - Imóvel para **Venda — sem mobília**
   - Imóvel para **Locação — com mobília**
   - Imóvel para **Locação — sem mobília**
4. Clique em **"Gerar PDF desta entrega"** (individual) ou **"Gerar todos os PDFs"**.

Cada PDF traz: logo + faixa dourada, título do serviço (negócio · mobília), sub-cabeçalho com os dados,
fotos em grade automática (2 por linha) com numeração, e rodapé com paginação.

## Detalhes técnicos
- 100% offline: nada é enviado à internet; as fotos ficam apenas na memória do navegador.
- Biblioteca de PDF (`vendor/jspdf.umd.min.js`) e logo (`assets/logo-data.js`) embutidas localmente.
- Paleta: olive `#585a4f` / gold `#d8cb6a`. Sem instalação.
