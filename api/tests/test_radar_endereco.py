"""Parser da busca do Radar: o que o visitante digita vira chave + número."""
import pytest

from app.services.radar.endereco import interpretar_busca
from app.services.radar.normalizacao import chave_logradouro


@pytest.mark.parametrize("digitado", [
    "Vieira Souto 510",
    "av vieira souto, 510",
    "Avenida Vieira Souto 510",
    "Av. Vieira Souto, nº 510",
    "AVN VIEIRA SOUTO 510",
    "vieira souto 510 apto 302",
    "Vieira Souto, 510 - bloco 2",
])
def test_grafias_do_mesmo_predio_dao_a_mesma_consulta(digitado):
    consulta = interpretar_busca(digitado)
    assert consulta.chave == "VIEIRA SOUTO"
    assert consulta.numero == 510
    # e bate com a chave gravada pela importação
    assert consulta.chave == chave_logradouro("Avenida Vieira Souto")


def test_tipo_reconhecido():
    assert interpretar_busca("Avenida Vieira Souto 510").tipo == "AVENIDA"
    assert interpretar_busca("Vieira Souto 510").tipo is None
    assert interpretar_busca("Vieira Souto 510").tem_tipo is False


def test_rua_sem_numero():
    consulta = interpretar_busca("Rua Barata Ribeiro")
    assert consulta.chave == "BARATA RIBEIRO"
    assert consulta.numero is None
    assert consulta.tipo == "RUA"


def test_bairro_fica_como_texto_para_a_api_decidir():
    consulta = interpretar_busca("Ipanema")
    assert consulta.texto == "IPANEMA"
    assert consulta.chave == "IPANEMA"
    assert consulta.numero is None
    assert consulta.tem_tipo is False


def test_complemento_so_corta_depois_de_numero():
    assert interpretar_busca("rua prudente de morais 1500 apto 201").numero == 1500
    assert interpretar_busca("rua prudente de morais 1500 apto 201").chave == "PRUDENTE MORAIS"
    # "Casa" aqui é nome da rua, não complemento
    assert interpretar_busca("Rua Casa Forte").chave == "CASA FORTE"


def test_numero_no_meio_do_nome_nao_e_numero_do_predio():
    assert interpretar_busca("Rua 19 de Fevereiro").numero is None
    assert interpretar_busca("Rua 19 de Fevereiro").chave == "19 FEVEREIRO"
    assert interpretar_busca("Rua 19 de Fevereiro 100").numero == 100


def test_rua_que_e_so_numero():
    consulta = interpretar_busca("Rua 2")
    assert consulta.numero is None
    assert consulta.chave == "2"


def test_dois_numeros_no_fim_vale_o_primeiro():
    assert interpretar_busca("Vieira Souto 510 302").numero == 510


def test_nossa_senhora_abreviada():
    assert (
        interpretar_busca("N S Copacabana 1000").chave
        == interpretar_busca("Nossa Senhora de Copacabana 1000").chave
        == "NOSSA SENHORA COPACABANA"
    )


def test_pra_ambiguo_conta_como_tipo():
    consulta = interpretar_busca("pra botafogo 300")
    assert consulta.tem_tipo is True
    assert consulta.tipo is None
    assert consulta.chave == "BOTAFOGO"
    assert consulta.numero == 300


def test_entradas_limite():
    vazio = interpretar_busca("")
    assert (vazio.chave, vazio.numero) == ("", None)
    assert interpretar_busca("Vieira Souto 99999999").numero is None
    assert interpretar_busca("   ,,, ").chave == ""
