package com.example.agenda.controller;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.example.agenda.dto.response.UsuarioResponse;
import com.example.agenda.dto.response.UsuariosResumoResponse;
import com.example.agenda.service.UsuarioService;

@RestController
@RequestMapping("/usuarios")
@PreAuthorize("hasRole('ADMIN')")
public class UsuarioController {
    private final UsuarioService usuarios;
    public UsuarioController(UsuarioService usuarios) { this.usuarios = usuarios; }

    @GetMapping
    public List<UsuarioResponse> listar() { return usuarios.listar(); }

    @GetMapping("/resumo")
    public UsuariosResumoResponse resumo() { return usuarios.resumo(); }
}
