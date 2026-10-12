package com.example.agenda.controller;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.when;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

import jakarta.persistence.EntityManager;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class TempoRespostaConsultasTest {

    private static final int CLIENTES = 50;
    private static final int AGENDAMENTOS_POR_CLIENTE = 60;
    private static final int REPETICOES = 20;
    private static final long LIMITE_MS = 1000;

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
    private Usuario admin;
    private final List<Usuario> clientes = new ArrayList<>();
    private Prestador prestador;
    private Servico servico;
    private final LocalDate inicio = LocalDate.of(2030, 1, 7);

    @BeforeEach
    void preparar() {
        when(clock.instant()).thenReturn(Instant.parse("2030-01-06T12:00:00Z"));
        when(clock.getZone()).thenReturn(ZoneId.of("America/Sao_Paulo"));
        dono = usuario(TipoUsuario.PRESTADOR);
        admin = usuario(TipoUsuario.ADMIN);
        prestador = new Prestador();
        prestador.setUsuario(dono);
        prestador.setNomeNegocio("Volume " + UUID.randomUUID());
        prestadorRepository.save(prestador);
        for (DiaSemana dia : DiaSemana.values()) {
            HorarioFuncionamento horario = new HorarioFuncionamento();
            horario.setPrestador(prestador);
            horario.setDiaSemana(dia);
            horario.setHoraInicio(LocalTime.of(8, 0));
            horario.setHoraFim(LocalTime.of(18, 0));
            horario.setIntervaloInicio(LocalTime.of(12, 0));
            horario.setIntervaloFim(LocalTime.of(13, 0));
            horarioRepository.save(horario);
        }
        servico = new Servico();
        servico.setPrestador(prestador);
        servico.setNome("Corte");
        servico.setDuracaoMinutos(30);
        servico.setPreco(new BigDecimal("40.00"));
        servicoRepository.save(servico);

        List<Agendamento> agendamentos = new ArrayList<>();
        int sequencia = 0;
        for (int c = 0; c < CLIENTES; c++) {
            Usuario cliente = usuario(TipoUsuario.CLIENTE);
            clientes.add(cliente);
            for (int a = 0; a < AGENDAMENTOS_POR_CLIENTE; a++, sequencia++) {
                Agendamento agendamento = new Agendamento();
                agendamento.setCliente(cliente);
                agendamento.setServico(servico);
                agendamento.setDataHora(inicio.plusDays(sequencia / 18).atTime(8, 0).plusMinutes(30L * (sequencia % 18)));
                agendamento.setStatus(StatusAgendamento.values()[sequencia % StatusAgendamento.values().length]);
                agendamentos.add(agendamento);
            }
        }
        agendamentoRepository.saveAll(agendamentos);
        entityManager.flush();
        entityManager.clear();
    }

    private Usuario usuario(TipoUsuario tipo) {
        Usuario usuario = new Usuario();
        usuario.setNome("Usuário de volume");
        usuario.setEmail(UUID.randomUUID() + "@teste.com");
        usuario.setSenha("$2a$10$7EqJtq98hPqEX7fNZaFWoO5QG.8tME.vG8zE2hVQ2jJz0XQdZ7M.K");
        usuario.setTipo(tipo);
        return usuarioRepository.save(usuario);
    }

    private MockHttpServletRequestBuilder autenticado(MockHttpServletRequestBuilder request, Usuario usuario) {
        return request.header("Authorization", "Bearer " + tokenConfig.generateToken(usuario));
    }

    private double mediaMs(MockHttpServletRequestBuilder request) throws Exception {
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(request).andExpect(status().isOk());
        }
        long total = 0;
        for (int i = 0; i < REPETICOES; i++) {
            entityManager.clear();
            long antes = System.nanoTime();
            mockMvc.perform(request).andExpect(status().isOk());
            total += System.nanoTime() - antes;
        }
        return total / 1_000_000.0 / REPETICOES;
    }

    @Test
    void consultasRespondemEmMediaAbaixoDeUmSegundo() throws Exception {
        String disponibilidade = "/prestadores/" + prestador.getId() + "/disponibilidade";
        Map<String, MockHttpServletRequestBuilder> consultas = new LinkedHashMap<>();
        consultas.put("GET /agendamentos (prestador, " + CLIENTES * AGENDAMENTOS_POR_CLIENTE + " itens)",
                autenticado(get("/agendamentos"), dono));
        consultas.put("GET /agendamentos?status=CONFIRMADO (prestador)",
                autenticado(get("/agendamentos").param("status", "CONFIRMADO"), dono));
        consultas.put("GET /agendamentos (cliente, " + AGENDAMENTOS_POR_CLIENTE + " itens)",
                autenticado(get("/agendamentos"), clientes.get(0)));
        consultas.put("GET /agendamentos (admin, todos)", autenticado(get("/agendamentos"), admin));
        consultas.put("GET /prestadores", autenticado(get("/prestadores"), clientes.get(0)));
        consultas.put("GET /prestadores/{id}/servicos",
                autenticado(get("/prestadores/" + prestador.getId() + "/servicos"), clientes.get(0)));
        consultas.put("GET /prestadores/{id}/horarios",
                autenticado(get("/prestadores/" + prestador.getId() + "/horarios"), clientes.get(0)));
        consultas.put("GET disponibilidade (dia lotado)", autenticado(get(disponibilidade)
                .param("servicoId", servico.getId().toString()).param("data", inicio.toString()), clientes.get(0)));

        Map<String, Double> medias = new LinkedHashMap<>();
        for (Map.Entry<String, MockHttpServletRequestBuilder> consulta : consultas.entrySet()) {
            medias.put(consulta.getKey(), mediaMs(consulta.getValue()));
        }

        System.out.println("\n===== RNF06: tempo médio de resposta (" + REPETICOES + " chamadas cada) =====");
        medias.forEach((nome, media) -> System.out.printf("%8.1f ms  %s%n", media, nome));
        assertThat(medias).allSatisfy((nome, media) -> assertThat(media).as(nome).isLessThan(LIMITE_MS));
    }
}
