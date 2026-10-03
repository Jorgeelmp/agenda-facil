package com.example.agenda.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import com.example.agenda.dto.response.DisponibilidadeResponse;
import com.example.agenda.entity.HorarioFuncionamento;
import com.example.agenda.entity.Prestador;
import com.example.agenda.entity.Servico;
import com.example.agenda.entity.enums.DiaSemana;
import com.example.agenda.repository.AgendamentoRepository;
import com.example.agenda.repository.HorarioFuncionamentoRepository;
import com.example.agenda.repository.ServicoRepository;

@ExtendWith(MockitoExtension.class)
class DisponibilidadeCamposTest {

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
    private final LocalDate segunda = LocalDate.of(2030, 1, 7);

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
        horario.setHoraFim(LocalTime.of(12, 0));
    }

    private void configurarEntidades() {
        when(prestadorService.buscarEntidade(prestador.getId())).thenReturn(prestador);
        when(servicoRepository.findById(servico.getId())).thenReturn(Optional.of(servico));
    }

    private void configurarHorario(LocalDate data, DiaSemana diaSemana) {
        configurarEntidades();
        when(horarioRepository.findByPrestadorIdAndDiaSemana(prestador.getId(), diaSemana))
                .thenReturn(Optional.of(horario));
        when(agendamentoRepository.findOcupadosNoPeriodo(prestador.getId(),
                data.atStartOfDay(), data.plusDays(1).atStartOfDay())).thenReturn(List.of());
    }

    private DisponibilidadeResponse consultar(LocalDate data) {
        return disponibilidadeService.consultar(prestador.getId(), servico.getId(), data);
    }

    static Stream<LocalDate> datasInvalidas() {
        return Stream.of(null, LocalDate.of(0, 1, 1), LocalDate.of(10000, 1, 1), LocalDate.MAX);
    }

    @ParameterizedTest
    @MethodSource("datasInvalidas")
    void dataAusenteOuForaDaFaixaRetorna400AntesDeConsultarBanco(LocalDate data) {
        assertThatThrownBy(() -> consultar(data)).isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode().value()).isEqualTo(400));
        verifyNoInteractions(prestadorService, servicoRepository, horarioRepository, agendamentoRepository);
    }

    @Test
    void ultimoDiaDoAno9999SemHorarioRetornaListaVazia() {
        LocalDate ultimoDia = LocalDate.of(9999, 12, 31);
        configurarEntidades();
        when(horarioRepository.findByPrestadorIdAndDiaSemana(prestador.getId(), DiaSemana.SEX))
                .thenReturn(Optional.empty());

        assertThat(consultar(ultimoDia).horarios()).isEmpty();
        verify(horarioRepository).findByPrestadorIdAndDiaSemana(prestador.getId(), DiaSemana.SEX);
        verifyNoInteractions(agendamentoRepository);
    }

    @Test
    void ultimoDiaDoAno9999ComHorarioAceitaLimiteDaConsultaNoDiaSeguinte() {
        LocalDate ultimoDia = LocalDate.of(9999, 12, 31);
        horario.setHoraFim(LocalTime.of(10, 0));
        configurarHorario(ultimoDia, DiaSemana.SEX);

        assertThat(consultar(ultimoDia).horarios()).containsExactly(LocalTime.of(9, 0));
        verify(agendamentoRepository).findOcupadosNoPeriodo(prestador.getId(),
                ultimoDia.atStartOfDay(), LocalDate.of(10000, 1, 1).atStartOfDay());
    }

    @ParameterizedTest
    @EnumSource(DiaSemana.class)
    void cadaDiaDaSemanaBuscaSeuHorarioCorrespondente(DiaSemana diaSemana) {
        LocalDate data = segunda.plusDays(diaSemana.ordinal());
        configurarHorario(data, diaSemana);

        assertThat(consultar(data).horarios()).containsExactly(
                LocalTime.of(9, 0), LocalTime.of(10, 0), LocalTime.of(11, 0));
        verify(horarioRepository).findByPrestadorIdAndDiaSemana(prestador.getId(), diaSemana);
    }

    @Test
    void intervaloNoInicioDaJanelaLiberaSomenteHorariosDepoisDoIntervalo() {
        horario.setIntervaloInicio(LocalTime.of(9, 0));
        horario.setIntervaloFim(LocalTime.of(10, 0));
        configurarHorario(segunda, DiaSemana.SEG);

        assertThat(consultar(segunda).horarios()).containsExactly(LocalTime.of(10, 0), LocalTime.of(11, 0));
    }

    @Test
    void intervaloNoFimDaJanelaLiberaSomenteHorariosAntesDoIntervalo() {
        horario.setIntervaloInicio(LocalTime.of(11, 0));
        horario.setIntervaloFim(LocalTime.of(12, 0));
        configurarHorario(segunda, DiaSemana.SEG);

        assertThat(consultar(segunda).horarios()).containsExactly(LocalTime.of(9, 0), LocalTime.of(10, 0));
    }

    @Test
    void intervaloQueOcupaTodaAJanelaNaoGeraHorarios() {
        horario.setIntervaloInicio(LocalTime.of(9, 0));
        horario.setIntervaloFim(LocalTime.of(12, 0));
        configurarHorario(segunda, DiaSemana.SEG);

        assertThat(consultar(segunda).horarios()).isEmpty();
    }

    @Test
    void horariosComSegundosInteirosPreservamOsSegundosNosBlocos() {
        horario.setHoraInicio(LocalTime.of(9, 0, 15));
        horario.setHoraFim(LocalTime.of(11, 0, 15));
        configurarHorario(segunda, DiaSemana.SEG);

        assertThat(consultar(segunda).horarios()).containsExactly(LocalTime.of(9, 0, 15), LocalTime.of(10, 0, 15));
    }

    @Test
    void intervaloComSegundosInteirosReiniciaBlocosNoFimDoIntervalo() {
        horario.setHoraInicio(LocalTime.of(9, 0, 15));
        horario.setHoraFim(LocalTime.of(13, 0, 15));
        horario.setIntervaloInicio(LocalTime.of(10, 0, 15));
        horario.setIntervaloFim(LocalTime.of(11, 0, 15));
        configurarHorario(segunda, DiaSemana.SEG);

        assertThat(consultar(segunda).horarios()).containsExactly(
                LocalTime.of(9, 0, 15), LocalTime.of(11, 0, 15), LocalTime.of(12, 0, 15));
    }
}
