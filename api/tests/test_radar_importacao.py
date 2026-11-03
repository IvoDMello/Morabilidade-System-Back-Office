"""Importação do Radar: descoberta dos links, interpretação das linhas, hash
idempotente, nomes de logradouro e sincronização com um banco em memória."""
import hashlib
from collections import Counter
from unittest.mock import MagicMock

import httpx
import pytest

from app.services.radar import importacao as imp
from app.services.radar.importacao import (
    ErroImportacao,
    ImportacaoAbortada,
    Leitura,
    _Grafia,
    descobrir_links,
    importar,
    interpretar_linha,
    ler_planilhas,
    mapear_colunas,
    resolver_logradouro,
    sincronizar,
)
from app.services.radar.repositorio import RepositorioSupabase
from tests.radar_planilha import CABECALHO_2025, CABECALHO_ANTIGO, criar_xlsx, linha_itbi


class RepositorioMemoria:
    """Implementa o protocolo `Repositorio` guardando tudo em dicionários."""

    def __init__(self):
        self.transacoes: dict[str, dict] = {}
        self.logradouros: dict[int, dict] = {}
        self.nomes: dict[tuple, dict] = {}
        self.bairros: dict[str, dict] = {}
        self.importacoes: list[dict] = []

    def ultima_importacao_ok(self):
        oks = [i for i in self.importacoes if i["status"] == "ok"]
        return oks[-1] if oks else None

    def abrir_importacao(self, status, arquivos):
        self.importacoes.append({"id": len(self.importacoes) + 1, "status": status, "arquivos": arquivos})
        return len(self.importacoes)

    def concluir_importacao(self, importacao_id, campos):
        self.importacoes[importacao_id - 1].update(campos)

    def listar_hashes(self):
        return set(self.transacoes)

    def gravar_transacoes(self, linhas, sobrescrever):
        for linha in linhas:
            if sobrescrever or linha["hash"] not in self.transacoes:
                self.transacoes[linha["hash"]] = linha

    def remover_hashes(self, hashes):
        return sum(1 for h in hashes if self.transacoes.pop(h, None) is not None)

    def marcar_fracoes(self):
        self.marcacoes = getattr(self, "marcacoes", 0) + 1
        return 0

    def gravar_logradouros(self, logradouros, nomes):
        for l in logradouros:
            self.logradouros[l["cl"]] = l
        for n in nomes:
            self.nomes[(n["cl"], n["nome_busca"])] = n

    def gravar_bairros(self, bairros):
        for b in bairros:
            self.bairros[b["chave"]] = b

    def limpar_logradouros(self, importacao_id):
        self.bairros = {k: v for k, v in self.bairros.items() if v["importacao_id"] == importacao_id}
        self.logradouros = {k: v for k, v in self.logradouros.items() if v["importacao_id"] == importacao_id}
        self.nomes = {
            k: v for k, v in self.nomes.items()
            if v["importacao_id"] == importacao_id and k[0] in self.logradouros
        }


def _dict(cabecalho, linha):
    """Linha como o leitor de xlsx entrega (texto já decodificado)."""
    from app.services.radar.normalizacao import decodificar_excel

    return {c: decodificar_excel(str(v)) for c, v in zip(cabecalho, linha)}


def _ler(*linhas, cabecalho=CABECALHO_2025) -> Leitura:
    leitura = Leitura()
    colunas = mapear_colunas(cabecalho)
    ocorrencias = Counter()
    for bruta in linhas:
        linha, logradouro, motivo = interpretar_linha(_dict(cabecalho, bruta), colunas)
        if linha is None:
            leitura.descartes[motivo] += 1
        else:
            leitura.adicionar(linha, logradouro, ocorrencias)
    return leitura


# ── Descoberta dos links ─────────────────────────────────────────────────────

def test_descobrir_links_so_planilhas_de_transacoes():
    html = """
      <a href="https://fazenda.prefeitura.rio/wp-content/uploads/sites/12/2026/09/ITBI_TRANSACOES_PERIODO_2011_2018.xlsx">2011</a>
      <a href='/wp-content/uploads/sites/12/2026/10/ITBI_TRANSACOES_2025_diante-7-1.xlsx'>2025</a>
      <a href="https://fazenda.prefeitura.rio/wp-content/uploads/sites/12/2026/03/publicar-itbi-tipo.xlsx">médias</a>
      <a href="https://fazenda.prefeitura.rio/wp-content/uploads/sites/12/2026/10/IPTU-arrecadacao.xlsx">IPTU</a>
      <a href="https://fazenda.prefeitura.rio/wp-content/uploads/sites/12/2026/09/ITBI_TRANSACOES_PERIODO_2011_2018.xlsx">repetido</a>
    """
    assert descobrir_links(html) == [
        "https://fazenda.prefeitura.rio/wp-content/uploads/sites/12/2026/09/ITBI_TRANSACOES_PERIODO_2011_2018.xlsx",
        "https://fazenda.prefeitura.rio/wp-content/uploads/sites/12/2026/10/ITBI_TRANSACOES_2025_diante-7-1.xlsx",
    ]


def test_descobrir_links_pagina_sem_planilha():
    assert descobrir_links("<html>manutenção</html>") == []


# ── Colunas ──────────────────────────────────────────────────────────────────

def test_mapear_colunas_aceita_os_dois_formatos_da_prefeitura():
    novo = mapear_colunas(CABECALHO_2025)
    antigo = mapear_colunas(CABECALHO_ANTIGO)
    assert (novo["bairro"], novo["valor"], novo["uso"]) == ("bairro", "vl_declarado", "descricao")
    assert (antigo["bairro"], antigo["valor"], antigo["uso"]) == ("nm_bairro_norm", "valor_transacoes", "DESCRICAO")
    assert novo["complemento"] == "COMPLEMENTO"


def test_mapear_colunas_sem_coluna_obrigatoria():
    with pytest.raises(ErroImportacao, match="vl_declarado|valor"):
        mapear_colunas([c for c in CABECALHO_2025 if c != "vl_declarado"])


# ── Interpretação das linhas ─────────────────────────────────────────────────

def test_linha_valida_vira_transacao():
    leitura = _ler(linha_itbi())
    assert not leitura.descartes
    banco = leitura.para_banco(leitura.linhas[0])
    assert banco == {
        "hash": leitura.linhas[0].hash,
        "competencia": "2025-01-01",
        "cl": 83360,
        "trecho": 2,
        "numero": 510,
        "complemento": "APT 302",
        "bairro": "Ipanema",
        "bairro_busca": "IPANEMA",
        "tipologia": "APARTAMENTO",
        "uso": "RESIDENCIAL",
        "parte_transferida": 100.0,
        "parcial": False,
        "valor_declarado": 5000000.0,
        "area": 100.0,
        "valor_m2": 50000.0,
    }
    assert len(banco["hash"]) == 32


@pytest.mark.parametrize("ajuste, motivo", [
    ({"valor": ""}, "sem_valor"),
    ({"valor": "500"}, "sem_valor"),
    ({"area": "0"}, "sem_area"),
    ({"area": ""}, "sem_area"),
    ({"area": "2", "valor": "1000"}, "area_absurda"),
    ({"area": "300000"}, "area_absurda"),
    ({"area": "10", "valor": "48000000"}, "valor_m2_absurdo"),   # área digitada errado
    ({"area": "100", "valor": "1500"}, "valor_m2_absurdo"),
    ({"cl": ""}, "sem_logradouro"),
    ({"ano": "", "mes": ""}, "data_invalida"),
    ({"mes": "13"}, "data_invalida"),
])
def test_descartes(ajuste, motivo):
    leitura = _ler(linha_itbi(**ajuste))
    assert leitura.linhas == []
    assert leitura.descartes == {motivo: 1}


def test_terreno_aceita_area_grande_e_valor_baixo_por_m2():
    leitura = _ler(linha_itbi(tipologia="TERRENO", uso="TERRITORIAL", area="500000", valor="250000"))
    assert len(leitura.linhas) == 1


def test_transmissao_parcial_nao_usa_valor_por_m2():
    leitura = _ler(linha_itbi(parte="50,00"))
    banco = leitura.para_banco(leitura.linhas[0])
    assert banco["parcial"] is True
    assert banco["parte_transferida"] == 50.0
    assert banco["valor_m2"] is None


def test_bairro_vazio_e_recuperado_pelo_codigo():
    leitura = _ler(linha_itbi(), linha_itbi(bairro="", complemento="APT 101"))
    assert [leitura.para_banco(l)["bairro"] for l in leitura.linhas] == ["Ipanema", "Ipanema"]


def test_bairro_vazio_sem_codigo_conhecido():
    leitura = _ler(linha_itbi(bairro="", cd_bairro=""))
    assert leitura.para_banco(leitura.linhas[0])["bairro_busca"] == "NAO INFORMADO"


# ── Hash ─────────────────────────────────────────────────────────────────────

def test_hash_estavel_entre_leituras():
    linhas = [linha_itbi(), linha_itbi(numero="416", valor="3000000")]
    assert [l.hash for l in _ler(*linhas).linhas] == [l.hash for l in _ler(*linhas).linhas]


def test_hash_ignora_formato_do_numero_e_grafia_da_rua():
    # o mesmo registro escrito como nos arquivos antigos
    a = _ler(linha_itbi(parte="100", logradouro="AVN VIEIRA SOUTO", cod_tipologia="10"))
    b = _ler(linha_itbi(parte="100,00", logradouro="Avenida Vieira Souto", cod_tipologia="_x0031_0"))
    assert a.linhas[0].hash == b.linhas[0].hash


def test_linhas_identicas_ficam_com_hashes_distintos():
    leitura = _ler(linha_itbi(), linha_itbi())
    assert len(leitura.linhas) == 2
    assert leitura.linhas[0].hash != leitura.linhas[1].hash


def test_hash_muda_quando_o_valor_muda():
    assert _ler(linha_itbi()).linhas[0].hash != _ler(linha_itbi(valor="5100000")).linhas[0].hash


# ── Nomes de logradouro ──────────────────────────────────────────────────────

def test_abreviado_recente_exibe_nome_por_extenso_antigo():
    exibicao, nomes = resolver_logradouro({
        "Avenida Vieira Souto": _Grafia(355, "2024-12-01"),
        "AVN VIEIRA SOUTO": _Grafia(82, "2026-09-01"),
    })
    assert exibicao == "Avenida Vieira Souto"
    assert nomes == {"VIEIRA SOUTO": "Avenida Vieira Souto"}


def test_pra_ambiguo_resolvido_pelo_codigo():
    exibicao, _ = resolver_logradouro({
        "Praça dos Tamoios": _Grafia(16, "2024-05-01"),
        "PRA DOS TAMOIOS": _Grafia(7, "2026-03-01"),
    })
    assert exibicao == "Praça dos Tamoios"


def test_rua_renomeada_exibe_nome_novo_e_guarda_o_antigo():
    exibicao, nomes = resolver_logradouro({
        "Rua Sobreiro": _Grafia(40, "2024-11-01"),
        "RUA PAULO FRANCHINI": _Grafia(3, "2026-08-01"),
    })
    assert exibicao == "Rua Paulo Franchini"
    assert nomes == {"PAULO FRANCHINI": "Rua Paulo Franchini", "SOBREIRO": "Rua Sobreiro"}


def test_rua_que_so_existe_no_arquivo_novo():
    exibicao, _ = resolver_logradouro({"RUA CAP GOUVEIA": _Grafia(2, "2026-01-01")})
    assert exibicao == "Rua Capitão Gouveia"


def test_logradouros_conta_transacoes_e_predios():
    leitura = _ler(
        linha_itbi(),
        linha_itbi(complemento="APT 101"),
        linha_itbi(numero="416"),
        linha_itbi(numero="", bairro="IPANEMA"),
    )
    logradouros, nomes = leitura.logradouros(importacao_id=7)
    assert logradouros == [{
        "cl": 83360, "tipo": "AVENIDA", "nome": "Avenida Vieira Souto", "nome_busca": "VIEIRA SOUTO",
        "bairros": ["Ipanema"], "transacoes": 4, "predios": 2, "importacao_id": 7,
    }]
    assert nomes == [{"cl": 83360, "nome_busca": "VIEIRA SOUTO", "nome": "Avenida Vieira Souto", "importacao_id": 7}]


# ── Sincronização ────────────────────────────────────────────────────────────

def _base(n=40):
    return [linha_itbi(numero=str(100 + i), valor=str(1_000_000 + i)) for i in range(n)]


def test_primeira_carga_insere_tudo_e_segunda_nao_muda_nada():
    repo = RepositorioMemoria()
    leitura = _ler(*_base())
    assert sincronizar(repo, leitura, 1)["novas"] == 40
    assert len(repo.transacoes) == 40

    antes = dict(repo.transacoes)
    resultado = sincronizar(repo, _ler(*_base()), 2)
    assert (resultado["novas"], resultado["removidas"]) == (0, 0)
    # a marcação de frações roda em toda importação (um lançamento cruza o limite aos poucos)
    assert repo.marcacoes == 2
    assert repo.transacoes == antes
    assert list(repo.logradouros) == [83360]
    assert repo.logradouros[83360]["importacao_id"] == 2
    assert repo.bairros == {
        "IPANEMA": {"chave": "IPANEMA", "nome": "Ipanema", "transacoes": 40, "importacao_id": 2},
    }


def test_bairro_que_sumiu_da_fonte_sai_do_resumo():
    repo = RepositorioMemoria()
    sincronizar(repo, _ler(*_base(), linha_itbi(bairro="LEBLON", cd_bairro="91", numero="999")), 1)
    assert set(repo.bairros) == {"IPANEMA", "LEBLON"}
    sincronizar(repo, _ler(*_base()), 2)
    assert set(repo.bairros) == {"IPANEMA"}


def test_linha_corrigida_pela_prefeitura_substitui_a_antiga():
    repo = RepositorioMemoria()
    sincronizar(repo, _ler(*_base()), 1)
    corrigida = _base()
    corrigida[0] = linha_itbi(numero="100", valor="1200000")
    resultado = sincronizar(repo, _ler(*corrigida), 2)
    assert (resultado["novas"], resultado["removidas"]) == (1, 1)
    assert len(repo.transacoes) == 40
    assert 1_200_000.0 in {t["valor_declarado"] for t in repo.transacoes.values()}


def test_trava_impede_apagar_mais_de_5_por_cento():
    repo = RepositorioMemoria()
    sincronizar(repo, _ler(*_base()), 1)
    truncada = _ler(*_base()[:30])   # arquivo cortado pela metade, por exemplo
    with pytest.raises(ImportacaoAbortada):
        sincronizar(repo, truncada, 2)
    assert len(repo.transacoes) == 40
    assert sincronizar(repo, truncada, 3, forcar=True)["removidas"] == 10


def test_reprocessar_regrava_linhas_existentes():
    repo = RepositorioMemoria()
    sincronizar(repo, _ler(*_base()), 1)
    for t in repo.transacoes.values():
        t["bairro"] = "velho"
    sincronizar(repo, _ler(*_base()), 2, reprocessar=True)
    assert {t["bairro"] for t in repo.transacoes.values()} == {"Ipanema"}


def test_logradouro_que_sumiu_da_fonte_e_apagado():
    repo = RepositorioMemoria()
    sincronizar(repo, _ler(*_base(), linha_itbi(cl="99", logradouro="RUA X")), 1)
    assert 99 in repo.logradouros
    sincronizar(repo, _ler(*_base()), 2)
    assert 99 not in repo.logradouros
    assert all(cl != 99 for cl, _ in repo.nomes)


# ── Fluxo completo ───────────────────────────────────────────────────────────

def _planilhas(tmp_path):
    antigo = criar_xlsx(tmp_path / "ITBI_TRANSACOES_PERIODO_2019_2024.xlsx", [
        CABECALHO_ANTIGO,
        linha_itbi(ano=2024, logradouro="Avenida_x0020_Vieira_x0020_Souto"),
    ])
    novo = criar_xlsx(tmp_path / "ITBI_TRANSACOES_2025_diante.xlsx", [
        CABECALHO_2025,
        linha_itbi(),
        linha_itbi(valor="0"),
    ])
    return [antigo, novo]


def test_importar_arquivos_locais_e_reimportar_sem_mudanca(tmp_path):
    repo = RepositorioMemoria()
    arquivos = _planilhas(tmp_path)

    resultado = importar(repo, MagicMock(), tmp_path, arquivos_locais=arquivos)
    assert resultado["status"] == "ok"
    assert (resultado["linhas_lidas"], resultado["linhas_validas"], resultado["novas"]) == (3, 2, 2)
    assert resultado["descartes"] == {"sem_valor": 1}
    assert repo.importacoes[0]["dados_ate"] == "2025-01-01"
    assert repo.logradouros[83360]["nome"] == "Avenida Vieira Souto"

    resultado = importar(repo, MagicMock(), tmp_path, arquivos_locais=arquivos)
    assert resultado == {"status": "sem_mudancas"}
    assert len(repo.transacoes) == 2
    assert [i["status"] for i in repo.importacoes] == ["ok", "sem_mudancas"]


def test_importar_com_forcar_relê_mesmo_sem_mudanca(tmp_path):
    repo = RepositorioMemoria()
    arquivos = _planilhas(tmp_path)
    importar(repo, MagicMock(), tmp_path, arquivos_locais=arquivos)
    resultado = importar(repo, MagicMock(), tmp_path, arquivos_locais=arquivos, forcar=True)
    assert (resultado["status"], resultado["novas"], resultado["removidas"]) == ("ok", 0, 0)


def test_simular_nao_toca_no_banco(tmp_path):
    repo = MagicMock()
    resultado = importar(repo, MagicMock(), tmp_path, arquivos_locais=_planilhas(tmp_path), simular=True)
    assert resultado["status"] == "simulado"
    assert resultado["linhas_validas"] == 2
    repo.assert_not_called()
    assert repo.method_calls == []


def test_erro_na_sincronizacao_fica_registrado(tmp_path, monkeypatch):
    repo = RepositorioMemoria()

    def quebra(*_a, **_k):
        raise RuntimeError("supabase fora")

    monkeypatch.setattr(repo, "listar_hashes", quebra)
    with pytest.raises(RuntimeError):
        importar(repo, MagicMock(), tmp_path, arquivos_locais=_planilhas(tmp_path))
    assert repo.importacoes[0]["status"] == "erro"
    assert "supabase fora" in repo.importacoes[0]["erro"]


def test_importar_descobre_links_e_baixa(tmp_path):
    origem = tmp_path / "origem"
    origem.mkdir()
    antigo, novo = _planilhas(origem)
    arquivos = {
        "/uploads/2026/09/ITBI_TRANSACOES_PERIODO_2019_2024.xlsx": antigo.read_bytes(),
        "/uploads/2026/10/ITBI_TRANSACOES_2025_diante.xlsx": novo.read_bytes(),
    }
    pagina = "".join(f'<a href="{caminho}">planilha</a>' for caminho in arquivos)

    def responder(request: httpx.Request) -> httpx.Response:
        if request.url.path in arquivos:
            return httpx.Response(200, content=arquivos[request.url.path])
        if str(request.url) == imp.PAGINA_FONTE:
            return httpx.Response(200, text=pagina)
        return httpx.Response(404)

    destino = tmp_path / "downloads"
    destino.mkdir()
    repo = RepositorioMemoria()
    with httpx.Client(transport=httpx.MockTransport(responder)) as http:
        resultado = importar(repo, http, destino)
    assert resultado["novas"] == 2
    assert [a["url"].rsplit("/", 1)[-1] for a in repo.importacoes[0]["arquivos"]] == [
        "ITBI_TRANSACOES_PERIODO_2019_2024.xlsx",
        "ITBI_TRANSACOES_2025_diante.xlsx",
    ]


def test_importar_falha_se_a_pagina_nao_tem_planilhas(tmp_path, monkeypatch):
    monkeypatch.setattr(imp.time, "sleep", lambda _: None)
    pedidos = []

    def responder(request):
        pedidos.append(request)
        return httpx.Response(
            200,
            headers={"content-type": "text/html"},
            text="<html><title>Acesso negado</title><script>x()</script><p>Seu IP foi bloqueado.</p></html>",
        )

    with httpx.Client(transport=httpx.MockTransport(responder)) as http, pytest.raises(ErroImportacao) as erro:
        importar(RepositorioMemoria(), http, tmp_path)
    assert len(pedidos) == imp.TENTATIVAS
    mensagem = str(erro.value)
    assert "Nenhuma planilha" in mensagem
    assert "HTTP 200" in mensagem
    assert "'Acesso negado'" in mensagem
    assert "Seu IP foi bloqueado." in mensagem
    assert "x()" not in mensagem


def test_buscar_links_tenta_de_novo_quando_a_pagina_vem_sem_links(monkeypatch):
    pausas = []
    monkeypatch.setattr(imp.time, "sleep", pausas.append)
    respostas = iter(["<html>instável</html>", '<a href="/x/ITBI_TRANSACOES_2025.xlsx">a</a>'])
    transporte = httpx.MockTransport(lambda r: httpx.Response(200, text=next(respostas)))
    with httpx.Client(transport=transporte) as http:
        assert imp.buscar_links(http) == ["https://fazenda.prefeitura.rio/x/ITBI_TRANSACOES_2025.xlsx"]
    assert pausas == [imp.PAUSA]


def test_importar_falha_se_o_download_nao_e_xlsx(tmp_path, monkeypatch):
    monkeypatch.setattr(imp.time, "sleep", lambda _: None)
    downloads = []

    def responder(request):
        if str(request.url) == imp.PAGINA_FONTE:
            return httpx.Response(200, text='<a href="/x/ITBI_TRANSACOES_2025.xlsx">a</a>')
        downloads.append(request)
        return httpx.Response(200, text="<html><title>Request Rejected</title>Support ID 123</html>")

    with httpx.Client(transport=httpx.MockTransport(responder)) as http, pytest.raises(ErroImportacao) as erro:
        importar(RepositorioMemoria(), http, tmp_path)
    assert len(downloads) == imp.TENTATIVAS
    mensagem = str(erro.value)
    assert "não devolveu um .xlsx" in mensagem
    assert "'Request Rejected'" in mensagem
    assert "Support ID 123" in mensagem


def test_baixar_tenta_de_novo_quando_vem_outra_coisa(tmp_path, monkeypatch):
    pausas = []
    monkeypatch.setattr(imp.time, "sleep", pausas.append)
    respostas = iter([b"<html>erro</html>", b"PK\x03\x04conteudo"])
    transporte = httpx.MockTransport(lambda r: httpx.Response(200, content=next(respostas)))
    with httpx.Client(transport=transporte) as http:
        arquivo = imp.baixar("https://fazenda.prefeitura.rio/x/ITBI_TRANSACOES_2025.xlsx", tmp_path, http)
    assert arquivo.bytes == len(b"PK\x03\x04conteudo")
    assert arquivo.sha256 == hashlib.sha256(b"PK\x03\x04conteudo").hexdigest()
    assert arquivo.caminho.read_bytes() == b"PK\x03\x04conteudo"
    assert pausas == [imp.PAUSA]


def test_ler_planilhas_vazia(tmp_path):
    with pytest.raises(ErroImportacao, match="vazia"):
        ler_planilhas([criar_xlsx(tmp_path / "v.xlsx", [CABECALHO_2025])])


# ── Repositório Supabase ─────────────────────────────────────────────────────

def test_repositorio_lista_hashes_paginando(monkeypatch):
    monkeypatch.setattr("app.services.radar.repositorio.LOTE_HASHES_LEITURA", 2)
    db = MagicMock()
    db.rpc.return_value.execute.side_effect = [
        MagicMock(data=["a", "b"]), MagicMock(data=["c"]),
    ]
    assert RepositorioSupabase(db).listar_hashes() == {"a", "b", "c"}
    assert db.rpc.call_args_list[1].args == ("radar_listar_hashes", {"p_depois": "b", "p_limite": 2})


def test_repositorio_grava_em_lotes_ignorando_duplicados(monkeypatch):
    monkeypatch.setattr("app.services.radar.repositorio.LOTE_TRANSACOES", 2)
    db = MagicMock()
    RepositorioSupabase(db).gravar_transacoes(({"hash": str(i)} for i in range(5)), sobrescrever=False)
    upserts = db.table.return_value.upsert.call_args_list
    assert [len(c.args[0]) for c in upserts] == [2, 2, 1]
    assert all(c.kwargs["on_conflict"] == "hash" and c.kwargs["ignore_duplicates"] for c in upserts)


def test_repositorio_grava_resumo_de_bairros():
    db = MagicMock()
    RepositorioSupabase(db).gravar_bairros([{"chave": "IPANEMA"}])
    db.table.assert_called_with("radar_bairros_resumo")
    assert db.table.return_value.upsert.call_args.kwargs["on_conflict"] == "chave"


def test_repositorio_repete_falha_de_rede(monkeypatch):
    monkeypatch.setattr("app.services.radar.repositorio.time.sleep", lambda _s: None)
    db = MagicMock()
    db.rpc.return_value.execute.side_effect = [httpx.ConnectError("caiu"), MagicMock(data=3)]
    assert RepositorioSupabase(db).remover_hashes(["a", "b", "c"]) == 3
