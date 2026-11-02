"""API pública da MoraMétrica (/radar/publico/*): decisão entre prédio, rua e
bairro, desambiguação, sugestões, período padrão e cache."""
from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from app.limiter import limiter
from app.routers import radar
from app.routers.radar import calcular_periodo

VIEIRA_SOUTO = {
    "cl": 83360, "nome": "Avenida Vieira Souto", "tipo": "AVENIDA", "grafia": "Avenida Vieira Souto",
    "bairros": ["Ipanema"], "transacoes": 437, "predios": 83,
}

PREDIO_510 = {
    "total_historico": 19,
    "primeira": "2011-07-01",
    "ultima": "2024-03-01",
    "bairro": "Ipanema",
    "resumo": {"transacoes": 2, "media_m2": 41234.56789, "media_valor": 3500000.0, "media_area": 86.0},
    "tipologias": [{"valor": "APART HOTEL FRENTE", "transacoes": 1}, {"valor": "APART HOTEL FUNDOS", "transacoes": 1}],
    "transacoes": [
        {"competencia": "2024-03-01", "tipologia": "APART HOTEL FRENTE", "complemento": "APT 402",
         "area": 94.0, "valor_declarado": 5200000.0, "valor_m2": 55319.15, "parcial": False},
        {"competencia": "2022-05-01", "tipologia": "APART HOTEL FUNDOS", "complemento": None,
         "area": 78.0, "valor_declarado": 1800000.0, "valor_m2": None, "parcial": True},
    ],
}

RUA_VIEIRA_SOUTO = {
    "total_historico": 437,
    "resumo": {"transacoes": 120, "media_m2": 38000.0, "media_valor": 4000000.0, "media_area": 110.0},
    "sem_numero": 3,
    "tipologias": [{"valor": "APARTAMENTO", "transacoes": 110}],
    "total_predios": 2,
    "predios": [
        {"numero": 510, "transacoes": 4, "media_m2": 45000.123, "ultima": "2024-03-01", "tipologia": "APART HOTEL FRENTE"},
        {"numero": 620, "transacoes": 9, "media_m2": 37000.0, "ultima": "2025-11-01", "tipologia": "APARTAMENTO"},
    ],
}

BAIRRO_IPANEMA = {
    "total_historico": 9000,
    "resumo": {"transacoes": 4000, "media_m2": 25000.0, "media_valor": 2000000.0, "media_area": 80.0},
    "tipologias": [{"valor": "APARTAMENTO", "transacoes": 3500}, {"valor": "SALA", "transacoes": 500}],
    "por_tipologia": [
        {"valor": "APARTAMENTO", "transacoes": 3500, "media_m2": 26000.0, "media_valor": 2100000.0, "media_area": 82.0},
        {"valor": "SALA", "transacoes": 500, "media_m2": 15000.0, "media_valor": 600000.0, "media_area": 35.0},
    ],
    "ruas": [{"cl": 83683, "nome": "Rua Visconde de Pirajá", "transacoes": 900, "media_m2": 22000.0}],
}

BAIRROS = [
    {"chave": "IPANEMA", "nome": "Ipanema", "transacoes": 9000},
    {"chave": "BOTAFOGO", "nome": "Botafogo", "transacoes": 16955},
    {"chave": "JARDIM BOTANICO", "nome": "Jardim Botânico", "transacoes": 3000},
]


class BancoFalso:
    """supabase_admin falso: cada função (rpc) responde por nome; as tabelas
    devolvem listas fixas."""

    def __init__(self, rpcs=None, tabelas=None):
        self.rpcs = {"radar_bairros": BAIRROS, **(rpcs or {})}
        self.tabelas = {"radar_importacoes": [{"dados_ate": "2026-09-01"}], **(tabelas or {})}
        self.chamadas: list[tuple[str, dict]] = []

    def rpc(self, nome, params):
        self.chamadas.append((nome, params))
        resposta = self.rpcs.get(nome)
        dados = resposta(params) if callable(resposta) else resposta
        return MagicMock(execute=MagicMock(return_value=MagicMock(data=dados)))

    def table(self, nome):
        consulta = MagicMock()
        for metodo in ("select", "eq", "order", "limit"):
            getattr(consulta, metodo).return_value = consulta
        consulta.execute.return_value = MagicMock(data=self.tabelas.get(nome, []))
        return consulta

    def params(self, nome):
        return [p for n, p in self.chamadas if n == nome]


@pytest.fixture(autouse=True)
def _limpo():
    radar.limpar_cache()
    limiter.reset()
    yield
    radar.limpar_cache()


def _get(client, banco, url):
    with patch("app.routers.radar.supabase_admin", banco):
        return client.get(url)


# ── Prédio ───────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("q", ["Vieira Souto 510", "av vieira souto, 510", "Avenida Vieira Souto 510"])
def test_predio_pelas_tres_grafias(anon_client, q):
    banco = BancoFalso(rpcs={
        "radar_resolver": [{**VIEIRA_SOUTO, "tem_numero": True}],
        "radar_predio": PREDIO_510,
    })
    res = _get(anon_client, banco, f"/radar/publico/busca?q={q}")
    assert res.status_code == 200
    corpo = res.json()
    assert corpo["tipo"] == "predio"
    assert corpo["consulta"] == q
    assert corpo["titulo"] == "Avenida Vieira Souto, 510"
    assert (corpo["cl"], corpo["numero"], corpo["bairros"]) == (83360, 510, ["Ipanema"])
    assert banco.params("radar_resolver") == [{"p_chave": "VIEIRA SOUTO", "p_numero": 510}]


def test_predio_formata_e_pagina(anon_client):
    banco = BancoFalso(rpcs={
        "radar_resolver": [{**VIEIRA_SOUTO, "tem_numero": True}],
        "radar_predio": PREDIO_510,
    })
    corpo = _get(anon_client, banco, "/radar/publico/busca?q=Vieira Souto 510&pagina=2&por_pagina=10").json()
    assert corpo["resumo"] == {"transacoes": 2, "media_m2": 41234.57, "media_valor": 3500000.0, "media_area": 86.0}
    assert corpo["total_historico"] == 19
    assert corpo["total"] == 2
    assert corpo["tipologias"][0] == {"valor": "APART HOTEL FRENTE", "rotulo": "Apart-hotel (frente)", "transacoes": 1}
    primeira, parcial = corpo["transacoes"]
    assert primeira["complemento"] == "Apt 402"
    assert primeira["competencia"] == "2024-03-01"
    assert parcial["parcial"] is True and parcial["valor_m2"] is None
    chamada = banco.params("radar_predio")[0]
    assert chamada["p_limite"] == 10 and chamada["p_offset"] == 10
    # padrão: últimos 5 anos até o último mês publicado (set/2026)
    assert chamada["p_desde"] == "2021-10-01" and chamada["p_ate"] is None
    assert corpo["periodo"] == {"desde": "2021-10-01", "ate": None, "padrao": True}
    assert corpo["dados_ate"] == "2026-09-01"


def test_numero_sem_venda_sugere_numeros_proximos(anon_client):
    banco = BancoFalso(rpcs={
        "radar_resolver": [{**VIEIRA_SOUTO, "tem_numero": False}],
        "radar_numeros_proximos": [500, 510, 516],
    })
    corpo = _get(anon_client, banco, "/radar/publico/busca?q=Vieira Souto 512").json()
    assert corpo["tipo"] == "nenhum"
    assert corpo["titulo"] == "Avenida Vieira Souto, 512"
    assert corpo["cl"] == 83360
    assert corpo["numeros_proximos"] == [500, 510, 516]


# ── Rua ──────────────────────────────────────────────────────────────────────

def test_rua_sem_numero_agrupa_por_predio(anon_client):
    banco = BancoFalso(rpcs={"radar_resolver": [VIEIRA_SOUTO], "radar_rua": RUA_VIEIRA_SOUTO})
    corpo = _get(anon_client, banco, "/radar/publico/busca?q=Av. Vieira Souto").json()
    assert corpo["tipo"] == "rua"
    assert corpo["titulo"] == "Avenida Vieira Souto"
    assert corpo["total"] == 2
    assert corpo["sem_numero"] == 3
    assert corpo["predios"][0] == {
        "numero": 510, "transacoes": 4, "media_m2": 45000.12,
        "ultima": "2024-03-01", "tipologia": "Apart-hotel (frente)",
    }
    assert banco.params("radar_rua")[0]["p_ordem"] == "numero"


def test_rua_ordenada_por_transacoes(anon_client):
    banco = BancoFalso(rpcs={"radar_resolver": [VIEIRA_SOUTO], "radar_rua": RUA_VIEIRA_SOUTO})
    _get(anon_client, banco, "/radar/publico/busca?q=Vieira Souto&ordem=transacoes")
    assert banco.params("radar_rua")[0]["p_ordem"] == "transacoes"


def test_rua_renomeada_mostra_o_nome_antigo(anon_client):
    franchini = {**VIEIRA_SOUTO, "cl": 101998, "nome": "Rua Paulo Franchini", "grafia": "Rua Sobreiro"}
    banco = BancoFalso(rpcs={"radar_resolver": [franchini], "radar_rua": RUA_VIEIRA_SOUTO})
    corpo = _get(anon_client, banco, "/radar/publico/busca?q=Rua Sobreiro").json()
    assert corpo["titulo"] == "Rua Paulo Franchini"
    assert corpo["apelido"] == "antiga Rua Sobreiro"


# ── Bairro ───────────────────────────────────────────────────────────────────

def test_bairro_tem_prioridade_sobre_rua_de_mesmo_nome(anon_client):
    banco = BancoFalso(rpcs={"radar_bairro": BAIRRO_IPANEMA})
    corpo = _get(anon_client, banco, "/radar/publico/busca?q=ipanema").json()
    assert corpo["tipo"] == "bairro"
    assert (corpo["titulo"], corpo["bairro"]) == ("Ipanema", "IPANEMA")
    assert corpo["por_tipologia"][0]["rotulo"] == "Apartamento"
    assert corpo["por_tipologia"][0]["media_m2"] == 26000.0
    assert corpo["ruas"] == [{"cl": 83683, "nome": "Rua Visconde de Pirajá", "transacoes": 900, "media_m2": 22000.0}]
    assert banco.params("radar_resolver") == []
    assert banco.params("radar_bairro")[0]["p_bairro"] == "IPANEMA"


def test_bairro_com_acento_digitado_sem(anon_client):
    banco = BancoFalso(rpcs={"radar_bairro": BAIRRO_IPANEMA})
    corpo = _get(anon_client, banco, "/radar/publico/busca?q=jardim botanico").json()
    assert corpo["titulo"] == "Jardim Botânico"


def test_com_tipo_vira_rua_mesmo_com_nome_de_bairro(anon_client):
    praia = {**VIEIRA_SOUTO, "cl": 67082, "nome": "Praia de Botafogo", "tipo": "PRAIA", "grafia": "Praia de Botafogo", "tem_numero": True}
    rua = {**VIEIRA_SOUTO, "cl": 14498, "nome": "Rua Botafogo", "tipo": "RUA", "grafia": "Rua Botafogo", "tem_numero": True}
    banco = BancoFalso(rpcs={"radar_resolver": [praia, rua], "radar_predio": PREDIO_510})
    corpo = _get(anon_client, banco, "/radar/publico/busca?q=Praia de Botafogo 300").json()
    assert corpo["tipo"] == "predio"
    assert corpo["titulo"] == "Praia de Botafogo, 300"
    assert banco.params("radar_bairro") == []


def test_bairro_direto(anon_client):
    banco = BancoFalso(rpcs={"radar_bairro": BAIRRO_IPANEMA})
    assert _get(anon_client, banco, "/radar/publico/busca?bairro=IPANEMA").json()["tipo"] == "bairro"
    assert _get(anon_client, banco, "/radar/publico/busca?bairro=Atlantida").json()["tipo"] == "nenhum"


# ── Ambiguidade, escolha direta e nada encontrado ────────────────────────────

def test_nome_em_duas_ruas_pede_para_escolher(anon_client):
    outra = {**VIEIRA_SOUTO, "cl": 1, "bairros": ["Campo Grande"], "transacoes": 3}
    banco = BancoFalso(rpcs={"radar_resolver": [VIEIRA_SOUTO, outra]})
    corpo = _get(anon_client, banco, "/radar/publico/busca?q=Vieira Souto").json()
    assert corpo["tipo"] == "ambiguo"
    assert [o["cl"] for o in corpo["opcoes"]] == [83360, 1]


def test_com_numero_ambiguo_so_lista_ruas_que_tem_o_numero(anon_client):
    a = {**VIEIRA_SOUTO, "cl": 1, "tem_numero": True}
    b = {**VIEIRA_SOUTO, "cl": 2, "tem_numero": True}
    c = {**VIEIRA_SOUTO, "cl": 3, "tem_numero": False}
    banco = BancoFalso(rpcs={"radar_resolver": [a, b, c]})
    corpo = _get(anon_client, banco, "/radar/publico/busca?q=Vieira Souto 10").json()
    assert corpo["tipo"] == "ambiguo"
    assert [o["cl"] for o in corpo["opcoes"]] == [1, 2]
    assert corpo["numero"] == 10


def test_escolha_direta_por_cl(anon_client):
    banco = BancoFalso(
        rpcs={"radar_predio": PREDIO_510, "radar_rua": RUA_VIEIRA_SOUTO},
        tabelas={"radar_logradouros": [VIEIRA_SOUTO]},
    )
    assert _get(anon_client, banco, "/radar/publico/busca?cl=83360&numero=510").json()["tipo"] == "predio"
    assert _get(anon_client, banco, "/radar/publico/busca?cl=83360").json()["tipo"] == "rua"
    assert banco.params("radar_resolver") == []


def test_cl_inexistente(anon_client):
    banco = BancoFalso(tabelas={"radar_logradouros": []})
    assert _get(anon_client, banco, "/radar/publico/busca?cl=999").json()["tipo"] == "nenhum"


def test_nada_encontrado_sugere_grafias_parecidas(anon_client):
    banco = BancoFalso(rpcs={
        "radar_resolver": [],
        "radar_sugestoes": [{"cl": 83360, "nome": "Avenida Vieira Souto", "grafia": "Avenida Vieira Souto",
                             "bairros": ["Ipanema"], "transacoes": 437, "semelhanca": 0.7}],
    })
    corpo = _get(anon_client, banco, "/radar/publico/busca?q=Viera Souto 510").json()
    assert corpo["tipo"] == "nenhum"
    assert corpo["sugestoes"] == [{
        "tipo": "logradouro", "rotulo": "Avenida Vieira Souto", "detalhe": "Ipanema",
        "consulta": "Avenida Vieira Souto, 510", "cl": 83360, "bairro": None, "transacoes": 437,
    }]
    assert banco.params("radar_sugestoes")[0]["p_chave"] == "VIERA SOUTO"


# ── Filtros, validação e cache ───────────────────────────────────────────────

def test_filtros_de_periodo_e_tipologia(anon_client):
    banco = BancoFalso(rpcs={"radar_bairro": BAIRRO_IPANEMA})
    _get(anon_client, banco, "/radar/publico/busca?q=Ipanema&desde=2015&ate=2018&tipologia=apartamento")
    _get(anon_client, banco, "/radar/publico/busca?q=Ipanema&todo_periodo=true")
    com_anos, tudo = banco.params("radar_bairro")
    assert (com_anos["p_desde"], com_anos["p_ate"], com_anos["p_tipologia"]) == ("2015-01-01", "2018-12-01", "APARTAMENTO")
    assert (tudo["p_desde"], tudo["p_ate"]) == (None, None)


@pytest.mark.parametrize("url", [
    "/radar/publico/busca",
    "/radar/publico/busca?q=%20%20",
    "/radar/publico/busca?q=Ipanema&desde=2020&ate=2015",
    "/radar/publico/busca?q=Ipanema&por_pagina=500",
])
def test_validacao(anon_client, url):
    assert _get(anon_client, BancoFalso(), url).status_code == 422


def test_cache_por_texto_normalizado(anon_client):
    banco = BancoFalso(rpcs={"radar_bairro": BAIRRO_IPANEMA})
    primeira = _get(anon_client, banco, "/radar/publico/busca?q=Ipanema")
    segunda = _get(anon_client, banco, "/radar/publico/busca?q=%20%20IPANEMA%20")
    assert len(banco.params("radar_bairro")) == 1
    assert segunda.json()["consulta"] == "  IPANEMA "
    assert primeira.headers["cache-control"] == "public, max-age=300"


@pytest.mark.parametrize("dados_ate, desde", [
    (date(2026, 9, 1), date(2021, 10, 1)),
    (date(2026, 12, 1), date(2022, 1, 1)),
])
def test_periodo_padrao_e_de_cinco_anos(dados_ate, desde):
    assert calcular_periodo(dados_ate, None, None, False).desde == desde


def test_periodo_sem_dados_importados():
    periodo = calcular_periodo(None, None, None, False)
    assert (periodo.desde, periodo.padrao) == (None, True)


# ── Sugestões e info ─────────────────────────────────────────────────────────

def test_sugestoes_trazem_bairros_e_logradouros(anon_client):
    banco = BancoFalso(rpcs={"radar_sugestoes": [
        {"cl": 101998, "nome": "Rua Paulo Franchini", "grafia": "Rua Sobreiro",
         "bairros": ["Campo Grande", "Cosmos", "Inhoaiba"], "transacoes": 43, "semelhanca": 0.4},
    ]})
    corpo = _get(anon_client, banco, "/radar/publico/sugestoes?q=bota").json()
    # bairros primeiro, do mais negociado; "bota" também é começo de palavra em Jardim Botânico
    assert [s["rotulo"] for s in corpo] == ["Botafogo", "Jardim Botânico", "Rua Paulo Franchini"]
    assert corpo[0] == {
        "tipo": "bairro", "rotulo": "Botafogo", "detalhe": "Bairro", "consulta": "Botafogo",
        "cl": None, "bairro": "BOTAFOGO", "transacoes": 16955,
    }
    assert corpo[2]["detalhe"] == "Campo Grande, Cosmos · antiga Rua Sobreiro"
    assert corpo[2]["cl"] == 101998


def test_sugestoes_bairro_pelo_meio_do_nome(anon_client):
    banco = BancoFalso(rpcs={"radar_sugestoes": []})
    corpo = _get(anon_client, banco, "/radar/publico/sugestoes?q=botan").json()
    assert [s["rotulo"] for s in corpo] == ["Jardim Botânico"]


def test_sugestoes_texto_curto(anon_client):
    assert _get(anon_client, BancoFalso(), "/radar/publico/sugestoes?q=a").status_code == 422


def test_info(anon_client):
    corpo = _get(anon_client, BancoFalso(), "/radar/publico/info").json()
    assert corpo == {"dados_ate": "2026-09-01", "transacoes": 28955}
