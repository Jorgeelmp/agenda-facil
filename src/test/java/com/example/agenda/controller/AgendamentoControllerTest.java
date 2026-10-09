package com.example.agenda.controller;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.when;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
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

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AgendamentoControllerTest {

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
    @MockitoBean
    private Clock clock;

    private Usuario donoPrestador;
    private Usuario outroPrestador;
    private Usuario cliente;
    private Usuario outroCliente;
    private Usuario admin;
    private Prestador prestador;
    private Servico servico;
    // Segunda-feira; o relógio está no domingo anterior, às 09:00 de Brasília.
    private final LocalDate data = LocalDate.of(2030, 1, 7);

    @BeforeEach
    void preparar() {
        relogio("2030-01-06T12:00:00Z");
        donoPrestador = usuario(TipoUsuario.PRESTADOR);
        outroPrestador = usuario(TipoUsuario.PRESTADOR);
        cliente = usuario(TipoUsuario.CLIENTE);
        outroCliente = usuario(TipoUsuario.CLIENTE);
        admin = usuario(TipoUsuario.ADMIN);
        prestador = new Prestador();
        prestador.setUsuario(donoPrestador);
        prestador.setNomeNegocio("Negócio " + UUID.randomUUID());
        prestadorRepository.saveAndFlush(prestador);

        HorarioFuncionamento horario = new HorarioFuncionamento();
        horario.setPrestador(prestador);
        horario.setDiaSemana(DiaSemana.SEG);
        horario.setHoraInicio(LocalTime.of(9, 0));
        horario.setHoraFim(LocalTime.of(16, 0));
        horario.setIntervaloInicio(LocalTime.of(12, 0));
        horario.setIntervaloFim(LocalTime.of(13, 0));
        horarioRepository.saveAndFlush(horario);

        servico = servico(60);
    }

    private void relogio(String instante) {
        when(clock.instant()).thenReturn(Instant.parse(instante));
        when(clock.getZone()).thenReturn(ZoneId.of("America/Sao_Paulo"));
    }

    private Usuario usuario(TipoUsuario tipo) {
        Usuario usuario = new Usuario();
        usuario.setNome("Usuário de teste");
        usuario.setEmail(UUID.randomUUID() + "@teste.com");
        usuario.setSenha("$2a$10$7EqJtq98hPqEX7fNZaFWoO5QG.8tME.vG8zE2hVQ2jJz0XQdZ7M.K");
        usuario.setTipo(tipo);
        return usuarioRepository.saveAndFlush(usuario);
    }

    private Servico servico(int duracao) {
        Servico novo = new Servico();
        novo.setPrestador(prestador);
        novo.setNome("Serviço de " + duracao + " min");
        novo.setDuracaoMinutos(duracao);
        novo.setPreco(new BigDecimal("50.00"));
        return servicoRepository.saveAndFlush(novo);
    }

    private Agendamento reservar(Usuario dono, LocalTime inicio, StatusAgendamento status) {
        Agendamento agendamento = new Agendamento();
        agendamento.setCliente(dono);
        agendamento.setServico(servico);
        agendamento.setDataHora(data.atTime(inicio));
        agendamento.setStatus(status);
        return agendamentoRepository.saveAndFlush(agendamento);
    }

    private MockHttpServletRequestBuilder autenticado(MockHttpServletRequestBuilder request, Usuario usuario) {
        return request.header("Authorization", "Bearer " + tokenConfig.generateToken(usuario));
    }

    private String corpo(Servico servicoReservado, String dataHora, String observacoes) {
        return "{\"servicoId\":\"" + servicoReservado.getId() + "\",\"dataHora\":\"" + dataHora + "\""
                + (observacoes == null ? "" : ",\"observacoes\":\"" + observacoes + "\"") + "}";
    }

    private ResultActions agendar(Usuario usuario, String dataHora) throws Exception {
        return mockMvc.perform(autenticado(post("/agendamentos"), usuario)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(servico, dataHora, null)));
    }

    private ResultActions alterarStatus(Agendamento agendamento, Usuario usuario, String status) throws Exception {
        return mockMvc.perform(autenticado(patch("/agendamentos/" + agendamento.getId() + "/status"), usuario)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + status + "\"}"));
    }

    private ResultActions disponibilidade() throws Exception {
        return mockMvc.perform(autenticado(get("/prestadores/" + prestador.getId() + "/disponibilidade")
                .param("servicoId", servico.getId().toString()).param("data", data.toString()), cliente));
    }

    @Test
    void clienteAgendaHorarioLivreEOHorarioSaiDaDisponibilidade() throws Exception {
        String body = mockMvc.perform(autenticado(post("/agendamentos"), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(servico, "2030-01-07T09:00:00", "Primeira vez")))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/agendamentos/")))
                .andExpect(jsonPath("$.status").value("PENDENTE"))
                .andExpect(jsonPath("$.clienteId").value(cliente.getId().toString()))
                .andExpect(jsonPath("$.prestadorId").value(prestador.getId().toString()))
                .andExpect(jsonPath("$.servicoId").value(servico.getId().toString()))
                .andExpect(jsonPath("$.dataHora").value("2030-01-07T09:00:00"))
                .andExpect(jsonPath("$.dataHoraFim").value("2030-01-07T10:00:00"))
                .andExpect(jsonPath("$.observacoes").value("Primeira vez"))
                .andReturn().getResponse().getContentAsString();

        assertThat(agendamentoRepository.existsById(UUID.fromString(JsonPath.read(body, "$.id")))).isTrue();
        disponibilidade().andExpect(status().isOk())
                .andExpect(jsonPath("$.horarios").value(not(hasItem("09:00:00"))))
                .andExpect(jsonPath("$.horarios[0]").value("10:00:00"));
    }

    @Test
    void naoPermiteAgendarHorarioOcupadoForaDaGradeOuForaDoExpediente() throws Exception {
        reservar(outroCliente, LocalTime.of(10, 0), StatusAgendamento.CONFIRMADO);

        agendar(cliente, "2030-01-07T10:00:00").andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(startsWith("Horário indisponível")));
        agendar(cliente, "2030-01-07T09:30:00").andExpect(status().isConflict());
        agendar(cliente, "2030-01-07T12:00:00").andExpect(status().isConflict());
        agendar(cliente, "2030-01-07T16:00:00").andExpect(status().isConflict());
        // Terça-feira não tem horário de funcionamento.
        agendar(cliente, "2030-01-08T09:00:00").andExpect(status().isConflict());
    }

    @Test
    void agendamentoCanceladoLiberaOHorario() throws Exception {
        reservar(outroCliente, LocalTime.of(10, 0), StatusAgendamento.CANCELADO);
        agendar(cliente, "2030-01-07T10:00:00").andExpect(status().isCreated());
    }

    @Test
    void naoPermiteAgendarNoPassado() throws Exception {
        agendar(cliente, "2030-01-06T08:00:00").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Data e hora do agendamento devem estar no futuro"));
    }

    @Test
    void naoPermiteAgendarServicoOuPrestadorInativo() throws Exception {
        servico.setAtivo(false);
        servicoRepository.saveAndFlush(servico);
        agendar(cliente, "2030-01-07T09:00:00").andExpect(status().isBadRequest());

        servico.setAtivo(true);
        servicoRepository.saveAndFlush(servico);
        prestador.setAtivo(false);
        prestadorRepository.saveAndFlush(prestador);
        agendar(cliente, "2030-01-07T09:00:00").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Serviço indisponível para agendamento"));
    }

    @Test
    void somenteClientesPodemAgendar() throws Exception {
        for (Usuario usuario : new Usuario[]{donoPrestador, admin}) {
            agendar(usuario, "2030-01-07T09:00:00").andExpect(status().isForbidden());
        }
        mockMvc.perform(post("/agendamentos").contentType(MediaType.APPLICATION_JSON)
                .content(corpo(servico, "2030-01-07T09:00:00", null)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void validaCamposDoAgendamento() throws Exception {
        mockMvc.perform(autenticado(post("/agendamentos"), cliente)
                .contentType(MediaType.APPLICATION_JSON).content("{\"observacoes\":\"" + "a".repeat(501) + "\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.length()").value(3));
        mockMvc.perform(autenticado(post("/agendamentos"), cliente)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"servicoId\":\"" + servico.getId() + "\",\"dataHora\":20300107}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(autenticado(post("/agendamentos"), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(servico, "07/01/2030 09:00", null)))
                .andExpect(status().isBadRequest());
        mockMvc.perform(autenticado(post("/agendamentos"), cliente)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"servicoId\":\"" + UUID.randomUUID() + "\",\"dataHora\":\"2030-01-07T09:00:00\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void listagemMostraSomenteOsAgendamentosDeCadaPerfil() throws Exception {
        Agendamento meu = reservar(cliente, LocalTime.of(9, 0), StatusAgendamento.PENDENTE);
        Agendamento deOutro = reservar(outroCliente, LocalTime.of(10, 0), StatusAgendamento.CONFIRMADO);

        mockMvc.perform(autenticado(get("/agendamentos"), cliente))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(meu.getId().toString()));
        mockMvc.perform(autenticado(get("/agendamentos"), donoPrestador))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(deOutro.getId().toString()));
        mockMvc.perform(autenticado(get("/agendamentos").param("status", "CONFIRMADO"), donoPrestador))
                .andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(autenticado(get("/agendamentos"), outroPrestador))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(autenticado(get("/agendamentos"), admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id").value(hasItem(meu.getId().toString())))
                .andExpect(jsonPath("$[*].id").value(hasItem(deOutro.getId().toString())));
        mockMvc.perform(autenticado(get("/agendamentos").param("status", "INVALIDO"), cliente))
                .andExpect(status().isBadRequest());
    }

    @Test
    void detalheSoPodeSerVistoPelosEnvolvidos() throws Exception {
        Agendamento agendamento = reservar(cliente, LocalTime.of(9, 0), StatusAgendamento.PENDENTE);
        String url = "/agendamentos/" + agendamento.getId();
        for (Usuario usuario : new Usuario[]{cliente, donoPrestador, admin}) {
            mockMvc.perform(autenticado(get(url), usuario)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.servicoNome").value(servico.getNome()));
        }
        for (Usuario usuario : new Usuario[]{outroCliente, outroPrestador}) {
            mockMvc.perform(autenticado(get(url), usuario)).andExpect(status().isForbidden());
        }
        mockMvc.perform(autenticado(get("/agendamentos/" + UUID.randomUUID()), cliente))
                .andExpect(status().isNotFound());
    }

    @Test
    void clienteRemarcaParaHorarioLivreEVoltaParaPendente() throws Exception {
        Agendamento agendamento = reservar(cliente, LocalTime.of(9, 0), StatusAgendamento.CONFIRMADO);
        mockMvc.perform(autenticado(put("/agendamentos/" + agendamento.getId()), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(servico, "2030-01-07T14:00:00", "Remarcado")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dataHora").value("2030-01-07T14:00:00"))
                .andExpect(jsonPath("$.status").value("PENDENTE"))
                .andExpect(jsonPath("$.observacoes").value("Remarcado"));
    }

    @Test
    void alterarSomenteObservacoesMantemStatus() throws Exception {
        Agendamento agendamento = reservar(cliente, LocalTime.of(9, 0), StatusAgendamento.CONFIRMADO);
        mockMvc.perform(autenticado(put("/agendamentos/" + agendamento.getId()), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(servico, "2030-01-07T09:00:00", "Levar foto")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMADO"))
                .andExpect(jsonPath("$.observacoes").value("Levar foto"));
    }

    @Test
    void remarcacaoIgnoraOProprioAgendamentoMasNaoOsDosOutros() throws Exception {
        Agendamento agendamento = reservar(cliente, LocalTime.of(9, 0), StatusAgendamento.PENDENTE);
        Servico longo = servico(120);
        // 09:00-11:00 cruza o próprio horário (09:00-10:00), o que é permitido.
        mockMvc.perform(autenticado(put("/agendamentos/" + agendamento.getId()), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(longo, "2030-01-07T09:00:00", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.servicoId").value(longo.getId().toString()))
                .andExpect(jsonPath("$.dataHoraFim").value("2030-01-07T11:00:00"));

        reservar(outroCliente, LocalTime.of(14, 0), StatusAgendamento.PENDENTE);
        mockMvc.perform(autenticado(put("/agendamentos/" + agendamento.getId()), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(servico, "2030-01-07T14:00:00", null)))
                .andExpect(status().isConflict());
    }

    @Test
    void remarcacaoRespeitaDonoStatusEPrestador() throws Exception {
        Agendamento agendamento = reservar(cliente, LocalTime.of(9, 0), StatusAgendamento.PENDENTE);
        String url = "/agendamentos/" + agendamento.getId();
        String body = corpo(servico, "2030-01-07T10:00:00", null);
        mockMvc.perform(autenticado(put(url), outroCliente).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        mockMvc.perform(autenticado(put(url), donoPrestador).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());

        Prestador outroNegocio = new Prestador();
        outroNegocio.setUsuario(outroPrestador);
        outroNegocio.setNomeNegocio("Outro negócio " + UUID.randomUUID());
        prestadorRepository.saveAndFlush(outroNegocio);
        Servico servicoDeOutro = new Servico();
        servicoDeOutro.setPrestador(outroNegocio);
        servicoDeOutro.setNome("Outro");
        servicoDeOutro.setDuracaoMinutos(60);
        servicoDeOutro.setPreco(BigDecimal.TEN);
        servicoRepository.saveAndFlush(servicoDeOutro);
        mockMvc.perform(autenticado(put(url), cliente).contentType(MediaType.APPLICATION_JSON)
                .content(corpo(servicoDeOutro, "2030-01-07T10:00:00", null)))
                .andExpect(status().isBadRequest());

        agendamento.setStatus(StatusAgendamento.CANCELADO);
        agendamentoRepository.saveAndFlush(agendamento);
        mockMvc.perform(autenticado(put(url), cliente).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
    }

    @Test
    void fluxoDeStatusPendenteConfirmadoConcluido() throws Exception {
        Agendamento agendamento = reservar(cliente, LocalTime.of(9, 0), StatusAgendamento.PENDENTE);

        alterarStatus(agendamento, cliente, "CONFIRMADO").andExpect(status().isForbidden());
        alterarStatus(agendamento, outroPrestador, "CONFIRMADO").andExpect(status().isForbidden());
        alterarStatus(agendamento, donoPrestador, "CONCLUIDO").andExpect(status().isConflict());
        alterarStatus(agendamento, donoPrestador, "CONFIRMADO").andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMADO"));
        alterarStatus(agendamento, donoPrestador, "CONFIRMADO").andExpect(status().isConflict());
        alterarStatus(agendamento, donoPrestador, "PENDENTE").andExpect(status().isConflict());

        // Antes do horário marcado ainda não pode ser concluído.
        alterarStatus(agendamento, donoPrestador, "CONCLUIDO").andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("O agendamento só pode ser concluído a partir do horário marcado"));
        relogio("2030-01-07T13:00:00Z");
        alterarStatus(agendamento, cliente, "CONCLUIDO").andExpect(status().isForbidden());
        alterarStatus(agendamento, donoPrestador, "CONCLUIDO").andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONCLUIDO"));
        alterarStatus(agendamento, cliente, "CANCELADO").andExpect(status().isConflict());
    }

    @Test
    void clienteEPrestadorPodemCancelarEOHorarioVoltaASerOferecido() throws Exception {
        Agendamento doCliente = reservar(cliente, LocalTime.of(9, 0), StatusAgendamento.PENDENTE);
        Agendamento confirmado = reservar(outroCliente, LocalTime.of(10, 0), StatusAgendamento.CONFIRMADO);
        disponibilidade().andExpect(jsonPath("$.horarios[0]").value("11:00:00"));

        alterarStatus(doCliente, outroCliente, "CANCELADO").andExpect(status().isForbidden());
        alterarStatus(doCliente, cliente, "CANCELADO").andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELADO"));
        alterarStatus(confirmado, donoPrestador, "CANCELADO").andExpect(status().isOk());
        alterarStatus(doCliente, cliente, "CANCELADO").andExpect(status().isConflict());

        disponibilidade().andExpect(jsonPath("$.horarios[0]").value("09:00:00"))
                .andExpect(jsonPath("$.horarios[1]").value("10:00:00"));
    }

    @Test
    void statusInvalidoRetornaErroPadronizado() throws Exception {
        Agendamento agendamento = reservar(cliente, LocalTime.of(9, 0), StatusAgendamento.PENDENTE);
        alterarStatus(agendamento, donoPrestador, "FINALIZADO").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
        mockMvc.perform(autenticado(patch("/agendamentos/" + agendamento.getId() + "/status"), donoPrestador)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0]").value("Status obrigatório"));
    }

    @Test
    void somenteAdminExcluiAgendamento() throws Exception {
        Agendamento agendamento = reservar(cliente, LocalTime.of(9, 0), StatusAgendamento.PENDENTE);
        String url = "/agendamentos/" + agendamento.getId();
        for (Usuario usuario : new Usuario[]{cliente, donoPrestador}) {
            mockMvc.perform(autenticado(delete(url), usuario)).andExpect(status().isForbidden());
        }
        mockMvc.perform(autenticado(delete(url), admin)).andExpect(status().isNoContent());
        assertThat(agendamentoRepository.existsById(agendamento.getId())).isFalse();
        mockMvc.perform(autenticado(delete(url), admin)).andExpect(status().isNotFound());
    }

    private Servico servicoDeOutroPrestadorComExpediente() {
        Prestador outroNegocio = new Prestador();
        outroNegocio.setUsuario(outroPrestador);
        outroNegocio.setNomeNegocio("Outro negócio " + UUID.randomUUID());
        prestadorRepository.saveAndFlush(outroNegocio);
        HorarioFuncionamento horario = new HorarioFuncionamento();
        horario.setPrestador(outroNegocio);
        horario.setDiaSemana(DiaSemana.SEG);
        horario.setHoraInicio(LocalTime.of(8, 0));
        horario.setHoraFim(LocalTime.of(18, 0));
        horarioRepository.saveAndFlush(horario);
        Servico servicoDeOutro = new Servico();
        servicoDeOutro.setPrestador(outroNegocio);
        servicoDeOutro.setNome("Massagem");
        servicoDeOutro.setDuracaoMinutos(30);
        servicoDeOutro.setPreco(BigDecimal.TEN);
        return servicoRepository.saveAndFlush(servicoDeOutro);
    }

    @Test
    void clienteNaoPodeTerDoisAgendamentosAtivosSobrepostos() throws Exception {
        agendar(cliente, "2030-01-07T09:00:00").andExpect(status().isCreated());
        Servico massagem = servicoDeOutroPrestadorComExpediente();

        // 09:30 com outro prestador cruza o agendamento 09:00-10:00.
        mockMvc.perform(autenticado(post("/agendamentos"), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(massagem, "2030-01-07T09:30:00", null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Você já possui um agendamento ativo que coincide com este horário"));
        // 08:30-09:00 e 10:00-10:30 apenas encostam no agendamento existente.
        for (String horario : new String[]{"2030-01-07T08:30:00", "2030-01-07T10:00:00"}) {
            mockMvc.perform(autenticado(post("/agendamentos"), cliente)
                    .contentType(MediaType.APPLICATION_JSON).content(corpo(massagem, horario, null)))
                    .andExpect(status().isCreated());
        }
        // Outro cliente não é afetado.
        mockMvc.perform(autenticado(post("/agendamentos"), outroCliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(massagem, "2030-01-07T09:30:00", null)))
                .andExpect(status().isCreated());
    }

    @Test
    void agendamentoCanceladoDoClienteNaoBloqueiaNovoHorario() throws Exception {
        Agendamento cancelado = reservar(cliente, LocalTime.of(9, 0), StatusAgendamento.CANCELADO);
        Servico massagem = servicoDeOutroPrestadorComExpediente();
        mockMvc.perform(autenticado(post("/agendamentos"), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(massagem, "2030-01-07T09:00:00", null)))
                .andExpect(status().isCreated());
        assertThat(cancelado.getStatus()).isEqualTo(StatusAgendamento.CANCELADO);
    }

    @Test
    void remarcacaoTambemImpedeSobreporOutroAgendamentoDoCliente() throws Exception {
        Agendamento primeiro = reservar(cliente, LocalTime.of(9, 0), StatusAgendamento.PENDENTE);
        Servico massagem = servicoDeOutroPrestadorComExpediente();
        String body = mockMvc.perform(autenticado(post("/agendamentos"), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(massagem, "2030-01-07T14:00:00", null)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String segundo = JsonPath.read(body, "$.id");

        mockMvc.perform(autenticado(put("/agendamentos/" + segundo), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(massagem, "2030-01-07T09:30:00", null)))
                .andExpect(status().isConflict());
        mockMvc.perform(autenticado(put("/agendamentos/" + primeiro.getId()), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(servico, "2030-01-07T14:00:00", null)))
                .andExpect(status().isConflict());
    }

    @Test
    void observacoesEmBrancoViramNuloEEspacosSaoRemovidos() throws Exception {
        mockMvc.perform(autenticado(post("/agendamentos"), cliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(servico, "2030-01-07T09:00:00", "   ")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.observacoes").doesNotExist());
        mockMvc.perform(autenticado(post("/agendamentos"), outroCliente)
                .contentType(MediaType.APPLICATION_JSON).content(corpo(servico, "2030-01-07T10:00:00", "  Barba também  ")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.observacoes").value("Barba também"));
    }

    @Test
    void disponibilidadeParaRemarcarIncluiOProprioHorario() throws Exception {
        Agendamento agendamento = reservar(cliente, LocalTime.of(9, 0), StatusAgendamento.CONFIRMADO);
        reservar(outroCliente, LocalTime.of(10, 0), StatusAgendamento.PENDENTE);
        String url = "/agendamentos/" + agendamento.getId() + "/disponibilidade";

        mockMvc.perform(autenticado(get(url).param("data", data.toString()), cliente))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.servicoId").value(servico.getId().toString()))
                .andExpect(jsonPath("$.horarios[0]").value("09:00:00"))
                .andExpect(jsonPath("$.horarios").value(not(hasItem("10:00:00"))));
        // Serviço de 2h: 09:00-11:00 cruzaria o agendamento de outro cliente às 10:00, então não é oferecido.
        Servico longo = servico(120);
        mockMvc.perform(autenticado(get(url).param("data", data.toString()).param("servicoId", longo.getId().toString()), cliente))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.horarios").value(not(hasItem("09:00:00"))));

        mockMvc.perform(autenticado(get(url).param("data", data.toString()), outroCliente)).andExpect(status().isForbidden());
        mockMvc.perform(autenticado(get(url).param("data", data.toString()), donoPrestador)).andExpect(status().isForbidden());
        mockMvc.perform(autenticado(get(url).param("data", data.toString()), admin)).andExpect(status().isOk());
        mockMvc.perform(autenticado(get(url), cliente)).andExpect(status().isBadRequest());

        agendamento.setStatus(StatusAgendamento.CANCELADO);
        agendamentoRepository.saveAndFlush(agendamento);
        mockMvc.perform(autenticado(get(url).param("data", data.toString()), cliente)).andExpect(status().isConflict());
    }
}
