package com.example.agenda.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.example.agenda.config.JWTUserData;
import com.example.agenda.dto.request.AgendamentoRequest;
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

/**
 * Sem @Transactional: cada operação precisa ser commitada em sua própria transação para que a disputa
 * aconteça de verdade no banco. Os dados criados são removidos ao final.
 */
@SpringBootTest
class AgendamentoConcorrenciaTest {

    // Segunda-feira em 2030, sempre no futuro em relação ao relógio real.
    private static final LocalDateTime SEGUNDA = LocalDateTime.of(2030, 1, 7, 0, 0);

    @Autowired
    private AgendamentoService agendamentoService;
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

    private final List<Usuario> usuarios = new ArrayList<>();
    private final List<Prestador> prestadores = new ArrayList<>();
    private final List<HorarioFuncionamento> horarios = new ArrayList<>();
    private final List<Servico> servicos = new ArrayList<>();
    private Servico servico;

    @BeforeEach
    void preparar() {
        servico = servicoComExpediente("Corte");
    }

    @AfterEach
    void limpar() {
        for (Prestador prestador : prestadores) {
            agendamentoRepository.deleteAll(agendamentoRepository.findByServicoPrestadorIdOrderByDataHoraDesc(prestador.getId()));
        }
        servicoRepository.deleteAll(servicos);
        horarioRepository.deleteAll(horarios);
        prestadorRepository.deleteAll(prestadores);
        usuarioRepository.deleteAll(usuarios);
    }

    private Servico servicoComExpediente(String nome) {
        Prestador prestador = new Prestador();
        prestador.setUsuario(usuario(TipoUsuario.PRESTADOR));
        prestador.setNomeNegocio("Concorrência " + UUID.randomUUID());
        prestadores.add(prestadorRepository.saveAndFlush(prestador));

        HorarioFuncionamento horario = new HorarioFuncionamento();
        horario.setPrestador(prestador);
        horario.setDiaSemana(DiaSemana.SEG);
        horario.setHoraInicio(LocalTime.of(8, 0));
        horario.setHoraFim(LocalTime.of(18, 0));
        horarios.add(horarioRepository.saveAndFlush(horario));

        Servico novo = new Servico();
        novo.setPrestador(prestador);
        novo.setNome(nome);
        novo.setDuracaoMinutos(60);
        novo.setPreco(BigDecimal.TEN);
        servicos.add(servicoRepository.saveAndFlush(novo));
        return novo;
    }

    private Usuario usuario(TipoUsuario tipo) {
        Usuario usuario = new Usuario();
        usuario.setNome("Usuário de teste");
        usuario.setEmail(UUID.randomUUID() + "@teste.com");
        usuario.setSenha("$2a$10$7EqJtq98hPqEX7fNZaFWoO5QG.8tME.vG8zE2hVQ2jJz0XQdZ7M.K");
        usuario.setTipo(tipo);
        usuarios.add(usuarioRepository.saveAndFlush(usuario));
        return usuario;
    }

    private JWTUserData token(Usuario usuario) {
        return new JWTUserData(usuario.getId(), usuario.getEmail(), usuario.getNome(), usuario.getTipo().name());
    }

    /** Dispara todas as tarefas ao mesmo tempo e devolve o status HTTP equivalente de cada uma. */
    private List<HttpStatus> emParalelo(List<Callable<?>> tarefas) throws Exception {
        CountDownLatch largada = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(tarefas.size());
        try {
            List<Future<HttpStatus>> resultados = new ArrayList<>();
            for (Callable<?> tarefa : tarefas) {
                resultados.add(executor.submit(() -> {
                    largada.await();
                    try {
                        tarefa.call();
                        return HttpStatus.OK;
                    } catch (ResponseStatusException ex) {
                        return HttpStatus.valueOf(ex.getStatusCode().value());
                    }
                }));
            }
            largada.countDown();
            List<HttpStatus> status = new ArrayList<>();
            for (Future<HttpStatus> resultado : resultados) {
                status.add(resultado.get(30, TimeUnit.SECONDS));
            }
            return status;
        } finally {
            executor.shutdown();
        }
    }

    @Test
    void doisClientesDisputandoOMesmoHorarioSomenteUmConsegue() throws Exception {
        AgendamentoRequest request = new AgendamentoRequest(servico.getId(), SEGUNDA.withHour(10), null);
        List<Callable<?>> tentativas = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            JWTUserData cliente = token(usuario(TipoUsuario.CLIENTE));
            tentativas.add(() -> agendamentoService.criar(request, cliente));
        }

        List<HttpStatus> status = emParalelo(tentativas);

        assertThat(status).containsOnlyOnce(HttpStatus.OK);
        assertThat(status).filteredOn(item -> item != HttpStatus.OK).containsOnly(HttpStatus.CONFLICT);
        assertThat(agendamentoRepository.findByServicoPrestadorIdOrderByDataHoraDesc(servico.getPrestador().getId())).hasSize(1);
    }

    @Test
    void mesmoClienteNaoConsegueDoisPrestadoresNoMesmoHorarioAoMesmoTempo() throws Exception {
        Servico outroServico = servicoComExpediente("Massagem");
        JWTUserData cliente = token(usuario(TipoUsuario.CLIENTE));
        // Repete em vários horários para aumentar a chance de as duas reservas realmente se cruzarem.
        for (int hora = 8; hora < 18; hora++) {
            LocalDateTime dataHora = SEGUNDA.withHour(hora);
            List<HttpStatus> status = emParalelo(List.of(
                    () -> agendamentoService.criar(new AgendamentoRequest(servico.getId(), dataHora, null), cliente),
                    () -> agendamentoService.criar(new AgendamentoRequest(outroServico.getId(), dataHora, null), cliente)));

            assertThat(status).as("%s", dataHora).containsExactlyInAnyOrder(HttpStatus.OK, HttpStatus.CONFLICT);
        }
        assertThat(agendamentoRepository.findByClienteIdOrderByDataHoraDesc(cliente.userId())).hasSize(10);
    }

    @Test
    void cancelamentoEConfirmacaoSimultaneosNuncaTerminamConfirmado() throws Exception {
        JWTUserData cliente = token(usuario(TipoUsuario.CLIENTE));
        JWTUserData prestador = token(servico.getPrestador().getUsuario());
        for (int hora = 8; hora < 18; hora++) {
            UUID id = agendamentoService.criar(new AgendamentoRequest(servico.getId(), SEGUNDA.withHour(hora), null), cliente).id();

            List<HttpStatus> status = emParalelo(List.of(
                    () -> agendamentoService.alterarStatus(id, StatusAgendamento.CANCELADO, cliente),
                    () -> agendamentoService.alterarStatus(id, StatusAgendamento.CONFIRMADO, prestador)));

            // Ou confirma e depois cancela (os dois funcionam), ou cancela antes e a confirmação é recusada.
            assertThat(status.get(0)).isEqualTo(HttpStatus.OK);
            assertThat(status.get(1)).isIn(HttpStatus.OK, HttpStatus.CONFLICT);
            assertThat(agendamentoRepository.findById(id).orElseThrow().getStatus()).isEqualTo(StatusAgendamento.CANCELADO);
        }
    }
}
