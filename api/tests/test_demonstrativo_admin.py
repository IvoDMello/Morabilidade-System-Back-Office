"""Testes do Demonstrativo de Administração (cobrança da taxa ao proprietário).

Cobre a lógica de agrupamento por proprietário (_montar_adm_cobranca), a taxa
única de 8% (campo do contrato é ignorado), a exclusão de contratos já retidos
no Repasse do mês (anti duplo débito), a geração do PDF (incluindo carteira
grande que exige quebra de página) e os endpoints REST.

Sequência de executes em _montar_adm_cobranca: 1) pagamentos pagos/parciais da
competência 2) contratos ativos.
"""
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.routers.locacoes import _montar_adm_cobranca, TAXA_ADM_PADRAO
from app.services.demonstrativo_admin_pdf import gerar_demonstrativo_admin_pdf
from tests.conftest import make_db_mock


# ── Helpers ──────────────────────────────────────────────────────────────────

def _contrato(prop_id, nome, *, aluguel="1000", taxa="10", codigo="MB-1",
              email="dono@x.com", bairro="Centro"):
    return {
        "id": f"ct-{codigo}",
        "aluguel_mensal": aluguel,
        "taxa_administracao_pct": taxa,
        "proprietario_id": prop_id,
        "imovel": {"codigo": codigo, "logradouro": "Rua X", "numero": "10",
                   "complemento": "Ap 1", "bairro": bairro},
        "proprietario": {"id": prop_id, "nome_completo": nome, "email": email},
        "locatario": {"nome_completo": "Locatário Y"},
    }


# ── _montar_adm_cobranca ─────────────────────────────────────────────────────

def test_agrupa_por_proprietario_e_calcula_comissao():
    contratos = [
        _contrato("p1", "Ana", aluguel="1000", taxa="10", codigo="MB-2"),
        _contrato("p1", "Ana", aluguel="2000", taxa="10", codigo="MB-1"),
        _contrato("p2", "Bruno", aluguel="3000", taxa="5", codigo="MB-3"),
    ]
    db = make_db_mock(MagicMock(data=[]), MagicMock(data=contratos))
    with patch("app.routers.locacoes.supabase_admin", db):
        props, tot_aluguel, tot_comissao = _montar_adm_cobranca(date(2026, 5, 1))

    assert [p.nome for p in props] == ["Ana", "Bruno"]  # ordenado por nome
    ana = props[0]
    assert ana.qtd_imoveis == 2
    assert ana.total_aluguel == Decimal("3000.00")
    # Taxa única de 8%, o campo do contrato (10%) é ignorado.
    assert ana.total_comissao == Decimal("240.00")
    assert ana.pct_uniforme == Decimal("8")
    # Itens ordenados por código do imóvel (estabilidade do PDF)
    assert [i.imovel_codigo for i in ana.itens] == ["MB-1", "MB-2"]

    assert tot_aluguel == Decimal("6000.00")
    assert tot_comissao == Decimal("480.00")  # 240 (Ana) + 240 (Bruno)


def test_taxa_unica_8pct_mesmo_sem_taxa_no_contrato():
    contratos = [
        _contrato("p1", "Ana", aluguel="1000", taxa="0", codigo="MB-1"),
        _contrato("p1", "Ana", aluguel="1000", taxa=None, codigo="MB-2"),
    ]
    db = make_db_mock(MagicMock(data=[]), MagicMock(data=contratos))
    with patch("app.routers.locacoes.supabase_admin", db):
        props, _, tot_comissao = _montar_adm_cobranca(date(2026, 5, 1))

    assert TAXA_ADM_PADRAO == Decimal("8")
    assert tot_comissao == Decimal("160.00")  # 80 + 80
    assert props[0].pct_uniforme == Decimal("8")


def test_taxas_divergentes_no_contrato_sao_ignoradas():
    # Campo do contrato (10% / 5%) não importa: 8% fixo em todos.
    contratos = [
        _contrato("p1", "Ana", taxa="10", codigo="MB-1"),
        _contrato("p1", "Ana", taxa="5", codigo="MB-2"),
    ]
    db = make_db_mock(MagicMock(data=[]), MagicMock(data=contratos))
    with patch("app.routers.locacoes.supabase_admin", db):
        props, _, _ = _montar_adm_cobranca(date(2026, 5, 1))

    assert props[0].pct_uniforme == Decimal("8")
    assert all(i.taxa_administracao_pct == Decimal("8") for i in props[0].itens)


def test_exclui_contrato_ja_retido_no_repasse_do_mes():
    """Anti duplo débito: aluguel que passou pela imobiliária (pagamento
    pago/parcial no mês) já teve os 8% retidos no Repasse, sai da cobrança."""
    contratos = [
        _contrato("p1", "Ana", aluguel="1000", codigo="MB-1"),
        _contrato("p1", "Ana", aluguel="2000", codigo="MB-2"),
    ]
    pagos = [{"contrato_id": "ct-MB-1"}]  # MB-1 recebido via imobiliária
    db = make_db_mock(MagicMock(data=pagos), MagicMock(data=contratos))
    with patch("app.routers.locacoes.supabase_admin", db):
        props, tot_aluguel, tot_comissao = _montar_adm_cobranca(date(2026, 5, 1))

    assert props[0].qtd_imoveis == 1
    assert [i.imovel_codigo for i in props[0].itens] == ["MB-2"]
    assert tot_aluguel == Decimal("2000.00")
    assert tot_comissao == Decimal("160.00")  # 8% só do MB-2


def test_filtra_por_proprietario():
    contratos = [_contrato("p1", "Ana", codigo="MB-1")]
    db = make_db_mock(MagicMock(data=[]), MagicMock(data=contratos))
    with patch("app.routers.locacoes.supabase_admin", db):
        props, _, _ = _montar_adm_cobranca(date(2026, 5, 1), proprietario_id="p1")

    # Confirma que o filtro .eq foi aplicado com o proprietário
    assert db.eq.call_args_list[-1].args == ("proprietario_id", "p1")
    assert len(props) == 1


def test_sem_contratos_retorna_vazio():
    db = make_db_mock(MagicMock(data=[]), MagicMock(data=[]))
    with patch("app.routers.locacoes.supabase_admin", db):
        props, tot_a, tot_c = _montar_adm_cobranca(date(2026, 5, 1))
    assert props == []
    assert tot_a == Decimal("0.00")
    assert tot_c == Decimal("0.00")


# ── PDF ──────────────────────────────────────────────────────────────────────

_DADOS_REC = {"titular": "Rodrigo", "banco": "Bradesco", "agencia": "1745",
              "conta": "144445-0", "pix": "(21) 99274-3950"}


def _bloco(n_itens, pct_uniforme=Decimal("8")):
    itens = [{
        "contrato_id": f"ct-{i}", "imovel_codigo": f"MB-{i:03d}",
        "imovel_endereco": f"Rua Muito Longa das Flores, {i}: Ap. 701",
        "bairro": "Ipanema", "locatario_nome": f"Locatário {i}",
        "aluguel": Decimal("1000"), "taxa_administracao_pct": Decimal("8"),
        "comissao": Decimal("80"),
    } for i in range(n_itens)]
    return {
        "nome": "Ana Maria", "email": "ana@x.com", "qtd_imoveis": n_itens,
        "total_aluguel": Decimal(1000 * n_itens), "total_comissao": Decimal(80 * n_itens),
        "pct_uniforme": pct_uniforme, "itens": itens,
    }


def test_pdf_retorna_bytes_validos():
    pdf = gerar_demonstrativo_admin_pdf(_bloco(3), date(2026, 5, 1), _DADOS_REC)
    assert isinstance(pdf, bytes)
    assert pdf.startswith(b"%PDF-")
    assert len(pdf) > 1000


def test_pdf_carteira_grande_gera_multiplas_paginas():
    """25 imóveis não cabem em uma página, deve quebrar sem estourar o rodapé."""
    pdf = gerar_demonstrativo_admin_pdf(_bloco(25), date(2026, 5, 1), _DADOS_REC)
    assert pdf.startswith(b"%PDF-")
    # ReportLab emite um objeto "/Page" por página; carteira grande → 2+ páginas.
    assert pdf.count(b"/Type /Page\n") + pdf.count(b"/Type /Page ") >= 2


def test_pdf_sem_pct_uniforme_e_campos_opcionais_vazios():
    bloco = _bloco(1, pct_uniforme=None)
    bloco["itens"][0].update(imovel_codigo=None, bairro=None, locatario_nome=None)
    pdf = gerar_demonstrativo_admin_pdf(bloco, date(2026, 3, 1), {})
    assert pdf.startswith(b"%PDF-")


# ── Endpoints ────────────────────────────────────────────────────────────────

def test_endpoint_adm_cobranca_retorna_resumo(client):
    contratos = [_contrato("p1", "Ana", aluguel="1000", taxa="10", codigo="MB-1")]
    db = make_db_mock(MagicMock(data=[]), MagicMock(data=contratos))
    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get("/locacoes/adm-cobranca?mes=2026-05")

    assert res.status_code == 200
    body = res.json()
    assert body["mes"] == "2026-05"
    assert len(body["proprietarios"]) == 1
    assert body["total_comissao"] == "80.00"  # 8% fixo, ignora os 10% do contrato


def test_endpoint_adm_cobranca_mes_invalido(client):
    res = client.get("/locacoes/adm-cobranca?mes=2026")
    assert res.status_code == 422


def test_endpoint_demonstrativo_administracao_congela_snapshot(client):
    """Snapshot inexistente → monta a carteira, salva o snapshot e emite o PDF.
    Sequência: 1) snapshot (miss) 2) pagamentos retidos 3) carteira 4) upsert."""
    contratos = [_contrato("p1", "Ana", codigo="MB-1")]
    db = make_db_mock(
        MagicMock(data=[]),         # _get_admin_snapshot → miss
        MagicMock(data=[]),         # pagamentos retidos no repasse
        MagicMock(data=contratos),  # _montar_adm_cobranca
        MagicMock(data=[{}]),       # _save_admin_snapshot (upsert)
    )
    from app.schemas.configuracao import DadosRecebimento
    with patch("app.routers.locacoes.supabase_admin", db), \
         patch("app.routers.locacoes.get_dados_recebimento",
               return_value=DadosRecebimento(**_DADOS_REC)):
        res = client.get("/locacoes/proprietarios/p1/demonstrativo-administracao?mes=2026-05")

    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "attachment" in res.headers["Content-Disposition"]
    assert res.content.startswith(b"%PDF-")
    db.upsert.assert_called_once()  # snapshot foi congelado


def test_endpoint_demonstrativo_administracao_reusa_snapshot(client):
    """Snapshot existente → 2ª via idêntica sem recalcular a carteira nem
    regravar o snapshot."""
    snap = {"dados": _bloco(1), "dados_recebimento": _DADOS_REC}
    # _bloco usa Decimals; o snapshot real é jsonb (strings), mas o PDF aceita ambos.
    db = make_db_mock(MagicMock(data=[snap]))
    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get("/locacoes/proprietarios/p1/demonstrativo-administracao?mes=2026-05")

    assert res.status_code == 200
    assert res.content.startswith(b"%PDF-")
    db.upsert.assert_not_called()  # não regrava
    db.insert.assert_not_called()


def test_endpoint_demonstrativo_administracao_regenerar_ignora_snapshot(client):
    """regenerar=true refaz da carteira mesmo havendo snapshot e regrava."""
    contratos = [_contrato("p1", "Ana", codigo="MB-1")]
    db = make_db_mock(
        MagicMock(data=[]),         # pagamentos retidos (snapshot não é consultado)
        MagicMock(data=contratos),  # _montar_adm_cobranca
        MagicMock(data=[{}]),       # upsert
    )
    from app.schemas.configuracao import DadosRecebimento
    with patch("app.routers.locacoes.supabase_admin", db), \
         patch("app.routers.locacoes.get_dados_recebimento",
               return_value=DadosRecebimento(**_DADOS_REC)):
        res = client.get(
            "/locacoes/proprietarios/p1/demonstrativo-administracao?mes=2026-05&regenerar=true"
        )

    assert res.status_code == 200
    assert res.content.startswith(b"%PDF-")
    db.upsert.assert_called_once()


def test_endpoint_demonstrativo_administracao_sem_contratos_404(client):
    db = make_db_mock(
        MagicMock(data=[]),  # snapshot miss
        MagicMock(data=[]),  # pagamentos retidos
        MagicMock(data=[]),  # carteira vazia
    )
    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get("/locacoes/proprietarios/p1/demonstrativo-administracao?mes=2026-05")
    assert res.status_code == 404
