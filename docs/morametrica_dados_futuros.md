# MoraMétrica: dados para avaliar depois

Registrado em 02/11/2026. Pedido: mostrar na página do prédio o **ano de construção** e a **natureza da transação** (compra e venda, partilha, doação). Nenhum dos dois entrou na primeira versão. Este documento guarda o que foi verificado e os caminhos possíveis.

## Resumo

| Dado | Situação | Caminho |
|---|---|---|
| Natureza da transação | Não existe na fonte. Doação e herança nem entram na base | Pedido pela Lei de Acesso à Informação (LAI) |
| Ano de construção | Não há fonte pública e gratuita no Rio | Pedido pela LAI ou preenchimento pela equipe |
| Pavimentos e CEP do prédio | **Disponível de graça**, mesmo código de rua da base do ITBI | Pronto para implementar (cerca de meio dia) |

## Natureza da transação

- As planilhas de ITBI da Prefeitura têm 20 colunas e nenhuma informa o tipo de negócio.
- O ITBI (municipal) só incide sobre transmissões **pagas** entre pessoas vivas. Doação e herança pagam ITCMD (estadual) e **não aparecem** nesta base. Na partilha de divórcio, a regra também é o ITCMD; o ITBI só entra no excesso de quinhão pago.
- Na prática, a base é quase toda de compra e venda, com alguma permuta com torna, dação em pagamento e arrematação. Não dá para separar uma da outra.
- **Já feito na v1:** o rodapé da página explica que os valores são de transmissões pagas e que doações e heranças não aparecem.

## Ano de construção

Fontes verificadas em 02/11/2026:

| Fonte | Resultado |
|---|---|
| Planilhas de ITBI (2011 a 2018, 2019 a 2024, 2025 em diante) | Sem ano |
| Arquivos de IPTU na página da Fazenda | Só totais por logradouro, bairro ou titular de isenção |
| Servidor de mapas da Prefeitura (`pgeo3.rio.rj.gov.br`, 36 pastas) | Nenhuma camada com ano de construção. Existem o ano de tombamento (bens tombados) e o habite-se de conjuntos de interesse social (Lei 97/2009) |
| Catálogo do Data.Rio | Habite-se só em totais por região e bairro, sem endereço |
| OpenStreetMap | Em Ipanema, 1 dos 14.032 prédios mapeados tem ano |

O ano existe no cadastro do IPTU, que o Rio não publica (São Paulo, Porto Alegre e Recife publicam). A consulta individual pela internet exige a inscrição de cada unidade e não serve para a cidade inteira; automatizá-la seria raspagem, por isso foi descartada.

Opções:

1. **Pedido pela LAI** (recomendado). Gratuito, prazo de 20 dias prorrogáveis por mais 10. Rascunho abaixo.
2. **Preenchimento pela equipe:** um campo "ano de construção" por prédio no painel, começando pelos mais negociados da Zona Sul. Não custa dinheiro, mas toma tempo da equipe.
3. ~~Usar o `ano_construcao` dos imóveis do CRM~~ (descartado): só cobre prédios onde a Morabilidade já teve imóvel, e um dado que aparece em poucos prédios parece falha da página.

## Pavimentos e CEP (pronto para usar)

- Fonte: camada de números de porta do cadastro de logradouros.
  `https://pgeo3.rio.rj.gov.br/arcgis/rest/services/CadLog/Numero_de_porta/MapServer/0`
- 785.842 números de porta, até 2.000 por consulta (cerca de 400 consultas para a cidade inteira).
- Campos úteis: `cl` (código do logradouro com 6 dígitos e zero à esquerda: `'083360'` é a Vieira Souto, `83360` na base do ITBI), `np_int` (número), `num_pavimentos`, `cep`, `cod_lote`.
- Exemplo: `where=cl='083360' AND np_int=136` devolve 16 pavimentos e CEP 22420-002.
- Implementação sugerida: tabela `radar_predios_cadastro (cl, numero, pavimentos, cep)` carregada pelo `scripts/radar_importar.py`, exibida no cabeçalho do prédio ("16 pavimentos · CEP 22420-002").

## Rascunho do pedido pela LAI

Canal: pedido de acesso à informação da Prefeitura do Rio (Central 1746; confirmar o canal atual antes de enviar).

> Com base na Lei nº 12.527/2011, solicito à Secretaria Municipal de Fazenda, em formato aberto (CSV ou XLSX):
>
> 1. Para cada número de porta do cadastro imobiliário (código de logradouro e número), o ano de construção da edificação ou o ano do habite-se, sem dados de titulares nem inscrições individuais.
> 2. Nas bases de transações de ITBI já publicadas em https://fazenda.prefeitura.rio/itbi-valores-medios-por-m2-de-transacoes-imobiliarias-por-trecho-de-logradouro/, a inclusão da natureza da transação (compra e venda, permuta, dação em pagamento, arrematação etc.).
>
> As informações se referem a edificações e transações, não a pessoas, e complementam bases que a própria Secretaria já publica.
