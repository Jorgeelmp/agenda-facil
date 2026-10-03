package com.example.agenda.dto.response;

import com.example.agenda.entity.HorarioFuncionamento;
import com.example.agenda.entity.enums.DiaSemana;

import java.time.LocalTime;
import java.util.UUID;

public record HorarioFuncionamentoResponse(UUID id, UUID prestadorId, DiaSemana diaSemana,
                                           LocalTime horaInicio, LocalTime horaFim,
                                           LocalTime intervaloInicio, LocalTime intervaloFim) {

    public static HorarioFuncionamentoResponse fromEntity(HorarioFuncionamento horario) {
        return new HorarioFuncionamentoResponse(horario.getId(), horario.getPrestador().getId(),
                horario.getDiaSemana(), horario.getHoraInicio(), horario.getHoraFim(),
                horario.getIntervaloInicio(), horario.getIntervaloFim());
    }
}
