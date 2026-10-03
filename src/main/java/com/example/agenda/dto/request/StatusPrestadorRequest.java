package com.example.agenda.dto.request;

import jakarta.validation.constraints.NotNull;
import com.example.agenda.validation.RequestDeserializers;
import tools.jackson.databind.annotation.JsonDeserialize;

public record StatusPrestadorRequest(
        @NotNull(message = "Situação do prestador obrigatória")
        @JsonDeserialize(using = RequestDeserializers.StrictBoolean.class) Boolean ativo) {
}
