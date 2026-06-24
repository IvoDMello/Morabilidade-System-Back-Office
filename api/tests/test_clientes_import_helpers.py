"""Testes unitários das helpers puras do import de clientes via CSV.

Funções sem I/O (parsing/sanitização) — o coração do mapeamento de colunas e da
conversão de valores BR. Cobrem ramos que os testes de endpoint não exercitam:
formatos de data, renda no padrão brasileiro, enums inválidos descartados e a
separação cliente × preferência.
"""
from app.routers.clientes import (
    _construir_mapa_colunas,
    _normalizar_header,
    _parse_data_nascimento,
    _parse_renda,
    _row_para_cliente,
    _row_para_preferencia,
)


# ── _normalizar_header ───────────────────────────────────────────────────────

def test_normalizar_header_remove_acento_e_separadores():
    assert _normalizar_header("Telefone/WhatsApp") == "telefone whatsapp"
    assert _normalizar_header("Data-de_Nascimento") == "data de nascimento"
    assert _normalizar_header("  CIDADE  ") == "cidade"


# ── _construir_mapa_colunas ──────────────────────────────────────────────────

def test_construir_mapa_reconhece_campo_por_nome_exato():
    mapa = _construir_mapa_colunas(["nome", "email", "coluna_desconhecida"])
    assert mapa["nome"] == "nome_completo"
    assert mapa["email"] == "email"
    assert "coluna_desconhecida" not in mapa


def test_construir_mapa_ignora_header_vazio():
    mapa = _construir_mapa_colunas(["", "nome"])
    assert "" not in mapa


# ── _parse_data_nascimento ───────────────────────────────────────────────────

def test_parse_data_aceita_varios_formatos():
    assert _parse_data_nascimento("1990-05-20") == "1990-05-20"
    assert _parse_data_nascimento("20/05/1990") == "1990-05-20"
    assert _parse_data_nascimento("20-05-1990") == "1990-05-20"
    assert _parse_data_nascimento("1990/05/20") == "1990-05-20"


def test_parse_data_invalida_retorna_none():
    assert _parse_data_nascimento("não é data") is None
    assert _parse_data_nascimento("31/02/2020") is None


# ── _parse_renda ─────────────────────────────────────────────────────────────

def test_parse_renda_padrao_br_completo():
    assert _parse_renda("R$ 1.234,56") == 1234.56


def test_parse_renda_apenas_virgula_decimal():
    assert _parse_renda("1234,50") == 1234.50


def test_parse_renda_ascii_simples():
    assert _parse_renda("5000") == 5000.0


def test_parse_renda_invalida_retorna_none():
    assert _parse_renda("abc") is None


# ── _row_para_cliente ────────────────────────────────────────────────────────

def test_row_para_cliente_sanitiza_enums_e_estado():
    mapa = {
        "Nome": "nome",
        "Status": "status",
        "Tipo": "tipo_cliente",
        "UF": "estado",
    }
    row = {"Nome": "João", "Status": "ATIVO", "Tipo": "Comprador", "UF": "ceara"}
    cliente = _row_para_cliente(row, mapa)
    assert cliente["nome"] == "João"
    assert cliente["status"] == "ativo"
    assert cliente["tipo_cliente"] == "comprador"
    assert cliente["estado"] == "CE"


def test_row_para_cliente_descarta_enum_invalido():
    """Enum fora dos valores válidos é descartado (não gravado cru), de forma
    consistente com data/renda inválidas — assim o insert não viola o CHECK do
    banco e a linha não é derrubada inteira."""
    mapa = {"Status": "status", "Tipo": "tipo_cliente", "Origem": "origem_lead"}
    row = {"Status": "valor_invalido", "Tipo": "xpto", "Origem": "????"}
    cliente = _row_para_cliente(row, mapa)
    assert "status" not in cliente
    assert "tipo_cliente" not in cliente
    assert "origem_lead" not in cliente


def test_row_para_cliente_ignora_campos_de_preferencia():
    mapa = {"Cidade desejada": "pref_cidade", "Nome": "nome"}
    cliente = _row_para_cliente({"Cidade desejada": "Fortaleza", "Nome": "Ana"}, mapa)
    assert "cidade" not in cliente
    assert cliente == {"nome": "Ana"}


# ── _row_para_preferencia ────────────────────────────────────────────────────

def test_row_para_preferencia_extrai_e_converte():
    mapa = {
        "Negócio": "pref_tipo_negocio",
        "Bairros": "pref_bairros",
        "Valor min": "pref_valor_min",
        "Dorms": "pref_dormitorios_min",
    }
    row = {
        "Negócio": "Locacao",
        "Bairros": "Meireles, Aldeota , ",
        "Valor min": "R$ 2.000,00",
        "Dorms": "3",
    }
    pref = _row_para_preferencia(row, mapa)
    assert pref["tipo_negocio"] == "locacao"
    assert pref["bairros"] == ["Meireles", "Aldeota"]
    assert pref["valor_min"] == 2000.0
    assert pref["dormitorios_min"] == 3


def test_row_para_preferencia_descarta_inteiro_invalido():
    mapa = {"Dorms": "pref_dormitorios_min"}
    pref = _row_para_preferencia({"Dorms": "três"}, mapa)
    assert pref is None


def test_row_para_preferencia_sem_dados_retorna_none():
    mapa = {"Negócio": "pref_tipo_negocio"}
    assert _row_para_preferencia({"Negócio": ""}, mapa) is None
