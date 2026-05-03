import csv
import io
import unicodedata
from datetime import date, datetime
from typing import List, Optional

from fastapi import (
    APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status,
)

from app.auth.dependencies import get_current_user, require_admin
from app.database import supabase_admin
from app.schemas.cliente import (
    ClienteCreate, ClienteListOut, ClienteOut, ClienteUpdate, StatusCliente,
)

router = APIRouter()


# ── Constantes compartilhadas ────────────────────────────────────────────────

_CAMPOS_EXPORT = [
    "nome_completo", "email", "telefone", "cpf_cnpj", "data_nascimento",
    "telefone_secundario", "instagram", "endereco", "cidade", "estado", "pais",
    "profissao_empresa", "origem_lead", "status", "tipo_cliente",
    "renda_aproximada", "como_conheceu", "observacoes", "imovel_codigo",
    "created_at",
]

_STATUS_VALIDOS = {"ativo", "em_negociacao", "inativo", "concluido"}
_TIPOS_VALIDOS = {"comprador", "locatario", "proprietario", "investidor"}
_ORIGENS_VALIDAS = {
    "site", "indicacao", "ligacao", "whatsapp", "instagram", "facebook", "outro",
}

# Aliases (sem acento, minúsculas, separadores normalizados) → campo do banco.
# Aceita variações comuns em PT-BR e exports de outros CRMs.
_ALIASES_HEADER = {
    "nome_completo": [
        "nome", "nome completo", "name", "cliente", "razao social", "contato",
    ],
    "email": ["email", "e mail"],
    "telefone": [
        "telefone", "celular", "whatsapp", "tel", "phone", "fone", "telefone 1",
    ],
    "cpf_cnpj": ["cpf", "cnpj", "cpf cnpj", "documento", "doc"],
    "data_nascimento": [
        "data nascimento", "data de nascimento", "nascimento", "aniversario", "dt nasc",
    ],
    "telefone_secundario": [
        "telefone secundario", "telefone 2", "tel secundario", "celular secundario",
        "telefone alternativo",
    ],
    "instagram": ["instagram", "ig", "@"],
    "endereco": ["endereco", "endereco completo", "logradouro", "rua"],
    "cidade": ["cidade", "city", "municipio"],
    "estado": ["estado", "uf", "state"],
    "pais": ["pais", "country"],
    "profissao_empresa": [
        "profissao", "empresa", "profissao empresa", "ocupacao", "trabalho",
    ],
    "origem_lead": [
        "origem", "origem lead", "origem do lead", "fonte", "source", "canal",
    ],
    "status": ["status", "situacao", "estagio"],
    "tipo_cliente": ["tipo", "tipo cliente", "tipo de cliente", "perfil cliente"],
    "renda_aproximada": ["renda", "renda aproximada", "renda mensal"],
    "como_conheceu": ["como conheceu", "referencia", "ref"],
    "observacoes": ["observacoes", "obs", "anotacoes", "comentarios", "observacao"],
    "imovel_codigo": [
        "imovel codigo", "codigo do imovel", "imovel", "codigo imovel",
        "codigo do imóvel",
    ],
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _normalizar_imovel_codigo(data: dict) -> dict:
    """Garante coerência: imovel_codigo só faz sentido para tipo_cliente=proprietario."""
    if data.get("tipo_cliente") != "proprietario":
        if "imovel_codigo" in data:
            data["imovel_codigo"] = None
    elif data.get("imovel_codigo"):
        data["imovel_codigo"] = data["imovel_codigo"].strip() or None
    return data


def _achatar_tags(raw: dict) -> dict:
    """Transforma o JOIN cliente_tags(tags(...)) em uma lista plana de tags."""
    raw_tags = raw.pop("cliente_tags", None) or []
    raw["tags"] = [t["tags"] for t in raw_tags if t.get("tags")]
    return raw


def _sincronizar_tags(cliente_id: str, tag_ids: Optional[List[str]]) -> None:
    """Apaga e reinsere os vínculos de tags do cliente. None = não mexe."""
    if tag_ids is None:
        return
    supabase_admin.table("cliente_tags").delete().eq("cliente_id", cliente_id).execute()
    if tag_ids:
        links = [{"cliente_id": cliente_id, "tag_id": t} for t in tag_ids]
        supabase_admin.table("cliente_tags").insert(links).execute()


def _normalizar_header(s: str) -> str:
    """Remove acentos, baixa caixa, normaliza separadores."""
    nfkd = unicodedata.normalize("NFKD", s)
    sem_acento = "".join(c for c in nfkd if not unicodedata.combining(c))
    return (
        sem_acento.strip().lower()
        .replace("-", " ").replace("_", " ").replace("/", " ").replace(".", " ")
    )


def _construir_mapa_colunas(headers: List[str]) -> dict:
    """{header_original_no_csv: campo_do_banco}"""
    aliases_normalizados = {
        campo: {_normalizar_header(a) for a in aliases} | {campo.replace("_", " ")}
        for campo, aliases in _ALIASES_HEADER.items()
    }
    mapa = {}
    for header in headers:
        if not header:
            continue
        norm = _normalizar_header(header)
        for campo, aliases in aliases_normalizados.items():
            if norm in aliases:
                mapa[header] = campo
                break
    return mapa


def _parse_data_nascimento(valor: str) -> Optional[str]:
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(valor, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _parse_renda(valor: str) -> Optional[float]:
    v = valor.replace("R$", "").replace(" ", "")
    # Padrão BR (1.234,56) → ASCII (1234.56)
    if "," in v and "." in v:
        v = v.replace(".", "").replace(",", ".")
    elif "," in v:
        v = v.replace(",", ".")
    try:
        return float(v)
    except ValueError:
        return None


def _row_para_cliente(row: dict, mapa: dict) -> dict:
    """Aplica mapeamento + sanitização de campos especiais (enum, data, renda)."""
    cliente = {}
    for csv_col, campo in mapa.items():
        valor = (row.get(csv_col) or "").strip()
        if not valor:
            continue
        if campo == "data_nascimento":
            parsed = _parse_data_nascimento(valor)
            if parsed:
                cliente[campo] = parsed
        elif campo == "renda_aproximada":
            parsed = _parse_renda(valor)
            if parsed is not None:
                cliente[campo] = parsed
        elif campo == "status" and valor.lower() in _STATUS_VALIDOS:
            cliente[campo] = valor.lower()
        elif campo == "tipo_cliente" and valor.lower() in _TIPOS_VALIDOS:
            cliente[campo] = valor.lower()
        elif campo == "origem_lead" and valor.lower() in _ORIGENS_VALIDAS:
            cliente[campo] = valor.lower()
        elif campo == "estado":
            cliente[campo] = valor.upper()[:2]
        else:
            cliente[campo] = valor
    return _normalizar_imovel_codigo(cliente)


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[ClienteListOut])
def listar_clientes(
    http_response: Response,
    nome: Optional[str] = None,
    email: Optional[str] = None,
    status: Optional[StatusCliente] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    def _aplicar(q):
        if nome:
            q = q.ilike("nome_completo", f"%{nome}%")
        if email:
            q = q.ilike("email", f"%{email}%")
        if status:
            q = q.eq("status", status)
        return q

    total = (_aplicar(supabase_admin.table("clientes").select("id", count="exact"))
             .execute().count or 0)
    http_response.headers["X-Total-Count"] = str(total)

    offset = (page - 1) * page_size
    result = (
        _aplicar(supabase_admin.table("clientes")
                 .select("id, nome_completo, email, telefone, status, tipo_cliente, "
                         "origem_lead, imovel_codigo, observacoes, created_at, "
                         "cliente_tags(tags(id, nome, cor))"))
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    return [_achatar_tags(c) for c in result.data]


# IMPORTANTE: /exportar e /importar precisam vir ANTES de /{cliente_id},
# senão o roteador captura "exportar"/"importar" como UUID.

@router.get("/exportar")
def exportar_clientes_csv(
    nome: Optional[str] = None,
    email: Optional[str] = None,
    status: Optional[StatusCliente] = None,
    current_user: dict = Depends(get_current_user),
):
    """Baixa clientes como CSV respeitando os filtros ativos (UTF-8 com BOM para abrir no Excel)."""
    def _aplicar_export(q):
        if nome:
            q = q.ilike("nome_completo", f"%{nome}%")
        if email:
            q = q.ilike("email", f"%{email}%")
        if status:
            q = q.eq("status", status)
        return q

    todos = []
    offset = 0
    page_size = 1000
    while True:
        result = (
            _aplicar_export(supabase_admin.table("clientes").select("*"))
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = result.data or []
        todos.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size

    buffer = io.StringIO()
    buffer.write("﻿")  # BOM UTF-8 para Excel reconhecer acentos
    # Delimitador ';' porque Excel PT-BR usa ',' como separador decimal e quebraria o split por colunas.
    # O importador (csv.Sniffer) detecta ',' e ';' automaticamente.
    writer = csv.DictWriter(
        buffer, fieldnames=_CAMPOS_EXPORT, extrasaction="ignore", delimiter=";"
    )
    writer.writeheader()
    for row in todos:
        writer.writerow({c: ("" if row.get(c) is None else row.get(c)) for c in _CAMPOS_EXPORT})

    nome_arquivo = f"clientes-{date.today().isoformat()}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{nome_arquivo}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/importar")
async def importar_clientes_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_admin),
):
    """
    Importa clientes a partir de um CSV.

    - Detecta delimitador automaticamente (`,` ou `;`).
    - Aceita UTF-8 (com ou sem BOM) e Latin-1.
    - Cabeçalhos casam por aliases (Nome/Nome Completo/Cliente, Telefone/Celular, etc.).
    - Linhas sem nome/telefone reconhecidos são ignoradas com motivo.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Envie um arquivo .csv")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Arquivo muito grande. Máximo permitido: 5 MB.")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="Encoding do arquivo não suportado.")

    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel

    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    headers = reader.fieldnames or []
    mapa = _construir_mapa_colunas(headers)
    campos_mapeados = set(mapa.values())

    if "nome_completo" not in campos_mapeados or "telefone" not in campos_mapeados:
        raise HTTPException(
            status_code=400,
            detail=(
                "CSV precisa ter colunas reconhecidas para Nome e Telefone. "
                f"Colunas encontradas: {headers}. "
                "Renomeie os cabeçalhos no arquivo (ex: Nome, Telefone) e tente de novo."
            ),
        )

    para_inserir = []
    erros = []
    for i, row in enumerate(reader, start=2):  # linha 1 é o cabeçalho
        try:
            cliente = _row_para_cliente(row, mapa)
        except Exception as e:
            erros.append({"linha": i, "motivo": f"Erro ao processar linha: {e}"})
            continue

        if not cliente.get("nome_completo") or not cliente.get("telefone"):
            erros.append({"linha": i, "motivo": "Nome ou telefone vazios"})
            continue
        para_inserir.append((i, cliente))

    criadas = 0
    for i, cliente in para_inserir:
        try:
            supabase_admin.table("clientes").insert(cliente).execute()
            criadas += 1
        except Exception as e:
            err_str = str(e).lower()
            if "duplicate" in err_str or "unique" in err_str:
                if "email" in err_str:
                    motivo = f"E-mail já cadastrado: {cliente.get('email', '')}"
                elif "telefone" in err_str or "phone" in err_str:
                    motivo = f"Telefone já cadastrado: {cliente.get('telefone', '')}"
                elif "cpf" in err_str or "cnpj" in err_str:
                    motivo = f"CPF/CNPJ já cadastrado: {cliente.get('cpf_cnpj', '')}"
                else:
                    motivo = f"Registro duplicado — cliente já existe no sistema"
            else:
                motivo = f"Erro do banco: {str(e)[:120]}"
            erros.append({"linha": i, "motivo": motivo})

    return {
        "total_lidas": criadas + len(erros),
        "criadas": criadas,
        "erros": len(erros),
        "campos_reconhecidos": sorted(campos_mapeados),
        "campos_ignorados": sorted(set(headers) - set(mapa.keys())),
        "detalhes_erros": erros[:50],
    }


def _buscar_cliente(cliente_id: str) -> dict:
    result = (
        supabase_admin.table("clientes")
        .select("*, cliente_tags(tags(id, nome, cor))")
        .eq("id", cliente_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return _achatar_tags(result.data)


@router.post("/", response_model=ClienteOut, status_code=status.HTTP_201_CREATED)
def criar_cliente(body: ClienteCreate, current_user: dict = Depends(require_admin)):
    data = _normalizar_imovel_codigo(body.model_dump(exclude={"tag_ids"}))
    result = supabase_admin.table("clientes").insert(data).execute()
    novo = result.data[0]
    _sincronizar_tags(novo["id"], body.tag_ids)
    return _buscar_cliente(novo["id"])


@router.get("/{cliente_id}", response_model=ClienteOut)
def obter_cliente(cliente_id: str, current_user: dict = Depends(get_current_user)):
    return _buscar_cliente(cliente_id)


@router.put("/{cliente_id}", response_model=ClienteOut)
def atualizar_cliente(
    cliente_id: str,
    body: ClienteUpdate,
    current_user: dict = Depends(require_admin),
):
    updates = _normalizar_imovel_codigo(
        body.model_dump(exclude_unset=True, exclude={"tag_ids"})
    )
    if updates:
        result = (
            supabase_admin.table("clientes").update(updates).eq("id", cliente_id).execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    # tag_ids é tratado separadamente; só sincroniza se foi enviado.
    if "tag_ids" in body.model_fields_set:
        _sincronizar_tags(cliente_id, body.tag_ids)
    return _buscar_cliente(cliente_id)


@router.delete("/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_cliente(cliente_id: str, current_user: dict = Depends(require_admin)):
    """Remove um cliente (idempotente: retorna 204 mesmo se já não existir)."""
    supabase_admin.table("clientes").delete().eq("id", cliente_id).execute()
