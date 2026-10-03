package com.example.agenda.controller;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.transaction.annotation.Transactional;

import com.example.agenda.config.TokenConfig;
import com.example.agenda.entity.Prestador;
import com.example.agenda.entity.Servico;
import com.example.agenda.entity.Usuario;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.PrestadorRepository;
import com.example.agenda.repository.ServicoRepository;
import com.example.agenda.repository.UsuarioRepository;
import com.jayway.jsonpath.JsonPath;

import jakarta.persistence.EntityManager;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PrestadorServicoControllerTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private TokenConfig tokenConfig;
    @Autowired
    private UsuarioRepository usuarioRepository;
    @Autowired
    private PrestadorRepository prestadorRepository;
    @Autowired
    private ServicoRepository servicoRepository;
    @Autowired
    private EntityManager entityManager;

    private Usuario cliente;
    private Prestador prestador;

    @BeforeEach
    void preparar() {
        cliente = usuario(TipoUsuario.CLIENTE);
        prestador = prestador();
    }

    @Test
    void consultaSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get(url(prestador.getId()))).andExpect(status().isUnauthorized());
    }

    @Test
    void prestadorInexistenteRetorna404() throws Exception {
        mockMvc.perform(autenticado(get(url(UUID.randomUUID())), cliente))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.status").value(404));
    }

    @ParameterizedTest
    @EnumSource(TipoUsuario.class)
    void qualquerUsuarioAutenticadoPodeConsultar(TipoUsuario tipo) throws Exception {
        servico(prestador, "Corte", true);
        mockMvc.perform(autenticado(get(url(prestador.getId())), usuario(tipo)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].nome").value("Corte"));
    }

    @Test
    void listaSomenteServicosAtivosDoPrestadorEmOrdemDeNome() throws Exception {
        Servico corte = servico(prestador, "Corte", true);
        Servico barba = servico(prestador, "Barba", true);
        servico(prestador, "Acabamento inativo", false);
        servico(prestador(), "Outro prestador", true);
        entityManager.clear();

        mockMvc.perform(autenticado(get(url(prestador.getId())), cliente))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(barba.getId().toString()))
                .andExpect(jsonPath("$[0].nome").value("Barba"))
                .andExpect(jsonPath("$[1].id").value(corte.getId().toString()))
                .andExpect(jsonPath("$[1].nome").value("Corte"));
    }

    @Test
    void prestadorSemServicosAtivosRetornaListaVazia() throws Exception {
        servico(prestador, "Corte inativo", false);
        mockMvc.perform(autenticado(get(url(prestador.getId())), cliente))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void respostaIncluiSomenteDadosDoServicoSemExporRelacoesOuSenha() throws Exception {
        Servico servico = servico(prestador, "Corte", true);
        entityManager.clear();
        String body = mockMvc.perform(autenticado(get(url(prestador.getId())), cliente))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(servico.getId().toString()))
                .andExpect(jsonPath("$[0].nome").value("Corte"))
                .andExpect(jsonPath("$[0].descricao").value("Servico de teste"))
                .andExpect(jsonPath("$[0].duracaoMinutos").value(30))
                .andExpect(jsonPath("$[0].preco").value(50.25))
                .andExpect(jsonPath("$[0].ativo").value(true))
                .andExpect(jsonPath("$[0].prestador").doesNotExist())
                .andExpect(jsonPath("$[0].usuario").doesNotExist())
                .andExpect(jsonPath("$[0].categorias").doesNotExist())
                .andExpect(jsonPath("$[0].senha").doesNotExist())
                .andReturn().getResponse().getContentAsString();

        Map<String, Object> item = JsonPath.read(body, "$[0]");
        assertThat(item).containsOnlyKeys("id", "nome", "descricao", "duracaoMinutos", "preco", "ativo");
    }

    private Usuario usuario(TipoUsuario tipo) {
        Usuario usuario = new Usuario();
        usuario.setNome("Usuario de teste");
        usuario.setEmail(UUID.randomUUID() + "@teste.com");
        usuario.setSenha("$2a$10$7EqJtq98hPqEX7fNZaFWoO5QG.8tME.vG8zE2hVQ2jJz0XQdZ7M.K");
        usuario.setTipo(tipo);
        return usuarioRepository.saveAndFlush(usuario);
    }

    private Prestador prestador() {
        Prestador perfil = new Prestador();
        perfil.setUsuario(usuario(TipoUsuario.PRESTADOR));
        perfil.setNomeNegocio("Negocio " + UUID.randomUUID());
        return prestadorRepository.saveAndFlush(perfil);
    }

    private Servico servico(Prestador prestadorDoServico, String nome, boolean ativo) {
        Servico servico = new Servico();
        servico.setPrestador(prestadorDoServico);
        servico.setNome(nome);
        servico.setDescricao("Servico de teste");
        servico.setDuracaoMinutos(30);
        servico.setPreco(new BigDecimal("50.25"));
        servico.setAtivo(ativo);
        return servicoRepository.saveAndFlush(servico);
    }

    private String url(UUID prestadorId) {
        return "/prestadores/" + prestadorId + "/servicos";
    }

    private MockHttpServletRequestBuilder autenticado(MockHttpServletRequestBuilder request, Usuario usuario) {
        return request.header("Authorization", "Bearer " + tokenConfig.generateToken(usuario));
    }
}
