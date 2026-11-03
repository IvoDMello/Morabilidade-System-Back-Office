"""Normalização do Radar: escape do Excel, números da fonte, chaves de busca e
nomes de exibição. Os pares de logradouro vêm das planilhas reais (mesmo código
`cl` nos arquivos até 2024 e no de 2025)."""
import pytest

from app.services.radar.normalizacao import (
    chave_logradouro,
    codigo,
    decodificar_excel,
    formatar_bairro,
    formatar_complemento,
    formatar_logradouro,
    formatar_tipologia,
    mesmo_logradouro,
    mesmo_nome,
    numero_imovel,
    para_numero,
    sem_qualificador,
    separar_tipo,
    texto_busca,
    tokens_unidade,
)


# ── decodificar_excel ────────────────────────────────────────────────────────

@pytest.mark.parametrize("bruto, esperado", [
    ("RUA_x0020_ENEAS_x0020_MARTINS", "RUA ENEAS MARTINS"),
    ("_x0033_88", "388"),                      # até o 1º dígito do número vem escapado
    ("_x0031_00", "100"),
    ("PROLETARIO_x0020_CASA_x002F_APTO", "PROLETARIO CASA/APTO"),
    ("_x005F_x0020_", "_x0020_"),              # sublinhado escapado não vira espaço
    ("sem escape", "sem escape"),
    ("", ""),
    (None, ""),
])
def test_decodificar_excel(bruto, esperado):
    assert decodificar_excel(bruto) == esperado


def test_texto_busca_tira_acento_e_pontuacao():
    assert texto_busca("Praça N/S da Paz") == "PRACA N S DA PAZ"
    assert texto_busca("  av.  Vieira   Souto, ") == "AV VIEIRA SOUTO"
    assert texto_busca(None) == ""


# ── Números ──────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("bruto, esperado", [
    ("150337.5", 150337.5),
    ("100", 100.0),
    ("100,00", 100.0),          # parte transferida aparece em 8 formatos
    ("100,", 100.0),
    ("100.00", 100.0),
    ("1.234,56", 1234.56),
    ("1,234.56", 1234.56),
    ("_x0031_00", 100.0),
    ("", None),
    ("abc", None),
    ("nan", None),
])
def test_para_numero(bruto, esperado):
    assert para_numero(bruto) == esperado


@pytest.mark.parametrize("bruto, esperado", [
    ("_x0033_88", 388),
    ("510", 510),
    ("12A", 12),
    ("0", None),
    ("-1", None),
    ("", None),
])
def test_numero_imovel(bruto, esperado):
    assert numero_imovel(bruto) == esperado


def test_codigo_ignora_zero_a_esquerda():
    assert codigo("_x0030_2") == "2"
    assert codigo("02") == codigo("2")
    assert codigo("") == ""


# ── Tipo e chave do logradouro ───────────────────────────────────────────────

def test_separar_tipo():
    assert separar_tipo("AVN VIEIRA SOUTO") == ("AVENIDA", True, ["VIEIRA", "SOUTO"])
    assert separar_tipo("r. barata ribeiro") == ("RUA", True, ["BARATA", "RIBEIRO"])
    # PRA é Praia ou Praça: é tipo, mas não diz qual
    assert separar_tipo("PRA BOTAFOGO") == (None, True, ["BOTAFOGO"])
    # tipo sozinho é nome
    assert separar_tipo("Rua") == (None, False, ["RUA"])
    assert separar_tipo("Ipanema") == (None, False, ["IPANEMA"])


@pytest.mark.parametrize("abreviado, por_extenso", [
    ("AVN VIEIRA SOUTO", "Avenida Vieira Souto"),
    ("RUA CAP GOUVEIA", "Rua Capitão Gouveia"),
    ("RUA DE BARAO PIRAQUARA", "Rua Barão de Piraquara"),
    ("RUA DOUTOR IBRAHIM HANNAS", "Rua Dr. Ibrahim Hannas"),
    ("AVN N/S COPACABANA", "Avenida Nossa Senhora de Copacabana"),
    ("PRA BOTAFOGO", "Praia de Botafogo"),
    ("PRA DOS TAMOIOS", "Praça dos Tamoios"),
    ("RUA EUSEBIO PAULO DE OLIVEIRA", "Rua Euzebio Paulo de Oliveira"),
    ("AVN MANUEL CALDEIRA DE ALVARENGA", "Avenida Manoel Caldeira de Alvarenga"),
    ("RUA GAL URQUIZA", "Rua General Urquiza"),
    ("RUA VISC PIRAJA", "Rua Visconde de Pirajá"),
    ("RUA PROF CASTILHO", "Rua Professora Castilho"),
])
def test_chave_igual_para_grafias_da_prefeitura(abreviado, por_extenso):
    assert chave_logradouro(abreviado) == chave_logradouro(por_extenso)


def test_chave_tira_tipo_e_preposicao():
    assert chave_logradouro("Avenida Vieira Souto") == "VIEIRA SOUTO"
    assert chave_logradouro("Praia de Botafogo") == "BOTAFOGO"
    assert chave_logradouro("Rua 19 de Fevereiro") == "19 FEVEREIRO"


def test_chave_de_rua_de_loteamento_com_letra_de_preposicao():
    # "Rua E" e "Rua D" existem; a letra não pode sumir da chave
    assert chave_logradouro("Rua E") == "E"
    assert chave_logradouro("RUA D") == "D"


def test_mesmo_logradouro():
    assert mesmo_logradouro("MARIO A XAVIER SOBRINHO", "MARIO AUGUSTO XAVIER SOBRINHO")
    assert mesmo_logradouro("PROFESSOR CASTILHO", "PROFESSOR CASTILHOS")
    assert mesmo_logradouro("B 1 PAL 19600", "B UM PAL 19600")
    # uma abreviação pode cobrir duas palavras
    assert mesmo_logradouro("TTECEL MUNIZ ARAGAO", "TENENTE CORONEL MUNIZ ARAGAO")
    # rua renomeada é outro nome
    assert not mesmo_logradouro("SOBREIRO", "PAULO FRANCHINI")
    assert not mesmo_logradouro("CORREGO PRATA", "METAL JORGE ALVES SILVA")


def test_mesmo_nome_nao_confia_so_no_dicionario():
    # "MTO" está no dicionário como Maestro, mas aqui é Motorista
    assert mesmo_nome("RUA MTO MANOEL DUARTE", "Rua Motorista Manoel Duarte")
    assert mesmo_nome("RUA IVAN LESSA (ESCRITOR)", "Rua Ivan Lessa")
    assert not mesmo_nome("RUA PAULO FRANCHINI", "Rua Sobreiro")


def test_sem_qualificador():
    assert sem_qualificador("Rua Ivan Lessa (Escritor)") == "Rua Ivan Lessa"
    assert sem_qualificador("RUA DARCILIO COELHO (AG DA ESTACAO") == "RUA DARCILIO COELHO"
    assert sem_qualificador("(SEM NOME)") == "(SEM NOME)"


# ── Exibição ─────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("bruto, esperado", [
    ("AVN VIEIRA SOUTO", "Avenida Vieira Souto"),
    ("RUA CAP GOUVEIA", "Rua Capitão Gouveia"),
    ("RUA XV DE NOVEMBRO", "Rua XV de Novembro"),
    ("RUA C", "Rua C"),
    ("AVN N/S COPACABANA", "Avenida Nossa Senhora Copacabana"),
    ("ETR  RIO SAO PAULO", "Estrada Rio São Paulo"),
    ("AVN ADELINO MOREIRA(CANTOR E COMP)", "Avenida Adelino Moreira"),
    ("RUA IVAN LESSA (ESCRITOR)", "Rua Ivan Lessa"),
    ("RUA DAS OFICINAS", "Rua das Oficinas"),
    ("RUA E", "Rua E"),
    ("RUA B-3 PAL 19600", "Rua B-3 PAL 19600"),
    ("AVN DW PLT 52", "Avenida DW PLT 52"),
    # já por extenso (arquivos até 2024): só limpa espaços
    ("Avenida  Vieira Souto ", "Avenida Vieira Souto"),
    ("", ""),
])
def test_formatar_logradouro(bruto, esperado):
    assert formatar_logradouro(bruto) == esperado


@pytest.mark.parametrize("bruto, esperado", [
    ("JARDIM BOTANICO", "Jardim Botânico"),
    ("SAO CONRADO", "São Conrado"),
    ("BARRA DA TIJUCA", "Barra da Tijuca"),
    ("GAVEA", "Gávea"),
    ("FREGUESIA JACAREPAGUA", "Freguesia (Jacarepaguá)"),
    ("IMPERIAL DE SAO CRISTOVAO", "Imperial de São Cristóvão"),
    ("TODOS OS SANTOS", "Todos os Santos"),
    ("NAO INFORMADO", "Não informado"),
])
def test_formatar_bairro(bruto, esperado):
    assert formatar_bairro(bruto) == esperado


def test_formatar_tipologia():
    assert formatar_tipologia("APART HOTEL FRENTE") == "Apart-hotel (frente)"
    assert formatar_tipologia("APART-HOTEL FRENTE") == "Apart-hotel (frente)"
    assert formatar_tipologia("PROLETARIO CASA APTO") == "Proletário (casa/apto)"
    assert formatar_tipologia("VAGA DE GARAGEM") == "Vaga de garagem"
    assert formatar_tipologia("APARTAMENTO") == "Apartamento"


@pytest.mark.parametrize("bruto, esperado", [
    ("APT 304", "Apt 304"),
    ("BLOCO  02 APTO 101A", "Bloco 02 Apto 101A"),
    ("LOT 10 PAL 31543 QDR E", "Lot 10 PAL 31543 QDR E"),
    ("FRACAO DEST. P/ LOJA M", "Fracao Dest. P/ Loja M"),
    ("", None),
    (None, None),
])
def test_formatar_complemento(bruto, esperado):
    assert formatar_complemento(bruto) == esperado


# ── Unidade ──────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("texto, esperado", [
    ("BL-001 APTO 0801", ("1", "801")),
    ("bloco 1 apto 801", ("1", "801")),
    ("Apto 801 Bl 1", ("1", "801")),
    ("APT 302 FTE", ("302",)),
    ("APTO 1201B", ("1201", "1201B")),
    ("COB 01", ("1", "COB")),
    ("cobertura", ("COB",)),
    ("", ()),
    (None, ()),
])
def test_tokens_unidade(texto, esperado):
    assert tokens_unidade(texto) == esperado
