"""Testes da montagem do dossiê do cliente
(GET /clientes/interno/{cliente_id}/dossie), consumido pelo CRM do WhatsApp.

A regra que interessa mora em `montar_dossie`: o que conta como documento
anexado e qual autorização vale quando o imóvel tem mais de uma.
"""
from app.routers.clientes import montar_dossie

CLIENTE = {"id": "cl-1", "codigo": "CL-00042", "nome_completo": "Carlos Eduardo Pinto"}


def test_dossie_vazio_nao_inventa_nada():
    dossie = montar_dossie(CLIENTE, [], [], [], [])
    assert dossie["cliente_id"] == "cl-1"
    assert dossie["codigo"] == "CL-00042"
    assert dossie["visitas"] == []
    assert dossie["imoveis_proprietario"] == []


def test_visitas_distinguem_assinada_de_pendente():
    fichas = [
        {
            "id": "f1", "imovel_codigo": "MB-00033", "imovel_endereco": "Rua A, 10",
            "imovel_bairro": "Centro", "status": "assinada",
            "assinada_em": "2026-07-01T10:00:00Z", "created_at": "2026-06-30T10:00:00Z",
        },
        {
            "id": "f2", "imovel_codigo": "MB-00099", "imovel_endereco": "Rua B, 20",
            "imovel_bairro": "Praia", "status": "emitida",
            "assinada_em": None, "created_at": "2026-07-10T10:00:00Z",
        },
    ]
    visitas = montar_dossie(CLIENTE, fichas, [], [], [])["visitas"]

    assert [v["imovel_codigo"] for v in visitas] == ["MB-00033", "MB-00099"]
    assert visitas[0]["assinada_em"] == "2026-07-01T10:00:00Z"
    assert visitas[1]["assinada_em"] is None


def test_documentos_ficam_no_imovel_a_que_pertencem():
    imoveis = [
        {"id": "im-1", "codigo": "MB-00042", "titulo": "Cobertura", "bairro": "Praia",
         "disponibilidade": "disponivel"},
        {"id": "im-2", "codigo": "MB-00043", "titulo": "Sala", "bairro": "Centro",
         "disponibilidade": "vendido"},
    ]
    documentos = [
        {"imovel_id": "im-1", "tipo": "matricula", "nome_arquivo": "matricula.pdf",
         "created_at": "2026-05-01T00:00:00Z"},
        {"imovel_id": "im-1", "tipo": "iptu", "nome_arquivo": "iptu.pdf",
         "created_at": "2026-05-02T00:00:00Z"},
    ]

    imoveis_out = montar_dossie(CLIENTE, [], imoveis, documentos, [])["imoveis_proprietario"]

    por_codigo = {i["codigo"]: i for i in imoveis_out}
    assert [d["tipo"] for d in por_codigo["MB-00042"]["documentos"]] == ["matricula", "iptu"]
    # O segundo imóvel não herda documento nenhum — "sem documento anexado" é
    # uma resposta, e precisa ser a resposta certa.
    assert por_codigo["MB-00043"]["documentos"] == []


def test_autorizacao_assinada_vence_a_emitida_mais_recente():
    imoveis = [{"id": "im-1", "codigo": "MB-00042", "titulo": None, "bairro": None,
                "disponibilidade": "disponivel"}]
    autorizacoes = [
        {"id": "a1", "imovel_id": "im-1", "tipo_negocio": "venda", "status": "assinada",
         "assinada_em": "2026-03-01T00:00:00Z", "created_at": "2026-02-01T00:00:00Z"},
        {"id": "a2", "imovel_id": "im-1", "tipo_negocio": "venda", "status": "emitida",
         "assinada_em": None, "created_at": "2026-08-01T00:00:00Z"},
    ]

    imovel = montar_dossie(CLIENTE, [], imoveis, [], autorizacoes)["imoveis_proprietario"][0]

    assert imovel["autorizacao"]["autorizacao_id"] == "a1"
    assert imovel["autorizacao"]["assinada_em"] == "2026-03-01T00:00:00Z"


def test_sem_assinatura_vale_a_ultima_emitida():
    imoveis = [{"id": "im-1", "codigo": "MB-00042", "titulo": None, "bairro": None,
                "disponibilidade": "disponivel"}]
    autorizacoes = [
        {"id": "a1", "imovel_id": "im-1", "tipo_negocio": "venda", "status": "cancelada",
         "assinada_em": None, "created_at": "2026-02-01T00:00:00Z"},
        {"id": "a2", "imovel_id": "im-1", "tipo_negocio": "locacao", "status": "emitida",
         "assinada_em": None, "created_at": "2026-08-01T00:00:00Z"},
    ]

    imovel = montar_dossie(CLIENTE, [], imoveis, [], autorizacoes)["imoveis_proprietario"][0]

    assert imovel["autorizacao"]["autorizacao_id"] == "a2"
    assert imovel["autorizacao"]["status"] == "emitida"


def test_imovel_sem_autorizacao_fica_explicitamente_nulo():
    imoveis = [{"id": "im-1", "codigo": "MB-00042", "titulo": None, "bairro": None,
                "disponibilidade": "disponivel"}]

    imovel = montar_dossie(CLIENTE, [], imoveis, [], [])["imoveis_proprietario"][0]

    assert imovel["autorizacao"] is None
