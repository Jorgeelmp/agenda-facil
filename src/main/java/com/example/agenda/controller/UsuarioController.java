package com.example.agenda.controller;

import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.example.agenda.config.JWTUserData;
import com.example.agenda.dto.request.AtualizarContaRequest;
import com.example.agenda.dto.response.AtualizarContaResponse;
import com.example.agenda.dto.response.UsuarioResponse;
import com.example.agenda.dto.response.UsuariosResumoResponse;
import com.example.agenda.service.UsuarioService;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/usuarios")
public class UsuarioController {
    private final UsuarioService usuarios;
    public UsuarioController(UsuarioService usuarios) { this.usuarios = usuarios; }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<UsuarioResponse> listar() { return usuarios.listar(); }

    @GetMapping("/resumo")
    @PreAuthorize("hasRole('ADMIN')")
    public UsuariosResumoResponse resumo() { return usuarios.resumo(); }

    // Minha conta: qualquer usuário logado consulta e edita os próprios dados.
    @GetMapping("/me")
    public UsuarioResponse minhaConta(@AuthenticationPrincipal JWTUserData userData) {
        return usuarios.buscar(userData.userId());
    }

    @PutMapping("/me")
    public AtualizarContaResponse atualizarMinhaConta(@AuthenticationPrincipal JWTUserData userData,
            @Valid @RequestBody AtualizarContaRequest request) {
        return usuarios.atualizarConta(userData.userId(), request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> excluir(@PathVariable UUID id, @AuthenticationPrincipal JWTUserData userData) {
        usuarios.excluir(id, userData.userId());
        return ResponseEntity.noContent().build();
    }
}
