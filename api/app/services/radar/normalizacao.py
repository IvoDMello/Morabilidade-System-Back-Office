"""Normalização dos textos e números das planilhas de ITBI da Prefeitura do Rio.

Funções puras (sem I/O), usadas nos dois lados da busca do Radar: a importação
gera a chave de cada logradouro e a API normaliza o que o visitante digita com
as mesmas regras. Assim "AVN VIEIRA SOUTO" (arquivo de 2025), "Avenida Vieira
Souto" (arquivos até 2024) e "av. vieira souto" (visitante) viram a mesma
chave, "VIEIRA SOUTO".

A chave descarta o tipo do logradouro e as preposições, expande os títulos
abreviados (o arquivo de 2025 escreve "RUA CAP GOUVEIA" e "RUA DE BARAO
PIRAQUARA") e unifica grafias que a Prefeitura alterna (LUIZ/LUIS, SOUZA/SOUSA).
"""
from __future__ import annotations

import math
import re
import unicodedata
from difflib import SequenceMatcher

_ESCAPE_EXCEL = re.compile(r"_x([0-9A-Fa-f]{4})_")


def decodificar_excel(texto: str | None) -> str:
    """Desfaz o escape `_xHHHH_` do Excel (`_x0020_` é espaço).

    Nestas planilhas ele aparece até no primeiro dígito dos números: o número
    388 vem como `_x0033_88`. O `re.sub` não reprocessa o texto já substituído,
    então `_x005F_x0020_` (sublinhado escapado) sai como `_x0020_`, que é o certo.
    """
    if not texto:
        return ""
    return _ESCAPE_EXCEL.sub(lambda m: chr(int(m.group(1), 16)), texto)


def limpar_espacos(texto: str | None) -> str:
    return " ".join((texto or "").split())


def sem_acento(texto: str) -> str:
    decomposto = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in decomposto if not unicodedata.combining(c))


def texto_busca(texto: str | None) -> str:
    """Maiúsculas, sem acento, só letras e dígitos separados por um espaço."""
    return re.sub(r"[^A-Z0-9]+", " ", sem_acento(texto or "").upper()).strip()


# ── Números ─────────────────────────────────────────────────────────────────

def para_numero(texto: str | None) -> float | None:
    """Converte valor, área ou parte transferida. Aceita "150337.5", "100,00",
    "1.234,56" e "100,". Vazio ou inválido vira None."""
    s = decodificar_excel(texto).strip().replace(" ", "")
    if not s:
        return None
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    else:
        s = s.replace(",", ".")
    try:
        valor = float(s)
    except ValueError:
        return None
    return valor if math.isfinite(valor) else None


def numero_imovel(texto: str | None) -> int | None:
    """Número do imóvel no logradouro. "0", "-1" e vazio viram None."""
    m = re.match(r"\s*(\d{1,6})", decodificar_excel(texto))
    if not m:
        return None
    numero = int(m.group(1))
    return numero or None


_NUMERO_DA_UNIDADE = re.compile(r"([0-9]+)([A-Z]?)")


def tokens_unidade(texto: str | None) -> tuple[str, ...]:
    """Identificadores de uma unidade: os números do complemento, sem zeros à
    esquerda e sem ordem. "BL-001 APTO 0801", "bloco 1 apto 801" e "apto 801
    bl 1" dão ("1", "801"). Número com letra ("1201B") vale também sem ela, e
    cobertura vira "COB".

    Espelha radar_tokens_unidade (migration 059), que faz o mesmo com o
    complemento gravado; a busca exige que a unidade tenha todos os tokens
    digitados.
    """
    normal = texto_busca(texto)
    tokens: set[str] = set()
    for digitos, letra in _NUMERO_DA_UNIDADE.findall(normal):
        numero = str(int(digitos))
        tokens.add(numero)
        if letra:
            tokens.add(numero + letra)
    if any(p.startswith("COB") for p in normal.split()):
        tokens.add("COB")
    return tuple(sorted(tokens))


def codigo(texto: str | None) -> str:
    """Código numérico da fonte ("02" e "2" são o mesmo); texto se não for número."""
    s = decodificar_excel(texto).strip()
    return str(int(s)) if s.isdigit() else texto_busca(s)


# ── Logradouros ─────────────────────────────────────────────────────────────

_TIPOS_E_ABREVIACOES: dict[str, tuple[str, ...]] = {
    "RUA": ("R",),
    "AVENIDA": ("AV", "AVN", "AVE", "AVDA"),
    "ESTRADA": ("EST", "ESTR", "ETR"),
    "PRACA": ("PCA", "PC", "PRC"),
    "PRAIA": (),
    "TRAVESSA": ("TV", "TRV", "TRAV"),
    "LARGO": ("LG", "LGO", "LRG"),
    "LADEIRA": ("LD", "LAD"),
    "CAMINHO": ("CAM",),
    "BECO": ("BC", "BEC"),
    "SERVIDAO": ("SERV", "SRV"),
    "BOULEVARD": ("BLV", "BLVD"),
    "VILA": ("VIL",),
    "VIA": (),
    "ALAMEDA": ("AL",),
    "RODOVIA": ("ROD",),
    "CAMPO": (),
}

# Abreviação (da Prefeitura ou de quem digita) → tipo canônico.
TIPOS_LOGRADOURO: dict[str, str] = {
    abrev: tipo
    for tipo, abrevs in _TIPOS_E_ABREVIACOES.items()
    for abrev in (tipo, *abrevs)
}

# "PRA" é ambíguo na fonte: PRA BOTAFOGO é Praia de Botafogo e PRA DOS TAMOIOS
# é Praça dos Tamoios. Conta como tipo (sai da chave), mas sem dizer qual.
TIPOS_AMBIGUOS = frozenset({"PRA"})

NOME_DO_TIPO: dict[str, str] = {
    "RUA": "Rua", "AVENIDA": "Avenida", "ESTRADA": "Estrada", "PRACA": "Praça",
    "PRAIA": "Praia", "TRAVESSA": "Travessa", "LARGO": "Largo",
    "LADEIRA": "Ladeira", "CAMINHO": "Caminho", "BECO": "Beco",
    "SERVIDAO": "Servidão", "BOULEVARD": "Boulevard", "VILA": "Vila",
    "VIA": "Via", "ALAMEDA": "Alameda", "RODOVIA": "Rodovia", "CAMPO": "Campo",
}

# Títulos abreviados. Os pares saíram da comparação entre o mesmo código de
# logradouro nos arquivos até 2024 (por extenso) e no de 2025 (abreviado).
ABREVIACOES: dict[str, str] = {
    "GAL": "GENERAL", "GEN": "GENERAL",
    "MAL": "MARECHAL",
    "ALM": "ALMIRANTE", "ALMTE": "ALMIRANTE",
    "BRIG": "BRIGADEIRO",
    "CEL": "CORONEL",
    "CAP": "CAPITAO", "CAPT": "CAPITAO",
    "TEN": "TENENTE", "TTE": "TENENTE",
    "SARG": "SARGENTO", "SGT": "SARGENTO",
    "SOLD": "SOLDADO",
    "CMTE": "COMANDANTE", "COMTE": "COMANDANTE",
    "PROF": "PROFESSOR", "PROFA": "PROFESSORA",
    "ENG": "ENGENHEIRO", "ENGEN": "ENGENHEIRO",
    "DR": "DOUTOR", "DRA": "DOUTORA",
    "PRES": "PRESIDENTE", "PRESID": "PRESIDENTE",
    "SEN": "SENADOR", "SENAD": "SENADOR",
    "DEP": "DEPUTADO",
    "VER": "VEREADOR",
    "MIN": "MINISTRO", "MINIST": "MINISTRO",
    "DES": "DESEMBARGADOR", "DESEMB": "DESEMBARGADOR",
    "CONS": "CONSELHEIRO", "CONSEL": "CONSELHEIRO",
    "EMBAIX": "EMBAIXADOR",
    "COMEND": "COMENDADOR",
    "JORN": "JORNALISTA",
    "MTO": "MAESTRO",
    "MONS": "MONSENHOR", "MONSEN": "MONSENHOR",
    "REV": "REVERENDO", "REVER": "REVERENDO",
    "PE": "PADRE",
    "FR": "FREI",
    "VISC": "VISCONDE",
    "MARQ": "MARQUES", "MQ": "MARQUES",
    "BAR": "BARAO",
    "CDE": "CONDE",
    "DQ": "DUQUE",
    "STA": "SANTA", "STO": "SANTO",
    "SRA": "SENHORA",
    "NSA": "NOSSA",
    "NS": "NOSSA SENHORA",
}

# Grafias que a Prefeitura alterna para o mesmo nome. Só entram na chave.
_GRAFIAS: dict[str, str] = {
    "LUIZ": "LUIS",
    "SOUZA": "SOUSA",
    "CORREIA": "CORREA",
    "MANOEL": "MANUEL",
    "EUZEBIO": "EUSEBIO",
    "TEREZA": "TERESA",
    "THEREZA": "TERESA",
    "PROFESSORA": "PROFESSOR",
    "DOUTORA": "DOUTOR",
}

_CONECTIVOS = frozenset({"DE", "DA", "DO", "DAS", "DOS", "E", "D"})


def separar_tipo(texto: str) -> tuple[str | None, bool, list[str]]:
    """Separa o tipo do logradouro do nome.

    Retorna (tipo canônico ou None, se havia tipo, palavras do nome). O tipo só
    é reconhecido na primeira palavra e quando sobra nome depois dele: "Rua A"
    tem tipo, "Rua" sozinho é nome.
    """
    palavras = texto_busca(texto).split()
    if len(palavras) >= 2:
        primeira = palavras[0]
        if primeira in TIPOS_AMBIGUOS:
            return None, True, palavras[1:]
        if primeira in TIPOS_LOGRADOURO:
            return TIPOS_LOGRADOURO[primeira], True, palavras[1:]
    return None, False, palavras


def palavras_chave(palavras: list[str], expandir: bool = True) -> list[str]:
    """Expande abreviações, unifica grafias e tira as preposições."""
    expandidas: list[str] = []
    i = 0
    while i < len(palavras):
        palavra = palavras[i]
        seguinte = palavras[i + 1] if i + 1 < len(palavras) else None
        # "N S" e "N SRA" (de "N/S" ou "N. Sra.") são Nossa Senhora
        if palavra == "N" and seguinte in ("S", "SRA", "SENHORA"):
            expandidas += ["NOSSA", "SENHORA"]
            i += 2
            continue
        for parte in (ABREVIACOES.get(palavra, palavra) if expandir else palavra).split():
            expandidas.append(_GRAFIAS.get(parte, parte))
        i += 1
    sem_conectivos = [p for p in expandidas if p not in _CONECTIVOS]
    # "Rua E" e "Rua D" existem: se só sobrou preposição, ela é o nome.
    return sem_conectivos or expandidas


def sem_qualificador(nome: str) -> str:
    """Tira o qualificador entre parênteses que o arquivo de 2025 põe no fim
    ("Rua Ivan Lessa (Escritor)", às vezes cortado: "(Ag da Estacao")."""
    return re.sub(r"\s*\(.*$", "", nome).strip() or nome


def chave_logradouro(texto: str, expandir: bool = True) -> str:
    """Chave de comparação: "Avenida Vieira Souto" → "VIEIRA SOUTO".

    `expandir=False` mantém as abreviações como vieram. Serve para comparar
    grafias quando a abreviação é ambígua: "MTO" é Maestro numa rua e
    Motorista em outra.
    """
    return " ".join(palavras_chave(separar_tipo(sem_qualificador(texto))[2], expandir))


def _abrevia(curta: str, longa: str) -> bool:
    """"MTO" abrevia "MOTORISTA": mesma inicial e as letras aparecem na ordem.
    Cobre também o prefixo ("CASTILHO" e "CASTILHOS")."""
    if not curta or len(curta) > len(longa) or curta[0] != longa[0]:
        return False
    letras = iter(longa)
    return all(c in letras for c in curta)


def _alinhar(pa: list[str], pb: list[str]) -> bool:
    """Palavra a palavra, uma abreviando a outra. Uma abreviação pode cobrir
    duas palavras ("TTECEL" é "TENENTE CORONEL")."""
    i = j = 0
    while i < len(pa) and j < len(pb):
        a, b = pa[i], pb[j]
        if a == b or _abrevia(a, b) or _abrevia(b, a):
            i, j = i + 1, j + 1
        elif j + 1 < len(pb) and _abrevia(a, b + pb[j + 1]):
            i, j = i + 1, j + 2
        elif i + 1 < len(pa) and _abrevia(b, a + pa[i + 1]):
            i, j = i + 2, j + 1
        else:
            return False
    return i == len(pa) and j == len(pb)


def mesmo_logradouro(chave_a: str, chave_b: str) -> bool:
    """Se duas chaves são o mesmo nome escrito de jeitos diferentes.

    Cobre abreviação que escapou do dicionário ("MARIO A XAVIER SOBRINHO" e
    "MARIO AUGUSTO XAVIER SOBRINHO") e pequenas diferenças de grafia. Rua
    renomeada ("SOBREIRO" e "PAULO FRANCHINI") não passa.
    """
    if chave_a == chave_b:
        return True
    pa, pb = chave_a.split(), chave_b.split()
    if pa and pb and _alinhar(pa, pb):
        return True
    return SequenceMatcher(None, chave_a, chave_b).ratio() >= 0.85


def mesmo_nome(nome_a: str, nome_b: str) -> bool:
    """`mesmo_logradouro` sobre os nomes completos, com e sem expandir as
    abreviações (a expansão pelo dicionário pode errar quando é ambígua)."""
    return mesmo_logradouro(chave_logradouro(nome_a), chave_logradouro(nome_b)) or (
        mesmo_logradouro(chave_logradouro(nome_a, False), chave_logradouro(nome_b, False))
    )


# ── Exibição ────────────────────────────────────────────────────────────────

# Palavras que chegam sem acento (arquivo de 2025 e nomes de bairro).
_ACENTOS: dict[str, str] = {
    "ABOLICAO": "Abolição", "AGUA": "Água", "ALEMAO": "Alemão",
    "ALVARO": "Álvaro", "AMERICA": "América", "ANDARAI": "Andaraí",
    "ANTONIO": "Antônio", "ATLANTICA": "Atlântica", "BANCARIOS": "Bancários",
    "BARAO": "Barão", "BOCAIUVA": "Bocaiúva", "BOTANICO": "Botânico",
    "CAMARA": "Câmara", "CAPITAO": "Capitão", "COCOTA": "Cocotá",
    "COLEGIO": "Colégio", "COLUMBIA": "Colúmbia", "CONCEICAO": "Conceição",
    "CRISTOVAO": "Cristóvão", "EPITACIO": "Epitácio", "ESTACIO": "Estácio",
    "GALEAO": "Galeão", "GARDENIA": "Gardênia", "GAVEA": "Gávea",
    "GLORIA": "Glória", "GRACA": "Graça", "GRAJAU": "Grajaú",
    "HIGIENOPOLIS": "Higienópolis", "HONORIO": "Honório", "HUMAITA": "Humaitá",
    "INHAUMA": "Inhaúma", "IRAJA": "Irajá", "ITANHANGA": "Itanhangá",
    "JACARE": "Jacaré", "JACAREPAGUA": "Jacarepaguá", "JOA": "Joá",
    "JOAO": "João", "JOSE": "José", "MAGALHAES": "Magalhães",
    "MARACANA": "Maracanã", "MARE": "Maré", "MARQUES": "Marquês",
    "MEIER": "Méier", "OLIMPICA": "Olímpica", "PACIENCIA": "Paciência",
    "PAQUETA": "Paquetá", "PIRAJA": "Pirajá", "PRACA": "Praça",
    "SANTISSIMO": "Santíssimo", "SAO": "São", "SAUDE": "Saúde",
    "SERVIDAO": "Servidão", "TAUA": "Tauá", "TOMAS": "Tomás",
    "TURIACU": "Turiaçu", "UNIVERSITARIA": "Universitária",
    "VIGARIO": "Vigário",
}

_MINUSCULAS = frozenset({"de", "da", "do", "das", "dos", "e", "os", "as"})
_ROMANOS = re.compile(r"^(?=[IVXLC]+$)C{0,3}(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$")
# Siglas de loteamento ("Rua B-3 PAL 19600": Projeto Aprovado de Loteamento).
_SIGLAS = frozenset({"PAL", "PAA", "PLT"})

_BAIRROS_ESPECIAIS: dict[str, str] = {
    "FREGUESIA ILHA": "Freguesia (Ilha do Governador)",
    "FREGUESIA JACAREPAGUA": "Freguesia (Jacarepaguá)",
    "NAO INFORMADO": "Não informado",
}


def _capitalizar(palavra: str, primeira: bool) -> str:
    # Números, romanos ("XV de Novembro"), ruas de loteamento ("Rua C") e
    # siglas sem vogal ("Avenida DW") ficam como estão.
    if (
        any(c.isdigit() for c in palavra)
        or _ROMANOS.match(palavra)
        or palavra in _SIGLAS
        or (len(palavra) > 1 and not set(palavra) & set("AEIOUY"))
    ):
        return palavra
    if palavra in _ACENTOS:
        return _ACENTOS[palavra]
    minuscula = palavra.lower()
    if not primeira and minuscula in _MINUSCULAS:
        return minuscula
    return palavra.capitalize()


def _capitalizar_texto(texto: str, expandir: bool, primeira: bool = True) -> str:
    """Capitaliza um texto em maiúsculas, palavra a palavra, preservando a
    pontuação. Com `expandir`, também desfaz as abreviações de título."""

    def trocar(m: re.Match) -> str:
        nonlocal primeira
        palavra = m.group(0)
        partes = (ABREVIACOES.get(palavra, palavra) if expandir else palavra).split()
        saida = " ".join(_capitalizar(p, primeira and i == 0) for i, p in enumerate(partes))
        primeira = False
        return saida

    return re.sub(r"[A-Z0-9ÀÁÂÃÇÉÊÍÓÔÕÚÜ]+", trocar, texto)


def tem_minuscula(texto: str) -> bool:
    return any(c.islower() for c in texto)


def formatar_logradouro(nome: str) -> str:
    """Nome de exibição a partir da grafia da planilha.

    Os arquivos até 2024 já trazem o nome por extenso ("Avenida Vieira Souto"):
    só limpa os espaços. O de 2025 traz tudo em maiúsculas e abreviado ("AVN
    VIEIRA SOUTO", "RUA CAP GOUVEIA"): expande o tipo e os títulos e capitaliza.
    """
    limpo = sem_qualificador(limpar_espacos(nome))
    if not limpo or tem_minuscula(limpo):
        return limpo
    limpo = re.sub(r"\bN\s*/\s*S\b", "NOSSA SENHORA", limpo)
    primeira, _, resto = limpo.partition(" ")
    tipo = TIPOS_LOGRADOURO.get(primeira) if resto else None
    if tipo:
        # Depois do tipo, preposição fica minúscula ("Rua das Oficinas"), a
        # não ser que seja o nome inteiro ("Rua E").
        nome_unico = " " not in resto
        return f"{NOME_DO_TIPO[tipo]} {_capitalizar_texto(resto, expandir=True, primeira=nome_unico)}"
    return _capitalizar_texto(limpo, expandir=True)


def formatar_bairro(bairro: str) -> str:
    """"JARDIM BOTANICO" → "Jardim Botânico"."""
    limpo = limpar_espacos(bairro).upper()
    if limpo in _BAIRROS_ESPECIAIS:
        return _BAIRROS_ESPECIAIS[limpo]
    return _capitalizar_texto(limpo, expandir=False)


# Tipologias da Prefeitura que não saem bem só com a capitalização (a base
# guarda o texto de busca: "APART-HOTEL FRENTE" virou "APART HOTEL FRENTE").
_TIPOLOGIAS: dict[str, str] = {
    "APART HOTEL": "Apart-hotel",
    "APART HOTEL FRENTE": "Apart-hotel (frente)",
    "APART HOTEL FUNDOS": "Apart-hotel (fundos)",
    "PROLETARIO CASA APTO": "Proletário (casa/apto)",
    "PROLETARIO APARTAMENTO": "Proletário (apartamento)",
    "PROLETARIO CASA": "Proletário (casa)",
    "HOTEL MOTEL E SIMILAR": "Hotel, motel e similar",
    "UNID HOTELEIRA": "Unidade hoteleira",
    "COLEGIO CRECHE": "Colégio/creche",
    "ARMAZEM DEPOSITO": "Armazém/depósito",
    "HOSPITAL CLINICA C INTERNACAO": "Hospital/clínica com internação",
    "GALPAO": "Galpão",
    "INDUSTRIA": "Indústria",
    "CONSTR SEC": "Construção secundária",
    "LOJA SHOPPING": "Loja de shopping",
    "NAO INFORMADA": "Não informada",
}


def formatar_tipologia(tipologia: str) -> str:
    """"APART HOTEL FRENTE" → "Apart-hotel (frente)"; "VAGA DE GARAGEM" →
    "Vaga de garagem"."""
    chave = texto_busca(tipologia)
    if chave in _TIPOLOGIAS:
        return _TIPOLOGIAS[chave]
    limpo = limpar_espacos(tipologia).lower()
    return limpo[:1].upper() + limpo[1:]


def formatar_complemento(complemento: str | None) -> str | None:
    """"APT 304" → "Apt 304"; "BLOCO 02 APTO 101A" → "Bloco 02 Apto 101A".

    Letra solta, número e sigla sem vogal ficam como vieram ("Lot 10 QDR E").
    """
    limpo = limpar_espacos(complemento)
    if not limpo:
        return None

    def palavra(p: str) -> str:
        if (
            len(p) == 1
            or p in _SIGLAS
            or any(c.isdigit() for c in p)
            or not set(p) & set("AEIOU")
        ):
            return p
        return p.capitalize()

    return re.sub(r"[^\s/.,-]+", lambda m: palavra(m.group(0)), limpo.upper())
