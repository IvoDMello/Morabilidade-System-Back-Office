"""Testes do upsert interno de cliente por telefone
(POST /clientes/interno/upsert-por-telefone), o caminho pelo qual um lead do
WhatsApp entra de verdade na base do sistema.

A regra que mais importa aqui não é "cria o cliente" — é **não estragar o que já
existe**. Um atendente que corrigiu o nome ou classificou o tipo sabe mais do que
a integração; por isso o upsert só preenche campo vazio, e nunca toca o nome.
"""
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock
from tests.test_clientes import CLIENTE_DB

URL = "/clientes/interno/upsert-por-telefone"

NOVO = {"telefone": "5511900000000", "nome_completo": "João da Silva"}


def test_cria_quando_ninguem_bate(client):
    # 1º execute(): varredura de candidatos (nenhum casa). 2º: o insert.
    inserido = {**CLIENTE_DB, "id": "novo-uuid", "nome_completo": "João da Silva",
                "telefone": "5511900000000", "codigo": "CL-00099"}
    db = make_db_mock(MagicMock(data=[CLIENTE_DB]), MagicMock(data=[inserido]))
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post(URL, json=NOVO)

    assert res.status_code == 200
    body = res.json()
    assert body["criado"] is True
    assert body["id"] == "novo-uuid"
    assert body["codigo"] == "CL-00099"


def test_lead_novo_nasce_ativo_e_com_origem_whatsapp(client):
    """Sem status explícito o lead nasce 'ativo': ele acabou de falar com a
    gente. E a origem padrão é whatsapp — que é de onde a integração fala."""
    db = make_db_mock(MagicMock(data=[]), MagicMock(data=[{**CLIENTE_DB, "id": "x"}]))
    with patch("app.routers.clientes.supabase_admin", db):
        client.post(URL, json=NOVO)

    enviado = db.insert.call_args[0][0]
    assert enviado["status"] == "ativo"
    assert enviado["origem_lead"] == "whatsapp"
    assert enviado["telefone"] == "5511900000000"


def test_reencontra_sem_criar_duplicado(client):
    # CLIENTE_DB.telefone = "11988887777"; chega com DDI 55 (formato do wa_id).
    db = make_db_mock(MagicMock(data=[CLIENTE_DB]))
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post(URL, json={"telefone": "5511988887777", "nome_completo": "Maria O."})

    assert res.status_code == 200
    body = res.json()
    assert body["criado"] is False
    assert body["id"] == CLIENTE_DB["id"]
    db.insert.assert_not_called()


def test_nunca_sobrescreve_o_nome_de_quem_ja_existe(client):
    """O nome do cadastro vence o profile_name do WhatsApp, sempre. O push name
    é escolhido pelo cliente e muda quando ele quiser ('Ju 💅')."""
    db = make_db_mock(MagicMock(data=[CLIENTE_DB]))
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post(URL, json={"telefone": "5511988887777", "nome_completo": "Ju 💅"})

    assert res.json()["nome_completo"] == CLIENTE_DB["nome_completo"]
    # Se houve update, o nome não pode estar nele.
    for chamada in db.update.call_args_list:
        assert "nome_completo" not in chamada[0][0]


def test_nao_sobrescreve_campo_ja_preenchido(client):
    """CLIENTE_DB já é 'comprador' com origem 'whatsapp'. Uma inferência do chat
    dizendo 'proprietario' não pode reclassificar quem um humano já classificou."""
    db = make_db_mock(MagicMock(data=[CLIENTE_DB]))
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post(URL, json={
            "telefone": "5511988887777",
            "nome_completo": "Maria",
            "tipo_cliente": "proprietario",
            "origem_lead": "site",
        })

    assert res.json()["criado"] is False
    db.update.assert_not_called()


def test_complementa_apenas_o_que_esta_vazio(client):
    """O outro lado da regra: campo vazio é lacuna, e preencher lacuna é o
    serviço que a integração presta."""
    sem_observacoes = {**CLIENTE_DB, "observacoes": None}
    db = make_db_mock(MagicMock(data=[sem_observacoes]))
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post(URL, json={
            "telefone": "5511988887777",
            "nome_completo": "Maria",
            "observacoes": "Procura 2 quartos em Botafogo.",
            "tipo_cliente": "proprietario",  # já preenchido: deve ser ignorado
        })

    assert res.json()["criado"] is False
    atualizacao = db.update.call_args[0][0]
    assert atualizacao == {"observacoes": "Procura 2 quartos em Botafogo."}


def test_telefone_curto_e_recusado(client):
    """Menos de 10 dígitos não casa com ninguém de forma confiável e criaria um
    cliente impossível de reencontrar."""
    db = make_db_mock()
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post(URL, json={"telefone": "12345", "nome_completo": "X"})

    assert res.status_code == 422
    db.insert.assert_not_called()


def test_nome_vazio_e_recusado(client):
    db = make_db_mock()
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post(URL, json={"telefone": "5511900000000", "nome_completo": "   "})

    assert res.status_code == 422
    db.insert.assert_not_called()


def test_exige_autenticacao(anon_client):
    # Sem X-Internal-Token e sem sessão: criar cliente é escrita, jamais anônima.
    res = anon_client.post(URL, json=NOVO)
    assert res.status_code == 401
