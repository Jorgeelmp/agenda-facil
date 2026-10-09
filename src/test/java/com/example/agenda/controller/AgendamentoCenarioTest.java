package com.example.agenda.controller;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.transaction.annotation.Transactional;

import com.example.agenda.config.TokenConfig;
import com.example.agenda.entity.HorarioFuncionamento;
import com.example.agenda.entity.Prestador;
import com.example.agenda.entity.Servico;
import com.example.agenda.entity.Usuario;
import com.example.agenda.entity.enums.DiaSemana;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.HorarioFuncionamentoRepository;
import com.example.agenda.repository.PrestadorRepository;
import com.example.agenda.repository.ServicoRepository;
import com.example.agenda.repository.UsuarioRepository;
import com.jayway.jsonpath.JsonPath;

/**
 * Cenário completo: 2 prestadores atendendo de segunda a sexta (08:00-18:00, almoço 12:00-13:00)
 * e 5 clientes agendando pela API. O relógio está no domingo 06/01/2030 às 09:00 (Brasília).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AgendamentoCenarioTest {

    private static final String SEG = "2030-01-07";
    private static final String TER = "2030-01-08";
    private static final String QUA = "2030-01-09";
    private static final String SEX = "2030-01-11";
    private static final String SAB = "2030-01-12";
    private static final String DOM = "2030-01-13";

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
    @MockitoBean
    private Clock clock;

    private Usuario donoBarbearia;
    private Usuario donaEstetica;
    private Prestador barbearia;
    private Prestador estetica;
    private Servico corte;        // 30 min
    private Servico corteBarba;   // 60 min
    private Servico limpezaPele;  // 90 min
    private Servico manicure;     // 45 min
    private final List<Usuario> clientes = new ArrayList<>();
    private final Map<String, String> agendamentos = new HashMap<>();

    @BeforeEach
    void preparar() throws Exception {
        relogio("2030-01-06T12:00:00Z");
        donoBarbearia = usuario("Dono da Barbearia", TipoUsuario.PRESTADOR);
        donaEstetica = usuario("Dona da Estética", TipoUsuario.PRESTADOR);
        barbearia = prestador(donoBarbearia, "Barbearia Centro");
        estetica = prestador(donaEstetica, "Estética Bela");
        corte = servico(barbearia, "Corte", 30);
        corteBarba = servico(barbearia, "Corte e barba", 60);
        limpezaPele = servico(estetica, "Limpeza de pele", 90);
        manicure = servico(estetica, "Manicure", 45);
        for (int i = 1; i <= 5; i++) {
            clientes.add(usuario("Cliente " + i, TipoUsuario.CLIENTE));
        }

        agendamentos.put("c1-corte-seg-0800", agendar(cliente(1), corte, SEG + "T08:00:00"));
        agendamentos.put("c2-corte-seg-0830", agendar(cliente(2), corte, SEG + "T08:30:00"));
        agendamentos.put("c3-barba-seg-0900", agendar(cliente(3), corteBarba, SEG + "T09:00:00"));
        agendamentos.put("c4-pele-seg-0800", agendar(cliente(4), limpezaPele, SEG + "T08:00:00"));
        agendamentos.put("c4-corte-seg-1000", agendar(cliente(4), corte, SEG + "T10:00:00"));
        agendamentos.put("c5-corte-seg-1130", agendar(cliente(5), corte, SEG + "T11:30:00"));
        agendamentos.put("c5-manicure-ter-1300", agendar(cliente(5), manicure, TER + "T13:00:00"));
        agendamentos.put("c1-manicure-qua-1515", agendar(cliente(1), manicure, QUA + "T15:15:00"));
    }

    private void relogio(String instante) {
        when(clock.instant()).thenReturn(Instant.parse(instante));
        when(clock.getZone()).thenReturn(ZoneId.of("America/Sao_Paulo"));
    }

    private Usuario usuario(String nome, TipoUsuario tipo) {
        Usuario usuario = new Usuario();
        usuario.setNome(nome);
        usuario.setEmail(UUID.randomUUID() + "@teste.com");
        usuario.setSenha("$2a$10$7EqJtq98hPqEX7fNZaFWoO5QG.8tME.vG8zE2hVQ2jJz0XQdZ7M.K");
        usuario.setTipo(tipo);
        return usuarioRepository.saveAndFlush(usuario);
    }

    private Prestador prestador(Usuario dono, String nome) {
        Prestador prestador = new Prestador();
        prestador.setUsuario(dono);
        prestador.setNomeNegocio(nome + " " + UUID.randomUUID());
        prestadorRepository.saveAndFlush(prestador);
        for (DiaSemana dia : List.of(DiaSemana.SEG, DiaSemana.TER, DiaSemana.QUA, DiaSemana.QUI, DiaSemana.SEX)) {
            HorarioFuncionamento horario = new HorarioFuncionamento();
            horario.setPrestador(prestador);
            horario.setDiaSemana(dia);
            horario.setHoraInicio(LocalTime.of(8, 0));
            horario.setHoraFim(LocalTime.of(18, 0));
            horario.setIntervaloInicio(LocalTime.of(12, 0));
            horario.setIntervaloFim(LocalTime.of(13, 0));
            horarioRepository.saveAndFlush(horario);
        }
        return prestador;
    }

    private Servico servico(Prestador prestador, String nome, int duracao) {
        Servico servico = new Servico();
        servico.setPrestador(prestador);
        servico.setNome(nome);
        servico.setDuracaoMinutos(duracao);
        servico.setPreco(new BigDecimal("50.00"));
        return servicoRepository.saveAndFlush(servico);
    }

    private Usuario cliente(int numero) {
        return clientes.get(numero - 1);
    }

    private MockHttpServletRequestBuilder autenticado(MockHttpServletRequestBuilder request, Usuario usuario) {
        return request.header("Authorization", "Bearer " + tokenConfig.generateToken(usuario));
    }

    private ResultActions tentarAgendar(Usuario cliente, Servico servico, String dataHora) throws Exception {
        return mockMvc.perform(autenticado(post("/agendamentos"), cliente)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"servicoId\":\"" + servico.getId() + "\",\"dataHora\":\"" + dataHora + "\"}"));
    }

    private String agendar(Usuario cliente, Servico servico, String dataHora) throws Exception {
        String body = tentarAgendar(cliente, servico, dataHora).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private List<String> horariosLivres(Prestador prestador, Servico servico, String data) throws Exception {
        String body = mockMvc.perform(autenticado(get("/prestadores/" + prestador.getId() + "/disponibilidade")
                .param("servicoId", servico.getId().toString()).param("data", data), cliente(1)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.horarios");
    }

    private ResultActions alterarStatus(String chave, Usuario usuario, String status) throws Exception {
        return mockMvc.perform(autenticado(patch("/agendamentos/" + agendamentos.get(chave) + "/status"), usuario)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + status + "\"}"));
    }

    private static List<String> grade(String... horarios) {
        return Stream.of(horarios).map(hora -> hora + ":00").toList();
    }

    @Test
    void disponibilidadeDeSegundaDescontaAgendamentosEAlmoco() throws Exception {
        assertThat(horariosLivres(barbearia, corte, SEG)).isEqualTo(grade(
                "10:30", "11:00",
                "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"));
        assertThat(horariosLivres(estetica, limpezaPele, SEG)).isEqualTo(grade("09:30", "13:00", "14:30", "16:00"));
        assertThat(horariosLivres(estetica, manicure, TER)).doesNotContain("13:00:00").contains("13:45:00");
    }

    @Test
    void diasUteisLivresTemGradeCompletaEFimDeSemanaNaoTemHorarios() throws Exception {
        List<String> gradeCorte = grade(
                "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
                "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30");
        for (String dia : List.of(TER, QUA, "2030-01-10", SEX)) {
            assertThat(horariosLivres(barbearia, corte, dia)).as(dia).isEqualTo(gradeCorte);
        }
        for (String dia : List.of(SAB, DOM)) {
            assertThat(horariosLivres(barbearia, corte, dia)).as(dia).isEmpty();
            assertThat(horariosLivres(estetica, manicure, dia)).as(dia).isEmpty();
            tentarAgendar(cliente(2), corte, dia + "T09:00:00").andExpect(status().isConflict());
        }
    }

    @Test
    void conflitosSaoRecusados() throws Exception {
        // Mesmo horário de outro cliente, horário dentro de um serviço de 60 min, almoço, fim do expediente e fora da grade.
        tentarAgendar(cliente(2), corte, SEG + "T08:00:00").andExpect(status().isConflict());
        tentarAgendar(cliente(4), corte, SEG + "T09:30:00").andExpect(status().isConflict());
        tentarAgendar(cliente(2), corte, SEG + "T12:00:00").andExpect(status().isConflict());
        tentarAgendar(cliente(2), corte, SEG + "T18:00:00").andExpect(status().isConflict());
        tentarAgendar(cliente(2), manicure, SEG + "T09:00:00").andExpect(status().isConflict());
        // Cliente 4 tem corte 10:00-10:30: o corte das 10:30 só encosta e é aceito, mas a manicure
        // 10:15-11:00 na Estética (livre para o prestador) cruza o corte e é recusada.
        tentarAgendar(cliente(4), corte, SEG + "T10:30:00").andExpect(status().isCreated());
        tentarAgendar(cliente(4), manicure, SEG + "T10:15:00").andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Você já possui um agendamento ativo que coincide com este horário"));
    }

    @Test
    void cadaPerfilVeApenasOsSeusAgendamentos() throws Exception {
        mockMvc.perform(autenticado(get("/agendamentos"), donoBarbearia))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(5))
                .andExpect(jsonPath("$[*].prestadorId").value(org.hamcrest.Matchers.everyItem(
                        org.hamcrest.Matchers.is(barbearia.getId().toString()))));
        mockMvc.perform(autenticado(get("/agendamentos"), donaEstetica))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3));

        int[] esperado = {2, 1, 1, 2, 2};
        for (int i = 1; i <= 5; i++) {
            mockMvc.perform(autenticado(get("/agendamentos"), cliente(i)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(esperado[i - 1]))
                    .andExpect(jsonPath("$[*].clienteId").value(org.hamcrest.Matchers.everyItem(
                            org.hamcrest.Matchers.is(cliente(i).getId().toString()))));
        }
        // A lista vem do mais distante para o mais próximo.
        mockMvc.perform(autenticado(get("/agendamentos"), cliente(1)))
                .andExpect(jsonPath("$[0].dataHora").value(QUA + "T15:15:00"))
                .andExpect(jsonPath("$[1].dataHora").value(SEG + "T08:00:00"));
    }

    @Test
    void prestadorConfirmaCancelaEConcluiSomenteOsSeusAgendamentos() throws Exception {
        for (String chave : List.of("c1-corte-seg-0800", "c2-corte-seg-0830", "c3-barba-seg-0900",
                "c4-corte-seg-1000", "c5-corte-seg-1130")) {
            alterarStatus(chave, donoBarbearia, "CONFIRMADO").andExpect(status().isOk());
        }
        alterarStatus("c4-pele-seg-0800", donoBarbearia, "CONFIRMADO").andExpect(status().isForbidden());
        alterarStatus("c4-pele-seg-0800", donaEstetica, "CONFIRMADO").andExpect(status().isOk());
        mockMvc.perform(autenticado(get("/agendamentos").param("status", "CONFIRMADO"), donoBarbearia))
                .andExpect(jsonPath("$.length()").value(5));

        // Cancelar devolve o horário para a grade.
        alterarStatus("c2-corte-seg-0830", donoBarbearia, "CANCELADO").andExpect(status().isOk());
        assertThat(horariosLivres(barbearia, corte, SEG)).contains("08:30:00");
        mockMvc.perform(autenticado(get("/agendamentos").param("status", "CANCELADO"), cliente(2)))
                .andExpect(jsonPath("$.length()").value(1));

        // Segunda ao meio-dia: o que já passou pode ser concluído, o resto ainda não.
        relogio("2030-01-07T15:00:00Z");
        alterarStatus("c1-corte-seg-0800", donoBarbearia, "CONCLUIDO").andExpect(status().isOk());
        alterarStatus("c5-corte-seg-1130", donoBarbearia, "CONCLUIDO").andExpect(status().isOk());
        alterarStatus("c2-corte-seg-0830", donoBarbearia, "CONCLUIDO").andExpect(status().isConflict());
        alterarStatus("c5-manicure-ter-1300", donaEstetica, "CONFIRMADO").andExpect(status().isOk());
        alterarStatus("c5-manicure-ter-1300", donaEstetica, "CONCLUIDO").andExpect(status().isConflict());
        mockMvc.perform(autenticado(get("/agendamentos").param("status", "CONCLUIDO"), donoBarbearia))
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void clienteRemarcaParaSextaEOHorarioAntigoFicaLivre() throws Exception {
        String id = agendamentos.get("c5-manicure-ter-1300");
        alterarStatus("c5-manicure-ter-1300", donaEstetica, "CONFIRMADO").andExpect(status().isOk());

        mockMvc.perform(autenticado(put("/agendamentos/" + id), cliente(5))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"servicoId\":\"" + manicure.getId() + "\",\"dataHora\":\"" + SEX + "T08:00:00\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDENTE"))
                .andExpect(jsonPath("$.dataHora").value(SEX + "T08:00:00"));

        assertThat(horariosLivres(estetica, manicure, TER)).contains("13:00:00");
        assertThat(horariosLivres(estetica, manicure, SEX)).doesNotContain("08:00:00");
        // Outro cliente não pode remarcar nem cancelar o agendamento do cliente 5.
        mockMvc.perform(autenticado(put("/agendamentos/" + id), cliente(3))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"servicoId\":\"" + manicure.getId() + "\",\"dataHora\":\"" + SEX + "T09:30:00\"}"))
                .andExpect(status().isForbidden());
        alterarStatus("c5-manicure-ter-1300", cliente(3), "CANCELADO").andExpect(status().isForbidden());
    }
}
