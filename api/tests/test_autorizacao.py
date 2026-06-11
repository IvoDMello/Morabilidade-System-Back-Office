"""Testes da Autorização de Intermediação — criação, PDF, assinatura, validações.

Cobre também múltiplos signatários (migration 038): cada proprietário tem o
próprio token; a autorização fica 'parcial' até todos assinarem.
"""
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

SIG_ROW = {
    "id": "44444444-4444-4444-4444-444444444444",
    "autorizacao_id": AUTH_ROW["id"],
    "ordem": 1,
    "nome": "Maria Silva",
    "cpf": "987.654.321-00",
    "telefone": "(21) 98888-0000",
    "email": "maria@email.com",
    "token": "tok_xyz789",
    "status": "pendente",
    "assinada_em": None,
}

SIG_ROW_2 = {
    "id": "55555555-5555-5555-5555-555555555555",
    "autorizacao_id": AUTH_ROW["id"],
    "ordem": 2,
    "nome": "João Silva",
    "cpf": "111.222.333-44",
    "telefone": "(21) 97777-0000",
    "email": None,
    "token": "tok_abc123",
    "status": "pendente",
    "assinada_em": None,
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
        MagicMock(data=[AUTH_ROW]),     # insert da autorização
        MagicMock(data=[SIG_ROW]),      # insert dos signatários
    )
    with patch(ROUTER, db):
        res = client.post("/autorizacoes", json=CRIAR_BODY)
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pendente"
    assert body["exclusiva"] is True
    assert body["token"] == "tok_xyz789"
    assert len(body["signatarios"]) == 1
    assert body["signatarios"][0]["nome"] == "Maria Silva"


def test_criar_com_multiplos_proprietarios(client):
    db = make_db_mock(
        MagicMock(data=IMOVEL),
        MagicMock(data=PROPRIETARIO),
        MagicMock(data=CORRETOR),
        MagicMock(data=[AUTH_ROW]),
        MagicMock(data=[SIG_ROW, SIG_ROW_2]),
    )
    body = dict(CRIAR_BODY, proprietarios=[
        {"nome": "Maria Silva", "cpf": "987.654.321-00"},
        {"nome": "João Silva", "cpf": "111.222.333-44", "telefone": "(21) 97777-0000"},
    ])
    with patch(ROUTER, db):
        res = client.post("/autorizacoes", json=body)
    assert res.status_code == 201
    assert len(res.json()["signatarios"]) == 2

    # Segundo insert (signatários) leva 2 linhas, cada uma com token próprio.
    linhas_sig = db.insert.call_args_list[1].args[0]
    assert len(linhas_sig) == 2
    assert linhas_sig[0]["token"] != linhas_sig[1]["token"]
    assert linhas_sig[1]["nome"] == "João Silva"
    # Token da autorização = token do signatário principal (links legados).
    linha_auth = db.insert.call_args_list[0].args[0]
    assert linha_auth["token"] == linhas_sig[0]["token"]


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
    db = make_db_mock(
        MagicMock(data=[AUTH_ROW]),  # autorizações
        MagicMock(data=[SIG_ROW]),   # signatários do lote
    )
    with patch(ROUTER, db):
        res = client.get("/autorizacoes?imovel_id=" + IMOVEL["id"])
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["signatarios"][0]["token"] == "tok_xyz789"


def test_pdf_pendente(client):
    db = make_db_mock(
        MagicMock(data=AUTH_ROW),
        MagicMock(data=[SIG_ROW, SIG_ROW_2]),  # signatários no PDF rascunho
    )
    with patch(ROUTER, db):
        res = client.get(f"/autorizacoes/{AUTH_ROW['id']}/pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")


def test_ver_publica(anon_client):
    db = make_db_mock(
        MagicMock(data=SIG_ROW),     # token → signatário
        MagicMock(data=AUTH_ROW),    # autorização
        MagicMock(data=[SIG_ROW]),   # lista de signatários
    )
    with patch(ROUTER, db):
        res = anon_client.get(f"/autorizacoes/assinar/{SIG_ROW['token']}")
    assert res.status_code == 200
    body = res.json()
    assert body["proprietario_nome"] == "Maria Silva"
    assert body["signatario_nome"] == "Maria Silva"
    assert body["ja_assinou"] is False
    assert body["exclusiva"] is True
    assert "id" not in body and "token" not in body


def test_ver_token_invalido(anon_client):
    db = make_db_mock(MagicMock(data=None))
    with patch(ROUTER, db):
        res = anon_client.get("/autorizacoes/assinar/inexistente")
    assert res.status_code == 404


def test_ver_assinada_mostra_confirmacao(anon_client):
    """Link de autorização já concluída devolve a view (o site mostra o PDF)."""
    sig_assinado = dict(SIG_ROW, status="assinada", assinada_em="2026-06-05T10:00:00+00:00")
    db = make_db_mock(
        MagicMock(data=sig_assinado),
        MagicMock(data=dict(AUTH_ROW, status="assinada")),
        MagicMock(data=[sig_assinado]),
    )
    with patch(ROUTER, db):
        res = anon_client.get(f"/autorizacoes/assinar/{SIG_ROW['token']}")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "assinada"
    assert body["ja_assinou"] is True


def test_ver_cancelada_410(anon_client):
    db = make_db_mock(
        MagicMock(data=SIG_ROW),
        MagicMock(data=dict(AUTH_ROW, status="cancelada")),
    )
    with patch(ROUTER, db):
        res = anon_client.get(f"/autorizacoes/assinar/{SIG_ROW['token']}")
    assert res.status_code == 410


def test_assinar_sucesso(anon_client):
    sig_assinado = dict(SIG_ROW, status="assinada", assinada_em="2026-06-05T10:00:00+00:00")
    db = make_db_mock(
        MagicMock(data=SIG_ROW),                              # token → signatário
        MagicMock(data=AUTH_ROW),                             # autorização
        MagicMock(data=[sig_assinado]),                       # update do signatário
        MagicMock(data=[sig_assinado]),                       # todos os signatários
        MagicMock(data=[dict(AUTH_ROW, status="assinada")]),  # update da autorização
    )
    with patch(ROUTER, db), patch(
        "app.routers.autorizacoes.upload_pdf_bytes", return_value="autorizacoes/x.pdf"
    ) as up:
        res = anon_client.post(
            f"/autorizacoes/assinar/{SIG_ROW['token']}",
            json={"aceite": True, "cpf": "98765432100", "geo": "-22.98,-43.20"},
        )
    assert res.status_code == 200
    assert res.json()["status"] == "assinada"
    up.assert_called_once()


def test_assinar_parcial_aguarda_demais(anon_client):
    """Com 2 proprietários, a primeira assinatura deixa a autorização 'parcial'
    e o PDF final ainda não é gerado."""
    sig1_assinado = dict(SIG_ROW, status="assinada", assinada_em="2026-06-05T10:00:00+00:00")
    db = make_db_mock(
        MagicMock(data=SIG_ROW),                             # token → signatário 1
        MagicMock(data=AUTH_ROW),                            # autorização
        MagicMock(data=[sig1_assinado]),                     # update do signatário
        MagicMock(data=[sig1_assinado, SIG_ROW_2]),          # signatário 2 ainda pendente
        MagicMock(data=[dict(AUTH_ROW, status="parcial")]),  # update da autorização
    )
    with patch(ROUTER, db), patch(
        "app.routers.autorizacoes.upload_pdf_bytes"
    ) as up:
        res = anon_client.post(
            f"/autorizacoes/assinar/{SIG_ROW['token']}",
            json={"aceite": True, "cpf": "98765432100"},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "parcial"
    assert body["ja_assinou"] is True
    assert {s["nome"]: s["assinou"] for s in body["signatarios"]} == {
        "Maria Silva": True, "João Silva": False,
    }
    up.assert_not_called()


def test_assinar_duas_vezes_410(anon_client):
    sig_assinado = dict(SIG_ROW, status="assinada", assinada_em="2026-06-05T10:00:00+00:00")
    db = make_db_mock(
        MagicMock(data=sig_assinado),
        MagicMock(data=dict(AUTH_ROW, status="parcial")),
    )
    with patch(ROUTER, db):
        res = anon_client.post(
            f"/autorizacoes/assinar/{SIG_ROW['token']}",
            json={"aceite": True, "cpf": "98765432100"},
        )
    assert res.status_code == 410


def test_assinar_sem_aceite_400(anon_client):
    db = make_db_mock(
        MagicMock(data=SIG_ROW),
        MagicMock(data=AUTH_ROW),
    )
    with patch(ROUTER, db):
        res = anon_client.post(
            f"/autorizacoes/assinar/{SIG_ROW['token']}",
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
