"""Respostas da MoraMétrica (codinome Radar), a busca pública de vendas por
endereço com os valores declarados no ITBI."""
from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel


class RadarSugestao(BaseModel):
    """Item do autocomplete. `consulta` é o texto que vai para a caixa de busca."""
    tipo: Literal["logradouro", "bairro"]
    rotulo: str                       # "Avenida Vieira Souto"
    detalhe: Optional[str] = None     # "Ipanema" / "antiga Rua Sobreiro"
    consulta: str
    cl: Optional[int] = None          # logradouro: busca direta, sem reinterpretar
    numero: Optional[int] = None      # número já digitado, vai junto na busca direta
    unidade: Optional[str] = None     # unidade já digitada ("BL 001 Apto 0801")
    bairro: Optional[str] = None      # bairro: chave para busca direta
    transacoes: int


class RadarInfo(BaseModel):
    """Rodapé da página: até quando vão os dados e quantas transações há."""
    dados_ate: Optional[date] = None
    transacoes: int


class RadarPeriodo(BaseModel):
    desde: Optional[date] = None      # competência inicial (1º dia do mês)
    ate: Optional[date] = None
    padrao: bool                      # últimos 5 anos, sem filtro do visitante


class RadarTipologia(BaseModel):
    valor: str                        # "APARTAMENTO", o que vai em ?tipologia=
    rotulo: str                       # "Apartamento"
    transacoes: int


class RadarResumo(BaseModel):
    transacoes: int
    media_m2: Optional[float] = None
    media_valor: Optional[float] = None
    media_area: Optional[float] = None


class RadarTransacao(BaseModel):
    competencia: date                 # mês da transação (a fonte não traz o dia)
    tipologia: str
    complemento: Optional[str] = None
    area: float
    valor_declarado: float
    valor_m2: Optional[float] = None  # nulo quando parcial
    parcial: bool                     # parte transferida < 100% ou fração ideal de lançamento


class RadarPredio(BaseModel):
    numero: int
    transacoes: int
    media_m2: Optional[float] = None
    ultima: date
    tipologia: str


class RadarTipologiaResumo(BaseModel):
    valor: str
    rotulo: str
    transacoes: int
    media_m2: Optional[float] = None
    media_valor: Optional[float] = None
    media_area: Optional[float] = None


class RadarRua(BaseModel):
    cl: int
    nome: str
    transacoes: int
    media_m2: Optional[float] = None


class RadarOpcao(BaseModel):
    """Logradouro candidato quando o nome digitado existe em mais de uma rua."""
    cl: int
    nome: str
    bairros: List[str]
    transacoes: int
    tem_numero: Optional[bool] = None


class RadarBuscaOut(BaseModel):
    """Resultado da busca. `tipo` diz quais campos vêm preenchidos:

    - predio: titulo, bairros, resumo, tipologias, transacoes (paginadas); com
      `unidade`, tudo se refere só àquela unidade (total_predio é o prédio)
    - rua: titulo, bairros, resumo, tipologias, predios (paginados), sem_numero
    - bairro: titulo, resumo, tipologias, por_tipologia, ruas
    - ambiguo: opcoes (o visitante escolhe e a página busca por `cl`)
    - nenhum: sugestoes; se a rua existe mas o número não, cl e numeros_proximos
    """
    tipo: Literal["predio", "rua", "bairro", "ambiguo", "nenhum"]
    consulta: str
    titulo: Optional[str] = None
    apelido: Optional[str] = None     # "antiga Rua Sobreiro"
    cl: Optional[int] = None
    numero: Optional[int] = None
    unidade: Optional[str] = None     # unidade buscada ("BL 001 Apto 0801")
    bairro: Optional[str] = None      # chave do bairro (tipo bairro)
    bairros: List[str] = []
    periodo: RadarPeriodo
    dados_ate: Optional[date] = None
    total_historico: int = 0          # transações sem filtro de período/tipologia
    total_predio: int = 0             # todas as vendas do prédio (busca por unidade)
    resumo: Optional[RadarResumo] = None
    tipologias: List[RadarTipologia] = []
    transacoes: List[RadarTransacao] = []
    predios: List[RadarPredio] = []
    sem_numero: int = 0
    por_tipologia: List[RadarTipologiaResumo] = []
    ruas: List[RadarRua] = []
    opcoes: List[RadarOpcao] = []
    sugestoes: List[RadarSugestao] = []
    numeros_proximos: List[int] = []
    pagina: int = 1
    por_pagina: int = 20
    total: int = 0                    # itens da lista paginada (transações ou prédios)
