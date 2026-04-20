from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import List
from app.auth.dependencies import get_current_user, require_admin
from app.schemas.user import UserCreate, UserUpdate, UserOut, UserChangePassword
from app.database import supabase, supabase_admin
from app.services.firebase import upload_foto

router = APIRouter()


@router.get("/", response_model=List[UserOut])
def listar_usuarios(admin: dict = Depends(require_admin)):
    """Lista todos os usuários internos. Apenas admin."""
    result = supabase_admin.table("usuarios").select("*").order("nome_completo").execute()
    return result.data


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def criar_usuario(body: UserCreate, admin: dict = Depends(require_admin)):
    """Cria um novo usuário interno. Apenas admin."""
    # Cria o usuário no Supabase Auth
    try:
        auth_response = supabase_admin.auth.admin.create_user(
            {"email": body.email, "password": body.senha, "email_confirm": True}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao criar usuário: {str(e)}")

    user_id = auth_response.user.id

    # Insere o perfil na tabela usuarios
    data = {
        "id": user_id,
        "nome_completo": body.nome_completo,
        "email": body.email,
        "perfil": body.perfil,
        "telefone": body.telefone,
    }
    result = supabase_admin.table("usuarios").insert(data).execute()
    return result.data[0]


@router.get("/me", response_model=UserOut)
def perfil_atual(current_user: dict = Depends(get_current_user)):
    """Retorna o perfil do usuário autenticado."""
    return current_user


@router.put("/me", response_model=UserOut)
def atualizar_perfil(body: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Atualiza dados do próprio perfil (exceto perfil de acesso)."""
    updates = body.model_dump(exclude_unset=True, exclude={"perfil", "ativo"})
    result = (
        supabase_admin.table("usuarios")
        .update(updates)
        .eq("id", current_user["id"])
        .execute()
    )
    return result.data[0]


@router.put("/me/senha", status_code=status.HTTP_204_NO_CONTENT)
def alterar_senha(body: UserChangePassword, current_user: dict = Depends(get_current_user)):
    """Troca a senha do usuário logado, verificando a senha atual."""
    try:
        supabase.auth.sign_in_with_password(
            {"email": current_user["email"], "password": body.senha_atual}
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Senha atual incorreta.")
    if len(body.nova_senha) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A nova senha deve ter no mínimo 8 caracteres.")
    try:
        supabase_admin.auth.admin.update_user_by_id(current_user["id"], {"password": body.nova_senha})
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Erro ao alterar senha.")


@router.post("/me/foto", response_model=UserOut)
async def upload_foto_perfil(
    foto: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Faz upload da foto de perfil do usuário."""
    url = await upload_foto(foto, path=f"usuarios/{current_user['id']}/foto_perfil")
    result = (
        supabase_admin.table("usuarios")
        .update({"foto_url": url})
        .eq("id", current_user["id"])
        .execute()
    )
    return result.data[0]


@router.get("/{user_id}", response_model=UserOut)
def obter_usuario(user_id: str, admin: dict = Depends(require_admin)):
    result = (
        supabase_admin.table("usuarios").select("*").eq("id", user_id).single().execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return result.data


@router.put("/{user_id}", response_model=UserOut)
def atualizar_usuario(
    user_id: str, body: UserUpdate, admin: dict = Depends(require_admin)
):
    """Atualiza qualquer campo de um usuário. Apenas admin."""
    updates = body.model_dump(exclude_unset=True)
    result = (
        supabase_admin.table("usuarios").update(updates).eq("id", user_id).execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return result.data[0]


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def desativar_usuario(user_id: str, admin: dict = Depends(require_admin)):
    """Desativa (soft delete) um usuário. Apenas admin."""
    supabase_admin.table("usuarios").update({"ativo": False}).eq("id", user_id).execute()
