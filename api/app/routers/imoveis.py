from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query, Response
from typing import List, Optional
from enum import Enum
from app.auth.dependencies import get_current_user
from app.schemas.imovel import (
    ImovelCreate, ImovelUpdate, ImovelOut, ImovelListOut,
    TipoNegocio, Disponibilidade, TipoImovel, CondicaoImovel, Mobiliado,
)
from app.database import supabase_admin
from app.services.firebase import upload_foto, deletar_foto
import uuid


def _ev(v):
    """Extrai o valor string de um enum, ou retorna o valor original."""
    return v.value if isinstance(v, Enum) else v

router = APIRouter()

_LIST_FIELDS = (
    "id, codigo, tipo_negocio, disponibilidade, cidade, bairro, "
    "tipo_imovel, dormitorios, area_util, valor_venda, valor_locacao, "
    "created_at, imovel_fotos(url, ordem), imovel_tags(tags(id, nome, cor))"
)

_DETAIL_FIELDS = (
    "*, imovel_fotos(id, url, ordem), imovel_tags(tags(id, nome, cor))"
)


def _gerar_codigo() -> str:
    result = supabase_admin.rpc("proxima_sequencia_imovel").execute()
    return f"IMO-{result.data:05d}"


def _aplicar_filtros(query, *, tipo_negocio, disponibilidade, cidade, bairro,
                     tipo_imovel, dormitorios_min, preco_min, preco_max,
                     condicao, mobiliado, codigo):
    if codigo:
        query = query.ilike("codigo", f"%{codigo}%")
    if tipo_negocio:
        query = query.eq("tipo_negocio", _ev(tipo_negocio))
    if disponibilidade:
        query = query.eq("disponibilidade", _ev(disponibilidade))
    if cidade:
        query = query.ilike("cidade", f"%{cidade}%")
    if bairro:
        query = query.ilike("bairro", f"%{bairro}%")
    if tipo_imovel:
        query = query.eq("tipo_imovel", _ev(tipo_imovel))
    if dormitorios_min is not None:
        query = query.gte("dormitorios", dormitorios_min)
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


def _transformar_lista(raw: dict) -> dict:
    fotos = sorted(raw.pop("imovel_fotos", None) or [], key=lambda f: f.get("ordem", 0))
    foto_capa = fotos[0]["url"] if fotos else None
    tags_raw = raw.pop("imovel_tags", None) or []
    tags = [t["tags"] for t in tags_raw if t.get("tags")]
    return {**raw, "foto_capa": foto_capa, "tags": tags}


def _transformar_detalhe(raw: dict) -> dict:
    fotos = sorted(raw.pop("imovel_fotos", None) or [], key=lambda f: f.get("ordem", 0))
    tags_raw = raw.pop("imovel_tags", None) or []
    tags = [t["tags"] for t in tags_raw if t.get("tags")]
    tag_ids = [t["id"] for t in tags]
    return {**raw, "fotos": fotos, "tags": tags, "tag_ids": tag_ids}


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
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    filtros = dict(
        tipo_negocio=tipo_negocio, disponibilidade=disponibilidade,
        cidade=cidade, bairro=bairro, tipo_imovel=tipo_imovel,
        dormitorios_min=dormitorios_min, preco_min=preco_min, preco_max=preco_max,
        condicao=condicao, mobiliado=mobiliado, codigo=codigo,
    )

    count_q = _aplicar_filtros(
        supabase_admin.table("imoveis").select("id", count="exact"), **filtros
    )
    total = count_q.execute().count or 0
    http_response.headers["X-Total-Count"] = str(total)
    http_response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    offset = (page - 1) * page_size
    data_q = _aplicar_filtros(
        supabase_admin.table("imoveis").select(_LIST_FIELDS), **filtros
    )
    result = data_q.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()

    return [_transformar_lista(item) for item in result.data]


@router.post("/", response_model=ImovelOut, status_code=status.HTTP_201_CREATED)
def criar_imovel(body: ImovelCreate, current_user: dict = Depends(get_current_user)):
    data = body.model_dump(exclude={"tag_ids"})

    if not data.get("codigo"):
        data["codigo"] = _gerar_codigo()

    for field in ("area_total", "area_util", "valor_venda", "valor_locacao",
                  "iptu_mensal", "condominio_mensal"):
        if data.get(field) is not None:
            data[field] = float(data[field])

    result = supabase_admin.table("imoveis").insert(data).execute()
    imovel = result.data[0]

    if body.tag_ids:
        tag_links = [{"imovel_id": imovel["id"], "tag_id": tid} for tid in body.tag_ids]
        supabase_admin.table("imovel_tags").insert(tag_links).execute()

    return _buscar_imovel(imovel["id"])


@router.get("/{imovel_id}", response_model=ImovelOut)
def obter_imovel(imovel_id: str, current_user: dict = Depends(get_current_user)):
    return _buscar_imovel(imovel_id)


@router.put("/{imovel_id}", response_model=ImovelOut)
def atualizar_imovel(
    imovel_id: str,
    body: ImovelUpdate,
    current_user: dict = Depends(get_current_user),
):
    updates = body.model_dump(exclude_unset=True, exclude={"tag_ids"})
    for field in ("area_total", "area_util", "valor_venda", "valor_locacao",
                  "iptu_mensal", "condominio_mensal"):
        if updates.get(field) is not None:
            updates[field] = float(updates[field])

    supabase_admin.table("imoveis").update(updates).eq("id", imovel_id).execute()

    if body.tag_ids is not None:
        supabase_admin.table("imovel_tags").delete().eq("imovel_id", imovel_id).execute()
        if body.tag_ids:
            tag_links = [{"imovel_id": imovel_id, "tag_id": tid} for tid in body.tag_ids]
            supabase_admin.table("imovel_tags").insert(tag_links).execute()

    return _buscar_imovel(imovel_id)


@router.delete("/{imovel_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_imovel(imovel_id: str, current_user: dict = Depends(get_current_user)):
    fotos = (
        supabase_admin.table("imovel_fotos")
        .select("url")
        .eq("imovel_id", imovel_id)
        .execute()
    )
    import asyncio
    for foto in (fotos.data or []):
        asyncio.run(deletar_foto(foto["url"]))
    supabase_admin.table("imoveis").delete().eq("id", imovel_id).execute()


# ── Fotos ──────────────────────────────────────────────────────────────────────

@router.post("/{imovel_id}/fotos", status_code=status.HTTP_201_CREATED)
async def upload_fotos(
    imovel_id: str,
    fotos: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
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

    uploaded = []
    for i, foto in enumerate(fotos):
        filename = f"foto_{uuid.uuid4().hex[:8]}.jpg"
        path = f"imoveis/{imovel_id}/{filename}"
        url = await upload_foto(foto, path=path)
        record = {"imovel_id": imovel_id, "url": url, "ordem": qtd_atual + i + 1}
        result = supabase_admin.table("imovel_fotos").insert(record).execute()
        uploaded.append(result.data[0])

    return uploaded


@router.delete("/{imovel_id}/fotos/{foto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_foto(
    imovel_id: str,
    foto_id: str,
    current_user: dict = Depends(get_current_user),
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


# ── Endpoints públicos ────────────────────────────────────────────────────────

@router.get("/publico/disponiveis", response_model=List[ImovelListOut], tags=["Site Público"])
def imoveis_disponiveis_publico(
    http_response: Response,
    tipo_negocio: Optional[TipoNegocio] = None,
    cidade: Optional[str] = None,
    bairro: Optional[str] = None,
    tipo_imovel: Optional[TipoImovel] = None,
    dormitorios_min: Optional[int] = None,
    preco_min: Optional[float] = None,
    preco_max: Optional[float] = None,
    condicao: Optional[CondicaoImovel] = None,
    mobiliado: Optional[Mobiliado] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    filtros = dict(
        tipo_negocio=tipo_negocio, disponibilidade=Disponibilidade.disponivel,
        cidade=cidade, bairro=bairro, tipo_imovel=tipo_imovel,
        dormitorios_min=dormitorios_min, preco_min=preco_min, preco_max=preco_max,
        condicao=condicao, mobiliado=mobiliado, codigo=None,
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
    result = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
    return [_transformar_lista(item) for item in result.data]


@router.get("/publico/{codigo}", response_model=ImovelOut, tags=["Site Público"])
def detalhe_imovel_publico(codigo: str):
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
    return _buscar_imovel(result.data["id"])


# ── Helper ─────────────────────────────────────────────────────────────────────

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
