package com.example.agenda.dto.request;

import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;
import com.example.agenda.validation.RequestDeserializers.StrictBoolean;
import com.example.agenda.validation.RequestDeserializers.StrictString;
import com.example.agenda.validation.ServicoDeserializers;
import jakarta.validation.constraints.*;
import tools.jackson.databind.annotation.JsonDeserialize;

public record ServicoRequest(
        @NotBlank(message = "Nome do serviço é obrigatório")
        @Size(max = 150, message = "Nome do serviço deve ter até 150 caracteres")
        @JsonDeserialize(using = StrictString.class) String nome,
        @Size(max = 500, message = "Descrição do serviço deve ter até 500 caracteres")
        @JsonDeserialize(using = StrictString.class) String descricao,
        @NotNull(message = "Duração é obrigatória")
        @Min(value = 1, message = "Duração deve ser de pelo menos 1 minuto")
        @Max(value = 1440, message = "Duração deve ser de até 1440 minutos")
        @JsonDeserialize(using = ServicoDeserializers.Inteiro.class) Integer duracaoMinutos,
        @NotNull(message = "Preço é obrigatório")
        @DecimalMin(value = "0.00", message = "Preço não pode ser negativo")
        @Digits(integer = 8, fraction = 2, message = "Preço deve ter até 8 dígitos inteiros e 2 casas decimais")
        @JsonDeserialize(using = ServicoDeserializers.Decimal.class) BigDecimal preco,
        @NotNull(message = "Status do serviço é obrigatório")
        @JsonDeserialize(using = StrictBoolean.class) Boolean ativo,
        @NotEmpty(message = "Selecione pelo menos uma categoria")
        @Size(max = 50, message = "Selecione no máximo 50 categorias")
        Set<@NotNull(message = "Categoria não pode ser nula") UUID> categoriaIds) {
    public ServicoRequest {
        nome = nome == null ? null : nome.strip();
        descricao = descricao == null || descricao.isBlank() ? null : descricao.strip();
    }
}
