"""Testes que cobrem gaps do router de imóveis: ramos de filtro do
`_aplicar_filtros`, o filtro `sem_foto`, os endpoints de documentos internos
e os caminhos de rollback (rotação de foto / upload de documento)."""
from unittest.mock import AsyncMock, MagicMock, call, patch

from app.routers.imoveis import _aplicar_filtros, _csv_safe
from app.schemas.imovel import TipoNegocio
from tests.conftest import make_db_mock
from tests.test_imoveis import IMOVEL_DB


# ── _aplicar_filtros: cobre cada ramo de filtro de uma vez ────────────────────

def test_aplicar_filtros_cobre_todos_os_ramos_venda():
    q = MagicMock()
    # encadeamento fluente: todo método devolve o próprio mock
    for m in ("or_", "ilike", "eq", "gte", "lte", "in_"):
        getattr(q, m).return_value = q

    _aplicar_filtros(
        q,
        tipo_negocio=TipoNegocio.venda, disponibilidade="disponivel",
        cidade="São Paulo", bairro="Pinheiros", tipo_imovel="apartamento",
        dormitorios_min=2, preco_min=100_000, preco_max=900_000,
        condicao="usado", mobiliado="sim", codigo="MB", andar_max=3, q=None,
    )

    eq_cols = [c.args[0] for c in q.eq.call_args_list]
    assert {"tipo_negocio", "disponibilidade", "tipo_imovel", "condicao", "mobiliado"} <= set(eq_cols)
    # cidade e bairro usam ilike sobre as colunas _norm
    ilike_cols = [c.args[0] for c in q.ilike.call_args_list]
    assert "cidade_norm" in ilike_cols
    assert "bairro_norm" in ilike_cols
    assert "codigo" in ilike_cols
    # venda → preço usa valor_venda
    gte_cols = {c.args[0] for c in q.gte.call_args_list}
    lte_cols = {c.args[0] for c in q.lte.call_args_list}
    assert "valor_venda" in gte_cols and "valor_venda" in lte_cols
    assert "dormitorios" in gte_cols   # dormitorios_min
    assert "andar" in lte_cols          # andar_max


def test_aplicar_filtros_preco_locacao_usa_valor_locacao():
    q = MagicMock()
    for m in ("eq", "gte", "lte"):
        getattr(q, m).return_value = q
    _aplicar_filtros(
        q, tipo_negocio=TipoNegocio.locacao, disponibilidade=None,
        cidade=None, bairro=None, tipo_imovel=None, dormitorios_min=None,
        preco_min=1000, preco_max=5000, condicao=None, mobiliado=None, codigo=None,
    )
    assert "valor_locacao" in {c.args[0] for c in q.gte.call_args_list}
    assert "valor_locacao" in {c.args[0] for c in q.lte.call_args_list}


def test_aplicar_filtros_bairro_lista_multiplos_usa_or():
    q = MagicMock()
    q.or_.return_value = q
    _aplicar_filtros(
        q, tipo_negocio=None, disponibilidade=None, cidade=None,
        bairro=["Pinheiros", "Moema"], tipo_imovel=None, dormitorios_min=None,
        preco_min=None, preco_max=None, condicao=None, mobiliado=None, codigo=None,
    )
    or_clauses = " ".join(c.args[0] for c in q.or_.call_args_list if c.args)
    assert "bairro_norm.ilike.%pinheiros%" in or_clauses
    assert "bairro_norm.ilike.%moema%" in or_clauses


# ── _csv_safe: neutraliza fórmulas (CSV injection) ───────────────────────────

def test_csv_safe_prefixa_formula():
    assert _csv_safe("=SOMA(A1)") == "'=SOMA(A1)"
    assert _csv_safe("+1") == "'+1"
    assert _csv_safe("@cmd") == "'@cmd"


def test_csv_safe_valores_normais_e_nulos():
    assert _csv_safe(None) == ""
    assert _csv_safe("Pinheiros") == "Pinheiros"
    assert _csv_safe(42) == "42"


# ── Filtro sem_foto ───────────────────────────────────────────────────────────

def test_listar_sem_foto_todos_tem_foto_retorna_vazio(client):
    """Quando todo imóvel (não-locação) tem foto, a lista sem_foto fica vazia."""
    todos = MagicMock(data=[{"id": "a"}, {"id": "b"}])
    com_foto = MagicMock(data=[{"imovel_id": "a"}, {"imovel_id": "b"}])
    db = make_db_mock(todos, com_foto)
    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/", params={"sem_foto": "true"})
    assert res.status_code == 200
    assert res.json() == []
    assert res.headers["x-total-count"] == "0"


def test_listar_sem_foto_filtra_ids(client):
    """Imóvel 'b' não tem foto → entra no filtro in_('id', [...])."""
    todos = MagicMock(data=[{"id": "a"}, {"id": "b"}])
    com_foto = MagicMock(data=[{"imovel_id": "a"}])
    count_res = MagicMock(count=1, data=[])
    data_res = MagicMock(count=1, data=[{**IMOVEL_DB, "id": "b"}])
    db = make_db_mock(todos, com_foto, count_res, data_res)
    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/", params={"sem_foto": "true"})
    assert res.status_code == 200
    assert res.headers["x-total-count"] == "1"
    in_calls = [c.args for c in db.in_.call_args_list if c.args]
    assert any(c[0] == "id" and "b" in c[1] for c in in_calls)


def test_exportar_sem_foto_todos_tem_foto_so_cabecalho(client):
    todos = MagicMock(data=[{"id": "a"}])
    com_foto = MagicMock(data=[{"imovel_id": "a"}])
    db = make_db_mock(todos, com_foto)
    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/exportar", params={"sem_foto": "true"})
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    linhas = res.content.decode("utf-8-sig").strip().split("\r\n")
    assert len(linhas) == 1  # só o cabeçalho


# ── Documentos internos do imóvel ─────────────────────────────────────────────

DOC_DB = {
    "id": "doc-1",
    "imovel_id": "imovel-uuid-1",
    "tipo": "matricula",
    "nome_arquivo": "matricula.pdf",
    "firebase_path": "imoveis/imovel-uuid-1/documentos/abc-matricula.pdf",
    "tamanho_bytes": 1234,
    "mime_type": "application/pdf",
    "uploaded_by": "user-1",
    "created_at": "2025-01-01T00:00:00+00:00",
}


def test_listar_documentos(client):
    db = make_db_mock(MagicMock(data=[DOC_DB]))
    with patch("app.routers.imoveis.supabase_admin", db), \
         patch("app.routers.imoveis.url_publica_documento", return_value="https://signed/doc"):
        res = client.get("/imoveis/imovel-uuid-1/documentos")
    assert res.status_code == 200
    body = res.json()
    assert body[0]["id"] == "doc-1"
    assert body[0]["url"] == "https://signed/doc"


def test_upload_documento_sucesso(client):
    existe = MagicMock(data=[{"id": "imovel-uuid-1"}])
    inserted = MagicMock(data=[DOC_DB])
    db = make_db_mock(existe, inserted)
    info = {"firebase_path": DOC_DB["firebase_path"], "mime_type": "application/pdf", "tamanho_bytes": 1234}
    with patch("app.routers.imoveis.supabase_admin", db), \
         patch("app.routers.imoveis.upload_documento", new=AsyncMock(return_value=info)), \
         patch("app.routers.imoveis.url_publica_documento", return_value="https://signed/doc"):
        res = client.post(
            "/imoveis/imovel-uuid-1/documentos",
            files=[("file", ("matricula.pdf", b"%PDF-1.4", "application/pdf"))],
            data={"tipo": "matricula"},
        )
    assert res.status_code == 201
    assert res.json()["nome_arquivo"] == "matricula.pdf"


def test_upload_documento_imovel_inexistente(client):
    db = make_db_mock(MagicMock(data=[]))  # _imovel_existe → vazio
    with patch("app.routers.imoveis.supabase_admin", db), \
         patch("app.routers.imoveis.upload_documento", new=AsyncMock()) as up:
        res = client.post(
            "/imoveis/imovel-uuid-1/documentos",
            files=[("file", ("x.pdf", b"%PDF", "application/pdf"))],
        )
    assert res.status_code == 404
    up.assert_not_awaited()  # nem chega a subir o arquivo


def test_upload_documento_rollback_quando_insert_falha(client):
    existe = MagicMock(data=[{"id": "imovel-uuid-1"}])
    db = make_db_mock(existe)
    db.execute.side_effect = [existe, Exception("boom no insert")]
    info = {"firebase_path": "p/x", "mime_type": "application/pdf", "tamanho_bytes": 1}
    deletar = MagicMock()
    with patch("app.routers.imoveis.supabase_admin", db), \
         patch("app.routers.imoveis.upload_documento", new=AsyncMock(return_value=info)), \
         patch("app.routers.imoveis.deletar_documento", deletar):
        res = client.post(
            "/imoveis/imovel-uuid-1/documentos",
            files=[("file", ("x.pdf", b"%PDF", "application/pdf"))],
        )
    assert res.status_code == 500
    deletar.assert_called_once()  # reverte o arquivo órfão


def test_deletar_documento_sucesso(client):
    existente = MagicMock(data=[DOC_DB])
    db = make_db_mock(existente, MagicMock(data=[]))
    deletar = MagicMock()
    with patch("app.routers.imoveis.supabase_admin", db), \
         patch("app.routers.imoveis.deletar_documento", deletar):
        res = client.delete("/imoveis/imovel-uuid-1/documentos/doc-1")
    assert res.status_code == 204
    deletar.assert_called_once_with(DOC_DB["firebase_path"])


def test_deletar_documento_inexistente_idempotente(client):
    db = make_db_mock(MagicMock(data=[]))
    deletar = MagicMock()
    with patch("app.routers.imoveis.supabase_admin", db), \
         patch("app.routers.imoveis.deletar_documento", deletar):
        res = client.delete("/imoveis/imovel-uuid-1/documentos/nao-existe")
    assert res.status_code == 204
    deletar.assert_not_called()


# ── Rotação de foto: rollback quando o UPDATE falha ──────────────────────────

def test_rotacionar_foto_rollback_quando_update_falha(client):
    foto = MagicMock(data={"id": "f1", "url": "https://old/a.jpg", "ordem": 2})
    db = make_db_mock(foto)
    db.execute.side_effect = [foto, Exception("falha no update")]
    deletar = AsyncMock()
    with patch("app.routers.imoveis.supabase_admin", db), \
         patch("app.routers.imoveis.baixar_e_rotacionar", return_value=b"jpeg"), \
         patch("app.routers.imoveis.upload_bytes_jpeg", return_value="https://new/a.jpg"), \
         patch("app.routers.imoveis.deletar_foto", new=deletar):
        res = client.post(
            "/imoveis/imovel-uuid-1/fotos/f1/rotacionar", json={"graus": 90}
        )
    assert res.status_code == 500
    # rollback apaga o arquivo NOVO (não o antigo)
    deletar.assert_awaited_once_with("https://new/a.jpg")
