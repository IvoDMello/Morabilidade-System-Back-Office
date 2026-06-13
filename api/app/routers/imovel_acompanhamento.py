"""
Acompanhamento do imóvel: visitas, percepções internas e disparo do relatório
automático de 30 dias enviado ao proprietário.

Visitas e percepções persistem mesmo após o imóvel sair de "disponível" — só
somem se o imóvel for deletado (cascade na migration 020).
"""
import csv
import hmac
import io
import logging
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user, require_admin
from app.config import settings
from app.database import supabase_admin
from app.services.email import enviar_relatorio_30dias
from app.services.pdf_base import fmt_dt
from app.services.relatorio_30dias_pdf import gerar_relatorio_30dias_pdf

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class VisitaCreate(BaseModel):
    visitante_nome: str = Field(..., min_length=1, max_length=200)
    visitante_telefone: Optional[str] = Field(None, max_length=40)
    data_visita: date
    comentario: Optional[str] = Field(None, max_length=2000)


class VisitaOut(VisitaCreate):
    id: str
    imovel_id: str
    created_at: datetime
    created_by: Optional[str] = None


class PercepcaoCreate(BaseModel):
    texto: str = Field(..., min_length=1, max_length=5000)


class PercepcaoOut(PercepcaoCreate):
    id: str
    imovel_id: str
    created_at: datetime
    created_by: Optional[str] = None


# ── Visitas ──────────────────────────────────────────────────────────────────

@router.get("/{imovel_id}/visitas", response_model=List[VisitaOut])
def listar_visitas(imovel_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase_admin.table("imovel_visitas")
        .select("*")
        .eq("imovel_id", imovel_id)
        .order("data_visita", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/{imovel_id}/visitas", response_model=VisitaOut, status_code=status.HTTP_201_CREATED)
def criar_visita(
    imovel_id: str,
    body: VisitaCreate,
    current_user: dict = Depends(get_current_user),
):
    payload = {
        "imovel_id": imovel_id,
        "visitante_nome": body.visitante_nome.strip(),
        "visitante_telefone": (body.visitante_telefone or "").strip() or None,
        "data_visita": body.data_visita.isoformat(),
        "comentario": (body.comentario or "").strip() or None,
        "created_by": current_user["id"],
    }
    result = supabase_admin.table("imovel_visitas").insert(payload).execute()
    return result.data[0]


@router.delete("/{imovel_id}/visitas/{visita_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_visita(
    imovel_id: str,
    visita_id: str,
    current_user: dict = Depends(require_admin),
):
    supabase_admin.table("imovel_visitas").delete().eq("id", visita_id).eq("imovel_id", imovel_id).execute()


@router.post("/{imovel_id}/visitas/import-csv", response_model=List[VisitaOut])
def importar_visitas_csv(
    imovel_id: str,
    arquivo: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    CSV esperado (separador ',' ou ';', cabeçalho obrigatório):
        visitante_nome, visitante_telefone, data_visita, comentario

    - `data_visita` aceita formatos ISO (YYYY-MM-DD) ou BR (DD/MM/YYYY).
    - Linhas sem nome ou sem data válida são silenciosamente puladas.
    """
    try:
        raw = arquivo.file.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Arquivo deve estar em UTF-8.")

    # Detecta delimitador
    sample = raw[:2048]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","
    reader = csv.DictReader(io.StringIO(raw), delimiter=delimiter)

    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV vazio ou sem cabeçalho.")

    # Normaliza cabeçalho (case-insensitive, sem espaços extras)
    headers_norm = {(h or "").strip().lower(): h for h in reader.fieldnames}
    col_nome = headers_norm.get("visitante_nome") or headers_norm.get("nome")
    col_tel = headers_norm.get("visitante_telefone") or headers_norm.get("telefone")
    col_data = headers_norm.get("data_visita") or headers_norm.get("data")
    col_com = headers_norm.get("comentario") or headers_norm.get("observacao") or headers_norm.get("observacoes")

    if not col_nome or not col_data:
        raise HTTPException(
            status_code=400,
            detail="CSV precisa conter as colunas 'visitante_nome' e 'data_visita'.",
        )

    registros = []
    for row in reader:
        nome = (row.get(col_nome) or "").strip()
        data_raw = (row.get(col_data) or "").strip()
        if not nome or not data_raw:
            continue

        data_parsed = _parse_data(data_raw)
        if not data_parsed:
            continue

        registros.append({
            "imovel_id": imovel_id,
            "visitante_nome": nome,
            "visitante_telefone": ((row.get(col_tel) or "").strip() or None) if col_tel else None,
            "data_visita": data_parsed.isoformat(),
            "comentario": ((row.get(col_com) or "").strip() or None) if col_com else None,
            "created_by": current_user["id"],
        })

    if not registros:
        raise HTTPException(status_code=400, detail="Nenhuma linha válida encontrada no CSV.")

    result = supabase_admin.table("imovel_visitas").insert(registros).execute()
    return result.data or []


def _parse_data(s: str) -> Optional[date]:
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


# ── Percepções ───────────────────────────────────────────────────────────────

@router.get("/{imovel_id}/percepcoes", response_model=List[PercepcaoOut])
def listar_percepcoes(imovel_id: str, current_user: dict = Depends(require_admin)):
    result = (
        supabase_admin.table("imovel_percepcoes")
        .select("*")
        .eq("imovel_id", imovel_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/{imovel_id}/percepcoes", response_model=PercepcaoOut, status_code=status.HTTP_201_CREATED)
def criar_percepcao(
    imovel_id: str,
    body: PercepcaoCreate,
    current_user: dict = Depends(require_admin),
):
    payload = {
        "imovel_id": imovel_id,
        "texto": body.texto.strip(),
        "created_by": current_user["id"],
    }
    result = supabase_admin.table("imovel_percepcoes").insert(payload).execute()
    return result.data[0]


@router.delete("/{imovel_id}/percepcoes/{percepcao_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_percepcao(
    imovel_id: str,
    percepcao_id: str,
    current_user: dict = Depends(require_admin),
):
    (
        supabase_admin.table("imovel_percepcoes")
        .delete()
        .eq("id", percepcao_id)
        .eq("imovel_id", imovel_id)
        .execute()
    )


# ── Job: relatório automático de 30 dias ────────────────────────────────────

# Destinatário(s) do relatório. Por enquanto só Ivo — quando Rodrigo aprovar o
# formato, adicionar o e-mail dele aqui.
RELATORIO_30_DESTINATARIOS = ["ivompb2000@gmail.com"]


@router.post("/internal/jobs/relatorio-30dias", tags=["Jobs internos"])
def job_relatorio_30dias(
    x_cron_token: str = Header(..., alias="X-Cron-Token"),
):
    """
    Disparado por um cron externo (Railway Cron) 1×/dia.

    Varre imóveis disponíveis com 30+ dias de cadastro que ainda não receberam
    o relatório, envia o e-mail e marca `relatorio_30dias_enviado_em` para
    impedir reenvio.

    Autenticação: header `X-Cron-Token` deve bater com `settings.cron_token`.
    """
    if not settings.cron_token or not hmac.compare_digest(x_cron_token, settings.cron_token):
        raise HTTPException(status_code=403, detail="Token inválido.")
    return processar_relatorios_30dias()


def processar_relatorios_30dias() -> dict:
    """Núcleo do job: varre os candidatos e envia o relatório de cada um.

    Chamado tanto pelo endpoint HTTP (`job_relatorio_30dias`, p/ disparo manual
    ou cron externo) quanto pelo agendador interno (`app.scheduler`). Idempotente
    via `relatorio_30dias_enviado_em` — reexecutar não reenvia.
    """
    corte = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    # Janela [30, 30+N] dias: pega quem ACABOU de cruzar os 30 dias, não o
    # histórico antigo. limite_sup = pelo menos 30 dias; limite_inf = no máximo
    # 30+N dias.
    limite_sup = (corte - timedelta(days=30)).isoformat()
    limite_inf = (corte - timedelta(days=30 + settings.relatorio_30dias_janela_dias)).isoformat()

    candidatos = (
        supabase_admin.table("imoveis")
        .select("id, codigo, logradouro, numero, bairro, cidade, created_at, proprietario_id")
        .eq("disponibilidade", "disponivel")
        .lte("created_at", limite_sup)
        .gte("created_at", limite_inf)
        .is_("relatorio_30dias_enviado_em", "null")
        .execute()
        .data or []
    )

    enviados = 0
    erros: list[dict] = []

    for imovel in candidatos:
        try:
            _processar_relatorio(imovel)
            enviados += 1
        except Exception as e:  # noqa: BLE001
            logger.exception("Falha ao enviar relatório 30 dias do imóvel %s", imovel.get("codigo"))
            erros.append({"codigo": imovel.get("codigo"), "erro": str(e)})

    if candidatos:
        logger.info(
            "Relatório 30 dias: %d candidato(s), %d enviado(s), %d erro(s).",
            len(candidatos), enviados, len(erros),
        )
    return {"candidatos": len(candidatos), "enviados": enviados, "erros": erros}


@router.post("/{imovel_id}/relatorio-30dias/enviar")
def enviar_relatorio_manual(
    imovel_id: str,
    current_user: dict = Depends(require_admin),
):
    """Envia (ou reenvia) o relatório de 30 dias deste imóvel agora, sob demanda.

    Ignora a janela de idade do job automático — serve para testar o fluxo e
    para mandar uma atualização avulsa. Marca `relatorio_30dias_enviado_em`, então
    o job automático não reenviará depois.
    """
    res = (
        supabase_admin.table("imoveis")
        .select("id, codigo, logradouro, numero, bairro, cidade, created_at, proprietario_id")
        .eq("id", imovel_id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    _processar_relatorio(res.data)

    enviado = (
        supabase_admin.table("imoveis")
        .select("relatorio_30dias_enviado_em")
        .eq("id", imovel_id)
        .maybe_single()
        .execute()
    )
    return {
        "status": "enviado",
        "relatorio_30dias_enviado_em": (enviado.data or {}).get("relatorio_30dias_enviado_em"),
    }


def _processar_relatorio(imovel: dict) -> None:
    imovel_id = imovel["id"]
    codigo = imovel["codigo"]

    # Proprietário pelo FK do imóvel (migration 024). Nome e telefone vão no
    # relatório para facilitar o repasse manual (destino interno por enquanto).
    proprietario_nome = "Proprietário(a)"
    proprietario_telefone = None
    if imovel.get("proprietario_id"):
        prop_resp = (
            supabase_admin.table("clientes")
            .select("nome_completo, telefone")
            .eq("id", imovel["proprietario_id"])
            .maybe_single()
            .execute()
        )
        if prop_resp and prop_resp.data:
            proprietario_nome = prop_resp.data.get("nome_completo") or proprietario_nome
            proprietario_telefone = prop_resp.data.get("telefone")

    # Visitas comprovadas = fichas de visita ASSINADAS (substituem o cadastro
    # manual da aba de acompanhamento, agora aposentado).
    fichas = (
        supabase_admin.table("fichas_visita")
        .select("visitante_nome, assinada_em")
        .eq("imovel_id", imovel_id)
        .eq("status", "assinada")
        .order("assinada_em", desc=True)
        .execute()
        .data or []
    )
    visitas = [
        {"nome": f.get("visitante_nome"), "data": f.get("assinada_em")}
        for f in fichas
    ]

    percepcoes = (
        supabase_admin.table("imovel_percepcoes")
        .select("texto, created_at")
        .eq("imovel_id", imovel_id)
        .order("created_at", desc=True)
        .execute()
        .data or []
    )

    endereco = ", ".join(filter(None, [
        imovel.get("logradouro"),
        imovel.get("numero"),
        imovel.get("bairro"),
        imovel.get("cidade"),
    ]))

    anunciado_em = fmt_dt(imovel.get("created_at"))

    pdf_bytes = gerar_relatorio_30dias_pdf({
        "proprietario_nome": proprietario_nome,
        "proprietario_telefone": proprietario_telefone,
        "codigo": codigo,
        "endereco": endereco,
        "anunciado_em": anunciado_em,
        "visitas_comprovadas": len(visitas),
        "visitas": visitas,
        "percepcoes": percepcoes,
    })

    for destino in RELATORIO_30_DESTINATARIOS:
        enviar_relatorio_30dias(
            para=destino,
            proprietario_nome=proprietario_nome,
            proprietario_telefone=proprietario_telefone,
            codigo_imovel=codigo,
            endereco=endereco,
            anunciado_em=anunciado_em,
            visitas_comprovadas=len(visitas),
            pdf_bytes=pdf_bytes,
        )

    supabase_admin.table("imoveis").update(
        {"relatorio_30dias_enviado_em": datetime.now(timezone.utc).isoformat()}
    ).eq("id", imovel_id).execute()
