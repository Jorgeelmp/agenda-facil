package com.example.agenda.service;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.agenda.dto.response.UsuarioResponse;
import com.example.agenda.dto.response.UsuariosResumoResponse;
import com.example.agenda.entity.enums.TipoUsuario;
import com.example.agenda.repository.UsuarioRepository;

@Service
@Transactional(readOnly = true)
public class UsuarioService {
    private final UsuarioRepository usuarios;
    public UsuarioService(UsuarioRepository usuarios) { this.usuarios = usuarios; }

    public List<UsuarioResponse> listar() {
        return usuarios.findAllByOrderByNomeAscEmailAsc().stream().map(UsuarioResponse::fromEntity).toList();
    }

    public UsuariosResumoResponse resumo() {
        long clientes = usuarios.countByTipo(TipoUsuario.CLIENTE);
        long prestadores = usuarios.countByTipo(TipoUsuario.PRESTADOR);
        long admins = usuarios.countByTipo(TipoUsuario.ADMIN);
        return new UsuariosResumoResponse(clientes + prestadores + admins, clientes, prestadores, admins);
    }
}
