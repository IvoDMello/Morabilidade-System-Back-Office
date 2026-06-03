"""Testes da Autorização de Intermediação — criação, PDF, assinatura, validações."""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock

ROUTER = "app.routers.autorizacoes.supabase_admin"

IMOVEL = {
    "id": "11111111-1111-1111-1111-111111111111",
    "codigo": "IMO-00042",
    "logradouro": "Rua Visconde de Pirajá",
    "numero": "414",
    "complemento": None,
    "bairro": "Ipanema",
    "cidade": "Rio de Janeiro / RJ",
    "numero_matricula": "12345",
    "proprietario_id": "33333333-3333-3333-3333-333333333333",
    "valor_venda": 1850000.00,
    "valor_locacao": None,
}

PROPRIETARIO = {
    "nome_completo": "Maria Silva",
    "cpf_cnpj": "987.654.321-00",
    "telefone": "(21) 98888-0000",
    "email": "maria@email.com",
    "endereco": "Rua A, 1",
}

CORRETOR = {"nome_completo": "Rodrigo Mello", "creci": "CRECI-RJ 70411"}

AUTH_ROW = {
    "id": "22222222-2222-2222-2222-222222222222",
    "imovel_id": IMOVEL["id"],
    "proprietario_nome": "Maria Silva",
    "proprietario_cpf": "987.654.321-00",
    "imovel_codigo": "IMO-00042",
    "imovel_endereco": "Rua Visconde de Pirajá, 414",
    "imovel_bairro": "Ipanema",
    "imovel_cidade": "Rio de Janeiro / RJ",
    "tipo_negocio": "venda",
    "valor_autorizado": 1850000.00,
    "exclusiva": True,
    "comissao_venda_pct": 6.0,
    "comissao_locacao_desc": "equivalente ao primeiro aluguel",
    "prazo_dias": 90,
    "corretor_nome": "Rodrigo Mello",
    "corretor_creci": "CRECI-RJ 70411",
    "clausula_texto": "Autorização... (cláusula completa).",
    "status": "pendente",
    "token": "tok_xyz789",
    "token_expira_em": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
    "created_at": "2026-06-03T10:00:00+00:00",
}

CRIAR_BODY = {
    "imovel_id": IMOVEL["id"],
    "tipo_negocio": "venda",
    "exclusiva": True,
    "comissao_venda_pct": 6,
    "prazo_dias": 90,
}


def test_criar_autorizacao(client):
    db = make_db_mock(
        MagicMock(data=IMOVEL),         # busca imóvel
        MagicMock(data=PROPRIETARIO),   # busca proprietário (via proprietario_id do imóvel)
        MagicMock(data=CORRETOR),       # busca corretor
        MagicMock(data=[AUTH_ROW]),     # insert
    )
    with patch(ROUTER, db):
        res = client.post("/autorizacoes", json=CRIAR_BODY)
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pendente"
    assert body["exclusiva"] is True
    assert body["token"] == "tok_xyz789"


def test_criar_sem_proprietario_400(client):
    imovel_sem_dono = dict(IMOVEL, proprietario_id=None)
    db = make_db_mock(
        MagicMock(data=imovel_sem_dono),  # imóvel sem proprietário vinculado
        # corretor não chega a ser buscado pois 400 antes
    )
    with patch(ROUTER, db):
        res = client.post("/autorizacoes", json=CRIAR_BODY)
    assert res.status_code == 400


def test_criar_imovel_inexistente(client):
    db = make_db_mock(MagicMock(data=None))
    with patch(ROUTER, db):
        res = client.post("/autorizacoes", json=CRIAR_BODY)
    assert res.status_code == 404


def test_listar(client):
    db = make_db_mock(MagicMock(data=[AUTH_ROW]))
    with patch(ROUTER, db):
        res = client.get("/autorizacoes?imovel_id=" + IMOVEL["id"])
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_pdf_pendente(client):
    db = make_db_mock(MagicMock(data=AUTH_ROW))
    with patch(ROUTER, db):
        res = client.get(f"/autorizacoes/{AUTH_ROW['id']}/pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")


def test_ver_publica(anon_client):
    db = make_db_mock(MagicMock(data=AUTH_ROW))
    with patch(ROUTER, db):
        res = anon_client.get(f"/autorizacoes/assinar/{AUTH_ROW['token']}")
    assert res.status_code == 200
    body = res.json()
    assert body["proprietario_nome"] == "Maria Silva"
    assert body["exclusiva"] is True
    assert "id" not in body and "token" not in body


def test_ver_token_invalido(anon_client):
    db = make_db_mock(MagicMock(data=None))
    with patch(ROUTER, db):
        res = anon_client.get("/autorizacoes/assinar/inexistente")
    assert res.status_code == 404


def test_ver_assinada_410(anon_client):
    db = make_db_mock(MagicMock(data=dict(AUTH_ROW, status="assinada")))
    with patch(ROUTER, db):
        res = anon_client.get(f"/autorizacoes/assinar/{AUTH_ROW['token']}")
    assert res.status_code == 410


def test_assinar_sucesso(anon_client):
    db = make_db_mock(
        MagicMock(data=AUTH_ROW),                          # _assinavel
        MagicMock(data=[dict(AUTH_ROW, status="assinada")]),  # update
    )
    with patch(ROUTER, db), patch(
        "app.routers.autorizacoes.upload_pdf_bytes", return_value="autorizacoes/x.pdf"
    ) as up:
        res = anon_client.post(
            f"/autorizacoes/assinar/{AUTH_ROW['token']}",
            json={"aceite": True, "cpf": "98765432100", "geo": "-22.98,-43.20"},
        )
    assert res.status_code == 200
    assert res.json()["status"] == "assinada"
    up.assert_called_once()


def test_assinar_sem_aceite_400(anon_client):
    db = make_db_mock(MagicMock(data=AUTH_ROW))
    with patch(ROUTER, db):
        res = anon_client.post(
            f"/autorizacoes/assinar/{AUTH_ROW['token']}",
            json={"aceite": False, "cpf": "98765432100"},
        )
    assert res.status_code == 400


def test_cancelar_assinada_409(client):
    db = make_db_mock(MagicMock(data=dict(AUTH_ROW, status="assinada")))
    with patch(ROUTER, db):
        res = client.post(f"/autorizacoes/{AUTH_ROW['id']}/cancelar")
    assert res.status_code == 409


def test_anon_nao_acessa_detalhe(anon_client):
    res = anon_client.get(f"/autorizacoes/{AUTH_ROW['id']}")
    assert res.status_code in (401, 403)
