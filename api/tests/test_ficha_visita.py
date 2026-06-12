"""Testes da Ficha de Visita — criação, PDF, assinatura e validações de token."""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock

ROUTER = "app.routers.fichas_visita.supabase_admin"
CRM = "app.services.cliente_da_ficha.supabase_admin"

IMOVEL = {
    "id": "11111111-1111-1111-1111-111111111111",
    "codigo": "IMO-00042",
    "logradouro": "Rua Visconde de Pirajá",
    "numero": "414",
    "complemento": "apto 1001",
    "bairro": "Ipanema",
    "cidade": "Rio de Janeiro / RJ",
    "valor_venda": 1850000.00,
    "valor_locacao": None,
    "proprietario_id": None,  # sem proprietário → pula o select de cliente
}

CORRETOR = {"nome_completo": "Rodrigo Mello", "creci": "CRECI-RJ 70411"}

FICHA_ROW = {
    "id": "22222222-2222-2222-2222-222222222222",
    "imovel_id": IMOVEL["id"],
    "visitante_nome": "João da Silva",
    "visitante_cpf": "123.456.789-00",
    "imovel_codigo": "IMO-00042",
    "imovel_endereco": "Rua Visconde de Pirajá, 414, apto 1001",
    "imovel_bairro": "Ipanema",
    "imovel_cidade": "Rio de Janeiro / RJ",
    "imovel_valor": 1850000.00,
    "corretor_nome": "Rodrigo Mello",
    "corretor_creci": "CRECI-RJ 70411",
    "clausula_texto": "Declaro... (cláusula completa).",
    "prazo_meses": 12,
    "status": "pendente",
    "token": "tok_abc123",
    "token_expira_em": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
    "created_at": "2026-06-03T10:00:00+00:00",
}

CRIAR_BODY = {
    "imovel_id": IMOVEL["id"],
    "visitante_nome": "João da Silva",
    "visitante_cpf": "123.456.789-00",
    "visitante_telefone": "(21) 99999-0000",
    "prazo_meses": 12,
}


def test_criar_ficha_gera_token_e_snapshot(client):
    db = make_db_mock(
        MagicMock(data=IMOVEL),       # busca imóvel
        MagicMock(data=CORRETOR),     # busca corretor (proprietário pulado)
        MagicMock(data=[FICHA_ROW]),  # insert
    )
    crm = make_db_mock(
        MagicMock(data=[]),                            # nenhum cliente na base
        MagicMock(data=[{"id": "cliente-novo-uuid"}]), # cadastro automático
    )
    with patch(ROUTER, db), patch(CRM, crm):
        res = client.post("/fichas-visita", json=CRIAR_BODY)
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pendente"
    assert body["token"] == "tok_abc123"
    assert body["imovel_codigo"] == "IMO-00042"
    # Visitante sem cadastro prévio → cliente criado e vinculado à ficha.
    assert body["cliente_novo"] is True
    assert db.insert.call_args[0][0]["cliente_id"] == "cliente-novo-uuid"


def test_criar_ficha_vincula_cliente_existente_por_cpf(client):
    db = make_db_mock(
        MagicMock(data=IMOVEL),
        MagicMock(data=CORRETOR),
        MagicMock(data=[FICHA_ROW]),
    )
    cliente = {
        "id": "cliente-existente-uuid",
        "nome_completo": "João da Silva",
        "cpf_cnpj": "12345678900",  # mesmo CPF do CRIAR_BODY, sem pontuação
        "telefone": "(11) 1111-1111",
        "telefone_secundario": None,
        "email": None,
    }
    crm = make_db_mock(MagicMock(data=[cliente]))
    with patch(ROUTER, db), patch(CRM, crm):
        res = client.post("/fichas-visita", json=CRIAR_BODY)
    assert res.status_code == 201
    assert res.json()["cliente_novo"] is False
    assert db.insert.call_args[0][0]["cliente_id"] == "cliente-existente-uuid"
    crm.insert.assert_not_called()  # deduplicado — nenhum cadastro novo


def test_criar_ficha_nao_falha_se_crm_indisponivel(client):
    """O vínculo com o CRM é best-effort: erro ali não pode barrar a ficha."""
    db = make_db_mock(
        MagicMock(data=IMOVEL),
        MagicMock(data=CORRETOR),
        MagicMock(data=[FICHA_ROW]),
    )
    crm = make_db_mock()
    crm.execute.side_effect = RuntimeError("supabase fora do ar")
    with patch(ROUTER, db), patch(CRM, crm):
        res = client.post("/fichas-visita", json=CRIAR_BODY)
    assert res.status_code == 201
    assert res.json()["cliente_novo"] is False


def test_criar_ficha_imovel_inexistente(client):
    db = make_db_mock(MagicMock(data=None))  # imóvel não encontrado
    with patch(ROUTER, db):
        res = client.post("/fichas-visita", json=CRIAR_BODY)
    assert res.status_code == 404


def test_listar_fichas(client):
    db = make_db_mock(MagicMock(data=[FICHA_ROW]))
    with patch(ROUTER, db):
        res = client.get("/fichas-visita?imovel_id=" + IMOVEL["id"])
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_pdf_pendente_retorna_pdf(client):
    db = make_db_mock(MagicMock(data=FICHA_ROW))  # _buscar_ficha
    with patch(ROUTER, db):
        res = client.get(f"/fichas-visita/{FICHA_ROW['id']}/pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")


def test_ver_ficha_publica(anon_client):
    db = make_db_mock(MagicMock(data=FICHA_ROW))
    with patch(ROUTER, db):
        res = anon_client.get(f"/fichas-visita/assinar/{FICHA_ROW['token']}")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "pendente"
    assert body["visitante_nome"] == "João da Silva"
    # Não expõe ids internos.
    assert "id" not in body and "token" not in body


def test_ver_ficha_token_invalido(anon_client):
    db = make_db_mock(MagicMock(data=None))
    with patch(ROUTER, db):
        res = anon_client.get("/fichas-visita/assinar/inexistente")
    assert res.status_code == 404


def test_ver_ficha_ja_assinada_mostra_confirmacao(anon_client):
    """Reabrir o link de uma ficha assinada mostra a confirmação (com download
    do PDF), não um erro."""
    assinada = dict(FICHA_ROW, status="assinada")
    db = make_db_mock(MagicMock(data=assinada))
    with patch(ROUTER, db):
        res = anon_client.get(f"/fichas-visita/assinar/{FICHA_ROW['token']}")
    assert res.status_code == 200
    assert res.json()["status"] == "assinada"


def test_assinar_duas_vezes_410(anon_client):
    assinada = dict(FICHA_ROW, status="assinada")
    db = make_db_mock(MagicMock(data=assinada))
    with patch(ROUTER, db):
        res = anon_client.post(
            f"/fichas-visita/assinar/{FICHA_ROW['token']}",
            json={"aceite": True, "cpf": "12345678900"},
        )
    assert res.status_code == 410


def test_ver_ficha_cancelada_410(anon_client):
    cancelada = dict(FICHA_ROW, status="cancelada")
    db = make_db_mock(MagicMock(data=cancelada))
    with patch(ROUTER, db):
        res = anon_client.get(f"/fichas-visita/assinar/{FICHA_ROW['token']}")
    assert res.status_code == 410


def test_ver_ficha_expirada_410(anon_client):
    vencida = dict(
        FICHA_ROW,
        token_expira_em=(datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
    )
    db = make_db_mock(
        MagicMock(data=vencida),  # select por token
        MagicMock(data=[vencida]),  # update status=expirada
    )
    with patch(ROUTER, db):
        res = anon_client.get(f"/fichas-visita/assinar/{FICHA_ROW['token']}")
    assert res.status_code == 410


def test_assinar_sucesso(anon_client):
    assinada = dict(FICHA_ROW, status="assinada")
    db = make_db_mock(
        MagicMock(data=FICHA_ROW),    # _ficha_assinavel
        MagicMock(data=[assinada]),   # update
    )
    with patch(ROUTER, db), patch(
        "app.routers.fichas_visita.upload_pdf_bytes", return_value="fichas-visita/x.pdf"
    ) as up:
        res = anon_client.post(
            f"/fichas-visita/assinar/{FICHA_ROW['token']}",
            json={"aceite": True, "cpf": "12345678900", "geo": "-22.98,-43.20"},
        )
    assert res.status_code == 200
    assert res.json()["status"] == "assinada"
    up.assert_called_once()  # PDF assinado foi enviado ao storage


def test_assinar_atualiza_cadastro_e_perfil_do_cliente(anon_client):
    """Assinatura de ficha vinculada a cliente: completa o CPF do cadastro e
    infere a preferência de imóvel a partir das visitas assinadas."""
    com_cliente = dict(FICHA_ROW, cliente_id="cliente-uuid-1")
    assinada = dict(com_cliente, status="assinada", assinante_cpf_confirmado="12345678900")
    db = make_db_mock(
        MagicMock(data=com_cliente),  # _ficha_assinavel
        MagicMock(data=[assinada]),   # update da ficha
    )
    crm = make_db_mock(
        MagicMock(data={"cpf_cnpj": None}),                     # cliente sem CPF
        MagicMock(data=[{}]),                                   # update do CPF
        MagicMock(data=None),                                   # sem preferência ainda
        MagicMock(data=[{"imovel_id": IMOVEL["id"]}]),          # fichas assinadas
        MagicMock(data=[{
            "id": IMOVEL["id"], "tipo_negocio": "venda", "tipo_imovel": "apartamento",
            "cidade": "Rio de Janeiro / RJ", "bairro": "Ipanema",
            "valor_venda": 1850000.0, "valor_locacao": None, "dormitorios": 3,
        }]),                                                    # imóveis visitados
        MagicMock(data=[{"id": "pref-1"}]),                     # insert da preferência
    )
    with patch(ROUTER, db), patch(CRM, crm), patch(
        "app.routers.fichas_visita.upload_pdf_bytes", return_value="fichas-visita/x.pdf"
    ):
        res = anon_client.post(
            f"/fichas-visita/assinar/{FICHA_ROW['token']}",
            json={"aceite": True, "cpf": "12345678900"},
        )
    assert res.status_code == 200
    pref = crm.insert.call_args[0][0]
    assert pref["origem"] == "ficha_visita"
    assert pref["cliente_id"] == "cliente-uuid-1"
    assert pref["tipo_negocio"] == "venda"


def test_assinar_sem_aceite_400(anon_client):
    db = make_db_mock(MagicMock(data=FICHA_ROW))
    with patch(ROUTER, db):
        res = anon_client.post(
            f"/fichas-visita/assinar/{FICHA_ROW['token']}",
            json={"aceite": False, "cpf": "12345678900"},
        )
    assert res.status_code == 400


def test_cancelar_assinada_409(client):
    assinada = dict(FICHA_ROW, status="assinada")
    db = make_db_mock(MagicMock(data=assinada))
    with patch(ROUTER, db):
        res = client.post(f"/fichas-visita/{FICHA_ROW['id']}/cancelar")
    assert res.status_code == 409


def test_anon_nao_acessa_detalhe(anon_client):
    res = anon_client.get(f"/fichas-visita/{FICHA_ROW['id']}")
    assert res.status_code in (401, 403)
