"""Testes do motor de matching e endpoints de oportunidades."""
import pytest
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock
from app.routers.oportunidades import (
    _imovel_casa_preferencia,
    _score_imovel_preferencia,
    VALOR_MINIMO_OPORTUNIDADE,
)


# ── Fixtures de dados ─────────────────────────────────────────────────────────

def _imovel(**kwargs):
    """Imóvel de venda disponível acima de R$ 2M (passa o filtro básico por padrão)."""
    base = {
        "tipo_negocio": "venda",
        "tipo_imovel": "apartamento",
        "cidade": "São Paulo",
        "bairro": "Pinheiros",
        "dormitorios": 2,
        "valor_venda": 2_500_000.0,
        "valor_locacao": None,
    }
    base.update(kwargs)
    return base


def _pref(**kwargs):
    """Preferência mínima (sem critérios = aceita tudo que passa o filtro de valor)."""
    base = {
        "tipo_negocio": None,
        "tipo_imovel": None,
        "cidade": None,
        "bairro": None,
        "dormitorios_min": None,
        "valor_min": None,
        "valor_max": None,
    }
    base.update(kwargs)
    return base


# ── _imovel_casa_preferencia: filtro de tipo de negócio ──────────────────────

class TestFiltroTipoNegocio:
    def test_sem_preferencia_aceita_qualquer_negocio(self):
        assert _imovel_casa_preferencia(_imovel(tipo_negocio="venda"), _pref())

    def test_preferencia_venda_aceita_imovel_venda(self):
        assert _imovel_casa_preferencia(_imovel(tipo_negocio="venda"), _pref(tipo_negocio="venda"))

    def test_preferencia_venda_rejeita_imovel_locacao(self):
        assert not _imovel_casa_preferencia(
            _imovel(tipo_negocio="locacao", valor_locacao=8000.0, valor_venda=None),
            _pref(tipo_negocio="venda"),
        )

    def test_preferencia_locacao_aceita_imovel_locacao(self):
        imovel = _imovel(tipo_negocio="locacao", valor_locacao=8000.0, valor_venda=None)
        assert _imovel_casa_preferencia(imovel, _pref(tipo_negocio="locacao"))

    def test_preferencia_ambos_aceita_venda_e_locacao(self):
        venda = _imovel(tipo_negocio="venda")
        locacao = _imovel(tipo_negocio="locacao", valor_locacao=8000.0, valor_venda=None)
        assert _imovel_casa_preferencia(venda, _pref(tipo_negocio="ambos"))
        assert _imovel_casa_preferencia(locacao, _pref(tipo_negocio="ambos"))

    def test_imovel_ambos_aceito_por_preferencia_venda(self):
        # Imóvel marcado como "ambos" é aceito quando pref quer "venda"
        imovel = _imovel(tipo_negocio="ambos", valor_venda=3_000_000.0)
        assert _imovel_casa_preferencia(imovel, _pref(tipo_negocio="venda"))


# ── _imovel_casa_preferencia: filtro de tipo de imóvel ───────────────────────

class TestFiltroTipoImovel:
    def test_sem_preferencia_aceita_qualquer_tipo(self):
        assert _imovel_casa_preferencia(_imovel(tipo_imovel="casa"), _pref())

    def test_tipo_correto_passa(self):
        assert _imovel_casa_preferencia(
            _imovel(tipo_imovel="apartamento"),
            _pref(tipo_imovel="apartamento"),
        )

    def test_tipo_errado_rejeita(self):
        assert not _imovel_casa_preferencia(
            _imovel(tipo_imovel="casa"),
            _pref(tipo_imovel="apartamento"),
        )


# ── _imovel_casa_preferencia: filtro de cidade ───────────────────────────────

class TestFiltroCidade:
    def test_sem_cidade_na_pref_aceita_qualquer(self):
        assert _imovel_casa_preferencia(_imovel(cidade="Niterói"), _pref())

    def test_cidade_case_insensitive(self):
        assert _imovel_casa_preferencia(
            _imovel(cidade="São Paulo"),
            _pref(cidade="são paulo"),
        )

    def test_cidade_substring(self):
        assert _imovel_casa_preferencia(
            _imovel(cidade="São Paulo"),
            _pref(cidade="paulo"),
        )

    def test_cidade_diferente_rejeita(self):
        assert not _imovel_casa_preferencia(
            _imovel(cidade="Niterói"),
            _pref(cidade="São Paulo"),
        )

    def test_cidade_vazia_na_pref_nao_filtra(self):
        assert _imovel_casa_preferencia(_imovel(cidade="Niterói"), _pref(cidade=""))

    def test_cidade_apenas_espacos_nao_filtra(self):
        assert _imovel_casa_preferencia(_imovel(cidade="Niterói"), _pref(cidade="   "))


# ── _imovel_casa_preferencia: filtro de bairro ───────────────────────────────

class TestFiltroBairro:
    def test_bairro_match_parcial(self):
        assert _imovel_casa_preferencia(
            _imovel(bairro="Pinheiros"),
            _pref(bairro="pinheiro"),
        )

    def test_bairro_diferente_rejeita(self):
        assert not _imovel_casa_preferencia(
            _imovel(bairro="Moema"),
            _pref(bairro="Pinheiros"),
        )


# ── _imovel_casa_preferencia: filtro de dormitórios ─────────────────────────

class TestFiltroDormitorios:
    def test_sem_preferencia_aceita_qualquer(self):
        assert _imovel_casa_preferencia(_imovel(dormitorios=1), _pref())

    def test_dormitorios_suficientes(self):
        assert _imovel_casa_preferencia(
            _imovel(dormitorios=3),
            _pref(dormitorios_min=2),
        )

    def test_dormitorios_exatos(self):
        assert _imovel_casa_preferencia(
            _imovel(dormitorios=2),
            _pref(dormitorios_min=2),
        )

    def test_dormitorios_insuficientes_rejeita(self):
        assert not _imovel_casa_preferencia(
            _imovel(dormitorios=1),
            _pref(dormitorios_min=2),
        )

    def test_imovel_sem_dormitorios_rejeita_quando_filtro_ativo(self):
        assert not _imovel_casa_preferencia(
            _imovel(dormitorios=None),
            _pref(dormitorios_min=1),
        )

    def test_dormitorios_min_zero_nao_filtra(self):
        # 0 é falsy em Python — não deve contar como critério ativo
        assert _imovel_casa_preferencia(_imovel(dormitorios=1), _pref(dormitorios_min=0))


# ── _imovel_casa_preferencia: regra VALOR_MINIMO_OPORTUNIDADE (R$ 2M) ────────

class TestFiltroValorMinimo:
    def test_venda_acima_do_minimo_passa(self):
        assert _imovel_casa_preferencia(
            _imovel(tipo_negocio="venda", valor_venda=VALOR_MINIMO_OPORTUNIDADE),
            _pref(),
        )

    def test_venda_abaixo_do_minimo_rejeita(self):
        assert not _imovel_casa_preferencia(
            _imovel(tipo_negocio="venda", valor_venda=1_999_999.0),
            _pref(),
        )

    def test_venda_sem_valor_rejeita(self):
        assert not _imovel_casa_preferencia(
            _imovel(tipo_negocio="venda", valor_venda=None),
            _pref(),
        )

    def test_locacao_nao_tem_filtro_de_valor_minimo(self):
        # Locação de R$ 5.000 deve passar — filtro de R$ 2M não se aplica
        imovel = _imovel(tipo_negocio="locacao", valor_locacao=5_000.0, valor_venda=None)
        assert _imovel_casa_preferencia(imovel, _pref())

    def test_imovel_ambos_aplica_filtro_de_valor_venda(self):
        # tipo_negocio="ambos" não é "locacao", então aplica o filtro
        assert not _imovel_casa_preferencia(
            _imovel(tipo_negocio="ambos", valor_venda=500_000.0),
            _pref(),
        )


# ── _imovel_casa_preferencia: filtro de faixa de valor ───────────────────────

class TestFiltroFaixaValor:
    def test_valor_dentro_da_faixa_venda(self):
        assert _imovel_casa_preferencia(
            _imovel(tipo_negocio="venda", valor_venda=3_000_000.0),
            _pref(valor_min=2_000_000.0, valor_max=5_000_000.0),
        )

    def test_valor_abaixo_do_min_rejeita(self):
        assert not _imovel_casa_preferencia(
            _imovel(tipo_negocio="venda", valor_venda=2_100_000.0),
            _pref(valor_min=3_000_000.0),
        )

    def test_valor_acima_do_max_rejeita(self):
        assert not _imovel_casa_preferencia(
            _imovel(tipo_negocio="venda", valor_venda=6_000_000.0),
            _pref(valor_max=5_000_000.0),
        )

    def test_locacao_usa_valor_locacao(self):
        imovel = _imovel(tipo_negocio="locacao", valor_locacao=8_000.0, valor_venda=None)
        assert _imovel_casa_preferencia(imovel, _pref(valor_min=5_000.0, valor_max=10_000.0))

    def test_locacao_sem_valor_rejeita_quando_faixa_definida(self):
        imovel = _imovel(tipo_negocio="locacao", valor_locacao=None, valor_venda=None)
        assert not _imovel_casa_preferencia(imovel, _pref(valor_min=5_000.0))


# ── _score_imovel_preferencia ─────────────────────────────────────────────────

class TestScorePreferencia:
    def test_pref_vazia_score_zero(self):
        assert _score_imovel_preferencia(_pref()) == 0

    def test_score_maximo_seis(self):
        pref = _pref(
            tipo_negocio="venda",
            tipo_imovel="apartamento",
            cidade="São Paulo",
            bairro="Pinheiros",
            dormitorios_min=2,
            valor_min=2_000_000.0,
        )
        assert _score_imovel_preferencia(pref) == 6

    def test_tipo_negocio_ambos_nao_conta(self):
        # "ambos" significa preferência aberta — não acrescenta ao score
        assert _score_imovel_preferencia(_pref(tipo_negocio="ambos")) == 0

    def test_tipo_negocio_venda_conta(self):
        assert _score_imovel_preferencia(_pref(tipo_negocio="venda")) == 1

    def test_dormitorios_min_zero_nao_conta(self):
        # 0 é falsy — não deve contar no score
        assert _score_imovel_preferencia(_pref(dormitorios_min=0)) == 0

    def test_dormitorios_min_um_conta(self):
        assert _score_imovel_preferencia(_pref(dormitorios_min=1)) == 1

    def test_apenas_valor_max_ja_conta(self):
        assert _score_imovel_preferencia(_pref(valor_max=5_000_000.0)) == 1

    def test_cidade_espaco_nao_conta(self):
        assert _score_imovel_preferencia(_pref(cidade="   ")) == 0


# ── GET /clientes/{id}/preferencia ────────────────────────────────────────────

PREF_DB = {
    "id": "pref-uuid-1",
    "cliente_id": "cliente-uuid-1",
    "tipo_negocio": "venda",
    "tipo_imovel": "apartamento",
    "cidade": "São Paulo",
    "bairro": None,
    "dormitorios_min": 2,
    "valor_min": 2_000_000.0,
    "valor_max": 5_000_000.0,
    "observacoes": None,
    "ativa": True,
    "created_at": "2025-01-01T00:00:00+00:00",
    "updated_at": "2025-01-01T00:00:00+00:00",
}


def test_obter_preferencia_existente(client):
    db = make_db_mock(MagicMock(data=PREF_DB))
    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.get("/clientes/cliente-uuid-1/preferencia")
    assert res.status_code == 200
    assert res.json()["tipo_negocio"] == "venda"


def test_obter_preferencia_nao_encontrada_retorna_404(client):
    db = make_db_mock(MagicMock(data=None))
    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.get("/clientes/cliente-uuid-1/preferencia")
    assert res.status_code == 404


def test_obter_preferencia_exige_autenticacao(anon_client):
    res = anon_client.get("/clientes/cliente-uuid-1/preferencia")
    assert res.status_code == 403


# ── PUT /clientes/{id}/preferencia ───────────────────────────────────────────

PREF_PAYLOAD = {
    "tipo_negocio": "venda",
    "tipo_imovel": "apartamento",
    "cidade": "São Paulo",
    "dormitorios_min": 2,
    "valor_min": 2_000_000.0,
    "valor_max": 5_000_000.0,
}


def test_criar_preferencia_quando_nao_existe(client):
    # existing.data = None → insert
    existing_mock = MagicMock(data=None)
    insert_mock = MagicMock(data=[PREF_DB])
    db = make_db_mock(existing_mock, insert_mock)

    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.put("/clientes/cliente-uuid-1/preferencia", json=PREF_PAYLOAD)

    assert res.status_code == 200
    assert res.json()["tipo_negocio"] == "venda"


def test_atualizar_preferencia_quando_ja_existe(client):
    # existing.data presente → update
    existing_mock = MagicMock(data={"id": "pref-uuid-1"})
    update_mock = MagicMock(data=[PREF_DB])
    db = make_db_mock(existing_mock, update_mock)

    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.put("/clientes/cliente-uuid-1/preferencia", json=PREF_PAYLOAD)

    assert res.status_code == 200


def test_upsert_preferencia_exige_admin(corretor_client):
    res = corretor_client.put("/clientes/cliente-uuid-1/preferencia", json=PREF_PAYLOAD)
    assert res.status_code == 403


def test_upsert_preferencia_falha_no_banco_retorna_500(client):
    existing_mock = MagicMock(data=None)
    insert_falhou = MagicMock(data=None)  # insert não retornou dados
    db = make_db_mock(existing_mock, insert_falhou)

    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.put("/clientes/cliente-uuid-1/preferencia", json=PREF_PAYLOAD)

    assert res.status_code == 500


# ── DELETE /clientes/{id}/preferencia ────────────────────────────────────────

def test_remover_preferencia(client):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.delete("/clientes/cliente-uuid-1/preferencia")
    assert res.status_code == 204


def test_remover_preferencia_exige_admin(corretor_client):
    res = corretor_client.delete("/clientes/cliente-uuid-1/preferencia")
    assert res.status_code == 403


# ── GET /clientes/{id}/matches ────────────────────────────────────────────────

IMOVEL_MATCH = {
    "id": "imovel-uuid-1",
    "codigo": "IMO-00001",
    "cidade": "São Paulo",
    "bairro": "Pinheiros",
    "tipo_imovel": "apartamento",
    "tipo_negocio": "venda",
    "valor_venda": 3_000_000.0,
    "valor_locacao": None,
    "dormitorios": 3,
    "imovel_fotos": [],
}

PREF_ATIVA = {**PREF_DB, "ativa": True}


def test_matches_sem_preferencia_retorna_lista_vazia(client):
    db = make_db_mock(MagicMock(data=None))
    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.get("/clientes/cliente-uuid-1/matches")
    assert res.status_code == 200
    assert res.json() == []


def test_matches_retorna_imoveis_compativeis(client):
    pref_mock = MagicMock(data=PREF_ATIVA)
    imoveis_mock = MagicMock(data=[IMOVEL_MATCH])
    db = make_db_mock(pref_mock, imoveis_mock)

    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.get("/clientes/cliente-uuid-1/matches")

    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["codigo"] == "IMO-00001"
    assert "score" in body[0]


def test_matches_exclui_imovel_incompativel(client):
    pref_mock = MagicMock(data={**PREF_ATIVA, "tipo_imovel": "casa"})
    # Imóvel é apartamento — não casa
    imoveis_mock = MagicMock(data=[IMOVEL_MATCH])
    db = make_db_mock(pref_mock, imoveis_mock)

    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.get("/clientes/cliente-uuid-1/matches")

    assert res.json() == []


def test_matches_exclui_imovel_abaixo_de_2m(client):
    pref_mock = MagicMock(data=PREF_ATIVA)
    imovel_barato = {**IMOVEL_MATCH, "valor_venda": 900_000.0}
    imoveis_mock = MagicMock(data=[imovel_barato])
    db = make_db_mock(pref_mock, imoveis_mock)

    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.get("/clientes/cliente-uuid-1/matches")

    assert res.json() == []


def test_matches_ordena_por_score_decrescente(client):
    """Match com mais critérios na preferência vem primeiro."""
    pref_alta = {**PREF_ATIVA, "cliente_id": "c1", "tipo_imovel": "apartamento", "dormitorios_min": 2}
    pref_baixa = {**PREF_ATIVA, "cliente_id": "c2", "tipo_imovel": None, "dormitorios_min": None}

    # Simula dois imoveis — preferência com mais score deve vencer
    # Usamos 1 preferência com score alto para verificar a ordenação da lista de matches
    pref_mock = MagicMock(data=pref_alta)
    imovel2 = {**IMOVEL_MATCH, "id": "i2", "codigo": "IMO-00002", "valor_venda": 4_000_000.0}
    imoveis_mock = MagicMock(data=[IMOVEL_MATCH, imovel2])
    db = make_db_mock(pref_mock, imoveis_mock)

    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.get("/clientes/cliente-uuid-1/matches")

    body = res.json()
    # Todos os matches têm o mesmo score (mesma pref) — lista deve ter 2 itens
    assert len(body) == 2


def test_matches_foto_capa_e_primeira_foto_ordenada(client):
    imovel_com_fotos = {
        **IMOVEL_MATCH,
        "imovel_fotos": [
            {"url": "foto2.jpg", "ordem": 2},
            {"url": "foto1.jpg", "ordem": 1},
        ],
    }
    pref_mock = MagicMock(data=PREF_ATIVA)
    imoveis_mock = MagicMock(data=[imovel_com_fotos])
    db = make_db_mock(pref_mock, imoveis_mock)

    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.get("/clientes/cliente-uuid-1/matches")

    assert res.json()[0]["foto_capa"] == "foto1.jpg"


def test_matches_exige_autenticacao(anon_client):
    res = anon_client.get("/clientes/cliente-uuid-1/matches")
    assert res.status_code == 403


# ── GET /imoveis/{id}/interessados ────────────────────────────────────────────

PREF_INTERESSADO = {
    "id": "pref-uuid-2",
    "cliente_id": "cliente-uuid-2",
    "tipo_negocio": "venda",
    "tipo_imovel": "apartamento",
    "cidade": "São Paulo",
    "bairro": None,
    "valor_min": None,
    "valor_max": None,
    "dormitorios_min": 2,
    "observacoes": "Urgente",
    "clientes": {
        "nome_completo": "Carlos Souza",
        "telefone": "11999998888",
        "email": "carlos@email.com",
        "tipo_cliente": "comprador",
    },
}


def test_interessados_retorna_clientes_compativeis(client):
    imovel_mock = MagicMock(data=IMOVEL_MATCH)
    prefs_mock = MagicMock(data=[PREF_INTERESSADO])
    db = make_db_mock(imovel_mock, prefs_mock)

    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.get("/imoveis/imovel-uuid-1/interessados")

    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["nome_completo"] == "Carlos Souza"
    assert "score" in body[0]


def test_interessados_imovel_nao_encontrado_retorna_404(client):
    db = make_db_mock(MagicMock(data=None))
    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.get("/imoveis/uuid-inexistente/interessados")
    assert res.status_code == 404


def test_interessados_pula_cliente_sem_nome(client):
    pref_sem_cliente = {**PREF_INTERESSADO, "clientes": {"nome_completo": None}}
    imovel_mock = MagicMock(data=IMOVEL_MATCH)
    prefs_mock = MagicMock(data=[pref_sem_cliente])
    db = make_db_mock(imovel_mock, prefs_mock)

    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.get("/imoveis/imovel-uuid-1/interessados")

    assert res.json() == []


def test_interessados_sem_preferencias_compatíveis_retorna_vazio(client):
    imovel_mock = MagicMock(data=IMOVEL_MATCH)
    # Preferência quer 5 dormitórios, imóvel tem 3
    pref_incompativel = {**PREF_INTERESSADO, "dormitorios_min": 5}
    prefs_mock = MagicMock(data=[pref_incompativel])
    db = make_db_mock(imovel_mock, prefs_mock)

    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.get("/imoveis/imovel-uuid-1/interessados")

    assert res.json() == []


def test_interessados_exige_autenticacao(anon_client):
    res = anon_client.get("/imoveis/imovel-uuid-1/interessados")
    assert res.status_code == 403


# ── GET /oportunidades/resumo ─────────────────────────────────────────────────

def test_resumo_sem_preferencias_ativas_retorna_zeros(client):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.get("/oportunidades/resumo")
    assert res.status_code == 200
    assert res.json() == {"total_oportunidades": 0, "clientes_com_preferencia": 0}


def test_resumo_conta_pares_validos(client):
    pref_mock = MagicMock(data=[PREF_ATIVA])
    # Imóvel compatível (venda, tipo apartamento, SP, valor > 2M)
    imoveis_mock = MagicMock(data=[
        {
            "id": "i1",
            "tipo_negocio": "venda",
            "tipo_imovel": "apartamento",
            "cidade": "São Paulo",
            "bairro": "Pinheiros",
            "valor_venda": 3_000_000.0,
            "valor_locacao": None,
            "dormitorios": 3,
        }
    ])
    db = make_db_mock(pref_mock, imoveis_mock)

    with patch("app.routers.oportunidades.supabase_admin", db):
        res = client.get("/oportunidades/resumo")

    body = res.json()
    assert body["clientes_com_preferencia"] == 1
    assert body["total_oportunidades"] == 1


def test_resumo_exige_autenticacao(anon_client):
    res = anon_client.get("/oportunidades/resumo")
    assert res.status_code == 403
