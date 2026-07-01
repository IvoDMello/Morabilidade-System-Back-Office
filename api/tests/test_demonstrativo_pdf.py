"""Testes da geração do demonstrativo PDF — service + endpoints.

Cobre Fase 3 do módulo de locações: cálculo do total seguindo a regra de
negócio do Artur Araripe, geração individual e em lote (ZIP).
"""
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch
import io
import zipfile

import pytest

from app.services.demonstrativo_pdf import (
    calcular_total_demonstrativo,
    gerar_demonstrativo_pdf,
)
from tests.conftest import make_db_mock
from tests.test_locacoes import CONTRATO_DB


# ── Service: cálculo do total ────────────────────────────────────────────────

def test_total_artur_araripe_exato():
    """Replica o exemplo de referência: Aluguel - Fundo Reserva = 8354.19.
    No caso real, o condomínio fica fora da cobrança (locatário paga direto)."""
    contrato = {
        "aluguel_mensal": "8500.00",
        "condominio_mensal": "2916.25",
        "incluir_condominio_cobranca": False,
        "fundo_reserva": "145.81",
        "fundo_obra": "0",
        "incluir_fundo_obra_cobranca": False,
        "iptu_anual": "0",
        "incluir_iptu_cobranca": False,
    }
    assert calcular_total_demonstrativo(contrato) == Decimal("8354.19")


def test_total_com_condominio_incluso():
    contrato = {
        "aluguel_mensal": "5000",
        "condominio_mensal": "800",
        "incluir_condominio_cobranca": True,
        "fundo_reserva": "0",
        "fundo_obra": "0",
        "incluir_fundo_obra_cobranca": False,
        "iptu_anual": "0",
        "incluir_iptu_cobranca": False,
    }
    assert calcular_total_demonstrativo(contrato) == Decimal("5800.00")


def test_total_com_iptu_dividido_em_dez():
    """IPTU anual de 3000 → 300/mês quando incluído."""
    contrato = {
        "aluguel_mensal": "4000",
        "condominio_mensal": "0",
        "incluir_condominio_cobranca": False,
        "fundo_reserva": "0",
        "fundo_obra": "0",
        "incluir_fundo_obra_cobranca": False,
        "iptu_anual": "3000",
        "incluir_iptu_cobranca": True,
    }
    assert calcular_total_demonstrativo(contrato) == Decimal("4300.00")


def test_total_com_fundo_obra_e_iptu():
    """Fundo de obra é despesa extraordinária do proprietário — deduz do total
    (mesmo tratamento do fundo de reserva)."""
    contrato = {
        "aluguel_mensal": "6000",
        "condominio_mensal": "0",
        "incluir_condominio_cobranca": False,
        "fundo_reserva": "100",
        "fundo_obra": "500",
        "incluir_fundo_obra_cobranca": True,
        "iptu_anual": "1200",
        "incluir_iptu_cobranca": True,
    }
    # 6000 - 500 (fundo obra) + 120 (IPTU 1/10) - 100 (fundo reserva) = 5520
    assert calcular_total_demonstrativo(contrato) == Decimal("5520.00")


def test_total_com_seguro_incendio_dividido_em_doze():
    """Seguro incêndio anual de 1200 → 100/mês quando incluído."""
    contrato = {
        "aluguel_mensal": "4000",
        "condominio_mensal": "0",
        "incluir_condominio_cobranca": False,
        "fundo_reserva": "0",
        "fundo_obra": "0",
        "incluir_fundo_obra_cobranca": False,
        "iptu_anual": "0",
        "incluir_iptu_cobranca": False,
        "seguro_incendio_anual": "1200",
        "incluir_seguro_incendio_cobranca": True,
    }
    assert calcular_total_demonstrativo(contrato) == Decimal("4100.00")


def test_total_seguro_nao_incluso_nao_soma():
    """Mesmo com seguro_incendio_anual setado, se a flag está False, não entra."""
    contrato = {
        "aluguel_mensal": "4000",
        "condominio_mensal": "0",
        "incluir_condominio_cobranca": False,
        "fundo_reserva": "0",
        "fundo_obra": "0",
        "incluir_fundo_obra_cobranca": False,
        "iptu_anual": "0",
        "incluir_iptu_cobranca": False,
        "seguro_incendio_anual": "1200",
        "incluir_seguro_incendio_cobranca": False,
    }
    assert calcular_total_demonstrativo(contrato) == Decimal("4000.00")


def test_total_aceita_none_e_decimal_misturados():
    contrato = {
        "aluguel_mensal": Decimal("5000"),
        "condominio_mensal": None,
        "incluir_condominio_cobranca": False,
        "fundo_reserva": None,
        "fundo_obra": None,
        "incluir_fundo_obra_cobranca": False,
        "iptu_anual": None,
        "incluir_iptu_cobranca": False,
    }
    assert calcular_total_demonstrativo(contrato) == Decimal("5000.00")


# ── Service: geração do PDF ──────────────────────────────────────────────────

def test_gerar_pdf_retorna_bytes_com_header_valido():
    contrato = {
        "aluguel_mensal": "5000",
        "condominio_mensal": "0",
        "incluir_condominio_cobranca": False,
        "fundo_reserva": "0",
        "fundo_obra": "0",
        "incluir_fundo_obra_cobranca": False,
        "iptu_anual": "0",
        "incluir_iptu_cobranca": False,
        "dia_vencimento": 5,
        "dados_cobranca_pix": "teste@email.com",
        "imovel": {"endereco": "Rua X, 10", "codigo": "MB-00001"},
    }
    pdf = gerar_demonstrativo_pdf(contrato, date(2026, 5, 1))
    assert isinstance(pdf, bytes)
    assert pdf.startswith(b"%PDF-")
    # PDF tem tamanho razoável (logo embutido)
    assert len(pdf) > 1000


def test_gerar_pdf_sem_pix_nem_observacoes_nao_quebra():
    """Layout deve sobreviver a contrato com campos opcionais vazios."""
    contrato = {
        "aluguel_mensal": "3000",
        "condominio_mensal": "0",
        "incluir_condominio_cobranca": False,
        "fundo_reserva": "0",
        "fundo_obra": "0",
        "incluir_fundo_obra_cobranca": False,
        "iptu_anual": "0",
        "incluir_iptu_cobranca": False,
        "dia_vencimento": 10,
        "dados_cobranca_pix": None,
        "observacoes_demonstrativo": None,
        "imovel": None,
    }
    pdf = gerar_demonstrativo_pdf(contrato, date(2026, 3, 1))
    assert pdf.startswith(b"%PDF-")


def test_gerar_pdf_vencimento_ajusta_para_ultimo_dia_quando_dia_excede_mes():
    """Contrato com dia_vencimento=31 em fevereiro → último dia do mês.
    Smoke test: não deve lançar exceção (gerar PDF com data inválida quebraria)."""
    contrato = {
        "aluguel_mensal": "1000",
        "condominio_mensal": "0",
        "incluir_condominio_cobranca": False,
        "fundo_reserva": "0",
        "fundo_obra": "0",
        "incluir_fundo_obra_cobranca": False,
        "iptu_anual": "0",
        "incluir_iptu_cobranca": False,
        "dia_vencimento": 31,
        "imovel": {"endereco": "Rua Y"},
    }
    pdf = gerar_demonstrativo_pdf(contrato, date(2026, 2, 1))
    assert pdf.startswith(b"%PDF-")


# ── Endpoint individual ─────────────────────────────────────────────────────

def test_demonstrativo_individual_retorna_pdf(client):
    """Snapshot inexistente → insere; depois retorna PDF.
    Sequência de executes: 1) _buscar_contrato (single) 2) select snapshot
    3) insert snapshot."""
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),  # _buscar_contrato
        MagicMock(data=[]),            # select snapshot (vazio)
        MagicMock(data=[{}]),          # insert snapshot
    )

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post(
            f"/locacoes/{CONTRATO_DB['id']}/demonstrativo?mes=2026-05",
        )

    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "Content-Disposition" in res.headers
    assert "demonstrativo_MB-00042_2026-05.pdf" in res.headers["Content-Disposition"]
    assert res.content.startswith(b"%PDF-")


def test_demonstrativo_individual_mes_invalido(client):
    res = client.post(f"/locacoes/{CONTRATO_DB['id']}/demonstrativo?mes=2026")
    assert res.status_code == 422


def test_demonstrativo_individual_mes_fora_do_range(client):
    res = client.post(f"/locacoes/{CONTRATO_DB['id']}/demonstrativo?mes=2026-13")
    assert res.status_code == 422


def test_demonstrativo_individual_contrato_inexistente(client):
    db = make_db_mock(MagicMock(data=None))  # _buscar_contrato falha

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post("/locacoes/nao-existe/demonstrativo?mes=2026-05")

    assert res.status_code == 404


def test_demonstrativo_individual_atualiza_snapshot_existente_se_pendente(client):
    """Snapshot pendente → backend faz update (e não bloqueia)."""
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),                                       # _buscar
        MagicMock(data=[{"id": "pag-1", "status": "pendente"}]),           # select snapshot
        MagicMock(data=[{}]),                                              # update snapshot
    )

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post(
            f"/locacoes/{CONTRATO_DB['id']}/demonstrativo?mes=2026-05"
        )

    assert res.status_code == 200
    # Update foi chamado (não insert) — mantém id do snapshot existente
    updates = db.update.call_args.args[0]
    assert "valor_devido" in updates
    assert "data_vencimento" in updates


def test_demonstrativo_individual_nao_sobrescreve_snapshot_pago(client):
    """Snapshot já pago → não atualiza valor_devido, mas ainda emite PDF.
    Regra de negócio: emitir 2ª via não pode alterar histórico financeiro."""
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),                                  # _buscar
        MagicMock(data=[{"id": "pag-1", "status": "pago"}]),          # select snapshot
        # Nenhum update/insert deve ser chamado neste path
    )

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post(
            f"/locacoes/{CONTRATO_DB['id']}/demonstrativo?mes=2026-05"
        )

    assert res.status_code == 200
    db.update.assert_not_called()
    db.insert.assert_not_called()


# ── Endpoint em lote ────────────────────────────────────────────────────────

def test_demonstrativos_em_lote_retorna_zip(client):
    """Dois contratos ativos → ZIP com 2 PDFs. Cada contrato consome:
    1 select snapshot + 1 insert. Mais 1 select inicial de contratos."""
    contrato2 = {**CONTRATO_DB, "id": "contrato-uuid-2",
                 "imovel": {**CONTRATO_DB["imovel"], "codigo": "MB-00099"}}
    db = make_db_mock(
        MagicMock(data=[CONTRATO_DB, contrato2]),  # listar contratos ativos
        MagicMock(data=[]), MagicMock(data=[{}]),  # snapshot 1: select + insert
        MagicMock(data=[]), MagicMock(data=[{}]),  # snapshot 2: select + insert
    )

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post("/locacoes/demonstrativos?mes=2026-05")

    assert res.status_code == 200
    assert res.headers["content-type"] == "application/zip"
    assert res.headers["x-gerados"] == "2"
    assert res.headers["x-erros"] == "0"

    # Confere conteúdo do ZIP
    zf = zipfile.ZipFile(io.BytesIO(res.content))
    nomes = zf.namelist()
    assert len(nomes) == 2
    assert all(n.endswith(".pdf") for n in nomes)
    # Cada PDF tem header válido
    for nome in nomes:
        assert zf.read(nome).startswith(b"%PDF-")


def test_demonstrativos_em_lote_sem_contratos_ativos(client):
    db = make_db_mock(MagicMock(data=[]))

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post("/locacoes/demonstrativos?mes=2026-05")

    assert res.status_code == 404


def test_demonstrativos_em_lote_mes_invalido(client):
    res = client.post("/locacoes/demonstrativos?mes=invalido")
    assert res.status_code == 422


def test_demonstrativos_em_lote_isola_falha_de_um_contrato(client):
    """Um contrato quebra a geração; os outros continuam.
    Erros vão para um arquivo _erros.txt dentro do ZIP."""
    # dia_vencimento None deixou de quebrar (vencimento_no_mes assume dia 5);
    # aluguel inválido continua estourando no cálculo do total.
    contrato_quebrado = {**CONTRATO_DB, "id": "contrato-uuid-2",
                         "aluguel_mensal": "não-é-número",
                         "imovel": {"codigo": "MB-RUIM"}}
    db = make_db_mock(
        MagicMock(data=[CONTRATO_DB, contrato_quebrado]),
        MagicMock(data=[]), MagicMock(data=[{}]),  # snapshot 1
        # snapshot 2 nem chega — falha antes
    )

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post("/locacoes/demonstrativos?mes=2026-05")

    assert res.status_code == 200
    assert res.headers["x-gerados"] == "1"
    assert res.headers["x-erros"] == "1"
    zf = zipfile.ZipFile(io.BytesIO(res.content))
    assert "_erros.txt" in zf.namelist()
