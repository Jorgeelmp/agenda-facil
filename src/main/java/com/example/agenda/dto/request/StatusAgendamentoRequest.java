package com.example.agenda.dto.request;

import com.example.agenda.entity.enums.StatusAgendamento;
import com.example.agenda.validation.RequestDeserializers;

import jakarta.validation.constraints.NotNull;
import tools.jackson.databind.annotation.JsonDeserialize;

public record StatusAgendamentoRequest(
        @NotNull(message = "Status obrigatório")
        @JsonDeserialize(using = RequestDeserializers.StrictStatusAgendamento.class) StatusAgendamento status) {
}
