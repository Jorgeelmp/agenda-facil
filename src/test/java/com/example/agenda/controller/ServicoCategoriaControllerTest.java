package com.example.agenda.controller;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.springframework.transaction.annotation.Transactional;
import com.example.agenda.config.TokenConfig;
import com.example.agenda.entity.*;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.*;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ServicoCategoriaControllerTest {
    @Autowired MockMvc mvc;
    @Autowired TokenConfig tokens;
    @Autowired UsuarioRepository usuarios;
    @Autowired PrestadorRepository prestadores;
    @Autowired ServicoRepository servicos;
    @Autowired CategoriaRepository categorias;
    @Autowired AgendamentoRepository agendamentos;
    @Autowired EntityManager em;
    Usuario dono, outro, cliente, admin;
    Prestador perfil;
    Categoria beleza, saude;

    @BeforeEach
    void preparar() {
        dono = usuario(TipoUsuario.PRESTADOR);
        outro = usuario(TipoUsuario.PRESTADOR);
        cliente = usuario(TipoUsuario.CLIENTE);
        admin = usuario(TipoUsuario.ADMIN);
        perfil = perfil(dono);
        beleza = categoria("Beleza ");
        saude = categoria("Saúde ");
    }

    @Test
    void rotasExigemAutenticacao() throws Exception {
        mvc.perform(get("/categorias")).andExpect(status().isUnauthorized());
        mvc.perform(get("/servicos")).andExpect(status().isUnauthorized());
        mvc.perform(post(base()).contentType(MediaType.APPLICATION_JSON).content(body())).andExpect(status().isUnauthorized());
    }

    @Test
    void adminFazCrudDeCategoriasComNormalizacao() throws Exception {
        String nome = "Categoria " + UUID.randomUUID();
        String response = mvc.perform(auth(post("/categorias"), admin).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"  " + nome + "  \",\"descricao\":\" descrição \"}"))
                .andExpect(status().isCreated()).andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.nome").value(nome)).andExpect(jsonPath("$.descricao").value("descrição"))
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(response, "$.id");
        mvc.perform(auth(get("/categorias/" + id), cliente)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        mvc.perform(auth(put("/categorias/" + id), admin).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"" + nome + " editada\",\"descricao\":\"  \"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.descricao").isEmpty());
        mvc.perform(auth(get("/categorias"), dono)).andExpect(status().isOk());
        mvc.perform(auth(delete("/categorias/" + id), admin)).andExpect(status().isNoContent());
        mvc.perform(auth(get("/categorias/" + id), admin)).andExpect(status().isNotFound());
    }

    @Test
    void apenasAdminGerenciaCategorias() throws Exception {
        for (Usuario usuario : List.of(dono, cliente)) {
            mvc.perform(auth(post("/categorias"), usuario).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"nome\":\"Nova\"}")).andExpect(status().isForbidden());
            mvc.perform(auth(put("/categorias/" + beleza.getId()), usuario).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"nome\":\"Outra\"}")).andExpect(status().isForbidden());
            mvc.perform(auth(delete("/categorias/" + beleza.getId()), usuario)).andExpect(status().isForbidden());
        }
    }

    @Test
    void categoriaDuplicadaIgnoraCaixaEEspacos() throws Exception {
        mvc.perform(auth(post("/categorias"), admin).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"  " + beleza.getNome().toUpperCase() + "  \"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("Já existe uma categoria com este nome"));
        mvc.perform(auth(put("/categorias/" + saude.getId()), admin).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"" + beleza.getNome() + "\"}"))
                .andExpect(status().isConflict());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"nome\":\"  \"}", "{\"nome\":123}", "{\"nome\":\"Nova\",\"descricao\":false}"})
    void categoriaRejeitaEntradaInvalida(String body) throws Exception {
        mvc.perform(auth(post("/categorias"), admin).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void categoriaLimitaTamanhoETrataInexistente() throws Exception {
        mvc.perform(auth(post("/categorias"), admin).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"" + "x".repeat(101) + "\"}" )).andExpect(status().isBadRequest());
        mvc.perform(auth(post("/categorias"), admin).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"Nova\",\"descricao\":\"" + "x".repeat(256) + "\"}" )).andExpect(status().isBadRequest());
        mvc.perform(auth(delete("/categorias/" + UUID.randomUUID()), admin)).andExpect(status().isNotFound());
    }

    @Test
    void donoFazCrudComMultiplasCategoriasSemExporUsuario() throws Exception {
        String result = mvc.perform(auth(post(base()), dono).contentType(MediaType.APPLICATION_JSON).content(body()))
                .andExpect(status().isCreated()).andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.categorias.length()").value(2)).andExpect(jsonPath("$.prestadorId").value(perfil.getId().toString()))
                .andExpect(jsonPath("$.prestador").doesNotExist()).andExpect(jsonPath("$.senha").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        UUID id = UUID.fromString(JsonPath.read(result, "$.id"));
        em.clear();
        mvc.perform(auth(get(base() + "/" + id), cliente)).andExpect(status().isOk()).andExpect(jsonPath("$.categorias.length()").value(2));
        mvc.perform(auth(put(base() + "/" + id), dono).contentType(MediaType.APPLICATION_JSON)
                .content(body().replace("\"Corte\"", "\" Corte novo \"").replace(",\"" + saude.getId() + "\"", "")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.nome").value("Corte novo"))
                .andExpect(jsonPath("$.categorias.length()").value(1));
        em.flush();
        em.clear();
        assertThat(servicos.findById(id).orElseThrow().getCategorias()).extracting(Categoria::getId).containsExactly(beleza.getId());
        mvc.perform(auth(delete(base() + "/" + id), dono)).andExpect(status().isNoContent());
        assertThat(categorias.existsById(beleza.getId())).isTrue();
        assertThat(categorias.existsById(saude.getId())).isTrue();
        assertThat(servicos.existsById(id)).isFalse();
    }

    @Test
    void clienteEOutroPrestadorNaoGerenciamServicos() throws Exception {
        Servico servico = servico("Corte", "50.00", true, perfil, beleza);
        for (Usuario usuario : List.of(cliente, outro)) {
            mvc.perform(auth(post(base()), usuario).contentType(MediaType.APPLICATION_JSON).content(body())).andExpect(status().isForbidden());
            mvc.perform(auth(get(base() + "/gestao"), usuario)).andExpect(status().isForbidden());
            mvc.perform(auth(put(base() + "/" + servico.getId()), usuario).contentType(MediaType.APPLICATION_JSON).content(body())).andExpect(status().isForbidden());
            mvc.perform(auth(delete(base() + "/" + servico.getId()), usuario)).andExpect(status().isForbidden());
        }
        assertThat(servicos.existsById(servico.getId())).isTrue();
    }

    @Test
    void adminPodeGerenciarServicoDeQualquerPrestador() throws Exception {
        String response = mvc.perform(auth(post(base()), admin).contentType(MediaType.APPLICATION_JSON).content(body()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(response, "$.id");
        mvc.perform(auth(put(base() + "/" + id), admin).contentType(MediaType.APPLICATION_JSON).content(body())).andExpect(status().isOk());
        mvc.perform(auth(delete(base() + "/" + id), admin)).andExpect(status().isNoContent());
    }

    @Test
    void servicoDeOutroPerfilNaoPodeSerAcessadoPelaUrlDoDono() throws Exception {
        Servico servico = servico("Outro", "10", true, perfil(outro), beleza);
        mvc.perform(auth(get(base() + "/" + servico.getId()), dono)).andExpect(status().isNotFound());
        mvc.perform(auth(put(base() + "/" + servico.getId()), dono).contentType(MediaType.APPLICATION_JSON).content(body())).andExpect(status().isNotFound());
        mvc.perform(auth(delete(base() + "/" + servico.getId()), dono)).andExpect(status().isNotFound());
    }

    static Stream<String> entradasInvalidas() {
        return Stream.of("{}", "\"nome\":\" \"", "\"nome\":42", "\"nome\":\"" + "a".repeat(151) + "\"",
                "\"descricao\":\"" + "a".repeat(501) + "\"", "\"duracaoMinutos\":0", "\"duracaoMinutos\":-1",
                "\"duracaoMinutos\":1441", "\"duracaoMinutos\":30.5", "\"duracaoMinutos\":\"30\"",
                "\"duracaoMinutos\":null", "\"duracaoMinutos\":2147483648", "\"preco\":-0.01", "\"preco\":12.345",
                "\"preco\":100000000", "\"preco\":null", "\"preco\":\"10.00\"", "\"ativo\":null",
                "\"ativo\":\"true\"", "\"categoriaIds\":[]", "\"categoriaIds\":[null]", "\"categoriaIds\":null");
    }

    @ParameterizedTest
    @MethodSource("entradasInvalidas")
    void servicoValidaCamposETiposJson(String fragmento) throws Exception {
        String json = fragmento.equals("{}") ? "{}" : substituir(body(), fragmento);
        mvc.perform(auth(post(base()), dono).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void servicoAceitaPrecoZeroEDuracaoMinima() throws Exception {
        mvc.perform(auth(post(base()), dono).contentType(MediaType.APPLICATION_JSON)
                .content(body().replace("50.25", "0").replace("\"duracaoMinutos\":30", "\"duracaoMinutos\":1")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.preco").value(0));
    }

    @Test
    void categoriaInexistenteNaoAlteraServicoNemAssociacoes() throws Exception {
        Servico s = servico("Original", "25", true, perfil, beleza);
        mvc.perform(auth(put(base() + "/" + s.getId()), dono).contentType(MediaType.APPLICATION_JSON)
                .content(body().replace(saude.getId().toString(), UUID.randomUUID().toString())))
                .andExpect(status().isNotFound());
        em.clear();
        Servico salvo = servicos.findById(s.getId()).orElseThrow();
        assertThat(salvo.getNome()).isEqualTo("Original");
        assertThat(salvo.getCategorias()).extracting(Categoria::getId).containsExactly(beleza.getId());
    }

    @Test
    void filtrosCombinamCategoriaPrecoENomeSemDuplicarServicos() throws Exception {
        String nome = "Filtro-" + UUID.randomUUID();
        Servico s = servico(nome, "50", true, perfil, beleza, saude);
        servico(nome + " caro", "80", true, perfil, beleza);
        servico(nome + " outra categoria", "50", true, perfil, saude);
        servico(nome + " inativo", "50", false, perfil, beleza);
        Prestador inativo = perfil(outro);
        inativo.setAtivo(false);
        prestadores.saveAndFlush(inativo);
        servico(nome + " perfil inativo", "50", true, inativo, beleza);
        em.clear();
        mvc.perform(auth(get("/servicos").param("categoriaId", beleza.getId().toString()).param("precoMin", "50")
                .param("precoMax", "50").param("nome", nome.toUpperCase()), cliente))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(s.getId().toString()))
                .andExpect(jsonPath("$[0].categorias.length()").value(2));
        mvc.perform(auth(get("/servicos").param("nome", nome), cliente))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    void consultasDeServicosECategoriasAtendemRnf06NoCenarioLocal() throws Exception {
        String prefixo = "Consulta " + UUID.randomUUID();
        for (int i = 0; i < 100; i++) {
            servico(prefixo + " " + i, "50", true, perfil, beleza, saude);
        }
        var catalogo = auth(get("/servicos").param("nome", prefixo).param("categoriaId", beleza.getId().toString())
                .param("precoMin", "50").param("precoMax", "50"), cliente);
        var gestao = auth(get(base() + "/gestao"), dono);
        var listaCategorias = auth(get("/categorias"), cliente);
        for (var consulta : List.of(catalogo, gestao, listaCategorias)) {
            mvc.perform(consulta).andExpect(status().isOk());
            long total = 0;
            for (int i = 0; i < 10; i++) {
                em.clear();
                long inicio = System.nanoTime();
                mvc.perform(consulta).andExpect(status().isOk());
                total += System.nanoTime() - inicio;
            }
            double mediaMs = total / 10_000_000.0;
            System.out.printf("RNF06 Leandro: média de %.2f ms (100 serviços, 2 categorias, 10 consultas)%n", mediaMs);
            assertThat(mediaMs).isLessThan(1000.0);
        }
    }

    @Test
    void buscaTrataCoringasComoTextoLiteral() throws Exception {
        String nome = UUID.randomUUID().toString();
        servico(nome + " 100%_", "10", true, perfil, beleza);
        servico(nome + " 100XX", "10", true, perfil, beleza);
        mvc.perform(auth(get("/servicos").param("nome", nome + " 100%_"), cliente))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }

    @ParameterizedTest
    @ValueSource(strings = {"precoMin=-1", "precoMax=1.234", "precoMax=100000000", "precoMin=abc", "precoMin=30&precoMax=20", "categoriaId=invalido"})
    void filtrosInvalidosRetornam400(String query) throws Exception {
        mvc.perform(auth(get("/servicos?" + query), cliente)).andExpect(status().isBadRequest());
    }

    @Test
    void categoriaDeFiltroInexistenteRetorna404() throws Exception {
        mvc.perform(auth(get("/servicos").param("categoriaId", UUID.randomUUID().toString()), cliente)).andExpect(status().isNotFound());
    }

    @Test
    void gestaoIncluiInativosECatalogoNao() throws Exception {
        Servico inativo = servico("Inativo " + UUID.randomUUID(), "10", false, perfil, beleza);
        mvc.perform(auth(get(base() + "/gestao"), dono)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].ativo").value(false));
        mvc.perform(auth(get(base() + "/" + inativo.getId()), cliente)).andExpect(status().isForbidden());
        mvc.perform(auth(get(base() + "/" + inativo.getId()), dono)).andExpect(status().isOk());
        mvc.perform(auth(get("/servicos").param("nome", inativo.getNome()), cliente)).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void categoriaVinculadaNaoPodeSerExcluidaMesmoEmServicoInativo() throws Exception {
        servico("Vinculado", "10", false, perfil, beleza);
        mvc.perform(auth(delete("/categorias/" + beleza.getId()), admin)).andExpect(status().isConflict());
        assertThat(categorias.existsById(beleza.getId())).isTrue();
    }

    @Test
    void bancoTambemImpedeExclusaoDeCategoriaVinculadaSemCascata() {
        servico("Vinculado", "10", true, perfil, beleza);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> em.createNativeQuery("delete from categoria where id = :id")
                .setParameter("id", beleza.getId()).executeUpdate()).isInstanceOf(jakarta.persistence.PersistenceException.class);
    }

    @Test
    void bancoGaranteNomeDeCategoriaUnicoIgnorandoCaixaEEspacos() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> em.createNativeQuery(
                "insert into categoria (id, nome) values (:id, :nome)")
                .setParameter("id", UUID.randomUUID()).setParameter("nome", " " + beleza.getNome().toUpperCase() + " ")
                .executeUpdate()).isInstanceOf(jakarta.persistence.PersistenceException.class);
    }

    @Test
    void historicoImpedeExclusaoEMudancaDeDuracaoMasPermiteInativar() throws Exception {
        Servico s = servico("Corte", "50.25", true, perfil, beleza, saude);
        Agendamento ag = new Agendamento();
        ag.setCliente(cliente);
        ag.setServico(s);
        ag.setDataHora(LocalDateTime.of(2026, 1, 1, 10, 0));
        agendamentos.saveAndFlush(ag);
        mvc.perform(auth(delete(base() + "/" + s.getId()), dono)).andExpect(status().isConflict());
        mvc.perform(auth(put(base() + "/" + s.getId()), dono).contentType(MediaType.APPLICATION_JSON)
                .content(body().replace("\"duracaoMinutos\":30", "\"duracaoMinutos\":60")))
                .andExpect(status().isConflict());
        mvc.perform(auth(put(base() + "/" + s.getId()), dono).contentType(MediaType.APPLICATION_JSON)
                .content(body().replace("\"ativo\":true", "\"ativo\":false")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ativo").value(false));
        assertThat(agendamentos.existsById(ag.getId())).isTrue();
    }

    private String substituir(String json, String fragmento) {
        String field = fragmento.substring(0, fragmento.indexOf(':'));
        return json.replaceAll(java.util.regex.Pattern.quote(field) + ":(?:\\[[^\\]]*\\]|\"[^\"]*\"|[^,}]+)",
                java.util.regex.Matcher.quoteReplacement(fragmento));
    }

    private String body() {
        return "{\"nome\":\"Corte\",\"descricao\":null,\"duracaoMinutos\":30,\"preco\":50.25,\"ativo\":true,\"categoriaIds\":[\""
                + beleza.getId() + "\",\"" + saude.getId() + "\"]}";
    }

    private String base() { return "/prestadores/" + perfil.getId() + "/servicos"; }
    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request, Usuario user) {
        return request.header("Authorization", "Bearer " + tokens.generateToken(user));
    }
    private Usuario usuario(TipoUsuario tipo) {
        Usuario u = new Usuario();
        u.setNome("Teste Leandro"); u.setEmail(UUID.randomUUID() + "@teste.com"); u.setSenha("hash-teste"); u.setTipo(tipo);
        return usuarios.saveAndFlush(u);
    }
    private Prestador perfil(Usuario usuario) {
        Prestador p = new Prestador(); p.setUsuario(usuario); p.setNomeNegocio("Negócio " + UUID.randomUUID());
        return prestadores.saveAndFlush(p);
    }
    private Categoria categoria(String prefixo) {
        Categoria c = new Categoria(); c.setNome(prefixo + UUID.randomUUID()); return categorias.saveAndFlush(c);
    }
    private Servico servico(String nome, String preco, boolean ativo, Prestador p, Categoria... cats) {
        Servico s = new Servico(); s.setPrestador(p); s.setNome(nome); s.setPreco(new BigDecimal(preco));
        s.setDuracaoMinutos(30); s.setAtivo(ativo); s.setCategorias(new HashSet<>(List.of(cats)));
        return servicos.saveAndFlush(s);
    }
}
