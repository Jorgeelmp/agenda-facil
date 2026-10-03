package com.example.agenda.dto.request;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(@NotBlank(message = "Email é obrigatório")
                           String email,

                           @NotBlank(message = "Senha é obrigatória")
                           String senha) {
}
