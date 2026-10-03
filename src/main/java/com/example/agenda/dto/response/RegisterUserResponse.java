package com.example.agenda.dto.response;

import com.example.agenda.entity.enums.TipoUsuario;

public record RegisterUserResponse(String nome, String email, TipoUsuario tipo) {
}
