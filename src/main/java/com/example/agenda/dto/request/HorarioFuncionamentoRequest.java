package com.example.agenda.dto.request;

import com.example.agenda.entity.enums.DiaSemana;
import com.example.agenda.validation.RequestDeserializers;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;

import java.time.LocalTime;
import tools.jackson.databind.annotation.JsonDeserialize;

public record HorarioFuncionamentoRequest(
        @NotNull(message = "Dia da semana obrigatório")
        @JsonDeserialize(using = RequestDeserializers.StrictDiaSemana.class) DiaSemana diaSemana,
        @NotNull(message = "Hora de início obrigatória")
        @JsonDeserialize(using = RequestDeserializers.StrictLocalTime.class) LocalTime horaInicio,
        @NotNull(message = "Hora de fim obrigatória")
        @JsonDeserialize(using = RequestDeserializers.StrictLocalTime.class) LocalTime horaFim,
        @JsonDeserialize(using = RequestDeserializers.StrictLocalTime.class) LocalTime intervaloInicio,
        @JsonDeserialize(using = RequestDeserializers.StrictLocalTime.class) LocalTime intervaloFim) {

    @AssertTrue(message = "Horários devem ter precisão de no máximo milissegundos")
    public boolean isPrecisaoValida() {
        return temPrecisaoValida(horaInicio) && temPrecisaoValida(horaFim)
                && temPrecisaoValida(intervaloInicio) && temPrecisaoValida(intervaloFim);
    }

    private boolean temPrecisaoValida(LocalTime hora) {
        return hora == null || hora.getNano() % 1_000_000 == 0;
    }

    @AssertTrue(message = "Hora de início deve ser anterior à hora de fim")
    public boolean isHorarioValido() {
        return horaInicio == null || horaFim == null || horaInicio.isBefore(horaFim);
    }

    @AssertTrue(message = "Intervalo deve ter início e fim, em ordem, dentro do horário de funcionamento")
    public boolean isIntervaloValido() {
        if (intervaloInicio == null && intervaloFim == null) {
            return true;
        }
        if (intervaloInicio == null || intervaloFim == null) {
            return false;
        }
        return intervaloInicio.isBefore(intervaloFim)
                && (horaInicio == null || !intervaloInicio.isBefore(horaInicio))
                && (horaFim == null || !intervaloFim.isAfter(horaFim));
    }
}
