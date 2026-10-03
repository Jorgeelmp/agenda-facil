package com.example.agenda.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import com.example.agenda.dto.response.DisponibilidadeResponse;
import com.example.agenda.entity.Agendamento;
import com.example.agenda.entity.HorarioFuncionamento;
import com.example.agenda.entity.Prestador;
import com.example.agenda.entity.Servico;
import com.example.agenda.entity.enums.DiaSemana;
import com.example.agenda.repository.AgendamentoRepository;
import com.example.agenda.repository.HorarioFuncionamentoRepository;
import com.example.agenda.repository.ServicoRepository;

@ExtendWith(MockitoExtension.class)
class DisponibilidadeServiceTest {

    @Mock
    private PrestadorService prestadorService;
    @Mock
    private ServicoRepository servicoRepository;
    @Mock
    private HorarioFuncionamentoRepository horarioRepository;
    @Mock
    private AgendamentoRepository agendamentoRepository;

    private DisponibilidadeService disponibilidadeService;
    private Prestador prestador;
    private Servico servico;
    private HorarioFuncionamento horario;
    private final LocalDate data = LocalDate.of(2030, 1, 7);

    @BeforeEach
    void preparar() {
        Clock clock = Clock.fixed(Instant.parse("2030-01-06T12:00:00Z"), ZoneId.of("America/Sao_Paulo"));
        disponibilidadeService = new DisponibilidadeService(prestadorService, servicoRepository,
                horarioRepository, agendamentoRepository, clock);
        prestador = new Prestador();
        prestador.setId(UUID.randomUUID());
        servico = new Servico();
        servico.setId(UUID.randomUUID());
        servico.setPrestador(prestador);
        servico.setDuracaoMinutos(60);
        horario = new HorarioFuncionamento();
        horario.setHoraInicio(LocalTime.of(9, 0));
        horario.setHoraFim(LocalTime.of(16, 0));
        when(prestadorService.buscarEntidade(prestador.getId())).thenReturn(prestador);
        when(servicoRepository.findById(servico.getId())).thenReturn(Optional.of(servico));
    }

    private void configurarHorario(List<Agendamento> ocupados) {
        when(horarioRepository.findByPrestadorIdAndDiaSemana(prestador.getId(), DiaSemana.SEG))
                .thenReturn(Optional.of(horario));
        when(agendamentoRepository.findOcupadosNoPeriodo(prestador.getId(), data.atStartOfDay(), data.plusDays(1).atStartOfDay()))
                .thenReturn(ocupados);
    }

    private DisponibilidadeResponse consultar() {
        return disponibilidadeService.consultar(prestador.getId(), servico.getId(), data);
    }

    private Agendamento reserva(LocalDate dia, LocalTime inicio, int duracao) {
        Servico outroServico = new Servico();
        outroServico.setPrestador(prestador);
        outroServico.setDuracaoMinutos(duracao);
        Agendamento agendamento = new Agendamento();
        agendamento.setServico(outroServico);
        agendamento.setDataHora(dia.atTime(inicio));
        return agendamento;
    }

    @Test
    void fatiaDiaSemIntervaloPelaDuracaoDoServico() {
        configurarHorario(List.of());
        assertThat(consultar().horarios()).containsExactly(
                LocalTime.of(9, 0), LocalTime.of(10, 0), LocalTime.of(11, 0),
                LocalTime.of(12, 0), LocalTime.of(13, 0), LocalTime.of(14, 0), LocalTime.of(15, 0));
    }

    @Test
    void removeAlmocoEReservasDeOutrosServicosDoPrestador() {
        horario.setIntervaloInicio(LocalTime.of(12, 0));
        horario.setIntervaloFim(LocalTime.of(13, 0));
        configurarHorario(List.of(reserva(data, LocalTime.of(10, 0), 60),
                reserva(data, LocalTime.of(14, 30), 30)));
        assertThat(consultar().horarios()).containsExactly(
                LocalTime.of(9, 0), LocalTime.of(11, 0), LocalTime.of(13, 0), LocalTime.of(15, 0));
    }

    @Test
    void reiniciaBlocosNoFimDoAlmocoEDescartaSobras() {
        servico.setDuracaoMinutos(45);
        horario.setHoraFim(LocalTime.of(14, 0));
        horario.setIntervaloInicio(LocalTime.of(11, 0));
        horario.setIntervaloFim(LocalTime.of(12, 10));
        configurarHorario(List.of());
        assertThat(consultar().horarios()).containsExactly(
                LocalTime.of(9, 0), LocalTime.of(9, 45), LocalTime.of(12, 10), LocalTime.of(12, 55));
    }

    @Test
    void detectaSobreposicaoParcialNosDoisBlocos() {
        configurarHorario(List.of(reserva(data, LocalTime.of(9, 30), 60)));
        assertThat(consultar().horarios()).doesNotContain(LocalTime.of(9, 0), LocalTime.of(10, 0))
                .contains(LocalTime.of(11, 0));
    }

    @Test
    void reservaPodeEncostarNoInicioOuNoFimDeOutroBloco() {
        configurarHorario(List.of(reserva(data, LocalTime.of(10, 0), 60)));
        assertThat(consultar().horarios()).contains(LocalTime.of(9, 0), LocalTime.of(11, 0))
                .doesNotContain(LocalTime.of(10, 0));
    }

    @Test
    void reservaIniciadaNoDiaAnteriorPodeOcuparODiaConsultado() {
        horario.setHoraInicio(LocalTime.MIDNIGHT);
        horario.setHoraFim(LocalTime.of(3, 0));
        configurarHorario(List.of(reserva(data.minusDays(1), LocalTime.of(23, 30), 120)));
        assertThat(consultar().horarios()).containsExactly(LocalTime.of(2, 0));
    }

    @Test
    void duracaoMaiorQueAJanelaNaoGeraHorarioNemViraODia() {
        servico.setDuracaoMinutos(1500);
        configurarHorario(List.of());
        assertThat(consultar().horarios()).isEmpty();
    }

    @Test
    void diaSemFuncionamentoRetornaListaVazia() {
        when(horarioRepository.findByPrestadorIdAndDiaSemana(prestador.getId(), DiaSemana.SEG))
                .thenReturn(Optional.empty());
        assertThat(consultar().horarios()).isEmpty();
        verify(agendamentoRepository, never()).findOcupadosNoPeriodo(any(), any(), any());
    }

    @Test
    void prestadorInativoNaoOfereceHorarios() {
        prestador.setAtivo(false);
        assertThat(consultar().horarios()).isEmpty();
        verify(horarioRepository, never()).findByPrestadorIdAndDiaSemana(any(), any());
    }

    @Test
    void servicoInativoNaoOfereceHorarios() {
        servico.setAtivo(false);
        assertThat(consultar().horarios()).isEmpty();
    }

    @Test
    void dataPassadaNaoOfereceHorarios() {
        assertThat(disponibilidadeService.consultar(prestador.getId(), servico.getId(), data.minusDays(2)).horarios()).isEmpty();
        verify(horarioRepository, never()).findByPrestadorIdAndDiaSemana(any(), any());
    }

    @Test
    void hojeRemoveHorariosPassadosUsandoOFusoDeSaoPaulo() {
        Clock clock = Clock.fixed(Instant.parse("2030-01-07T13:30:00Z"), ZoneId.of("America/Sao_Paulo"));
        disponibilidadeService = new DisponibilidadeService(prestadorService, servicoRepository,
                horarioRepository, agendamentoRepository, clock);
        configurarHorario(List.of());
        assertThat(consultar().horarios()).startsWith(LocalTime.of(11, 0))
                .doesNotContain(LocalTime.of(9, 0), LocalTime.of(10, 0));
    }

    @Test
    void servicoDeOutroPrestadorRetorna400() {
        Prestador outro = new Prestador();
        outro.setId(UUID.randomUUID());
        servico.setPrestador(outro);
        assertThatThrownBy(this::consultar).isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode().value()).isEqualTo(400));
    }

    @Test
    void servicoInexistenteRetorna404() {
        when(servicoRepository.findById(servico.getId())).thenReturn(Optional.empty());
        assertThatThrownBy(this::consultar).isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode().value()).isEqualTo(404));
    }

}
