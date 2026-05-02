"""Testes dos endpoints de dashboard (/stats) e relatórios (/relatorios)."""
from unittest.mock import MagicMock, patch


def _make_stats_db(
    total_imoveis=5,
    disponiveis=3,
    total_clientes=10,
    em_negociacao=2,
    clientes_raw=None,
    mais_antigo=None,
    reservados=1,
    todos_ids=None,
    ids_com_foto=None,
    leads_7d=4,
):
    """
    Monta um mock do supabase_admin para o endpoint /stats.

    O endpoint faz exatamente 10 chamadas .execute() em sequência:
    1. count total imoveis
    2. count imoveis disponíveis
    3. count total clientes
    4. count clientes em negociação
    5. data clientes (status + origem_lead)
    6. data imovel mais antigo
    7. count imoveis reservados
    8. data todos ids imoveis
    9. data ids imoveis com foto
    10. count leads últimos 7 dias
    """
    if clientes_raw is None:
        clientes_raw = [{"status": "ativo", "origem_lead": "whatsapp"}] * total_clientes

    if todos_ids is None:
        todos_ids = [{"id": f"imovel-{i}"} for i in range(total_imoveis)]

    if ids_com_foto is None:
        ids_com_foto = [{"imovel_id": f"imovel-{i}"} for i in range(total_imoveis)]

    results = [
        MagicMock(count=total_imoveis, data=[]),
        MagicMock(count=disponiveis, data=[]),
        MagicMock(count=total_clientes, data=[]),
        MagicMock(count=em_negociacao, data=[]),
        MagicMock(count=None, data=clientes_raw),
        MagicMock(count=None, data=[mais_antigo] if mais_antigo else []),
        MagicMock(count=reservados, data=[]),
        MagicMock(count=None, data=todos_ids),
        MagicMock(count=None, data=ids_com_foto),
        MagicMock(count=leads_7d, data=[]),
    ]

    mock = MagicMock()
    for method in (
        "table", "select", "insert", "update", "delete",
        "eq", "neq", "ilike", "gte", "lte", "in_",
        "order", "range", "single", "maybe_single", "limit", "rpc",
    ):
        getattr(mock, method).return_value = mock

    padded = list(results) + [MagicMock(count=0, data=[])] * 5
    mock.execute.side_effect = padded
    return mock


# ── GET /stats ────────────────────────────────────────────────────────────────

def test_stats_retorna_estrutura_correta(client):
    db = _make_stats_db()
    with patch("app.main.supabase_admin", db):
        res = client.get("/stats")

    assert res.status_code == 200
    body = res.json()
    campos = [
        "total_imoveis", "imoveis_disponiveis", "imoveis_reservados", "imoveis_sem_foto",
        "total_clientes", "clientes_em_negociacao", "leads_ultimos_7_dias",
        "clientes_por_status", "clientes_por_origem", "imovel_mais_antigo",
    ]
    for campo in campos:
        assert campo in body, f"Campo '{campo}' ausente no /stats"


def test_stats_valores_numericos(client):
    db = _make_stats_db(
        total_imoveis=7,
        disponiveis=4,
        total_clientes=15,
        em_negociacao=3,
        reservados=2,
        leads_7d=6,
    )
    with patch("app.main.supabase_admin", db):
        res = client.get("/stats")

    body = res.json()
    assert body["total_imoveis"] == 7
    assert body["imoveis_disponiveis"] == 4
    assert body["total_clientes"] == 15
    assert body["clientes_em_negociacao"] == 3
    assert body["imoveis_reservados"] == 2
    assert body["leads_ultimos_7_dias"] == 6


def test_stats_agrega_clientes_por_status(client):
    clientes_raw = [
        {"status": "ativo", "origem_lead": "whatsapp"},
        {"status": "ativo", "origem_lead": "instagram"},
        {"status": "em_negociacao", "origem_lead": "indicacao"},
    ]
    db = _make_stats_db(clientes_raw=clientes_raw, total_clientes=3)
    with patch("app.main.supabase_admin", db):
        res = client.get("/stats")

    body = res.json()
    assert body["clientes_por_status"]["ativo"] == 2
    assert body["clientes_por_status"]["em_negociacao"] == 1


def test_stats_agrega_clientes_por_origem(client):
    clientes_raw = [
        {"status": "ativo", "origem_lead": "whatsapp"},
        {"status": "ativo", "origem_lead": "whatsapp"},
        {"status": "ativo", "origem_lead": "indicacao"},
    ]
    db = _make_stats_db(clientes_raw=clientes_raw, total_clientes=3)
    with patch("app.main.supabase_admin", db):
        res = client.get("/stats")

    body = res.json()
    assert body["clientes_por_origem"]["whatsapp"] == 2
    assert body["clientes_por_origem"]["indicacao"] == 1


def test_stats_imoveis_sem_foto_calculado_corretamente(client):
    todos_ids = [{"id": "i1"}, {"id": "i2"}, {"id": "i3"}]
    ids_com_foto = [{"imovel_id": "i1"}]  # apenas 1 tem foto
    db = _make_stats_db(todos_ids=todos_ids, ids_com_foto=ids_com_foto, total_imoveis=3)
    with patch("app.main.supabase_admin", db):
        res = client.get("/stats")

    assert res.json()["imoveis_sem_foto"] == 2


def test_stats_imovel_mais_antigo_presente(client):
    mais_antigo = {"codigo": "IMO-00001", "created_at": "2024-01-01T00:00:00+00:00"}
    db = _make_stats_db(mais_antigo=mais_antigo)
    with patch("app.main.supabase_admin", db):
        res = client.get("/stats")

    assert res.json()["imovel_mais_antigo"]["codigo"] == "IMO-00001"


def test_stats_imovel_mais_antigo_nulo_quando_sem_imoveis(client):
    db = _make_stats_db(total_imoveis=0, disponiveis=0, todos_ids=[], ids_com_foto=[])
    with patch("app.main.supabase_admin", db):
        res = client.get("/stats")

    assert res.json()["imovel_mais_antigo"] is None


def test_stats_exige_autenticacao(anon_client):
    res = anon_client.get("/stats")
    assert res.status_code == 403


def test_stats_acessivel_por_corretor(corretor_client):
    db = _make_stats_db()
    with patch("app.main.supabase_admin", db):
        res = corretor_client.get("/stats")
    assert res.status_code == 200


# ── GET /relatorios ───────────────────────────────────────────────────────────

def _make_relatorios_db(imoveis_raw=None, clientes_raw=None):
    """
    Monta mock para /relatorios.
    O endpoint faz 2 execute(): imoveis + clientes.
    """
    if imoveis_raw is None:
        imoveis_raw = []
    if clientes_raw is None:
        clientes_raw = []

    mock = MagicMock()
    for method in (
        "table", "select", "eq", "neq", "order", "limit", "execute",
    ):
        getattr(mock, method).return_value = mock

    mock.execute.side_effect = [
        MagicMock(data=imoveis_raw),
        MagicMock(data=clientes_raw),
        MagicMock(data=[]),  # fallback
    ]
    return mock


def test_relatorios_retorna_estrutura_correta(client):
    db = _make_relatorios_db()
    with patch("app.main.supabase_admin", db):
        res = client.get("/relatorios")

    assert res.status_code == 200
    body = res.json()
    campos = [
        "meses_labels", "imoveis_por_mes", "imoveis_por_tipo",
        "imoveis_por_tipo_negocio", "imoveis_por_disponibilidade",
        "top_bairros", "preco_medio_por_tipo", "clientes_por_mes",
    ]
    for campo in campos:
        assert campo in body, f"Campo '{campo}' ausente no /relatorios"


def test_relatorios_meses_labels_tem_12_meses(client):
    db = _make_relatorios_db()
    with patch("app.main.supabase_admin", db):
        res = client.get("/relatorios")

    assert len(res.json()["meses_labels"]) == 12


def test_relatorios_agrega_imoveis_por_tipo(client):
    imoveis = [
        {"created_at": "2025-01-01", "tipo_imovel": "apartamento", "tipo_negocio": "venda",
         "disponibilidade": "disponivel", "bairro": "Pinheiros", "valor_venda": 500_000.0},
        {"created_at": "2025-01-01", "tipo_imovel": "apartamento", "tipo_negocio": "venda",
         "disponibilidade": "disponivel", "bairro": "Moema", "valor_venda": 800_000.0},
        {"created_at": "2025-01-01", "tipo_imovel": "casa", "tipo_negocio": "locacao",
         "disponibilidade": "disponivel", "bairro": "Moema", "valor_venda": None},
    ]
    db = _make_relatorios_db(imoveis_raw=imoveis)
    with patch("app.main.supabase_admin", db):
        res = client.get("/relatorios")

    body = res.json()
    assert body["imoveis_por_tipo"]["apartamento"] == 2
    assert body["imoveis_por_tipo"]["casa"] == 1


def test_relatorios_top_bairros_maximo_10(client):
    imoveis = [
        {"created_at": "2025-01-01", "tipo_imovel": "apartamento", "tipo_negocio": "venda",
         "disponibilidade": "disponivel", "bairro": f"Bairro{i}", "valor_venda": None}
        for i in range(15)
    ]
    db = _make_relatorios_db(imoveis_raw=imoveis)
    with patch("app.main.supabase_admin", db):
        res = client.get("/relatorios")

    assert len(res.json()["top_bairros"]) <= 10


def test_relatorios_preco_medio_por_tipo(client):
    imoveis = [
        {"created_at": "2025-01-01", "tipo_imovel": "apartamento", "tipo_negocio": "venda",
         "disponibilidade": "disponivel", "bairro": "SP", "valor_venda": 1_000_000.0},
        {"created_at": "2025-01-01", "tipo_imovel": "apartamento", "tipo_negocio": "venda",
         "disponibilidade": "disponivel", "bairro": "SP", "valor_venda": 3_000_000.0},
    ]
    db = _make_relatorios_db(imoveis_raw=imoveis)
    with patch("app.main.supabase_admin", db):
        res = client.get("/relatorios")

    assert res.json()["preco_medio_por_tipo"]["apartamento"] == 2_000_000


def test_relatorios_sem_dados_retorna_zeros(client):
    db = _make_relatorios_db()
    with patch("app.main.supabase_admin", db):
        res = client.get("/relatorios")

    body = res.json()
    assert body["imoveis_por_tipo"] == {}
    assert body["top_bairros"] == {}


def test_relatorios_exige_autenticacao(anon_client):
    res = anon_client.get("/relatorios")
    assert res.status_code == 403


def test_relatorios_acessivel_por_corretor(corretor_client):
    db = _make_relatorios_db()
    with patch("app.main.supabase_admin", db):
        res = corretor_client.get("/relatorios")
    assert res.status_code == 200
