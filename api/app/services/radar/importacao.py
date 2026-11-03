"""Importação das planilhas de ITBI da Prefeitura do Rio para o Radar.

Fluxo de `importar`:

1. Lê a página da Fazenda e descobre os links das planilhas. A URL muda a cada
   atualização (a pasta do WordPress leva o mês do upload), então nunca fica
   fixa no código.
2. Baixa cada arquivo e calcula o sha256. Se todos batem com a última
   importação ok, registra "sem_mudancas" e para.
3. Lê as planilhas em streaming, normaliza e descarta linhas sem valor ou com
   área absurda. Cada linha ganha um hash dos campos da fonte.
4. Compara os hashes com o banco: insere só os novos e apaga os que sumiram da
   fonte (correção da Prefeitura). Se for apagar mais de 5% da base, aborta:
   um arquivo truncado é mais provável que uma revisão desse tamanho.
5. Regrava radar_logradouros com o nome de exibição de cada código `cl`.

Rodar de novo com os mesmos arquivos não muda nada no banco.
"""
from __future__ import annotations

import hashlib
import logging
import re
import sys
import time
from collections import Counter, defaultdict
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol
from urllib.parse import urljoin

import httpx

from app.services.radar.normalizacao import (
    chave_logradouro,
    codigo,
    formatar_bairro,
    formatar_logradouro,
    limpar_espacos,
    mesmo_nome,
    numero_imovel,
    para_numero,
    separar_tipo,
    tem_minuscula,
    texto_busca,
)
from app.services.radar.xlsx import ler_planilha

logger = logging.getLogger(__name__)

PAGINA_FONTE = (
    "https://fazenda.prefeitura.rio/"
    "itbi-valores-medios-por-m2-de-transacoes-imobiliarias-por-trecho-de-logradouro/"
)

# Só as planilhas de transações; a página também lista médias, IPTU e ISS.
_LINK_PLANILHA = re.compile(
    r"""href\s*=\s*["']([^"']*ITBI_TRANSACOES[^"']*\.xlsx)["']""", re.IGNORECASE
)

# Para os servidores do GitHub, a Prefeitura às vezes devolve outra coisa no
# lugar da página ou da planilha (daqui do Brasil vem sempre certo). Tenta de
# novo antes de desistir.
TENTATIVAS = 3
PAUSA = 30.0

# Acima disso a importação desconfia do arquivo e não apaga nada sem --forcar.
LIMITE_REMOCAO = 0.05

# ── Regras de descarte ──────────────────────────────────────────────────────
# Calibradas nas ~620 mil linhas de 2011 a set/2026. Os percentis 0,1% e 99,9%
# de apartamento ficam entre 16 e 525 m² e entre R$ 164 e R$ 45 mil/m²; os
# limites abaixo só pegam erro de digitação (área de 1 m² por R$ 48 milhões).
VALOR_MINIMO = 1_000.0
AREA_MINIMA = 5.0
AREA_MAXIMA_CONSTRUIDA = 200_000.0
AREA_MAXIMA_TERRENO = 10_000_000.0
VALOR_M2_MAXIMO = 300_000.0
VALOR_M2_MINIMO_CONSTRUIDO = 30.0
_TIPOLOGIAS_TERRENO = frozenset({"TERRENO", "ESPECIAL"})

# Nome canônico → nomes aceitos no cabeçalho. Os arquivos não concordam entre
# si: o de 2025 usa `bairro` e `vl_declarado`, os anteriores `nm_bairro_norm` e
# `valor_transacoes`. A comparação ignora maiúsculas.
COLUNAS: dict[str, tuple[str, ...]] = {
    "ano": ("ano",),
    "mes": ("mes",),
    "cd_bairro": ("cd_bairro",),
    "cl": ("cl",),
    "trecho": ("trecho",),
    "cod_tipologia": ("cod_tipologia",),
    "id_utilizacao": ("id_utilizacao",),
    "numero": ("numero",),
    "complemento": ("complemento",),
    "bairro": ("bairro", "nm_bairro_norm", "nm_bairro"),
    "logradouro": ("logradouro",),
    "tipologia": ("ds_imovel_tipologia", "tipologia"),
    "uso": ("descricao", "uso", "ds_utilizacao"),
    "parte_transferida": ("parte_transferida",),
    "valor": ("vl_declarado", "valor_transacoes", "valor_declarado"),
    "area": ("area",),
}
_OPCIONAIS = frozenset({"cd_bairro", "trecho", "cod_tipologia", "id_utilizacao", "complemento", "uso"})


class ErroImportacao(Exception):
    """Falha que impede a importação (página mudou, planilha sem coluna...)."""


class ImportacaoAbortada(ErroImportacao):
    """A trava de segurança barrou a importação (remoção acima do limite)."""


# ── Descoberta e download ───────────────────────────────────────────────────

def descobrir_links(html: str, base: str = PAGINA_FONTE) -> list[str]:
    """Links das planilhas de transações na página, sem repetição e em ordem."""
    links: list[str] = []
    for href in _LINK_PLANILHA.findall(html):
        url = urljoin(base, href.strip())
        if url not in links:
            links.append(url)
    return links


def _descrever_resposta(resposta: httpx.Response, corpo: bytes, tamanho: int | None = None) -> str:
    """Resumo do que o servidor devolveu, para o log dizer o que veio no lugar."""
    html = corpo.decode(resposta.encoding or "utf-8", errors="replace")
    titulo = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    texto = re.sub(r"<(script|style)\b.*?</\1>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    texto = " ".join(re.sub(r"<[^>]+>", " ", texto).split())
    return (
        f"HTTP {resposta.status_code} de {resposta.url}, "
        f"{resposta.headers.get('content-type', 'sem content-type')}, "
        f"{len(corpo) if tamanho is None else tamanho} bytes, "
        f"título {limpar_espacos(titulo.group(1)) if titulo else None!r}, "
        f"início do texto {texto[:300]!r}"
    )


def buscar_links(http: httpx.Client, tentativas: int = TENTATIVAS) -> list[str]:
    """Lê a página da Prefeitura e devolve os links das planilhas de transações.

    Repete quando a página vem sem links: para os servidores do GitHub, a
    Prefeitura às vezes responde 200 com outra coisa. Na última tentativa, o
    erro descreve a resposta recebida.
    """
    for tentativa in range(1, tentativas + 1):
        pagina = http.get(PAGINA_FONTE)
        pagina.raise_for_status()
        links = descobrir_links(pagina.text)
        if links:
            return links
        descricao = _descrever_resposta(pagina, pagina.content)
        if tentativa < tentativas:
            logger.warning("Página sem planilhas (tentativa %d): %s", tentativa, descricao)
            time.sleep(PAUSA)
    raise ErroImportacao(
        f"Nenhuma planilha ITBI_TRANSACOES encontrada em {PAGINA_FONTE} "
        f"após {tentativas} tentativas. Resposta: {descricao}"
    )


@dataclass(frozen=True)
class Arquivo:
    url: str
    caminho: Path
    sha256: str
    bytes: int

    def resumo(self) -> dict:
        return {"url": self.url, "sha256": self.sha256, "bytes": self.bytes}


def sha256_arquivo(caminho: Path) -> str:
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def baixar(url: str, pasta: Path, http: httpx.Client, tentativas: int = TENTATIVAS) -> Arquivo:
    """Baixa a planilha, repetindo quando vem outra coisa no lugar do .xlsx."""
    nome = Path(url.split("?", 1)[0]).name or "planilha.xlsx"
    destino = pasta / nome
    for tentativa in range(1, tentativas + 1):
        h = hashlib.sha256()
        tamanho = 0
        with http.stream("GET", url) as resposta:
            resposta.raise_for_status()
            with open(destino, "wb") as f:
                for bloco in resposta.iter_bytes(1 << 20):
                    f.write(bloco)
                    h.update(bloco)
                    tamanho += len(bloco)
        with open(destino, "rb") as f:
            inicio = f.read(64 * 1024)
        if inicio[:2] == b"PK":
            logger.info("Baixado %s (%.1f MB)", nome, tamanho / 1e6)
            return Arquivo(url=url, caminho=destino, sha256=h.hexdigest(), bytes=tamanho)
        descricao = _descrever_resposta(resposta, inicio, tamanho)
        if tentativa < tentativas:
            logger.warning("Download sem .xlsx (tentativa %d): %s", tentativa, descricao)
            time.sleep(PAUSA)
    raise ErroImportacao(
        f"{url} não devolveu um .xlsx após {tentativas} tentativas. Resposta: {descricao}"
    )


# ── Leitura ─────────────────────────────────────────────────────────────────

def mapear_colunas(cabecalho: Iterable[str]) -> dict[str, str]:
    """Nome canônico → nome real da coluna neste arquivo."""
    por_minuscula = {c.strip().lower(): c for c in cabecalho}
    mapa: dict[str, str] = {}
    for campo, aceitos in COLUNAS.items():
        for nome in aceitos:
            if nome in por_minuscula:
                mapa[campo] = por_minuscula[nome]
                break
    faltando = [c for c in COLUNAS if c not in mapa and c not in _OPCIONAIS]
    if faltando:
        raise ErroImportacao(
            f"Planilha sem as colunas {faltando}. Cabeçalho: {list(por_minuscula)}"
        )
    return mapa


@dataclass(slots=True)
class LinhaFonte:
    """Uma transação válida, como veio da fonte (antes de resolver bairro e uso)."""
    chave: str            # campos da fonte que identificam a linha
    competencia: str      # "2025-01-01"
    cl: int
    trecho: int | None
    numero: int | None
    complemento: str
    cd_bairro: str
    bairro: str           # texto_busca do bairro da fonte (pode vir vazio)
    tipologia: str
    id_utilizacao: str
    uso: str
    parte_transferida: float
    valor: float
    area: float
    hash: str = ""


def interpretar_linha(bruta: dict[str, str], colunas: dict[str, str]) -> tuple[LinhaFonte | None, str, str]:
    """Converte uma linha da planilha.

    Retorna (linha, logradouro da fonte, motivo do descarte). Sem descarte, o
    motivo é vazio; descartada, a linha é None.
    """
    def campo(nome: str) -> str:
        coluna = colunas.get(nome)
        return bruta.get(coluna, "") if coluna else ""

    ano, mes = para_numero(campo("ano")), para_numero(campo("mes"))
    if not ano or not mes or not (2000 <= ano <= 2100) or not (1 <= mes <= 12):
        return None, "", "data_invalida"

    cl_texto = codigo(campo("cl"))
    if not cl_texto.isdigit():
        return None, "", "sem_logradouro"

    valor = para_numero(campo("valor"))
    if valor is None or valor < VALOR_MINIMO:
        return None, "", "sem_valor"
    area = para_numero(campo("area"))
    if area is None or area <= 0:
        return None, "", "sem_area"

    tipologia = sys.intern(texto_busca(campo("tipologia")) or "NAO INFORMADA")
    uso = sys.intern(texto_busca(campo("uso")))
    terreno = tipologia in _TIPOLOGIAS_TERRENO or uso == "TERRITORIAL"
    area_maxima = AREA_MAXIMA_TERRENO if terreno else AREA_MAXIMA_CONSTRUIDA
    if area < AREA_MINIMA or area > area_maxima:
        return None, "", "area_absurda"

    # Sem a coluna, vale o caso de praticamente todas as linhas: 100%.
    parte = para_numero(campo("parte_transferida"))
    if parte is None or parte <= 0 or parte > 100:
        parte = 100.0
    valor_m2_inteiro = valor / (parte / 100) / area
    if valor_m2_inteiro > VALOR_M2_MAXIMO or (
        not terreno and valor_m2_inteiro < VALOR_M2_MINIMO_CONSTRUIDO
    ):
        return None, "", "valor_m2_absurdo"

    competencia = sys.intern(f"{int(ano):04d}-{int(mes):02d}-01")
    cl = int(cl_texto)
    trecho_num = para_numero(campo("trecho"))
    trecho = int(trecho_num) if trecho_num is not None and 0 <= trecho_num < 32_000 else None
    numero = numero_imovel(campo("numero"))
    complemento = limpar_espacos(campo("complemento")).upper()
    cd_bairro = sys.intern(codigo(campo("cd_bairro")))
    bairro = sys.intern(texto_busca(campo("bairro")))
    cod_tipologia = codigo(campo("cod_tipologia"))
    id_utilizacao = sys.intern(codigo(campo("id_utilizacao")))

    # Identidade da linha: códigos e números já convertidos, não o texto
    # formatado. "100,00" e "100" dão a mesma chave, e o arquivo de 2025
    # abreviar o nome da rua não muda nada, porque entra o código `cl`.
    chave = "|".join((
        competencia, str(cl), str(trecho or ""), cd_bairro or bairro,
        str(numero or ""), texto_busca(complemento), cod_tipologia or tipologia,
        id_utilizacao or uso, f"{parte:.2f}", f"{valor:.2f}", f"{area:.2f}",
    ))
    linha = LinhaFonte(
        chave=chave, competencia=competencia, cl=cl, trecho=trecho, numero=numero,
        complemento=complemento, cd_bairro=cd_bairro, bairro=bairro,
        tipologia=tipologia, id_utilizacao=id_utilizacao, uso=uso,
        parte_transferida=parte, valor=valor, area=area,
    )
    return linha, campo("logradouro"), ""


@dataclass
class _Grafia:
    contagem: int = 0
    ultima: str = ""  # competência mais recente em que apareceu


@dataclass
class Leitura:
    """Resultado da leitura de todas as planilhas, pronto para sincronizar."""
    linhas: list[LinhaFonte] = field(default_factory=list)
    linhas_lidas: int = 0
    descartes: Counter = field(default_factory=Counter)
    grafias: dict[int, dict[str, _Grafia]] = field(
        default_factory=lambda: defaultdict(lambda: defaultdict(_Grafia))
    )
    _bairros_por_codigo: dict[str, Counter] = field(default_factory=lambda: defaultdict(Counter))
    _usos_por_codigo: dict[str, Counter] = field(default_factory=lambda: defaultdict(Counter))

    def adicionar(self, linha: LinhaFonte, logradouro: str, ocorrencias: Counter) -> None:
        # Linhas idênticas em tudo existem na fonte (~2,4 mil). Ficam todas,
        # por fidelidade aos dados oficiais, e o número de ordem entra no hash
        # para que continuem distintas e a reimportação siga idempotente.
        ocorrencias[linha.chave] += 1
        texto = f"{linha.chave}#{ocorrencias[linha.chave]}"
        linha.hash = hashlib.sha256(texto.encode("utf-8")).hexdigest()[:32]
        self.linhas.append(linha)

        nome = limpar_espacos(logradouro)
        if nome:
            grafia = self.grafias[linha.cl][nome]
            grafia.contagem += 1
            grafia.ultima = max(grafia.ultima, linha.competencia)
        if linha.cd_bairro and linha.bairro:
            self._bairros_por_codigo[linha.cd_bairro][linha.bairro] += 1
        if linha.id_utilizacao and linha.uso:
            self._usos_por_codigo[linha.id_utilizacao][linha.uso] += 1

    @property
    def dados_ate(self) -> str | None:
        return max((l.competencia for l in self.linhas), default=None)

    def _bairro(self, linha: LinhaFonte) -> str:
        """Bairro vazio na fonte (~190 linhas) é recuperado pelo código."""
        if linha.bairro:
            return linha.bairro
        candidatos = self._bairros_por_codigo.get(linha.cd_bairro)
        return candidatos.most_common(1)[0][0] if candidatos else "NAO INFORMADO"

    def _uso(self, linha: LinhaFonte) -> str | None:
        if linha.uso:
            return linha.uso
        candidatos = self._usos_por_codigo.get(linha.id_utilizacao)
        return candidatos.most_common(1)[0][0] if candidatos else None

    def para_banco(self, linha: LinhaFonte) -> dict:
        bairro = self._bairro(linha)
        parcial = linha.parte_transferida < 99.995
        return {
            "hash": linha.hash,
            "competencia": linha.competencia,
            "cl": linha.cl,
            "trecho": linha.trecho,
            "numero": linha.numero,
            "complemento": linha.complemento or None,
            "bairro": formatar_bairro(bairro),
            "bairro_busca": bairro,
            "tipologia": linha.tipologia,
            "uso": self._uso(linha),
            "parte_transferida": round(linha.parte_transferida, 2),
            "parcial": parcial,
            "valor_declarado": round(linha.valor, 2),
            "area": round(linha.area, 2),
            # Transmissão parcial: o valor é de uma fração, não da área toda.
            "valor_m2": None if parcial else round(linha.valor / linha.area, 2),
        }

    def bairros(self, importacao_id: int) -> list[dict]:
        """Linhas de radar_bairros_resumo. A busca reconhece "Ipanema" por aqui;
        contar as ~620 mil linhas a cada busca passava do limite de tempo."""
        contagem = Counter(self._bairro(linha) for linha in self.linhas)
        return [
            {"chave": b, "nome": formatar_bairro(b), "transacoes": n, "importacao_id": importacao_id}
            for b, n in contagem.most_common()
        ]

    def logradouros(self, importacao_id: int) -> tuple[list[dict], list[dict]]:
        """Linhas de radar_logradouros e radar_logradouro_nomes."""
        bairros: dict[int, Counter] = defaultdict(Counter)
        predios: dict[int, set] = defaultdict(set)
        transacoes: Counter = Counter()
        for linha in self.linhas:
            transacoes[linha.cl] += 1
            bairros[linha.cl][self._bairro(linha)] += 1
            if linha.numero:
                predios[linha.cl].add(linha.numero)

        logradouros: list[dict] = []
        nomes: list[dict] = []
        for cl in sorted(transacoes):
            exibicao, grafias = resolver_logradouro(self.grafias.get(cl, {}))
            exibicao = exibicao or f"Logradouro {cl}"
            logradouros.append({
                "cl": cl,
                "tipo": separar_tipo(exibicao)[0],
                "nome": exibicao,
                "nome_busca": chave_logradouro(exibicao),
                "bairros": [formatar_bairro(b) for b, _ in bairros[cl].most_common()],
                "transacoes": transacoes[cl],
                "predios": len(predios[cl]),
                "importacao_id": importacao_id,
            })
            grafias.setdefault(chave_logradouro(exibicao), exibicao)
            for nome_busca, nome in grafias.items():
                if nome_busca:
                    nomes.append({
                        "cl": cl, "nome_busca": nome_busca, "nome": nome,
                        "importacao_id": importacao_id,
                    })
        return logradouros, nomes


def resolver_logradouro(grafias: dict[str, _Grafia]) -> tuple[str, dict[str, str]]:
    """Nome de exibição de um código `cl` e as grafias para a busca.

    O nome atual é a grafia mais recente. Se ela veio abreviada e em maiúsculas
    (arquivo de 2025), mas um arquivo antigo tem o mesmo nome por extenso, vale
    o por extenso: "AVN VIEIRA SOUTO" aparece como "Avenida Vieira Souto". Rua
    renomeada fica com o nome novo, e o antigo vira um apelido de busca.

    Retorna (exibição, {chave: nome}). O nome de uma chave antiga é a grafia
    antiga, para a API poder dizer "antiga Rua Sobreiro".
    """
    if not grafias:
        return "", {}
    ordem = sorted(grafias, key=lambda n: (grafias[n].ultima, grafias[n].contagem), reverse=True)
    atual = ordem[0]
    if tem_minuscula(atual):
        exibicao = atual
    else:
        por_extenso = [n for n in ordem if tem_minuscula(n) and mesmo_nome(n, atual)]
        exibicao = por_extenso[0] if por_extenso else formatar_logradouro(atual)

    nomes: dict[str, str] = {}
    for nome in ordem:
        chave = chave_logradouro(nome)
        if chave and chave not in nomes:
            nomes[chave] = exibicao if mesmo_nome(nome, atual) else formatar_logradouro(nome)
    return exibicao, nomes


def ler_planilhas(caminhos: Iterable[Path]) -> Leitura:
    leitura = Leitura()
    ocorrencias: Counter = Counter()
    for caminho in caminhos:
        linhas = ler_planilha(caminho)
        primeira = next(linhas, None)
        if primeira is None:
            raise ErroImportacao(f"{caminho}: planilha vazia")
        colunas = mapear_colunas(primeira.keys())
        lidas_antes = leitura.linhas_lidas
        for bruta in _encadear(primeira, linhas):
            leitura.linhas_lidas += 1
            linha, logradouro, motivo = interpretar_linha(bruta, colunas)
            if linha is None:
                leitura.descartes[motivo] += 1
            else:
                leitura.adicionar(linha, logradouro, ocorrencias)
        logger.info("Lido %s: %d linhas", Path(caminho).name, leitura.linhas_lidas - lidas_antes)
    return leitura


def _encadear(primeira: dict, resto: Iterator[dict]) -> Iterator[dict]:
    yield primeira
    yield from resto


# ── Banco ───────────────────────────────────────────────────────────────────

class Repositorio(Protocol):
    def ultima_importacao_ok(self) -> dict | None: ...
    def abrir_importacao(self, status: str, arquivos: list[dict]) -> int: ...
    def concluir_importacao(self, importacao_id: int, campos: dict) -> None: ...
    def listar_hashes(self) -> set[str]: ...
    def gravar_transacoes(self, linhas: Iterable[dict], sobrescrever: bool) -> None: ...
    def remover_hashes(self, hashes: list[str]) -> int: ...
    def marcar_fracoes(self) -> int: ...
    def gravar_logradouros(self, logradouros: list[dict], nomes: list[dict]) -> None: ...
    def gravar_bairros(self, bairros: list[dict]) -> None: ...
    def limpar_logradouros(self, importacao_id: int) -> None: ...


def sincronizar(
    repo: Repositorio,
    leitura: Leitura,
    importacao_id: int,
    *,
    forcar: bool = False,
    reprocessar: bool = False,
) -> dict:
    """Deixa o banco igual à fonte: insere hashes novos e apaga os que sumiram."""
    fonte = {l.hash for l in leitura.linhas}
    existentes = repo.listar_hashes()
    novos = fonte - existentes
    orfaos = existentes - fonte
    logger.info(
        "Fonte: %d linhas válidas. Banco: %d. Novas: %d. Removidas da fonte: %d.",
        len(fonte), len(existentes), len(novos), len(orfaos),
    )
    if existentes and len(orfaos) > LIMITE_REMOCAO * len(existentes) and not forcar:
        raise ImportacaoAbortada(
            f"A importação apagaria {len(orfaos)} de {len(existentes)} transações "
            f"(mais de {LIMITE_REMOCAO:.0%}). Confira os arquivos e rode com --forcar "
            "se a Prefeitura realmente revisou a base."
        )

    alvo = leitura.linhas if reprocessar else [l for l in leitura.linhas if l.hash in novos]
    repo.gravar_transacoes((leitura.para_banco(l) for l in alvo), sobrescrever=reprocessar)
    removidas = repo.remover_hashes(sorted(orfaos)) if orfaos else 0
    # Fração ideal de lançamento (terreno com a área do lote inteiro) perde o
    # R$/m². A regra fica no banco (migration 057) e olha a base toda, porque
    # um lançamento cruza o limite aos poucos, importação após importação.
    fracoes = repo.marcar_fracoes()

    logradouros, nomes = leitura.logradouros(importacao_id)
    repo.gravar_logradouros(logradouros, nomes)
    repo.gravar_bairros(leitura.bairros(importacao_id))
    repo.limpar_logradouros(importacao_id)
    return {
        "novas": len(novos),
        "removidas": removidas,
        "fracoes_marcadas": fracoes,
        "logradouros": len(logradouros),
    }


def _agora() -> str:
    return datetime.now(timezone.utc).isoformat()


def importar(
    repo: Repositorio | None,
    http: httpx.Client,
    pasta: Path,
    *,
    arquivos_locais: list[Path] | None = None,
    forcar: bool = False,
    reprocessar: bool = False,
    simular: bool = False,
) -> dict:
    """Roda a importação completa. Com `simular`, lê tudo e não toca no banco."""
    if arquivos_locais:
        arquivos = [
            Arquivo(url=str(p), caminho=p, sha256=sha256_arquivo(p), bytes=p.stat().st_size)
            for p in arquivos_locais
        ]
    else:
        links = buscar_links(http)
        logger.info("Planilhas encontradas: %s", ", ".join(links))
        arquivos = [baixar(url, pasta, http) for url in links]
    resumo_arquivos = [a.resumo() for a in arquivos]

    if repo is not None and not simular and not (forcar or reprocessar):
        ultima = repo.ultima_importacao_ok()
        anteriores = sorted(a.get("sha256", "") for a in (ultima or {}).get("arquivos") or [])
        if ultima and anteriores == sorted(a.sha256 for a in arquivos):
            importacao_id = repo.abrir_importacao("sem_mudancas", resumo_arquivos)
            repo.concluir_importacao(importacao_id, {"status": "sem_mudancas", "concluida_em": _agora()})
            logger.info("Nenhuma planilha mudou desde a importação %s.", ultima.get("id"))
            return {"status": "sem_mudancas"}

    leitura = ler_planilhas(a.caminho for a in arquivos)
    resultado = {
        "linhas_lidas": leitura.linhas_lidas,
        "linhas_validas": len(leitura.linhas),
        "descartes": dict(leitura.descartes),
        "dados_ate": leitura.dados_ate,
    }
    logger.info(
        "Leitura: %d linhas, %d válidas, descartes %s, dados até %s.",
        leitura.linhas_lidas, len(leitura.linhas), dict(leitura.descartes), leitura.dados_ate,
    )
    if simular or repo is None:
        return {"status": "simulado", **resultado}

    importacao_id = repo.abrir_importacao("rodando", resumo_arquivos)
    try:
        sincronizado = sincronizar(
            repo, leitura, importacao_id, forcar=forcar, reprocessar=reprocessar
        )
    except Exception as exc:
        repo.concluir_importacao(
            importacao_id,
            {"status": "erro", "erro": str(exc)[:2000], "concluida_em": _agora()},
        )
        raise
    repo.concluir_importacao(importacao_id, {
        "status": "ok",
        "concluida_em": _agora(),
        "linhas_lidas": leitura.linhas_lidas,
        "linhas_validas": len(leitura.linhas),
        "descartes": dict(leitura.descartes),
        "novas": sincronizado["novas"],
        "removidas": sincronizado["removidas"],
        "dados_ate": leitura.dados_ate,
    })
    return {"status": "ok", "importacao_id": importacao_id, **resultado, **sincronizado}
