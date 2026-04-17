from pydantic import BaseModel
from typing import Optional


class TagCreate(BaseModel):
    nome: str
    cor: Optional[str] = None  # hex color, ex: "#FF5733"


class TagUpdate(TagCreate):
    nome: Optional[str] = None


class TagOut(TagCreate):
    id: str
    created_at: str
