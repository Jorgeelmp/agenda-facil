package com.example.agenda.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

// Dados que o próprio usuário pode alterar. Email e tipo de conta não mudam.
// A senha só é trocada quando novaSenha é informada, e exige a senha atual.
public record AtualizarContaRequest(@NotBlank(message = "Nome obrigatório")
                                    @Size(max = 150, message = "Nome deve ter no máximo 150 caracteres")
                                    @Pattern(regexp = "[^\\x00]*", message = "Nome contém caractere nulo inválido")
                                    String nome,

                                    @Size(max = 20, message = "Telefone deve ter no máximo 20 caracteres")
                                    @Pattern(regexp = "[^\\x00]*", message = "Telefone contém caractere nulo inválido")
                                    String telefone,

                                    String senhaAtual,

                                    @Size(min = 6, message = "Nova senha deve ter no mínimo 6 caracteres")
                                    String novaSenha) {
}
