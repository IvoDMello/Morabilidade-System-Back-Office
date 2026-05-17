import io
import re
import zipfile
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.auth.dependencies import get_current_user, require_admin
from app.database import supabase_admin
from app.schemas.locacao import (
    ContratoLocacaoCreate,
    ContratoLocacaoListItem,
    ContratoLocacaoOut,
    ContratoLocacaoUpdate,
    PagamentoCreate,
    PagamentoOut,
    PagamentoUpdate,
    RescindirContrato,
    StatusLocacao,
    StatusPagamento,
)
from app.services.demonstrativo_pdf import (
    calcular_total_demonstrativo,
    gerar_demonstrativo_pdf,
)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

_SELECT_FULL = (
    "*,"
    "imovel:imoveis(id, codigo, endereco, bairro),"
    "proprietario:clientes!contratos_locacao_proprietario_id_fkey("
    "    id, nome_completo, email, telefone"
    "),"
    "locatario:clientes!contratos_locacao_locatario_id_fkey("
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
        out["imovel"] = {
            "id": imv.get("id"),
            "codigo": imv.get("codigo"),
            "endereco": ", ".join(p for p in [imv.get("endereco"), imv.get("bairro")] if p),
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
                " imovel:imoveis(id, codigo, endereco, bairro),"
                " proprietario:clientes!contratos_locacao_proprietario_id_fkey("
                "    id, nome_completo"
                " ),"
                " locatario:clientes!contratos_locacao_locatario_id_fkey("
                "    id, nome_completo"
                " )"
            )
        )
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    return [_achatar_partes(c) for c in (result.data or [])]


# IMPORTANTE: /analises precisa vir ANTES de /{contrato_id}, senão o roteador
# captura "analises" como UUID e retorna 422.

@router.get("/analises")
def analises_locacao(
    ano: Optional[int] = Query(default=None, ge=2000, le=2100),
    current_user: dict = Depends(get_current_user),
):
    """KPIs e séries para a aba Análises.
    Uma chamada só — evita N requests em paralelo do front."""
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
    supabase_admin.table("contratos_locacao").update(
        {"status": StatusLocacao.encerrado.value}
    ).eq("id", contrato_id).execute()


# ── Pagamentos ──────────────────────────────────────────────────────────────

@router.get("/{contrato_id}/pagamentos", response_model=List[PagamentoOut])
def listar_pagamentos(
    contrato_id: str,
    ano: Optional[int] = Query(default=None, ge=2000, le=2100),
    current_user: dict = Depends(get_current_user),
):
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
