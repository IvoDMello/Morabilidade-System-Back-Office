"""Testes de validação dos schemas Pydantic."""
import pytest
from pydantic import ValidationError

from app.schemas.imovel import ImovelCreate
from app.schemas.cliente import ClienteCreate
from app.schemas.tag import TagCreate
from app.schemas.user import UserCreate


# ── ImovelCreate ─────────────────────────────────────────────────────────────

class TestImovelCreate:
    def _base(self, **overrides):
        data = {
            "tipo_negocio": "venda",
            "disponibilidade": "disponivel",
            "condicao": "usado",
            "cidade": "São Paulo",
            "bairro": "Pinheiros",
            "logradouro": "Rua dos Pinheiros",
            "tipo_imovel": "apartamento",
        }
        data.update(overrides)
        return data

    def test_campos_obrigatorios_validos(self):
        imovel = ImovelCreate(**self._base())
        assert imovel.cidade == "São Paulo"
        assert imovel.tipo_negocio.value == "venda"

    def test_tipo_negocio_invalido(self):
        with pytest.raises(ValidationError):
            ImovelCreate(**self._base(tipo_negocio="aluguel"))

    def test_disponibilidade_invalida(self):
        with pytest.raises(ValidationError):
            ImovelCreate(**self._base(disponibilidade="ocupado"))

    def test_tipo_imovel_invalido(self):
        with pytest.raises(ValidationError):
            ImovelCreate(**self._base(tipo_imovel="mansao"))

    def test_campos_opcionais_omitidos(self):
        imovel = ImovelCreate(**self._base())
        assert imovel.dormitorios is None
        assert imovel.valor_venda is None
        assert imovel.codigo is None

    def test_valores_numericos_opcionais(self):
        imovel = ImovelCreate(**self._base(valor_venda=500_000.0, dormitorios=3))
        assert imovel.valor_venda == 500_000.0
        assert imovel.dormitorios == 3


# ── ClienteCreate ─────────────────────────────────────────────────────────────

class TestClienteCreate:
    def _base(self, **overrides):
        data = {
            "nome_completo": "João Silva",
            "email": "joao@email.com",
            "telefone": "11999999999",
        }
        data.update(overrides)
        return data

    def test_dados_minimos_validos(self):
        c = ClienteCreate(**self._base())
        assert c.nome_completo == "João Silva"
        assert c.status is None

    def test_email_invalido(self):
        with pytest.raises(ValidationError):
            ClienteCreate(**self._base(email="nao-e-email"))

    def test_status_invalido(self):
        with pytest.raises(ValidationError):
            ClienteCreate(**self._base(status="pendente"))

    def test_tipo_cliente_invalido(self):
        with pytest.raises(ValidationError):
            ClienteCreate(**self._base(tipo_cliente="corretor"))

    def test_origem_lead_valida(self):
        c = ClienteCreate(**self._base(origem_lead="whatsapp"))
        assert c.origem_lead.value == "whatsapp"

    def test_campos_opcionais_nulos(self):
        c = ClienteCreate(**self._base())
        assert c.cpf_cnpj is None
        assert c.observacoes is None


# ── TagCreate ─────────────────────────────────────────────────────────────────

class TestTagCreate:
    def test_tag_valida(self):
        t = TagCreate(nome="Destaque", cor="#FF5733")
        assert t.nome == "Destaque"
        assert t.cor == "#FF5733"

    def test_tag_sem_cor(self):
        t = TagCreate(nome="Novo")
        assert t.cor is None

    def test_tag_nome_obrigatorio(self):
        with pytest.raises(ValidationError):
            TagCreate(cor="#FF5733")


# ── UserCreate ────────────────────────────────────────────────────────────────

class TestUserCreate:
    def test_usuario_admin_valido(self):
        u = UserCreate(
            nome_completo="Admin",
            email="admin@email.com",
            senha="senha1234",
            perfil="admin",
        )
        assert u.perfil.value == "admin"

    def test_perfil_invalido(self):
        with pytest.raises(ValidationError):
            UserCreate(
                nome_completo="Test",
                email="test@email.com",
                senha="senha1234",
                perfil="superadmin",
            )

    def test_email_invalido(self):
        with pytest.raises(ValidationError):
            UserCreate(
                nome_completo="Test",
                email="nao-email",
                senha="senha1234",
                perfil="admin",
            )
