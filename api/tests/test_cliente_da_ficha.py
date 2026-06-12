"""Testes da integração Ficha de Visita ↔ CRM (services/cliente_da_ficha).

Cobre a deduplicação/cadastro do visitante na geração da ficha e a inferência
do perfil de busca (cliente_preferencias) na assinatura.
"""
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock

from app.services.cliente_da_ficha import (
    _montar_preferencia,
    atualizar_cadastro_pos_assinatura,
    inferir_preferencia,
    vincular_cliente_visitante,
)

SERVICE = "app.services.cliente_da_ficha.supabase_admin"

CORRETOR_ID = "00000000-0000-0000-0000-000000000001"
CLIENTE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

CLIENTE_EXISTENTE = {
    "id": CLIENTE_ID,
    "nome_completo": "João da Silva",
    "cpf_cnpj": "123.456.789-00",
    "telefone": "(21) 99999-0000",
    "telefone_secundario": None,
    "email": "joao@exemplo.com",
}

IMOVEL_VENDA = {
    "id": "11111111-1111-1111-1111-111111111111",
    "tipo_negocio": "venda",
    "tipo_imovel": "apartamento",
    "cidade": "Rio de Janeiro",
    "bairro": "Ipanema",
    "valor_venda": 2_500_000.0,
    "valor_locacao": None,
    "dormitorios": 3,
}


def _payload(**overrides):
    base = {
        "visitante_nome": "João da Silva",
        "visitante_cpf": None,
        "visitante_telefone": None,
        "visitante_email": None,
    }
    base.update(overrides)
    return base


# ── vincular_cliente_visitante: deduplicação ─────────────────────────────────

def test_dedup_por_cpf_ignora_formatacao():
    db = make_db_mock(MagicMock(data=[CLIENTE_EXISTENTE]))
    with patch(SERVICE, db):
        cliente_id, criado = vincular_cliente_visitante(
            _payload(visitante_cpf="12345678900"), IMOVEL_VENDA, CORRETOR_ID
        )
    assert cliente_id == CLIENTE_ID
    assert criado is False
    db.insert.assert_not_called()


def test_dedup_por_telefone_tolera_ddi_e_nono_digito():
    # Payload com +55 e 9º dígito vs. cadastro formatado "(21) 99999-0000".
    db = make_db_mock(MagicMock(data=[CLIENTE_EXISTENTE]))
    with patch(SERVICE, db):
        cliente_id, criado = vincular_cliente_visitante(
            _payload(visitante_telefone="+55 21 99999-0000"), IMOVEL_VENDA, CORRETOR_ID
        )
    assert cliente_id == CLIENTE_ID
    assert criado is False
    db.insert.assert_not_called()


def test_dedup_por_email_case_insensitive():
    db = make_db_mock(MagicMock(data=[CLIENTE_EXISTENTE]))
    with patch(SERVICE, db):
        cliente_id, criado = vincular_cliente_visitante(
            _payload(visitante_email="JOAO@Exemplo.com"), IMOVEL_VENDA, CORRETOR_ID
        )
    assert cliente_id == CLIENTE_ID
    assert criado is False


def test_nome_igual_nao_deduplica():
    """Homônimo sem dado de contato em comum não pode ser vinculado."""
    db = make_db_mock(
        MagicMock(data=[CLIENTE_EXISTENTE]),               # busca clientes
        MagicMock(data=[{"id": "novo-cliente-uuid"}]),     # insert do novo
    )
    with patch(SERVICE, db):
        cliente_id, criado = vincular_cliente_visitante(
            _payload(visitante_telefone="(48) 98888-7777"), IMOVEL_VENDA, CORRETOR_ID
        )
    assert cliente_id == "novo-cliente-uuid"
    assert criado is True


# ── vincular_cliente_visitante: cadastro automático ──────────────────────────

def test_cria_cliente_novo_com_origem_ficha_visita():
    db = make_db_mock(
        MagicMock(data=[]),                                # nenhum cliente
        MagicMock(data=[{"id": "novo-cliente-uuid"}]),     # insert
    )
    imovel_locacao = dict(IMOVEL_VENDA, tipo_negocio="locacao")
    with patch(SERVICE, db):
        cliente_id, criado = vincular_cliente_visitante(
            _payload(visitante_telefone="(21) 98888-7777", visitante_email="novo@exemplo.com"),
            imovel_locacao,
            CORRETOR_ID,
        )
    assert cliente_id == "novo-cliente-uuid"
    assert criado is True
    novo = db.insert.call_args[0][0]
    assert novo["origem_lead"] == "ficha_visita"
    assert novo["tipo_cliente"] == "locatario"  # imóvel de locação → locatário
    assert novo["status"] == "ativo"
    assert novo["corretor_id"] == CORRETOR_ID


def test_sem_telefone_nao_cadastra():
    """Cadastro de cliente exige telefone — sem ele, ficha segue sem vínculo."""
    db = make_db_mock(MagicMock(data=[]))
    with patch(SERVICE, db):
        cliente_id, criado = vincular_cliente_visitante(
            _payload(visitante_cpf="99988877766"), IMOVEL_VENDA, CORRETOR_ID
        )
    assert cliente_id is None
    assert criado is False
    db.insert.assert_not_called()


# ── _montar_preferencia: agregação das visitas ───────────────────────────────

def test_perfil_convergente_define_todos_os_campos():
    imoveis = [
        IMOVEL_VENDA,
        dict(IMOVEL_VENDA, id="i2", bairro="Leblon", valor_venda=3_000_000.0, dormitorios=2),
    ]
    pref = _montar_preferencia(imoveis)
    assert pref["tipo_negocio"] == "venda"
    assert pref["tipo_imovel"] == "apartamento"
    assert pref["cidade"] == "Rio de Janeiro"
    assert pref["bairros"] == ["Ipanema", "Leblon"]
    assert pref["valor_min"] == 2_000_000.0   # 80% do menor valor visitado
    assert pref["valor_max"] == 3_600_000.0   # 120% do maior valor visitado
    assert pref["dormitorios_min"] == 2       # o menor entre os visitados


def test_perfil_divergente_relaxa_filtros():
    """Visitas mistas (venda+locação, tipos diferentes) não devem gerar filtros
    errados: negócio vira 'ambos' e faixa de valor é omitida (misturar milhões
    de venda com milhares de locação produziria lixo)."""
    imoveis = [
        IMOVEL_VENDA,
        {
            "id": "i2", "tipo_negocio": "locacao", "tipo_imovel": "casa",
            "cidade": "Niterói", "bairro": "Icaraí",
            "valor_venda": None, "valor_locacao": 8_000.0, "dormitorios": None,
        },
    ]
    pref = _montar_preferencia(imoveis)
    assert pref["tipo_negocio"] == "ambos"
    assert pref["tipo_imovel"] is None
    assert pref["cidade"] is None
    assert pref["valor_min"] is None and pref["valor_max"] is None
    assert sorted(pref["bairros"]) == ["Icaraí", "Ipanema"]


def test_perfil_bairros_deduplicados_por_grafia():
    imoveis = [IMOVEL_VENDA, dict(IMOVEL_VENDA, id="i2", bairro="IPANEMA")]
    pref = _montar_preferencia(imoveis)
    assert pref["bairros"] == ["Ipanema"]


# ── inferir_preferencia ──────────────────────────────────────────────────────

def test_inferencia_nao_sobrescreve_preferencia_manual():
    db = make_db_mock(MagicMock(data={"id": "pref-1", "origem": "manual"}))
    with patch(SERVICE, db):
        inferir_preferencia(CLIENTE_ID)
    db.insert.assert_not_called()
    db.update.assert_not_called()


def test_inferencia_cria_preferencia_a_partir_das_fichas_assinadas():
    db = make_db_mock(
        MagicMock(data=None),                                  # sem preferência
        MagicMock(data=[{"imovel_id": IMOVEL_VENDA["id"]}]),   # fichas assinadas
        MagicMock(data=[IMOVEL_VENDA]),                        # imóveis visitados
        MagicMock(data=[{"id": "pref-1"}]),                    # insert
    )
    with patch(SERVICE, db):
        inferir_preferencia(CLIENTE_ID)
    pref = db.insert.call_args[0][0]
    assert pref["origem"] == "ficha_visita"
    assert pref["cliente_id"] == CLIENTE_ID
    assert pref["tipo_negocio"] == "venda"
    assert pref["ativa"] is True


def test_inferencia_recalcula_preferencia_inferida_existente():
    db = make_db_mock(
        MagicMock(data={"id": "pref-1", "origem": "ficha_visita"}),
        MagicMock(data=[{"imovel_id": IMOVEL_VENDA["id"]}]),
        MagicMock(data=[IMOVEL_VENDA]),
        MagicMock(data=[{"id": "pref-1"}]),                    # update
    )
    with patch(SERVICE, db):
        inferir_preferencia(CLIENTE_ID)
    db.insert.assert_not_called()
    pref = db.update.call_args[0][0]
    assert pref["origem"] == "ficha_visita"


def test_inferencia_sem_fichas_assinadas_nao_faz_nada():
    db = make_db_mock(
        MagicMock(data=None),   # sem preferência
        MagicMock(data=[]),     # nenhuma ficha assinada
    )
    with patch(SERVICE, db):
        inferir_preferencia(CLIENTE_ID)
    db.insert.assert_not_called()
    db.update.assert_not_called()


# ── atualizar_cadastro_pos_assinatura ────────────────────────────────────────

def test_pos_assinatura_sem_contato_nao_cadastra():
    """Ficha sem cliente vinculado e sem telefone: tenta deduplicar pelo CPF
    confirmado, mas sem match e sem telefone não há cadastro possível."""
    db = make_db_mock(
        MagicMock(data={"tipo_negocio": "venda"}),  # imóvel
        MagicMock(data=[]),                          # nenhum cliente na base
    )
    ficha = {
        "id": "f1", "cliente_id": None, "imovel_id": IMOVEL_VENDA["id"],
        "visitante_nome": "João da Silva", "visitante_telefone": None,
        "assinante_cpf_confirmado": "99988877766",
    }
    with patch(SERVICE, db):
        atualizar_cadastro_pos_assinatura(ficha)
    db.insert.assert_not_called()
    db.update.assert_not_called()


def test_pos_assinatura_cadastra_e_vincula_cliente_novo():
    """Ficha sem vínculo + telefone informado: cadastra o cliente na assinatura
    (com o CPF confirmado) e grava o cliente_id na ficha."""
    db = make_db_mock(
        MagicMock(data={"tipo_negocio": "locacao"}),            # imóvel
        MagicMock(data=[]),                                      # nenhum cliente
        MagicMock(data=[{"id": "cliente-novo-uuid"}]),           # insert cliente
        MagicMock(data=[{}]),                                    # update ficha.cliente_id
        MagicMock(data={"cpf_cnpj": "99988877766"}),             # CPF já preenchido
        MagicMock(data={"id": "pref-1", "origem": "manual"}),    # pref manual → para
    )
    ficha = {
        "id": "f1", "cliente_id": None, "imovel_id": IMOVEL_VENDA["id"],
        "visitante_nome": "João da Silva",
        "visitante_telefone": "(21) 98888-7777", "visitante_email": None,
        "visitante_cpf": None, "corretor_id": CORRETOR_ID,
        "assinante_cpf_confirmado": "999.888.777-66",
    }
    with patch(SERVICE, db):
        atualizar_cadastro_pos_assinatura(ficha)
    novo = db.insert.call_args[0][0]
    assert novo["origem_lead"] == "ficha_visita"
    assert novo["tipo_cliente"] == "locatario"
    assert novo["cpf_cnpj"] == "999.888.777-66"  # CPF confirmado na assinatura
    assert ficha["cliente_id"] == "cliente-novo-uuid"


def test_pos_assinatura_vincula_existente_pelo_cpf_confirmado():
    """O CPF confirmado na assinatura deduplica contra a base mesmo quando a
    ficha foi gerada sem CPF."""
    db = make_db_mock(
        MagicMock(data={"tipo_negocio": "venda"}),               # imóvel
        MagicMock(data=[CLIENTE_EXISTENTE]),                      # dedup por CPF
        MagicMock(data=[{}]),                                     # update ficha.cliente_id
        MagicMock(data={"cpf_cnpj": CLIENTE_EXISTENTE["cpf_cnpj"]}),  # CPF já preenchido
        MagicMock(data={"id": "pref-1", "origem": "manual"}),     # pref manual → para
    )
    ficha = {
        "id": "f1", "cliente_id": None, "imovel_id": IMOVEL_VENDA["id"],
        "visitante_nome": "João da Silva",
        "visitante_telefone": None, "visitante_email": None, "visitante_cpf": None,
        "corretor_id": CORRETOR_ID,
        "assinante_cpf_confirmado": "12345678900",
    }
    with patch(SERVICE, db):
        atualizar_cadastro_pos_assinatura(ficha)
    db.insert.assert_not_called()  # deduplicado — nenhum cadastro novo
    assert ficha["cliente_id"] == CLIENTE_ID


def test_pos_assinatura_completa_cpf_vazio_e_infere_perfil():
    db = make_db_mock(
        MagicMock(data={"cpf_cnpj": None}),                    # cliente sem CPF
        MagicMock(data=[{}]),                                  # update do CPF
        MagicMock(data={"id": "pref-1", "origem": "manual"}),  # pref manual → para
    )
    ficha = {"id": "f1", "cliente_id": CLIENTE_ID, "assinante_cpf_confirmado": "123.456.789-00"}
    with patch(SERVICE, db):
        atualizar_cadastro_pos_assinatura(ficha)
    assert db.update.call_args[0][0] == {"cpf_cnpj": "12345678900"}


def test_pos_assinatura_nao_sobrescreve_cpf_existente():
    db = make_db_mock(
        MagicMock(data={"cpf_cnpj": "111.222.333-44"}),        # já tem CPF
        MagicMock(data={"id": "pref-1", "origem": "manual"}),  # pref manual → para
    )
    ficha = {"id": "f1", "cliente_id": CLIENTE_ID, "assinante_cpf_confirmado": "999.888.777-66"}
    with patch(SERVICE, db):
        atualizar_cadastro_pos_assinatura(ficha)
    db.update.assert_not_called()
