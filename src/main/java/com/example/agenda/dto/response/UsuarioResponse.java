package com.example.agenda.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;
import com.example.agenda.entity.Usuario;
import com.example.agenda.entity.enums.TipoUsuario;

public record UsuarioResponse(UUID id, String nome, String email, String telefone, TipoUsuario tipo, LocalDateTime criadoEm) {
    public static UsuarioResponse fromEntity(Usuario usuario) {
        return new UsuarioResponse(usuario.getId(), usuario.getNome(), usuario.getEmail(), usuario.getTelefone(),
                usuario.getTipo(), usuario.getCriadoEm());
    }
}
