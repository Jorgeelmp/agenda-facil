package com.example.agenda.dto.response;

// O token é renovado porque o nome do usuário viaja dentro dele.
public record AtualizarContaResponse(UsuarioResponse usuario, String token) {
}
