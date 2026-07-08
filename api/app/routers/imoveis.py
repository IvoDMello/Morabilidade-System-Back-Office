import csv
import io
import re
import unicodedata
import uuid
from datetime import date
from enum import Enum
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from pydantic import BaseModel

from app.auth.dependencies import get_current_user, require_admin, require_admin_or_internal
from app.database import supabase_admin
from app.limiter import limiter
from app.schemas.imovel import (
    CondicaoImovel, Disponibilidade, DocumentoImovelOut, ImovelCreate, ImovelListOut,
    ImovelOut, ImovelUpdate, Mobiliado, TipoDocumentoImovel, TipoImovel, TipoNegocio,
)
from app.services.revalidacao import revalidar_imovel
from app.services.storage import (
    baixar_e_rotacionar, deletar_documento, deletar_foto, upload_bytes_jpeg,
    upload_documento, upload_foto, url_publica_documento,
)


_CAMPOS_EXPORT = [
    "codigo", "titulo", "tipo_negocio", "disponibilidade", "tipo_imovel", "condicao",
    "cidade", "bairro", "logradouro", "numero", "complemento", "cep",
    "dormitorios", "suites", "banheiros", "vagas_garagem", "andar", "mobiliado",
    "ano_construcao", "area_total", "area_util", "valor_venda", "valor_locacao",
    "iptu_mensal", "condominio_mensal", "instagram_url", "descricao", "created_at",
]

# Caracteres que o Excel/LibreOffice interpretam como início de fórmula. Se um
# valor começar com qualquer um deles, prefixamos com apóstrofo (CSV Injection).
_CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _csv_safe(valor) -> str:
    if valor is None:
        return ""
    s = str(valor)
    if s and s[0] in _CSV_FORMULA_PREFIXES:
        return "'" + s
    return s


def _ev(v):
    """Extrai o valor string de um enum, ou retorna o valor original."""
    return v.value if isinstance(v, Enum) else v


def _norm(s: str) -> str:
    """Lowercase sem acentos — espelha o que as colunas _norm armazenam no banco."""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


def _safe_for_or(s: str) -> str:
    """Remove vírgulas/parênteses que quebrariam a sintaxe do PostgREST .or_()."""
    return s.replace(",", " ").replace("(", " ").replace(")", " ").strip()

router = APIRouter()

_LIST_FIELDS = (
    "id, codigo, titulo, tipo_negocio, disponibilidade, cidade, bairro, "
    "logradouro, numero, tipo_imovel, dormitorios, suites, banheiros, "
    "vagas_garagem, area_util, valor_venda, valor_locacao, valor_sob_consulta, "
    "condominio_mensal, iptu_mensal, destaque_ordem, proprietario_id, instagram_url, created_at, "
    "imovel_fotos(url, ordem), imovel_tags(tags(id, nome, cor)), "
    "proprietario:clientes!proprietario_id(id, nome_completo, telefone, email)"
)

_DETAIL_FIELDS = (
    "*, imovel_fotos(id, url, ordem), imovel_tags(tags(id, nome, cor)), "
    "proprietario:clientes!proprietario_id(id, nome_completo, telefone, email)"
)


def _gerar_codigo() -> str:
    result = supabase_admin.rpc("proxima_sequencia_imovel").execute()
    return f"MB-{result.data:05d}"


def _aplicar_filtros(query, *, tipo_negocio, disponibilidade, cidade, bairro,
                     tipo_imovel, dormitorios_min, preco_min, preco_max,
                     condicao, mobiliado, codigo, andar_max=None, q=None):
    if q:
        termo = _safe_for_or(q)
        if termo:
            termo_norm = _norm(termo)
            query = query.or_(
                f"codigo.ilike.%{termo}%,"
                f"logradouro.ilike.%{termo}%,"
                f"bairro_norm.ilike.%{termo_norm}%"
            )
    if codigo:
        query = query.ilike("codigo", f"%{codigo}%")
    if tipo_negocio:
        query = query.eq("tipo_negocio", _ev(tipo_negocio))
    if disponibilidade:
        query = query.eq("disponibilidade", _ev(disponibilidade))
    if cidade:
        query = query.ilike("cidade_norm", f"%{_norm(cidade)}%")
    if bairro:
        # Aceita str (legacy do back-office) ou list[str] (multi-bairro do site).
        bairros = [bairro] if isinstance(bairro, str) else [b for b in bairro if b]
        if len(bairros) == 1:
            query = query.ilike("bairro_norm", f"%{_norm(bairros[0])}%")
        elif len(bairros) > 1:
            clauses = ",".join(
                f"bairro_norm.ilike.%{_norm(_safe_for_or(b))}%" for b in bairros
            )
            query = query.or_(clauses)
    if tipo_imovel:
        query = query.eq("tipo_imovel", _ev(tipo_imovel))
    if dormitorios_min is not None:
        query = query.gte("dormitorios", dormitorios_min)
    if andar_max is not None:
        query = query.lte("andar", andar_max)
    if condicao:
        query = query.eq("condicao", _ev(condicao))
    if mobiliado:
        query = query.eq("mobiliado", _ev(mobiliado))
    if preco_min is not None:
        if _ev(tipo_negocio) == TipoNegocio.locacao.value:
            query = query.gte("valor_locacao", preco_min)
        else:
            query = query.gte("valor_venda", preco_min)
    if preco_max is not None:
        if _ev(tipo_negocio) == TipoNegocio.locacao.value:
            query = query.lte("valor_locacao", preco_max)
        else:
            query = query.lte("valor_venda", preco_max)
    return query


def _normalizar_proprietario(raw: dict) -> Optional[dict]:
    """Extrai o objeto proprietário do join e devolve só os campos que o front
    usa — evita vazar dados desnecessários e mantém a forma estável."""
    prop = raw.pop("proprietario", None)
    if not prop:
        return None
    return {
        "id": prop.get("id"),
        "nome_completo": prop.get("nome_completo"),
        "telefone": prop.get("telefone"),
        "email": prop.get("email"),
    }


def _transformar_lista(raw: dict) -> dict:
    fotos = sorted(raw.pop("imovel_fotos", None) or [], key=lambda f: f.get("ordem", 0))
    foto_capa = fotos[0]["url"] if fotos else None
    tags_raw = raw.pop("imovel_tags", None) or []
    tags = [t["tags"] for t in tags_raw if t.get("tags")]
    proprietario = _normalizar_proprietario(raw)
    return {**raw, "foto_capa": foto_capa, "tags": tags, "proprietario": proprietario}


def _transformar_detalhe(raw: dict) -> dict:
    fotos = sorted(raw.pop("imovel_fotos", None) or [], key=lambda f: f.get("ordem", 0))
    tags_raw = raw.pop("imovel_tags", None) or []
    tags = [t["tags"] for t in tags_raw if t.get("tags")]
    tag_ids = [t["id"] for t in tags]
    proprietario = _normalizar_proprietario(raw)
    return {**raw, "fotos": fotos, "tags": tags, "tag_ids": tag_ids, "proprietario": proprietario}


def _ocultar_internas(imovel: dict, current_user: Optional[dict]) -> dict:
    """Remove campos internos/documentação se o acesso for público (sem usuário autenticado).

    Inclui os dados do proprietário (nome/telefone/e-mail): são PII de terceiros
    e não podem trafegar nos endpoints públicos consumidos pelo site (LGPD).
    """
    if not current_user:
        for campo in ("observacoes_internas", "inscricao_municipal", "rgi",
                      "numero_matricula", "proprietario", "proprietario_id"):
            imovel.pop(campo, None)
        # "Sob consulta": os valores reais nunca trafegam no público; o site
        # usa a flag valor_sob_consulta para exibir "Sob consulta" no lugar.
        if imovel.get("valor_sob_consulta"):
            imovel["valor_venda"] = None
            imovel["valor_locacao"] = None
    return imovel


MAX_DESTAQUES = 10


def _liberar_posicao_destaque(posicao: int, exceto_imovel_id: Optional[str] = None) -> None:
    """
    Garante que `posicao` (1-10) fica vaga empurrando o bloco contíguo de
    destaques a partir dela uma casa para a direita (1→2, 2→3, ...).
    Quem estiver na posição 10 sai do destaque. Idempotente.

    Os updates são feitos linha a linha, da maior posição para a menor,
    para nunca violar o índice UNIQUE parcial de destaque_ordem.
    Custo máximo: ~10 updates de 1 linha — só no momento de salvar.
    """
    if posicao is None:
        return
    if posicao < 1 or posicao > MAX_DESTAQUES:
        raise HTTPException(
            status_code=400,
            detail=f"Posição de destaque deve ser entre 1 e {MAX_DESTAQUES}.",
        )

    q = (
        supabase_admin.table("imoveis")
        .select("id, destaque_ordem")
        .not_.is_("destaque_ordem", "null")
    )
    if exceto_imovel_id:
        q = q.neq("id", exceto_imovel_id)
    ocupadas = {r["destaque_ordem"]: r["id"] for r in (q.execute().data or [])}

    if posicao not in ocupadas:
        return

    # Fim do bloco contíguo que precisa andar (para no primeiro buraco).
    fim = posicao
    while fim + 1 in ocupadas:
        fim += 1

    for p in range(fim, posicao - 1, -1):
        novo = p + 1 if p < MAX_DESTAQUES else None
        (
            supabase_admin.table("imoveis")
            .update({"destaque_ordem": novo})
            .eq("id", ocupadas[p])
            .execute()
        )


def _buscar_imovel(imovel_id: str) -> dict:
    result = (
        supabase_admin.table("imoveis")
        .select(_DETAIL_FIELDS)
        .eq("id", imovel_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")
    return _transformar_detalhe(result.data)


# ── Endpoints públicos (devem vir ANTES de /{imovel_id}) ─────────────────────

@router.get("/publico/bairros", tags=["Site Público"])
@limiter.limit("60/minute")
def bairros_disponiveis_publico(request: Request):
    """Bairros únicos dos imóveis disponíveis — usado para autocomplete no site."""
    result = (
        supabase_admin.table("imoveis")
        .select("bairro")
        .eq("disponibilidade", "disponivel")
        .not_.is_("bairro", "null")
        .execute()
    )
    bairros = sorted({row["bairro"] for row in (result.data or []) if row.get("bairro")})
    return bairros


@router.get("/publico/disponiveis", response_model=List[ImovelListOut], tags=["Site Público"])
@limiter.limit("60/minute")
def imoveis_disponiveis_publico(
    request: Request,
    http_response: Response,
    tipo_negocio: Optional[TipoNegocio] = None,
    cidade: Optional[str] = None,
    bairro: Optional[List[str]] = Query(default=None, description="Aceita múltiplos: ?bairro=X&bairro=Y"),
    q: Optional[str] = Query(default=None, description="Busca livre por código ou bairro"),
    codigo: Optional[str] = Query(default=None, description="Filtra por código exato/contém"),
    tipo_imovel: Optional[TipoImovel] = None,
    dormitorios_min: Optional[int] = None,
    andar_max: Optional[int] = Query(default=None, ge=0, description="Filtro 'apenas térreo': andar_max=1"),
    preco_min: Optional[float] = None,
    preco_max: Optional[float] = None,
    condicao: Optional[CondicaoImovel] = None,
    mobiliado: Optional[Mobiliado] = None,
    ordenar: Optional[str] = Query(default=None, description="preco_asc | preco_desc | area_asc | area_desc | mais_antigo | mais_novo"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    filtros = dict(
        tipo_negocio=tipo_negocio, disponibilidade=Disponibilidade.disponivel,
        cidade=cidade, bairro=bairro, tipo_imovel=tipo_imovel,
        dormitorios_min=dormitorios_min, andar_max=andar_max,
        preco_min=preco_min, preco_max=preco_max,
        condicao=condicao, mobiliado=mobiliado, codigo=codigo, q=q,
    )
    count_q = _aplicar_filtros(
        supabase_admin.table("imoveis").select("id", count="exact"), **filtros
    )
    total = count_q.execute().count or 0
    http_response.headers["X-Total-Count"] = str(total)
    http_response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    offset = (page - 1) * page_size
    query = _aplicar_filtros(
        supabase_admin.table("imoveis").select(_LIST_FIELDS), **filtros
    )

    campo_preco = "valor_locacao" if _ev(tipo_negocio) == TipoNegocio.locacao.value else "valor_venda"
    if ordenar == "preco_asc":
        query = query.order(campo_preco, desc=False, nullsfirst=False)
    elif ordenar == "preco_desc":
        query = query.order(campo_preco, desc=True, nullsfirst=False)
    elif ordenar == "area_desc":
        query = query.order("area_util", desc=True, nullsfirst=False)
    elif ordenar == "area_asc":
        query = query.order("area_util", desc=False, nullsfirst=False)
    elif ordenar == "mais_antigo":
        query = query.order("created_at", desc=False)
    else:
        query = query.order("created_at", desc=True)

    result = query.range(offset, offset + page_size - 1).execute()
    return [_ocultar_internas(_transformar_lista(item), None) for item in result.data]


@router.get("/publico/destaques", response_model=List[ImovelListOut], tags=["Site Público"])
@limiter.limit("60/minute")
def imoveis_destaques_publico(request: Request):
    """
    Imóveis selecionados pelo admin para o carrossel da home.
    Ordenados por destaque_ordem (1-10). Inclui apenas disponíveis.
    """
    result = (
        supabase_admin.table("imoveis")
        .select(_LIST_FIELDS)
        .not_.is_("destaque_ordem", "null")
        .eq("disponibilidade", "disponivel")
        .order("destaque_ordem", desc=False)
        .execute()
    )
    return [_ocultar_internas(_transformar_lista(item), None) for item in (result.data or [])]


@router.get("/destaques/ocupacao")
def destaques_ocupacao(current_user: dict = Depends(get_current_user)):
    """
    Mapa das posições de destaque ocupadas — usado no formulário do painel
    para mostrar qual imóvel ocupa cada posição hoje.
    Retorna [{ordem, codigo, id}] ordenado por posição.
    """
    result = (
        supabase_admin.table("imoveis")
        .select("id, codigo, destaque_ordem")
        .not_.is_("destaque_ordem", "null")
        .order("destaque_ordem", desc=False)
        .execute()
    )
    return [
        {"ordem": r["destaque_ordem"], "codigo": r["codigo"], "id": r["id"]}
        for r in (result.data or [])
    ]


@router.get("/publico/{codigo}", response_model=ImovelOut, tags=["Site Público"])
@limiter.limit("60/minute")
def detalhe_imovel_publico(request: Request, codigo: str):
    result = (
        supabase_admin.table("imoveis")
        .select("id")
        .eq("codigo", codigo)
        .eq("disponibilidade", "disponivel")
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")
    return _ocultar_internas(_buscar_imovel(result.data["id"]), None)


# ── Endpoints autenticados ────────────────────────────────────────────────────

# IMPORTANTE: /exportar precisa vir ANTES de /{imovel_id},
# senão "exportar" é capturado como UUID.

@router.get("/exportar")
def exportar_imoveis_csv(
    tipo_negocio: Optional[TipoNegocio] = None,
    disponibilidade: Optional[Disponibilidade] = None,
    cidade: Optional[str] = None,
    bairro: Optional[str] = None,
    tipo_imovel: Optional[TipoImovel] = None,
    dormitorios_min: Optional[int] = None,
    preco_min: Optional[float] = None,
    preco_max: Optional[float] = None,
    condicao: Optional[CondicaoImovel] = None,
    mobiliado: Optional[Mobiliado] = None,
    codigo: Optional[str] = None,
    q: Optional[str] = Query(default=None, description="Busca livre por código, logradouro ou bairro"),
    sem_foto: Optional[bool] = None,
    current_user: dict = Depends(get_current_user),
):
    """Baixa imóveis como CSV respeitando os filtros ativos (UTF-8 com BOM, delimitador ';' para Excel PT-BR)."""
    filtros = dict(
        tipo_negocio=tipo_negocio, disponibilidade=disponibilidade,
        cidade=cidade, bairro=bairro, tipo_imovel=tipo_imovel,
        dormitorios_min=dormitorios_min, preco_min=preco_min, preco_max=preco_max,
        condicao=condicao, mobiliado=mobiliado, codigo=codigo, q=q,
    )

    ids_sem_foto: Optional[List[str]] = None
    if sem_foto:
        # Locação não conta no filtro "sem foto" — ver /stats em main.py.
        todos_resp = (
            supabase_admin.table("imoveis")
            .select("id")
            .neq("tipo_negocio", "locacao")
            .execute()
        )
        com_foto_resp = supabase_admin.table("imovel_fotos").select("imovel_id").execute()
        ids_total = {row["id"] for row in (todos_resp.data or [])}
        ids_com_foto = {row["imovel_id"] for row in (com_foto_resp.data or [])}
        ids_sem_foto = list(ids_total - ids_com_foto)
        if not ids_sem_foto:
            buffer = io.StringIO()
            buffer.write("﻿")
            writer = csv.DictWriter(buffer, fieldnames=_CAMPOS_EXPORT, extrasaction="ignore", delimiter=";")
            writer.writeheader()
            return Response(
                content=buffer.getvalue(),
                media_type="text/csv; charset=utf-8",
                headers={
                    "Content-Disposition": f'attachment; filename="imoveis-{date.today().isoformat()}.csv"',
                    "Access-Control-Expose-Headers": "Content-Disposition",
                },
            )

    todos = []
    offset = 0
    page_size = 1000
    while True:
        q = _aplicar_filtros(supabase_admin.table("imoveis").select("*"), **filtros)
        if ids_sem_foto is not None:
            q = q.in_("id", ids_sem_foto)
        result = (
            q.order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = result.data or []
        todos.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size

    buffer = io.StringIO()
    buffer.write("﻿")  # BOM UTF-8
    writer = csv.DictWriter(
        buffer, fieldnames=_CAMPOS_EXPORT, extrasaction="ignore", delimiter=";"
    )
    writer.writeheader()
    for row in todos:
        writer.writerow({c: _csv_safe(row.get(c)) for c in _CAMPOS_EXPORT})

    nome_arquivo = f"imoveis-{date.today().isoformat()}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{nome_arquivo}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get("/", response_model=List[ImovelListOut])
def listar_imoveis(
    http_response: Response,
    tipo_negocio: Optional[TipoNegocio] = None,
    disponibilidade: Optional[Disponibilidade] = None,
    cidade: Optional[str] = None,
    bairro: Optional[str] = None,
    tipo_imovel: Optional[TipoImovel] = None,
    dormitorios_min: Optional[int] = None,
    preco_min: Optional[float] = None,
    preco_max: Optional[float] = None,
    condicao: Optional[CondicaoImovel] = None,
    mobiliado: Optional[Mobiliado] = None,
    codigo: Optional[str] = None,
    q: Optional[str] = Query(default=None, description="Busca livre por código, logradouro ou bairro"),
    sem_foto: Optional[bool] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    filtros = dict(
        tipo_negocio=tipo_negocio, disponibilidade=disponibilidade,
        cidade=cidade, bairro=bairro, tipo_imovel=tipo_imovel,
        dormitorios_min=dormitorios_min, preco_min=preco_min, preco_max=preco_max,
        condicao=condicao, mobiliado=mobiliado, codigo=codigo, q=q,
    )

    ids_sem_foto: Optional[List[str]] = None
    if sem_foto:
        # Locação não conta no filtro "sem foto" — ver /stats em main.py.
        todos_resp = (
            supabase_admin.table("imoveis")
            .select("id")
            .neq("tipo_negocio", "locacao")
            .execute()
        )
        com_foto_resp = supabase_admin.table("imovel_fotos").select("imovel_id").execute()
        ids_total = {row["id"] for row in (todos_resp.data or [])}
        ids_com_foto = {row["imovel_id"] for row in (com_foto_resp.data or [])}
        ids_sem_foto = list(ids_total - ids_com_foto)
        if not ids_sem_foto:
            http_response.headers["X-Total-Count"] = "0"
            http_response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"
            return []

    count_q = _aplicar_filtros(
        supabase_admin.table("imoveis").select("id", count="exact"), **filtros
    )
    if ids_sem_foto is not None:
        count_q = count_q.in_("id", ids_sem_foto)
    total = count_q.execute().count or 0
    http_response.headers["X-Total-Count"] = str(total)
    http_response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    offset = (page - 1) * page_size
    data_q = _aplicar_filtros(
        supabase_admin.table("imoveis").select(_LIST_FIELDS), **filtros
    )
    if ids_sem_foto is not None:
        data_q = data_q.in_("id", ids_sem_foto)
    result = data_q.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
    return [_transformar_lista(item) for item in result.data]


@router.post("/", response_model=ImovelOut, status_code=status.HTTP_201_CREATED)
def criar_imovel(body: ImovelCreate, current_user: dict = Depends(require_admin_or_internal)):
    data = body.model_dump(exclude={"tag_ids"})

    if not data.get("codigo"):
        data["codigo"] = _gerar_codigo()

    for field in ("area_total", "area_util", "valor_venda", "valor_locacao",
                  "iptu_mensal", "condominio_mensal"):
        if data.get(field) is not None:
            data[field] = float(data[field])

    if data.get("destaque_ordem") is not None:
        _liberar_posicao_destaque(data["destaque_ordem"])

    try:
        result = supabase_admin.table("imoveis").insert(data).execute()
    except Exception as e:
        if "23505" in str(e):
            raise HTTPException(status_code=409, detail="Posição de destaque já ocupada. Tente novamente.")
        raise HTTPException(status_code=500, detail="Erro ao criar imóvel.")
    imovel = result.data[0]

    if body.tag_ids:
        tag_links = [{"imovel_id": imovel["id"], "tag_id": tid} for tid in body.tag_ids]
        supabase_admin.table("imovel_tags").insert(tag_links).execute()

    revalidar_imovel(imovel.get("codigo"))
    return _buscar_imovel(imovel["id"])


@router.get("/{imovel_id}", response_model=ImovelOut)
def obter_imovel(imovel_id: str, current_user: dict = Depends(get_current_user)):
    return _ocultar_internas(_buscar_imovel(imovel_id), current_user)


@router.put("/{imovel_id}", response_model=ImovelOut)
def atualizar_imovel(
    imovel_id: str,
    body: ImovelUpdate,
    current_user: dict = Depends(require_admin),
):
    updates = body.model_dump(exclude_unset=True, exclude={"tag_ids"})
    for field in ("area_total", "area_util", "valor_venda", "valor_locacao",
                  "iptu_mensal", "condominio_mensal"):
        if updates.get(field) is not None:
            updates[field] = float(updates[field])

    if "destaque_ordem" in updates and updates["destaque_ordem"] is not None:
        _liberar_posicao_destaque(updates["destaque_ordem"], exceto_imovel_id=imovel_id)

    try:
        supabase_admin.table("imoveis").update(updates).eq("id", imovel_id).execute()
    except Exception as e:
        if "23505" in str(e):
            raise HTTPException(status_code=409, detail="Posição de destaque já ocupada. Tente novamente.")
        raise HTTPException(status_code=500, detail="Erro ao atualizar imóvel.")

    if body.tag_ids is not None:
        supabase_admin.table("imovel_tags").delete().eq("imovel_id", imovel_id).execute()
        if body.tag_ids:
            tag_links = [{"imovel_id": imovel_id, "tag_id": tid} for tid in body.tag_ids]
            supabase_admin.table("imovel_tags").insert(tag_links).execute()

    imovel = _buscar_imovel(imovel_id)
    revalidar_imovel(imovel.get("codigo"))
    return imovel


@router.delete("/{imovel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletar_imovel(imovel_id: str, current_user: dict = Depends(require_admin)):
    alvo = (
        supabase_admin.table("imoveis")
        .select("codigo")
        .eq("id", imovel_id)
        .single()
        .execute()
    )
    codigo = (alvo.data or {}).get("codigo")

    contratos_vinculados = (
        supabase_admin.table("contratos_locacao")
        .select("id", count="exact")
        .eq("imovel_id", imovel_id)
        .limit(1)
        .execute()
    )
    if (contratos_vinculados.count or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail="Não é possível excluir o imóvel: existem contratos de locação vinculados. Remova os contratos antes de excluir.",
        )

    fotos = (
        supabase_admin.table("imovel_fotos")
        .select("url")
        .eq("imovel_id", imovel_id)
        .execute()
    )
    for foto in (fotos.data or []):
        await deletar_foto(foto["url"])

    # Documentos internos: o registro some por cascade, mas o arquivo no storage
    # não — limpamos explicitamente para não deixar órfãos no bucket.
    docs = (
        supabase_admin.table("imovel_documentos")
        .select("firebase_path")
        .eq("imovel_id", imovel_id)
        .execute()
    )
    for doc in (docs.data or []):
        deletar_documento(doc["firebase_path"])

    supabase_admin.table("imoveis").delete().eq("id", imovel_id).execute()
    revalidar_imovel(codigo)


# ── Fotos ──────────────────────────────────────────────────────────────────────

@router.post("/{imovel_id}/fotos", status_code=status.HTTP_201_CREATED)
async def upload_fotos(
    imovel_id: str,
    fotos: List[UploadFile] = File(...),
    current_user: dict = Depends(require_admin),
):
    existing = (
        supabase_admin.table("imovel_fotos")
        .select("id", count="exact")
        .eq("imovel_id", imovel_id)
        .execute()
    )
    qtd_atual = existing.count or 0

    if qtd_atual + len(fotos) > 30:
        raise HTTPException(status_code=400, detail="Limite máximo de 30 fotos por imóvel.")

    # Upload pro Storage continua sequencial (cada upload já é um round-trip
    # I/O bound), mas o INSERT vai em batch — 1 query em vez de N.
    records = []
    for i, foto in enumerate(fotos):
        filename = f"foto_{uuid.uuid4().hex}.jpg"
        path = f"imoveis/{imovel_id}/{filename}"
        url = await upload_foto(foto, path=path)
        records.append({"imovel_id": imovel_id, "url": url, "ordem": qtd_atual + i + 1})

    if not records:
        return []
    result = supabase_admin.table("imovel_fotos").insert(records).execute()
    return result.data or []


@router.delete("/{imovel_id}/fotos/{foto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_foto(
    imovel_id: str,
    foto_id: str,
    current_user: dict = Depends(require_admin),
):
    foto = (
        supabase_admin.table("imovel_fotos")
        .select("*")
        .eq("id", foto_id)
        .eq("imovel_id", imovel_id)
        .single()
        .execute()
    )
    if not foto.data:
        raise HTTPException(status_code=404, detail="Foto não encontrada.")

    await deletar_foto(foto.data["url"])
    supabase_admin.table("imovel_fotos").delete().eq("id", foto_id).execute()


class ReordenarFotosBody(BaseModel):
    foto_ids: List[str]


@router.patch("/{imovel_id}/fotos/ordem", status_code=status.HTTP_200_OK)
def reordenar_fotos(
    imovel_id: str,
    body: ReordenarFotosBody,
    current_user: dict = Depends(require_admin),
):
    """Recebe a lista completa de foto_ids na nova ordem (capa = primeiro).
    Atualiza o campo `ordem` (1..N) de cada foto em uma transação lógica."""
    if not body.foto_ids:
        raise HTTPException(status_code=400, detail="Lista de fotos vazia.")

    if len(body.foto_ids) != len(set(body.foto_ids)):
        raise HTTPException(status_code=400, detail="IDs duplicados na lista de ordem.")

    existentes = (
        supabase_admin.table("imovel_fotos")
        .select("id")
        .eq("imovel_id", imovel_id)
        .execute()
    )
    ids_no_banco = {row["id"] for row in (existentes.data or [])}
    ids_recebidos = set(body.foto_ids)

    if ids_no_banco != ids_recebidos:
        raise HTTPException(
            status_code=400,
            detail="A lista enviada não corresponde às fotos cadastradas neste imóvel.",
        )

    for posicao, foto_id in enumerate(body.foto_ids, start=1):
        (
            supabase_admin.table("imovel_fotos")
            .update({"ordem": posicao})
            .eq("id", foto_id)
            .eq("imovel_id", imovel_id)
            .execute()
        )

    return {"atualizadas": len(body.foto_ids)}


class RotacionarFotoBody(BaseModel):
    graus: int = 90  # 90, 180 ou 270 — sentido horário


@router.post("/{imovel_id}/fotos/{foto_id}/rotacionar", status_code=status.HTTP_200_OK)
async def rotacionar_foto(
    imovel_id: str,
    foto_id: str,
    body: RotacionarFotoBody,
    current_user: dict = Depends(require_admin),
):
    """Baixa a foto, rotaciona `graus`° no sentido horário e re-envia com um
    novo path (evita cache do CDN). Substitui o URL no banco e apaga o arquivo
    antigo. Em caso de falha após upload, faz rollback do arquivo novo."""
    foto = (
        supabase_admin.table("imovel_fotos")
        .select("*")
        .eq("id", foto_id)
        .eq("imovel_id", imovel_id)
        .single()
        .execute()
    )
    if not foto.data:
        raise HTTPException(status_code=404, detail="Foto não encontrada.")

    url_antiga = foto.data["url"]
    contents = baixar_e_rotacionar(url_antiga, body.graus)

    novo_filename = f"foto_{uuid.uuid4().hex}.jpg"
    novo_path = f"imoveis/{imovel_id}/{novo_filename}"
    nova_url = upload_bytes_jpeg(contents, novo_path)

    try:
        (
            supabase_admin.table("imovel_fotos")
            .update({"url": nova_url})
            .eq("id", foto_id)
            .execute()
        )
    except Exception as e:
        # rollback do arquivo recém-subido para não deixar lixo no storage
        await deletar_foto(nova_url)
        raise HTTPException(status_code=500, detail=f"Falha ao atualizar registro: {e}")

    await deletar_foto(url_antiga)
    return {"id": foto_id, "url": nova_url, "ordem": foto.data.get("ordem")}


# ── Documentos internos do imóvel ─────────────────────────────────────────────
# Armazenagem interna (contratos, matrícula, IPTU, escritura...). Reusa o
# storage de documentos das locações: mesmo bucket, signed URL de download.

def _hidratar_documento(raw: dict) -> dict:
    """Anexa a signed URL de download ao registro antes de devolver."""
    return {**raw, "url": url_publica_documento(raw["firebase_path"])}


def _imovel_existe(imovel_id: str) -> None:
    res = (
        supabase_admin.table("imoveis")
        .select("id")
        .eq("id", imovel_id)
        .execute()
    )
    if not (res.data or []):
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")


@router.get("/{imovel_id}/documentos", response_model=List[DocumentoImovelOut])
def listar_documentos(imovel_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase_admin.table("imovel_documentos")
        .select("*")
        .eq("imovel_id", imovel_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [_hidratar_documento(d) for d in (result.data or [])]


@router.post(
    "/{imovel_id}/documentos",
    response_model=DocumentoImovelOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_documento_imovel(
    imovel_id: str,
    file: UploadFile = File(...),
    tipo: TipoDocumentoImovel = Form(default=TipoDocumentoImovel.outro),
    current_user: dict = Depends(require_admin),
):
    """Sobe um documento ao Supabase Storage e registra em imovel_documentos.
    Path inclui UUID para evitar colisão de nomes."""
    _imovel_existe(imovel_id)

    nome_original = file.filename or "documento"
    nome_seguro = re.sub(r"[^a-zA-Z0-9._-]+", "_", nome_original)[:80] or "documento"
    storage_path = f"imoveis/{imovel_id}/documentos/{uuid.uuid4().hex[:12]}-{nome_seguro}"

    info = await upload_documento(file, storage_path)

    registro = {
        "imovel_id": imovel_id,
        "tipo": tipo.value,
        "nome_arquivo": nome_original,
        "firebase_path": info["firebase_path"],
        "mime_type": info["mime_type"],
        "tamanho_bytes": info["tamanho_bytes"],
        "uploaded_by": current_user["id"],
    }
    try:
        result = supabase_admin.table("imovel_documentos").insert(registro).execute()
    except Exception as e:
        # Reverte o upload se o INSERT falhou — evita órfão no storage.
        deletar_documento(storage_path)
        raise HTTPException(status_code=500, detail=f"Erro ao registrar documento: {e}")

    return _hidratar_documento(result.data[0])


@router.delete(
    "/{imovel_id}/documentos/{documento_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def deletar_documento_imovel(
    imovel_id: str,
    documento_id: str,
    current_user: dict = Depends(require_admin),
):
    """Remove o arquivo do storage e o registro do banco. Idempotente."""
    existente = (
        supabase_admin.table("imovel_documentos")
        .select("*")
        .eq("id", documento_id)
        .eq("imovel_id", imovel_id)
        .execute()
        .data
        or []
    )
    if not existente:
        return
    deletar_documento(existente[0]["firebase_path"])
    supabase_admin.table("imovel_documentos").delete().eq("id", documento_id).execute()
