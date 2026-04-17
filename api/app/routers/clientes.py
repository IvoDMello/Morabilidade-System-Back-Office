from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from app.auth.dependencies import get_current_user
from app.schemas.cliente import ClienteCreate, ClienteUpdate, ClienteOut, ClienteListOut, StatusCliente
from app.database import supabase_admin

router = APIRouter()


@router.get("/", response_model=List[ClienteListOut])
def listar_clientes(
    nome: Optional[str] = None,
    email: Optional[str] = None,
    status: Optional[StatusCliente] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    query = supabase_admin.table("clientes").select(
        "id, nome_completo, email, telefone, status, tipo_cliente, origem_lead, created_at"
    )

    if nome:
        query = query.ilike("nome_completo", f"%{nome}%")
    if email:
        query = query.ilike("email", f"%{email}%")
    if status:
        query = query.eq("status", status)

    offset = (page - 1) * page_size
    result = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
    return result.data


@router.post("/", response_model=ClienteOut, status_code=status.HTTP_201_CREATED)
def criar_cliente(body: ClienteCreate, current_user: dict = Depends(get_current_user)):
    data = body.model_dump()
    result = supabase_admin.table("clientes").insert(data).execute()
    return result.data[0]


@router.get("/{cliente_id}", response_model=ClienteOut)
def obter_cliente(cliente_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase_admin.table("clientes").select("*").eq("id", cliente_id).single().execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return result.data


@router.put("/{cliente_id}", response_model=ClienteOut)
def atualizar_cliente(
    cliente_id: str,
    body: ClienteUpdate,
    current_user: dict = Depends(get_current_user),
):
    updates = body.model_dump(exclude_unset=True)
    result = (
        supabase_admin.table("clientes").update(updates).eq("id", cliente_id).execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return result.data[0]


@router.delete("/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_cliente(cliente_id: str, current_user: dict = Depends(get_current_user)):
    supabase_admin.table("clientes").delete().eq("id", cliente_id).execute()
