package com.example.agenda.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.example.agenda.dto.response.DisponibilidadeResponse;
import com.example.agenda.entity.Agendamento;
import com.example.agenda.entity.Prestador;
import com.example.agenda.entity.Servico;
import com.example.agenda.entity.enums.DiaSemana;
import com.example.agenda.repository.AgendamentoRepository;
import com.example.agenda.repository.HorarioFuncionamentoRepository;
import com.example.agenda.repository.ServicoRepository;

@Service
@Transactional(readOnly = true)
public class DisponibilidadeService {

    private final PrestadorService prestadorService;
    private final ServicoRepository servicoRepository;
    private final HorarioFuncionamentoRepository horarioRepository;
    private final AgendamentoRepository agendamentoRepository;
    private final Clock clock;

    public DisponibilidadeService(PrestadorService prestadorService, ServicoRepository servicoRepository,
            HorarioFuncionamentoRepository horarioRepository,
            AgendamentoRepository agendamentoRepository, Clock clock) {
        this.prestadorService = prestadorService;
        this.servicoRepository = servicoRepository;
        this.horarioRepository = horarioRepository;
        this.agendamentoRepository = agendamentoRepository;
        this.clock = clock;
    }

    public DisponibilidadeResponse consultar(UUID prestadorId, UUID servicoId, LocalDate data) {
        if (data == null || data.getYear() < 1 || data.getYear() > 9999) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Data deve estar entre 0001-01-01 e 9999-12-31");
        }
        Prestador prestador = prestadorService.buscarEntidade(prestadorId);
        Servico servico = servicoRepository.findById(servicoId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Serviço não encontrado"));
        if (!servico.getPrestador().getId().equals(prestadorId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Serviço não pertence ao prestador informado");
        }

        List<LocalTime> horarios = new ArrayList<>();
        LocalDateTime agora = LocalDateTime.now(clock);
        if (Boolean.TRUE.equals(prestador.getAtivo()) && Boolean.TRUE.equals(servico.getAtivo())
                && !data.isBefore(agora.toLocalDate())) {
            DiaSemana diaSemana = DiaSemana.values()[data.getDayOfWeek().getValue() - 1];
            horarioRepository.findByPrestadorIdAndDiaSemana(prestadorId, diaSemana).ifPresent(horario -> {
                List<Agendamento> ocupados = agendamentoRepository.findOcupadosNoPeriodo(
                        prestadorId, data.atStartOfDay(), data.plusDays(1).atStartOfDay());
                if (horario.getIntervaloInicio() == null) {
                    adicionarHorarios(data, horario.getHoraInicio(), horario.getHoraFim(),
                            servico.getDuracaoMinutos(), ocupados, agora, horarios);
                } else {
                    adicionarHorarios(data, horario.getHoraInicio(), horario.getIntervaloInicio(),
                            servico.getDuracaoMinutos(), ocupados, agora, horarios);
                    adicionarHorarios(data, horario.getIntervaloFim(), horario.getHoraFim(),
                            servico.getDuracaoMinutos(), ocupados, agora, horarios);
                }
            });
        }
        return new DisponibilidadeResponse(prestadorId, servicoId, data, servico.getDuracaoMinutos(), List.copyOf(horarios));
    }

    private void adicionarHorarios(LocalDate data, LocalTime inicio, LocalTime fim, int duracao,
            List<Agendamento> ocupados, LocalDateTime agora, List<LocalTime> horarios) {
        LocalDateTime limite = data.atTime(fim);
        for (LocalDateTime candidato = data.atTime(inicio);
                !candidato.plusMinutes(duracao).isAfter(limite);
                candidato = candidato.plusMinutes(duracao)) {
            LocalDateTime termino = candidato.plusMinutes(duracao);
            if (!candidato.isBefore(agora) && !temConflito(candidato, termino, ocupados)) {
                horarios.add(candidato.toLocalTime());
            }
        }
    }

    private boolean temConflito(LocalDateTime inicio, LocalDateTime fim, List<Agendamento> ocupados) {
        return ocupados.stream().anyMatch(agendamento -> {
            LocalDateTime inicioReserva = agendamento.getDataHora();
            LocalDateTime fimReserva = inicioReserva.plusMinutes(agendamento.getServico().getDuracaoMinutos());
            return inicio.isBefore(fimReserva) && fim.isAfter(inicioReserva);
        });
    }
}
