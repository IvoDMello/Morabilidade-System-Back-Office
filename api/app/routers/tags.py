from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.auth.dependencies import get_current_user, require_admin
from app.schemas.tag import TagCreate, TagUpdate, TagOut
from app.database import supabase_admin

router = APIRouter()


@router.get("/", response_model=List[TagOut])
def listar_tags(current_user: dict = Depends(get_current_user)):
    result = supabase_admin.table("tags").select("*").order("nome").execute()
    return result.data


@router.post("/", response_model=TagOut, status_code=status.HTTP_201_CREATED)
def criar_tag(body: TagCreate, admin: dict = Depends(require_admin)):
    """Cria uma nova tag. Apenas admin."""
    result = supabase_admin.table("tags").insert(body.model_dump()).execute()
    return result.data[0]


@router.put("/{tag_id}", response_model=TagOut)
def atualizar_tag(tag_id: str, body: TagUpdate, admin: dict = Depends(require_admin)):
    updates = body.model_dump(exclude_unset=True)
    result = supabase_admin.table("tags").update(updates).eq("id", tag_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Tag não encontrada.")
    return result.data[0]


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_tag(tag_id: str, admin: dict = Depends(require_admin)):
    """Remove uma tag. Apenas admin."""
    supabase_admin.table("tags").delete().eq("id", tag_id).execute()
