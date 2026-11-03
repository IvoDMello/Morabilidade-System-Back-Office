"""RepositorioSupabase do Radar: lotes, paginação dos hashes e retentativa.

O cliente falso registra a cadeia de cada chamada (tabela, métodos e
argumentos) e devolve respostas na ordem em que `execute()` é chamado.
"""
import pytest
from postgrest.types import ReturnMethod

from app.services.radar import repositorio as repo_mod
from app.services.radar.repositorio import RepositorioSupabase


class _Resposta:
    def __init__(self, data):
        self.data = data


class _Cadeia:
    def __init__(self, cliente, origem):
        self.cliente = cliente
        self.passos = [origem]

    def __getattr__(self, metodo):
        def passo(*args, **kwargs):
            self.passos.append((metodo, args, kwargs))
            return self

        return passo

    def execute(self):
        self.cliente.chamadas.append(self.passos)
        resposta = self.cliente.respostas.pop(0) if self.cliente.respostas else None
        if isinstance(resposta, Exception):
            raise resposta
        return _Resposta(resposta)


class ClienteFalso:
    def __init__(self, *respostas):
        self.respostas = list(respostas)
        self.chamadas = []

    def table(self, nome):
        return _Cadeia(self, ("table", nome))

    def rpc(self, nome, params):
        return _Cadeia(self, ("rpc", nome, params))


@pytest.fixture(autouse=True)
def sem_espera(monkeypatch):
    monkeypatch.setattr(repo_mod.time, "sleep", lambda _: None)


def test_ultima_importacao_ok():
    cliente = ClienteFalso([{"id": 7, "arquivos": []}], [])
    repo = RepositorioSupabase(cliente)
    assert repo.ultima_importacao_ok() == {"id": 7, "arquivos": []}
    assert repo.ultima_importacao_ok() is None
    origem, *passos = cliente.chamadas[0]
    assert origem == ("table", "radar_importacoes")
    assert ("eq", ("status", "ok"), {}) in passos
    assert ("order", ("id",), {"desc": True}) in passos


def test_abrir_e_concluir_importacao():
    cliente = ClienteFalso([{"id": 12}], None)
    repo = RepositorioSupabase(cliente)
    assert repo.abrir_importacao("rodando", [{"url": "a"}]) == 12
    repo.concluir_importacao(12, {"status": "ok"})
    assert cliente.chamadas[0][1] == ("insert", ({"status": "rodando", "arquivos": [{"url": "a"}]},), {})
    assert cliente.chamadas[1][1:] == [("update", ({"status": "ok"},), {}), ("eq", ("id", 12), {})]


def test_listar_hashes_pagina_pelo_ultimo_hash(monkeypatch):
    monkeypatch.setattr(repo_mod, "LOTE_HASHES_LEITURA", 2)
    cliente = ClienteFalso(["a", "b"], ["c"])
    assert RepositorioSupabase(cliente).listar_hashes() == {"a", "b", "c"}
    params = [c[0][2] for c in cliente.chamadas]
    assert params == [{"p_depois": "", "p_limite": 2}, {"p_depois": "b", "p_limite": 2}]


def test_gravar_transacoes_em_lotes(monkeypatch):
    monkeypatch.setattr(repo_mod, "LOTE_TRANSACOES", 2)
    cliente = ClienteFalso()
    RepositorioSupabase(cliente).gravar_transacoes(({"hash": str(i)} for i in range(5)), sobrescrever=False)
    lotes = [c[1][1][0] for c in cliente.chamadas]
    assert [len(lote) for lote in lotes] == [2, 2, 1]
    assert cliente.chamadas[0][1][2] == {
        "on_conflict": "hash",
        "ignore_duplicates": True,
        "returning": ReturnMethod.minimal,
    }


def test_reprocessar_sobrescreve_duplicados():
    cliente = ClienteFalso()
    RepositorioSupabase(cliente).gravar_transacoes([{"hash": "a"}], sobrescrever=True)
    assert cliente.chamadas[0][1][2]["ignore_duplicates"] is False


def test_remover_hashes_soma_os_lotes(monkeypatch):
    monkeypatch.setattr(repo_mod, "LOTE_HASHES_REMOCAO", 2)
    cliente = ClienteFalso(2, 1)
    assert RepositorioSupabase(cliente).remover_hashes(["a", "b", "c"]) == 3
    assert [c[0][2] for c in cliente.chamadas] == [{"p_hashes": ["a", "b"]}, {"p_hashes": ["c"]}]


def test_marcar_fracoes_devolve_zero_sem_resposta():
    assert RepositorioSupabase(ClienteFalso(None)).marcar_fracoes() == 0
    assert RepositorioSupabase(ClienteFalso(2827)).marcar_fracoes() == 2827


def test_logradouros_antes_das_grafias():
    cliente = ClienteFalso()
    RepositorioSupabase(cliente).gravar_logradouros([{"cl": 1}], [{"cl": 1, "nome_busca": "X"}])
    assert [c[0] for c in cliente.chamadas] == [("table", "radar_logradouros"), ("table", "radar_logradouro_nomes")]
    assert cliente.chamadas[1][1][2]["on_conflict"] == "cl,nome_busca"


def test_gravar_bairros_e_limpar_logradouros():
    cliente = ClienteFalso()
    repo = RepositorioSupabase(cliente)
    repo.gravar_bairros([{"chave": "LEBLON"}])
    repo.limpar_logradouros(5)
    assert cliente.chamadas[0][0] == ("table", "radar_bairros_resumo")
    assert cliente.chamadas[0][1][2]["on_conflict"] == "chave"
    assert cliente.chamadas[1][0] == ("rpc", "radar_limpar_logradouros", {"p_importacao": 5})


def test_retentativa_repete_falha_de_rede_e_desiste_na_terceira():
    cliente = ClienteFalso(ConnectionError("1"), 42)
    assert RepositorioSupabase(cliente).marcar_fracoes() == 42

    cliente = ClienteFalso(ConnectionError("1"), ConnectionError("2"), ConnectionError("3"))
    with pytest.raises(ConnectionError, match="3"):
        RepositorioSupabase(cliente).marcar_fracoes()
    assert len(cliente.chamadas) == 3
