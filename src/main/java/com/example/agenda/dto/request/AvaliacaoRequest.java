package com.example.agenda.dto.request;

import java.util.UUID;
import com.example.agenda.validation.RequestDeserializers;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.annotation.JsonDeserialize;

public record AvaliacaoRequest(
    @NotNull(message = "Agendamento obrigatório") 
    UUID agendamentoId, 

    @NotNull(message = "Nota obrigatória") 
    @Min(value = 1, message = "Nota deve ser no mínimo 1") 
    @Max(value = 5, message = "Nota deve ser no máximo 5") 
    Integer nota,

    @Size(max = 1000, message = "Comentário deve ter no máximo 1000 caracteres") 
    @Pattern(regexp = "[^\\x00]*", message = "Comantário contém caractere nulo inválido") 
    @JsonDeserialize(using = RequestDeserializers.StrictString.class) 
    String comentario) {
}
