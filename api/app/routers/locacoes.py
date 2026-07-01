import io
import logging
import re
import uuid
import zipfile
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status

from app.auth.dependencies import get_current_user, require_admin
from app.database import supabase_admin
from app.schemas.locacao import (
    AdmCobrancaItem,
    AdmCobrancaProprietario,
    AdmCobrancaResumo,
    AnexoOut,
    ContratoLocacaoCreate,
    ContratoLocacaoListItem,
    ContratoLocacaoOut,
    ContratoLocacaoUpdate,
    PagamentoCreate,
    PagamentoOut,
    PagamentoUpdate,
    ReajusteCreate,
    ReajusteOut,
    RepasseItem,
    RepasseProprietario,
    RepasseResumo,
    RescindirContrato,
    StatusLocacao,
    StatusPagamento,
    TipoAnexo,
)
from app.services.demonstrativo_pdf import (
    calcular_total_demonstrativo,
    gerar_demonstrativo_pdf,
)
from app.services.demonstrativo_admin_pdf import gerar_demonstrativo_admin_pdf
from app.services.configuracoes import get_dados_recebimento
from app.services.fechamento import (
    TAXA_ADM_PADRAO,
    calcular_taxa,
    parse_mes,
    taxa_efetiva,
    ultimo_dia_do_mes,
    vencimento_no_mes,
)
from app.services.audit_log import registrar_audit_locacao
from app.services.email import enviar_demonstrativo_locacao
from app.services.storage import (
    deletar_documento,
    upload_documento,
    url_publica_documento,
)


_MESES_LABEL = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]


def _formatar_brl(valor) -> str:
    """R$ 1.234,56 — padrão BR. Aceita Decimal/float/int."""
    v = float(valor)
    s = f"{v:,.2f}"
    return "R$ " + s.replace(",", "X").replace(".", ",").replace("X", ".")

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

_SELECT_FULL = (
    "*,"
    "imovel:imoveis(id, codigo, logradouro, numero, complemento, bairro),"
    # Sintaxe curta `!coluna` — não depende do nome gerado pela FK no banco,
    # que pode variar (contratos_locacao_proprietario_id_fkey vs custom).
    "proprietario:clientes!proprietario_id("
    "    id, nome_completo, email, telefone"
    "),"
    "locatario:clientes!locatario_id("
    "    id, nome_completo, email, telefone"
    ")"
)


def _achatar_partes(raw: dict) -> dict:
    """Transforma os joins do Supabase em ParteResumo enxuto.
    O Supabase retorna nested objects com nomes completos das tabelas; o front
    só precisa de id + um label legível. Retorna uma cópia — não muta o input."""
    out = dict(raw)

    imv = out.get("imovel")
    if imv:
        # A tabela imoveis usa logradouro/numero/complemento/bairro — não há
        # coluna endereco. Aceita endereco como fallback p/ compat com mocks
        # de teste antigos.
        endereco = imv.get("endereco") or imv.get("logradouro")
        partes = [p for p in [
            endereco,
            imv.get("numero"),
            imv.get("complemento"),
            imv.get("bairro"),
        ] if p]
        out["imovel"] = {
            "id": imv.get("id"),
            "codigo": imv.get("codigo"),
            "endereco": ", ".join(partes),
        }

    prop = out.get("proprietario")
    if prop:
        out["proprietario"] = {"id": prop.get("id"), "nome": prop.get("nome_completo")}

    loc = out.get("locatario")
    if loc:
        out["locatario"] = {"id": loc.get("id"), "nome": loc.get("nome_completo")}

    return out


def _buscar_contrato(contrato_id: str) -> dict:
    result = (
        supabase_admin.table("contratos_locacao")
        .select(_SELECT_FULL)
        .eq("id", contrato_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    return _achatar_partes(result.data)


def _serializar_para_banco(data: dict) -> dict:
    """Converte tipos Python (date, Decimal) para o formato que o cliente
    Supabase aceita (ISO string / float). Mantém None para deixar o banco
    aplicar default."""
    out: dict = {}
    for k, v in data.items():
        if v is None:
            out[k] = None
        elif isinstance(v, Decimal):
            out[k] = float(v)
        elif isinstance(v, date) and not isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


# ── CRUD de contratos ────────────────────────────────────────────────────────

@router.get("/", response_model=List[ContratoLocacaoListItem])
def listar_contratos(
    http_response: Response,
    status_filtro: Optional[StatusLocacao] = Query(default=None, alias="status"),
    imovel_id: Optional[str] = None,
    proprietario_id: Optional[str] = None,
    locatario_id: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    def _aplicar(q):
        if status_filtro:
            q = q.eq("status", status_filtro)
        if imovel_id:
            q = q.eq("imovel_id", imovel_id)
        if proprietario_id:
            q = q.eq("proprietario_id", proprietario_id)
        if locatario_id:
            q = q.eq("locatario_id", locatario_id)
        return q

    total = (
        _aplicar(supabase_admin.table("contratos_locacao").select("id", count="exact"))
        .execute()
        .count
        or 0
    )
    http_response.headers["X-Total-Count"] = str(total)

    offset = (page - 1) * page_size
    result = (
        _aplicar(
            supabase_admin.table("contratos_locacao").select(
                "id, status, data_inicio, data_fim, dia_vencimento, aluguel_mensal,"
                " created_at,"
                " imovel:imoveis(id, codigo, logradouro, numero, complemento, bairro),"
                " proprietario:clientes!proprietario_id(id, nome_completo),"
                " locatario:clientes!locatario_id(id, nome_completo)"
            )
        )
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    contratos = [_achatar_partes(c) for c in (result.data or [])]

    # Anexa o mês do último pagamento gerado (snapshot) — uma única query
    # extra para todos os contratos da página, com Python escolhendo o máximo
    # por contrato_id. Evita N queries e suporta page_size até 100.
    ids = [c["id"] for c in contratos]
    if ids:
        pags = (
            supabase_admin.table("locacao_pagamentos")
            .select("contrato_id, mes_referencia")
            .in_("contrato_id", ids)
            .order("mes_referencia", desc=True)
            .execute()
            .data
            or []
        )
        ultimo_por_contrato: dict[str, str] = {}
        for p in pags:
            cid = p.get("contrato_id")
            if cid and cid not in ultimo_por_contrato:
                ultimo_por_contrato[cid] = p.get("mes_referencia")
        for c in contratos:
            c["ultimo_mes_gerado"] = ultimo_por_contrato.get(c["id"])

    return contratos


def _marcar_atrasados(contrato_id: Optional[str] = None) -> None:
    """Marca como 'atrasado' todo pagamento pendente cuja data_vencimento
    já passou. Idempotente — pode ser chamado a cada request relevante.

    Sem cron: a operadora é pequena (~30 contratos), o overhead é
    desprezível e evita depender de scheduler externo.
    """
    q = (
        supabase_admin.table("locacao_pagamentos")
        .update({"status": "atrasado"})
        .eq("status", "pendente")
        .lt("data_vencimento", date.today().isoformat())
    )
    if contrato_id:
        q = q.eq("contrato_id", contrato_id)
    try:
        q.execute()
    except Exception:
        # Não queremos que falha de marcação derrube o endpoint chamador.
        # Pior caso: KPIs ficam um request desatualizados — mas logamos para
        # não mascarar bugs de banco silenciosamente.
        logger.exception("Falha ao marcar pagamentos atrasados (contrato_id=%s)", contrato_id)


# IMPORTANTE: /analises precisa vir ANTES de /{contrato_id}, senão o roteador
# captura "analises" como UUID e retorna 422.

@router.get("/analises")
def analises_locacao(
    ano: Optional[int] = Query(default=None, ge=2000, le=2100),
    current_user: dict = Depends(get_current_user),
):
    """KPIs e séries para a aba Análises.
    Uma chamada só — evita N requests em paralelo do front."""
    _marcar_atrasados()  # garante que KPI de inadimplência reflete o dia
    ano = ano or datetime.now(timezone.utc).year
    hoje = date.today()
    em_60_dias = hoje + timedelta(days=60)

    contratos = (
        supabase_admin.table("contratos_locacao")
        .select(
            "id, status, data_inicio, data_fim, aluguel_mensal,"
            " imovel:imoveis(bairro)"
        )
        .execute()
        .data
        or []
    )

    ativos = [c for c in contratos if c["status"] == "ativo"]
    em_encerramento = [
        c for c in ativos
        if c["data_fim"] and hoje.isoformat() <= c["data_fim"] <= em_60_dias.isoformat()
    ]
    rescindidos_ano = [
        c for c in contratos
        if c["status"] == "rescindido"
        and c.get("data_fim", "").startswith(str(ano))
    ]

    # Distribuição por bairro do imóvel (apenas contratos ativos).
    por_bairro: dict = defaultdict(int)
    for c in ativos:
        bairro = ((c.get("imovel") or {}).get("bairro") or "").strip()
        if bairro:
            por_bairro[bairro] += 1
    por_bairro_top = dict(sorted(por_bairro.items(), key=lambda x: x[1], reverse=True)[:10])

    # Pagamentos do ano para inadimplência e receita.
    pagamentos = (
        supabase_admin.table("locacao_pagamentos")
        .select("mes_referencia, valor_devido, valor_pago, status")
        .gte("mes_referencia", f"{ano}-01-01")
        .lte("mes_referencia", f"{ano}-12-31")
        .execute()
        .data
        or []
    )

    receita_prevista = {m: 0.0 for m in range(1, 13)}
    receita_realizada = {m: 0.0 for m in range(1, 13)}
    atrasados = 0
    valor_em_aberto = 0.0
    for p in pagamentos:
        mes = int(p["mes_referencia"][5:7])
        receita_prevista[mes] += float(p["valor_devido"] or 0)
        if p["status"] == "pago":
            receita_realizada[mes] += float(p["valor_pago"] or p["valor_devido"] or 0)
        elif p["status"] == "parcial":
            receita_realizada[mes] += float(p["valor_pago"] or 0)
            valor_em_aberto += float(p["valor_devido"] or 0) - float(p["valor_pago"] or 0)
        elif p["status"] == "atrasado":
            atrasados += 1
            valor_em_aberto += float(p["valor_devido"] or 0)
        elif p["status"] == "pendente":
            valor_em_aberto += float(p["valor_devido"] or 0)

    total_pagamentos = len(pagamentos)
    inadimplencia_pct = (atrasados / total_pagamentos * 100) if total_pagamentos else 0.0

    return {
        "kpis": {
            "contratos_ativos": len(ativos),
            "em_encerramento": len(em_encerramento),
            "rescindidos_no_ano": len(rescindidos_ano),
            "inadimplencia_pct": round(inadimplencia_pct, 1),
            "valor_em_aberto": round(valor_em_aberto, 2),
        },
        "ano": ano,
        "receita_prevista_por_mes": receita_prevista,
        "receita_realizada_por_mes": receita_realizada,
        "contratos_ativos_por_bairro": por_bairro_top,
    }


# ── Demonstrativos PDF ──────────────────────────────────────────────────────

def _parse_mes(mes_str: str) -> date:
    """Converte 'YYYY-MM' em date(YYYY, MM, 1). Levanta 422 se inválido."""
    try:
        return parse_mes(mes_str)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


def _upsert_snapshot_pagamento(
    contrato_id: str,
    mes_ref: date,
    valor_devido: Decimal,
    dia_vencimento: int,
) -> None:
    """Cria ou atualiza o snapshot do pagamento no momento da geração do PDF.

    Sem upsert nativo (Supabase requer onConflict explícito); usamos
    SELECT + INSERT/UPDATE manual — operação rara (mensal) e a unique
    constraint do banco garante consistência mesmo em condição de corrida.
    """
    vencimento = vencimento_no_mes(dia_vencimento, mes_ref)

    existente = (
        supabase_admin.table("locacao_pagamentos")
        .select("id, status")
        .eq("contrato_id", contrato_id)
        .eq("mes_referencia", mes_ref.isoformat())
        .execute()
        .data
        or []
    )

    if existente:
        # Não sobrescreve pagamentos já liquidados — apenas pendente/atrasado
        # recebem novo snapshot quando o usuário re-emite o demonstrativo.
        atual = existente[0]
        if atual.get("status") in ("pago", "parcial"):
            return
        supabase_admin.table("locacao_pagamentos").update({
            "valor_devido": float(valor_devido),
            "data_vencimento": vencimento.isoformat(),
        }).eq("id", atual["id"]).execute()
    else:
        supabase_admin.table("locacao_pagamentos").insert({
            "contrato_id": contrato_id,
            "mes_referencia": mes_ref.isoformat(),
            "valor_devido": float(valor_devido),
            "data_vencimento": vencimento.isoformat(),
            "status": "pendente",
        }).execute()


def _slug(s: str) -> str:
    """Normaliza string para usar em nome de arquivo (sem espaços/acentos)."""
    import unicodedata
    nfkd = unicodedata.normalize("NFKD", s or "")
    ascii_str = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", ascii_str).strip("_") or "contrato"


def _nome_arquivo_pdf(contrato: dict, mes_ref: date) -> str:
    codigo = (contrato.get("imovel") or {}).get("codigo") or "contrato"
    return f"demonstrativo_{_slug(codigo)}_{mes_ref.strftime('%Y-%m')}.pdf"


@router.post("/demonstrativos")
def gerar_demonstrativos_em_lote(
    mes: str = Query(..., description="Mês de competência no formato YYYY-MM"),
    current_user: dict = Depends(require_admin),
):
    """Gera um ZIP com o demonstrativo de TODOS os contratos ativos no mês.

    Útil para a operadora baixar o pacote do mês de uma vez em vez de gerar
    contrato a contrato. Pula contratos sem dados mínimos (aluguel).
    """
    mes_ref = _parse_mes(mes)

    contratos = (
        supabase_admin.table("contratos_locacao")
        .select(_SELECT_FULL)
        .eq("status", "ativo")
        .execute()
        .data
        or []
    )

    if not contratos:
        raise HTTPException(
            status_code=404,
            detail="Nenhum contrato ativo encontrado para gerar demonstrativos.",
        )

    buffer = io.BytesIO()
    gerados = 0
    erros: list[str] = []
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for raw in contratos:
            contrato = _achatar_partes(raw)
            try:
                total = calcular_total_demonstrativo(contrato)
                _upsert_snapshot_pagamento(
                    contrato["id"], mes_ref, total, contrato["dia_vencimento"],
                )
                pdf_bytes = gerar_demonstrativo_pdf(contrato, mes_ref)
                zf.writestr(_nome_arquivo_pdf(contrato, mes_ref), pdf_bytes)
                gerados += 1
            except Exception as e:
                erros.append(f"{(contrato.get('imovel') or {}).get('codigo', contrato['id'])}: {e}")

        if erros:
            zf.writestr("_erros.txt", "\n".join(erros))

    nome_zip = f"demonstrativos_{mes_ref.strftime('%Y-%m')}.zip"
    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{nome_zip}"',
            "Access-Control-Expose-Headers": "Content-Disposition, X-Gerados, X-Erros",
            "X-Gerados": str(gerados),
            "X-Erros": str(len(erros)),
        },
    )


@router.get("/repasses", response_model=RepasseResumo)
def relatorio_repasses(
    mes: str = Query(..., description="Mês de competência no formato YYYY-MM"),
    current_user: dict = Depends(get_current_user),
):
    """Relatório de repasse ao proprietário do mês informado.

    Considera pagamentos com status 'pago' ou 'parcial' cuja
    mes_referencia bate. Para cada um, aplica a taxa de administração
    do contrato e agrupa por proprietário.
    """
    mes_ref = _parse_mes(mes)

    pagamentos = (
        supabase_admin.table("locacao_pagamentos")
        .select("id, contrato_id, valor_devido, valor_pago, status")
        .eq("mes_referencia", mes_ref.isoformat())
        .in_("status", ["pago", "parcial"])
        .execute()
        .data
        or []
    )

    if not pagamentos:
        return RepasseResumo(
            mes=mes,
            proprietarios=[],
            total_recebido=Decimal("0"),
            total_taxa=Decimal("0"),
            total_repasse=Decimal("0"),
        )

    # Busca os contratos referenciados em uma query só.
    contrato_ids = list({p["contrato_id"] for p in pagamentos})
    contratos_raw = (
        supabase_admin.table("contratos_locacao")
        .select(
            "id, taxa_administracao_pct, proprietario_id,"
            " imovel:imoveis(codigo, logradouro, numero, complemento, bairro),"
            " proprietario:clientes!proprietario_id(id, nome_completo, email)"
        )
        .in_("id", contrato_ids)
        .execute()
        .data
        or []
    )
    contratos_map = {c["id"]: c for c in contratos_raw}

    # Agrega por proprietário.
    por_prop: dict[str, RepasseProprietario] = {}
    total_recebido = Decimal("0")
    total_taxa = Decimal("0")
    total_repasse = Decimal("0")

    for p in pagamentos:
        c = contratos_map.get(p["contrato_id"])
        if not c:
            continue
        valor_pago = Decimal(str(p["valor_pago"] or p["valor_devido"] or 0))
        # Repasse não aplica taxa padrão: contrato sem taxa repassa integral
        # (a cobrança da taxa, nesse caso, sai pelo Demonstrativo de Adm.).
        taxa_pct = taxa_efetiva(c.get("taxa_administracao_pct"), aplicar_padrao=False)
        valor_taxa = calcular_taxa(valor_pago, taxa_pct)
        valor_repasse = (valor_pago - valor_taxa).quantize(Decimal("0.01"))

        prop = c.get("proprietario") or {}
        prop_id = c["proprietario_id"]
        if prop_id not in por_prop:
            por_prop[prop_id] = RepasseProprietario(
                proprietario_id=prop_id,
                nome=prop.get("nome_completo") or "—",
                email=prop.get("email"),
                total_recebido=Decimal("0"),
                total_taxa=Decimal("0"),
                total_repasse=Decimal("0"),
                itens=[],
            )

        imv = c.get("imovel") or {}
        endereco_parts = [
            imv.get("endereco") or imv.get("logradouro"),
            imv.get("numero"),
            imv.get("complemento"),
            imv.get("bairro"),
        ]
        item = RepasseItem(
            contrato_id=c["id"],
            imovel_codigo=imv.get("codigo"),
            imovel_endereco=", ".join(p for p in endereco_parts if p) or None,
            pagamento_id=p["id"],
            valor_pago=valor_pago,
            taxa_administracao_pct=taxa_pct,
            valor_taxa=valor_taxa,
            valor_repasse=valor_repasse,
        )
        bloco = por_prop[prop_id]
        bloco.itens.append(item)
        bloco.total_recebido += valor_pago
        bloco.total_taxa += valor_taxa
        bloco.total_repasse += valor_repasse

        total_recebido += valor_pago
        total_taxa += valor_taxa
        total_repasse += valor_repasse

    # Quantiza os totais por proprietário (serialização JSON consistente).
    for bloco in por_prop.values():
        bloco.total_recebido = bloco.total_recebido.quantize(Decimal("0.01"))
        bloco.total_taxa = bloco.total_taxa.quantize(Decimal("0.01"))
        bloco.total_repasse = bloco.total_repasse.quantize(Decimal("0.01"))

    proprietarios = sorted(
        por_prop.values(), key=lambda r: r.nome.lower()
    )

    return RepasseResumo(
        mes=mes,
        proprietarios=proprietarios,
        total_recebido=total_recebido.quantize(Decimal("0.01")),
        total_taxa=total_taxa.quantize(Decimal("0.01")),
        total_repasse=total_repasse.quantize(Decimal("0.01")),
    )


# ── Demonstrativo de Administração (cobrança da taxa ao proprietário) ─────────

_SELECT_ADM = (
    "id, aluguel_mensal, taxa_administracao_pct, proprietario_id,"
    " imovel:imoveis(codigo, logradouro, numero, complemento, bairro),"
    " proprietario:clientes!proprietario_id(id, nome_completo, email),"
    " locatario:clientes!locatario_id(nome_completo)"
)


def _endereco_adm(imv: dict) -> str:
    """'Rua X, 182 — Ap. 701' a partir das colunas do imóvel."""
    base = imv.get("logradouro") or imv.get("endereco") or ""
    if imv.get("numero"):
        base = f"{base}, {imv['numero']}" if base else str(imv["numero"])
    if imv.get("complemento"):
        base = f"{base} — {imv['complemento']}" if base else str(imv["complemento"])
    return base or "—"


def _montar_adm_cobranca(
    mes_ref: date, proprietario_id: Optional[str] = None
) -> tuple[list[AdmCobrancaProprietario], Decimal, Decimal]:
    """Agrupa os contratos ATIVOS por proprietário, calculando a comissão
    (aluguel × taxa_administracao_pct) de cada imóvel. Opcionalmente filtra um
    único proprietário. O mês entra só como rótulo — a carteira é a vigente."""
    # Pagina em lotes: o Supabase limita a resposta a ~1000 linhas por padrão,
    # então sem paginar a carteira além disso sumiria silenciosamente.
    page_size = 1000
    offset = 0
    contratos: list[dict] = []
    while True:
        q = (
            supabase_admin.table("contratos_locacao")
            .select(_SELECT_ADM)
            .eq("status", "ativo")
        )
        if proprietario_id:
            q = q.eq("proprietario_id", proprietario_id)
        lote = q.range(offset, offset + page_size - 1).execute().data or []
        contratos.extend(lote)
        if len(lote) < page_size:
            break
        offset += page_size

    por_prop: dict[str, AdmCobrancaProprietario] = {}
    pcts_por_prop: dict[str, set] = defaultdict(set)
    total_aluguel = Decimal("0")
    total_comissao = Decimal("0")

    for ct in contratos:
        prop = ct.get("proprietario") or {}
        prop_id = ct["proprietario_id"]
        imv = ct.get("imovel") or {}
        loc = ct.get("locatario") or {}

        aluguel = Decimal(str(ct.get("aluguel_mensal") or 0))
        # Cobrança aplica TAXA_ADM_PADRAO quando o contrato não tem taxa —
        # a maioria dos contratos ainda não tem a taxa preenchida.
        taxa_pct = taxa_efetiva(ct.get("taxa_administracao_pct"), aplicar_padrao=True)
        comissao = calcular_taxa(aluguel, taxa_pct)

        if prop_id not in por_prop:
            por_prop[prop_id] = AdmCobrancaProprietario(
                proprietario_id=prop_id,
                nome=prop.get("nome_completo") or "—",
                email=prop.get("email"),
                qtd_imoveis=0,
                total_aluguel=Decimal("0"),
                total_comissao=Decimal("0"),
                pct_uniforme=None,
                itens=[],
            )

        bloco = por_prop[prop_id]
        bloco.itens.append(AdmCobrancaItem(
            contrato_id=ct["id"],
            imovel_codigo=imv.get("codigo"),
            imovel_endereco=_endereco_adm(imv),
            bairro=imv.get("bairro"),
            locatario_nome=loc.get("nome_completo"),
            aluguel=aluguel,
            taxa_administracao_pct=taxa_pct,
            comissao=comissao,
        ))
        bloco.qtd_imoveis += 1
        bloco.total_aluguel += aluguel
        bloco.total_comissao += comissao
        pcts_por_prop[prop_id].add(taxa_pct)

        total_aluguel += aluguel
        total_comissao += comissao

    for prop_id, bloco in por_prop.items():
        bloco.total_aluguel = bloco.total_aluguel.quantize(Decimal("0.01"))
        bloco.total_comissao = bloco.total_comissao.quantize(Decimal("0.01"))
        pcts = pcts_por_prop[prop_id]
        bloco.pct_uniforme = next(iter(pcts)) if len(pcts) == 1 else None
        # Ordena os itens por código do imóvel para o PDF sair estável.
        bloco.itens.sort(key=lambda i: (i.imovel_codigo or ""))

    proprietarios = sorted(por_prop.values(), key=lambda b: b.nome.lower())
    return (
        proprietarios,
        total_aluguel.quantize(Decimal("0.01")),
        total_comissao.quantize(Decimal("0.01")),
    )


@router.get("/adm-cobranca", response_model=AdmCobrancaResumo)
def relatorio_adm_cobranca(
    mes: str = Query(..., description="Mês de competência no formato YYYY-MM"),
    current_user: dict = Depends(get_current_user),
):
    """Carteira de administração por proprietário: aluguel cheio de cada
    contrato ativo e a comissão (taxa de administração) a cobrar. Base para
    listar os proprietários e gerar o Demonstrativo de Administração."""
    mes_ref = _parse_mes(mes)
    proprietarios, total_aluguel, total_comissao = _montar_adm_cobranca(mes_ref)
    return AdmCobrancaResumo(
        mes=mes,
        proprietarios=proprietarios,
        total_aluguel=total_aluguel,
        total_comissao=total_comissao,
    )


def _get_admin_snapshot(proprietario_id: str, mes_ref: date) -> Optional[dict]:
    """Snapshot congelado (bloco + dados de recebimento) daquela competência,
    ou None se ainda não foi gerado."""
    res = (
        supabase_admin.table("demonstrativo_admin_snapshots")
        .select("dados, dados_recebimento")
        .eq("proprietario_id", proprietario_id)
        .eq("mes_referencia", mes_ref.isoformat())
        .limit(1)
        .execute()
        .data
        or []
    )
    return res[0] if res else None


def _save_admin_snapshot(
    proprietario_id: str, mes_ref: date, dados: dict, dados_recebimento: dict
) -> None:
    """Congela (upsert) o demonstrativo daquela competência para que reemissões
    saiam idênticas. A unique (proprietario_id, mes_referencia) garante 1 por mês."""
    supabase_admin.table("demonstrativo_admin_snapshots").upsert(
        {
            "proprietario_id": proprietario_id,
            "mes_referencia": mes_ref.isoformat(),
            "dados": dados,
            "dados_recebimento": dados_recebimento,
        },
        on_conflict="proprietario_id,mes_referencia",
    ).execute()


@router.get("/proprietarios/{proprietario_id}/demonstrativo-administracao")
def gerar_demonstrativo_administracao(
    proprietario_id: str,
    mes: str = Query(..., description="Mês de competência no formato YYYY-MM"),
    regenerar: bool = Query(
        False,
        description="Refaz o snapshot a partir da carteira atual (sobrescreve a "
        "versão congelada da competência).",
    ),
    current_user: dict = Depends(require_admin),
):
    """Gera o PDF do Demonstrativo de Administração de um proprietário no mês.

    Congela na primeira geração: uma 2ª via da mesma competência sai idêntica à
    original, mesmo que a carteira tenha mudado desde então. Use `regenerar=true`
    para descartar o snapshot e refazê-lo a partir da carteira vigente."""
    mes_ref = _parse_mes(mes)

    snap = None if regenerar else _get_admin_snapshot(proprietario_id, mes_ref)
    if snap:
        bloco_dict = snap["dados"]
        dados_rec = snap.get("dados_recebimento") or {}
        nome = bloco_dict.get("nome") or "—"
    else:
        proprietarios, _, _ = _montar_adm_cobranca(mes_ref, proprietario_id)
        if not proprietarios:
            raise HTTPException(
                status_code=404,
                detail="Nenhum contrato ativo encontrado para este proprietário.",
            )
        bloco = proprietarios[0]
        # mode="json" torna os Decimais serializáveis para o jsonb do snapshot.
        bloco_dict = bloco.model_dump(mode="json")
        dados_rec = get_dados_recebimento().model_dump()
        nome = bloco.nome
        _save_admin_snapshot(proprietario_id, mes_ref, bloco_dict, dados_rec)

    pdf_bytes = gerar_demonstrativo_admin_pdf(bloco_dict, mes_ref, dados_rec)
    nome_arquivo = f"demonstrativo_administracao_{_slug(nome)}_{mes_ref.strftime('%Y-%m')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nome_arquivo}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/{contrato_id}/demonstrativo/enviar")
def enviar_demonstrativo(
    contrato_id: str,
    mes: str = Query(..., description="Mês de competência no formato YYYY-MM"),
    para: Optional[str] = Query(
        default=None,
        description="E-mail destinatário (default: e-mail cadastrado do locatário)",
    ),
    current_user: dict = Depends(require_admin),
):
    """Gera o PDF do demonstrativo do mês e envia por e-mail (Resend),
    anexando o PDF. Também atualiza o snapshot do pagamento (mesma regra
    de não sobrescrever pago/parcial).
    """
    mes_ref = _parse_mes(mes)
    contrato = _buscar_contrato(contrato_id)

    # Sempre busca os dados do locatário no banco: precisamos do nome_completo
    # de forma confiável (o join _SELECT_FULL pode vir vazio) e do email quando
    # 'para' não foi informado.
    cli = (
        supabase_admin.table("clientes")
        .select("email, nome_completo")
        .eq("id", contrato["locatario_id"])
        .single()
        .execute()
        .data
        or {}
    )
    nome_locatario = (
        cli.get("nome_completo")
        or (contrato.get("locatario") or {}).get("nome")
        or ""
    )
    if para:
        destinatario = para.strip()
    else:
        destinatario = (cli.get("email") or "").strip()

    if not destinatario or "@" not in destinatario:
        raise HTTPException(
            status_code=422,
            detail="Locatário sem e-mail cadastrado. Informe 'para' ou cadastre o e-mail.",
        )

    total = calcular_total_demonstrativo(contrato)
    _upsert_snapshot_pagamento(
        contrato_id, mes_ref, total, contrato["dia_vencimento"],
    )
    pdf_bytes = gerar_demonstrativo_pdf(contrato, mes_ref)
    vencimento = vencimento_no_mes(contrato["dia_vencimento"], mes_ref)

    endereco = (contrato.get("imovel") or {}).get("endereco") or ""
    nome_arquivo = _nome_arquivo_pdf(contrato, mes_ref)
    mes_label = f"{_MESES_LABEL[mes_ref.month - 1]}/{mes_ref.year}"

    try:
        enviar_demonstrativo_locacao(
            para=destinatario,
            nome_locatario=nome_locatario,
            mes_label=mes_label,
            endereco_imovel=endereco,
            total_brl=_formatar_brl(total),
            vencimento_brl=vencimento.strftime("%d/%m/%Y"),
            pdf_bytes=pdf_bytes,
            nome_arquivo=nome_arquivo,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao enviar e-mail: {e}")

    return {"enviado_para": destinatario, "mes": mes, "total": str(total)}


@router.post("/{contrato_id}/demonstrativo")
def gerar_demonstrativo_individual(
    contrato_id: str,
    mes: str = Query(..., description="Mês de competência no formato YYYY-MM"),
    current_user: dict = Depends(require_admin),
):
    """Gera o PDF do demonstrativo de UM contrato no mês informado.

    Efeito colateral: cria ou atualiza o snapshot em locacao_pagamentos
    (não sobrescreve pagamentos já marcados como pagos/parciais).
    """
    mes_ref = _parse_mes(mes)
    contrato = _buscar_contrato(contrato_id)

    total = calcular_total_demonstrativo(contrato)
    _upsert_snapshot_pagamento(
        contrato_id, mes_ref, total, contrato["dia_vencimento"],
    )

    pdf_bytes = gerar_demonstrativo_pdf(contrato, mes_ref)
    nome = _nome_arquivo_pdf(contrato, mes_ref)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nome}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


def _sincronizar_proprietario_imovel(imovel_id: str, proprietario_id: str) -> None:
    """Espelha o proprietário do contrato no cadastro do imóvel.

    Why: o form de locação aceita escolher (ou trocar) o proprietário; para
    manter as duas telas em sincronia (e o "vice-versa" pedido pelo cliente),
    o imóvel é sempre atualizado para refletir o proprietário mais recente.
    """
    try:
        (
            supabase_admin.table("imoveis")
            .update({"proprietario_id": proprietario_id})
            .eq("id", imovel_id)
            .execute()
        )
    except Exception:
        # Não derruba o request principal: a sincronização é "best effort".
        # O contrato em si já foi gravado com o proprietário correto.
        logger.exception(
            "Falha ao sincronizar proprietario_id do imovel (%s ← %s)",
            imovel_id, proprietario_id,
        )


@router.post("/", response_model=ContratoLocacaoOut, status_code=status.HTTP_201_CREATED)
def criar_contrato(body: ContratoLocacaoCreate, current_user: dict = Depends(require_admin)):
    existente = (
        supabase_admin.table("contratos_locacao")
        .select("id")
        .eq("imovel_id", body.imovel_id)
        .eq("status", "ativo")
        .limit(1)
        .execute()
    )
    if existente.data:
        raise HTTPException(
            status_code=409,
            detail="Este imóvel já possui um contrato ativo. Encerre ou rescinda o contrato atual antes de criar outro.",
        )

    data = _serializar_para_banco(body.model_dump())
    try:
        result = supabase_admin.table("contratos_locacao").insert(data).execute()
    except Exception as e:
        # Conflitos comuns: FK inválida, partes iguais (passamos no validator,
        # mas a constraint do banco também protege).
        raise HTTPException(status_code=400, detail=f"Erro ao criar contrato: {e}")

    novo = result.data[0]
    _sincronizar_proprietario_imovel(body.imovel_id, body.proprietario_id)
    registrar_audit_locacao(
        user=current_user,
        acao="insert",
        entidade="contrato",
        entidade_id=novo["id"],
        contrato_id=novo["id"],
        payload_depois=novo,
    )
    return _buscar_contrato(novo["id"])


@router.get("/{contrato_id}", response_model=ContratoLocacaoOut)
def obter_contrato(contrato_id: str, current_user: dict = Depends(get_current_user)):
    return _buscar_contrato(contrato_id)


@router.patch("/{contrato_id}", response_model=ContratoLocacaoOut)
def atualizar_contrato(
    contrato_id: str,
    body: ContratoLocacaoUpdate,
    current_user: dict = Depends(require_admin),
):
    updates = _serializar_para_banco(body.model_dump(exclude_unset=True))
    if not updates:
        return _buscar_contrato(contrato_id)

    antes = (
        supabase_admin.table("contratos_locacao")
        .select("*")
        .eq("id", contrato_id)
        .maybe_single()
        .execute()
        .data
    )
    result = (
        supabase_admin.table("contratos_locacao")
        .update(updates)
        .eq("id", contrato_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    registrar_audit_locacao(
        user=current_user,
        acao="update",
        entidade="contrato",
        entidade_id=contrato_id,
        contrato_id=contrato_id,
        payload_antes=antes,
        payload_depois=updates,
    )
    return _buscar_contrato(contrato_id)


@router.post("/{contrato_id}/rescindir", response_model=ContratoLocacaoOut)
def rescindir_contrato(
    contrato_id: str,
    body: RescindirContrato,
    current_user: dict = Depends(require_admin),
):
    updates = _serializar_para_banco(
        {
            "status": StatusLocacao.rescindido.value,
            "motivo_rescisao": body.motivo_rescisao,
            "data_rescisao": body.data_rescisao,
        }
    )
    result = (
        supabase_admin.table("contratos_locacao")
        .update(updates)
        .eq("id", contrato_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    registrar_audit_locacao(
        user=current_user,
        acao="update",
        entidade="contrato",
        entidade_id=contrato_id,
        contrato_id=contrato_id,
        payload_depois={"rescisao": updates},
    )
    return _buscar_contrato(contrato_id)


@router.delete("/{contrato_id}", status_code=status.HTTP_204_NO_CONTENT)
def encerrar_contrato(contrato_id: str, current_user: dict = Depends(require_admin)):
    """Soft-delete: marca como 'encerrado' em vez de apagar — preserva
    histórico de pagamentos e anexos para auditoria."""
    result = (
        supabase_admin.table("contratos_locacao")
        .update({"status": StatusLocacao.encerrado.value})
        .eq("id", contrato_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    registrar_audit_locacao(
        user=current_user,
        acao="delete",
        entidade="contrato",
        entidade_id=contrato_id,
        contrato_id=contrato_id,
        payload_antes={"status_anterior": "ativo"},
    )


# ── Pagamentos ──────────────────────────────────────────────────────────────

@router.get("/{contrato_id}/pagamentos", response_model=List[PagamentoOut])
def listar_pagamentos(
    contrato_id: str,
    ano: Optional[int] = Query(default=None, ge=2000, le=2100),
    current_user: dict = Depends(get_current_user),
):
    _marcar_atrasados(contrato_id)
    q = (
        supabase_admin.table("locacao_pagamentos")
        .select("*")
        .eq("contrato_id", contrato_id)
    )
    if ano:
        q = q.gte("mes_referencia", f"{ano}-01-01").lte("mes_referencia", f"{ano}-12-31")
    result = q.order("mes_referencia", desc=True).execute()
    return result.data or []


@router.post(
    "/{contrato_id}/pagamentos",
    response_model=PagamentoOut,
    status_code=status.HTTP_201_CREATED,
)
def criar_pagamento(
    contrato_id: str,
    body: PagamentoCreate,
    current_user: dict = Depends(require_admin),
):
    # Garante que o contrato existe (404 explícito em vez de FK error).
    _buscar_contrato(contrato_id)

    data = _serializar_para_banco({**body.model_dump(), "contrato_id": contrato_id})
    try:
        result = supabase_admin.table("locacao_pagamentos").insert(data).execute()
    except Exception as e:
        err = str(e).lower()
        if "duplicate" in err or "unique" in err:
            raise HTTPException(
                status_code=409,
                detail="Já existe pagamento registrado para este mês.",
            )
        raise HTTPException(status_code=400, detail=f"Erro ao criar pagamento: {e}")
    novo = result.data[0]
    registrar_audit_locacao(
        user=current_user,
        acao="insert",
        entidade="pagamento",
        entidade_id=novo["id"],
        contrato_id=contrato_id,
        payload_depois=novo,
    )
    return novo


@router.patch("/pagamentos/{pagamento_id}", response_model=PagamentoOut)
def atualizar_pagamento(
    pagamento_id: str,
    body: PagamentoUpdate,
    current_user: dict = Depends(require_admin),
):
    updates = _serializar_para_banco(body.model_dump(exclude_unset=True))

    # Se marcou como pago e não enviou data_pagamento, usa hoje (UX comum:
    # operadora clica "Pago" e espera que a data seja preenchida).
    if updates.get("status") == StatusPagamento.pago.value and "data_pagamento" not in updates:
        updates["data_pagamento"] = date.today().isoformat()

    if not updates:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")

    antes = (
        supabase_admin.table("locacao_pagamentos")
        .select("*")
        .eq("id", pagamento_id)
        .maybe_single()
        .execute()
        .data
    )
    result = (
        supabase_admin.table("locacao_pagamentos")
        .update(updates)
        .eq("id", pagamento_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")
    depois = result.data[0] if isinstance(result.data, list) else result.data
    registrar_audit_locacao(
        user=current_user,
        acao="update",
        entidade="pagamento",
        entidade_id=pagamento_id,
        contrato_id=(antes or {}).get("contrato_id"),
        payload_antes=antes,
        payload_depois=updates,
    )
    return depois


@router.delete("/pagamentos/{pagamento_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_pagamento(
    pagamento_id: str,
    current_user: dict = Depends(require_admin),
):
    antes = (
        supabase_admin.table("locacao_pagamentos")
        .select("*")
        .eq("id", pagamento_id)
        .maybe_single()
        .execute()
        .data
    )
    supabase_admin.table("locacao_pagamentos").delete().eq("id", pagamento_id).execute()
    if antes:
        registrar_audit_locacao(
            user=current_user,
            acao="delete",
            entidade="pagamento",
            entidade_id=pagamento_id,
            contrato_id=antes.get("contrato_id"),
            payload_antes=antes,
        )


# ── Reajustes (Fase 5) ──────────────────────────────────────────────────────

@router.get("/{contrato_id}/reajustes", response_model=List[ReajusteOut])
def listar_reajustes(contrato_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase_admin.table("locacao_reajustes")
        .select("*")
        .eq("contrato_id", contrato_id)
        .order("data_aplicacao", desc=True)
        .execute()
    )
    return result.data or []


@router.post(
    "/{contrato_id}/reajustar",
    response_model=ReajusteOut,
    status_code=status.HTTP_201_CREATED,
)
def aplicar_reajuste(
    contrato_id: str,
    body: ReajusteCreate,
    current_user: dict = Depends(require_admin),
):
    """Aplica um reajuste: registra o histórico e atualiza o aluguel
    do contrato. Não recalcula pagamentos já gerados/pagos — só afeta
    geração futura (snapshots passados ficam intactos)."""
    contrato = _buscar_contrato(contrato_id)
    anterior = Decimal(str(contrato["aluguel_mensal"]))
    pct = Decimal(str(body.percentual))
    novo = (anterior * (Decimal("1") + pct / Decimal("100"))).quantize(Decimal("0.01"))
    if novo <= 0:
        raise HTTPException(
            status_code=422,
            detail="Reajuste resultaria em aluguel zero ou negativo — revise o percentual.",
        )

    registro = _serializar_para_banco({
        "contrato_id": contrato_id,
        "data_aplicacao": body.data_aplicacao,
        "percentual": pct,
        "aluguel_anterior": anterior,
        "aluguel_novo": novo,
        "indice_referencia": body.indice_referencia,
        "observacoes": body.observacoes,
        "applied_by": current_user["id"],
    })
    try:
        result = supabase_admin.table("locacao_reajustes").insert(registro).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao registrar reajuste: {e}")

    # Atualiza o aluguel do contrato — geração futura usa o valor novo.
    supabase_admin.table("contratos_locacao").update(
        {"aluguel_mensal": float(novo)}
    ).eq("id", contrato_id).execute()

    reajuste = result.data[0]
    registrar_audit_locacao(
        user=current_user,
        acao="insert",
        entidade="reajuste",
        entidade_id=reajuste["id"],
        contrato_id=contrato_id,
        payload_antes={"aluguel_mensal": float(anterior)},
        payload_depois={**reajuste, "aluguel_mensal_novo": float(novo)},
    )
    return reajuste


# ── Anexos do contrato ──────────────────────────────────────────────────────

def _hidratar_anexo(raw: dict) -> dict:
    """Adiciona url pública ao registro do banco antes de devolver."""
    return {**raw, "url": url_publica_documento(raw["firebase_path"])}


@router.get("/{contrato_id}/anexos", response_model=List[AnexoOut])
def listar_anexos(contrato_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase_admin.table("locacao_anexos")
        .select("*")
        .eq("contrato_id", contrato_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [_hidratar_anexo(a) for a in (result.data or [])]


@router.post(
    "/{contrato_id}/anexos",
    response_model=AnexoOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_anexo(
    contrato_id: str,
    file: UploadFile = File(...),
    tipo: TipoAnexo = Form(default=TipoAnexo.contrato),
    current_user: dict = Depends(require_admin),
):
    """Faz upload de um documento ao Supabase Storage e registra em
    locacao_anexos. Path inclui UUID para evitar colisão de nomes."""
    _buscar_contrato(contrato_id)  # 404 explícito se contrato não existir

    nome_original = file.filename or "documento"
    # Path: locacoes/{contrato_id}/{uuid}-{nome-sanitizado}
    nome_seguro = re.sub(r"[^a-zA-Z0-9._-]+", "_", nome_original)[:80] or "documento"
    storage_path = f"locacoes/{contrato_id}/{uuid.uuid4().hex[:12]}-{nome_seguro}"

    info = await upload_documento(file, storage_path)

    registro = {
        "contrato_id": contrato_id,
        "tipo": tipo.value,
        "nome_arquivo": nome_original,
        "firebase_path": info["firebase_path"],
        "mime_type": info["mime_type"],
        "tamanho_bytes": info["tamanho_bytes"],
        "uploaded_by": current_user["id"],
    }
    try:
        result = supabase_admin.table("locacao_anexos").insert(registro).execute()
    except Exception as e:
        # Reverte o upload se o INSERT falhou — evita órfão no storage.
        deletar_documento(storage_path)
        raise HTTPException(status_code=500, detail=f"Erro ao registrar anexo: {e}")

    novo = result.data[0]
    registrar_audit_locacao(
        user=current_user,
        acao="insert",
        entidade="anexo",
        entidade_id=novo["id"],
        contrato_id=contrato_id,
        payload_depois=novo,
    )
    return _hidratar_anexo(novo)


@router.delete("/anexos/{anexo_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_anexo(anexo_id: str, current_user: dict = Depends(require_admin)):
    """Remove o arquivo do storage e o registro do banco. Idempotente:
    se o anexo não existir, retorna 204 sem alarde."""
    existente = (
        supabase_admin.table("locacao_anexos")
        .select("*")
        .eq("id", anexo_id)
        .execute()
        .data
        or []
    )
    if not existente:
        return
    antes = existente[0]
    deletar_documento(antes["firebase_path"])
    supabase_admin.table("locacao_anexos").delete().eq("id", anexo_id).execute()
    registrar_audit_locacao(
        user=current_user,
        acao="delete",
        entidade="anexo",
        entidade_id=anexo_id,
        contrato_id=antes.get("contrato_id"),
        payload_antes=antes,
    )
