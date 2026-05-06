"""Testes dos endpoints de notas de clientes (log de atividade)."""
from unittest.mock import MagicMock, patch

from tests.conftest import ADMIN_USER, REGULAR_USER, make_db_mock

CLIENTE_ID = "cliente-uuid-1"
NOTA_ID = "nota-uuid-1"

NOTA_DB = {
    "id": NOTA_ID,
    "conteudo": "Ligação feita, cliente interessado.",
    "autor_nome": ADMIN_USER["nome_completo"],
    "autor_id": ADMIN_USER["id"],
    "created_at": "2026-05-06T10:00:00+00:00",
}


# ── GET /{cliente_id}/notas ───────────────────────────────────────────────────

def test_listar_notas_retorna_lista(client):
    db = make_db_mock(MagicMock(data=[NOTA_DB]))
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.get(f"/clientes/{CLIENTE_ID}/notas")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["conteudo"] == "Ligação feita, cliente interessado."
    assert body[0]["autor_nome"] == ADMIN_USER["nome_completo"]


def test_listar_notas_retorna_lista_vazia(client):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.get(f"/clientes/{CLIENTE_ID}/notas")
    assert res.status_code == 200
    assert res.json() == []


def test_listar_notas_retorna_data_none_como_lista_vazia(client):
    db = make_db_mock(MagicMock(data=None))
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.get(f"/clientes/{CLIENTE_ID}/notas")
    assert res.status_code == 200
    assert res.json() == []


def test_listar_notas_ordena_por_created_at_decrescente(client):
    db = make_db_mock(MagicMock(data=[NOTA_DB]))
    with patch("app.routers.clientes.supabase_admin", db):
        client.get(f"/clientes/{CLIENTE_ID}/notas")
    db.order.assert_called_with("created_at", desc=True)


def test_listar_notas_exige_autenticacao(anon_client):
    res = anon_client.get(f"/clientes/{CLIENTE_ID}/notas")
    assert res.status_code == 403


def test_corretor_pode_listar_notas(corretor_client):
    db = make_db_mock(MagicMock(data=[NOTA_DB]))
    with patch("app.routers.clientes.supabase_admin", db):
        res = corretor_client.get(f"/clientes/{CLIENTE_ID}/notas")
    assert res.status_code == 200


# ── POST /{cliente_id}/notas ──────────────────────────────────────────────────

def test_criar_nota(client):
    db = make_db_mock(MagicMock(data=[NOTA_DB]))
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post(
            f"/clientes/{CLIENTE_ID}/notas",
            json={"conteudo": "Ligação feita, cliente interessado."},
        )
    assert res.status_code == 201
    assert res.json()["conteudo"] == "Ligação feita, cliente interessado."


def test_criar_nota_armazena_autor_e_cliente(client):
    db = make_db_mock(MagicMock(data=[NOTA_DB]))
    with patch("app.routers.clientes.supabase_admin", db):
        client.post(
            f"/clientes/{CLIENTE_ID}/notas",
            json={"conteudo": "Nota de teste"},
        )
    inserted = db.insert.call_args.args[0]
    assert inserted["autor_id"] == ADMIN_USER["id"]
    assert inserted["autor_nome"] == ADMIN_USER["nome_completo"]
    assert inserted["cliente_id"] == CLIENTE_ID
    assert inserted["conteudo"] == "Nota de teste"


def test_criar_nota_corretor_armazena_proprio_autor(corretor_client):
    nota_corretor = {**NOTA_DB, "autor_id": REGULAR_USER["id"], "autor_nome": REGULAR_USER["nome_completo"]}
    db = make_db_mock(MagicMock(data=[nota_corretor]))
    with patch("app.routers.clientes.supabase_admin", db):
        res = corretor_client.post(
            f"/clientes/{CLIENTE_ID}/notas",
            json={"conteudo": "Follow-up realizado."},
        )
    assert res.status_code == 201
    inserted = db.insert.call_args.args[0]
    assert inserted["autor_id"] == REGULAR_USER["id"]


def test_criar_nota_conteudo_vazio_retorna_422(client):
    res = client.post(
        f"/clientes/{CLIENTE_ID}/notas",
        json={"conteudo": ""},
    )
    assert res.status_code == 422
    assert "vazio" in res.json()["detail"].lower()


def test_criar_nota_conteudo_apenas_espacos_retorna_422(client):
    res = client.post(
        f"/clientes/{CLIENTE_ID}/notas",
        json={"conteudo": "   "},
    )
    assert res.status_code == 422


def test_criar_nota_sem_campo_conteudo_retorna_422(client):
    res = client.post(f"/clientes/{CLIENTE_ID}/notas", json={})
    assert res.status_code == 422


def test_criar_nota_conteudo_trimado(client):
    """Espaços ao redor devem ser removidos antes de salvar."""
    nota_salva = {**NOTA_DB, "conteudo": "Nota sem espaços extras"}
    db = make_db_mock(MagicMock(data=[nota_salva]))
    with patch("app.routers.clientes.supabase_admin", db):
        client.post(
            f"/clientes/{CLIENTE_ID}/notas",
            json={"conteudo": "  Nota sem espaços extras  "},
        )
    inserted = db.insert.call_args.args[0]
    assert inserted["conteudo"] == "Nota sem espaços extras"


def test_criar_nota_exige_autenticacao(anon_client):
    res = anon_client.post(
        f"/clientes/{CLIENTE_ID}/notas",
        json={"conteudo": "teste"},
    )
    assert res.status_code == 403


# ── DELETE /{cliente_id}/notas/{nota_id} ─────────────────────────────────────

def test_admin_pode_deletar_nota_de_qualquer_autor(client):
    """Admin deleta notas independentemente do autor."""
    nota_de_outro = {**NOTA_DB, "autor_id": "outro-usuario-uuid"}
    db = make_db_mock(MagicMock(data=nota_de_outro), MagicMock(data=[]))
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.delete(f"/clientes/{CLIENTE_ID}/notas/{NOTA_ID}")
    assert res.status_code == 204


def test_autor_pode_deletar_propria_nota(corretor_client):
    nota_propria = {**NOTA_DB, "autor_id": REGULAR_USER["id"]}
    db = make_db_mock(MagicMock(data=nota_propria), MagicMock(data=[]))
    with patch("app.routers.clientes.supabase_admin", db):
        res = corretor_client.delete(f"/clientes/{CLIENTE_ID}/notas/{NOTA_ID}")
    assert res.status_code == 204


def test_corretor_nao_pode_deletar_nota_de_outro(corretor_client):
    """Corretor só pode deletar suas próprias notas."""
    nota_de_admin = {**NOTA_DB, "autor_id": ADMIN_USER["id"]}
    db = make_db_mock(MagicMock(data=nota_de_admin))
    with patch("app.routers.clientes.supabase_admin", db):
        res = corretor_client.delete(f"/clientes/{CLIENTE_ID}/notas/{NOTA_ID}")
    assert res.status_code == 403
    assert "permissão" in res.json()["detail"].lower()


def test_deletar_nota_inexistente_retorna_404(client):
    db = make_db_mock(MagicMock(data=None))
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.delete(f"/clientes/{CLIENTE_ID}/notas/uuid-inexistente")
    assert res.status_code == 404


def test_deletar_nota_exige_autenticacao(anon_client):
    res = anon_client.delete(f"/clientes/{CLIENTE_ID}/notas/{NOTA_ID}")
    assert res.status_code == 403


def test_deletar_nota_filtra_por_cliente_id(client):
    """A busca da nota deve filtrar por cliente_id para evitar cross-cliente."""
    db = make_db_mock(MagicMock(data=NOTA_DB), MagicMock(data=[]))
    with patch("app.routers.clientes.supabase_admin", db):
        client.delete(f"/clientes/{CLIENTE_ID}/notas/{NOTA_ID}")
    eq_calls = [c.args for c in db.eq.call_args_list]
    assert ("cliente_id", CLIENTE_ID) in eq_calls
    assert ("id", NOTA_ID) in eq_calls
