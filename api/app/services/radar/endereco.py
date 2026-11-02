"""Interpreta o que o visitante digita na busca do Radar.

"Vieira Souto 510", "av vieira souto, 510" e "Avenida Vieira Souto 510" viram a
mesma consulta: chave VIEIRA SOUTO, número 510. Decidir se o texto é uma rua ou
um bairro fica com a API, que conhece a lista de bairros; aqui só se separa
tipo, nome, número e complemento.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.services.radar.normalizacao import (
    TIPOS_AMBIGUOS,
    TIPOS_LOGRADOURO,
    palavras_chave,
    separar_tipo,
    texto_busca,
)

# Palavras que abrem o complemento ("510 apto 302"). Só cortam o texto quando
# já apareceu um número antes, para não mutilar nomes como "Rua Casa Forte".
_COMPLEMENTO = frozenset({
    "AP", "APT", "APTO", "APARTAMENTO", "BL", "BLOCO", "SALA", "SL", "LOJA",
    "LJ", "CASA", "CS", "COB", "COBERTURA", "FUNDOS", "FDS", "FRENTE",
    "UNIDADE", "UN", "CONJ", "CONJUNTO", "LOTE", "LT", "QD", "QUADRA",
})

# "nº 510", "n. 510", "numero 510". "Nº" vira "NO" na normalização.
_MARCADORES_NUMERO = frozenset({"N", "NO", "NR", "NRO", "NUM", "NUMERO"})


@dataclass(frozen=True)
class ConsultaEndereco:
    texto: str          # o que foi digitado, normalizado e sem o número
    tipo: str | None    # tipo canônico ("AVENIDA"), se veio e não é ambíguo
    tem_tipo: bool      # veio algum tipo, mesmo ambíguo ("PRA")
    chave: str          # chave do logradouro ("VIEIRA SOUTO")
    numero: int | None


def interpretar_busca(texto: str) -> ConsultaEndereco:
    palavras = texto_busca(texto).split()

    for i, palavra in enumerate(palavras):
        if palavra in _COMPLEMENTO and any(p.isdigit() for p in palavras[:i]):
            palavras = palavras[:i]
            break

    # O número é o primeiro de uma sequência de números no fim ("510 302" →
    # 510). Não vale se o que sobra é só o tipo: "Rua 2" é o nome da rua.
    fim = len(palavras)
    while fim > 1 and palavras[fim - 1].isdigit():
        fim -= 1
    numero = None
    if fim < len(palavras):
        nome = palavras[:fim]
        while len(nome) > 1 and nome[-1] in _MARCADORES_NUMERO:
            nome = nome[:-1]
        so_tipo = len(nome) == 1 and (nome[0] in TIPOS_LOGRADOURO or nome[0] in TIPOS_AMBIGUOS)
        if not so_tipo:
            n = int(palavras[fim])
            numero = n if 0 < n < 1_000_000 else None
            palavras = nome

    sem_numero = " ".join(palavras)
    tipo, tem_tipo, nome = separar_tipo(sem_numero)
    return ConsultaEndereco(
        texto=sem_numero,
        tipo=tipo,
        tem_tipo=tem_tipo,
        chave=" ".join(palavras_chave(nome)),
        numero=numero,
    )
