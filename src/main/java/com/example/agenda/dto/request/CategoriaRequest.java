package com.example.agenda.dto.request;

import com.example.agenda.validation.RequestDeserializers.StrictString;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.annotation.JsonDeserialize;

public record CategoriaRequest(
        @NotBlank(message = "Nome da categoria é obrigatório")
        @Size(max = 100, message = "Nome da categoria deve ter até 100 caracteres")
        @JsonDeserialize(using = StrictString.class) String nome,
        @Size(max = 255, message = "Descrição da categoria deve ter até 255 caracteres")
        @JsonDeserialize(using = StrictString.class) String descricao) {
    public CategoriaRequest {
        nome = nome == null ? null : nome.strip();
        descricao = descricao == null || descricao.isBlank() ? null : descricao.strip();
    }
}
