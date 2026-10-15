package com.example.agenda.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.agenda.dto.response.ServicoResponse;
import com.example.agenda.service.PrestadorServicoService;
import com.example.agenda.service.ServicoService;
import com.example.agenda.config.JWTUserData;
import com.example.agenda.dto.request.ServicoRequest;
import com.example.agenda.dto.response.ServicoDetalheResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import java.net.URI;

@RestController
@RequestMapping("/prestadores/{prestadorId}/servicos")
public class PrestadorServicoController {

    private final PrestadorServicoService prestadorServicoService;
    private final ServicoService servicos;

    public PrestadorServicoController(PrestadorServicoService prestadorServicoService, ServicoService servicos) {
        this.prestadorServicoService = prestadorServicoService;
        this.servicos = servicos;
    }

    @GetMapping
    public ResponseEntity<List<ServicoResponse>> listar(@PathVariable UUID prestadorId) {
        return ResponseEntity.ok(prestadorServicoService.listarAtivos(prestadorId));
    }

    @GetMapping("/gestao")
    @PreAuthorize("hasAnyRole('PRESTADOR', 'ADMIN')")
    public List<ServicoDetalheResponse> gerenciar(@PathVariable UUID prestadorId,
            @AuthenticationPrincipal JWTUserData userData) {
        return servicos.gerenciar(prestadorId, userData);
    }

    @GetMapping("/{id}")
    public ServicoDetalheResponse buscar(@PathVariable UUID prestadorId, @PathVariable UUID id,
            @AuthenticationPrincipal JWTUserData userData) {
        return servicos.buscar(prestadorId, id, userData);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('PRESTADOR', 'ADMIN')")
    public ResponseEntity<ServicoDetalheResponse> criar(@PathVariable UUID prestadorId,
            @Valid @RequestBody ServicoRequest request, @AuthenticationPrincipal JWTUserData userData) {
        ServicoDetalheResponse response = servicos.criar(prestadorId, request, userData);
        return ResponseEntity.created(URI.create("/prestadores/" + prestadorId + "/servicos/" + response.id())).body(response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PRESTADOR', 'ADMIN')")
    public ServicoDetalheResponse atualizar(@PathVariable UUID prestadorId, @PathVariable UUID id,
            @Valid @RequestBody ServicoRequest request, @AuthenticationPrincipal JWTUserData userData) {
        return servicos.atualizar(prestadorId, id, request, userData);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PRESTADOR', 'ADMIN')")
    public ResponseEntity<Void> excluir(@PathVariable UUID prestadorId, @PathVariable UUID id,
            @AuthenticationPrincipal JWTUserData userData) {
        servicos.excluir(prestadorId, id, userData);
        return ResponseEntity.noContent().build();
    }
}
