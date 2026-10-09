package com.example.agenda.dto.request;

import java.time.LocalDateTime;
import java.util.UUID;

import com.example.agenda.validation.RequestDeserializers;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.annotation.JsonDeserialize;

public record AgendamentoRequest(
        @NotNull(message = "Serviço obrigatório")
        UUID servicoId,

        @NotNull(message = "Data e hora obrigatórias")
        @JsonDeserialize(using = RequestDeserializers.StrictLocalDateTime.class)
        LocalDateTime dataHora,

        @Size(max = 500, message = "Observações devem ter no máximo 500 caracteres")
        @Pattern(regexp = "[^\\x00]*", message = "Observações contêm caractere nulo inválido")
        @JsonDeserialize(using = RequestDeserializers.StrictString.class)
        String observacoes) {
}
