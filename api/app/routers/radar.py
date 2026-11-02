"""MoraMétrica (codinome Radar): busca pública de vendas por endereço.

Valores declarados à Prefeitura do Rio no ITBI, importados por
scripts/radar_importar.py. O visitante digita um prédio ("Vieira Souto 510"),
uma rua ("Av. Vieira Souto") ou um bairro ("Ipanema") e a busca decide qual dos
três é. As médias vêm prontas das funções do banco (migrations 056 e 058).

Os dados só mudam na importação (no máximo uma vez por semana), então as
respostas ficam em cache no processo por 1 hora e no navegador por 5 minutos.
"""
import threading
import time
from dataclasses import dataclass
from datetime import date
from typing import Any, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.database import supabase_admin
from app.limiter import limiter
from app.schemas.radar import (
    RadarBuscaOut,
    RadarInfo,
    RadarOpcao,
    RadarPeriodo,
    RadarPredio,
    RadarResumo,
    RadarRua,
    RadarSugestao,
    RadarTipologia,
    RadarTipologiaResumo,
    RadarTransacao,
)
from app.services.radar.endereco import ConsultaEndereco, interpretar_busca
from app.services.radar.normalizacao import (
    formatar_complemento,
    formatar_tipologia,
    texto_busca,
)

router = APIRouter()

ANOS_PADRAO = 5
LIMITE_RUAS_BAIRRO = 10
_CACHE_HTTP = "public, max-age=300"


class _CacheTTL:
    """Cache em memória com validade. Simples de propósito: um processo, poucos
    milhares de chaves e dados que só mudam na importação."""

    def __init__(self, ttl: float, maximo: int):
        self.ttl = ttl
        self.maximo = maximo
        self._itens: dict = {}
        self._trava = threading.Lock()

    def obter(self, chave) -> tuple[bool, Any]:
        with self._trava:
            item = self._itens.get(chave)
            if item is None or item[0] < time.monotonic():
                return False, None
            return True, item[1]

    def guardar(self, chave, valor) -> None:
        with self._trava:
            if len(self._itens) >= self.maximo:
                agora = time.monotonic()
                self._itens = {k: v for k, v in self._itens.items() if v[0] >= agora}
                if len(self._itens) >= self.maximo:
                    self._itens.clear()
            self._itens[chave] = (time.monotonic() + self.ttl, valor)

    def limpar(self) -> None:
        with self._trava:
            self._itens.clear()


_respostas = _CacheTTL(ttl=3600, maximo=2000)
_base = _CacheTTL(ttl=3600, maximo=8)


def limpar_cache() -> None:
    _respostas.limpar()
    _base.limpar()


# ── Dados de apoio ──────────────────────────────────────────────────────────

def _rpc(nome: str, params: dict) -> Any:
    return supabase_admin.rpc(nome, params).execute().data


def _bairros() -> dict[str, dict]:
    """chave ("JARDIM BOTANICO") → {"chave", "nome": "Jardim Botânico", "transacoes"}."""
    achou, bairros = _base.obter("bairros")
    if not achou:
        bairros = {b["chave"]: b for b in (_rpc("radar_bairros", {}) or [])}
        _base.guardar("bairros", bairros)
    return bairros


def _dados_ate() -> Optional[date]:
    """Último mês publicado pela Prefeitura (da última importação ok)."""
    achou, valor = _base.obter("dados_ate")
    if not achou:
        res = (
            supabase_admin.table("radar_importacoes")
            .select("dados_ate")
            .eq("status", "ok")
            .order("id", desc=True)
            .limit(1)
            .execute()
        )
        bruto = res.data[0].get("dados_ate") if res.data else None
        valor = date.fromisoformat(bruto) if bruto else None
        _base.guardar("dados_ate", valor)
    return valor


def _logradouro(cl: int) -> Optional[dict]:
    res = (
        supabase_admin.table("radar_logradouros")
        .select("cl, nome, tipo, bairros, transacoes, predios")
        .eq("cl", cl)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def calcular_periodo(
    dados_ate: Optional[date],
    desde: Optional[int],
    ate: Optional[int],
    todo_periodo: bool,
) -> RadarPeriodo:
    """Sem filtro do visitante: os últimos 5 anos até o último mês publicado
    (dados até set/2026 → de out/2021 em diante)."""
    if todo_periodo:
        return RadarPeriodo(padrao=False)
    if desde or ate:
        return RadarPeriodo(
            desde=date(desde, 1, 1) if desde else None,
            ate=date(ate, 12, 1) if ate else None,
            padrao=False,
        )
    if dados_ate is None:
        return RadarPeriodo(padrao=True)
    ano, mes = dados_ate.year - ANOS_PADRAO, dados_ate.month + 1
    if mes == 13:
        ano, mes = ano + 1, 1
    return RadarPeriodo(desde=date(ano, mes, 1), padrao=True)


# ── Conversão das respostas do banco ────────────────────────────────────────

def _arredondar(valor: Optional[float]) -> Optional[float]:
    return round(valor, 2) if valor is not None else None


def _resumo(bruto: Optional[dict]) -> RadarResumo:
    bruto = bruto or {}
    return RadarResumo(
        transacoes=bruto.get("transacoes") or 0,
        media_m2=_arredondar(bruto.get("media_m2")),
        media_valor=_arredondar(bruto.get("media_valor")),
        media_area=_arredondar(bruto.get("media_area")),
    )


def _tipologias(lista: Optional[list]) -> List[RadarTipologia]:
    return [
        RadarTipologia(valor=t["valor"], rotulo=formatar_tipologia(t["valor"]), transacoes=t["transacoes"])
        for t in lista or []
    ]


def _transacao(t: dict) -> RadarTransacao:
    return RadarTransacao(
        competencia=t["competencia"],
        tipologia=formatar_tipologia(t["tipologia"]),
        complemento=formatar_complemento(t.get("complemento")),
        area=t["area"],
        valor_declarado=t["valor_declarado"],
        valor_m2=t.get("valor_m2"),
        parcial=t["parcial"],
    )


def _apelido(logradouro: dict) -> Optional[str]:
    """Busca pelo nome antigo de uma rua renomeada."""
    grafia = logradouro.get("grafia")
    return f"antiga {grafia}" if grafia and grafia != logradouro["nome"] else None


# ── Busca ───────────────────────────────────────────────────────────────────

@dataclass
class _Contexto:
    consulta: str
    tipologia: Optional[str]
    periodo: RadarPeriodo
    dados_ate: Optional[date]
    ordem: str
    pagina: int
    por_pagina: int

    @property
    def offset(self) -> int:
        return (self.pagina - 1) * self.por_pagina

    def filtros(self) -> dict:
        return {
            "p_desde": self.periodo.desde.isoformat() if self.periodo.desde else None,
            "p_ate": self.periodo.ate.isoformat() if self.periodo.ate else None,
            "p_tipologia": self.tipologia,
        }

    def saida(self, tipo: str, **campos) -> RadarBuscaOut:
        return RadarBuscaOut(
            tipo=tipo,
            consulta=self.consulta,
            periodo=self.periodo,
            dados_ate=self.dados_ate,
            pagina=self.pagina,
            por_pagina=self.por_pagina,
            **campos,
        )


def _predio(ctx: _Contexto, logradouro: dict, numero: int) -> RadarBuscaOut:
    dados = _rpc("radar_predio", {
        "p_cl": logradouro["cl"],
        "p_numero": numero,
        **ctx.filtros(),
        "p_limite": ctx.por_pagina,
        "p_offset": ctx.offset,
    }) or {}
    if not dados.get("total_historico"):
        return _numero_sem_venda(ctx, logradouro, numero)
    resumo = _resumo(dados.get("resumo"))
    bairro = dados.get("bairro")
    return ctx.saida(
        "predio",
        titulo=f"{logradouro['nome']}, {numero}",
        apelido=_apelido(logradouro),
        cl=logradouro["cl"],
        numero=numero,
        bairros=[bairro] if bairro else list(logradouro.get("bairros") or [])[:1],
        total_historico=dados["total_historico"],
        resumo=resumo,
        tipologias=_tipologias(dados.get("tipologias")),
        transacoes=[_transacao(t) for t in dados.get("transacoes") or []],
        total=resumo.transacoes,
    )


def _numero_sem_venda(ctx: _Contexto, logradouro: dict, numero: int) -> RadarBuscaOut:
    """A rua existe, mas o número não tem venda registrada."""
    proximos = _rpc("radar_numeros_proximos", {
        "p_cl": logradouro["cl"], "p_numero": numero, "p_limite": 6,
    }) or []
    return ctx.saida(
        "nenhum",
        titulo=f"{logradouro['nome']}, {numero}",
        apelido=_apelido(logradouro),
        cl=logradouro["cl"],
        numero=numero,
        bairros=list(logradouro.get("bairros") or []),
        numeros_proximos=proximos,
    )


def _rua(ctx: _Contexto, logradouro: dict) -> RadarBuscaOut:
    dados = _rpc("radar_rua", {
        "p_cl": logradouro["cl"],
        **ctx.filtros(),
        "p_ordem": ctx.ordem,
        "p_limite": ctx.por_pagina,
        "p_offset": ctx.offset,
    }) or {}
    return ctx.saida(
        "rua",
        titulo=logradouro["nome"],
        apelido=_apelido(logradouro),
        cl=logradouro["cl"],
        bairros=list(logradouro.get("bairros") or []),
        total_historico=dados.get("total_historico") or 0,
        resumo=_resumo(dados.get("resumo")),
        tipologias=_tipologias(dados.get("tipologias")),
        predios=[
            RadarPredio(
                numero=p["numero"],
                transacoes=p["transacoes"],
                media_m2=_arredondar(p.get("media_m2")),
                ultima=p["ultima"],
                tipologia=formatar_tipologia(p["tipologia"]),
            )
            for p in dados.get("predios") or []
        ],
        sem_numero=dados.get("sem_numero") or 0,
        total=dados.get("total_predios") or 0,
    )


def _bairro(ctx: _Contexto, chave: str, nome: str) -> RadarBuscaOut:
    dados = _rpc("radar_bairro", {
        "p_bairro": chave, **ctx.filtros(), "p_limite_ruas": LIMITE_RUAS_BAIRRO,
    }) or {}
    return ctx.saida(
        "bairro",
        titulo=nome,
        bairro=chave,
        bairros=[nome],
        total_historico=dados.get("total_historico") or 0,
        resumo=_resumo(dados.get("resumo")),
        tipologias=_tipologias(dados.get("tipologias")),
        por_tipologia=[
            RadarTipologiaResumo(
                valor=t["valor"],
                rotulo=formatar_tipologia(t["valor"]),
                transacoes=t["transacoes"],
                media_m2=_arredondar(t.get("media_m2")),
                media_valor=_arredondar(t.get("media_valor")),
                media_area=_arredondar(t.get("media_area")),
            )
            for t in dados.get("por_tipologia") or []
        ],
        ruas=[
            RadarRua(cl=r["cl"], nome=r["nome"], transacoes=r["transacoes"], media_m2=_arredondar(r.get("media_m2")))
            for r in dados.get("ruas") or []
        ],
    )


def _ambiguo(ctx: _Contexto, candidatos: list, numero: Optional[int]) -> RadarBuscaOut:
    return ctx.saida(
        "ambiguo",
        numero=numero,
        opcoes=[
            RadarOpcao(
                cl=c["cl"],
                nome=c["nome"],
                bairros=list(c.get("bairros") or [])[:3],
                transacoes=c["transacoes"],
                tem_numero=c.get("tem_numero"),
            )
            for c in candidatos
        ],
    )


def _sugestoes(consulta: ConsultaEndereco, limite: int) -> List[RadarSugestao]:
    """Bairros que começam pelo texto (até 3) e logradouros parecidos."""
    sugestoes: List[RadarSugestao] = []
    texto = consulta.texto
    if consulta.numero is None and not consulta.tem_tipo and len(texto) >= 2:
        bairros = sorted(
            (b for chave, b in _bairros().items() if f" {texto}" in f" {chave}"),
            key=lambda b: -b["transacoes"],
        )
        sugestoes += [
            RadarSugestao(
                tipo="bairro", rotulo=b["nome"], detalhe="Bairro", consulta=b["nome"],
                bairro=b["chave"], transacoes=b["transacoes"],
            )
            for b in bairros[:3]
        ]
    if len(consulta.chave) >= 2:
        for item in _rpc("radar_sugestoes", {"p_chave": consulta.chave, "p_limite": limite}) or []:
            detalhes = []
            if item.get("bairros"):
                detalhes.append(", ".join(item["bairros"][:2]))
            if item.get("grafia") and item["grafia"] != item["nome"]:
                detalhes.append(f"antiga {item['grafia']}")
            sugestoes.append(RadarSugestao(
                tipo="logradouro",
                rotulo=item["nome"],
                detalhe=" · ".join(detalhes) or None,
                consulta=f"{item['nome']}, {consulta.numero}" if consulta.numero else item["nome"],
                cl=item["cl"],
                transacoes=item["transacoes"],
            ))
    return sugestoes[:limite]


def _executar(
    ctx: _Contexto, q: str, cl: Optional[int], numero: Optional[int], bairro: Optional[str]
) -> RadarBuscaOut:
    # Escolha feita na página (opção de "ambíguo" ou item do autocomplete)
    if cl is not None:
        logradouro = _logradouro(cl)
        if not logradouro:
            return ctx.saida("nenhum")
        return _predio(ctx, logradouro, numero) if numero else _rua(ctx, logradouro)

    bairros = _bairros()
    if bairro:
        chave = texto_busca(bairro)
        if chave in bairros:
            return _bairro(ctx, chave, bairros[chave]["nome"])
        return ctx.saida("nenhum")

    consulta = interpretar_busca(q)
    # Bairro vem antes de rua: "Leblon" é o bairro, não a Rua Leblon.
    if consulta.numero is None and not consulta.tem_tipo and consulta.texto in bairros:
        return _bairro(ctx, consulta.texto, bairros[consulta.texto]["nome"])

    candidatos = (
        _rpc("radar_resolver", {"p_chave": consulta.chave, "p_numero": consulta.numero}) or []
        if consulta.chave else []
    )
    # "Praia de Botafogo" e "Rua Botafogo" têm a mesma chave; o tipo desempata.
    if consulta.tipo:
        candidatos = [c for c in candidatos if c.get("tipo") == consulta.tipo] or candidatos

    if candidatos and consulta.numero is None:
        return _rua(ctx, candidatos[0]) if len(candidatos) == 1 else _ambiguo(ctx, candidatos, None)
    if candidatos:
        com_numero = [c for c in candidatos if c.get("tem_numero")]
        if len(com_numero) == 1:
            return _predio(ctx, com_numero[0], consulta.numero)
        if len(candidatos) == 1:
            return _numero_sem_venda(ctx, candidatos[0], consulta.numero)
        return _ambiguo(ctx, com_numero or candidatos, consulta.numero)

    return ctx.saida("nenhum", numero=consulta.numero, sugestoes=_sugestoes(consulta, 6))


@router.get("/publico/busca", response_model=RadarBuscaOut)
# Mais folgado que os outros endpoints públicos: o site monta a página no
# servidor (Vercel), então visitantes diferentes chegam pelos mesmos IPs. Um
# pico (post no Instagram) com 60/min daria 429 para gente de verdade. As
# respostas ficam 1 h em cache, então o volume extra quase não chega ao banco.
@limiter.limit("300/minute")
def buscar(
    request: Request,
    response: Response,
    q: Optional[str] = Query(None, max_length=120, description='Prédio, rua ou bairro ("Vieira Souto 510", "Ipanema")'),
    cl: Optional[int] = Query(None, ge=1, description="Código do logradouro (escolha feita na página)"),
    numero: Optional[int] = Query(None, ge=1, le=999_999, description="Número do prédio, junto com cl"),
    bairro: Optional[str] = Query(None, max_length=80, description="Bairro (chave ou nome)"),
    tipologia: Optional[str] = Query(None, max_length=60, description='Filtro, ex.: "APARTAMENTO"'),
    desde: Optional[int] = Query(None, ge=2000, le=2100, description="Ano inicial"),
    ate: Optional[int] = Query(None, ge=2000, le=2100, description="Ano final"),
    todo_periodo: bool = Query(False, description="Ignora o padrão de 5 anos"),
    ordem: Literal["numero", "transacoes"] = Query("numero", description="Ordem dos prédios de uma rua"),
    pagina: int = Query(1, ge=1, le=1000),
    por_pagina: int = Query(20, ge=1, le=100),
):
    """Busca de vendas (ITBI) por prédio, rua ou bairro, com a média do período."""
    if not (q and q.strip()) and cl is None and not (bairro and bairro.strip()):
        raise HTTPException(status_code=422, detail="Informe um endereço, rua ou bairro.")
    if desde and ate and desde > ate:
        raise HTTPException(status_code=422, detail="O ano inicial é maior que o final.")

    response.headers["Cache-Control"] = _CACHE_HTTP
    tipologia_chave = texto_busca(tipologia) or None
    chave = (
        "busca", texto_busca(q), cl, numero, texto_busca(bairro), tipologia_chave,
        desde, ate, todo_periodo, ordem, pagina, por_pagina,
    )
    achou, resultado = _respostas.obter(chave)
    if not achou:
        dados_ate = _dados_ate()
        ctx = _Contexto(
            consulta=q or "",
            tipologia=tipologia_chave,
            periodo=calcular_periodo(dados_ate, desde, ate, todo_periodo),
            dados_ate=dados_ate,
            ordem=ordem,
            pagina=pagina,
            por_pagina=por_pagina,
        )
        resultado = _executar(ctx, q or "", cl, numero, bairro)
        _respostas.guardar(chave, resultado)
    # O cache é por texto normalizado; devolve o que o visitante digitou.
    return resultado.model_copy(update={"consulta": q or ""})


@router.get("/publico/sugestoes", response_model=List[RadarSugestao])
@limiter.limit("120/minute")
def sugerir(
    request: Request,
    response: Response,
    q: str = Query(..., min_length=2, max_length=120),
    limite: int = Query(8, ge=1, le=15),
):
    """Autocomplete de logradouros e bairros."""
    response.headers["Cache-Control"] = _CACHE_HTTP
    chave = ("sugestoes", texto_busca(q), limite)
    achou, resultado = _respostas.obter(chave)
    if not achou:
        resultado = _sugestoes(interpretar_busca(q), limite)
        _respostas.guardar(chave, resultado)
    return resultado


@router.get("/publico/info", response_model=RadarInfo)
@limiter.limit("60/minute")
def info(request: Request, response: Response):
    """Até quando vão os dados (rodapé da página)."""
    response.headers["Cache-Control"] = _CACHE_HTTP
    return RadarInfo(
        dados_ate=_dados_ate(),
        transacoes=sum(b["transacoes"] for b in _bairros().values()),
    )
