"""Testes dos endpoints de clientes."""
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock

CLIENTE_DB = {
    "id": "cliente-uuid-1",
    "nome_completo": "Maria Oliveira",
    "email": "maria@email.com",
    "telefone": "11988887777",
    "cpf_cnpj": None,
    "data_nascimento": None,
    "telefone_secundario": None,
    "instagram": None,
    "endereco": None,
    "cidade": "São Paulo",
    "estado": "SP",
    "pais": None,
    "profissao_empresa": None,
    "origem_lead": "whatsapp",
    "corretor_id": None,
    "status": "ativo",
    "tipo_cliente": "comprador",
    "renda_aproximada": None,
    "como_conheceu": None,
    "observacoes": None,
    "imovel_codigo": None,
    "created_at": "2025-01-01T00:00:00+00:00",
    "updated_at": "2025-01-01T00:00:00+00:00",
}

CLIENTE_PAYLOAD = {
    "nome_completo": "Maria Oliveira",
    "email": "maria@email.com",
    "telefone": "11988887777",
}


# ── GET /clientes/ ────────────────────────────────────────────────────────────

def test_listar_clientes(client):
    # 2 execute(): count + data
    count_res = MagicMock(count=1, data=[])
    data_res = MagicMock(count=1, data=[CLIENTE_DB])
    db = make_db_mock(count_res, data_res)

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.get("/clientes/")

    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["nome_completo"] == "Maria Oliveira"
    assert res.headers["x-total-count"] == "1"


def test_listar_clientes_com_filtro_status(client):
    count_res = MagicMock(count=0, data=[])
    data_res = MagicMock(count=0, data=[])
    db = make_db_mock(count_res, data_res)

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.get("/clientes/?status=em_negociacao")

    assert res.status_code == 200
    assert res.json() == []


def test_listar_clientes_exige_autenticacao(anon_client):
    res = anon_client.get("/clientes/")
    assert res.status_code == 403


# ── GET /clientes/{id} ────────────────────────────────────────────────────────

def test_obter_cliente_existente(client):
    db = make_db_mock(MagicMock(data=CLIENTE_DB))

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.get("/clientes/cliente-uuid-1")

    assert res.status_code == 200
    assert res.json()["email"] == "maria@email.com"


def test_obter_cliente_nao_encontrado(client):
    db = make_db_mock(MagicMock(data=None))

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.get("/clientes/uuid-inexistente")

    assert res.status_code == 404


# ── POST /clientes/ ───────────────────────────────────────────────────────────

def test_criar_cliente(client):
    db = make_db_mock(MagicMock(data=[CLIENTE_DB]))

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post("/clientes/", json=CLIENTE_PAYLOAD)

    assert res.status_code == 201
    assert res.json()["nome_completo"] == "Maria Oliveira"


def test_criar_cliente_email_invalido(client):
    res = client.post("/clientes/", json={**CLIENTE_PAYLOAD, "email": "invalido"})
    assert res.status_code == 422


def test_criar_cliente_sem_email(client):
    sem_email = {**CLIENTE_DB, "email": None}
    db = make_db_mock(MagicMock(data=[sem_email]))

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post(
            "/clientes/",
            json={"nome_completo": "Sem Email", "telefone": "11999998888"},
        )

    assert res.status_code == 201
    assert res.json()["email"] is None


def test_criar_cliente_campos_obrigatorios_faltando(client):
    res = client.post("/clientes/", json={"nome_completo": "Teste"})
    assert res.status_code == 422


def test_criar_proprietario_com_imovel_codigo(client):
    proprietario = {
        **CLIENTE_DB,
        "tipo_cliente": "proprietario",
        "imovel_codigo": "IMO-00042",
    }
    db = make_db_mock(MagicMock(data=[proprietario]))

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post(
            "/clientes/",
            json={
                **CLIENTE_PAYLOAD,
                "tipo_cliente": "proprietario",
                "imovel_codigo": "IMO-00042",
            },
        )

    assert res.status_code == 201
    assert res.json()["imovel_codigo"] == "IMO-00042"
    # Verifica que o código foi mantido no payload enviado ao Supabase
    inserted = db.insert.call_args.args[0]
    assert inserted["imovel_codigo"] == "IMO-00042"
    assert inserted["tipo_cliente"] == "proprietario"


def test_criar_nao_proprietario_descarta_imovel_codigo(client):
    """Ao criar com tipo != proprietario, o imovel_codigo é zerado."""
    db = make_db_mock(MagicMock(data=[CLIENTE_DB]))

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post(
            "/clientes/",
            json={
                **CLIENTE_PAYLOAD,
                "tipo_cliente": "comprador",
                "imovel_codigo": "IMO-99999",
            },
        )

    assert res.status_code == 201
    inserted = db.insert.call_args.args[0]
    assert inserted["imovel_codigo"] is None


# ── Normalização do imovel_codigo no PUT ────────────────────────────────────

def test_atualizar_para_nao_proprietario_limpa_imovel_codigo(client):
    """Trocar tipo_cliente de proprietario para outro deve limpar imovel_codigo."""
    atualizado = {**CLIENTE_DB, "tipo_cliente": "comprador", "imovel_codigo": None}
    db = make_db_mock(MagicMock(data=[atualizado]))

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.put(
            "/clientes/cliente-uuid-1",
            json={**CLIENTE_PAYLOAD, "tipo_cliente": "comprador", "imovel_codigo": "IMO-00042"},
        )

    assert res.status_code == 200
    updated = db.update.call_args.args[0]
    assert updated["imovel_codigo"] is None


# ── PUT /clientes/{id} ────────────────────────────────────────────────────────

def test_atualizar_cliente(client):
    atualizado = {**CLIENTE_DB, "status": "em_negociacao"}
    db = make_db_mock(MagicMock(data=[atualizado]))

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.put(
            "/clientes/cliente-uuid-1",
            json={**CLIENTE_PAYLOAD, "status": "em_negociacao"},
        )

    assert res.status_code == 200
    assert res.json()["status"] == "em_negociacao"


# ── DELETE /clientes/{id} ─────────────────────────────────────────────────────

def test_deletar_cliente(client):
    select_mock = MagicMock(data=[{"id": "cliente-uuid-1"}])
    delete_mock = MagicMock(data=[])
    db = make_db_mock(select_mock, delete_mock)

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.delete("/clientes/cliente-uuid-1")

    assert res.status_code == 204


# ── GET /clientes/exportar ────────────────────────────────────────────────────

def test_exportar_clientes_csv(client):
    primeira_pagina = MagicMock(data=[CLIENTE_DB])
    pagina_vazia = MagicMock(data=[])
    db = make_db_mock(primeira_pagina, pagina_vazia)

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.get("/clientes/exportar")

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert "attachment" in res.headers["content-disposition"]
    body = res.content.decode("utf-8-sig")  # remove o BOM
    linhas = body.strip().split("\r\n")
    # cabeçalho + 1 linha
    assert len(linhas) == 2
    # Delimitador ';' (Excel PT-BR friendly)
    assert linhas[0].startswith("nome_completo;email;telefone")
    assert "Maria Oliveira" in linhas[1]


def test_exportar_clientes_exige_autenticacao(anon_client):
    res = anon_client.get("/clientes/exportar")
    assert res.status_code == 403


# ── POST /clientes/importar ───────────────────────────────────────────────────

def _csv_para_upload(conteudo: str, nome: str = "clientes.csv"):
    """Helper: monta o multipart no formato do TestClient."""
    return {"file": (nome, conteudo.encode("utf-8"), "text/csv")}


def test_importar_csv_simples(client):
    csv_content = (
        "Nome,Email,Telefone\n"
        "João Silva,joao@email.com,11999998888\n"
        "Ana Costa,ana@email.com,11888887777\n"
    )
    db = make_db_mock(
        MagicMock(data=[{"id": "1"}]),
        MagicMock(data=[{"id": "2"}]),
    )

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post("/clientes/importar", files=_csv_para_upload(csv_content))

    assert res.status_code == 200
    body = res.json()
    assert body["criadas"] == 2
    assert body["erros"] == 0
    assert "nome_completo" in body["campos_reconhecidos"]


def test_importar_csv_aliases_pt_br(client):
    """'Cliente', 'Celular', 'E-mail' devem mapear automaticamente."""
    csv_content = (
        "Cliente;E-mail;Celular;Cidade;UF\n"
        "Maria Souza;maria@email.com;11999998888;São Paulo;sp\n"
    )
    db = make_db_mock(MagicMock(data=[{"id": "1"}]))

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post("/clientes/importar", files=_csv_para_upload(csv_content))

    assert res.status_code == 200
    inserted = db.insert.call_args.args[0]
    assert inserted["nome_completo"] == "Maria Souza"
    assert inserted["telefone"] == "11999998888"
    assert inserted["estado"] == "SP"  # uppercase + truncado a 2 chars


def test_importar_csv_pula_linhas_invalidas(client):
    csv_content = (
        "Nome,Telefone\n"
        ",11999998888\n"           # sem nome → ignorada
        "João,\n"                  # sem telefone → ignorada
        "Ana,11888887777\n"        # OK
    )
    db = make_db_mock(MagicMock(data=[{"id": "1"}]))

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post("/clientes/importar", files=_csv_para_upload(csv_content))

    body = res.json()
    assert body["criadas"] == 1
    assert body["erros"] == 2
    motivos = [e["motivo"] for e in body["detalhes_erros"]]
    assert all("Nome ou telefone vazios" in m for m in motivos)


def test_importar_csv_sem_colunas_minimas(client):
    csv_content = "Coluna1,Coluna2\nvalor1,valor2\n"

    with patch("app.routers.clientes.supabase_admin", MagicMock()):
        res = client.post("/clientes/importar", files=_csv_para_upload(csv_content))

    assert res.status_code == 400
    assert "Nome" in res.json()["detail"]


def test_importar_renda_e_data_formato_br(client):
    """Renda 'R$ 5.000,00' e data '15/03/1990' devem ser convertidas corretamente."""
    csv_content = (
        "Nome,Telefone,Renda,Data de Nascimento\n"
        "João,11999998888,\"R$ 5.000,00\",15/03/1990\n"
    )
    db = make_db_mock(MagicMock(data=[{"id": "1"}]))

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post("/clientes/importar", files=_csv_para_upload(csv_content))

    assert res.status_code == 200
    inserted = db.insert.call_args.args[0]
    assert inserted["renda_aproximada"] == 5000.00
    assert inserted["data_nascimento"] == "1990-03-15"


def test_importar_csv_arquivo_invalido(client):
    res = client.post(
        "/clientes/importar",
        files={"file": ("dados.txt", b"texto qualquer", "text/plain")},
    )
    assert res.status_code == 400
    assert ".csv" in res.json()["detail"]


def test_importar_exige_autenticacao(anon_client):
    res = anon_client.post(
        "/clientes/importar",
        files={"file": ("c.csv", b"Nome,Telefone\nA,1\n", "text/csv")},
    )
    assert res.status_code == 403
