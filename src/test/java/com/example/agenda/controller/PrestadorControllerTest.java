package com.example.agenda.controller;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import static org.mockito.Mockito.when;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.transaction.annotation.Transactional;

import com.example.agenda.config.TokenConfig;
import com.example.agenda.entity.Agendamento;
import com.example.agenda.entity.HorarioFuncionamento;
import com.example.agenda.entity.Prestador;
import com.example.agenda.entity.Servico;
import com.example.agenda.entity.Usuario;
import com.example.agenda.entity.enums.DiaSemana;
import com.example.agenda.entity.enums.StatusAgendamento;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.AgendamentoRepository;
import com.example.agenda.repository.HorarioFuncionamentoRepository;
import com.example.agenda.repository.PrestadorRepository;
import com.example.agenda.repository.ServicoRepository;
import com.example.agenda.repository.UsuarioRepository;
import com.jayway.jsonpath.JsonPath;

import jakarta.persistence.EntityManager;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PrestadorControllerTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private TokenConfig tokenConfig;
    @Autowired
    private UsuarioRepository usuarioRepository;
    @Autowired
    private PrestadorRepository prestadorRepository;
    @Autowired
    private HorarioFuncionamentoRepository horarioRepository;
    @Autowired
    private ServicoRepository servicoRepository;
    @Autowired
    private AgendamentoRepository agendamentoRepository;
    @Autowired
    private EntityManager entityManager;
    @MockitoBean
    private Clock clock;

    private Usuario dono;
    private Usuario outro;
    private Usuario cliente;
    private Usuario admin;
    private Prestador prestador;
    private final LocalDate data = LocalDate.of(2030, 1, 7);

    private static final String PERFIL = """
            {"nomeNegocio":"Barbearia Teste","descricao":"Cortes e barba",
             "endereco":"Rua Teste, 123","telefoneComercial":"48999999999"}
            """;
    private static final String HORARIO = """
            {"diaSemana":"SEG","horaInicio":"09:00","horaFim":"16:00",
             "intervaloInicio":"12:00","intervaloFim":"13:00"}
            """;

    @BeforeEach
    void preparar() {
        when(clock.instant()).thenReturn(Instant.parse("2030-01-06T12:00:00Z"));
        when(clock.getZone()).thenReturn(ZoneId.of("America/Sao_Paulo"));
        dono = usuario(TipoUsuario.PRESTADOR);
        outro = usuario(TipoUsuario.PRESTADOR);
        cliente = usuario(TipoUsuario.CLIENTE);
        admin = usuario(TipoUsuario.ADMIN);
        prestador = new Prestador();
        prestador.setUsuario(dono);
        prestador.setNomeNegocio("Negócio " + UUID.randomUUID());
        prestadorRepository.saveAndFlush(prestador);
    }

    private Usuario usuario(TipoUsuario tipo) {
        Usuario usuario = new Usuario();
        usuario.setNome("Usuário de teste");
        usuario.setEmail(UUID.randomUUID() + "@teste.com");
        usuario.setSenha("$2a$10$7EqJtq98hPqEX7fNZaFWoO5QG.8tME.vG8zE2hVQ2jJz0XQdZ7M.K");
        usuario.setTipo(tipo);
        return usuarioRepository.saveAndFlush(usuario);
    }

    private MockHttpServletRequestBuilder autenticado(MockHttpServletRequestBuilder request, Usuario usuario) {
        return request.header("Authorization", "Bearer " + tokenConfig.generateToken(usuario));
    }

    private String horariosUrl() {
        return "/prestadores/" + prestador.getId() + "/horarios";
    }

    private HorarioFuncionamento horario(DiaSemana dia, LocalTime inicio, LocalTime fim) {
        HorarioFuncionamento horario = new HorarioFuncionamento();
        horario.setPrestador(prestador);
        horario.setDiaSemana(dia);
        horario.setHoraInicio(inicio);
        horario.setHoraFim(fim);
        return horarioRepository.saveAndFlush(horario);
    }

    private Servico servico(Prestador prestadorDoServico, int duracao) {
        Servico servico = new Servico();
        servico.setPrestador(prestadorDoServico);
        servico.setNome("Serviço de teste");
        servico.setDuracaoMinutos(duracao);
        servico.setPreco(new BigDecimal("50.00"));
        return servicoRepository.saveAndFlush(servico);
    }

    private void reservar(Servico servico, LocalDate dia, LocalTime inicio, StatusAgendamento status) {
        Agendamento agendamento = new Agendamento();
        agendamento.setCliente(cliente);
        agendamento.setServico(servico);
        agendamento.setDataHora(dia.atTime(inicio));
        agendamento.setStatus(status);
        agendamentoRepository.saveAndFlush(agendamento);
    }

    @Test
    void crudDoPerfilVinculaAoUsuarioDoTokenEMantemAContaAoExcluir() throws Exception {
        String body = mockMvc.perform(autenticado(post("/prestadores"), outro)
                .contentType(MediaType.APPLICATION_JSON).content(PERFIL))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.usuarioId").value(outro.getId().toString()))
                .andExpect(jsonPath("$.ativo").value(true))
                .andExpect(jsonPath("$.senha").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");

        mockMvc.perform(autenticado(get("/prestadores/me"), outro))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        mockMvc.perform(autenticado(get("/prestadores/" + id), cliente))
                .andExpect(status().isOk()).andExpect(jsonPath("$.nomeNegocio").value("Barbearia Teste"));
        mockMvc.perform(autenticado(put("/prestadores/" + id), outro)
                .contentType(MediaType.APPLICATION_JSON).content(PERFIL.replace("Barbearia Teste", "Novo negócio")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.nomeNegocio").value("Novo negócio"));
        mockMvc.perform(autenticado(delete("/prestadores/" + id), outro)).andExpect(status().isNoContent());
        assertThat(prestadorRepository.existsById(UUID.fromString(id))).isFalse();
        assertThat(usuarioRepository.existsById(outro.getId())).isTrue();
    }

    @Test
    void criacaoRetornaLocationDoPerfil() throws Exception {
        mockMvc.perform(autenticado(post("/prestadores"), outro)
                .contentType(MediaType.APPLICATION_JSON).content(PERFIL))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", org.hamcrest.Matchers.startsWith("/prestadores/")));
    }

    @Test
    void usuarioNaoPodeCriarDoisPerfis() throws Exception {
        mockMvc.perform(autenticado(post("/prestadores"), dono)
                .contentType(MediaType.APPLICATION_JSON).content(PERFIL))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void clienteEAdminNaoPodemCriarPerfilDePrestador() throws Exception {
        for (Usuario usuario : new Usuario[]{cliente, admin}) {
            mockMvc.perform(autenticado(post("/prestadores"), usuario)
                    .contentType(MediaType.APPLICATION_JSON).content(PERFIL))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void perfilExigeNomeENaoAceitaCamposAcimaDoLimite() throws Exception {
        mockMvc.perform(autenticado(post("/prestadores"), outro)
                .contentType(MediaType.APPLICATION_JSON).content("{\"nomeNegocio\":\"   \"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isNotEmpty());
        mockMvc.perform(autenticado(put("/prestadores/" + prestador.getId()), dono)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nomeNegocio\":\"" + "a".repeat(151) + "\",\"descricao\":\"" + "a".repeat(501)
                        + "\",\"endereco\":\"" + "a".repeat(256) + "\",\"telefoneComercial\":\"" + "a".repeat(21) + "\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.length()").value(4));
    }

    @Test
    void outroPrestadorNaoPodeAlterarInativarOuExcluirOPerfil() throws Exception {
        String url = "/prestadores/" + prestador.getId();
        mockMvc.perform(autenticado(put(url), outro).contentType(MediaType.APPLICATION_JSON).content(PERFIL))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.status").value(403));
        mockMvc.perform(autenticado(patch(url + "/status"), outro)
                .contentType(MediaType.APPLICATION_JSON).content("{\"ativo\":false}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(autenticado(delete(url), outro)).andExpect(status().isForbidden());
    }

    @Test
    void clienteNaoPodeModificarPerfilOuHorarios() throws Exception {
        mockMvc.perform(autenticado(put("/prestadores/" + prestador.getId()), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(PERFIL))
                .andExpect(status().isForbidden());
        mockMvc.perform(autenticado(post(horariosUrl()), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(HORARIO))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminPodeGerenciarPerfilEHorarios() throws Exception {
        mockMvc.perform(autenticado(put("/prestadores/" + prestador.getId()), admin)
                .contentType(MediaType.APPLICATION_JSON).content(PERFIL))
                .andExpect(status().isOk());
        mockMvc.perform(autenticado(patch("/prestadores/" + prestador.getId() + "/status"), admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"ativo\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ativo").value(false));
        mockMvc.perform(autenticado(post(horariosUrl()), admin)
                .contentType(MediaType.APPLICATION_JSON).content(HORARIO))
                .andExpect(status().isCreated());
        mockMvc.perform(autenticado(delete("/prestadores/" + prestador.getId()), admin))
                .andExpect(status().isNoContent());
    }

    @Test
    void exclusaoRemoveHorariosEmCascata() throws Exception {
        HorarioFuncionamento horario = horario(DiaSemana.SEG, LocalTime.of(9, 0), LocalTime.of(16, 0));
        mockMvc.perform(autenticado(delete("/prestadores/" + prestador.getId()), dono)).andExpect(status().isNoContent());
        assertThat(horarioRepository.existsById(horario.getId())).isFalse();
        assertThat(usuarioRepository.existsById(dono.getId())).isTrue();
    }

    @Test
    void exclusaoComServicoVinculadoRetorna409EPreservaRegistros() throws Exception {
        Servico servico = servico(prestador, 60);
        reservar(servico, data, LocalTime.of(9, 0), StatusAgendamento.CONFIRMADO);
        mockMvc.perform(autenticado(delete("/prestadores/" + prestador.getId()), dono))
                .andExpect(status().isConflict());
        assertThat(prestadorRepository.existsById(prestador.getId())).isTrue();
        assertThat(servicoRepository.existsById(servico.getId())).isTrue();
    }

    @Test
    void inativacaoPreservaHorariosEServicosEReativacaoRecuperaDisponibilidade() throws Exception {
        horario(DiaSemana.SEG, LocalTime.of(9, 0), LocalTime.of(11, 0));
        Servico servico = servico(prestador, 60);
        String url = "/prestadores/" + prestador.getId();
        mockMvc.perform(autenticado(patch(url + "/status"), dono)
                .contentType(MediaType.APPLICATION_JSON).content("{\"ativo\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ativo").value(false));
        mockMvc.perform(autenticado(get(url + "/disponibilidade").param("servicoId", servico.getId().toString())
                .param("data", data.toString()), cliente))
                .andExpect(status().isOk()).andExpect(jsonPath("$.horarios").isEmpty());
        assertThat(horarioRepository.findByPrestadorId(prestador.getId())).hasSize(1);
        assertThat(servicoRepository.existsById(servico.getId())).isTrue();
        mockMvc.perform(autenticado(patch(url + "/status"), dono)
                .contentType(MediaType.APPLICATION_JSON).content("{\"ativo\":true}"))
                .andExpect(status().isOk());
        mockMvc.perform(autenticado(get(url + "/disponibilidade").param("servicoId", servico.getId().toString())
                .param("data", data.toString()), cliente))
                .andExpect(status().isOk()).andExpect(jsonPath("$.horarios.length()").value(2));
    }

    @Test
    void listagemPodeFiltrarPorStatus() throws Exception {
        prestador.setAtivo(false);
        prestadorRepository.saveAndFlush(prestador);
        mockMvc.perform(autenticado(get("/prestadores").param("ativo", "false"), cliente))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].ativo", org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.is(false))))
                .andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.hasItem(prestador.getId().toString())));
        mockMvc.perform(autenticado(get("/prestadores").param("ativo", "true"), cliente))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem(prestador.getId().toString()))));
    }

    @Test
    void consultasSemTokenRetornam401() throws Exception {
        mockMvc.perform(get("/prestadores")).andExpect(status().isUnauthorized());
        mockMvc.perform(get(horariosUrl())).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/prestadores/" + prestador.getId() + "/disponibilidade")
                .param("servicoId", UUID.randomUUID().toString()).param("data", data.toString()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void recursosInexistentesRetornam404Padronizado() throws Exception {
        mockMvc.perform(autenticado(get("/prestadores/" + UUID.randomUUID()), cliente))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.status").value(404));
        mockMvc.perform(autenticado(get("/prestadores/me"), outro)).andExpect(status().isNotFound());
        mockMvc.perform(autenticado(get(horariosUrl() + "/" + UUID.randomUUID()), cliente))
                .andExpect(status().isNotFound());
    }

    @Test
    void crudDeHorarioPermiteRemoverIntervaloEManterMesmoDiaNaEdicao() throws Exception {
        String body = mockMvc.perform(autenticado(post(horariosUrl()), dono)
                .contentType(MediaType.APPLICATION_JSON).content(HORARIO))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.diaSemana").value("SEG"))
                .andExpect(header().exists("Location"))
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");
        mockMvc.perform(autenticado(get(horariosUrl() + "/" + id), cliente))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        mockMvc.perform(autenticado(put(horariosUrl() + "/" + id), dono).contentType(MediaType.APPLICATION_JSON)
                .content("{\"diaSemana\":\"SEG\",\"horaInicio\":\"08:00\",\"horaFim\":\"17:00\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.horaInicio").value("08:00:00"))
                .andExpect(jsonPath("$.intervaloInicio").isEmpty());
        mockMvc.perform(autenticado(delete(horariosUrl() + "/" + id), dono)).andExpect(status().isNoContent());
        assertThat(horarioRepository.existsById(UUID.fromString(id))).isFalse();
    }

    @Test
    void horariosSaoListadosNaOrdemDaSemana() throws Exception {
        horario(DiaSemana.DOM, LocalTime.of(9, 0), LocalTime.of(16, 0));
        horario(DiaSemana.SEG, LocalTime.of(9, 0), LocalTime.of(16, 0));
        horario(DiaSemana.QUA, LocalTime.of(9, 0), LocalTime.of(16, 0));
        mockMvc.perform(autenticado(get(horariosUrl()), cliente)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].diaSemana").value("SEG"))
                .andExpect(jsonPath("$[1].diaSemana").value("QUA"))
                .andExpect(jsonPath("$[2].diaSemana").value("DOM"));
    }

    @Test
    void horarioDuplicadoOuMudancaParaDiaOcupadoRetorna409() throws Exception {
        horario(DiaSemana.SEG, LocalTime.of(9, 0), LocalTime.of(16, 0));
        HorarioFuncionamento terca = horario(DiaSemana.TER, LocalTime.of(9, 0), LocalTime.of(16, 0));
        mockMvc.perform(autenticado(post(horariosUrl()), dono).contentType(MediaType.APPLICATION_JSON).content(HORARIO))
                .andExpect(status().isConflict());
        mockMvc.perform(autenticado(put(horariosUrl() + "/" + terca.getId()), dono)
                .contentType(MediaType.APPLICATION_JSON).content(HORARIO))
                .andExpect(status().isConflict());
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "{}",
        "{\"diaSemana\":\"SEG\",\"horaInicio\":\"16:00\",\"horaFim\":\"09:00\"}",
        "{\"diaSemana\":\"SEG\",\"horaInicio\":\"09:00\",\"horaFim\":\"09:00\"}",
        "{\"diaSemana\":\"SEG\",\"horaInicio\":\"09:00\",\"horaFim\":\"16:00\",\"intervaloInicio\":\"12:00\"}",
        "{\"diaSemana\":\"SEG\",\"horaInicio\":\"09:00\",\"horaFim\":\"16:00\",\"intervaloFim\":\"13:00\"}",
        "{\"diaSemana\":\"SEG\",\"horaInicio\":\"09:00\",\"horaFim\":\"16:00\",\"intervaloInicio\":\"13:00\",\"intervaloFim\":\"12:00\"}",
        "{\"diaSemana\":\"SEG\",\"horaInicio\":\"09:00\",\"horaFim\":\"16:00\",\"intervaloInicio\":\"08:00\",\"intervaloFim\":\"10:00\"}",
        "{\"diaSemana\":\"SEG\",\"horaInicio\":\"09:00\",\"horaFim\":\"16:00\",\"intervaloInicio\":\"15:00\",\"intervaloFim\":\"17:00\"}"
    })
    void horarioInvalidoRetorna400ComMensagens(String body) throws Exception {
        mockMvc.perform(autenticado(post(horariosUrl()), dono).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isNotEmpty());
        assertThat(horarioRepository.findByPrestadorId(prestador.getId())).isEmpty();
    }

    @Test
    void outroPrestadorNaoPodeCriarEditarOuExcluirHorarios() throws Exception {
        HorarioFuncionamento horario = horario(DiaSemana.SEG, LocalTime.of(9, 0), LocalTime.of(16, 0));
        mockMvc.perform(autenticado(post(horariosUrl()), outro).contentType(MediaType.APPLICATION_JSON).content(HORARIO))
                .andExpect(status().isForbidden());
        mockMvc.perform(autenticado(put(horariosUrl() + "/" + horario.getId()), outro)
                .contentType(MediaType.APPLICATION_JSON).content(HORARIO))
                .andExpect(status().isForbidden());
        mockMvc.perform(autenticado(delete(horariosUrl() + "/" + horario.getId()), outro)).andExpect(status().isForbidden());
    }

    @Test
    void horarioNaoPodeSerAcessadoPeloIdDeOutroPrestador() throws Exception {
        HorarioFuncionamento horario = horario(DiaSemana.SEG, LocalTime.of(9, 0), LocalTime.of(16, 0));
        Prestador outroPerfil = new Prestador();
        outroPerfil.setUsuario(outro);
        outroPerfil.setNomeNegocio("Outro negócio");
        prestadorRepository.saveAndFlush(outroPerfil);
        String url = "/prestadores/" + outroPerfil.getId() + "/horarios/" + horario.getId();
        mockMvc.perform(autenticado(get(url), cliente)).andExpect(status().isNotFound());
        mockMvc.perform(autenticado(put(url), outro).contentType(MediaType.APPLICATION_JSON).content(HORARIO))
                .andExpect(status().isNotFound());
        mockMvc.perform(autenticado(delete(url), outro)).andExpect(status().isNotFound());
    }

    @Test
    void disponibilidadeDescontaAlmocoEPendentesEConfirmadosDeTodosOsServicos() throws Exception {
        HorarioFuncionamento horario = horario(DiaSemana.SEG, LocalTime.of(9, 0), LocalTime.of(16, 0));
        horario.setIntervaloInicio(LocalTime.of(12, 0));
        horario.setIntervaloFim(LocalTime.of(13, 0));
        horarioRepository.saveAndFlush(horario);
        Servico escolhido = servico(prestador, 60);
        Servico outroServico = servico(prestador, 30);
        reservar(outroServico, data, LocalTime.of(10, 0), StatusAgendamento.PENDENTE);
        reservar(outroServico, data, LocalTime.of(14, 30), StatusAgendamento.CONFIRMADO);
        reservar(escolhido, data, LocalTime.of(9, 0), StatusAgendamento.CANCELADO);
        reservar(escolhido, data, LocalTime.of(11, 0), StatusAgendamento.CONCLUIDO);
        Prestador outroPerfil = new Prestador();
        outroPerfil.setUsuario(outro);
        outroPerfil.setNomeNegocio("Outro negócio");
        prestadorRepository.saveAndFlush(outroPerfil);
        reservar(servico(outroPerfil, 60), data, LocalTime.of(13, 0), StatusAgendamento.CONFIRMADO);
        entityManager.clear();

        mockMvc.perform(autenticado(get("/prestadores/" + prestador.getId() + "/disponibilidade")
                .param("servicoId", escolhido.getId().toString()).param("data", data.toString()), cliente))
                .andExpect(status().isOk()).andExpect(jsonPath("$.duracaoMinutos").value(60))
                .andExpect(jsonPath("$.horarios.length()").value(4))
                .andExpect(jsonPath("$.horarios[0]").value("09:00:00"))
                .andExpect(jsonPath("$.horarios[1]").value("11:00:00"))
                .andExpect(jsonPath("$.horarios[2]").value("13:00:00"))
                .andExpect(jsonPath("$.horarios[3]").value("15:00:00"));
    }

    @Test
    void consultaNoPostgresIncluiReservaQueComecouNoDiaAnterior() throws Exception {
        horario(DiaSemana.SEG, LocalTime.MIDNIGHT, LocalTime.of(3, 0));
        Servico escolhido = servico(prestador, 60);
        reservar(servico(prestador, 120), data.minusDays(1), LocalTime.of(23, 30), StatusAgendamento.CONFIRMADO);
        entityManager.clear();
        mockMvc.perform(autenticado(get("/prestadores/" + prestador.getId() + "/disponibilidade")
                .param("servicoId", escolhido.getId().toString()).param("data", data.toString()), cliente))
                .andExpect(status().isOk()).andExpect(jsonPath("$.horarios.length()").value(1))
                .andExpect(jsonPath("$.horarios[0]").value("02:00:00"));
    }

    @Test
    void servicoInexistenteEOuDeOutroPrestadorSaoRecusados() throws Exception {
        String url = "/prestadores/" + prestador.getId() + "/disponibilidade";
        mockMvc.perform(autenticado(get(url).param("servicoId", UUID.randomUUID().toString())
                .param("data", data.toString()), cliente)).andExpect(status().isNotFound());
        Prestador outroPerfil = new Prestador();
        outroPerfil.setUsuario(outro);
        outroPerfil.setNomeNegocio("Outro negócio");
        prestadorRepository.saveAndFlush(outroPerfil);
        Servico servico = servico(outroPerfil, 60);
        mockMvc.perform(autenticado(get(url).param("servicoId", servico.getId().toString())
                .param("data", data.toString()), cliente)).andExpect(status().isBadRequest());
    }

    @Test
    void parametrosEJsonInvalidosRetornamErroPadronizado() throws Exception {
        mockMvc.perform(autenticado(get("/prestadores/id-invalido"), cliente))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400));
        String url = "/prestadores/" + prestador.getId() + "/disponibilidade";
        mockMvc.perform(autenticado(get(url).param("servicoId", UUID.randomUUID().toString())
                .param("data", "2030-02-30"), cliente))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").exists());
        mockMvc.perform(autenticado(get(url), cliente)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
        mockMvc.perform(autenticado(post(horariosUrl()), dono).contentType(MediaType.APPLICATION_JSON)
                .content(HORARIO.replace("SEG", "INVALIDO")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400));
        mockMvc.perform(autenticado(post(horariosUrl()), dono).contentType(MediaType.APPLICATION_JSON)
                .content(HORARIO.replace("09:00", "25:00")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400));
        mockMvc.perform(autenticado(patch("/prestadores/" + prestador.getId() + "/status"), dono)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isNotEmpty());
    }
    private static Stream<Arguments> camposPerfilComTiposInvalidos() {
        return Stream.of("nomeNegocio", "descricao", "endereco", "telefoneComercial")
                .flatMap(campo -> Stream.of("123", "12.5", "true", "[]", "{}")
                        .map(valor -> Arguments.of(campo, valor)));
    }

    private String perfilComCampo(String campo, String valorJson) {
        return "{\"" + campo + "\":" + valorJson
                + (campo.equals("nomeNegocio") ? "" : ",\"nomeNegocio\":\"Negócio válido\"") + "}";
    }

    @ParameterizedTest
    @MethodSource("camposPerfilComTiposInvalidos")
    void perfilRecusaTiposJsonIncorretosSemSalvar(String campo, String valorJson) throws Exception {
        mockMvc.perform(autenticado(post("/prestadores"), outro).contentType(MediaType.APPLICATION_JSON)
                .content(perfilComCampo(campo, valorJson)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400));
        assertThat(prestadorRepository.existsByUsuarioId(outro.getId())).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"nomeNegocio", "descricao", "endereco", "telefoneComercial"})
    void perfilRecusaCaractereNuloAntesDeChegarAoBanco(String campo) throws Exception {
        mockMvc.perform(autenticado(post("/prestadores"), outro).contentType(MediaType.APPLICATION_JSON)
                .content(perfilComCampo(campo, "\"antes\\u0000depois\"")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isNotEmpty());
        assertThat(prestadorRepository.existsByUsuarioId(outro.getId())).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"null", "0", "1", "-1", "0.5", "\"true\"", "\"false\"", "\"\"", "[]", "{}"})
    void statusExigeBooleanoJsonSemConverterNumerosOuTextos(String valorJson) throws Exception {
        mockMvc.perform(autenticado(patch("/prestadores/" + prestador.getId() + "/status"), dono)
                .contentType(MediaType.APPLICATION_JSON).content("{\"ativo\":" + valorJson + "}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400));
        assertThat(prestador.getAtivo()).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "{\"diaSemana\":0,\"horaInicio\":\"09:00\",\"horaFim\":\"16:00\"}",
        "{\"diaSemana\":\"0\",\"horaInicio\":\"09:00\",\"horaFim\":\"16:00\"}",
        "{\"diaSemana\":true,\"horaInicio\":\"09:00\",\"horaFim\":\"16:00\"}",
        "{\"diaSemana\":\"SEG\",\"horaInicio\":[9,0],\"horaFim\":\"16:00\"}",
        "{\"diaSemana\":\"SEG\",\"horaInicio\":\"09:00\",\"horaFim\":[16,0]}",
        "{\"diaSemana\":\"SEG\",\"horaInicio\":\"09:00\",\"horaFim\":\"16:00\",\"intervaloInicio\":[12,0],\"intervaloFim\":\"13:00\"}",
        "{\"diaSemana\":\"SEG\",\"horaInicio\":\"09:00\",\"horaFim\":\"16:00\",\"intervaloInicio\":\"12:00\",\"intervaloFim\":[13,0]}",
        "{\"diaSemana\":\"SEG\",\"horaInicio\":\"24:00\",\"horaFim\":\"23:59\"}",
        "{\"diaSemana\":\"SEG\",\"horaInicio\":\"09:00\",\"horaFim\":\"16:00:60\"}"
    })
    void horarioRecusaDiasNumericosOuHorasForaDoFormato(String body) throws Exception {
        mockMvc.perform(autenticado(post(horariosUrl()), dono).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400));
        assertThat(horarioRepository.findByPrestadorId(prestador.getId())).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"horaInicio", "horaFim", "intervaloInicio", "intervaloFim"})
    void horarioRecusaPrecisaoQueOBancoNaoPreserva(String campo) throws Exception {
        String hora = switch (campo) {
            case "horaInicio" -> "09:00:00.000000001";
            case "horaFim" -> "16:00:00.000000001";
            case "intervaloInicio" -> "12:00:00.000000001";
            default -> "13:00:00.000000001";
        };
        String body = HORARIO.replace("\"" + campo + "\":\"" + hora.substring(0, 5) + "\"",
                "\"" + campo + "\":\"" + hora + "\"");
        mockMvc.perform(autenticado(post(horariosUrl()), dono).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isNotEmpty());
        assertThat(horarioRepository.findByPrestadorId(prestador.getId())).isEmpty();
    }

    @Test
    void horariosQueFicariamIguaisAoGravarSaoRecusadosNaValidacao() throws Exception {
        mockMvc.perform(autenticado(post(horariosUrl()), dono).contentType(MediaType.APPLICATION_JSON)
                .content("{\"diaSemana\":\"SEG\",\"horaInicio\":\"09:00:00.000000001\",\"horaFim\":\"09:00:00.000000002\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isNotEmpty());
    }

    @Test
    void milissegundosValidosSaoPreservadosAoGravarEReler() throws Exception {
        String body = mockMvc.perform(autenticado(post(horariosUrl()), dono).contentType(MediaType.APPLICATION_JSON)
                .content("{\"diaSemana\":\"SEG\",\"horaInicio\":\"09:00:01.123\",\"horaFim\":\"10:00:02.456\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");
        entityManager.clear();
        mockMvc.perform(autenticado(get(horariosUrl() + "/" + id), cliente))
                .andExpect(status().isOk()).andExpect(jsonPath("$.horaInicio").value("09:00:01.123"))
                .andExpect(jsonPath("$.horaFim").value("10:00:02.456"));
    }

    @Test
    void perfilAceitaLimitesExatosETextosComAcentos() throws Exception {
        String nome = "á".repeat(150);
        String descricao = "ç".repeat(500);
        String endereco = "é".repeat(255);
        String telefone = "1".repeat(20);
        String body = "{\"nomeNegocio\":\"" + nome + "\",\"descricao\":\"" + descricao
                + "\",\"endereco\":\"" + endereco + "\",\"telefoneComercial\":\"" + telefone + "\"}";
        String response = mockMvc.perform(autenticado(post("/prestadores"), outro)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(response, "$.id");
        entityManager.clear();
        mockMvc.perform(autenticado(get("/prestadores/" + id), cliente)).andExpect(status().isOk())
                .andExpect(jsonPath("$.nomeNegocio").value(nome)).andExpect(jsonPath("$.descricao").value(descricao))
                .andExpect(jsonPath("$.endereco").value(endereco)).andExpect(jsonPath("$.telefoneComercial").value(telefone));
    }

    @Test
    void camposOpcionaisAceitamNullEUpdateInvalidoPreservaPerfil() throws Exception {
        mockMvc.perform(autenticado(put("/prestadores/" + prestador.getId()), dono).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nomeNegocio\":\"Nome válido\",\"descricao\":null,\"endereco\":null,\"telefoneComercial\":null}"))
                .andExpect(status().isOk());
        entityManager.flush();
        mockMvc.perform(autenticado(put("/prestadores/" + prestador.getId()), dono).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nomeNegocio\":false}"))
                .andExpect(status().isBadRequest());
        entityManager.clear();
        mockMvc.perform(autenticado(get("/prestadores/" + prestador.getId()), cliente)).andExpect(status().isOk())
                .andExpect(jsonPath("$.nomeNegocio").value("Nome válido"));
    }

    @Test
    void usuarioESituacaoNaoPodemSerEscolhidosNoCadastroDoPerfil() throws Exception {
        String body = PERFIL.strip().replace("}", ",\"usuarioId\":\"" + dono.getId() + "\",\"ativo\":false}");
        mockMvc.perform(autenticado(post("/prestadores"), outro).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.usuarioId").value(outro.getId().toString()))
                .andExpect(jsonPath("$.ativo").value(true));
    }

    @ParameterizedTest
    @ValueSource(strings = {"+999999999-12-31", "+10000-01-07", "0000-01-07"})
    void disponibilidadeRecusaDatasForaDaFaixaAntesDaConsultaSql(String dataInvalida) throws Exception {
        LocalDate dia = LocalDate.parse(dataInvalida);
        horario(DiaSemana.values()[dia.getDayOfWeek().getValue() - 1], LocalTime.of(9, 0), LocalTime.of(10, 0));
        Servico servico = servico(prestador, 60);
        mockMvc.perform(autenticado(get("/prestadores/" + prestador.getId() + "/disponibilidade")
                .param("servicoId", servico.getId().toString()).param("data", dataInvalida), cliente))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "null", "[]", "{}", "{", "\"texto\""})
    void cadastroRecusaCorpoAusenteOuEstruturaInvalida(String body) throws Exception {
        mockMvc.perform(autenticado(post("/prestadores"), outro).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void disponibilidadeAceitaDatasNosLimitesDaFaixaComPostgres() throws Exception {
        horario(DiaSemana.SEX, LocalTime.of(9, 0), LocalTime.of(10, 0));
        Servico servico = servico(prestador, 60);
        String url = "/prestadores/" + prestador.getId() + "/disponibilidade";
        mockMvc.perform(autenticado(get(url).param("servicoId", servico.getId().toString())
                .param("data", "9999-12-31"), cliente))
                .andExpect(status().isOk()).andExpect(jsonPath("$.horarios.length()").value(1))
                .andExpect(jsonPath("$.horarios[0]").value("09:00:00"));
        mockMvc.perform(autenticado(get(url).param("servicoId", servico.getId().toString())
                .param("data", "0001-01-01"), cliente))
                .andExpect(status().isOk()).andExpect(jsonPath("$.horarios").isEmpty());
    }
}
