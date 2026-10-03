package com.example.agenda.dto.request;

import com.example.agenda.entity.enums.TipoUsuario;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterUserRequest(@NotBlank(message = "Nome obrigatório")
                                  @Size(max = 150, message = "Nome deve ter no máximo 150 caracteres")
                                  String nome,

                                  @NotBlank(message = "Email obrigatório")
                                  @Email(message = "Email inválido")
                                  @Size(max = 150, message = "Email deve ter no máximo 150 caracteres")
                                  String email,

                                  @NotBlank(message = "Senha obrigatória")
                                  @Size(min = 6, message = "Senha deve ter no mínimo 6 caracteres")
                                  String senha,

                                  @Size(max = 20, message = "Telefone deve ter no máximo 20 caracteres")
                                  String telefone,

                                  @NotNull(message = "Tipo de usuário obrigatório")
                                  TipoUsuario tipo) {
}
