package com.example.agenda.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import com.example.agenda.validation.RequestDeserializers;
import tools.jackson.databind.annotation.JsonDeserialize;

public record PrestadorRequest(
        @NotBlank(message = "Nome do negócio obrigatório")
        @Size(max = 150, message = "Nome do negócio deve ter no máximo 150 caracteres")
        @Pattern(regexp = "[^\\x00]*", message = "Nome do negócio contém caractere nulo inválido")
        @JsonDeserialize(using = RequestDeserializers.StrictString.class)
        String nomeNegocio,

        @Size(max = 500, message = "Descrição deve ter no máximo 500 caracteres")
        @Pattern(regexp = "[^\\x00]*", message = "Descrição contém caractere nulo inválido")
        @JsonDeserialize(using = RequestDeserializers.StrictString.class)
        String descricao,

        @Size(max = 255, message = "Endereço deve ter no máximo 255 caracteres")
        @Pattern(regexp = "[^\\x00]*", message = "Endereço contém caractere nulo inválido")
        @JsonDeserialize(using = RequestDeserializers.StrictString.class)
        String endereco,

        @Size(max = 20, message = "Telefone comercial deve ter no máximo 20 caracteres")
        @Pattern(regexp = "[^\\x00]*", message = "Telefone comercial contém caractere nulo inválido")
        @JsonDeserialize(using = RequestDeserializers.StrictString.class)
        String telefoneComercial) {
}
