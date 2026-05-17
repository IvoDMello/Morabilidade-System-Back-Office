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
    return [_achatar_partes(c) for c in (result.data or [])]


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

_MES_RE = re.compile(r"^(\d{4})-(\d{2})$")


def _parse_mes(mes_str: str) -> date:
    """Converte 'YYYY-MM' em date(YYYY, MM, 1). Levanta 422 se inválido."""
    m = _MES_RE.match(mes_str)
    if not m:
        raise HTTPException(
            status_code=422,
            detail="Parâmetro 'mes' deve estar no formato YYYY-MM (ex: 2026-05).",
        )
    ano, mes = int(m.group(1)), int(m.group(2))
    if not (1 <= mes <= 12):
        raise HTTPException(status_code=422, detail="Mês inválido.")
    return date(ano, mes, 1)


def _ultimo_dia_do_mes(d: date) -> int:
    if d.month == 12:
        prox = date(d.year + 1, 1, 1)
    else:
        prox = date(d.year, d.month + 1, 1)
    return (prox - timedelta(days=1)).day


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
    venc_dia = min(dia_vencimento, _ultimo_dia_do_mes(mes_ref))
    vencimento = date(mes_ref.year, mes_ref.month, venc_dia)

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
        taxa_pct = Decimal(str(c.get("taxa_administracao_pct") or 0))
        valor_taxa = (valor_pago * taxa_pct / Decimal("100")).quantize(Decimal("0.01"))
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
    venc_dia = min(contrato["dia_vencimento"], _ultimo_dia_do_mes(mes_ref))
    vencimento = date(mes_ref.year, mes_ref.month, venc_dia)

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


@router.post("/", response_model=ContratoLocacaoOut, status_code=status.HTTP_201_CREATED)
def criar_contrato(body: ContratoLocacaoCreate, current_user: dict = Depends(require_admin)):
    data = _serializar_para_banco(body.model_dump())
    try:
        result = supabase_admin.table("contratos_locacao").insert(data).execute()
    except Exception as e:
        # Conflitos comuns: FK inválida, partes iguais (passamos no validator,
        # mas a constraint do banco também protege).
        raise HTTPException(status_code=400, detail=f"Erro ao criar contrato: {e}")

    novo = result.data[0]
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

    result = (
        supabase_admin.table("contratos_locacao")
        .update(updates)
        .eq("id", contrato_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
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
    return result.data[0]


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

    result = (
        supabase_admin.table("locacao_pagamentos")
        .update(updates)
        .eq("id", pagamento_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")
    return result.data[0]


@router.delete("/pagamentos/{pagamento_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_pagamento(
    pagamento_id: str,
    current_user: dict = Depends(require_admin),
):
    supabase_admin.table("locacao_pagamentos").delete().eq("id", pagamento_id).execute()


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

    return result.data[0]


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

    return _hidratar_anexo(result.data[0])


@router.delete("/anexos/{anexo_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_anexo(anexo_id: str, current_user: dict = Depends(require_admin)):
    """Remove o arquivo do storage e o registro do banco. Idempotente:
    se o anexo não existir, retorna 204 sem alarde."""
    existente = (
        supabase_admin.table("locacao_anexos")
        .select("firebase_path")
        .eq("id", anexo_id)
        .execute()
        .data
        or []
    )
    if not existente:
        return
    deletar_documento(existente[0]["firebase_path"])
    supabase_admin.table("locacao_anexos").delete().eq("id", anexo_id).execute()
